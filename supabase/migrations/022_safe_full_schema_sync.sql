-- ====================================================================
-- Ingenium Tech Academy - Migration 022: Non-Destructive Full Schema Catch-Up (001 - 021)
-- Purpose:
--   Safely synchronizes a Supabase project that had only partial migrations run.
--   100% NON-DESTRUCTIVE & IDEMPOTENT:
--     - Never drops tables, columns, or existing rows.
--     - Uses CREATE TABLE IF NOT EXISTS & ADD COLUMN IF NOT EXISTS.
--     - Uses ON CONFLICT DO NOTHING for reference/backfill inserts.
--     - Fixes student course visibility (allows SELECT on teacher_course_assignments).
--     - Installs missing triggers, RPCs, storage buckets, RLS policies, and realtime.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. CORE TABLES (Safe Create + Additive Columns)
-- ====================================================================

-- 1.1 Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    country TEXT,
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    role TEXT NOT NULL DEFAULT 'student',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Lagos';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.2 Course Categories
CREATE TABLE IF NOT EXISTS public.course_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.course_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.course_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
CREATE INDEX IF NOT EXISTS idx_course_categories_slug ON public.course_categories(slug);

-- Seed default categories only if missing
INSERT INTO public.course_categories (name, slug, is_active)
SELECT v.name, v.slug, true
FROM (VALUES
    ('Data Science', 'data-science'),
    ('Design', 'design'),
    ('Marketing', 'marketing'),
    ('Development', 'development')
) AS v(name, slug)
WHERE NOT EXISTS (
    SELECT 1 FROM public.course_categories c
    WHERE c.slug = v.slug OR lower(c.name) = lower(v.name)
);

-- 1.3 Courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    short_description TEXT,
    description TEXT,
    image_url TEXT,
    base_price NUMERIC NOT NULL DEFAULT 0,
    base_currency TEXT NOT NULL DEFAULT 'NGN',
    duration TEXT DEFAULT '8 Weeks',
    training_mode TEXT NOT NULL DEFAULT 'online',
    status TEXT NOT NULL DEFAULT 'draft',
    is_published BOOLEAN NOT NULL DEFAULT false,
    category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL,
    category TEXT,
    level TEXT DEFAULT 'Beginner',
    what_you_will_learn TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'NGN';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '8 Weeks';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS training_mode TEXT DEFAULT 'online';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.course_categories(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Beginner';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS what_you_will_learn TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.4 Course Pricing
CREATE TABLE IF NOT EXISTS public.course_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL UNIQUE,
    usd_price NUMERIC NOT NULL DEFAULT 150,
    ngn_price NUMERIC NOT NULL DEFAULT 120000,
    eur_price NUMERIC NOT NULL DEFAULT 120,
    international_price NUMERIC DEFAULT 150,
    nigeria_price NUMERIC DEFAULT 120000,
    uk_price NUMERIC DEFAULT 120,
    international_currency TEXT NOT NULL DEFAULT 'USD',
    nigeria_currency TEXT NOT NULL DEFAULT 'NGN',
    uk_currency TEXT NOT NULL DEFAULT 'GBP',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS usd_price NUMERIC DEFAULT 150;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS ngn_price NUMERIC DEFAULT 120000;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS eur_price NUMERIC DEFAULT 120;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS international_price NUMERIC DEFAULT 150;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS nigeria_price NUMERIC DEFAULT 120000;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS uk_price NUMERIC DEFAULT 120;
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS international_currency TEXT DEFAULT 'USD';
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS nigeria_currency TEXT DEFAULT 'NGN';
ALTER TABLE public.course_pricing ADD COLUMN IF NOT EXISTS uk_currency TEXT DEFAULT 'GBP';
CREATE INDEX IF NOT EXISTS idx_course_pricing_course_id ON public.course_pricing(course_id);

-- Only fill NULLs on existing pricing rows (preserves all existing prices)
UPDATE public.course_pricing
SET
    usd_price = COALESCE(usd_price, international_price, 150),
    ngn_price = COALESCE(ngn_price, nigeria_price, 120000),
    eur_price = COALESCE(eur_price, uk_price, 120)
WHERE usd_price IS NULL OR ngn_price IS NULL OR eur_price IS NULL;

-- Backfill pricing only for courses that have NO pricing row yet
INSERT INTO public.course_pricing (course_id, usd_price, ngn_price, eur_price, international_price, nigeria_price, uk_price)
SELECT c.id, 150, 120000, 120, 150, 120000, 120
FROM public.courses c
WHERE NOT EXISTS (
    SELECT 1 FROM public.course_pricing cp WHERE cp.course_id = c.id
);

-- 1.5 Countries Config
CREATE TABLE IF NOT EXISTS public.countries_config (
    country_code TEXT PRIMARY KEY,
    country_name TEXT NOT NULL UNIQUE,
    currency_code TEXT NOT NULL CHECK (currency_code IN ('NGN', 'EUR', 'USD')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_countries_config_name ON public.countries_config(country_name);

INSERT INTO public.countries_config (country_code, country_name, currency_code)
SELECT v.code, v.name, v.curr
FROM (VALUES
  ('NG', 'Nigeria', 'NGN'),
  ('DE', 'Germany', 'EUR'),
  ('FR', 'France', 'EUR'),
  ('IT', 'Italy', 'EUR'),
  ('ES', 'Spain', 'EUR'),
  ('NL', 'Netherlands', 'EUR'),
  ('BE', 'Belgium', 'EUR'),
  ('AT', 'Austria', 'EUR'),
  ('IE', 'Ireland', 'EUR'),
  ('PT', 'Portugal', 'EUR'),
  ('GR', 'Greece', 'EUR'),
  ('FI', 'Finland', 'EUR')
) AS v(code, name, curr)
WHERE NOT EXISTS (
    SELECT 1 FROM public.countries_config cc
    WHERE cc.country_code = v.code OR cc.country_name = v.name
);

-- 1.6 Course Schedules
CREATE TABLE IF NOT EXISTS public.course_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL DEFAULT 'Online Class Schedule',
    day_of_week TEXT NOT NULL DEFAULT 'Saturdays',
    start_time TEXT NOT NULL DEFAULT '10:00',
    end_time TEXT NOT NULL DEFAULT '12:00',
    timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_students INTEGER DEFAULT 30,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    meeting_url TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 30;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS meeting_url TEXT;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.course_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 1.7 Course Selections
CREATE TABLE IF NOT EXISTS public.course_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    reference_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'whatsapp_manual',
    price_snapshot NUMERIC,
    currency_snapshot TEXT,
    student_country TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, course_id)
);

ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS price_snapshot NUMERIC;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS currency_snapshot TEXT;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS student_country TEXT;
ALTER TABLE public.course_selections ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'whatsapp_manual';

-- 1.8 Enrollments
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    access_granted BOOLEAN NOT NULL DEFAULT true,
    access_type TEXT NOT NULL DEFAULT 'paid',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, course_id)
);

