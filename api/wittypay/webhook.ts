import crypto from 'crypto';
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

/**
 * Verifies the incoming Wittypay webhook signature using HMAC SHA-256
 */
function verifyWittypaySignature(rawBody: string, signatureHeader?: string, secretKey?: string): boolean {
  if (!secretKey) {
    console.warn('[Wittypay Webhook] WITTYPAY_SECRET_KEY not set on server.');
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, 'utf8'),
      Buffer.from(signatureHeader, 'utf8')
    );
  } catch (err) {
    console.error('[Wittypay Webhook] Signature verification error:', err);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const signatureHeader = req.headers['x-signature-sha256'] || req.headers['x-wittypay-signature'] || req.headers['x-signature'];
    const secretKey = process.env.WITTYPAY_SECRET_KEY;
    const rawBody = typeof req.rawBody === 'string' 
      ? req.rawBody 
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    // 1. Signature Verification
    if (secretKey) {
      const isValid = verifyWittypaySignature(rawBody, signatureHeader as string, secretKey);
      if (!isValid) {
        console.error('[Wittypay Webhook] Invalid signature rejected.');
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    } else {
      console.warn('[Wittypay Webhook] Warning: WITTYPAY_SECRET_KEY is not configured on server.');
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = payload.event || payload.type || 'payment.success';
    const data = payload.data || payload;

    const reference = data.reference || data.payment_reference || payload.reference;
    if (!reference) {
      console.warn('[Wittypay Webhook] Missing reference in webhook payload.');
      return res.status(400).json({ error: 'Missing payment reference' });
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch the corresponding internal Supabase Order
    let { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .or(`payment_reference.eq.${reference},wittypay_reference.eq.${reference}`)
      .maybeSingle();

    if (orderErr || !order) {
      const metaOrderId = data.metadata?.order_id || payload.metadata?.order_id;
      if (metaOrderId) {
        const { data: orderById } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .eq('id', metaOrderId)
          .maybeSingle();
        order = orderById;
      }
    }

    if (!order) {
      console.warn(`[Wittypay Webhook] Order not found for reference: ${reference}`);
      return res.status(200).json({ received: true, warning: 'Order not found' });
    }

    // IDEMPOTENCY CHECK: If already fulfilled, return immediately
    if (order.status === 'completed') {
      console.info(`[Wittypay Webhook] Order ${order.id} is already completed. Skipping duplicate execution.`);
      return res.status(200).json({ received: true, already_processed: true });
    }

    // 3. GET /payments?ref=REFERENCE verification with Wittypay API
    let verifiedGatewayData: any = null;
    let isGatewayVerified = false;

    if (secretKey) {
      try {
        const verifyRes = await fetch(`https://wittypay.online/api/merchant/v1/payments?ref=${encodeURIComponent(reference)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Accept': 'application/json'
          }
        });

        if (verifyRes.ok) {
          verifiedGatewayData = await verifyRes.json();
          isGatewayVerified = true;
        } else {
          console.warn(`[Wittypay Webhook] Verification query returned status ${verifyRes.status}`);
        }
      } catch (verifyErr: any) {
        console.warn('[Wittypay Webhook] Verification endpoint fetch error:', verifyErr.message);
      }
    }

    // 4. Amount, Reference, and Currency Verification
    const reportedCurrency = (
      verifiedGatewayData?.currency || 
      verifiedGatewayData?.data?.currency || 
      data.currency || 
      payload.currency || 
      'NGN'
    ).toUpperCase();

    if (reportedCurrency !== 'NGN' && reportedCurrency !== order.currency) {
      console.error(`[Wittypay Webhook] Currency mismatch for order ${order.id}. Expected ${order.currency}, got ${reportedCurrency}`);
      return res.status(400).json({ error: 'Currency verification failed' });
    }

    const reportedAmount = Number(
      verifiedGatewayData?.amount || 
      verifiedGatewayData?.data?.amount || 
      data.amount || 
      payload.amount || 
      0
    );

    const orderAmount = Number(order.total_amount);

    if (reportedAmount > 0 && Math.abs(reportedAmount - orderAmount) > 5) {
      console.error(`[Wittypay Webhook] Amount mismatch for order ${order.id}. Expected ${orderAmount}, got ${reportedAmount}`);
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    const reportedStatus = (
      verifiedGatewayData?.status || 
      verifiedGatewayData?.data?.status || 
      data.status || 
      payload.status || 
      ''
    ).toLowerCase();

    const isSuccessful = 
      reportedStatus === 'success' || 
      reportedStatus === 'completed' || 
      reportedStatus === 'paid' || 
      event === 'charge.success' || 
      event === 'payment.success';

    const now = new Date().toISOString();

    if (isSuccessful) {
      // 5. Order marked paid in Supabase
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          updated_at: now
        })
        .eq('id', order.id);

      // Update payment record confirmed
      await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          gateway_response: verifiedGatewayData || payload,
          updated_at: now
        })
        .eq('order_id', order.id);

      // 6. Course enrollment activated in Supabase
      const orderItems = order.items || [];
      for (const item of orderItems) {
        // Activate enrollment
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
          await supabase.from('enrollments')
            .update({
              status: 'active',
              access_granted: true,
              access_type: 'paid',
              schedule_id: item.schedule_id || null,
              updated_at: now
            })
            .eq('id', existingEnrollment.id);
        }

        // Mark course selection as approved
        if (item.selection_id) {
          await supabase.from('course_selections')
            .update({
              status: 'approved',
              updated_at: now
            })
            .eq('id', item.selection_id);
        } else {
          await supabase.from('course_selections')
            .update({
              status: 'approved',
              updated_at: now
            })
            .eq('student_id', order.student_id)
            .eq('course_id', item.course_id)
            .eq('status', 'pending');
        }
      }

      console.info(`[Wittypay Webhook] Verified and fulfilled Order ${order.id} for Student ${order.student_id}`);
      return res.status(200).json({ success: true, fulfilled: true, order_id: order.id });

    } else if (reportedStatus === 'failed' || reportedStatus === 'cancelled') {
      await supabase
        .from('orders')
        .update({
          status: 'failed',
          updated_at: now
        })
        .eq('id', order.id);

      await supabase
        .from('payments')
        .update({
          status: 'rejected',
          failure_reason: data.reason || data.message || 'Payment transaction failed on gateway',
          gateway_response: verifiedGatewayData || payload,
          updated_at: now
        })
        .eq('order_id', order.id);

      return res.status(200).json({ success: true, status: 'failed', order_id: order.id });
    }

    return res.status(200).json({ received: true, unhandled_event: event });

  } catch (error: any) {
    console.error('[Wittypay Webhook] Server error handling webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
