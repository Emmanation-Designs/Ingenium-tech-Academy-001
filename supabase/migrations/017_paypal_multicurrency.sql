-- ====================================================================
-- Ingenium Tech Academy - Migration 017: Multi-currency & PayPal Integration
-- Purpose:
-- 1. Relax currency check constraint on public.orders to allow NGN, USD, and EUR.
-- 2. Add paypal_order_id and payment_method columns to orders.
-- 3. Add paypal_order_id and paypal_capture_id columns to payments.
-- 4. Reload PostgREST schema cache.
-- ====================================================================

-- 1. Relax currency constraint on orders if exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_currency_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_currency_check CHECK (currency IN ('NGN', 'USD', 'EUR'));

-- 2. Add PayPal columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wittypay';

-- 3. Add PayPal columns to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON public.orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON public.payments(paypal_order_id);

-- 5. Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