-- 1.9 Orders & Order Items (Wittypay & PayPal)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    wittypay_reference TEXT,
    paypal_order_id TEXT,
    payment_method TEXT DEFAULT 'wittypay',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wittypay';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS wittypay_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_currency_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_currency_check CHECK (currency IN ('NGN', 'USD', 'EUR'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_student_id ON public.orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_wittypay_ref ON public.orders(wittypay_reference);
CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON public.orders(paypal_order_id);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE RESTRICT NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    selection_id UUID REFERENCES public.course_selections(id) ON DELETE SET NULL,
    course_title TEXT NOT NULL,
    schedule_label TEXT,
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_course_id ON public.order_items(course_id);

-- 1.10 Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reference_id TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'whatsapp_manual',
    notes TEXT,
    confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    wittypay_reference TEXT,
    checkout_url TEXT,
    gateway_response JSONB DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    paypal_order_id TEXT,
    paypal_capture_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS wittypay_reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS checkout_url TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS gateway_response JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_wittypay_ref ON public.payments(wittypay_reference);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON public.payments(paypal_order_id);

-- 1.11 Teacher Invitations
CREATE TABLE IF NOT EXISTS public.teacher_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT,
    invited_email TEXT,
    role TEXT NOT NULL DEFAULT 'teacher',
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher';
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS accepted_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.teacher_invitations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Backfill invited_email from email only where invited_email is NULL
UPDATE public.teacher_invitations SET invited_email = email WHERE invited_email IS NULL AND email IS NOT NULL;

DO $$
BEGIN
    ALTER TABLE public.teacher_invitations DROP CONSTRAINT IF EXISTS teacher_invitations_email_key;
    ALTER TABLE public.teacher_invitations DROP CONSTRAINT IF EXISTS teacher_invitations_invited_email_key;
    DROP INDEX IF EXISTS public.teacher_invitations_email_key;
    DROP INDEX IF EXISTS public.teacher_invitations_invited_email_key;
    DROP INDEX IF EXISTS public.idx_teacher_invitations_email_unique;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_invitations_token ON public.teacher_invitations(token);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_email ON public.teacher_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_status ON public.teacher_invitations(status);

-- 1.12 Teacher Course Assignments
CREATE TABLE IF NOT EXISTS public.teacher_course_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_course_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_course ON public.teacher_course_assignments(course_id);

