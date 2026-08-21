-- ====================================================================
-- Ingenium Tech Academy - Auth Triggers Migration
-- Purpose: Automatically provision a student profile upon successful
-- user signup via Supabase Auth, ensuring the role is set to 'student'
-- and metadata is correctly stored.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
    v_country TEXT;
    v_timezone TEXT;
BEGIN
    -- Extract values from user raw metadata if provided
    v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Student');
    v_phone := new.raw_user_meta_data->>'phone';
    v_country := new.raw_user_meta_data->>'country';
    v_timezone := COALESCE(new.raw_user_meta_data->>'timezone', 'Africa/Lagos');

    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        country,
        timezone,
        role,
        avatar_url
    ) VALUES (
        new.id,
        v_full_name,
        new.email,
        v_phone,
        v_country,
        v_timezone,
        'student', -- Always default to student
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when auth.users is populated
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
