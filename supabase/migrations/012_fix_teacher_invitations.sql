-- ====================================================================
-- Ingenium Tech Academy - Migration 012: Fix Teacher Invitations & Multi-Invite
-- Purpose:
-- 1. Drops UNIQUE constraint on email/invited_email in teacher_invitations
--    to allow administrators to re-invite teachers or issue fresh invitations
-- 2. Ensures RLS policies allow token-based validation and claiming
-- 3. Grants proper public SELECT on teacher_invitations for token validation
-- ====================================================================

-- 1. Drop UNIQUE constraints on email or invited_email if they exist
DO $$
BEGIN
    -- Drop legacy constraint from 001 if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'teacher_invitations_email_key' 
          AND conrelid = 'public.teacher_invitations'::regclass
    ) THEN
        ALTER TABLE public.teacher_invitations DROP CONSTRAINT teacher_invitations_email_key;
    END IF;

    -- Drop invited_email constraint if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'teacher_invitations_invited_email_key' 
          AND conrelid = 'public.teacher_invitations'::regclass
    ) THEN
        ALTER TABLE public.teacher_invitations DROP CONSTRAINT teacher_invitations_invited_email_key;
    END IF;

    -- Drop any standalone unique index on email/invited_email
    DROP INDEX IF EXISTS public.teacher_invitations_email_key;
    DROP INDEX IF EXISTS public.teacher_invitations_invited_email_key;
    DROP INDEX IF EXISTS public.idx_teacher_invitations_email_unique;
END $$;

-- 2. Ensure token remains unique and indexed
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_invitations_token ON public.teacher_invitations(token);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_invited_email ON public.teacher_invitations(invited_email);

-- 3. Update RLS policies to allow token-based validation by unauthenticated or newly signing-up users
DROP POLICY IF EXISTS "Anyone can view teacher invitations by token" ON public.teacher_invitations;
CREATE POLICY "Anyone can view teacher invitations by token"
    ON public.teacher_invitations FOR SELECT
    USING (true);

-- Allow authenticated users to claim pending invitations
DROP POLICY IF EXISTS "Users can update teacher invitations when claiming" ON public.teacher_invitations;
CREATE POLICY "Users can update teacher invitations when claiming"
    ON public.teacher_invitations FOR UPDATE
    USING (status = 'pending')
    WITH CHECK (status = 'accepted');

-- 4. Re-grant execute on validation and claiming functions
GRANT EXECUTE ON FUNCTION public.validate_teacher_invitation(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_teacher_invitation(TEXT) TO authenticated, service_role;