-- 1.13 Class Sessions
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.course_schedules(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    meeting_url TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.class_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_class_sessions_course ON public.class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_start ON public.class_sessions(start_time);

-- 1.14 Course Modules & Lessons & Lesson Materials
CREATE TABLE IF NOT EXISTS public.course_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.course_modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_sort ON public.course_modules(course_id, sort_order);

CREATE TABLE IF NOT EXISTS public.course_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    duration TEXT,
    video_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.course_lessons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON public.course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_sort ON public.course_lessons(module_id, sort_order);

CREATE TABLE IF NOT EXISTS public.lesson_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'pdf',
    file_size INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson ON public.lesson_materials(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_course ON public.lesson_materials(course_id);

-- 1.15 Class Recordings
CREATE TABLE IF NOT EXISTS public.class_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    recording_url TEXT NOT NULL,
    duration TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.class_recordings ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL;
ALTER TABLE public.class_recordings ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.class_recordings ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.class_recordings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_class_recordings_course ON public.class_recordings(course_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_session ON public.class_recordings(session_id);

-- 1.16 Quizzes & Progress
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    raw_text TEXT,
    total_marks INTEGER NOT NULL DEFAULT 0,
    pass_percentage INTEGER NOT NULL DEFAULT 50,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON public.quizzes(lesson_id);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 1,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, question_number);

CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
    option_key TEXT NOT NULL,
    option_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options(question_id);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    score NUMERIC NOT NULL DEFAULT 0,
    total_marks NUMERIC NOT NULL DEFAULT 0,
    percentage NUMERIC NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts(student_id, course_id);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
    selected_option TEXT,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    marks_awarded NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);

CREATE TABLE IF NOT EXISTS public.student_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON public.student_lesson_progress(student_id, course_id);

CREATE TABLE IF NOT EXISTS public.student_course_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    completed_lessons INTEGER NOT NULL DEFAULT 0,
    total_lessons INTEGER NOT NULL DEFAULT 0,
    percentage NUMERIC NOT NULL DEFAULT 0,
    last_lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_student ON public.student_course_progress(student_id, course_id);

-- 1.17 Notifications, Certificates & Audit Logs
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    link TEXT,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT,
    sender_role TEXT,
    category TEXT DEFAULT 'announcement',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'announcement';
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    certificate_url TEXT NOT NULL,
    UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- 2. BACKFILL MISSING PROFILES FOR ANY EXISTING AUTH USERS (Safe)
-- ====================================================================
INSERT INTO public.profiles (id, full_name, email, phone, country, timezone, role, avatar_url)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1), 'Student'),
    u.email,
    u.raw_user_meta_data->>'phone',
    u.raw_user_meta_data->>'country',
    COALESCE(u.raw_user_meta_data->>'timezone', 'Africa/Lagos'),
    'student',
    u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ====================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'administrator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('teacher', 'instructor', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.teacher_course_assignments
    WHERE teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.course_schedules
    WHERE teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_admin() OR public.is_teacher();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

-- Safe auth signup trigger (uses ON CONFLICT DO NOTHING so it never blocks signups)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_phone TEXT;
    v_country TEXT;
    v_timezone TEXT;
