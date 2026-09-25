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

// Eurozone countries for authoritative currency routing
const EUROZONE_COUNTRIES = [
  'AUSTRIA', 'BELGIUM', 'CROATIA', 'CYPRUS', 'ESTONIA', 'FINLAND', 'FRANCE', 'GERMANY', 
  'GREECE', 'IRELAND', 'ITALY', 'LATVIA', 'LITHUANIA', 'LUXEMBOURG', 'MALTA', 'NETHERLANDS', 
  'PORTUGAL', 'SLOVAKIA', 'SLOVENIA', 'SPAIN', 'ANDORRA', 'MONACO', 'SAN MARINO', 'VATICAN CITY',
  'MONTENEGRO', 'KOSOVO', 'EUROPE', 'EUROZONE', 'EU'
];

/**
 * Helper to get PayPal base URL
 * Production: https://api-m.paypal.com
 * Sandbox: only if PAYPAL_ENVIRONMENT is explicitly 'sandbox'
 */
function getPayPalBaseUrl() {
  const env = (process.env.PAYPAL_ENVIRONMENT || 'production').toLowerCase().trim();
  if (env === 'sandbox') {
    return 'https://api-m.sandbox.paypal.com';
  }
  return 'https://api-m.paypal.com';
}

/**
 * Obtain PayPal OAuth access token using client_credentials grant
 * Secrets are strictly server-side and never logged.
 */
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
    const errorText = await tokenRes.text();
    throw new Error(`PayPal OAuth authentication failed (HTTP ${tokenRes.status})`);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('PayPal did not return an access token');
  }

  return tokenData.access_token;
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

    // 1. Fetch student profile to authoritatively determine country
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, country')
      .eq('id', studentId)
      .maybeSingle();

    const studentCountry = (profile?.country || '').trim().toUpperCase();

    // Verification of gateway routing: Nigeria MUST use Wittypay
    if (studentCountry === 'NIGERIA' || studentCountry === 'NG') {
      return res.status(400).json({
        error: 'Nigerian orders must be processed through Wittypay (NGN). Please use Wittypay checkout.'
      });
    }

    // Determine authoritative currency: EUR for Eurozone, USD for all other international countries
    const isEurozone = EUROZONE_COUNTRIES.includes(studentCountry);
    const currency: 'EUR' | 'USD' = isEurozone ? 'EUR' : 'USD';

    // 2. Fetch authoritative course prices from Supabase (DO NOT use client-supplied prices)
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
      console.warn('[PayPal Server] Pricing query notice:', pricingError.message);
    }

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
      
      // Authoritatively use the course's manually configured eur_price or usd_price.
      // Do NOT perform currency conversion.
      let unitPrice = 0;
      if (currency === 'EUR') {
        unitPrice = coursePricing?.eur_price ? Number(coursePricing.eur_price) : 400;
      } else {
        unitPrice = coursePricing?.usd_price ? Number(coursePricing.usd_price) : 400;
      }

      totalAmount += unitPrice;

      verifiedOrderItems.push({
        course_id: item.courseId,
        schedule_id: item.scheduleId || null,
        selection_id: item.selectionId || null,
        course_title: courseMap.get(item.courseId) || item.courseTitle || 'Course',
        schedule_label: item.scheduleLabel || 'Standard Schedule',
        unit_price: unitPrice,
        currency
      });
    }

    // 3. Generate unique order and payment references
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderNumber = `ING-ORD-${timestamp}-${randomSuffix}`;
    const paymentReference = `PP-ING-${timestamp}-${randomSuffix}`;

    // 4. Create internal Supabase order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert([{
        student_id: studentId,
        order_number: orderNumber,
        total_amount: totalAmount,
        currency: currency,
        status: 'pending',
        payment_reference: paymentReference,
        payment_method: 'paypal',
        metadata: {
          student_email: studentEmail,
          student_name: studentName || profile?.full_name || 'Student',
          student_country: studentCountry,
          note: customerNote || '',
          gateway: 'paypal'
        }
      }])
      .select()
      .single();

    if (orderError || !newOrder) {
      console.error('[PayPal Server] Error creating order in Supabase:', orderError);
      return res.status(500).json({ error: 'Failed to create internal order record in academy database.' });
    }

    // 5. Create order items in Supabase
    const itemsToInsert = verifiedOrderItems.map(item => ({
      order_id: newOrder.id,
      ...item
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('[PayPal Server] Error inserting order items:', itemsError);
    }

    // 6. Check PayPal credentials
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[PayPal Configuration Error] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is missing from server environment.');
      return res.status(500).json({
        success: false,
        error: 'PayPal gateway configuration is missing on the server. Please contact administrator.',
        order_id: newOrder.id,
        reference: paymentReference
      });
    }

    const payPalBaseUrl = getPayPalBaseUrl();

    // 7. Obtain server-side PayPal OAuth token
    let accessToken: string;
    try {
      accessToken = await getPayPalAccessToken(clientId, clientSecret, payPalBaseUrl);
    } catch (authErr: any) {
      console.error('[PayPal Auth Error] Failed to obtain PayPal access token:', authErr.message);
      return res.status(502).json({
        success: false,
        error: 'Failed to authenticate with PayPal gateway.',
        order_id: newOrder.id,
        reference: paymentReference
      });
    }

    // 8. Prepare host and redirect URLs
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.ingeniumtechacademy.com';
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
    const baseUrl = process.env.APP_URL || `${proto}://${host}`;
    const returnUrl = `${baseUrl}/payment/return?order_id=${encodeURIComponent(newOrder.id)}&gateway=paypal&ref=${encodeURIComponent(paymentReference)}`;
    const cancelUrl = `${baseUrl}/payment/return?order_id=${encodeURIComponent(newOrder.id)}&gateway=paypal&status=cancelled&ref=${encodeURIComponent(paymentReference)}`;

    // 9. Call PayPal REST API: POST /v2/checkout/orders
    const paypalOrderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: paymentReference,
          description: `Ingenium Tech Academy Course Purchase (${orderNumber})`,
          custom_id: newOrder.id,
          invoice_id: orderNumber,
          amount: {
            currency_code: currency,
            value: totalAmount.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency,
                value: totalAmount.toFixed(2)
              }
            }
          },
          items: verifiedOrderItems.map(item => ({
            name: item.course_title.substring(0, 127),
            unit_amount: {
              currency_code: currency,
              value: Number(item.unit_price).toFixed(2)
            },
            quantity: '1',
            description: (item.schedule_label || 'Standard Schedule').substring(0, 127),
            category: 'DIGITAL_GOODS'
          }))
        }
      ],
      application_context: {
        brand_name: 'Ingenium Tech Academy',
        landing_page: 'NO_PREFERENCE',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl
      }
    };

    const paypalResponse = await fetch(`${payPalBaseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'PayPal-Request-Id': `order-${newOrder.id}`
      },
      body: JSON.stringify(paypalOrderPayload)
    });

    const responseText = await paypalResponse.text();
    let paypalJson: any = null;
    try {
      paypalJson = JSON.parse(responseText);
    } catch (e) {
      paypalJson = null;
    }

    const paypalOrderId = paypalJson?.id;
    const approveLink = (paypalJson?.links || []).find((l: any) => l.rel === 'approve');
    const checkoutUrl = approveLink?.href;

    // Safe server logging — containing ONLY safe data, NEVER logging secrets or tokens
    console.info('[PayPal Order Creation]', {
      ingenium_order_id: newOrder.id,
      paypal_order_id: paypalOrderId || 'none',
      currency: currency,
      amount: totalAmount,
      paypal_api_http_status: paypalResponse.status,
      payment_status: paypalJson?.status || 'UNKNOWN'
    });

    if (!paypalResponse.ok || !paypalOrderId || !checkoutUrl) {
      const errorDetail = paypalJson?.message || paypalJson?.details?.[0]?.description || 'Failed to create PayPal order.';
      console.error('[PayPal Gateway Error Response]', {
        ingenium_order_id: newOrder.id,
        paypal_order_id: paypalOrderId,
        currency,
        amount: totalAmount,
        paypal_api_http_status: paypalResponse.status,
        payment_status: 'FAILED',
        error_detail: errorDetail
      });

      // Record failure on payment record in Supabase
      await supabase.from('payments').insert([{
        student_id: studentId,
        reference_id: paymentReference,
        amount: totalAmount,
        currency: currency,
        status: 'failed',
        payment_method: 'paypal',
        order_id: newOrder.id,
        paypal_order_id: paypalOrderId || null,
        failure_reason: `PayPal HTTP ${paypalResponse.status}: ${errorDetail}`,
        gateway_response: paypalJson || { status: paypalResponse.status, text: responseText.substring(0, 200) },
        notes: `PayPal Order Creation Failed: ${orderNumber}`
      }]);

      return res.status(paypalResponse.status || 500).json({
        success: false,
        error: errorDetail || 'Unable to initiate PayPal checkout. Please try again.',
        order_id: newOrder.id,
        reference: paymentReference
      });
    }

    // 10. Record pending payment and link PayPal order ID in Supabase
    await supabase.from('payments').insert([{
      student_id: studentId,
      reference_id: paymentReference,
      amount: totalAmount,
      currency: currency,
      status: 'pending',
      payment_method: 'paypal',
      order_id: newOrder.id,
      paypal_order_id: paypalOrderId,
      checkout_url: checkoutUrl,
      gateway_response: {
        id: paypalOrderId,
        status: paypalJson.status
      },
      notes: `PayPal Course Purchase: ${orderNumber}`
    }]);

    await supabase.from('orders').update({
      paypal_order_id: paypalOrderId
    }).eq('id', newOrder.id);

    // 11. Return only safe checkout information to the frontend (NEVER secrets)
    return res.status(200).json({
      success: true,
      checkout_url: checkoutUrl,
      order_id: newOrder.id,
      order_number: orderNumber,
      reference: paymentReference,
      paypal_order_id: paypalOrderId,
      amount: totalAmount,
      currency: currency,
      gateway: 'paypal'
    });

  } catch (error: any) {
    console.error('[PayPal Server] Unhandled error during payment creation:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred while creating your PayPal checkout. Please try again.'
    });
  }
}
