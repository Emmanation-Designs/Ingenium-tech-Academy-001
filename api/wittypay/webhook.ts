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
    // If no secret key is set on test environment, log warning and allow for development verification
    console.warn('[Wittypay Webhook] WITTYPAY_SECRET_KEY not set on server. Skipping signature check in test mode.');
    return true;
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
    const signatureHeader = req.headers['x-signature-sha256'] || req.headers['x-wittypay-signature'];
    const secretKey = process.env.WITTYPAY_SECRET_KEY;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // Verify signature if secret key is present
    if (secretKey && !verifyWittypaySignature(rawBody, signatureHeader as string, secretKey)) {
      console.error('[Wittypay Webhook] Invalid webhook signature detected.');
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = payload.event || payload.type || 'payment.success';
    const data = payload.data || payload;

    const reference = data.reference || data.payment_reference || payload.reference;
    const status = (data.status || payload.status || '').toLowerCase();
    const isSuccessful = status === 'success' || status === 'completed' || status === 'paid' || event === 'charge.success' || event === 'payment.success';

    if (!reference) {
      console.warn('[Wittypay Webhook] Missing reference in webhook payload:', payload);
      return res.status(400).json({ error: 'Missing payment reference' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Find the corresponding order using payment_reference or wittypay_reference
    let { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .or(`payment_reference.eq.${reference},wittypay_reference.eq.${reference}`)
      .maybeSingle();

    if (orderErr || !order) {
      // Also attempt searching by order_id from metadata
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
      console.warn(`[Wittypay Webhook] Order not found for reference ${reference}`);
      // Return 200 to acknowledge receipt to prevent gateway retries for unknown references
      return res.status(200).json({ received: true, warning: 'Order not found' });
    }

    // IDEMPOTENCY CHECK: If order is already completed, do not duplicate enrollments
    if (order.status === 'completed') {
      console.info(`[Wittypay Webhook] Order ${order.id} is already fulfilled. Skipping duplicate execution.`);
      return res.status(200).json({ received: true, already_processed: true });
    }

    if (isSuccessful) {
      const now = new Date().toISOString();

      // 2. Mark order completed
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          updated_at: now
        })
        .eq('id', order.id);

      // 3. Mark payment confirmed
      await supabase
        .from('payments')
        .update({
          status: 'confirmed',
          confirmed_at: now,
          gateway_response: payload,
          updated_at: now
        })
        .eq('order_id', order.id);

      // 4. Activate enrollments and course selections for each purchased item
      const orderItems = order.items || [];

      for (const item of orderItems) {
        // Create/Activate Enrollment (idempotent: check if active enrollment already exists)
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
          // Re-activate if was previously inactive
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

        // If this order item was tied to a course_selection, mark selection approved
        if (item.selection_id) {
          await supabase.from('course_selections')
            .update({
              status: 'approved',
              updated_at: now
            })
            .eq('id', item.selection_id);
        } else {
          // Check if there is any pending selection for this course and student
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

      console.info(`[Wittypay Webhook] Successfully fulfilled Order ${order.id} for Student ${order.student_id}`);
      return res.status(200).json({ success: true, fulfilled: true, order_id: order.id });

    } else if (status === 'failed' || status === 'cancelled') {
      // Payment failed or cancelled
      const now = new Date().toISOString();
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
          failure_reason: data.reason || data.message || 'Payment transaction was declined or failed',
          gateway_response: payload,
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
