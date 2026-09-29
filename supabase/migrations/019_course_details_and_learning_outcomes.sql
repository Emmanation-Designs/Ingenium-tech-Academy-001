-- ====================================================================
-- Ingenium Tech Academy - Migration 019: Course Level & Learning Outcomes
-- Purpose:
-- 1. Add level column to public.courses (e.g. 'Beginner', 'Intermediate', 'Advanced', 'All Levels')
-- 2. Add what_you_will_learn column to public.courses (learning outcomes)
-- 3. Reload PostgREST schema cache
-- ====================================================================

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT;

-- Reload schema
NOTIFY pgrst, 'reload schema';
