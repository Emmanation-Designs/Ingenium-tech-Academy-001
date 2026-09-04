-- ====================================================================
-- Ingenium Tech Academy - Migration 010: Enable Supabase Realtime
-- Purpose:
-- Ensures all core application tables are included in the 'supabase_realtime'
-- publication so changes trigger instant WebSocket updates in the UI.
-- ====================================================================

DO $$
BEGIN
  -- 1. Ensure supabase_realtime publication exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Add application tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_selections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.courses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.course_pricing;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- 3. Set replica identity to full so update/delete payloads include old records if needed
ALTER TABLE public.course_selections REPLICA IDENTITY FULL;
ALTER TABLE public.courses REPLICA IDENTITY FULL;
ALTER TABLE public.enrollments REPLICA IDENTITY FULL;