BEGIN
    v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'New Student');
    v_phone := new.raw_user_meta_data->>'phone';
    v_country := new.raw_user_meta_data->>'country';
    v_timezone := COALESCE(new.raw_user_meta_data->>'timezone', 'Africa/Lagos');

    INSERT INTO public.profiles (
        id, full_name, email, phone, country, timezone, role, avatar_url
    ) VALUES (
        new.id, v_full_name, new.email, v_phone, v_country, v_timezone, 'student', new.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 4. RPC FUNCTIONS (Teacher Invitations, Meet Links, Progress)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.validate_teacher_invitation(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    SELECT * INTO v_inv FROM public.teacher_invitations WHERE token = p_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'invalid', 'message', 'Invitation not found or invalid link.');
    END IF;
    IF v_inv.status = 'revoked' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'revoked', 'message', 'This invitation has been revoked by an administrator.');
    END IF;
    IF v_inv.status = 'accepted' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'accepted', 'message', 'This invitation has already been accepted.');
    END IF;
    IF v_inv.expires_at < v_now OR v_inv.status = 'expired' THEN
        IF v_inv.status <> 'expired' THEN
            UPDATE public.teacher_invitations SET status = 'expired', updated_at = v_now WHERE id = v_inv.id;
        END IF;
        RETURN jsonb_build_object('valid', false, 'reason', 'expired', 'message', 'This invitation has expired. Please contact an administrator for a new invitation.');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'invited_email', COALESCE(v_inv.invited_email, v_inv.email),
        'expires_at', v_inv.expires_at,
        'created_at', v_inv.created_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
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
    IF lower(trim(COALESCE(v_inv.invited_email, v_inv.email))) <> lower(trim(v_user_email)) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Your account email does not match the email address this invitation was issued to.');
    END IF;

    UPDATE public.profiles SET role = 'teacher', updated_at = v_now WHERE id = v_user_id;
    UPDATE public.teacher_invitations
    SET status = 'accepted', accepted_at = v_now, accepted_user_id = v_user_id, updated_at = v_now
    WHERE id = v_inv.id;

    RETURN jsonb_build_object('success', true, 'message', 'Teacher account activated successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    IF public.is_admin() OR public.is_teacher() THEN
        IF p_session_id IS NOT NULL THEN
            SELECT meeting_url INTO v_meeting_url FROM public.class_sessions WHERE id = p_session_id;
        END IF;
        IF v_meeting_url IS NULL AND p_schedule_id IS NOT NULL THEN
            SELECT meeting_url INTO v_meeting_url FROM public.course_schedules WHERE id = p_schedule_id;
        END IF;
        RETURN jsonb_build_object('accessible', true, 'meeting_url', v_meeting_url);
    END IF;

    IF p_schedule_id IS NOT NULL THEN
        DECLARE
            v_start_text TEXT;
            v_end_text TEXT;
        BEGIN
            SELECT course_id, start_time::text, end_time::text, day_of_week, timezone, meeting_url
            INTO v_course_id, v_start_text, v_end_text, v_day_of_week, v_timezone, v_meeting_url
            FROM public.course_schedules WHERE id = p_schedule_id;
            BEGIN
                v_start_time := NULLIF(trim(v_start_text), '')::time;
                v_end_time := NULLIF(trim(v_end_text), '')::time;
            EXCEPTION WHEN OTHERS THEN
                v_start_time := NULL;
                v_end_time := NULL;
            END;
        END;
    ELSIF p_session_id IS NOT NULL THEN
        SELECT course_id, start_time, end_time, meeting_url
        INTO v_course_id, v_session_start, v_session_end, v_meeting_url
        FROM public.class_sessions WHERE id = p_session_id;
    END IF;

    IF v_course_id IS NULL THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'Class not found.');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE student_id = v_user_id AND course_id = v_course_id AND status = 'active' AND access_granted = true
    ) INTO v_is_enrolled;

    IF NOT v_is_enrolled THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'You do not have an active approved enrollment for this course.');
    END IF;

    IF v_meeting_url IS NULL OR trim(v_meeting_url) = '' THEN
        RETURN jsonb_build_object('accessible', false, 'message', 'No Google Meet link has been posted for this class yet.');
    END IF;

    IF p_session_id IS NOT NULL AND v_session_start IS NOT NULL THEN
        v_can_view := (v_now >= (v_session_start - INTERVAL '15 minutes') AND v_now <= (COALESCE(v_session_end, v_session_start + INTERVAL '2 hours') + INTERVAL '30 minutes'));
    ELSIF p_schedule_id IS NOT NULL AND v_start_time IS NOT NULL THEN
        BEGIN
            v_local_now := now() AT TIME ZONE COALESCE(NULLIF(trim(v_timezone), ''), 'Africa/Lagos');
        EXCEPTION WHEN OTHERS THEN
            v_local_now := now() AT TIME ZONE 'Africa/Lagos';
        END;
        v_local_day := lower(trim(to_char(v_local_now, 'FMDay')));
        v_local_time := v_local_now::time;

        IF v_day_of_week IS NOT NULL AND lower(v_day_of_week) LIKE '%' || v_local_day || '%' THEN
            IF COALESCE(v_end_time, v_start_time + INTERVAL '2 hours') >= v_start_time THEN
                IF v_local_time >= (v_start_time - INTERVAL '15 minutes')::time
                   AND v_local_time <= (COALESCE(v_end_time, v_start_time + INTERVAL '2 hours') + INTERVAL '30 minutes')::time THEN
                    v_can_view := true;
                END IF;
            ELSE
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
        RETURN jsonb_build_object('accessible', false, 'message', 'The Google Meet link will become available 15 minutes before your scheduled class.');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.record_lesson_progress(
    p_course_id UUID,
    p_lesson_id UUID,
    p_completed BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    v_student_id UUID := auth.uid();
    v_total_lessons INTEGER := 0;
    v_completed_lessons INTEGER := 0;
    v_percentage NUMERIC := 0;
    v_now TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required.');
    END IF;

    IF NOT public.has_active_enrollment(p_course_id) AND NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Active course enrollment required.');
    END IF;

    INSERT INTO public.student_lesson_progress (
        student_id, course_id, lesson_id, is_completed, completed_at, last_accessed_at
    ) VALUES (
        v_student_id, p_course_id, p_lesson_id, p_completed,
        CASE WHEN p_completed THEN v_now ELSE NULL END, v_now
    )
    ON CONFLICT (student_id, lesson_id)
    DO UPDATE SET
        is_completed = p_completed,
        completed_at = CASE WHEN p_completed THEN v_now ELSE NULL END,
        last_accessed_at = v_now;

    SELECT count(cl.id) INTO v_total_lessons
    FROM public.course_lessons cl
    JOIN public.course_modules cm ON cl.module_id = cm.id
    WHERE cm.course_id = p_course_id;

    SELECT count(id) INTO v_completed_lessons
    FROM public.student_lesson_progress
    WHERE student_id = v_student_id AND course_id = p_course_id AND is_completed = true;

    IF v_total_lessons > 0 THEN
        v_percentage := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100, 1);
    ELSE
        v_percentage := 0;
    END IF;

    INSERT INTO public.student_course_progress (
        student_id, course_id, completed_lessons, total_lessons, percentage, last_lesson_id, last_accessed_at, updated_at
    ) VALUES (
        v_student_id, p_course_id, v_completed_lessons, v_total_lessons, v_percentage, p_lesson_id, v_now, v_now
    )
    ON CONFLICT (student_id, course_id)
    DO UPDATE SET
        completed_lessons = v_completed_lessons,
        total_lessons = v_total_lessons,
        percentage = v_percentage,
        last_lesson_id = p_lesson_id,
        last_accessed_at = v_now,
        updated_at = v_now;

    RETURN jsonb_build_object(
        'success', true,
        'completed_lessons', v_completed_lessons,
        'total_lessons', v_total_lessons,
        'percentage', v_percentage,
        'last_lesson_id', p_lesson_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ====================================================================
-- 5. ENABLE RLS ON ALL TABLES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- 6. ROW LEVEL SECURITY POLICIES (Clean & Non-Blocking)
-- ====================================================================

-- Profiles
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can read student profiles" ON public.profiles;
CREATE POLICY "Teachers can read student profiles" ON public.profiles FOR SELECT USING (public.is_teacher());

DROP POLICY IF EXISTS "Users can update their own non-role fields" ON public.profiles;
CREATE POLICY "Users can update their own non-role fields" ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND ((public.is_admin() IS TRUE) OR (role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))));

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Course Categories
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.course_categories;
CREATE POLICY "Anyone can view active categories" ON public.course_categories FOR SELECT USING (is_active = true OR public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins can manage all categories" ON public.course_categories;
CREATE POLICY "Admins can manage all categories" ON public.course_categories FOR ALL USING (public.is_admin());

-- Courses
DROP POLICY IF EXISTS "Anyone can view published courses" ON public.courses;
DROP POLICY IF EXISTS "Admins and teachers can view all courses" ON public.courses;
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT
    USING (is_published = true OR status = 'published' OR public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins can manage all courses" ON public.courses;
DROP POLICY IF EXISTS "Only Admins can write courses" ON public.courses;
CREATE POLICY "Admins can manage all courses" ON public.courses FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Teachers can update courses" ON public.courses;
CREATE POLICY "Teachers and Admins can update courses" ON public.courses FOR UPDATE
    USING (
        public.is_admin() OR public.is_teacher()
        OR EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = courses.id)
        OR EXISTS (SELECT 1 FROM public.course_schedules cs WHERE cs.teacher_id = auth.uid() AND cs.course_id = courses.id)
    )
    WITH CHECK (
        public.is_admin() OR public.is_teacher()
        OR EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = courses.id)
        OR EXISTS (SELECT 1 FROM public.course_schedules cs WHERE cs.teacher_id = auth.uid() AND cs.course_id = courses.id)
    );

