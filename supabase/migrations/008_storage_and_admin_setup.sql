-- ====================================================================
-- Ingenium Tech Academy - Migration 008: Storage Bucket & Admin Access
-- Official Admins:
--   1. emmanuelnwaije21@gmail.com
--   2. ingeniumvirtualassistant@zohomail.com
-- ====================================================================

-- 1. CREATE 'course-images' STORAGE BUCKET (if not created via UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-images',
    'course-images',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 10485760;

-- 2. STORAGE OBJECT POLICIES
-- Note: Do NOT run 'ALTER TABLE storage.objects' as that table is owned by supabase_storage_admin.
-- RLS is already enabled by default on storage.objects.

DROP POLICY IF EXISTS "Public can view course hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload course hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update course hero images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete course hero images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload course images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update course images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete course images" ON storage.objects;

-- Allow anyone to view images from the public course-images bucket
CREATE POLICY "Public can view course hero images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'course-images');

-- Allow authenticated users to upload course images
CREATE POLICY "Authenticated users can upload course images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'course-images');

-- Allow authenticated users to update course images
CREATE POLICY "Authenticated users can update course images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'course-images');

-- Allow authenticated users to delete course images
CREATE POLICY "Authenticated users can delete course images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'course-images');

-- 3. ENSURE OFFICIAL ADMIN ACCOUNTS IN PROFILES
UPDATE public.profiles
SET role = 'admin'
WHERE email IN (
    'emmanuelnwaije21@gmail.com',
    'ingeniumvirtualassistant@zohomail.com'
);

-- Auto-promote only the 2 authorized admin emails upon signup
CREATE OR REPLACE FUNCTION public.check_and_promote_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF LOWER(NEW.email) IN (
        'emmanuelnwaije21@gmail.com',
        'ingeniumvirtualassistant@zohomail.com'
    ) THEN
        UPDATE public.profiles
        SET role = 'admin'
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

