-- ====================================================================
-- Ingenium Tech Academy - Admin Role Assignment Migration
-- Purpose: Ensures the intended admin accounts are assigned the 'admin'
-- role. Includes retroactive promotion and automated promotion on signup.
-- ====================================================================

-- 1. Automate admin assignment on signup for specific emails
CREATE OR REPLACE FUNCTION public.check_and_promote_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IN ('emmanuelnwaije21@gmail.com', 'ingeniumvirtualassistant@zohomail.com') THEN
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


-- 2. Retroactive Promotion Script
-- Safe to execute at any time. It will search for already-created users and promote them.
UPDATE public.profiles
SET role = 'admin'
WHERE email IN (
    'emmanuelnwaije21@gmail.com',
    'ingeniumvirtualassistant@zohomail.com'
);
