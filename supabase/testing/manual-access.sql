-- ====================================================================
-- Ingenium Tech Academy - Manual Access and Testing Operations
-- File: /supabase/testing/manual-access.sql
-- Purpose: Reference SQL commands for administrative, testing, and debugging
-- tasks. These queries can be executed manually in the Supabase SQL editor.
-- NOTE: Do NOT run this script automatically. Use placeholders.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. FIND A STUDENT BY EMAIL
-- Replace 'student@example.com' with the target student's email.
-- --------------------------------------------------------------------
SELECT id, full_name, email, phone, country, timezone, role, created_at
FROM public.profiles
WHERE email = 'student@example.com';


-- --------------------------------------------------------------------
-- 2. FIND A COURSE
-- Search courses by part of their title or slug.
-- --------------------------------------------------------------------
SELECT id, title, slug, base_price, base_currency, training_mode, status, is_published
FROM public.courses
WHERE title ILIKE '%Data Analysis%' OR slug = 'data-analysis';


-- --------------------------------------------------------------------
-- 3. CREATE A MANUAL ENROLLMENT / GRANT COURSE ACCESS
-- Placeholders:
--   :student_id - UUID of the student from public.profiles
--   :course_id  - UUID of the course from public.courses
--   :admin_id   - UUID of the approving admin (optional)
-- --------------------------------------------------------------------
INSERT INTO public.enrollments (
    student_id,
    course_id,
    schedule_id,
    status,
    access_granted,
    access_type,
    approved_by,
    approved_at
) VALUES (
    'STUDENT_UUID_PLACEHOLDER', -- Replace with student's profile UUID
    'COURSE_UUID_PLACEHOLDER',  -- Replace with course UUID
    NULL,                       -- Replace with schedule UUID if applicable
    'active',
    true,
    'manual',
    'ADMIN_UUID_PLACEHOLDER',   -- Replace with admin's profile UUID
    now()
)
ON CONFLICT (student_id, course_id) 
DO UPDATE SET 
    status = 'active',
    access_granted = true,
    access_type = 'manual',
    approved_by = 'ADMIN_UUID_PLACEHOLDER',
    approved_at = now(),
    updated_at = now();


-- --------------------------------------------------------------------
-- 4. REVOKE COURSE ACCESS / SUSPEND ENROLLMENT
-- Placeholders:
--   :student_id - UUID of the student
--   :course_id  - UUID of the course
-- --------------------------------------------------------------------
UPDATE public.enrollments
SET 
    status = 'suspended',
    access_granted = false,
    updated_at = now()
WHERE student_id = 'STUDENT_UUID_PLACEHOLDER' 
  AND course_id = 'COURSE_UUID_PLACEHOLDER';


-- --------------------------------------------------------------------
-- 5. CHECK A STUDENT'S ENROLLMENTS
-- Shows all active, manual, and completed courses for a student.
-- --------------------------------------------------------------------
SELECT 
    e.id AS enrollment_id,
    p.email AS student_email,
    p.full_name AS student_name,
    c.title AS course_title,
    e.status AS enrollment_status,
    e.access_granted,
    e.access_type,
    e.approved_at
FROM public.enrollments e
JOIN public.profiles p ON e.student_id = p.id
JOIN public.courses c ON e.course_id = c.id
WHERE p.email = 'student@example.com';
