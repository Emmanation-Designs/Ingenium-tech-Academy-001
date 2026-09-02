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
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = auth.uid() 
      AND course_id = has_active_enrollment.course_id 
      AND status = 'active'
      AND access_granted = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================
-- 1. PROFILES POLICIES
-- ====================================================================
CREATE POLICY "Users can read their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

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

CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 2. COURSES POLICIES
-- ====================================================================
CREATE POLICY "Anyone can view published courses"
    ON public.courses FOR SELECT
    USING (is_published = true OR status = 'published');

CREATE POLICY "Admins and teachers can view all courses"
    ON public.courses FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

CREATE POLICY "Only Admins can write courses"
    ON public.courses FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 3. COURSE SCHEDULES POLICIES
-- ====================================================================
CREATE POLICY "Anyone can view active course schedules"
    ON public.course_schedules FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins and teachers can view all schedules"
    ON public.course_schedules FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

CREATE POLICY "Only Admins can write course schedules"
    ON public.course_schedules FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 4. COURSE SELECTIONS POLICIES
-- ====================================================================
CREATE POLICY "Students can view their own course selections"
    ON public.course_selections FOR SELECT
    USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own course selections"
    ON public.course_selections FOR INSERT
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update/cancel their own course selections"
    ON public.course_selections FOR UPDATE
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id AND status = 'cancelled');

CREATE POLICY "Admins can read and manage all course selections"
    ON public.course_selections FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 5. ENROLLMENTS POLICIES
-- ====================================================================
CREATE POLICY "Students can view their own active enrollments"
    ON public.enrollments FOR SELECT
    USING (auth.uid() = student_id);

CREATE POLICY "Admins and teachers can view all enrollments"
    ON public.enrollments FOR SELECT
    USING (public.is_admin() OR public.is_teacher());

CREATE POLICY "Only Admins can manage enrollments"
    ON public.enrollments FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 6. PAYMENTS POLICIES
-- ====================================================================
CREATE POLICY "Students can view their own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = student_id);

CREATE POLICY "Students can submit their own payment record"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins can read and manage all payments"
    ON public.payments FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 7. TEACHER INVITATIONS POLICIES
-- ====================================================================
CREATE POLICY "Admins can view and manage teacher invitations"
    ON public.teacher_invitations FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 8. CLASS SESSIONS POLICIES
-- ====================================================================
CREATE POLICY "Students can view class sessions they are enrolled in"
    ON public.class_sessions FOR SELECT
    USING (public.has_active_enrollment(course_id));

CREATE POLICY "Admins and teachers can view and manage class sessions"
    ON public.class_sessions FOR ALL
    USING (public.is_admin() OR public.is_teacher());


-- ====================================================================
-- 9. NOTIFICATIONS POLICIES
-- ====================================================================
CREATE POLICY "Users can read their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification is_read status"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
    ON public.notifications FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 10. COURSE MODULES & LESSONS POLICIES
-- ====================================================================
CREATE POLICY "Students can view modules and lessons for active enrollments"
    ON public.course_modules FOR SELECT
    USING (public.has_active_enrollment(course_id));

CREATE POLICY "Admins and teachers can manage course modules"
    ON public.course_modules FOR ALL
    USING (public.is_admin() OR public.is_teacher());

CREATE POLICY "Students can view lessons for active enrollments"
    ON public.course_lessons FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.course_modules
        WHERE id = public.course_lessons.module_id 
          AND public.has_active_enrollment(course_id)
    ));

CREATE POLICY "Admins and teachers can manage course lessons"
    ON public.course_lessons FOR ALL
    USING (public.is_admin() OR public.is_teacher());


-- ====================================================================
-- 11. CERTIFICATES POLICIES
-- ====================================================================
CREATE POLICY "Students can view their own certificates"
    ON public.certificates FOR SELECT
    USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage certificates"
    ON public.certificates FOR ALL
    USING (public.is_admin());


-- ====================================================================
-- 12. AUDIT LOGS POLICIES
-- ====================================================================
CREATE POLICY "Only Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());
