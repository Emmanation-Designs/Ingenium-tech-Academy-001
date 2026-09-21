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
      console.warn('[Wittypay Server] Pricing query error:', pricingError.message);
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
      // Fallback default NGN price is 120,000 NGN if not explicitly overridden
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

    // 3. Create the Order in Supabase
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
          env: process.env.WITTYPAY_ENV || 'test'
        }
      }])
      .select()
      .single();

    if (orderError || !newOrder) {
      console.error('[Wittypay Server] Error creating order in Supabase:', orderError);
      return res.status(500).json({ error: 'Failed to create order record in academy database.' });
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

    // 5. Initialize payment with Wittypay API using server secret
    const wittypaySecret = process.env.WITTYPAY_SECRET_KEY;
    const wittypayEnv = process.env.WITTYPAY_ENV || 'test';
    const appUrl = process.env.APP_URL || 'https://ingeniumtechacademy.com';

    // Prepare callback & webhook URLs
    const callbackUrl = `${appUrl}/student?order_id=${newOrder.id}&ref=${paymentReference}&status=success`;
    let checkoutUrl = '';
    let wittypayTransactionId = paymentReference;
    let gatewayRawResponse: any = null;

    if (wittypaySecret) {
      try {
        // Wittypay REST API payment initialization
        const wittypayResponse = await fetch('https://api.wittypay.online/api/checkout/v1/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wittypaySecret}`,
          },
          body: JSON.stringify({
            amount: totalAmount,
            currency: 'NGN',
            reference: paymentReference,
            customer_email: studentEmail,
            customer_name: studentName || 'Student',
            description: `Ingenium Tech Academy Course Purchase (${verifiedOrderItems.map(i => i.course_title).join(', ')})`,
            callback_url: callbackUrl,
            webhooks: {
              url: `${appUrl}/api/wittypay/webhook`
            },
            metadata: {
              order_id: newOrder.id,
              student_id: studentId,
              order_number: orderNumber
            }
          })
        });

        const wittypayJson = await wittypayResponse.json();
        gatewayRawResponse = wittypayJson;

        if (wittypayResponse.ok && (wittypayJson.checkout_url || wittypayJson.data?.checkout_url || wittypayJson.payment_url)) {
          checkoutUrl = wittypayJson.checkout_url || wittypayJson.data?.checkout_url || wittypayJson.payment_url;
          wittypayTransactionId = wittypayJson.reference || wittypayJson.data?.reference || paymentReference;
        } else {
          console.warn('[Wittypay Gateway] API returned non-checkout response, using simulated test gateway:', wittypayJson);
          // In test mode or sandbox preview without live credentials
          checkoutUrl = `${appUrl}/checkout/test-pay?order_id=${newOrder.id}&ref=${paymentReference}&amount=${totalAmount}`;
        }
      } catch (err: any) {
        console.warn('[Wittypay Gateway] Gateway fetch exception, falling back to test gateway url:', err.message);
        checkoutUrl = `${appUrl}/checkout/test-pay?order_id=${newOrder.id}&ref=${paymentReference}&amount=${totalAmount}`;
      }
    } else {
      // In development/test mode without live merchant key configured
      console.info('[Wittypay Gateway] WITTYPAY_SECRET_KEY not set, using test checkout flow.');
      checkoutUrl = `${appUrl}/checkout/test-pay?order_id=${newOrder.id}&ref=${paymentReference}&amount=${totalAmount}`;
    }

    // 6. Record Payment record in Supabase
    await supabase.from('payments').insert([{
      student_id: studentId,
      reference_id: paymentReference,
      amount: totalAmount,
      currency: 'NGN',
      status: 'pending',
      payment_method: 'wittypay',
      order_id: newOrder.id,
      wittypay_reference: wittypayTransactionId,
      checkout_url: checkoutUrl,
      gateway_response: gatewayRawResponse || { mode: wittypayEnv },
      notes: `Wittypay Course Purchase: ${orderNumber}`
    }]);

    // Update order with wittypay_reference
    await supabase.from('orders').update({
      wittypay_reference: wittypayTransactionId
    }).eq('id', newOrder.id);

    return res.status(200).json({
      success: true,
      order_id: newOrder.id,
      order_number: orderNumber,
      reference: paymentReference,
      checkout_url: checkoutUrl,
      amount: totalAmount,
      currency: 'NGN'
    });

  } catch (error: any) {
    console.error('[Wittypay Server] Unhandled error during payment creation:', error);
    return res.status(500).json({
      error: 'An error occurred while creating your course payment. Please try again or contact support.'
    });
  }
}
