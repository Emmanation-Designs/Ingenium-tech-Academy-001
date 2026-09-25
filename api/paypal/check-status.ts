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
    const paypalOrderId = req.query.token || req.query.paypal_order_id;
    const ref = req.query.ref || req.query.reference;

    if (!orderId && !paypalOrderId && !ref) {
      return res.status(400).json({ error: 'order_id, paypal_order_id, or ref is required' });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase.from('orders').select('*, items:order_items(*)');
    if (orderId) {
      query = query.eq('id', orderId);
    } else if (paypalOrderId) {
      query = query.eq('paypal_order_id', paypalOrderId);
    } else if (ref) {
      query = query.eq('payment_reference', ref);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({
      status: order.status,
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      currency: order.currency,
      paypal_order_id: order.paypal_order_id,
      items: order.items || []
    });

  } catch (err: any) {
    console.error('[PayPal Status Check Server Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
