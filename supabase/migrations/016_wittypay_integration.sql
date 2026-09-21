-- ====================================================================
-- Ingenium Tech Academy - Migration 016: Wittypay Automatic Course Purchase System
-- Purpose:
-- 1. Create orders table for multi-item or single-item course purchases.
-- 2. Create order_items table tracking individual course snapshots and schedules.
-- 3. Update/extend payments table with wittypay_reference, checkout_url, channel, currency.
-- 4. Enable RLS on orders, order_items, and update payments RLS policies.
-- 5. Force PostgREST schema cache reload.
-- ====================================================================

-- 1. CREATE ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_reference TEXT,
    wittypay_reference TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast user order lookups
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON public.orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_wittypay_ref ON public.orders(wittypay_reference);

-- 2. CREATE ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE RESTRICT NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    selection_id UUID REFERENCES public.course_selections(id) ON DELETE SET NULL,
    course_title TEXT NOT NULL,
    schedule_label TEXT,
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_course_id ON public.order_items(course_id);

-- 3. EXTEND PAYMENTS TABLE TO SUPPORT WITTYPAY AUTOMATIC GATEWAY
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS wittypay_reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS checkout_url TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_wittypay_ref ON public.payments(wittypay_reference);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);

-- 4. GRANT PERMISSIONS FOR POSTGREST
GRANT ALL ON TABLE public.orders TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.orders TO anon;

GRANT ALL ON TABLE public.order_items TO postgres, service_role;
GRANT SELECT, INSERT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.order_items TO anon;

-- 5. ROW LEVEL SECURITY (RLS) FOR ORDERS AND ORDER ITEMS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Orders RLS Policies
DROP POLICY IF EXISTS "Students can view their own orders" ON public.orders;
CREATE POLICY "Students can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can create their own orders" ON public.orders;
CREATE POLICY "Students can create their own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view and manage all orders" ON public.orders;
CREATE POLICY "Admins can view and manage all orders"
    ON public.orders FOR ALL
    USING (public.is_admin());

-- Order Items RLS Policies
DROP POLICY IF EXISTS "Students can view their own order items" ON public.order_items;
CREATE POLICY "Students can view their own order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students can create order items for their orders" ON public.order_items;
CREATE POLICY "Students can create order items for their orders"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND o.student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items"
    ON public.order_items FOR ALL
    USING (public.is_admin());

-- 6. RELOAD SCHEMA CACHE IN POSTGREST IMMEDIATELY
NOTIFY pgrst, 'reload schema';