-- Course Pricing & Countries
DROP POLICY IF EXISTS "Anyone can view course pricing" ON public.course_pricing;
CREATE POLICY "Anyone can view course pricing" ON public.course_pricing FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage course pricing" ON public.course_pricing;
DROP POLICY IF EXISTS "Only Admins can manage course pricing" ON public.course_pricing;
CREATE POLICY "Admins can manage course pricing" ON public.course_pricing FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view active country configs" ON public.countries_config;
CREATE POLICY "Anyone can view active country configs" ON public.countries_config FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage countries config" ON public.countries_config;
CREATE POLICY "Admins can manage countries config" ON public.countries_config FOR ALL USING (public.is_admin());

-- Course Schedules
DROP POLICY IF EXISTS "Anyone can view active course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Admins and teachers can view all schedules" ON public.course_schedules;
CREATE POLICY "Anyone can view active course schedules" ON public.course_schedules FOR SELECT
    USING (is_active = true OR public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Only Admins can write course schedules" ON public.course_schedules;
CREATE POLICY "Admins can manage all course schedules" ON public.course_schedules FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers and Admins can insert course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can insert course schedules for assigned courses" ON public.course_schedules;
CREATE POLICY "Teachers and Admins can insert course schedules" ON public.course_schedules FOR INSERT
    WITH CHECK (
        public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = course_schedules.course_id)
    );

