import React, { useState, useEffect, useCallback } from 'react';
import { 
  Course, CourseModule, CourseLesson, LessonMaterial, 
  ClassRecording, Quiz, QuizAttempt, Profile, 
  StudentCourseProgress, StudentLessonProgress 
} from '../../types';
import { learningService } from '../../services/learningService';
import { realtimeSync } from '../../services/realtimeSync';
import { 
  ChevronLeft, BookOpen, CheckCircle, Clock, FileText, 
  Play, Download, ExternalLink, Award, Check, AlertCircle, 
  ChevronRight, ArrowRight, ArrowLeft, Video, HelpCircle, X 
} from 'lucide-react';

interface StudentCourseDashboardProps {
  course: Course;
  currentUser: Profile;
  onBack: () => void;
  onOpenClassroom: () => void;
}

export const StudentCourseDashboard: React.FC<StudentCourseDashboardProps> = ({
  course,
  currentUser,
  onBack,
  onOpenClassroom
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [courseProgress, setCourseProgress] = useState<StudentCourseProgress | null>(null);
  const [lessonProgressList, setLessonProgressList] = useState<StudentLessonProgress[]>([]);

  // Selected Active Lesson Viewer state
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [activeModuleTitle, setActiveModuleTitle] = useState<string>('');
  const [isUpdatingProgress, setIsUpdatingProgress] = useState<boolean>(false);

  // Active Quiz taking state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<QuizAttempt | null>(null);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load course curriculum and student progress
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [curriculum, progressData, recordingsData] = await Promise.all([
        learningService.getCourseCurriculum(course.id),
        learningService.getStudentCourseProgress(course.id, currentUser.id),
        learningService.getClassRecordings(course.id)
      ]);

      setModules(curriculum);
      setCourseProgress(progressData.courseProgress);
      setLessonProgressList(progressData.lessonProgress);
      setRecordings(recordingsData);

      // If no active lesson is selected, resume at last accessed lesson or first lesson
      if (!activeLesson && curriculum.length > 0) {
        const flatLessons = curriculum.flatMap(m => m.lessons || []);
        if (flatLessons.length > 0) {
          const lastId = progressData.courseProgress?.last_lesson_id;
          const target = flatLessons.find(l => l.id === lastId) || flatLessons[0];
          const parentMod = curriculum.find(m => m.lessons?.some(l => l.id === target.id));
          setActiveLesson(target);
          setActiveModuleTitle(parentMod?.title || '');
        }
      }
    } catch (e) {
      console.error('Failed to load student course dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [course.id, currentUser.id]);

  useEffect(() => {
    loadDashboardData();
    const unsub = realtimeSync.subscribe(() => {
      loadDashboardData();
    });
    return () => unsub();
  }, [loadDashboardData]);

  // Check if a lesson is completed
  const isLessonCompleted = (lessonId: string): boolean => {
    return lessonProgressList.some(lp => lp.lesson_id === lessonId && lp.is_completed);
  };

  // Select a lesson to view
  const handleSelectLesson = (lesson: CourseLesson, moduleTitle: string) => {
    setActiveLesson(lesson);
    setActiveModuleTitle(moduleTitle);
    setActiveQuiz(null);
    setQuizResult(null);
  };

  // Mark active lesson as completed
  const handleToggleCompleteLesson = async () => {
    if (!activeLesson) return;

    try {
      setIsUpdatingProgress(true);
      const currentlyDone = isLessonCompleted(activeLesson.id);
      const willBeDone = !currentlyDone;

      await learningService.recordLessonProgress(course.id, activeLesson.id, willBeDone);

      // Update local state instantly
      setLessonProgressList(prev => {
        const exists = prev.find(p => p.lesson_id === activeLesson.id);
        if (exists) {
          return prev.map(p => p.lesson_id === activeLesson.id ? { ...p, is_completed: willBeDone } : p);
        } else {
          return [...prev, {
            id: 'temp',
            student_id: currentUser.id,
            course_id: course.id,
            lesson_id: activeLesson.id,
            is_completed: willBeDone,
            last_accessed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }];
        }
      });

      showToast(willBeDone ? 'Lesson marked as completed!' : 'Lesson status updated.');
      await loadDashboardData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update progress');
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Resume / Continue Learning action
  const handleContinueLearning = () => {
    const flatLessons = modules.flatMap(m => (m.lessons || []).map(l => ({ ...l, modTitle: m.title })));
    if (flatLessons.length === 0) return;

    // Find first uncompleted lesson
    const uncompleted = flatLessons.find(l => !isLessonCompleted(l.id));
    const target = uncompleted || flatLessons[0];
    setActiveLesson(target);
    setActiveModuleTitle(target.modTitle);
    setActiveQuiz(null);
    setQuizResult(null);
  };

  // Next & Previous Lesson Navigation
  const flatLessonsList = modules.flatMap(m => (m.lessons || []).map(l => ({ ...l, modTitle: m.title })));
  const currentLessonIndex = flatLessonsList.findIndex(l => l.id === activeLesson?.id);
  const prevLesson = currentLessonIndex > 0 ? flatLessonsList[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < flatLessonsList.length - 1 ? flatLessonsList[currentLessonIndex + 1] : null;

  // Start Quiz
  const handleStartQuiz = async (quizId: string) => {
    try {
      const fullQuiz = await learningService.getQuizDetails(quizId);
      if (fullQuiz) {
        setActiveQuiz(fullQuiz);
        setQuizQuestionIndex(0);
        setSelectedAnswers({});
        setQuizResult(null);
      }
    } catch (e) {
      showToast('Could not load quiz details.');
    }
  };

  // Submit Quiz
  const handleSubmitQuiz = async () => {
    if (!activeQuiz || !activeQuiz.questions) return;

    try {
      setSubmittingQuiz(true);
      const answerPayload = activeQuiz.questions.map(q => ({
        questionId: q.id,
        selectedOption: selectedAnswers[q.id] || ''
      }));

      const result = await learningService.submitQuizAttempt(
        activeQuiz.id,
        course.id,
        currentUser.id,
        answerPayload
      );

      setQuizResult(result);

      // If passed, auto-complete current lesson if attached
      if (result.passed && activeLesson) {
        await learningService.recordLessonProgress(course.id, activeLesson.id, true);
        await loadDashboardData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to submit quiz.');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Calculate actual percentage from database or lessons count
  const totalLessonsCount = flatLessonsList.length;
  const completedLessonsCount = flatLessonsList.filter(l => isLessonCompleted(l.id)).length;
  const realPercentage = totalLessonsCount > 0 
    ? Math.round((completedLessonsCount / totalLessonsCount) * 100) 
    : 0;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* Course Top Header */}
      <div className="border-b border-[#EAEAEA] bg-white px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
              title="Return to My Learning"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A9D8F]">
                {course.category || 'Approved Course'}
              </span>
              <h1 className="text-base font-bold text-zinc-900">{course.title}</h1>
            </div>
          </div>

          {/* Quick Actions & Progress Summary */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenClassroom}
              className="px-4 py-2 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] hover:bg-[#0A9D8F] hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Enter Classroom</span>
            </button>
            <button
              onClick={handleContinueLearning}
              className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Continue Learning</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="mx-6 mt-4 p-3 rounded-xl text-xs font-semibold bg-[#E6F5F4] text-[#0A9D8F] border border-[#0A9D8F]/20 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[#0A9D8F]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Learning Platform Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CURRICULUM SYLLABUS (Cols 1-4) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Progress Card */}
          <div className="p-4 border border-[#EAEAEA] rounded-2xl bg-zinc-50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700">Course Progress</span>
              <span className="font-bold text-[#0A9D8F]">{realPercentage}% Complete</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#0A9D8F] transition-all duration-500 rounded-full"
                style={{ width: `${realPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span>{completedLessonsCount} of {totalLessonsCount} lessons done</span>
              <span>{course.duration || '8 Weeks'}</span>
            </div>
          </div>

          {/* Module & Lessons List */}
          <div className="border border-[#EAEAEA] rounded-2xl bg-white overflow-hidden divide-y divide-zinc-100">
            <div className="p-3 bg-zinc-50 font-bold text-xs text-zinc-900 uppercase tracking-wider">
              Course Curriculum
            </div>

            {modules.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400">
                Course lessons are being prepared by your instructor.
              </div>
            ) : (
              modules.map((mod, mIdx) => (
                <div key={mod.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-800">
                      Module {mIdx + 1}: {mod.title}
                    </h3>
                    <span className="text-[10px] text-zinc-400">
                      {mod.lessons?.length || 0} lessons
                    </span>
                  </div>

                  {/* Lessons */}
                  <div className="space-y-1 pl-1">
                    {mod.lessons?.map((lesson, lIdx) => {
                      const isSelected = activeLesson?.id === lesson.id;
                      const completed = isLessonCompleted(lesson.id);

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => handleSelectLesson(lesson, mod.title)}
                          className={`w-full p-2.5 rounded-xl text-left text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected 
                              ? 'bg-[#E6F5F4] text-[#0A9D8F] font-bold border border-[#0A9D8F]/30' 
                              : 'hover:bg-zinc-50 text-zinc-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                              completed 
                                ? 'bg-[#0A9D8F] text-white' 
                                : 'border border-zinc-300 text-zinc-400'
                            }`}>
                              {completed ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : (lIdx + 1)}
                            </span>
                            <span className="truncate">{lesson.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-400">
                            {lesson.materials && lesson.materials.length > 0 && (
                              <FileText className="w-3 h-3 text-[#0A9D8F]" title="PDF Material attached" />
                            )}
                            {lesson.quizzes && lesson.quizzes.length > 0 && (
                              <Award className="w-3 h-3 text-amber-500" title="Quiz attached" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past Live Class Recordings Library */}
          {recordings.length > 0 && (
            <div className="border border-[#EAEAEA] rounded-2xl p-4 bg-white space-y-3">
              <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#0A9D8F]" />
                <span>Class Recordings</span>
              </h3>
              <div className="space-y-2">
                {recordings.map(rec => (
                  <a
                    key={rec.id}
                    href={rec.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-zinc-200 hover:border-[#0A9D8F] flex items-center justify-between text-xs text-zinc-700 hover:text-[#0A9D8F] transition group"
                  >
                    <div className="truncate pr-2">
                      <p className="font-semibold truncate">{rec.title}</p>
                      <p className="text-[10px] text-zinc-400">{rec.duration || 'Session Video'}</p>
                    </div>
                    <Play className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#0A9D8F] shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ACTIVE LESSON VIEWER & QUIZ EXPERIENCE (Cols 5-12) */}
        <div className="lg:col-span-8 space-y-6">
          {activeQuiz ? (
            /* ACTIVE QUIZ EXPERIENCE */
            <div className="border border-[#EAEAEA] rounded-3xl p-6 sm:p-8 bg-white space-y-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A9D8F]">
                    Knowledge Assessment
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900">{activeQuiz.title}</h2>
                  <p className="text-xs text-zinc-500">Passing score requirement: {activeQuiz.pass_percentage}%</p>
                </div>
                <button
                  onClick={() => {
                    setActiveQuiz(null);
                    setQuizResult(null);
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {quizResult ? (
                /* QUIZ RESULT REPORT */
                <div className="space-y-6 text-center py-6">
                  <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
                    quizResult.passed ? 'bg-[#E6F5F4] text-[#0A9D8F]' : 'bg-red-50 text-red-600'
                  }`}>
                    {quizResult.passed ? <CheckCircle className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-zinc-900">
                      {quizResult.passed ? 'Assessment Passed!' : 'Need More Practice'}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      You scored {quizResult.score} out of {quizResult.total_marks} ({quizResult.percentage}%).
                    </p>
                  </div>

                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleStartQuiz(activeQuiz.id)}
                      className="px-5 py-2.5 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                    >
                      Retake Quiz
                    </button>
                    <button
                      onClick={() => {
                        setActiveQuiz(null);
                        setQuizResult(null);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-semibold hover:bg-[#087A6F] cursor-pointer"
                    >
                      Return to Lesson
                    </button>
                  </div>
                </div>
              ) : (
                /* QUIZ QUESTION RUNNER */
                activeQuiz.questions && activeQuiz.questions.length > 0 && (
                  <div className="space-y-6">
                    {(() => {
                      const currentQ = activeQuiz.questions[quizQuestionIndex];
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
                            <span>Question {quizQuestionIndex + 1} of {activeQuiz.questions.length}</span>
                            <span>{currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}</span>
                          </div>

                          <h3 className="text-sm font-bold text-zinc-900 leading-relaxed">
                            {currentQ.question_text}
                          </h3>

                          {/* Options */}
                          <div className="space-y-2 pt-2">
                            {currentQ.options?.map(opt => {
                              const isSelected = selectedAnswers[currentQ.id] === opt.option_key;
                              return (
                                <button
                                  key={opt.id}
                                  onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: opt.option_key }))}
                                  className={`w-full p-3.5 rounded-2xl border text-left text-xs transition flex items-center gap-3 cursor-pointer ${
                                    isSelected
                                      ? 'border-[#0A9D8F] bg-[#E6F5F4] text-[#087A6F] font-semibold ring-1 ring-[#0A9D8F]'
                                      : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-800'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-[#0A9D8F] text-white' : 'bg-zinc-100 text-zinc-600'
                                  }`}>
                                    {opt.option_key}
                                  </span>
                                  <span className="flex-1">{opt.option_text}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Quiz Navigation */}
                          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                            <button
                              disabled={quizQuestionIndex === 0}
                              onClick={() => setQuizQuestionIndex(prev => Math.max(0, prev - 1))}
                              className="px-4 py-2 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              <span>Previous</span>
                            </button>

                            {quizQuestionIndex < activeQuiz.questions.length - 1 ? (
                              <button
                                onClick={() => setQuizQuestionIndex(prev => prev + 1)}
                                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                              >
                                <span>Next</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                disabled={submittingQuiz}
                                onClick={handleSubmitQuiz}
                                className="px-6 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm"
                              >
                                {submittingQuiz ? 'Grading...' : 'Submit Quiz'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )
              )}
            </div>
          ) : activeLesson ? (
            /* ACTIVE LESSON VIEWER */
            <div className="border border-[#EAEAEA] rounded-3xl p-6 sm:p-8 bg-white space-y-6 shadow-xs">
              {/* Module breadcrumb & completion button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A9D8F]">
                    {activeModuleTitle}
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900 mt-0.5">{activeLesson.title}</h2>
                  {activeLesson.duration && (
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {activeLesson.duration}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleToggleCompleteLesson}
                  disabled={isUpdatingProgress}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isLessonCompleted(activeLesson.id)
                      ? 'bg-[#E6F5F4] text-[#0A9D8F] border border-[#0A9D8F]/30 hover:bg-[#d6f0ee]'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                  }`}
                >
                  <CheckCircle className={`w-4 h-4 ${isLessonCompleted(activeLesson.id) ? 'text-[#0A9D8F]' : 'text-zinc-400'}`} />
                  <span>{isLessonCompleted(activeLesson.id) ? 'Completed' : 'Mark as Complete'}</span>
                </button>
              </div>

              {/* Lesson Video URL if present */}
              {activeLesson.video_url && (
                <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-950 p-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Video className="w-6 h-6 text-[#0A9D8F]" />
                    <div>
                      <h4 className="text-xs font-bold">Lesson Video Recording</h4>
                      <p className="text-[10px] text-zinc-400">Class presentation and walkthrough</p>
                    </div>
                  </div>
                  <a
                    href={activeLesson.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#087A6F] transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch</span>
                  </a>
                </div>
              )}

              {/* Lesson Text Content / Notes */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Lesson Notes</h3>
                {activeLesson.content ? (
                  <div className="prose prose-sm max-w-none text-xs text-zinc-700 leading-relaxed bg-zinc-50/70 p-5 rounded-2xl border border-zinc-100 whitespace-pre-line">
                    {activeLesson.content}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No written notes provided for this lesson.</p>
                )}
              </div>

              {/* PDF Materials & Resources */}
              {activeLesson.materials && activeLesson.materials.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0A9D8F]" />
                    <span>Downloadable Learning Resources & PDFs</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeLesson.materials.map(mat => (
                      <div 
                        key={mat.id}
                        className="p-3.5 rounded-2xl border border-zinc-200 hover:border-[#0A9D8F] bg-white flex items-center justify-between gap-3 transition"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-4 h-4 text-[#0A9D8F] shrink-0" />
                          <div className="truncate">
                            <h4 className="text-xs font-semibold text-zinc-900 truncate">{mat.title}</h4>
                            <span className="text-[10px] text-zinc-400 uppercase">{mat.file_type}</span>
                          </div>
                        </div>
                        <a
                          href={mat.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-[#0A9D8F] hover:text-white text-zinc-700 text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lesson Quizzes */}
              {activeLesson.quizzes && activeLesson.quizzes.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#0A9D8F]" />
                    <span>Lesson Assessment</span>
                  </h3>
                  <div className="space-y-2">
                    {activeLesson.quizzes.map(quiz => (
                      <div 
                        key={quiz.id}
                        className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-4"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900">{quiz.title}</h4>
                          <p className="text-[10px] text-zinc-500">
                            Total Marks: {quiz.total_marks} • Pass: {quiz.pass_percentage}%
                          </p>
                        </div>
                        <button
                          onClick={() => handleStartQuiz(quiz.id)}
                          className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Take Quiz</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Previous / Next Lesson Navigation Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-zinc-100">
                {prevLesson ? (
                  <button
                    onClick={() => handleSelectLesson(prevLesson, prevLesson.modTitle)}
                    className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Previous: {prevLesson.title}</span>
                  </button>
                ) : <div />}

                {nextLesson && (
                  <button
                    onClick={() => handleSelectLesson(nextLesson, nextLesson.modTitle)}
                    className="flex items-center gap-2 text-xs font-semibold text-[#0A9D8F] hover:text-[#087A6F] cursor-pointer"
                  >
                    <span>Next: {nextLesson.title}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-200 rounded-3xl p-12 text-center text-zinc-400 text-xs">
              Select a lesson from the curriculum on the left to begin learning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
