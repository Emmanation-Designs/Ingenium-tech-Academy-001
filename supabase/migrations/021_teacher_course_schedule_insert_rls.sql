-- ====================================================================
-- Ingenium Tech Academy - Migration 021: Complete Self-Contained Schema, Teacher RLS & Permissions
-- Purpose:
-- 1. Creates or verifies all prerequisite tables (profiles, courses, course_schedules,
--    teacher_course_assignments, teacher_invitations, class_sessions, class_recordings)
--    so this migration can run cleanly in any Supabase environment without dependency errors.
-- 2. Defines public.is_admin(), public.is_teacher(), and public.is_staff() functions.
-- 3. Grants instructors (teachers) permission to INSERT & UPDATE course schedules (including meeting_url).
-- 4. Grants instructors permission to UPDATE course details (title, syllabus, outcomes, duration, status).
-- 5. Auto-promotes any assigned instructors to role = 'teacher' in public.profiles.
-- 6. Reloads PostgREST schema cache.
-- ====================================================================

-- 1. Ensure profiles table and columns exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'student',
    full_name TEXT,
    email TEXT,
    timezone TEXT DEFAULT 'Africa/Lagos',
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Ensure course_categories table exists
CREATE TABLE IF NOT EXISTS public.course_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Ensure courses table exists and has all required columns
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT,
    short_description TEXT,
    description TEXT,
    image_url TEXT,
    base_price NUMERIC DEFAULT 0,
    base_currency TEXT DEFAULT 'NGN',
    duration TEXT DEFAULT '8 Weeks',
    training_mode TEXT DEFAULT 'online',
    status TEXT DEFAULT 'draft',
    is_published BOOLEAN DEFAULT false,
    category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
    category TEXT,
    level TEXT DEFAULT 'Beginner',
    what_you_will_learn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'NGN';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '8 Weeks';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS training_mode TEXT DEFAULT 'online';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 4. Ensure course_schedules table exists and has all required columns
CREATE TABLE IF NOT EXISTS public.course_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL DEFAULT 'Online Class Schedule',
    day_of_week TEXT NOT NULL DEFAULT 'Saturdays',
    start_time TEXT NOT NULL DEFAULT '10:00',
    end_time TEXT NOT NULL DEFAULT '12:00',
    timezone TEXT DEFAULT 'Africa/Lagos',
    is_active BOOLEAN DEFAULT true,
    max_students INTEGER DEFAULT 30,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    meeting_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Online Class Schedule';
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS day_of_week TEXT DEFAULT 'Saturdays';
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '10:00';
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '12:00';
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 30;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. Ensure teacher_course_assignments table exists (CRITICAL: prevents 42P01 error)
CREATE TABLE IF NOT EXISTS public.teacher_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_course_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_course_assignments(course_id);

-- 6. Ensure teacher_invitations table exists
CREATE TABLE IF NOT EXISTS public.teacher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    invited_email TEXT,
    role TEXT NOT NULL DEFAULT 'teacher',
    status TEXT NOT NULL DEFAULT 'pending',
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Ensure class_sessions table exists
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_url TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Ensure class_recordings table exists
CREATE TABLE IF NOT EXISTS public.class_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    recording_url TEXT NOT NULL,
    duration TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Create or replace helper functions is_admin(), is_teacher(), and is_staff()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'administrator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'instructor', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.teacher_course_assignments
    WHERE teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.course_schedules
    WHERE teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_admin() OR public.is_teacher();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Enable Row Level Security (RLS) on all relevant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;

-- 11. Courses RLS Policies
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
DROP POLICY IF EXISTS "Admins and teachers can view all courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can manage all courses" ON public.courses;
DROP POLICY IF EXISTS "Only Admins can write courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers and Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can update courses" ON public.courses;

CREATE POLICY "Anyone can view published courses"
    ON public.courses FOR SELECT
    USING (is_published = true OR status = 'published' OR public.is_admin() OR public.is_teacher());

CREATE POLICY "Admins can manage all courses"
    ON public.courses FOR ALL
    USING (public.is_admin());

