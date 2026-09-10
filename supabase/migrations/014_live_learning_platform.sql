-- ====================================================================
-- Ingenium Tech Academy - Migration 014: Live Learning Platform Engine
-- Purpose:
-- 1. Extend course_modules and course_lessons with updated fields
-- 2. Create lesson_materials for downloadable PDFs and documents (Supabase Storage backed)
-- 3. Extend class_sessions and create class_recordings for live sessions
-- 4. Create quizzes, quiz_questions, quiz_options, quiz_attempts, quiz_answers
-- 5. Create student_lesson_progress and student_course_progress for real persistence
-- 6. Implement atomic progress calculation RPC
-- 7. Configure Row Level Security (RLS) across all learning tables
-- 8. Add all learning tables to supabase_realtime publication
-- ====================================================================

-- 1. Upgrade course_modules table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_modules' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.course_modules ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_modules' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.course_modules ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_modules_course ON public.course_modules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_modules_sort ON public.course_modules(course_id, sort_order);

-- 2. Upgrade course_lessons table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_lessons' AND column_name = 'video_url'
    ) THEN
        ALTER TABLE public.course_lessons ADD COLUMN video_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'course_lessons' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.course_lessons ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON public.course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_sort ON public.course_lessons(module_id, sort_order);

-- 3. Create lesson_materials table (PDFs, guides, downloadable resources)
CREATE TABLE IF NOT EXISTS public.lesson_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'document', 'link'
    file_size INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lesson_materials_lesson ON public.lesson_materials(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_materials_course ON public.lesson_materials(course_id);

-- 4. Extend class_sessions with title and notes if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'title'
    ) THEN
        ALTER TABLE public.class_sessions ADD COLUMN title TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'class_sessions' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.class_sessions ADD COLUMN notes TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_sessions_course ON public.class_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_start ON public.class_sessions(start_time);

-- 5. Create class_recordings table (Live Class Session Recordings)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_class_recordings_course ON public.class_recordings(course_id);
CREATE INDEX IF NOT EXISTS idx_class_recordings_session ON public.class_recordings(session_id);

-- 6. Create Quizzes tables
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    module_id UUID REFERENCES public.course_modules(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES public.course_lessons(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.class_sessions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    raw_text TEXT, -- Retains pasted text for teacher review/re-editing
    total_marks INTEGER NOT NULL DEFAULT 0,
    pass_percentage INTEGER NOT NULL DEFAULT 50,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON public.quizzes(lesson_id);

-- 7. Quiz Questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL, -- e.g. 'A', 'B', 'C', 'D'
    marks INTEGER NOT NULL DEFAULT 1,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, question_number);

-- 8. Quiz Options table
CREATE TABLE IF NOT EXISTS public.quiz_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE NOT NULL,
    option_key TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
    option_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options(question_id);

-- 9. Quiz Attempts table
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

-- 10. Quiz Answers table (detail of student answers)
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

-- 11. Student Lesson Progress table
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

-- 12. Student Course Progress table
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

-- ====================================================================
-- Atomic Function: Record lesson progress and recalculate course progress
-- ====================================================================
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

    -- Ensure student has active approved enrollment for this course
    IF NOT public.has_active_enrollment(p_course_id) AND NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Active course enrollment required.');
    END IF;

    -- Upsert lesson progress
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

    -- Count total lessons in course
    SELECT count(cl.id) INTO v_total_lessons
    FROM public.course_lessons cl
    JOIN public.course_modules cm ON cl.module_id = cm.id
    WHERE cm.course_id = p_course_id;

    -- Count completed lessons by this student
    SELECT count(id) INTO v_completed_lessons
    FROM public.student_lesson_progress
    WHERE student_id = v_student_id 
      AND course_id = p_course_id 
      AND is_completed = true;

    IF v_total_lessons > 0 THEN
        v_percentage := round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100, 1);
    ELSE
        v_percentage := 0;
    END IF;

    -- Upsert course progress
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
-- Row Level Security (RLS) Policies
-- ====================================================================

-- Enable RLS
ALTER TABLE public.lesson_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_course_progress ENABLE ROW LEVEL SECURITY;

-- Lesson Materials
DROP POLICY IF EXISTS "Admins can manage all lesson materials" ON public.lesson_materials;
CREATE POLICY "Admins can manage all lesson materials"
    ON public.lesson_materials FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Assigned teachers can manage lesson materials" ON public.lesson_materials;
CREATE POLICY "Assigned teachers can manage lesson materials"
    ON public.lesson_materials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = lesson_materials.course_id
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view lesson materials" ON public.lesson_materials;
CREATE POLICY "Enrolled students can view lesson materials"
    ON public.lesson_materials FOR SELECT
    USING (public.has_active_enrollment(course_id));

-- Class Recordings
DROP POLICY IF EXISTS "Admins can manage all class recordings" ON public.class_recordings;
CREATE POLICY "Admins can manage all class recordings"
    ON public.class_recordings FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Assigned teachers can manage class recordings" ON public.class_recordings;
