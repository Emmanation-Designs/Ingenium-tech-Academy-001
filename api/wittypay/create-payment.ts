import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

// Resolve Supabase Admin client using service role key if available, else anon key
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { studentId, studentEmail, studentName, items, customerNote } = req.body;

    if (!studentId || !studentEmail || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid payload. studentId, studentEmail, and items array are required.' });
    }

    const supabase = getSupabaseAdmin();

    // 1. Authoritatively verify course prices from Supabase
    const courseIds = items.map((i: any) => i.courseId);
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('id, title')
      .in('id', courseIds);

    if (coursesError || !courses || courses.length === 0) {
      return res.status(404).json({ error: 'Selected course(s) not found in academy database.' });
    }

    const { data: pricingData, error: pricingError } = await supabase
      .from('course_pricing')
      .select('*')
      .in('course_id', courseIds);

    if (pricingError) {
      console.warn('[Wittypay Server] Pricing query notice:', pricingError.message);
    }

    // Build verified order items with authoritative NGN pricing
    const pricingMap = new Map((pricingData || []).map((p: any) => [p.course_id, p]));
    const courseMap = new Map((courses || []).map((c: any) => [c.id, c.title]));

    let totalAmount = 0;
    const verifiedOrderItems: Array<{
      course_id: string;
      schedule_id?: string;
      selection_id?: string;
      course_title: string;
      schedule_label?: string;
      unit_price: number;
      currency: string;
    }> = [];

    for (const item of items) {
      const coursePricing = pricingMap.get(item.courseId);
      // Fallback default NGN price is 120,000 NGN if not explicitly set in database
      const unitPrice = coursePricing?.ngn_price 
        ? Number(coursePricing.ngn_price) 
        : (coursePricing?.nigeria_price ? Number(coursePricing.nigeria_price) : 120000);

      totalAmount += unitPrice;

      verifiedOrderItems.push({
        course_id: item.courseId,
        schedule_id: item.scheduleId || null,
        selection_id: item.selectionId || null,
        course_title: courseMap.get(item.courseId) || item.courseTitle || 'Course',
        schedule_label: item.scheduleLabel || 'Standard Schedule',
        unit_price: unitPrice,
        currency: 'NGN'
      });
    }

    // 2. Generate unique order and payment references
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ING-ORD-${timestamp}-${randomSuffix}`;
    const paymentReference = `WITTY-ING-${timestamp}-${randomSuffix}`;

    const wittypaySecret = process.env.WITTYPAY_SECRET_KEY;
    const wittypayEnv = process.env.WITTYPAY_ENV || 'test';

    // 3. Create the internal Supabase Order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([{
        student_id: studentId,
        order_number: orderNumber,
        total_amount: totalAmount,
        currency: 'NGN',
        status: 'pending',
        payment_reference: paymentReference,
        metadata: {
          student_email: studentEmail,
          student_name: studentName,
          note: customerNote || '',
          env: wittypayEnv
        }
      }])
      .select()
      .single();

    if (orderError || !newOrder) {
      console.error('[Wittypay Server] Error creating order in Supabase:', orderError);
      return res.status(500).json({ error: 'Failed to create internal order record in academy database.' });
    }

    // 4. Create Order Items in Supabase
    const itemsToInsert = verifiedOrderItems.map(item => ({
      order_id: newOrder.id,
      ...item
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('[Wittypay Server] Error inserting order items:', itemsError);
    }

    // 5. Check for Wittypay Secret Key
    if (!wittypaySecret) {
      console.error('[Wittypay Server Configuration Error] WITTYPAY_SECRET_KEY is not defined in environment variables.');
      return res.status(500).json({
        success: false,
        error: 'Payment gateway configuration is missing on the server. Please contact administrator.',
        order_id: newOrder.id,
        reference: paymentReference
      });
    }

    // 6. Prepare real callback URL pointing to Ingenium payment return route
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.ingeniumtechacademy.com';
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.APP_URL || `${proto}://${host}`;
    const callbackUrl = `${baseUrl}/payment/callback?order_id=${encodeURIComponent(newOrder.id)}&ref=${encodeURIComponent(paymentReference)}`;

    // 7. Call the REAL Wittypay API: POST https://wittypay.online/api/merchant/v1/payments
    let wittypayResponse: Response;
    let responseText = '';
    let wittypayJson: any = null;

    try {
      wittypayResponse = await fetch('https://wittypay.online/api/merchant/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${wittypaySecret}`,
        },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'NGN',
          reference: paymentReference,
          callback_url: callbackUrl,
          env: wittypayEnv,
          environment: wittypayEnv,
          customer_email: studentEmail,
          customer_name: studentName || 'Student',
          email: studentEmail,
          name: studentName || 'Student',
          customer: {
            email: studentEmail,
            name: studentName || 'Student',
          },
          description: `Ingenium Tech Academy Course Purchase (${orderNumber})`,
          metadata: {
            order_id: newOrder.id,
            order_number: orderNumber,
            student_id: studentId,
          }
        })
      });

      responseText = await wittypayResponse.text();
      try {
        wittypayJson = JSON.parse(responseText);
      } catch (parseErr) {
        wittypayJson = null;
      }

    } catch (fetchErr: any) {
      console.error('[Wittypay Network Error] Failed to reach Wittypay API endpoint:', fetchErr.message);
      return res.status(502).json({
        success: false,
        error: 'Unable to communicate with the Wittypay payment gateway. Please try again.',
        order_id: newOrder.id,
        reference: paymentReference
      });
    }

    // 8. Extract the REAL checkout_url returned by the Wittypay API
    const checkoutUrl = 
      wittypayJson?.checkout_url ||
      wittypayJson?.data?.checkout_url ||
      wittypayJson?.payment_url ||
      wittypayJson?.data?.payment_url ||
      wittypayJson?.url ||
      wittypayJson?.data?.url ||
      wittypayJson?.link ||
      wittypayJson?.data?.link ||
      wittypayJson?.redirect_url ||
      wittypayJson?.data?.redirect_url;

    const wittypayRef = 
      wittypayJson?.reference ||
      wittypayJson?.data?.reference ||
      paymentReference;

    // 9. Safe server-side logging — does NOT log secrets, auth headers, or sensitive customer credentials
    console.info('[Wittypay Payment Creation]', {
      internal_order_id: newOrder.id,
      payment_reference: paymentReference,
      amount: totalAmount,
      currency: 'NGN',
      wittypay_http_status: wittypayResponse.status,
      checkout_url_returned: Boolean(checkoutUrl),
    });

    // 10. Handle errors or missing checkout_url from Wittypay
    if (!wittypayResponse.ok || !checkoutUrl) {
      const errorMsg = 
        wittypayJson?.message || 
        wittypayJson?.error || 
        wittypayJson?.errors?.[0]?.message || 
        'Wittypay API did not return a valid checkout URL.';

      console.error('[Wittypay Gateway Error Response]', {
        internal_order_id: newOrder.id,
        payment_reference: paymentReference,
        amount: totalAmount,
        currency: 'NGN',
        wittypay_http_status: wittypayResponse.status,
        checkout_url_returned: false,
        gateway_message: errorMsg,
        response_preview: responseText.substring(0, 300)
      });

      // Record failure on payment record in Supabase
      await supabase.from('payments').insert([{
        student_id: studentId,
        reference_id: paymentReference,
        amount: totalAmount,
        currency: 'NGN',
        status: 'failed',
        payment_method: 'wittypay',
        order_id: newOrder.id,
        wittypay_reference: wittypayRef,
        failure_reason: `Gateway HTTP ${wittypayResponse.status}: ${errorMsg}`,
        gateway_response: wittypayJson || { status: wittypayResponse.status, text: responseText.substring(0, 200) },
        notes: `Wittypay Checkout Initialization Failed: ${orderNumber}`
      }]);

      return res.status(wittypayResponse.ok ? 502 : (wittypayResponse.status || 500)).json({
        success: false,
        error: errorMsg || 'Unable to generate Wittypay checkout. Please try again or contact academy support.',
        order_id: newOrder.id,
        reference: paymentReference,
        gateway_status: wittypayResponse.status
      });
    }

    // 11. Record pending payment with the real checkout_url
    await supabase.from('payments').insert([{
      student_id: studentId,
      reference_id: paymentReference,
      amount: totalAmount,
      currency: 'NGN',
      status: 'pending',
      payment_method: 'wittypay',
      order_id: newOrder.id,
      wittypay_reference: wittypayRef,
      checkout_url: checkoutUrl,
      gateway_response: {
        status: wittypayResponse.status,
        env: wittypayEnv,
        reference: wittypayRef
      },
      notes: `Wittypay Course Purchase: ${orderNumber}`
    }]);

    // Update order with Wittypay reference
    await supabase.from('orders').update({
      wittypay_reference: wittypayRef
    }).eq('id', newOrder.id);

    // 12. Return ONLY safe checkout information to the frontend (NEVER return WITTYPAY_SECRET_KEY)
    return res.status(200).json({
      success: true,
      checkout_url: checkoutUrl,
      reference: paymentReference,
      order_id: newOrder.id,
      order_number: orderNumber,
      amount: totalAmount,
      currency: 'NGN'
    });

  } catch (error: any) {
    console.error('[Wittypay Server] Unhandled error during payment creation:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred while creating your course payment. Please try again.'
    });
  }
}
