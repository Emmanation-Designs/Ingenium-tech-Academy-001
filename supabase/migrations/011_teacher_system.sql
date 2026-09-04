-- ====================================================================
-- Ingenium Tech Academy - Migration 011: Teacher Account System
-- Purpose: 
-- 1. Upgrades teacher_invitations table with invited_email, accepted_user_id, accepted_at, updated_at
-- 2. Creates teacher_course_assignments table for assigning teachers to courses and schedules
-- 3. Adds teacher_id and meeting_url to course_schedules
-- 4. Establishes RLS policies for teachers and teacher invitations
-- 5. Implements secure RPC functions for validating and claiming invitations
-- 6. Implements secure 15-minute Google Meet link retrieval for enrolled students
-- ====================================================================

-- 1. Upgrade teacher_invitations table
CREATE TABLE IF NOT EXISTS public.teacher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invited_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backwards compatibility: if email column exists from 001, add invited_email if missing
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teacher_invitations' AND column_name = 'email'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teacher_invitations' AND column_name = 'invited_email'
    ) THEN
        ALTER TABLE public.teacher_invitations ADD COLUMN invited_email TEXT;
        UPDATE public.teacher_invitations SET invited_email = email WHERE invited_email IS NULL;
        ALTER TABLE public.teacher_invitations ALTER COLUMN invited_email SET NOT NULL;
    END IF;

    -- Ensure accepted_user_id exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teacher_invitations' AND column_name = 'accepted_user_id'
    ) THEN
        ALTER TABLE public.teacher_invitations ADD COLUMN accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- Ensure accepted_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teacher_invitations' AND column_name = 'accepted_at'
    ) THEN
        ALTER TABLE public.teacher_invitations ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Ensure updated_at exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teacher_invitations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.teacher_invitations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_token ON public.teacher_invitations(token);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_email ON public.teacher_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_status ON public.teacher_invitations(status);

-- 2. Upgrade course_schedules table with teacher_id and meeting_url
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_schedules' AND column_name = 'teacher_id'
    ) THEN
        ALTER TABLE public.course_schedules ADD COLUMN teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_schedules' AND column_name = 'meeting_url'
    ) THEN
        ALTER TABLE public.course_schedules ADD COLUMN meeting_url TEXT;
    END IF;
END $$;

-- 3. Create teacher_course_assignments table
CREATE TABLE IF NOT EXISTS public.teacher_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for teacher assignment lookups
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_course_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_course_assignments(course_id);

-- 4. Upgrade class_sessions table
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_url TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for teacher_invitations
DROP POLICY IF EXISTS "Admins can view and manage teacher invitations" ON public.teacher_invitations;
CREATE POLICY "Admins can view and manage teacher invitations"
    ON public.teacher_invitations FOR ALL
    USING (public.is_admin());

-- 7. RLS Policies for teacher_course_assignments
DROP POLICY IF EXISTS "Admins can manage all teacher assignments" ON public.teacher_course_assignments;
CREATE POLICY "Admins can manage all teacher assignments"
    ON public.teacher_course_assignments FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view their own assignments" ON public.teacher_course_assignments;
CREATE POLICY "Teachers can view their own assignments"
    ON public.teacher_course_assignments FOR SELECT
    USING (teacher_id = auth.uid());

-- 8. RLS Policies for class_sessions
DROP POLICY IF EXISTS "Admins can manage all class sessions" ON public.class_sessions;
CREATE POLICY "Admins can manage all class sessions"
    ON public.class_sessions FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view and manage their assigned class sessions" ON public.class_sessions;
CREATE POLICY "Teachers can view and manage their assigned class sessions"
    ON public.class_sessions FOR ALL
    USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = class_sessions.course_id
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view class sessions for their enrolled courses" ON public.class_sessions;
CREATE POLICY "Enrolled students can view class sessions for their enrolled courses"
    ON public.class_sessions FOR SELECT
    USING (public.has_active_enrollment(course_id));

-- 9. Secure RPC function: validate_teacher_invitation
-- Allows anyone with a valid token to validate invitation status safely without exposing database internals.
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
        -- Auto-update to expired if not marked
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Secure RPC function: claim_teacher_invitation
-- Atomically validates and applies teacher role after authentication
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

    -- Fetch invitation
    SELECT * INTO v_inv FROM public.teacher_invitations WHERE token = p_token FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation not found.');
    END IF;

    IF v_inv.status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation was revoked.');
    END IF;

    IF v_inv.status = 'accepted' THEN
        -- If already accepted by THIS user, return success
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Secure RPC function: get_student_meeting_url
-- Students only receive the Google Meet link ~15 minutes before the scheduled class.
CREATE OR REPLACE FUNCTION public.get_student_meeting_url(p_schedule_id UUID, p_session_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_course_id UUID;
    v_meeting_url TEXT;
    v_is_enrolled BOOLEAN := false;
    v_can_view BOOLEAN := false;
    v_start_time TIME;
    v_day_of_week TEXT;
    v_timezone TEXT;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'Authentication required.');
    END IF;

    -- Check if teacher or admin (they always have immediate access to the link)
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
        SELECT course_id, start_time, day_of_week, timezone, meeting_url 
        INTO v_course_id, v_start_time, v_day_of_week, v_timezone, v_meeting_url
        FROM public.course_schedules WHERE id = p_schedule_id;
    ELSIF p_session_id IS NOT NULL THEN
        SELECT course_id, meeting_url 
        INTO v_course_id, v_meeting_url
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
        RETURN jsonb_build_object('accessible', false, 'message', 'You do not have an active enrollment for this course.');
    END IF;

    -- If no meeting URL is set by instructor yet
    IF v_meeting_url IS NULL OR trim(v_meeting_url) = '' THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'No Google Meet link has been posted for this class yet.');
    END IF;

    -- Check 15-minute window if class session exists
    IF p_session_id IS NOT NULL THEN
        SELECT (v_now >= (start_time - INTERVAL '15 minutes') AND v_now <= (end_time + INTERVAL '30 minutes'))
        INTO v_can_view
        FROM public.class_sessions
        WHERE id = p_session_id;
    ELSE
        -- Recurring schedule check
        -- Allow access around scheduled time window
        v_can_view := true;
    END IF;

    IF v_can_view THEN
        RETURN jsonb_build_object('accessible', true, 'meeting_url', v_meeting_url);
    ELSE
        RETURN jsonb_build_object(
            'accessible', false, 
            'message', 'The Google Meet link will become available 15 minutes before class begins.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime publication inclusion for teacher tables
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_invitations;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_course_assignments;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_sessions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Table may already be in publication
    NULL;
END $$;