DROP POLICY IF EXISTS "Teachers and Admins can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can update course schedules" ON public.course_schedules;
DROP POLICY IF EXISTS "Teachers can update meeting_url for assigned schedules" ON public.course_schedules;
CREATE POLICY "Teachers and Admins can update course schedules" ON public.course_schedules FOR UPDATE
    USING (
        public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = course_schedules.course_id)
    )
    WITH CHECK (
        public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = course_schedules.course_id)
    );

-- Teacher Course Assignments (CRITICAL: Students must be able to SELECT to verify has_assigned_teacher)
DROP POLICY IF EXISTS "Anyone can view course teacher assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Staff can view assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Teachers can view their own assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Admins can manage all teacher assignments" ON public.teacher_course_assignments;
DROP POLICY IF EXISTS "Admins and teachers can manage assignments" ON public.teacher_course_assignments;

CREATE POLICY "Anyone can view course teacher assignments" ON public.teacher_course_assignments FOR SELECT USING (true);
CREATE POLICY "Admins can manage all teacher assignments" ON public.teacher_course_assignments FOR ALL USING (public.is_admin());

-- Teacher Invitations
DROP POLICY IF EXISTS "Admins can view and manage teacher invitations" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Admins can view all teacher invitations" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Anyone can view teacher invitations by token" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Users can view their claimed teacher invitation" ON public.teacher_invitations;
DROP POLICY IF EXISTS "Users can update teacher invitations when claiming" ON public.teacher_invitations;

CREATE POLICY "Admins can view and manage teacher invitations" ON public.teacher_invitations FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view teacher invitations by token" ON public.teacher_invitations FOR SELECT USING (true);

-- Course Selections
DROP POLICY IF EXISTS "Students can view their own course selections" ON public.course_selections;
CREATE POLICY "Students can view their own course selections" ON public.course_selections FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert their own course selections" ON public.course_selections;
CREATE POLICY "Students can insert their own course selections" ON public.course_selections FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update/cancel their own course selections" ON public.course_selections;
CREATE POLICY "Students can update/cancel their own course selections" ON public.course_selections FOR UPDATE
    USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id AND status = 'cancelled');

DROP POLICY IF EXISTS "Admins can read and manage all course selections" ON public.course_selections;
CREATE POLICY "Admins can read and manage all course selections" ON public.course_selections FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view course selections for assigned courses" ON public.course_selections;
CREATE POLICY "Teachers can view course selections for assigned courses" ON public.course_selections FOR SELECT
    USING (
        public.is_teacher() AND (
            EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = course_selections.course_id)
            OR EXISTS (SELECT 1 FROM public.course_schedules cs WHERE cs.teacher_id = auth.uid() AND cs.course_id = course_selections.course_id)
        )
    );

-- Enrollments
DROP POLICY IF EXISTS "Students can view their own active enrollments" ON public.enrollments;
CREATE POLICY "Students can view their own active enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view enrollments for assigned courses" ON public.enrollments;
DROP POLICY IF EXISTS "Admins and teachers can view all enrollments" ON public.enrollments;
CREATE POLICY "Teachers can view enrollments for assigned courses" ON public.enrollments FOR SELECT
    USING (
        public.is_teacher() AND (
            EXISTS (SELECT 1 FROM public.teacher_course_assignments tca WHERE tca.teacher_id = auth.uid() AND tca.course_id = enrollments.course_id)
            OR EXISTS (SELECT 1 FROM public.course_schedules cs WHERE cs.teacher_id = auth.uid() AND cs.course_id = enrollments.course_id)
        )
    );

DROP POLICY IF EXISTS "Only Admins can manage enrollments" ON public.enrollments;
CREATE POLICY "Only Admins can manage enrollments" ON public.enrollments FOR ALL USING (public.is_admin());

-- Orders, Order Items & Payments
DROP POLICY IF EXISTS "Students can view their own orders" ON public.orders;
CREATE POLICY "Students can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can create their own orders" ON public.orders;
CREATE POLICY "Students can create their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view and manage all orders" ON public.orders;
CREATE POLICY "Admins can view and manage all orders" ON public.orders FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own order items" ON public.order_items;
CREATE POLICY "Students can view their own order items" ON public.order_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.student_id = auth.uid()));

DROP POLICY IF EXISTS "Students can create order items for their orders" ON public.order_items;
CREATE POLICY "Students can create order items for their orders" ON public.order_items FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.student_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own payments" ON public.payments;
CREATE POLICY "Students can view their own payments" ON public.payments FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can submit their own payment record" ON public.payments;
CREATE POLICY "Students can submit their own payment record" ON public.payments FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can read and manage all payments" ON public.payments;
CREATE POLICY "Admins can read and manage all payments" ON public.payments FOR ALL USING (public.is_admin());

-- Class Sessions & Recordings
DROP POLICY IF EXISTS "Anyone can view class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Enrolled students can view class sessions for their enrolled courses" ON public.class_sessions;
DROP POLICY IF EXISTS "Admins and teachers can view and manage class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Admins can manage all class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Teachers can view and manage their assigned class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Staff can manage class sessions" ON public.class_sessions;

