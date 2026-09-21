import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase environment variables are missing on the server.');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const orderId = req.query.order_id;
    const ref = req.query.ref;

    if (!orderId && !ref) {
      return res.status(400).json({ error: 'order_id or ref query parameter is required' });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase.from('orders').select('*, items:order_items(*)');
    if (orderId) {
      query = query.eq('id', orderId);
    } else {
      query = query.or(`payment_reference.eq.${ref},wittypay_reference.eq.${ref}`);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If order is already completed in Supabase, return status immediately
    if (order.status === 'completed') {
      return res.status(200).json({
        status: 'completed',
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: order.currency,
        items: order.items || []
      });
    }

    // If still pending, query the Wittypay API using server-side secret key: GET /payments?ref=REFERENCE
    const secretKey = process.env.WITTYPAY_SECRET_KEY;
    const paymentRef = order.payment_reference || order.wittypay_reference || ref;

    if (secretKey && paymentRef) {
      try {
        const verifyRes = await fetch(`https://wittypay.online/api/merchant/v1/payments?ref=${encodeURIComponent(paymentRef)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Accept': 'application/json'
          }
        });

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const gatewayStatus = (verifyData.status || verifyData.data?.status || '').toLowerCase();
          const isPaid = gatewayStatus === 'completed' || gatewayStatus === 'success' || gatewayStatus === 'paid';

          // Verify currency and amount
          const gatewayCurrency = (verifyData.currency || verifyData.data?.currency || 'NGN').toUpperCase();
          const gatewayAmount = Number(verifyData.amount || verifyData.data?.amount || 0);

          if (isPaid && gatewayCurrency === order.currency && (gatewayAmount === 0 || Math.abs(gatewayAmount - Number(order.total_amount)) <= 5)) {
            const now = new Date().toISOString();

            // Authoritatively mark order completed on the server
            await supabase.from('orders').update({
              status: 'completed',
              updated_at: now
            }).eq('id', order.id);

            await supabase.from('payments').update({
              status: 'confirmed',
              confirmed_at: now,
              gateway_response: verifyData,
              updated_at: now
            }).eq('order_id', order.id);

            // Authoritatively activate enrollments
            const orderItems = order.items || [];
            for (const item of orderItems) {
              const { data: existingEnrollment } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', order.student_id)
                .eq('course_id', item.course_id)
                .maybeSingle();

              if (!existingEnrollment) {
                await supabase.from('enrollments').insert([{
                  student_id: order.student_id,
                  course_id: item.course_id,
                  schedule_id: item.schedule_id || null,
                  status: 'active',
                  access_granted: true,
                  access_type: 'paid',
                  approved_at: now
                }]);
              } else {
                await supabase.from('enrollments').update({
                  status: 'active',
                  access_granted: true,
                  access_type: 'paid',
                  schedule_id: item.schedule_id || null,
                  updated_at: now
                }).eq('id', existingEnrollment.id);
              }

              // Update selections
              await supabase.from('course_selections').update({
                status: 'approved',
                updated_at: now
              }).eq('student_id', order.student_id).eq('course_id', item.course_id);
            }

            return res.status(200).json({
              status: 'completed',
              order_id: order.id,
              order_number: order.order_number,
              total_amount: order.total_amount,
              currency: order.currency,
              items: order.items || []
            });
          }
        }
      } catch (checkErr) {
        console.warn('[Wittypay Status Check] Verification check error:', checkErr);
      }
    }

    return res.status(200).json({
      status: order.status,
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      currency: order.currency,
      items: order.items || []
    });

  } catch (err: any) {
    console.error('[Wittypay Status Check] Server error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
