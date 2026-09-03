-- ====================================================================
-- Ingenium Tech Academy - Migration 007: Safe Schema Synchronization
-- Purpose: 
-- 1. Adds price_snapshot, currency_snapshot, student_country to course_selections
-- 2. Safely creates course_categories table before foreign key reference
-- 3. Adds category_id and category to courses table
-- 4. Reloads PostgREST schema cache
-- ====================================================================

-- 1. Add snapshot columns to course_selections (Safe & Idempotent)
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS currency_snapshot TEXT;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS student_country TEXT;

-- 2. Create course_categories table FIRST before any table references it
CREATE TABLE IF NOT EXISTS public.course_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_course_categories_slug ON public.course_categories(slug);

-- Enable RLS on course_categories
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;

-- Category RLS policies (drop first to prevent duplicate errors)
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.course_categories;
CREATE POLICY "Anyone can view active categories"
    ON public.course_categories FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage all categories" ON public.course_categories;
CREATE POLICY "Admins can manage all categories"
    ON public.course_categories FOR ALL
    USING (public.is_admin());

-- 3. Populate default categories if not present
INSERT INTO public.course_categories (name, slug, is_active)
VALUES 
    ('Data Science', 'data-science', true),
    ('Design', 'design', true),
    ('Marketing', 'marketing', true),
    ('Development', 'development', true)
ON CONFLICT (slug) DO NOTHING;

-- 4. Now safely add category columns to courses table
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;

-- 5. Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