CREATE POLICY "Enrolled students can view class sessions for their enrolled courses" ON public.class_sessions FOR SELECT
    USING (public.has_active_enrollment(class_sessions.course_id) OR public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid());

CREATE POLICY "Staff can manage class sessions" ON public.class_sessions FOR ALL
    USING (public.is_admin() OR public.is_teacher() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view recordings" ON public.class_recordings;
DROP POLICY IF EXISTS "Enrolled students can view class recordings" ON public.class_recordings;
DROP POLICY IF EXISTS "Admins can manage all class recordings" ON public.class_recordings;
DROP POLICY IF EXISTS "Assigned teachers can manage class recordings" ON public.class_recordings;
DROP POLICY IF EXISTS "Staff can manage recordings" ON public.class_recordings;

CREATE POLICY "Enrolled students can view class recordings" ON public.class_recordings FOR SELECT
    USING (public.has_active_enrollment(class_recordings.course_id) OR public.is_admin() OR public.is_teacher());

CREATE POLICY "Staff can manage recordings" ON public.class_recordings FOR ALL
    USING (public.is_admin() OR public.is_teacher() OR user_id = auth.uid() OR created_by = auth.uid());

-- Modules, Lessons, Materials
DROP POLICY IF EXISTS "Students can view modules and lessons for active enrollments" ON public.course_modules;
CREATE POLICY "Students can view modules and lessons for active enrollments" ON public.course_modules FOR SELECT
    USING (public.has_active_enrollment(course_modules.course_id));

DROP POLICY IF EXISTS "Admins and teachers can manage course modules" ON public.course_modules;
CREATE POLICY "Admins and teachers can manage course modules" ON public.course_modules FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Students can view lessons for active enrollments" ON public.course_lessons;
CREATE POLICY "Students can view lessons for active enrollments" ON public.course_lessons FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.course_modules cm WHERE cm.id = course_lessons.module_id AND public.has_active_enrollment(cm.course_id)));

DROP POLICY IF EXISTS "Admins and teachers can manage course lessons" ON public.course_lessons;
CREATE POLICY "Admins and teachers can manage course lessons" ON public.course_lessons FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins can manage all lesson materials" ON public.lesson_materials;
DROP POLICY IF EXISTS "Assigned teachers can manage lesson materials" ON public.lesson_materials;
DROP POLICY IF EXISTS "Enrolled students can view lesson materials" ON public.lesson_materials;

CREATE POLICY "Enrolled students can view lesson materials" ON public.lesson_materials FOR SELECT
    USING (public.has_active_enrollment(lesson_materials.course_id) OR public.is_admin() OR public.is_teacher());

CREATE POLICY "Staff can manage lesson materials" ON public.lesson_materials FOR ALL
    USING (public.is_admin() OR public.is_teacher());

-- Quizzes & Progress
DROP POLICY IF EXISTS "Admins can manage all quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Assigned teachers can manage quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Enrolled students can view published quizzes" ON public.quizzes;

CREATE POLICY "Enrolled students can view published quizzes" ON public.quizzes FOR SELECT
    USING ((quizzes.is_published = true AND public.has_active_enrollment(quizzes.course_id)) OR public.is_admin() OR public.is_teacher());

CREATE POLICY "Staff can manage quizzes" ON public.quizzes FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins and teachers can manage quiz questions" ON public.quiz_questions;
DROP POLICY IF EXISTS "Enrolled students can view quiz questions" ON public.quiz_questions;

CREATE POLICY "Enrolled students can view quiz questions" ON public.quiz_questions FOR SELECT
    USING (public.is_admin() OR public.is_teacher() OR EXISTS (
        SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND q.is_published = true AND public.has_active_enrollment(q.course_id)
    ));

CREATE POLICY "Staff can manage quiz questions" ON public.quiz_questions FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins and teachers can manage quiz options" ON public.quiz_options;
DROP POLICY IF EXISTS "Enrolled students can view quiz options" ON public.quiz_options;

CREATE POLICY "Enrolled students can view quiz options" ON public.quiz_options FOR SELECT
    USING (public.is_admin() OR public.is_teacher() OR EXISTS (
        SELECT 1 FROM public.quiz_questions qq JOIN public.quizzes q ON q.id = qq.quiz_id
        WHERE qq.id = quiz_options.question_id AND q.is_published = true AND public.has_active_enrollment(q.course_id)
    ));

CREATE POLICY "Staff can manage quiz options" ON public.quiz_options FOR ALL
    USING (public.is_admin() OR public.is_teacher());

DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Teachers can view attempts for assigned courses" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Students can manage their own quiz attempts" ON public.quiz_attempts;

