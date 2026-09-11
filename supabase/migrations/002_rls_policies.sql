-- ====================================================================
-- Ingenium Tech Academy - Row Level Security (RLS) Policies Migration
-- Purpose: Enforces strict tenant separation, role validation, and
-- prevents unprivileged access to administrative or other student data.
-- ====================================================================

-- Helper function to check if the current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if the current user is a Teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if the student has an active enrollment
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


-- ====================================================================
-- 1. PROFILES POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can update their own non-role fields" ON public.profiles;
CREATE POLICY "Users can update their own non-role fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
      auth.uid() = id AND 
      (
        -- Non-admins cannot change their own role
        (public.is_admin() IS TRUE) OR 
        (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
      )
    );

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 2. COURSES POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
CREATE POLICY "Anyone can view published courses"
    ON public.courses FOR SELECT
    USING (is_published = true OR status = 'published');

DROP POLICY IF EXISTS "Admins and teachers can view all courses" ON public.courses;
CREATE POLICY "Admins and teachers can view all courses"
    ON public.courses FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Only Admins can write courses" ON public.courses;
CREATE POLICY "Only Admins can write courses"
    ON public.courses FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 3. COURSE SCHEDULES POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Anyone can view active course schedules" ON public.course_schedules;
CREATE POLICY "Anyone can view active course schedules"
    ON public.course_schedules FOR SELECT
    USING (is_active = true);

DROP POLICY IF EXISTS "Admins and teachers can view all schedules" ON public.course_schedules;
CREATE POLICY "Admins and teachers can view all schedules"
    ON public.course_schedules FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Only Admins can write course schedules" ON public.course_schedules;
CREATE POLICY "Only Admins can write course schedules"
    ON public.course_schedules FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 4. COURSE SELECTIONS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view their own course selections" ON public.course_selections;
CREATE POLICY "Students can view their own course selections"
    ON public.course_selections FOR SELECT
    USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own course selections" ON public.course_selections;
CREATE POLICY "Students can insert their own course selections"
    ON public.course_selections FOR INSERT
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update/cancel their own course selections" ON public.course_selections;
CREATE POLICY "Students can update/cancel their own course selections"
    ON public.course_selections FOR UPDATE
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id AND status = 'cancelled');

DROP POLICY IF EXISTS "Admins can read and manage all course selections" ON public.course_selections;
CREATE POLICY "Admins can read and manage all course selections"
    ON public.course_selections FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 5. ENROLLMENTS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view their own active enrollments" ON public.enrollments;
CREATE POLICY "Students can view their own active enrollments"
    ON public.enrollments FOR SELECT
    USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins and teachers can view all enrollments" ON public.enrollments;
CREATE POLICY "Admins and teachers can view all enrollments"
    ON public.enrollments FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Only Admins can manage enrollments" ON public.enrollments;
CREATE POLICY "Only Admins can manage enrollments"
    ON public.enrollments FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 6. PAYMENTS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view their own payments" ON public.payments;
CREATE POLICY "Students can view their own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can submit their own payment record" ON public.payments;
CREATE POLICY "Students can submit their own payment record"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can read and manage all payments" ON public.payments;
CREATE POLICY "Admins can read and manage all payments"
    ON public.payments FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 7. TEACHER INVITATIONS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Admins can view and manage teacher invitations" ON public.teacher_invitations;
CREATE POLICY "Admins can view and manage teacher invitations"
    ON public.teacher_invitations FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 8. CLASS SESSIONS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view class sessions they are enrolled in" ON public.class_sessions;
CREATE POLICY "Students can view class sessions they are enrolled in"
    ON public.class_sessions FOR SELECT
    USING (public.has_active_enrollment(course_id));

DROP POLICY IF EXISTS "Admins and teachers can view and manage class sessions" ON public.class_sessions;
CREATE POLICY "Admins and teachers can view and manage class sessions"
    ON public.class_sessions FOR ALL
    USING (public.is_admin() OR public.is_teacher());


-- ====================================================================
-- 9. NOTIFICATIONS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification is_read status" ON public.notifications;
CREATE POLICY "Users can update their own notification is_read status"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications"
    ON public.notifications FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 10. COURSE MODULES & LESSONS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view modules and lessons for active enrollments" ON public.course_modules;
CREATE POLICY "Students can view modules and lessons for active enrollments"
    ON public.course_modules FOR SELECT
    USING (public.has_active_enrollment(course_id));

DROP POLICY IF EXISTS "Admins and teachers can manage course modules" ON public.course_modules;
CREATE POLICY "Admins and teachers can manage course modules"
    ON public.course_modules FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Students can view lessons for active enrollments" ON public.course_lessons;
CREATE POLICY "Students can view lessons for active enrollments"
    ON public.course_lessons FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.course_modules
        WHERE id = public.course_lessons.module_id 
          AND public.has_active_enrollment(course_id)
    ));

DROP POLICY IF EXISTS "Admins and teachers can manage course lessons" ON public.course_lessons;
CREATE POLICY "Admins and teachers can manage course lessons"
    ON public.course_lessons FOR ALL
    USING (public.is_admin() OR public.is_teacher());


-- ====================================================================
-- 11. CERTIFICATES POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Students can view their own certificates" ON public.certificates;
CREATE POLICY "Students can view their own certificates"
    ON public.certificates FOR SELECT
    USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can manage certificates" ON public.certificates;
CREATE POLICY "Admins can manage certificates"
    ON public.certificates FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 12. AUDIT LOGS POLICIES
-- ====================================================================
DROP POLICY IF EXISTS "Only Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());
