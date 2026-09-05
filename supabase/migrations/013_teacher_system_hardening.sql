-- ====================================================================
-- Ingenium Tech Academy - Migration 013: Teacher System Security Hardening
-- Purpose:
-- 1. Tighten RLS policies on teacher_invitations (prevent token/data enumeration)
-- 2. Grant assigned teachers UPDATE access to course_schedules (meeting_url)
-- 3. Scope teacher SELECT access on enrollments strictly to assigned courses
-- 4. Harden get_student_meeting_url RPC with rigorous time-gating (15m before - 30m after)
-- 5. Enforce SET search_path = public on all SECURITY DEFINER functions
-- ====================================================================

-- 1. Harden validate_teacher_invitation RPC
CREATE OR REPLACE FUNCTION public.validate_teacher_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    SELECT * INTO v_inv
    FROM public.teacher_invitations
    WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'invalid',
            'message', 'Invitation not found or invalid link.'
        );
    END IF;

    -- Check if revoked
    IF v_inv.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'revoked',
            'message', 'This invitation has been revoked by an administrator.'
        );
    END IF;

    -- Check if already accepted
    IF v_inv.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'accepted',
            'message', 'This invitation has already been accepted.'
        );
    END IF;

    -- Check if expired
    IF v_inv.expires_at < v_now OR v_inv.status = 'expired' THEN
        IF v_inv.status <> 'expired' THEN
            UPDATE public.teacher_invitations 
            SET status = 'expired', updated_at = v_now 
            WHERE id = v_inv.id;
        END IF;

        RETURN jsonb_build_object(
            'valid', false,
            'reason', 'expired',
            'message', 'This invitation has expired. Please contact an administrator for a new invitation.'
        );
    END IF;

    -- Invitation is pending and valid
    RETURN jsonb_build_object(
        'valid', true,
        'invited_email', COALESCE(v_inv.invited_email, v_inv.email),
        'expires_at', v_inv.expires_at,
        'created_at', v_inv.created_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Harden claim_teacher_invitation RPC
CREATE OR REPLACE FUNCTION public.claim_teacher_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_inv RECORD;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'You must be signed in to claim this invitation.');
    END IF;

    -- Get user email from auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Fetch invitation with row-level lock
    SELECT * INTO v_inv FROM public.teacher_invitations WHERE token = p_token FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation not found.');
    END IF;

    IF v_inv.status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation was revoked.');
    END IF;

    IF v_inv.status = 'accepted' THEN
        IF v_inv.accepted_user_id = v_user_id THEN
            RETURN jsonb_build_object('success', true, 'message', 'Invitation already claimed by you.');
        END IF;
        RETURN jsonb_build_object('success', false, 'message', 'Invitation has already been used.');
    END IF;

    IF v_inv.expires_at < v_now THEN
        UPDATE public.teacher_invitations SET status = 'expired', updated_at = v_now WHERE id = v_inv.id;
        RETURN jsonb_build_object('success', false, 'message', 'Invitation has expired.');
    END IF;

    -- Strict email binding: normalize and verify
    IF lower(trim(COALESCE(v_inv.invited_email, v_inv.email))) <> lower(trim(v_user_email)) THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Your account email does not match the email address this invitation was issued to.'
        );
    END IF;

    -- Promote user to teacher in profiles
    UPDATE public.profiles
    SET role = 'teacher', updated_at = v_now
    WHERE id = v_user_id;

    -- Mark invitation as accepted
    UPDATE public.teacher_invitations
    SET status = 'accepted',
        accepted_at = v_now,
        accepted_user_id = v_user_id,
        updated_at = v_now
    WHERE id = v_inv.id;

    RETURN jsonb_build_object('success', true, 'message', 'Teacher account activated successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Harden get_student_meeting_url with strict time-gating
CREATE OR REPLACE FUNCTION public.get_student_meeting_url(
    p_schedule_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_course_id UUID;
    v_meeting_url TEXT;
    v_is_enrolled BOOLEAN := false;
    v_can_view BOOLEAN := false;
    v_start_time TIME;
    v_end_time TIME;
    v_day_of_week TEXT;
    v_timezone TEXT;
    v_local_now TIMESTAMP;
    v_local_time TIME;
    v_local_day TEXT;
    v_session_start TIMESTAMPTZ;
    v_session_end TIMESTAMPTZ;
    v_now TIMESTAMPTZ := now();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'Authentication required.');
    END IF;

    -- Admins and assigned teachers always have immediate access
    IF public.is_admin() OR public.is_teacher() THEN
        IF p_session_id IS NOT NULL THEN
            SELECT meeting_url INTO v_meeting_url FROM public.class_sessions WHERE id = p_session_id;
        END IF;
        IF v_meeting_url IS NULL AND p_schedule_id IS NOT NULL THEN
            SELECT meeting_url INTO v_meeting_url FROM public.course_schedules WHERE id = p_schedule_id;
        END IF;
        RETURN jsonb_build_object('accessible', true, 'meeting_url', v_meeting_url);
    END IF;

    -- If student, find course from schedule or session
    IF p_schedule_id IS NOT NULL THEN
        SELECT course_id, start_time, end_time, day_of_week, timezone, meeting_url 
        INTO v_course_id, v_start_time, v_end_time, v_day_of_week, v_timezone, v_meeting_url
        FROM public.course_schedules WHERE id = p_schedule_id;
    ELSIF p_session_id IS NOT NULL THEN
        SELECT course_id, start_time, end_time, meeting_url 
        INTO v_course_id, v_session_start, v_session_end, v_meeting_url
        FROM public.class_sessions WHERE id = p_session_id;
    END IF;

    IF v_course_id IS NULL THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'Class not found.');
    END IF;

    -- Check if student has active, approved enrollment
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE student_id = v_user_id 
          AND course_id = v_course_id 
          AND status = 'active'
          AND access_granted = true
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'You do not have an active approved enrollment for this course.');
    END IF;

    -- If no meeting URL is set by instructor yet
    IF v_meeting_url IS NULL OR trim(v_meeting_url) = '' THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'No Google Meet link has been posted for this class yet.');
    END IF;

    -- Check 15-minute start and 30-minute end window
    IF p_session_id IS NOT NULL AND v_session_start IS NOT NULL THEN
        -- Explicit class session instance with exact timestamps
        v_can_view := (v_now >= (v_session_start - INTERVAL '15 minutes') AND v_now <= (COALESCE(v_session_end, v_session_start + INTERVAL '2 hours') + INTERVAL '30 minutes'));
    ELSIF p_schedule_id IS NOT NULL AND v_start_time IS NOT NULL THEN
        -- Recurring schedule slot (e.g. Saturday 10:00 to 12:00 in Africa/Lagos)
        BEGIN
            v_local_now := now() AT TIME ZONE COALESCE(NULLIF(trim(v_timezone), ''), 'Africa/Lagos');
        EXCEPTION WHEN OTHERS THEN
            v_local_now := now() AT TIME ZONE 'Africa/Lagos';
        END;
        v_local_day := lower(trim(to_char(v_local_now, 'FMDay')));
        v_local_time := v_local_now::time;

        -- Check if today matches the scheduled day of week
        IF v_day_of_week IS NOT NULL AND lower(v_day_of_week) LIKE '%' || v_local_day || '%' THEN
            -- Check if current local time is within [start_time - 15m, end_time + 30m]
            IF COALESCE(v_end_time, v_start_time + INTERVAL '2 hours') >= v_start_time THEN
                IF v_local_time >= (v_start_time - INTERVAL '15 minutes')::time 
                   AND v_local_time <= (COALESCE(v_end_time, v_start_time + INTERVAL '2 hours') + INTERVAL '30 minutes')::time THEN
                    v_can_view := true;
                END IF;
            ELSE
                -- Crosses midnight
                IF v_local_time >= (v_start_time - INTERVAL '15 minutes')::time 
                   OR v_local_time <= (v_end_time + INTERVAL '30 minutes')::time THEN
                    v_can_view := true;
                END IF;
            END IF;
        END IF;
    END IF;

    IF v_can_view THEN
        RETURN jsonb_build_object('accessible', true, 'meeting_url', v_meeting_url);
    ELSE
        RETURN jsonb_build_object(
            'accessible', false, 
            'message', 'The Google Meet link will become available 15 minutes before your scheduled class.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Restrict teacher_invitations RLS policies
DROP POLICY IF EXISTS "Anyone can view teacher invitations by token" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Admins can view all teacher invitations" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Users can view their claimed teacher invitation" ON public.teacher_invitations;

CREATE POLICY "Admins can view all teacher invitations"
    ON public.teacher_invitations FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Users can view their claimed teacher invitation"
    ON public.teacher_invitations FOR SELECT
    USING (accepted_user_id = auth.uid());

-- 5. Allow assigned teachers to update meeting_url on course_schedules
DROP POLICY IF EXISTS "Teachers can update meeting_url for assigned schedules" ON public.course_schedules;

CREATE POLICY "Teachers can update meeting_url for assigned schedules"
    ON public.course_schedules FOR UPDATE
    USING (
        public.is_teacher() AND (
            teacher_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.teacher_course_assignments tca
                WHERE tca.teacher_id = auth.uid()
                  AND (tca.schedule_id = course_schedules.id OR (tca.schedule_id IS NULL AND tca.course_id = course_schedules.course_id))
            )
        )
    )
    WITH CHECK (
        public.is_teacher() AND (
            teacher_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.teacher_course_assignments tca
                WHERE tca.teacher_id = auth.uid()
                  AND (tca.schedule_id = course_schedules.id OR (tca.schedule_id IS NULL AND tca.course_id = course_schedules.course_id))
            )
        )
    );

-- 6. Scope teacher access to enrollments strictly to assigned courses
DROP POLICY IF EXISTS "Admins and teachers can view all enrollments" ON public.enrollments;
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

-- 7. Grant EXECUTE permissions to roles
GRANT EXECUTE ON FUNCTION public.validate_teacher_invitation(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_teacher_invitation(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_meeting_url(UUID, UUID) TO authenticated, service_role;