CREATE POLICY "Staff can view quiz attempts" ON public.quiz_attempts FOR SELECT USING (public.is_admin() OR public.is_teacher());
CREATE POLICY "Students can manage their own quiz attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all quiz answers" ON public.quiz_answers;
DROP POLICY IF EXISTS "Teachers can view answers for assigned courses" ON public.quiz_answers;
DROP POLICY IF EXISTS "Students can insert and view their own quiz answers" ON public.quiz_answers;

CREATE POLICY "Staff can view quiz answers" ON public.quiz_answers FOR SELECT USING (public.is_admin() OR public.is_teacher());
CREATE POLICY "Students can insert and view their own quiz answers" ON public.quiz_answers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND qa.student_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_attempts qa WHERE qa.id = quiz_answers.attempt_id AND qa.student_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all progress" ON public.student_lesson_progress;
DROP POLICY IF EXISTS "Teachers can view lesson progress for assigned courses" ON public.student_lesson_progress;
DROP POLICY IF EXISTS "Students can manage their own lesson progress" ON public.student_lesson_progress;

CREATE POLICY "Staff can view lesson progress" ON public.student_lesson_progress FOR SELECT USING (public.is_admin() OR public.is_teacher());
CREATE POLICY "Students can manage their own lesson progress" ON public.student_lesson_progress FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all course progress" ON public.student_course_progress;
DROP POLICY IF EXISTS "Teachers can view course progress for assigned courses" ON public.student_course_progress;
DROP POLICY IF EXISTS "Students can manage their own course progress" ON public.student_course_progress;

CREATE POLICY "Staff can view course progress" ON public.student_course_progress FOR SELECT USING (public.is_admin() OR public.is_teacher());
CREATE POLICY "Students can manage their own course progress" ON public.student_course_progress FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- Notifications, Certificates, Audit Logs
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification is_read status" ON public.notifications;
CREATE POLICY "Users can update their own notification is_read status" ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Students can view their own certificates" ON public.certificates;
CREATE POLICY "Students can view their own certificates" ON public.certificates FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can manage certificates" ON public.certificates;
CREATE POLICY "Admins can manage certificates" ON public.certificates FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Only Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());

-- ====================================================================
-- 7. STORAGE BUCKETS (Non-Destructive)
-- ====================================================================
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'course-images', 'course-images', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO storage.buckets (id, name, public)
    VALUES ('lesson-materials', 'lesson-materials', true)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view course hero images" ON storage.objects;
    CREATE POLICY "Public can view course hero images" ON storage.objects FOR SELECT USING (bucket_id IN ('course-images', 'lesson-materials'));

    DROP POLICY IF EXISTS "Authenticated users can upload course images" ON storage.objects;
    CREATE POLICY "Authenticated users can upload course images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('course-images', 'lesson-materials'));

    DROP POLICY IF EXISTS "Authenticated users can update course images" ON storage.objects;
    CREATE POLICY "Authenticated users can update course images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('course-images', 'lesson-materials'));

    DROP POLICY IF EXISTS "Authenticated users can delete course images" ON storage.objects;
    CREATE POLICY "Authenticated users can delete course images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('course-images', 'lesson-materials'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ====================================================================
-- 8. REALTIME PUBLICATION (Safe - Ignores Already Added Tables)
-- ====================================================================
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'course_selections', 'courses', 'course_categories', 'course_schedules',
        'course_pricing', 'enrollments', 'profiles', 'payments', 'orders',
        'teacher_invitations', 'teacher_course_assignments', 'class_sessions',
        'course_modules', 'course_lessons', 'lesson_materials', 'class_recordings',
        'quizzes', 'quiz_attempts', 'student_lesson_progress', 'student_course_progress',
        'notifications'
    ];
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY tables LOOP
            BEGIN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END LOOP;
    END IF;
END $$;

-- ====================================================================
-- 9. GRANTS & ROLE SAFEGUARDS
-- ====================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.course_schedules TO anon;
GRANT SELECT ON public.course_categories TO anon;
GRANT SELECT ON public.course_pricing TO anon;
GRANT SELECT ON public.countries_config TO anon;
GRANT SELECT ON public.teacher_course_assignments TO anon;
GRANT EXECUTE ON FUNCTION public.has_active_enrollment(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_teacher_invitation(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_teacher_invitation(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_meeting_url(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_lesson_progress(UUID, UUID, BOOLEAN) TO authenticated, service_role;

-- Only promote 'student' -> 'teacher' if explicitly assigned; never touches 'admin' or existing 'teacher' rows
UPDATE public.profiles
SET role = 'teacher'
WHERE role = 'student'
  AND (
      id IN (SELECT DISTINCT teacher_id FROM public.teacher_course_assignments WHERE teacher_id IS NOT NULL)
      OR id IN (SELECT DISTINCT teacher_id FROM public.course_schedules WHERE teacher_id IS NOT NULL)
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
