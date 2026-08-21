-- ====================================================================
-- Ingenium Tech Academy - Migration 006: EUR Pricing & Storage Setup
-- Purpose: Adds usd_price, ngn_price, and eur_price columns to course_pricing.
-- Sets up the countries_config table with official Eurozone and Nigeria mappings.
-- Creates the 'course-images' Supabase Storage bucket with Admin RLS policies.
-- ====================================================================

-- 1. ALTER COURSE PRICING TO INCLUDE USD, NGN, EUR COLUMNS
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS usd_price NUMERIC CHECK (usd_price >= 0);
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS ngn_price NUMERIC CHECK (ngn_price >= 0);
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS eur_price NUMERIC CHECK (eur_price >= 0);

-- Migrate any existing records' data if they exist, else use standard defaults
UPDATE public.course_pricing 
SET 
    usd_price = COALESCE(usd_price, international_price, 150),
    ngn_price = COALESCE(ngn_price, nigeria_price, 120000),
    eur_price = COALESCE(eur_price, uk_price, 120);

-- Make them NOT NULL after migration
ALTER TABLE public.course_pricing ALTER COLUMN usd_price SET NOT NULL;
ALTER TABLE public.course_pricing ALTER COLUMN ngn_price SET NOT NULL;
ALTER TABLE public.course_pricing ALTER COLUMN eur_price SET NOT NULL;

-- 2. COUNTRIES CONFIGURATION TABLE
CREATE TABLE IF NOT EXISTS public.countries_config (
    country_code TEXT PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE,
    currency_code TEXT NOT NULL CHECK (currency_code IN ('NGN', 'EUR', 'USD')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for country name mapping lookup
CREATE INDEX IF NOT EXISTS idx_countries_config_name ON public.countries_config(country_name);

-- Populate official EUR zone countries and Nigeria
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

-- Enable RLS for countries_config
ALTER TABLE public.countries_config ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES FOR COUNTRIES CONFIGURATION
CREATE POLICY "Anyone can view active country configs"
    ON public.countries_config FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage countries config"
    ON public.countries_config FOR ALL
    USING (public.is_admin());

-- 4. STORAGE BUCKET CREATION FOR COURSE HERO IMAGES
-- Ensure course-images bucket is registered
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-images', 'course-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for the Storage bucket on storage.objects
CREATE POLICY "Public can view course hero images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'course-images');

CREATE POLICY "Admins can upload course hero images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'course-images' AND public.is_admin());

CREATE POLICY "Admins can update course hero images"
    ON storage.objects FOR UPDATE
    WITH CHECK (bucket_id = 'course-images' AND public.is_admin());

CREATE POLICY "Admins can delete course hero images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'course-images' AND public.is_admin());
