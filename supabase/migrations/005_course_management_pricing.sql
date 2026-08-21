-- ====================================================================
-- Ingenium Tech Academy - Migration 005: Course Categories & Course Pricing
-- Purpose: Supports modular course catalog categorizations and fixed
-- multi-currency pricing (International, Nigeria, UK) with RLS safety.
-- ====================================================================

-- 1. COURSE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.course_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for category slug lookups
CREATE INDEX IF NOT EXISTS idx_course_categories_slug ON public.course_categories(slug);

-- 2. ALTER COURSES TO ADD CATEGORY FOREIGN KEY
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT; -- Fallback field for old category names if any

-- 3. COURSE PRICING TABLE
CREATE TABLE IF NOT EXISTS public.course_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL UNIQUE,
    international_price NUMERIC NOT NULL CHECK (international_price >= 0),
    nigeria_price NUMERIC NOT NULL CHECK (nigeria_price >= 0),
    uk_price NUMERIC NOT NULL CHECK (uk_price >= 0),
    international_currency TEXT NOT NULL DEFAULT 'USD',
    nigeria_currency TEXT NOT NULL DEFAULT 'NGN',
    uk_currency TEXT NOT NULL DEFAULT 'GBP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for course pricing lookups
CREATE INDEX IF NOT EXISTS idx_course_pricing_course_id ON public.course_pricing(course_id);

-- 4. ALTER COURSE SELECTIONS TO ADD PRICE AND CURRENCY SNAPSHOTS
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS currency_snapshot TEXT;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS student_country TEXT;

-- ====================================================================
-- Enable Row Level Security (RLS) for new tables
-- ====================================================================
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_pricing ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 5. COURSE CATEGORIES POLICIES
-- ====================================================================
CREATE POLICY "Anyone can view active categories"
    ON public.course_categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage all categories"
    ON public.course_categories FOR ALL
    USING (public.is_admin());

-- ====================================================================
-- 6. COURSE PRICING POLICIES
-- ====================================================================
CREATE POLICY "Anyone can view course pricing"
    ON public.course_pricing FOR SELECT
    USING (true);

CREATE POLICY "Only Admins can manage course pricing"
    ON public.course_pricing FOR ALL
    USING (public.is_admin());