CREATE POLICY "Teachers and Admins can update courses"
    ON public.courses FOR UPDATE
    USING (
        public.is_admin() 
        OR public.is_teacher()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.courses.id
        )
        OR EXISTS (
            SELECT 1 FROM public.course_schedules
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
        OR EXISTS (
            SELECT 1 FROM public.course_schedules
            WHERE teacher_id = auth.uid() AND course_id = public.courses.id
        )
    );

-- 12. Course Schedules RLS Policies
DROP POLICY IF EXISTS "Anyone can view active course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Admins and teachers can view all schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Admins can manage all course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Only Admins can write course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers and Admins can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can insert course schedules for assigned courses" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers and Admins can insert course schedules" ON public.course_schedules;

CREATE POLICY "Anyone can view active course schedules"
    ON public.course_schedules FOR SELECT
    USING (is_active = true OR public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid());

CREATE POLICY "Admins can manage all course schedules"
    ON public.course_schedules FOR ALL
    USING (public.is_admin());

CREATE POLICY "Teachers and Admins can insert course schedules"
    ON public.course_schedules FOR INSERT
    WITH CHECK (
        public.is_admin() 
        OR public.is_teacher() 
        OR teacher_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.teacher_course_assignments 
            WHERE teacher_id = auth.uid() AND course_id = public.course_schedules.course_id
        )
    );

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

-- 13. Teacher Course Assignments RLS Policies
DROP POLICY IF EXISTS "Admins can view and manage assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Teachers can view their own assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Teachers can view assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Staff can manage assignments" ON public.teacher_course_assignments;

CREATE POLICY "Staff can view assignments"
    ON public.teacher_course_assignments FOR SELECT
    USING (public.is_admin() OR teacher_id = auth.uid() OR public.is_teacher());

CREATE POLICY "Admins and teachers can manage assignments"
    ON public.teacher_course_assignments FOR ALL
    USING (public.is_admin() OR teacher_id = auth.uid());

-- 14. Class Sessions RLS Policies
DROP POLICY IF EXISTS "Anyone can view class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Staff can manage class sessions" ON public.class_sessions;

CREATE POLICY "Anyone can view class sessions"
    ON public.class_sessions FOR SELECT
    USING (true);

CREATE POLICY "Staff can manage class sessions"
    ON public.class_sessions FOR ALL
    USING (public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid());

-- 15. Class Recordings RLS Policies
DROP POLICY IF EXISTS "Anyone can view recordings" ON public.class_recordings;
DROP POLICY IF EXISTS "Staff can manage recordings" ON public.class_recordings;

CREATE POLICY "Anyone can view recordings"
    ON public.class_recordings FOR SELECT
    USING (true);

CREATE POLICY "Staff can manage recordings"
    ON public.class_recordings FOR ALL
    USING (public.is_admin() OR public.is_teacher() OR user_id = auth.uid());

-- 16. Teacher Invitations RLS Policies
DROP POLICY IF EXISTS "Admins can view and manage teacher invitations" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Anyone can view teacher invitations by token" ON public.teacher_invitations;

CREATE POLICY "Admins can view and manage teacher invitations"
    ON public.teacher_invitations FOR ALL
    USING (public.is_admin());

CREATE POLICY "Anyone can view teacher invitations by token"
    ON public.teacher_invitations FOR SELECT
    USING (true);

-- 17. Grant standard access to authenticated and anonymous roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.course_schedules TO anon;
GRANT SELECT ON public.course_categories TO anon;
GRANT SELECT ON public.class_sessions TO anon;
GRANT SELECT ON public.class_recordings TO anon;

-- 18. Auto-promote assigned instructors to role = 'teacher' if currently student
UPDATE public.profiles
SET role = 'teacher'
WHERE (
    id IN (SELECT DISTINCT teacher_id FROM public.teacher_course_assignments WHERE teacher_id IS NOT NULL)
    OR id IN (SELECT DISTINCT teacher_id FROM public.course_schedules WHERE teacher_id IS NOT NULL)
)
AND role NOT IN ('admin', 'teacher');

-- 19. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
