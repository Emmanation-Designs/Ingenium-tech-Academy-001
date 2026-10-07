-- ====================================================================
-- Ingenium Tech Academy - Migration 020: Teacher Course Management RLS
-- Purpose: 
-- 1. Grants Instructors (teachers) permission to update courses they teach
--    (syllabus, duration, learning outcomes, level, description).
-- 2. Grants Instructors permission to update course schedules (meeting link, time, label).
-- 3. Ensures courses table has level and what_you_will_learn columns.
-- 4. Reloads PostgREST schema cache.
-- ====================================================================

-- 1. Ensure courses columns exist
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Ensure profiles columns, teacher_course_assignments, and helper functions exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

CREATE TABLE IF NOT EXISTS public.teacher_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update Courses RLS Policies: Allow Teachers & Admins to UPDATE courses
DROP POLICY IF EXISTS "Teachers and Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can update courses" ON public.courses;
DROP POLICY IF EXISTS "Only Admins can write courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can manage all courses" ON public.courses;

-- Admins can do everything (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all courses"
    ON public.courses FOR ALL
    USING (public.is_admin());

-- Teachers & Assigned Instructors can update courses (curriculum, syllabus, level, duration, description)
CREATE POLICY "Teachers and Admins can update courses"
    ON public.courses FOR UPDATE
    USING (
        public.is_admin() 
        OR public.is_teacher()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.courses.id
        )
    )
    WITH CHECK (
        public.is_admin() 
        OR public.is_teacher()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.courses.id
        )
    );

-- 4. Update Course Schedules RLS Policies: Allow Teachers & Admins to UPDATE schedules
DROP POLICY IF EXISTS "Teachers and Admins can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Only Admins can write course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Admins can manage all course schedules" ON public.course_schedules;

-- Admins can manage all schedules
CREATE POLICY "Admins can manage all course schedules"
    ON public.course_schedules FOR ALL
    USING (public.is_admin());

-- Teachers & Assigned Instructors can update course schedules
CREATE POLICY "Teachers and Admins can update course schedules"
    ON public.course_schedules FOR UPDATE
    USING (
        public.is_admin() 
        OR public.is_teacher() 
        OR teacher_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.course_schedules.course_id
        )
    )
    WITH CHECK (
        public.is_admin() 
        OR public.is_teacher() 
        OR teacher_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.course_schedules.course_id
        )
    );

-- 5. Class sessions policy for teachers and assigned instructors
DROP POLICY IF EXISTS "Teachers and Admins can manage class sessions" ON public.class_sessions;
CREATE POLICY "Teachers and Admins can manage class sessions"
    ON public.class_sessions FOR ALL
    USING (
        public.is_admin() 
        OR public.is_teacher() 
        OR teacher_id = auth.uid() 
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.class_sessions.course_id
        )
    );

-- 6. Retroactive user role synchronization
-- Ensure users assigned to courses have teacher role if not admin
UPDATE public.profiles
SET role = 'teacher'
WHERE id IN (SELECT DISTINCT teacher_id FROM public.teacher_course_assignments WHERE teacher_id IS NOT NULL)
  AND role != 'admin';

-- Ensure designated admin emails have admin role
UPDATE public.profiles
SET role = 'admin'
WHERE email IN (
    'emmanuelnwaije21@gmail.com',
    'ingeniumvirtualassistant@zohomail.com',
    'modestanwaije1@gmail.com'
);

-- 7. Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
