import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Disable automatic body parsing on Vercel so we can verify the exact raw webhook payload bytes
export const config = {
  api: {
    bodyParser: false,
  },
};

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
 * Safely reads the raw HTTP request body for both Express (server.ts) and Vercel Serverless Functions.
 */
async function readWebhookRawBody(req: any): Promise<{ rawBody: string; fromStream: boolean }> {
  if (typeof req.rawBody === 'string') {
    return { rawBody: req.rawBody, fromStream: true };
  }
  if (Buffer.isBuffer(req.rawBody)) {
    return { rawBody: req.rawBody.toString('utf8'), fromStream: true };
  }

  // Read directly from Node IncomingMessage stream before touching req.body (Vercel lazy body getter)
  if (req && !req.readableEnded && typeof req.on === 'function') {
    const streamBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8'));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', (err: Error) => reject(err));
    }).catch(() => Buffer.alloc(0));

    if (streamBuffer.length > 0) {
      return { rawBody: streamBuffer.toString('utf8'), fromStream: true };
    }
  }

  // Fallbacks if another middleware/runtime already consumed the stream
  if (Buffer.isBuffer(req.body)) {
    return { rawBody: req.body.toString('utf8'), fromStream: true };
  }
  if (typeof req.body === 'string') {
    return { rawBody: req.body, fromStream: true };
  }
  if (req.body && typeof req.body === 'object') {
    return { rawBody: JSON.stringify(req.body), fromStream: false };
  }
  return { rawBody: '', fromStream: false };
}

/**
 * Timing-safe hex digest comparison without throwing ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
 */
function safeHexCompare(computedHex: string, receivedHex: string): boolean {
  const expectedBuf = Buffer.from(computedHex.toLowerCase(), 'utf8');
  const receivedBuf = Buffer.from(receivedHex.toLowerCase(), 'utf8');
  if (expectedBuf.length === 0 || expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Verifies the incoming Wittypay webhook signature per https://wittypay.co/docs.php
 * Header: X-Wittypay-Signature: sha512=<hex_hmac>
 */
function verifyWittypaySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secretKeys: string[],
  fromStream: boolean
): boolean {
  if (secretKeys.length === 0) {
    console.warn('[Wittypay Webhook] WITTYPAY_SECRET_KEY not set on server.');
    return false;
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return false;
  }

  try {
    const trimmedHeader = signatureHeader.trim();
    const isSha256 = /^sha256=/i.test(trimmedHeader) || (!/^sha512=/i.test(trimmedHeader) && trimmedHeader.length === 64);
    const algorithm = isSha256 ? 'sha256' : 'sha512';
    const cleanReceivedHex = trimmedHeader.replace(/^(sha512|sha256)=/i, '').trim();

    if (!cleanReceivedHex) {
      return false;
    }

    const candidateBodies = fromStream
      ? [rawBody]
      : [rawBody, rawBody.replace(/\//g, '\\/')];

    for (const secret of secretKeys) {
      for (const bodyVariant of candidateBodies) {
        const computedSignature = crypto
          .createHmac(algorithm, secret)
          .update(bodyVariant, 'utf8')
          .digest('hex');

        if (safeHexCompare(computedSignature, cleanReceivedHex)) {
          return true;
        }
      }
    }

    return false;
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
    const rawSignatureHeader =
      req.headers['x-wittypay-signature'] ||
      req.headers['x-signature-sha512'] ||
      req.headers['x-signature-sha256'] ||
      req.headers['x-signature'];
    const signatureHeader = Array.isArray(rawSignatureHeader)
      ? rawSignatureHeader[0]
      : rawSignatureHeader;

    const secretKey = process.env.WITTYPAY_SECRET_KEY;
    const webhookSecret = process.env.WITTYPAY_WEBHOOK_SECRET;
    const secretKeys = Array.from(new Set([webhookSecret, secretKey].filter((s): s is string => Boolean(s && s.trim()))));

    const { rawBody, fromStream } = await readWebhookRawBody(req);

    // 1. Signature Verification
    if (secretKeys.length > 0) {
      const isValid = verifyWittypaySignature(rawBody, signatureHeader, secretKeys, fromStream);
      if (!isValid) {
        console.error('[Wittypay Webhook] Invalid signature rejected.', {
          has_signature_header: Boolean(signatureHeader),
          signature_prefix: typeof signatureHeader === 'string' ? signatureHeader.slice(0, 10) : null,
          signature_length: typeof signatureHeader === 'string' ? signatureHeader.length : 0,
          raw_body_from_stream: fromStream,
          raw_body_length: rawBody.length
        });
        return res.status(401).json({ error: 'Invalid webhook signature.' });
      }
    } else {
      console.warn('[Wittypay Webhook] Warning: WITTYPAY_SECRET_KEY is not configured on server.');
    }

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}));
    } catch (parseErr) {
      console.error('[Wittypay Webhook] Failed to parse JSON webhook body.');
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

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
    const wittypayBaseUrl = (process.env.WITTYPAY_API_BASE_URL || 'https://wittypay.co/api/merchant/v1').replace(/\/+$/, '');
    let verifiedGatewayData: any = null;
    let isGatewayVerified = false;

    if (secretKey) {
      try {
        const verifyRes = await fetch(`${wittypayBaseUrl}/payments?ref=${encodeURIComponent(reference)}`, {
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
      verifiedGatewayData?.data?.currency || 
      verifiedGatewayData?.currency || 
      data.currency || 
      payload.currency || 
      'NGN'
    ).toUpperCase();

    if (reportedCurrency !== 'NGN' && reportedCurrency !== order.currency) {
      console.error(`[Wittypay Webhook] Currency mismatch for order ${order.id}. Expected ${order.currency}, got ${reportedCurrency}`);
      return res.status(400).json({ error: 'Currency verification failed' });
    }

    const reportedAmount = Number(
      verifiedGatewayData?.data?.amount ?? 
      verifiedGatewayData?.amount ?? 
      data.amount ?? 
      payload.amount ?? 
      0
    );

    const orderAmount = Number(order.total_amount);

    if (reportedAmount > 0 && Math.abs(reportedAmount - orderAmount) > 5) {
      console.error(`[Wittypay Webhook] Amount mismatch for order ${order.id}. Expected ${orderAmount}, got ${reportedAmount}`);
      return res.status(400).json({ error: 'Amount verification failed' });
    }

    const gatewayPaymentObj = verifiedGatewayData?.data || (verifiedGatewayData?.reference ? verifiedGatewayData : null);
    const gatewayPaymentStatus = (gatewayPaymentObj?.status || '').toLowerCase();
    const payloadStatus = (data?.status || payload?.status || '').toLowerCase();
    const reportedStatus = gatewayPaymentStatus || payloadStatus;

    const isFailedEvent = event === 'payment.failed' || event === 'charge.failed';
    const isFailedStatus = reportedStatus === 'failed' || reportedStatus === 'cancelled';

    const isSuccessful = !isFailedEvent && !isFailedStatus && (
      reportedStatus === 'success' || 
      reportedStatus === 'completed' || 
      reportedStatus === 'paid' || 
      event === 'charge.success' || 
      event === 'payment.success'
    );

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

    } else if (isFailedEvent || isFailedStatus) {
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
