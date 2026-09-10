import React, { useState, useEffect, useCallback } from 'react';
import { 
  Course, CourseModule, CourseLesson, LessonMaterial, 
  ClassSession, ClassRecording, Quiz, QuizAttempt, Profile 
} from '../../types';
import { learningService } from '../../services/learningService';
import { realtimeSync } from '../../services/realtimeSync';
import { parseQuizText, ParsedQuestion, QuizParseResult } from '../../lib/quizParser';
import { 
  ChevronLeft, Plus, BookOpen, Video, FileText, CheckCircle, 
  Clock, AlertCircle, Trash2, Edit3, Upload, ExternalLink, 
  Check, Play, Eye, Award, X, Sparkles, HelpCircle, Save, Download
} from 'lucide-react';

interface TeacherCourseWorkspaceProps {
  course: Course;
  currentUser: Profile;
  onBack: () => void;
  scheduleLabel?: string;
  scheduleId?: string;
}

type WorkspaceSubTab = 'curriculum' | 'sessions' | 'quizzes' | 'students';

export const TeacherCourseWorkspace: React.FC<TeacherCourseWorkspaceProps> = ({
  course,
  currentUser,
  onBack,
  scheduleLabel,
  scheduleId
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceSubTab>('curriculum');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Curriculum state
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Module modal state
  const [showModuleModal, setShowModuleModal] = useState<boolean>(false);
  const [moduleTitle, setModuleTitle] = useState<string>('');
  const [moduleDesc, setModuleDesc] = useState<string>('');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState<boolean>(false);

  // Lesson modal state
  const [showLessonModal, setShowLessonModal] = useState<boolean>(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState<string>('');
  const [lessonContent, setLessonContent] = useState<string>('');
  const [lessonDuration, setLessonDuration] = useState<string>('45 mins');
  const [lessonVideoUrl, setLessonVideoUrl] = useState<string>('');
  const [savingLesson, setSavingLesson] = useState<boolean>(false);

  // PDF / Material upload state
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadLessonId, setUploadLessonId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Live Sessions & Recordings state
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<string>('');
  const [sessionEndTime, setSessionEndTime] = useState<string>('');
  const [sessionMeetUrl, setSessionMeetUrl] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [savingSession, setSavingSession] = useState<boolean>(false);

  // Recording Modal state
  const [showRecordingModal, setShowRecordingModal] = useState<boolean>(false);
  const [recTitle, setRecTitle] = useState<string>('');
  const [recUrl, setRecUrl] = useState<string>('');
  const [recDuration, setRecDuration] = useState<string>('1h 15m');
  const [recSessionId, setRecSessionId] = useState<string>('');
  const [savingRecording, setSavingRecording] = useState<boolean>(false);

  // Quizzes state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [showQuizCreator, setShowQuizCreator] = useState<boolean>(false);
  const [quizTitle, setQuizTitle] = useState<string>('');
  const [quizDesc, setQuizDesc] = useState<string>('');
  const [quizRawText, setQuizRawText] = useState<string>('');
  const [parseResult, setParseResult] = useState<QuizParseResult | null>(null);
  const [targetLessonIdForQuiz, setTargetLessonIdForQuiz] = useState<string>('');
  const [savingQuiz, setSavingQuiz] = useState<boolean>(false);
  
  // Quiz results modal
  const [viewingQuizResults, setViewingQuizResults] = useState<Quiz | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState<boolean>(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Load all course data
  const loadCourseData = useCallback(async () => {
    try {
      setLoading(true);
      const [curriculumData, sessionsData, recordingsData, quizzesData] = await Promise.all([
        learningService.getCourseCurriculum(course.id),
        learningService.getClassSessions(course.id),
        learningService.getClassRecordings(course.id),
        learningService.getCourseQuizzes(course.id)
      ]);

      setModules(curriculumData);
      setSessions(sessionsData);
      setRecordings(recordingsData);
      setQuizzes(quizzesData);

      // Auto-expand first module
      if (curriculumData.length > 0) {
        setExpandedModules(prev => ({
          ...prev,
          [curriculumData[0].id]: true
        }));
      }
    } catch (e) {
      console.error('Failed to load workspace data:', e);
      showToast('Error loading course workspace data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    loadCourseData();
    const unsub = realtimeSync.subscribe(() => {
      loadCourseData();
    });
    return () => unsub();
  }, [loadCourseData]);

  // Toggle module expansion
  const toggleModule = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // -------------------------------------------------------------
  // MODULE ACTIONS
  // -------------------------------------------------------------
  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    try {
      setSavingModule(true);
      if (editingModuleId) {
        await learningService.updateModule(editingModuleId, {
          title: moduleTitle,
          description: moduleDesc
        });
        showToast('Module updated successfully.');
      } else {
        await learningService.createModule(course.id, moduleTitle, moduleDesc);
        showToast('New module created.');
      }
      setShowModuleModal(false);
      setModuleTitle('');
      setModuleDesc('');
      setEditingModuleId(null);
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save module', 'error');
    } finally {
      setSavingModule(false);
    }
  };

  const handleDeleteModule = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete module "${title}" and all its lessons?`)) return;
    try {
      await learningService.deleteModule(id);
      showToast('Module deleted.');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete module', 'error');
    }
  };

  // -------------------------------------------------------------
  // LESSON ACTIONS
  // -------------------------------------------------------------
  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    try {
      setSavingLesson(true);
      if (editingLessonId) {
        await learningService.updateLesson(editingLessonId, {
          title: lessonTitle,
          content: lessonContent,
          duration: lessonDuration,
          video_url: lessonVideoUrl
        });
        showToast('Lesson updated.');
      } else if (targetModuleId) {
        await learningService.createLesson(
          targetModuleId,
          lessonTitle,
          lessonContent,
          lessonDuration,
          lessonVideoUrl
        );
        showToast('Lesson added to curriculum.');
      }
      setShowLessonModal(false);
      setLessonTitle('');
      setLessonContent('');
      setLessonDuration('45 mins');
      setLessonVideoUrl('');
      setEditingLessonId(null);
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save lesson', 'error');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (id: string, title: string) => {
    if (!window.confirm(`Delete lesson "${title}"?`)) return;
    try {
      await learningService.deleteLesson(id);
      showToast('Lesson removed.');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete lesson', 'error');
    }
  };

  // -------------------------------------------------------------
  // PDF / MATERIAL UPLOAD
  // -------------------------------------------------------------
  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadLessonId || !selectedFile) {
      showToast('Please select a file to upload.', 'error');
      return;
    }

    try {
      setIsUploading(true);
      await learningService.uploadLessonMaterial(
        course.id,
        uploadLessonId,
        selectedFile,
        materialTitle || selectedFile.name,
        'pdf',
        currentUser.id
      );
      showToast('Learning resource uploaded.');
      setShowUploadModal(false);
      setSelectedFile(null);
      setMaterialTitle('');
      setUploadLessonId(null);
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (matId: string) => {
    if (!window.confirm('Delete this learning resource?')) return;
    try {
      await learningService.deleteLessonMaterial(matId);
      showToast('Resource removed.');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete resource', 'error');
    }
  };

  // -------------------------------------------------------------
  // LIVE SESSIONS & RECORDINGS
  // -------------------------------------------------------------
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionStartTime || !sessionEndTime) {
      showToast('Please provide start and end time.', 'error');
      return;
    }

    try {
      setSavingSession(true);
      await learningService.createClassSession({
        course_id: course.id,
        schedule_id: scheduleId,
        teacher_id: currentUser.id,
        title: sessionTitle || `${course.title} Live Class`,
        start_time: new Date(sessionStartTime).toISOString(),
        end_time: new Date(sessionEndTime).toISOString(),
        meeting_url: sessionMeetUrl,
        notes: sessionNotes
      });
      showToast('Live class session scheduled.');
      setShowSessionModal(false);
      setSessionTitle('');
      setSessionStartTime('');
      setSessionEndTime('');
      setSessionMeetUrl('');
      setSessionNotes('');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule session', 'error');
    } finally {
      setSavingSession(false);
    }
  };

  const handleSaveRecording = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim() || !recUrl.trim()) return;

    try {
      setSavingRecording(true);
      await learningService.createClassRecording({
        course_id: course.id,
        session_id: recSessionId || undefined,
        title: recTitle,
        recording_url: recUrl,
        duration: recDuration,
        userId: currentUser.id
      });
      showToast('Class recording linked.');
      setShowRecordingModal(false);
      setRecTitle('');
      setRecUrl('');
      setRecSessionId('');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to link recording', 'error');
    } finally {
      setSavingRecording(false);
    }
  };

  // -------------------------------------------------------------
  // QUIZ PARSER & PUBLISHING
  // -------------------------------------------------------------
  const handleParseQuiz = () => {
    if (!quizRawText.trim()) {
      showToast('Please paste quiz text first.', 'error');
      return;
    }
    const result = parseQuizText(quizRawText);
    setParseResult(result);
  };

  const handleUpdateParsedQuestion = (index: number, updated: ParsedQuestion) => {
    if (!parseResult) return;
    const newQuestions = [...parseResult.questions];
    newQuestions[index] = updated;

    // re-evaluate errors
    const errorCount = newQuestions.filter(q => q.hasError).length;
    const totalMarks = newQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
    setParseResult({
      questions: newQuestions,
      totalQuestions: newQuestions.length,
      totalMarks,
      hasErrors: errorCount > 0,
      errorCount
    });
  };

  const handlePublishQuiz = async () => {
    if (!quizTitle.trim()) {
      showToast('Please provide a quiz title.', 'error');
      return;
    }
    if (!parseResult || parseResult.questions.length === 0) {
      showToast('Please parse questions before publishing.', 'error');
      return;
    }
    if (parseResult.hasErrors) {
      showToast('Please resolve questions marked with errors before publishing.', 'error');
      return;
    }

    try {
      setSavingQuiz(true);
      await learningService.saveParsedQuiz(
        {
          course_id: course.id,
          title: quizTitle,
          description: quizDesc,
          raw_text: quizRawText,
          lesson_id: targetLessonIdForQuiz || undefined,
          is_published: true,
          userId: currentUser.id
        },
        parseResult.questions
      );
      showToast('Quiz published successfully to student classroom!');
      setShowQuizCreator(false);
      setQuizTitle('');
      setQuizDesc('');
      setQuizRawText('');
      setParseResult(null);
      setTargetLessonIdForQuiz('');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish quiz', 'error');
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleTogglePublish = async (quizId: string, currentStatus: boolean) => {
    try {
      await learningService.setQuizPublishStatus(quizId, !currentStatus);
      showToast(!currentStatus ? 'Quiz published to students.' : 'Quiz unpublished.');
      await loadCourseData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update quiz status', 'error');
    }
  };

  const handleViewQuizResults = async (quiz: Quiz) => {
    setViewingQuizResults(quiz);
    setLoadingAttempts(true);
    try {
      const attempts = await learningService.getTeacherQuizResults(quiz.id);
      setQuizAttempts(attempts);
    } catch (e) {
      console.error('Error loading attempts:', e);
    } finally {
      setLoadingAttempts(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* Top Header */}
      <div className="border-b border-[#EAEAEA] bg-white px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition cursor-pointer"
              title="Return to assigned courses"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[10px] font-bold uppercase tracking-wider">
                  Teaching Workspace
                </span>
                {scheduleLabel && (
                  <span className="text-xs text-zinc-500 font-medium">
                    • {scheduleLabel}
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-zinc-900 mt-0.5">{course.title}</h1>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200">
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'curriculum'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0A9D8F]" />
              <span>Curriculum</span>
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sessions'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-[#0A9D8F]" />
              <span>Live & Recordings</span>
            </button>
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'quizzes'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-[#0A9D8F]" />
              <span>Quizzes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className={`mx-6 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          feedback.type === 'success' 
            ? 'bg-[#E6F5F4] text-[#0A9D8F] border border-[#0A9D8F]/20' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 p-6 max-w-6xl w-full mx-auto">
        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-400">Loading course curriculum...</div>
        ) : (
          <>
            {/* TAB 1: CURRICULUM (MODULES & LESSONS) */}
            {activeTab === 'curriculum' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Curriculum Structure</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Organize modules, add detailed lesson notes, and attach downloadable PDF guides.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingModuleId(null);
                      setModuleTitle('');
                      setModuleDesc('');
                      setShowModuleModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Module</span>
                  </button>
                </div>

                {modules.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-zinc-200 rounded-2xl space-y-3">
                    <BookOpen className="w-10 h-10 text-zinc-300 mx-auto" />
                    <h3 className="text-sm font-semibold text-zinc-800">No modules added yet</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Start building the syllabus by adding Module 1 (e.g. "Introduction to Software Development").
                    </p>
                    <button
                      onClick={() => setShowModuleModal(true)}
                      className="px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-semibold cursor-pointer"
                    >
                      Create First Module
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modules.map((mod, modIndex) => {
                      const isExpanded = !!expandedModules[mod.id];
                      return (
                        <div 
                          key={mod.id} 
                          className="border border-[#EAEAEA] rounded-2xl overflow-hidden bg-white shadow-xs"
                        >
                          {/* Module Header */}
                          <div className="p-4 bg-zinc-50/80 border-b border-[#EAEAEA] flex items-center justify-between">
                            <button
                              onClick={() => toggleModule(mod.id)}
                              className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                            >
                              <span className="w-6 h-6 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-xs font-bold flex items-center justify-center">
                                {modIndex + 1}
                              </span>
                              <div>
                                <h3 className="text-xs font-bold text-zinc-900">{mod.title}</h3>
                                {mod.description && (
                                  <p className="text-[11px] text-zinc-500 line-clamp-1">{mod.description}</p>
                                )}
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-zinc-400">
                                {mod.lessons?.length || 0} lessons
                              </span>
                              <button
                                onClick={() => {
                                  setTargetModuleId(mod.id);
                                  setEditingLessonId(null);
                                  setLessonTitle('');
                                  setLessonContent('');
                                  setLessonDuration('45 mins');
                                  setShowLessonModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#E6F5F4] text-[#0A9D8F] text-xs font-semibold hover:bg-[#0A9D8F] hover:text-white transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add Lesson</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingModuleId(mod.id);
                                  setModuleTitle(mod.title);
                                  setModuleDesc(mod.description || '');
                                  setShowModuleModal(true);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer"
                                title="Edit Module"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteModule(mod.id, mod.title)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                                title="Delete Module"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Lessons List */}
                          {isExpanded && (
                            <div className="divide-y divide-zinc-100 p-2">
                              {(!mod.lessons || mod.lessons.length === 0) ? (
                                <div className="p-4 text-center text-xs text-zinc-400">
                                  No lessons in this module yet. Click "+ Add Lesson" above.
                                </div>
                              ) : (
                                mod.lessons.map((lesson, lIdx) => (
                                  <div key={lesson.id} className="p-3 hover:bg-zinc-50 rounded-xl transition">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start gap-3 flex-1">
                                        <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-500 text-[10px] font-semibold flex items-center justify-center mt-0.5">
                                          {lIdx + 1}
                                        </span>
                                        <div className="space-y-1 flex-1">
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-semibold text-zinc-900">{lesson.title}</h4>
                                            {lesson.duration && (
                                              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {lesson.duration}
                                              </span>
                                            )}
                                          </div>
                                          {lesson.content && (
                                            <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                                              {lesson.content}
                                            </p>
                                          )}

                                          {/* Materials / PDFs list */}
                                          {lesson.materials && lesson.materials.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1.5">
                                              {lesson.materials.map(mat => (
                                                <div 
                                                  key={mat.id} 
                                                  className="flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 rounded-md text-[10px] text-zinc-700"
                                                >
                                                  <FileText className="w-3 h-3 text-[#0A9D8F]" />
                                                  <a 
                                                    href={mat.file_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="hover:underline font-medium truncate max-w-[140px]"
                                                  >
                                                    {mat.title}
                                                  </a>
                                                  <button
                                                    onClick={() => handleDeleteMaterial(mat.id)}
                                                    className="text-zinc-400 hover:text-red-600 p-0.5 cursor-pointer"
                                                    title="Remove PDF"
                                                  >
                                                    <X className="w-2.5 h-2.5" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Lesson Actions */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => {
                                            setUploadLessonId(lesson.id);
                                            setSelectedFile(null);
                                            setMaterialTitle('');
                                            setShowUploadModal(true);
                                          }}
                                          className="px-2 py-1 rounded-md bg-white border border-zinc-200 text-zinc-600 hover:text-[#0A9D8F] text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                          title="Attach PDF Guide"
                                        >
                                          <Upload className="w-3 h-3" />
                                          <span>PDF</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            setTargetModuleId(mod.id);
                                            setEditingLessonId(lesson.id);
                                            setLessonTitle(lesson.title);
                                            setLessonContent(lesson.content || '');
                                            setLessonDuration(lesson.duration || '45 mins');
                                            setLessonVideoUrl(lesson.video_url || '');
                                            setShowLessonModal(true);
                                          }}
                                          className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LIVE SESSIONS & RECORDINGS */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Live Class Sessions & Recordings</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Schedule interactive Google Meet classes and archive recordings for approved students.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSessionModal(true)}
                      className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
                    >
                      <Video className="w-4 h-4" />
                      <span>Schedule Live Session</span>
                    </button>
                    <button
                      onClick={() => setShowRecordingModal(true)}
                      className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      <span>Attach Recording</span>
                    </button>
                  </div>
                </div>

                {/* Sessions List */}
                <div className="border border-[#EAEAEA] rounded-2xl p-5 bg-white space-y-4">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Scheduled Live Sessions</h3>
                  {sessions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No live sessions scheduled yet for this course.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(s => (
                        <div key={s.id} className="p-3 border border-zinc-200 rounded-xl flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#0A9D8F]"></span>
                              <h4 className="text-xs font-bold text-zinc-900">{s.title || 'Live Class Session'}</h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 font-medium">
                                {s.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-1">
                              {new Date(s.start_time).toLocaleString(undefined, { 
                                dateStyle: 'medium', 
                                timeStyle: 'short' 
                              })}
                            </p>
                          </div>
                          {s.meeting_url && (
                            <a
                              href={s.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-[#E6F5F4] text-[#0A9D8F] hover:bg-[#0A9D8F] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Open Meet</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recordings List */}
                <div className="border border-[#EAEAEA] rounded-2xl p-5 bg-white space-y-4">
                  <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Class Recordings Library</h3>
                  {recordings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-400">
                      No class recordings attached yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {recordings.map(rec => (
                        <div key={rec.id} className="p-3.5 border border-zinc-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-900">{rec.title}</h4>
                            {rec.duration && (
                              <span className="text-[10px] text-zinc-400 font-medium">{rec.duration}</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Recorded on {new Date(rec.recorded_at).toLocaleDateString()}
                          </p>
                          <a
                            href={rec.recording_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A9D8F] hover:underline pt-1"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Watch Recording</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: QUIZZES (TEXT PARSER, PREVIEW & RESULTS) */}
            {activeTab === 'quizzes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Quizzes & Assessment Builder</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Paste full quizzes in text format. Our parser extracts questions, options, and answers automatically.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowQuizCreator(true);
                      setParseResult(null);
                      setQuizRawText(`1. What does HTML stand for?

A. Hyper Text Markup Language
B. High Text Machine Language
C. Hyperlink Text Management Language
D. Home Tool Markup Language

Answer: A
Marks: 2

2. Which CSS property is used to change the background color?

A. color
B. bgcolor
C. background-color
D. background-image

Answer: C
Marks: 2`);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Quiz with Text Parser</span>
                  </button>
                </div>

                {quizzes.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-zinc-200 rounded-2xl space-y-3">
                    <Award className="w-10 h-10 text-zinc-300 mx-auto" />
                    <h3 className="text-sm font-semibold text-zinc-800">No quizzes created yet</h3>
                    <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                      Use the Text Parser to quickly convert pasted question text into structured, auto-graded student quizzes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizzes.map(q => (
                      <div key={q.id} className="p-4 border border-[#EAEAEA] rounded-2xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-zinc-900">{q.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              q.is_published 
                                ? 'bg-[#E6F5F4] text-[#0A9D8F]' 
                                : 'bg-zinc-100 text-zinc-500'
                            }`}>
                              {q.is_published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1">
                            Total Marks: {q.total_marks} • Pass Mark: {q.pass_percentage}%
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewQuizResults(q)}
                            className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold text-zinc-700 flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Student Scores</span>
                          </button>
                          <button
                            onClick={() => handleTogglePublish(q.id, q.is_published)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              q.is_published
                                ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                : 'bg-[#0A9D8F] text-white hover:bg-[#087A6F]'
                            }`}
                          >
                            {q.is_published ? 'Unpublish' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================= */}
      {/* MODAL: ADD / EDIT MODULE */}
      {/* ============================================================= */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingModuleId ? 'Edit Module' : 'Create Course Module'}
              </h3>
              <button 
                onClick={() => setShowModuleModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 1: HTML Fundamentals"
                  value={moduleTitle}
                  onChange={e => setModuleTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief summary of what this module covers..."
                  value={moduleDesc}
                  onChange={e => setModuleDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingModule}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingModule ? 'Saving...' : 'Save Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ADD / EDIT LESSON */}
      {/* ============================================================= */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingLessonId ? 'Edit Lesson' : 'Add Lesson to Module'}
              </h3>
              <button 
                onClick={() => setShowLessonModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Lesson Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lesson 1: Understanding Elements & Attributes"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Estimated Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 45 mins"
                    value={lessonDuration}
                    onChange={e => setLessonDuration(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Video Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="e.g. https://..."
                    value={lessonVideoUrl}
                    onChange={e => setLessonVideoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Lesson Content / Notes</label>
                <textarea
                  rows={5}
                  placeholder="Provide structured notes, key concept explanations, or code snippets for students..."
                  value={lessonContent}
                  onChange={e => setLessonContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLesson}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingLesson ? 'Saving...' : 'Save Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: UPLOAD PDF RESOURCE */}
      {/* ============================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Upload PDF / Learning Resource</h3>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadMaterial} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Resource Title</label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 1 Lab Guide & Reference"
                  value={materialTitle}
                  onChange={e => setMaterialTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Select PDF File</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx"
                  required
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      if (!materialTitle) setMaterialTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? 'Uploading to Storage...' : 'Upload Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: SCHEDULE LIVE SESSION */}
      {/* ============================================================= */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Schedule Live Class Session</h3>
              <button 
                onClick={() => setShowSessionModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Session Title</label>
                <input
                  type="text"
                  placeholder="e.g. Week 2 Live Coding Lab"
                  value={sessionTitle}
                  onChange={e => setSessionTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionStartTime}
                    onChange={e => setSessionStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={sessionEndTime}
                    onChange={e => setSessionEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Google Meet Link</label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  value={sessionMeetUrl}
                  onChange={e => setSessionMeetUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSession}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingSession ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: ATTACH RECORDING */}
      {/* ============================================================= */}
      {showRecordingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900">Attach Live Class Recording</h3>
              <button 
                onClick={() => setShowRecordingModal(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecording} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Recording Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Session 3 Recording: Responsive Design Deep Dive"
                  value={recTitle}
                  onChange={e => setRecTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Video / Recording URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... or https://youtube.com/..."
                  value={recUrl}
                  onChange={e => setRecUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 1h 20m"
                  value={recDuration}
                  onChange={e => setRecDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecordingModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecording}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingRecording ? 'Saving...' : 'Save Recording'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: QUIZ CREATOR WITH TEXT PARSER & PREVIEW */}
      {/* ============================================================= */}
      {showQuizCreator && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Quiz Creator & Intelligent Parser</h3>
                <p className="text-[11px] text-zinc-500">
                  Paste entire quiz text. The parser will automatically extract questions, choices, answers, and marks.
                </p>
              </div>
              <button 
                onClick={() => setShowQuizCreator(false)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Quiz Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Module 1 Knowledge Check"
                    value={quizTitle}
                    onChange={e => setQuizTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Attach to Lesson (Optional)</label>
                  <select
                    value={targetLessonIdForQuiz}
                    onChange={e => setTargetLessonIdForQuiz(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-xl focus:outline-none"
                  >
                    <option value="">Course Level (General Quiz)</option>
                    {modules.map(m => (
                      <optgroup key={m.id} label={m.title}>
                        {m.lessons?.map(l => (
                          <option key={l.id} value={l.id}>{l.title}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Raw Text Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700">Paste Full Quiz Text</label>
                  <button
                    type="button"
                    onClick={handleParseQuiz}
                    className="px-3 py-1 rounded-lg bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Parse Quiz Text</span>
                  </button>
                </div>
                <textarea
                  rows={8}
                  placeholder={`1. What does HTML stand for?

A. Hyper Text Markup Language
B. High Text Machine Language
C. Hyperlink Text Management Language
D. Home Tool Markup Language

Answer: A
Marks: 2`}
                  value={quizRawText}
                  onChange={e => setQuizRawText(e.target.value)}
                  className="w-full font-mono text-xs p-3 border border-zinc-300 rounded-xl focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              {/* PARSER PREVIEW & EDIT SECTION */}
              {parseResult && (
                <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">
                        Parsed Preview ({parseResult.totalQuestions} questions detected)
                      </h4>
                      <p className="text-[10px] text-zinc-500">
                        Total Marks: {parseResult.totalMarks} • Review each question before publishing.
                      </p>
                    </div>

                    {parseResult.hasErrors ? (
                      <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{parseResult.errorCount} question(s) need attention</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Ready to Publish</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {parseResult.questions.map((q, qIndex) => (
                      <div 
                        key={q.id} 
                        className={`p-3.5 rounded-xl border bg-white space-y-2 ${
                          q.hasError ? 'border-red-300 ring-1 ring-red-200' : 'border-zinc-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-zinc-100 text-zinc-800 text-[10px] font-bold flex items-center justify-center">
                              {q.number}
                            </span>
                            <span className="text-xs font-semibold text-zinc-900">{q.questionText}</span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md shrink-0">
                            {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>
                        </div>

                        {q.hasError && (
                          <div className="p-2 bg-red-50 text-red-700 rounded-lg text-[10px] font-medium flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{q.errorMessage}</span>
                          </div>
                        )}

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options.map(opt => {
                            const isCorrect = opt.key.toUpperCase() === q.correctAnswer.toUpperCase();
                            return (
                              <div 
                                key={opt.key}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-2 border ${
                                  isCorrect 
                                    ? 'bg-[#E6F5F4] border-[#0A9D8F] text-[#087A6F] font-semibold' 
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${
                                  isCorrect ? 'bg-[#0A9D8F] text-white' : 'bg-zinc-200 text-zinc-700'
                                }`}>
                                  {opt.key}
                                </span>
                                <span className="truncate">{opt.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuizCreator(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingQuiz || !parseResult || parseResult.questions.length === 0 || parseResult.hasErrors}
                  onClick={handlePublishQuiz}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-[#0A9D8F] hover:bg-[#087A6F] rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {savingQuiz ? 'Publishing...' : 'Publish Quiz'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: QUIZ RESULTS / STUDENT SCORES */}
      {/* ============================================================= */}
      {viewingQuizResults && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">{viewingQuizResults.title} - Results</h3>
                <p className="text-[11px] text-zinc-500">Student scores and submission timestamps</p>
              </div>
              <button 
                onClick={() => setViewingQuizResults(null)}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAttempts ? (
              <div className="p-8 text-center text-xs text-zinc-400">Loading student scores...</div>
            ) : quizAttempts.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No student submissions for this quiz yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {quizAttempts.map(att => (
                  <div key={att.id} className="p-3 border border-zinc-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900">{att.student_name}</h4>
                      <p className="text-[10px] text-zinc-400">
                        {new Date(att.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold ${att.passed ? 'text-[#0A9D8F]' : 'text-red-600'}`}>
                        {att.score} / {att.total_marks} ({att.percentage}%)
                      </span>
                      <p className="text-[10px] font-semibold text-zinc-500">
                        {att.passed ? 'Passed' : 'Needs Review'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
