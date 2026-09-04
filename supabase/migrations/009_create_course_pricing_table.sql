-- ====================================================================
-- Ingenium Tech Academy - Migration 009: Course Pricing Table & Schema Cache Fix
-- Purpose: 
-- 1. Creates the public.course_pricing table with multi-currency fields (USD, NGN, EUR).
-- 2. Grants necessary table permissions to anon, authenticated, and service_role.
-- 3. Enables RLS with clean policies for public viewing and Admin management.
-- 4. Creates the public.countries_config table.
-- 5. Forces PostgREST to reload its schema cache.
-- ====================================================================

-- 1. CREATE COURSE PRICING TABLE
CREATE TABLE IF NOT EXISTS public.course_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL UNIQUE,
    usd_price NUMERIC NOT NULL DEFAULT 150 CHECK (usd_price >= 0),
    ngn_price NUMERIC NOT NULL DEFAULT 120000 CHECK (ngn_price >= 0),
    eur_price NUMERIC NOT NULL DEFAULT 120 CHECK (eur_price >= 0),
    international_price NUMERIC DEFAULT 150,
    nigeria_price NUMERIC DEFAULT 120000,
    uk_price NUMERIC DEFAULT 120,
    international_currency TEXT NOT NULL DEFAULT 'USD',
    nigeria_currency TEXT NOT NULL DEFAULT 'NGN',
    uk_currency TEXT NOT NULL DEFAULT 'GBP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast lookup by course_id
CREATE INDEX IF NOT EXISTS idx_course_pricing_course_id ON public.course_pricing(course_id);

-- Ensure all columns exist if the table was partially created previously
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS usd_price NUMERIC DEFAULT 150 CHECK (usd_price >= 0);
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS ngn_price NUMERIC DEFAULT 120000 CHECK (ngn_price >= 0);
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS eur_price NUMERIC DEFAULT 120 CHECK (eur_price >= 0);

-- Backfill default pricing for any existing courses that do not have a pricing row yet
INSERT INTO public.course_pricing (course_id, usd_price, ngn_price, eur_price)
SELECT id, 150, 120000, 120
FROM public.courses
ON CONFLICT (course_id) DO NOTHING;

-- 2. GRANT PERMISSIONS (Allows PostgREST to expose the table in the schema cache)
GRANT ALL ON TABLE public.course_pricing TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_pricing TO authenticated;
GRANT SELECT ON TABLE public.course_pricing TO anon;

-- 3. ROW LEVEL SECURITY (RLS) FOR COURSE PRICING
ALTER TABLE public.course_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view course pricing" ON public.course_pricing;
DROP POLICY IF EXISTS "Admins can manage course pricing" ON public.course_pricing;
DROP POLICY IF EXISTS "Only Admins can manage course pricing" ON public.course_pricing;

-- Policy: Everyone can view course pricing
CREATE POLICY "Anyone can view course pricing"
    ON public.course_pricing FOR SELECT
    USING (true);

-- Policy: Authenticated Admins can insert, update, delete pricing
CREATE POLICY "Admins can manage course pricing"
    ON public.course_pricing FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. CREATE COUNTRIES CONFIGURATION TABLE (if missing)
CREATE TABLE IF NOT EXISTS public.countries_config (
    country_code TEXT PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE,
    currency_code TEXT NOT NULL CHECK (currency_code IN ('NGN', 'EUR', 'USD')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT ALL ON TABLE public.countries_config TO postgres, service_role;
GRANT SELECT ON TABLE public.countries_config TO authenticated, anon;
ALTER TABLE public.countries_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active country configs" ON public.countries_config;
CREATE POLICY "Anyone can view active country configs"
    ON public.countries_config FOR SELECT
    USING (is_active = true);

INSERT INTO public.countries_config (country_code, country_name, currency_code)
VALUES
  ('NG', 'Nigeria', 'NGN'),
  ('DE', 'Germany', 'EUR'),
  ('FR', 'France', 'EUR'),
  ('IT', 'Italy', 'EUR'),
  ('ES', 'Spain', 'EUR'),
  ('NL', 'Netherlands', 'EUR'),
  ('BE', 'Belgium', 'EUR'),
  ('AT', 'Austria', 'EUR'),
  ('IE', 'Ireland', 'EUR'),
  ('PT', 'Portugal', 'EUR'),
  ('GR', 'Greece', 'EUR'),
  ('FI', 'Finland', 'EUR')
ON CONFLICT (country_code) DO NOTHING;

-- 5. RELOAD SCHEMA CACHE IN POSTGREST IMMEDIATELY
NOTIFY pgrst, 'reload schema';
