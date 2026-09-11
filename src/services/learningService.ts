import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeSync } from './realtimeSync';
import { 
  CourseModule, CourseLesson, LessonMaterial, ClassRecording, 
  ClassSession, Quiz, QuizQuestion, QuizOption, QuizAttempt, QuizAnswer, 
  StudentLessonProgress, StudentCourseProgress 
} from '../types';
import { ParsedQuestion } from '../lib/quizParser';

export const learningService = {
  // ====================================================================
  // 1. CURRICULUM: MODULES & LESSONS
  // ====================================================================

  /**
   * Get all modules for a course with nested lessons and materials
   */
  async getCourseCurriculum(courseId: string): Promise<CourseModule[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      // 1. Fetch modules
      const { data: modules, error: modError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order', { ascending: true });

      if (modError) {
        console.error('[LearningService] Error loading modules:', modError);
        return [];
      }

      if (!modules || modules.length === 0) return [];

      const moduleIds = modules.map(m => m.id);

      // 2. Fetch lessons for these modules
      const { data: lessons, error: lessError } = await supabase
        .from('course_lessons')
        .select('*')
        .in('module_id', moduleIds)
        .order('sort_order', { ascending: true });

      if (lessError) {
        console.error('[LearningService] Error loading lessons:', lessError);
      }

      const lessonList: CourseLesson[] = lessons || [];
      const lessonIds = lessonList.map(l => l.id);

      // 3. Fetch materials for these lessons
      let materials: LessonMaterial[] = [];
      if (lessonIds.length > 0) {
        const { data: matData, error: matError } = await supabase
          .from('lesson_materials')
          .select('*')
          .in('lesson_id', lessonIds);
        
        if (!matError && matData) {
          materials = matData;
        }
      }

      // 4. Fetch quizzes for these lessons
      let quizzes: Quiz[] = [];
      if (lessonIds.length > 0) {
        const { data: qData, error: qError } = await supabase
          .from('quizzes')
          .select('*')
          .in('lesson_id', lessonIds);

        if (!qError && qData) {
          quizzes = qData;
        }
      }

      // Group into hierarchical modules
      return modules.map(mod => {
        const modLessons = lessonList
          .filter(l => l.module_id === mod.id)
          .map(l => ({
            ...l,
            materials: materials.filter(m => m.lesson_id === l.id),
            quizzes: quizzes.filter(q => q.lesson_id === l.id)
          }));

        return {
          ...mod,
          lessons: modLessons
        };
      });
    } catch (e) {
      console.error('[LearningService] Failed to get course curriculum:', e);
      return [];
    }
  },

  /**
   * Create a new module
   */
  async createModule(courseId: string, title: string, description?: string): Promise<CourseModule> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    // Determine current highest sort_order
    const { data: existing } = await supabase
      .from('course_modules')
      .select('sort_order')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = (existing && existing.length > 0) ? (existing[0].sort_order + 1) : 1;

    const { data, error } = await supabase
      .from('course_modules')
      .insert({
        course_id: courseId,
        title: title.trim(),
        description: description?.trim() || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_modules', 'INSERT');
    return { ...data, lessons: [] };
  },

  /**
   * Update module
   */
  async updateModule(moduleId: string, updates: { title?: string; description?: string; sort_order?: number }): Promise<CourseModule> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data, error } = await supabase
      .from('course_modules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_modules', 'UPDATE');
    return data;
  },

  /**
   * Delete module and all contained lessons
   */
  async deleteModule(moduleId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { error } = await supabase
      .from('course_modules')
      .delete()
      .eq('id', moduleId);

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_modules', 'DELETE');
  },

  /**
   * Create a new lesson
   */
  async createLesson(moduleId: string, title: string, content?: string, duration?: string, videoUrl?: string): Promise<CourseLesson> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data: existing } = await supabase
      .from('course_lessons')
      .select('sort_order')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = (existing && existing.length > 0) ? (existing[0].sort_order + 1) : 1;

    const { data, error } = await supabase
      .from('course_lessons')
      .insert({
        module_id: moduleId,
        title: title.trim(),
        content: content || '',
        duration: duration?.trim() || null,
        video_url: videoUrl?.trim() || null,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_lessons', 'INSERT');
    return { ...data, materials: [], quizzes: [] };
  },

  /**
   * Update lesson details
   */
  async updateLesson(lessonId: string, updates: { title?: string; content?: string; duration?: string; video_url?: string; sort_order?: number }): Promise<CourseLesson> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data, error } = await supabase
      .from('course_lessons')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', lessonId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_lessons', 'UPDATE');
    return data;
  },

  /**
   * Delete lesson
   */
  async deleteLesson(lessonId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { error } = await supabase
      .from('course_lessons')
      .delete()
      .eq('id', lessonId);

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('course_lessons', 'DELETE');
  },

  // ====================================================================
  // 2. LESSON MATERIALS & PDF UPLOADS
  // ====================================================================

  /**
   * Upload a PDF or document material for a lesson
   */
  async uploadLessonMaterial(
    courseId: string, 
    lessonId: string, 
    file: File, 
    title: string,
    fileType: 'pdf' | 'document' | 'link' = 'pdf',
    userId?: string
  ): Promise<LessonMaterial> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    // Upload to Supabase Storage in 'lesson-materials' bucket or fallback to 'course-images'
    let publicUrl = '';
    const fileExt = file.name.split('.').pop() || 'pdf';
    const cleanFileName = `${courseId}/${lessonId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // Try 'lesson-materials' bucket first
    const { error: uploadError } = await supabase.storage
      .from('lesson-materials')
      .upload(cleanFileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      // Fallback bucket
      const { error: fallbackError } = await supabase.storage
        .from('course-images')
        .upload(cleanFileName, file, { cacheControl: '3600', upsert: true });

      if (fallbackError) {
        throw new Error(`Material upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('course-images')
        .getPublicUrl(cleanFileName);
      publicUrl = urlData.publicUrl;
    } else {
      const { data: urlData } = supabase.storage
        .from('lesson-materials')
        .getPublicUrl(cleanFileName);
      publicUrl = urlData.publicUrl;
    }

    // Insert record in lesson_materials
    const { data, error: dbError } = await supabase
      .from('lesson_materials')
      .insert({
        course_id: courseId,
        lesson_id: lessonId,
        title: title.trim() || file.name,
        file_url: publicUrl,
        file_type: fileType,
        file_size: file.size,
        created_by: userId || null
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    realtimeSync.notifyMutation('lesson_materials', 'INSERT');
    return data;
  },

  /**
   * Delete a lesson material
   */
  async deleteLessonMaterial(materialId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { error } = await supabase
      .from('lesson_materials')
      .delete()
      .eq('id', materialId);

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('lesson_materials', 'DELETE');
  },

  // ====================================================================
  // 3. LIVE CLASS SESSIONS & RECORDINGS
  // ====================================================================

  /**
   * Fetch all sessions for a course
   */
  async getClassSessions(courseId: string): Promise<ClassSession[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('course_id', courseId)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('[LearningService] Error loading class sessions:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Create a scheduled live class session
   */
  async createClassSession(session: {
    course_id: string;
    schedule_id?: string;
    teacher_id?: string;
    title?: string;
    start_time: string;
    end_time: string;
    meeting_url?: string;
    notes?: string;
  }): Promise<ClassSession> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data, error } = await supabase
      .from('class_sessions')
      .insert({
        course_id: session.course_id,
        schedule_id: session.schedule_id || null,
        teacher_id: session.teacher_id || null,
        title: session.title?.trim() || null,
        start_time: session.start_time,
        end_time: session.end_time,
        meeting_url: session.meeting_url?.trim() || null,
        notes: session.notes?.trim() || null,
        status: 'scheduled'
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('class_sessions', 'INSERT');
    return data;
  },

  /**
   * Update session status or meeting URL
   */
  async updateClassSession(sessionId: string, updates: Partial<ClassSession>): Promise<ClassSession> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data, error } = await supabase
      .from('class_sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('class_sessions', 'UPDATE');
    return data;
  },

  /**
   * Fetch recordings for a course
   */
  async getClassRecordings(courseId: string): Promise<ClassRecording[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('class_recordings')
      .select('*')
      .eq('course_id', courseId)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('[LearningService] Error loading recordings:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Attach / create a class recording
   */
  async createClassRecording(recording: {
    course_id: string;
    session_id?: string;
    lesson_id?: string;
    title: string;
    recording_url: string;
    duration?: string;
    userId?: string;
  }): Promise<ClassRecording> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { data, error } = await supabase
      .from('class_recordings')
      .insert({
        course_id: recording.course_id,
        session_id: recording.session_id || null,
        lesson_id: recording.lesson_id || null,
        title: recording.title.trim(),
        recording_url: recording.recording_url.trim(),
        duration: recording.duration?.trim() || null,
        created_by: recording.userId || null
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('class_recordings', 'INSERT');
    return data;
  },

  // ====================================================================
  // 4. QUIZZES & AUTOMATIC SCORING
  // ====================================================================

  /**
   * Get all quizzes for a course (with questions count)
   */
  async getCourseQuizzes(courseId: string, publishedOnly: boolean = false): Promise<Quiz[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    let query = supabase
      .from('quizzes')
      .select('*')
      .eq('course_id', courseId);

    if (publishedOnly) {
      query = query.eq('is_published', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error('[LearningService] Error loading quizzes:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get a complete quiz with questions and options
   */
  async getQuizDetails(quizId: string): Promise<Quiz | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    try {
      // 1. Fetch Quiz
      const { data: quiz, error: qError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (qError || !quiz) return null;

      // 2. Fetch Questions
      const { data: questions, error: questError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('question_number', { ascending: true });

      if (questError || !questions) return { ...quiz, questions: [] };

      const questionIds = questions.map(q => q.id);

      // 3. Fetch Options
      let options: QuizOption[] = [];
      if (questionIds.length > 0) {
        const { data: optData, error: optError } = await supabase
          .from('quiz_options')
          .select('*')
          .in('question_id', questionIds);

        if (!optError && optData) {
          options = optData;
        }
      }

      const structuredQuestions: QuizQuestion[] = questions.map(q => ({
        ...q,
        options: options.filter(o => o.question_id === q.id)
      }));

      return {
        ...quiz,
        questions: structuredQuestions
      };
    } catch (e) {
      console.error('[LearningService] Failed to load quiz details:', e);
      return null;
    }
  },

  /**
   * Save parsed quiz (from teacher parser) into Supabase
   */
  async saveParsedQuiz(
    quizMeta: {
      course_id: string;
      title: string;
      description?: string;
      raw_text?: string;
      module_id?: string;
      lesson_id?: string;
      session_id?: string;
      pass_percentage?: number;
      is_published?: boolean;
      userId?: string;
    },
    parsedQuestions: ParsedQuestion[]
  ): Promise<Quiz> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const totalMarks = parsedQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    // 1. Insert Quiz header
    const { data: newQuiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        course_id: quizMeta.course_id,
        module_id: quizMeta.module_id || null,
        lesson_id: quizMeta.lesson_id || null,
        session_id: quizMeta.session_id || null,
        title: quizMeta.title.trim(),
        description: quizMeta.description?.trim() || null,
        raw_text: quizMeta.raw_text || null,
        total_marks: totalMarks,
        pass_percentage: quizMeta.pass_percentage || 50,
        is_published: quizMeta.is_published ?? true,
        created_by: quizMeta.userId || null
      })
      .select()
      .single();

    if (quizError) throw new Error(quizError.message);

    // 2. Insert Questions and Options
    for (let i = 0; i < parsedQuestions.length; i++) {
      const pq = parsedQuestions[i];

      const { data: qRecord, error: qInsertError } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: newQuiz.id,
          question_number: pq.number || (i + 1),
          question_text: pq.questionText.trim(),
          correct_answer: pq.correctAnswer.trim().toUpperCase(),
          marks: pq.marks || 1,
          explanation: pq.explanation?.trim() || null
        })
        .select()
        .single();

      if (qInsertError) {
        console.error('[LearningService] Failed to insert question:', qInsertError);
        continue;
      }

      // Insert Options
      if (pq.options && pq.options.length > 0) {
        const optionRows = pq.options.map(opt => ({
          question_id: qRecord.id,
          option_key: opt.key.trim().toUpperCase(),
          option_text: opt.text.trim()
        }));

        const { error: optInsertError } = await supabase
          .from('quiz_options')
          .insert(optionRows);

        if (optInsertError) {
          console.error('[LearningService] Failed to insert options:', optInsertError);
        }
      }
    }

    realtimeSync.notifyMutation('quizzes', 'INSERT');
    return newQuiz;
  },

  /**
   * Publish or unpublish a quiz
   */
  async setQuizPublishStatus(quizId: string, isPublished: boolean): Promise<void> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    const { error } = await supabase
      .from('quizzes')
      .update({
        is_published: isPublished,
        updated_at: new Date().toISOString()
      })
      .eq('id', quizId);

    if (error) throw new Error(error.message);

    realtimeSync.notifyMutation('quizzes', 'UPDATE');
  },

  /**
   * Submit student quiz attempt and automatically score it
   */
  async submitQuizAttempt(
    quizId: string,
    courseId: string,
    studentId: string,
    answers: { questionId: string; selectedOption: string }[]
  ): Promise<QuizAttempt> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    // 1. Fetch official questions and answers for accurate scoring
    const { data: questions, error: qError } = await supabase
      .from('quiz_questions')
      .select('id, correct_answer, marks')
      .eq('quiz_id', quizId);

    if (qError || !questions) throw new Error('Could not retrieve quiz questions for grading.');

    const { data: quizMeta } = await supabase
      .from('quizzes')
      .select('pass_percentage, total_marks')
      .eq('id', quizId)
      .single();

    const passPct = quizMeta?.pass_percentage || 50;

    let score = 0;
    let totalMarks = 0;

    const gradedAnswers = questions.map(q => {
      const studentAns = answers.find(a => a.questionId === q.id);
      const selected = (studentAns?.selectedOption || '').trim().toUpperCase();
      const correct = (q.correct_answer || '').trim().toUpperCase();
      const isCorrect = Boolean(selected && selected === correct);
      const marks = q.marks || 1;
      totalMarks += marks;

      const marksAwarded = isCorrect ? marks : 0;
      score += marksAwarded;

      return {
        question_id: q.id,
        selected_option: selected,
        is_correct: isCorrect,
        marks_awarded: marksAwarded
      };
    });

    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passed = percentage >= passPct;

    // 2. Insert quiz attempt
    const { data: attempt, error: attError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        student_id: studentId,
        course_id: courseId,
        score,
        total_marks: totalMarks,
        percentage,
        passed,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attError) throw new Error(attError.message);

    // 3. Insert individual answer rows
    const answerRows = gradedAnswers.map(ga => ({
      attempt_id: attempt.id,
      ...ga
    }));

    await supabase.from('quiz_answers').insert(answerRows);

    realtimeSync.notifyMutation('quiz_attempts', 'INSERT');
    return { ...attempt, answers: gradedAnswers as any };
  },

  /**
   * Get student's past quiz attempts for a course
   */
  async getStudentQuizAttempts(courseId: string, studentId: string): Promise<QuizAttempt[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*, quizzes!quiz_id(title)')
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('[LearningService] Error loading quiz attempts:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      quiz_title: (item as any).quizzes?.title || 'Quiz'
    }));
  },

  /**
   * Teacher view: get student results for a specific quiz
   */
  async getTeacherQuizResults(quizId: string): Promise<QuizAttempt[]> {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('*, profiles!student_id(full_name, email)')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('[LearningService] Error loading quiz results for teacher:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item,
      student_name: (item as any).profiles?.full_name || (item as any).profiles?.email || 'Student'
    }));
  },

  // ====================================================================
  // 5. STUDENT PROGRESS TRACKING
  // ====================================================================

  /**
   * Get student progress for a course
   */
  async getStudentCourseProgress(courseId: string, studentId: string): Promise<{
    courseProgress: StudentCourseProgress | null;
    lessonProgress: StudentLessonProgress[];
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { courseProgress: null, lessonProgress: [] };
    }

    try {
      // Fetch course progress summary
      const { data: cpData } = await supabase
        .from('student_course_progress')
        .select('*')
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .maybeSingle();

      // Fetch lesson progress details
      const { data: lpData } = await supabase
        .from('student_lesson_progress')
        .select('*')
        .eq('course_id', courseId)
        .eq('student_id', studentId);

      return {
        courseProgress: cpData || null,
        lessonProgress: lpData || []
      };
    } catch (e) {
      console.error('[LearningService] Error fetching progress:', e);
      return { courseProgress: null, lessonProgress: [] };
    }
  },

  /**
   * Record lesson completion and trigger atomic course progress calculation
   */
  async recordLessonProgress(courseId: string, lessonId: string, completed: boolean = true): Promise<any> {
    if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');

    try {
      const { data, error } = await supabase.rpc('record_lesson_progress', {
        p_course_id: courseId,
        p_lesson_id: lessonId,
        p_completed: completed
      });

      if (error) {
        console.warn('[LearningService] RPC fallback for progress:', error);
        // Fallback to client-side direct update if RPC is missing
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.id) {
          const studentId = user.user.id;
          await supabase
            .from('student_lesson_progress')
            .upsert({
              student_id: studentId,
              course_id: courseId,
              lesson_id: lessonId,
              is_completed: completed,
              completed_at: completed ? new Date().toISOString() : null,
              last_accessed_at: new Date().toISOString()
            }, { onConflict: 'student_id,lesson_id' });
        }
      }

      realtimeSync.notifyMutation('student_lesson_progress', 'UPDATE');
      realtimeSync.notifyMutation('student_course_progress', 'UPDATE');
      return data;
    } catch (e) {
      console.error('[LearningService] Error recording lesson progress:', e);
      throw e;
    }
  }
};
