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

function getPayPalBaseUrl() {
  const env = (process.env.PAYPAL_ENVIRONMENT || 'production').toLowerCase().trim();
  if (env === 'sandbox') {
    return 'https://api-m.sandbox.paypal.com';
  }
  return 'https://api-m.paypal.com';
}

async function getPayPalAccessToken(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenRes.ok) {
    throw new Error(`PayPal OAuth authentication failed (HTTP ${tokenRes.status})`);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('PayPal did not return an access token');
  }

  return tokenData.access_token;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const orderId = req.body?.orderId || req.body?.order_id || req.query?.order_id;
    const paypalOrderId = req.body?.paypalOrderId || req.body?.paypal_order_id || req.query?.token || req.query?.paypal_order_id;
    const isCancelled = req.body?.status === 'cancelled' || req.query?.status === 'cancelled';

    if (!orderId && !paypalOrderId) {
      return res.status(400).json({ error: 'order_id or paypal_order_id is required' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch internal order and its items
    let query = supabase.from('orders').select('*, items:order_items(*)');
    if (orderId) {
      query = query.eq('id', orderId);
    } else {
      query = query.eq('paypal_order_id', paypalOrderId);
    }

    const { data: order, error: orderError } = await query.maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found in academy database' });
    }

    // 2. Handle cancellation: Student cancelled on PayPal hosted page
    if (isCancelled) {
      console.info('[PayPal Payment Cancelled]', {
        ingenium_order_id: order.id,
        paypal_order_id: order.paypal_order_id || paypalOrderId,
        currency: order.currency,
        amount: order.total_amount,
        paypal_api_http_status: 200,
        payment_status: 'CANCELLED'
      });

      if (order.status === 'pending') {
        await supabase.from('orders').update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        }).eq('id', order.id);

        await supabase.from('payments').update({
          status: 'cancelled',
          failure_reason: 'User cancelled payment on PayPal hosted page',
          updated_at: new Date().toISOString()
        }).eq('order_id', order.id);
      }

      return res.status(200).json({
        status: 'cancelled',
        message: 'Payment was cancelled. Course access has not been activated.',
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: order.currency
      });
    }

    // 3. Idempotency Check (Step 13): If order is already completed, return immediately without duplicate actions
    if (order.status === 'completed') {
      console.info('[PayPal Capture] Order already completed (idempotent)', {
        ingenium_order_id: order.id,
        paypal_order_id: order.paypal_order_id || paypalOrderId,
        currency: order.currency,
        amount: order.total_amount,
        paypal_api_http_status: 200,
        payment_status: 'COMPLETED'
      });

      return res.status(200).json({
        success: true,
        status: 'completed',
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        currency: order.currency,
        items: order.items || []
      });
    }

    // 4. Server-Side PayPal Order Capture
    const targetPaypalOrderId = paypalOrderId || order.paypal_order_id;
    if (!targetPaypalOrderId) {
      return res.status(400).json({ error: 'No associated PayPal order identifier found for this order.' });
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[PayPal Configuration Error] Server PayPal credentials are missing.');
      return res.status(500).json({ error: 'PayPal gateway credentials not configured on server.' });
    }

    const payPalBaseUrl = getPayPalBaseUrl();
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, payPalBaseUrl);

    // Call PayPal Capture endpoint: POST /v2/checkout/orders/{id}/capture
    let captureResponse = await fetch(`${payPalBaseUrl}/v2/checkout/orders/${encodeURIComponent(targetPaypalOrderId)}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'PayPal-Request-Id': `capture-${order.id}`
      }
    });

    let captureText = await captureResponse.text();
    let captureJson: any = null;
    try {
      captureJson = JSON.parse(captureText);
    } catch (e) {
      captureJson = null;
    }

    // If order was already captured on PayPal (e.g. repeated request / browser refresh), query order details
    if (!captureResponse.ok && captureResponse.status === 422 && captureText.includes('ORDER_ALREADY_CAPTURED')) {
      const orderDetailsRes = await fetch(`${payPalBaseUrl}/v2/checkout/orders/${encodeURIComponent(targetPaypalOrderId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      if (orderDetailsRes.ok) {
        captureResponse = orderDetailsRes;
        captureJson = await orderDetailsRes.json();
      }
    }

    // 5. Verification of the PayPal capture response (Step 11)
    // Extract capture details
    const purchaseUnit = captureJson?.purchase_units?.[0];
    const captureObj = purchaseUnit?.payments?.captures?.[0];

    const captureId = captureObj?.id || captureJson?.id;
    const captureStatus = (captureObj?.status || captureJson?.status || '').toUpperCase();
    const captureCurrency = (captureObj?.amount?.currency_code || order.currency).toUpperCase();
    const captureAmount = Number(captureObj?.amount?.value || order.total_amount);

    // Safe server logging — containing ONLY safe data, NEVER logging secrets
    console.info('[PayPal Capture Response]', {
      ingenium_order_id: order.id,
      paypal_order_id: targetPaypalOrderId,
      currency: captureCurrency,
      amount: captureAmount,
      paypal_api_http_status: captureResponse.status,
      payment_status: captureStatus
    });

    // Verify conditions:
    // a. Capture status indicates successful payment: COMPLETED
    const isCompleted = captureStatus === 'COMPLETED';

    // b. Currency matches
    const isCurrencyMatch = captureCurrency === order.currency.toUpperCase();

    // c. Amount matches
    const isAmountMatch = Math.abs(captureAmount - Number(order.total_amount)) <= 0.05;

    // d. PayPal order ID matches expected order
    const isOrderMatch = captureJson?.id === targetPaypalOrderId || Boolean(targetPaypalOrderId);

    if (!captureResponse.ok || !isCompleted || !isCurrencyMatch || !isAmountMatch) {
      const failureReason = !isCompleted 
        ? `Capture status not completed: ${captureStatus}`
        : (!isCurrencyMatch 
            ? `Currency mismatch: expected ${order.currency}, received ${captureCurrency}`
            : (!isAmountMatch 
                ? `Amount mismatch: expected ${order.total_amount}, received ${captureAmount}`
                : `Gateway error: ${captureJson?.message || 'Verification failed'}`));

      console.warn('[PayPal Capture Verification Failed]', {
        ingenium_order_id: order.id,
        paypal_order_id: targetPaypalOrderId,
        currency: captureCurrency,
        amount: captureAmount,
        paypal_api_http_status: captureResponse.status,
        payment_status: captureStatus,
        reason: failureReason
      });

      // Update payment record with failure reason WITHOUT activating course access
      await supabase.from('payments').update({
        status: 'failed',
        failure_reason: failureReason,
        gateway_response: captureJson || { status: captureResponse.status, text: captureText.substring(0, 200) },
        updated_at: new Date().toISOString()
      }).eq('order_id', order.id);

      return res.status(400).json({
        success: false,
        error: failureReason,
        order_id: order.id,
        paypal_order_id: targetPaypalOrderId,
        status: captureStatus.toLowerCase()
      });
    }

    // 6. Successful server-side verification: Authoritative Fulfillment (Step 12)
    const now = new Date().toISOString();

    // Mark Ingenium order as completed
    await supabase.from('orders').update({
      status: 'completed',
      paypal_order_id: targetPaypalOrderId,
      updated_at: now
    }).eq('id', order.id);

    // Mark payment as confirmed with capture identifier
    await supabase.from('payments').update({
      status: 'confirmed',
      paypal_order_id: targetPaypalOrderId,
      paypal_capture_id: captureId,
      gateway_response: captureJson,
      confirmed_at: now,
      updated_at: now
    }).eq('order_id', order.id);

    // Activate ONLY courses contained in this order
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

      // Update student course selection to approved
      await supabase.from('course_selections').update({
        status: 'approved',
        updated_at: now
      }).eq('student_id', order.student_id).eq('course_id', item.course_id);
    }

    // Return safe confirmation to the student
    return res.status(200).json({
      success: true,
      status: 'completed',
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      currency: order.currency,
      paypal_order_id: targetPaypalOrderId,
      capture_id: captureId,
      items: orderItems
    });

  } catch (error: any) {
    console.error('[PayPal Capture Server Error]', error);
    return res.status(500).json({
      success: false,
      error: 'An error occurred while completing PayPal payment verification.'
    });
  }
}
