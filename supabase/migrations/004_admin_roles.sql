-- ====================================================================
-- Ingenium Tech Academy - Admin Role Assignment Migration
-- Purpose: Ensures the intended admin accounts are assigned the 'admin'
-- role. Includes retroactive promotion and automated promotion on signup.
-- ====================================================================

-- 1. Ensure required profile columns exist (in case table was created previously without them)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Ensure role check constraint if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'admin'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 2. Automate admin assignment on signup for specific emails
CREATE OR REPLACE FUNCTION public.check_and_promote_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF LOWER(NEW.email) IN ('emmanuelnwaije21@gmail.com', 'ingeniumvirtualassistant@zohomail.com', 'modestanwaije1@gmail.com') THEN
        UPDATE public.profiles
        SET role = 'admin'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run after profile is created
DROP TRIGGER IF EXISTS on_profile_created_promote_admin ON public.profiles;
CREATE TRIGGER on_profile_created_promote_admin
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_and_promote_admin();


-- 3. Retroactive Promotion Script
-- Safe to execute at any time. It will search for already-created users and promote them.
UPDATE public.profiles
SET role = 'admin'
WHERE LOWER(email) IN (
    'emmanuelnwaije21@gmail.com',
    'ingeniumvirtualassistant@zohomail.com',
    'modestanwaije1@gmail.com'
);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