CREATE POLICY "Assigned teachers can manage class recordings"
    ON public.class_recordings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = class_recordings.course_id
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view class recordings" ON public.class_recordings;
CREATE POLICY "Enrolled students can view class recordings"
    ON public.class_recordings FOR SELECT
    USING (public.has_active_enrollment(course_id));

-- Quizzes
DROP POLICY IF EXISTS "Admins can manage all quizzes" ON public.quizzes;
CREATE POLICY "Admins can manage all quizzes"
    ON public.quizzes FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Assigned teachers can manage quizzes" ON public.quizzes;
CREATE POLICY "Assigned teachers can manage quizzes"
    ON public.quizzes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = quizzes.course_id
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view published quizzes" ON public.quizzes;
CREATE POLICY "Enrolled students can view published quizzes"
    ON public.quizzes FOR SELECT
    USING (is_published = true AND public.has_active_enrollment(course_id));

-- Quiz Questions
DROP POLICY IF EXISTS "Admins and teachers can manage quiz questions" ON public.quiz_questions;
CREATE POLICY "Admins and teachers can manage quiz questions"
    ON public.quiz_questions FOR ALL
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.quizzes q
            JOIN public.teacher_course_assignments tca ON tca.course_id = q.course_id
            WHERE q.id = quiz_questions.quiz_id AND tca.teacher_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Enrolled students can view quiz questions"
    ON public.quiz_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_questions.quiz_id 
              AND q.is_published = true 
              AND public.has_active_enrollment(q.course_id)
        )
    );

-- Quiz Options
DROP POLICY IF EXISTS "Admins and teachers can manage quiz options" ON public.quiz_options;
CREATE POLICY "Admins and teachers can manage quiz options"
    ON public.quiz_options FOR ALL
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.quiz_questions qq
            JOIN public.quizzes q ON q.id = qq.quiz_id
            JOIN public.teacher_course_assignments tca ON tca.course_id = q.course_id
            WHERE qq.id = quiz_options.question_id AND tca.teacher_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enrolled students can view quiz options" ON public.quiz_options;
CREATE POLICY "Enrolled students can view quiz options"
    ON public.quiz_options FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quiz_questions qq
            JOIN public.quizzes q ON q.id = qq.quiz_id
            WHERE qq.id = quiz_options.question_id 
              AND q.is_published = true 
              AND public.has_active_enrollment(q.course_id)
        )
    );

-- Quiz Attempts
DROP POLICY IF EXISTS "Admins can view all quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Admins can view all quiz attempts"
    ON public.quiz_attempts FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view attempts for assigned courses" ON public.quiz_attempts;
CREATE POLICY "Teachers can view attempts for assigned courses"
    ON public.quiz_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = quiz_attempts.course_id
        )
    );

DROP POLICY IF EXISTS "Students can manage their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Students can manage their own quiz attempts"
    ON public.quiz_attempts FOR ALL
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Quiz Answers
DROP POLICY IF EXISTS "Admins can view all quiz answers" ON public.quiz_answers;
CREATE POLICY "Admins can view all quiz answers"
    ON public.quiz_answers FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view answers for assigned courses" ON public.quiz_answers;
CREATE POLICY "Teachers can view answers for assigned courses"
    ON public.quiz_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts qa
            JOIN public.teacher_course_assignments tca ON tca.course_id = qa.course_id
            WHERE qa.id = quiz_answers.attempt_id AND tca.teacher_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students can insert and view their own quiz answers" ON public.quiz_answers;
CREATE POLICY "Students can insert and view their own quiz answers"
    ON public.quiz_answers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts qa
            WHERE qa.id = quiz_answers.attempt_id AND qa.student_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quiz_attempts qa
            WHERE qa.id = quiz_answers.attempt_id AND qa.student_id = auth.uid()
        )
    );

-- Student Lesson & Course Progress
DROP POLICY IF EXISTS "Admins can view all progress" ON public.student_lesson_progress;
CREATE POLICY "Admins can view all progress"
    ON public.student_lesson_progress FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view lesson progress for assigned courses" ON public.student_lesson_progress;
CREATE POLICY "Teachers can view lesson progress for assigned courses"
    ON public.student_lesson_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = student_lesson_progress.course_id
        )
    );

DROP POLICY IF EXISTS "Students can manage their own lesson progress" ON public.student_lesson_progress;
CREATE POLICY "Students can manage their own lesson progress"
    ON public.student_lesson_progress FOR ALL
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Admins can view all course progress" ON public.student_course_progress;
CREATE POLICY "Admins can view all course progress"
    ON public.student_course_progress FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can view course progress for assigned courses" ON public.student_course_progress;
CREATE POLICY "Teachers can view course progress for assigned courses"
    ON public.student_course_progress FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teacher_course_assignments tca
            WHERE tca.teacher_id = auth.uid() AND tca.course_id = student_course_progress.course_id
        )
    );

DROP POLICY IF EXISTS "Students can manage their own course progress" ON public.student_course_progress;
CREATE POLICY "Students can manage their own course progress"
    ON public.student_course_progress FOR ALL
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Realtime publication inclusion for learning tables
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.course_modules;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.course_lessons;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_materials;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.class_recordings;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_lesson_progress;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_course_progress;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
