-- ====================================================================
-- Ingenium Tech Academy - Migration 015: Disambiguate course_id References
-- Purpose:
-- 1. Fix ambiguous 'course_id' column reference in public.has_active_enrollment()
--    by using explicit 'p_course_id' parameter and table-qualified 'e.course_id'
-- 2. Fully qualify table names and column names in all RLS policies
--    to prevent PostgreSQL 42702 (column reference "course_id" is ambiguous)
-- 3. Notify PostgREST to reload schema cache
-- ====================================================================

-- 1. Re-define public.has_active_enrollment keeping input parameter name 'course_id'
-- PostgreSQL error 42P13 prevents changing parameter names with CREATE OR REPLACE FUNCTION.
-- We qualify table column as 'e.course_id' and function argument as 'has_active_enrollment.course_id'.
CREATE OR REPLACE FUNCTION public.has_active_enrollment(course_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF has_active_enrollment.course_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.student_id = auth.uid() 
      AND e.course_id = has_active_enrollment.course_id 
      AND e.status = 'active'
      AND e.access_granted = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.has_active_enrollment(UUID) TO anon, authenticated, service_role;

-- 2. Fully qualify RLS policies across all tables referencing course_id

-- Course Modules
DROP POLICY IF EXISTS "Students can view modules and lessons for active enrollments" ON public.course_modules;
CREATE POLICY "Students can view modules and lessons for active enrollments"
    ON public.course_modules FOR SELECT
    USING (public.has_active_enrollment(course_modules.course_id));

-- Course Lessons
DROP POLICY IF EXISTS "Students can view lessons for active enrollments" ON public.course_lessons;
CREATE POLICY "Students can view lessons for active enrollments"
    ON public.course_lessons FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.course_modules cm
        WHERE cm.id = course_lessons.module_id 
          AND public.has_active_enrollment(cm.course_id)
    ));

-- Class Sessions
DROP POLICY IF EXISTS "Students can view class sessions they are enrolled in" ON public.class_sessions;
DROP POLICY IF EXISTS "Enrolled students can view class sessions for their enrolled courses" ON public.class_sessions;
CREATE POLICY "Enrolled students can view class sessions for their enrolled courses"
    ON public.class_sessions FOR SELECT
    USING (public.has_active_enrollment(class_sessions.course_id));

-- Lesson Materials
DROP POLICY IF EXISTS "Enrolled students can view lesson materials" ON public.lesson_materials;
CREATE POLICY "Enrolled students can view lesson materials"
    ON public.lesson_materials FOR SELECT
    USING (public.has_active_enrollment(lesson_materials.course_id));

-- Class Recordings
DROP POLICY IF EXISTS "Enrolled students can view class recordings" ON public.class_recordings;
CREATE POLICY "Enrolled students can view class recordings"
    ON public.class_recordings FOR SELECT
    USING (public.has_active_enrollment(class_recordings.course_id));

-- Quizzes
DROP POLICY IF EXISTS "Enrolled students can view published quizzes" ON public.quizzes;
CREATE POLICY "Enrolled students can view published quizzes"
    ON public.quizzes FOR SELECT
    USING (quizzes.is_published = true AND public.has_active_enrollment(quizzes.course_id));

-- Quiz Questions
DROP POLICY IF EXISTS "Enrolled students can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Enrolled students can view quiz questions"
    ON public.quiz_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id 
              AND q.is_published = true 
              AND public.has_active_enrollment(q.course_id)
        )
    );

-- Quiz Options
DROP POLICY IF EXISTS "Enrolled students can view quiz options" ON public.quiz_options;
CREATE POLICY "Enrolled students can view quiz options"
    ON public.quiz_options FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quiz_questions qq
            JOIN public.quizzes q ON q.id = qq.quiz_id
            WHERE qq.id = quiz_options.question_id 
              AND q.is_published = true 
              AND public.has_active_enrollment(q.course_id)
        )
    );

-- Teacher assignments check on enrollments
DROP POLICY IF EXISTS "Teachers can view enrollments for assigned courses" ON public.enrollments;
CREATE POLICY "Teachers can view enrollments for assigned courses"
    ON public.enrollments FOR SELECT
    USING (
        public.is_teacher() AND (
            EXISTS (
                SELECT 1 FROM public.teacher_course_assignments tca
                WHERE tca.teacher_id = auth.uid() AND tca.course_id = enrollments.course_id
            ) OR
            EXISTS (
                SELECT 1 FROM public.course_schedules cs
                WHERE cs.teacher_id = auth.uid() AND cs.course_id = enrollments.course_id
            )
        )
    );

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
