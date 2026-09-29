-- ====================================================================
-- Ingenium Tech Academy - Migration 019: Course Details (Level & What You Will Learn)
-- Purpose:
-- 1. Ensure public.courses has level and what_you_will_learn columns.
-- 2. Reload PostgREST schema cache.
-- ====================================================================

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT;

-- Reload schema
NOTIFY pgrst, 'reload schema';
