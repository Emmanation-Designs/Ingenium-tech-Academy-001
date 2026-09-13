import React, { useState, useEffect, useRef } from 'react';
import { Course, CourseSchedule, ClassSession, Profile, CourseLesson, CourseModule, ClassRecording, Quiz, LessonMaterial } from '../../types';
import { learningService } from '../../services/learningService';
import { dataService } from '../../services/dataService';
import { realtimeSync } from '../../services/realtimeSync';
import { BrandLogo } from '../common/BrandLogo';
import { InAppClassroom } from './InAppClassroom';
import { ClassRecordingView } from './ClassRecordingView';
import { LessonContentView } from './LessonContentView';
import { QuizStudentView } from './QuizStudentView';
import { CourseProgressView } from './CourseProgressView';
import { 
  Video, Clock, Calendar, AlertCircle, CheckCircle, 
  ExternalLink, Bell, ChevronRight, Copy, Check, 
  Play, BookOpen, Layers, X, Award
} from 'lucide-react';

interface StudentClassroomProps {
  currentUser: Profile;
  approvedCourses: Course[];
  activeSchedules: CourseSchedule[];
  onOpenCourse: (course: Course) => void;
}

interface CourseProgressSummary {
  course: Course;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  nextLesson?: CourseLesson | null;
  nextModule?: CourseModule | null;
}

export const StudentClassroom: React.FC<StudentClassroomProps> = ({
  currentUser,
  approvedCourses,
  activeSchedules,
  onOpenCourse
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);

  // Real Sessions State
  const [activeLiveSession, setActiveLiveSession] = useState<{
    session: ClassSession;
    course: Course;
    teacherName: string;
    meetingUrl: string;
    timeText: string;
  } | null>(null);

  const [activeUpcomingSession, setActiveUpcomingSession] = useState<{
    session: ClassSession;
    course: Course;
    teacherName: string;
    timeText: string;
    startsInText: string;
  } | null>(null);

  // Real Progress summaries for each approved course
  const [courseSummaries, setCourseSummaries] = useState<CourseProgressSummary[]>([]);

  // Sub-view drilldown state (driven by real database records)
  const [activeSubView, setActiveSubView] = useState<
    'main' | 'in-app' | 'recordings' | 'lesson' | 'quiz' | 'progress'
  >('main');

  const [inAppTargetSession, setInAppTargetSession] = useState<{
    session: ClassSession;
    course: Course;
    teacherName?: string;
    meetingUrl?: string;
  } | null>(null);

  const [selectedCourseForSubView, setSelectedCourseForSubView] = useState<Course | null>(null);
  const [selectedLessonForSubView, setSelectedLessonForSubView] = useState<CourseLesson | null>(null);
  const [selectedModuleForSubView, setSelectedModuleForSubView] = useState<CourseModule | null>(null);
  const [selectedQuizForSubView, setSelectedQuizForSubView] = useState<Quiz | null>(null);
  const [courseRecordings, setCourseRecordings] = useState<ClassRecording[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<LessonMaterial[]>([]);

  // Format date helper
  const formatSessionTime = (startTimeStr: string, endTimeStr: string) => {
    try {
      const start = new Date(startTimeStr);
      const end = new Date(endTimeStr);
      const datePart = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const startTimePart = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const endTimePart = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart} • ${startTimePart} - ${endTimePart}`;
    } catch {
      return '';
    }
  };

  const calculateStartsIn = (startTimeStr: string) => {
    try {
      const now = Date.now();
      const start = new Date(startTimeStr).getTime();
      const diffMs = start - now;
      if (diffMs <= 0) return 'Starting now';

      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        const remHours = diffHours % 24;
        return `Starts in ${diffDays}d ${remHours}h`;
      }
      if (diffHours > 0) {
        const remMins = diffMins % 60;
        return `Starts in ${diffHours}h ${remMins}m`;
      }
      return `Starts in ${diffMins}m`;
    } catch {
      return '';
    }
  };

  const hasLoadedOnce = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);

  // Load real data from Supabase
  const loadClassroomData = async (isBackground = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      // Only show full loading spinner if this is the initial load and we don't have data yet
      if (!isBackground && !hasLoadedOnce.current) {
        setLoading(true);
      }

      if (approvedCourses.length === 0) {
        setActiveLiveSession(null);
        setActiveUpcomingSession(null);
        setCourseSummaries([]);
        hasLoadedOnce.current = true;
        setLoading(false);
        return;
      }

      // 1. Fetch real sessions for all approved courses
      const sessionLists = await Promise.all(
        approvedCourses.map(c => learningService.getClassSessions(c.id))
      );
      const allSessions = sessionLists.flat();

      const now = new Date();
      let liveMatch: typeof activeLiveSession = null;
      let upcomingCandidates: { session: ClassSession; course: Course; startMs: number }[] = [];

      for (const session of allSessions) {
        const course = approvedCourses.find(c => c.id === session.course_id);
        if (!course) continue;

        const startTime = new Date(session.start_time);
        const endTime = new Date(session.end_time);
        const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000);
        const windowEnd = new Date(endTime.getTime() + 30 * 60 * 1000);

        // Check if currently live
        if (now >= windowStart && now <= windowEnd) {
          // Resolve teacher name
          let teacherName = 'Assigned Instructor';
          if (session.teacher_id) {
            const profile = await dataService.auth.getProfileForUser(session.teacher_id);
            if (profile?.full_name) teacherName = profile.full_name;
          }

          // Resolve meeting URL
          const meetingRes = await dataService.teachers.getStudentMeetingUrl(
            session.schedule_id,
            session.id
          );
          const meetingUrl = (meetingRes.accessible && meetingRes.meeting_url) 
            ? meetingRes.meeting_url 
            : (session.meeting_url || '');

          liveMatch = {
            session,
            course,
            teacherName,
            meetingUrl,
            timeText: formatSessionTime(session.start_time, session.end_time)
          };
          break; // Found live session
        }

        // Check if upcoming
        if (startTime.getTime() > now.getTime()) {
          upcomingCandidates.push({
            session,
            course,
            startMs: startTime.getTime()
          });
        }
      }

      setActiveLiveSession(liveMatch);

      // If no live session, check for earliest upcoming session
      if (!liveMatch && upcomingCandidates.length > 0) {
        upcomingCandidates.sort((a, b) => a.startMs - b.startMs);
        const earliest = upcomingCandidates[0];

        let teacherName = 'Assigned Instructor';
        if (earliest.session.teacher_id) {
          const profile = await dataService.auth.getProfileForUser(earliest.session.teacher_id);
          if (profile?.full_name) teacherName = profile.full_name;
        }

        setActiveUpcomingSession({
          session: earliest.session,
          course: earliest.course,
          teacherName,
          timeText: formatSessionTime(earliest.session.start_time, earliest.session.end_time),
          startsInText: calculateStartsIn(earliest.session.start_time)
        });
      } else {
        setActiveUpcomingSession(null);
      }

      // 2. Compute real course summaries & progress for all approved courses
      const summaries: CourseProgressSummary[] = [];
      for (const course of approvedCourses) {
        const [curriculum, progressData] = await Promise.all([
          learningService.getCourseCurriculum(course.id),
          learningService.getStudentCourseProgress(course.id, currentUser.id)
        ]);

        const flatLessons = curriculum.flatMap(m => m.lessons || []);
        const totalLessons = flatLessons.length;
        const completedIds = new Set(
          progressData.lessonProgress.filter(lp => lp.is_completed).map(lp => lp.lesson_id)
        );
        const completedCount = flatLessons.filter(l => completedIds.has(l.id)).length;
        const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        const nextLesson = flatLessons.find(l => !completedIds.has(l.id)) || (flatLessons.length > 0 ? flatLessons[0] : null);
        const nextModule = nextLesson ? curriculum.find(m => m.lessons?.some(l => l.id === nextLesson.id)) : null;

        summaries.push({
          course,
          totalLessons,
          completedLessons: completedCount,
          percentage,
          nextLesson,
          nextModule
        });
      }

      setCourseSummaries(summaries);
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error('Failed to load real classroom data:', err);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // Generate stable key from course IDs to avoid re-fetching on mere array reference changes
  const courseIdsKey = approvedCourses.map(c => c.id).sort().join(',');

  useEffect(() => {
    let isMounted = true;

    // Load initial data (or silent background refresh if already loaded)
    loadClassroomData(hasLoadedOnce.current);

    const unsub = realtimeSync.subscribe(() => {
      if (isMounted) {
        // Realtime notifications always refresh silently in background
        loadClassroomData(true);
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [courseIdsKey, currentUser.id]);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Open Lesson View
  const handleOpenLesson = async (course: Course, lesson: CourseLesson, module?: CourseModule) => {
    setSelectedCourseForSubView(course);
    setSelectedLessonForSubView(lesson);
    setSelectedModuleForSubView(module || null);
    setActiveSubView('lesson');
  };

  // Open Recordings View
  const handleOpenRecordings = async (course: Course) => {
    try {
      const recs = await learningService.getClassRecordings(course.id);
      const curriculum = await learningService.getCourseCurriculum(course.id);
      const allMats = curriculum.flatMap(m => (m.lessons || []).flatMap(l => l.materials || []));
      setCourseRecordings(recs);
      setCourseMaterials(allMats);
      setSelectedCourseForSubView(course);
      setActiveSubView('recordings');
    } catch (e) {
      console.error('Failed to load recordings for course:', e);
    }
  };

  // =========================================================================
  // SUB-VIEWS ROUTING (When student enters a lesson, recording, or quiz)
  // =========================================================================
  if (activeSubView === 'in-app' && (inAppTargetSession || activeLiveSession)) {
    const target = inAppTargetSession || (activeLiveSession ? {
      session: {
        ...activeLiveSession.session,
        meeting_url: activeLiveSession.meetingUrl || activeLiveSession.session.meeting_url
      },
      course: activeLiveSession.course,
      teacherName: activeLiveSession.teacherName,
      meetingUrl: activeLiveSession.meetingUrl || activeLiveSession.session.meeting_url
    } : null);

    if (target) {
      return (
        <InAppClassroom
          session={target.session}
          meetingUrl={target.meetingUrl}
          course={target.course}
          teacherName={target.teacherName}
          currentUser={currentUser}
          onLeave={() => {
            setInAppTargetSession(null);
            setActiveSubView('main');
          }}
        />
      );
    }
  }

  if (activeSubView === 'recordings' && selectedCourseForSubView) {
    return (
      <ClassRecordingView
        course={selectedCourseForSubView}
        recordings={courseRecordings}
        materials={courseMaterials}
        onBack={() => setActiveSubView('main')}
      />
    );
  }

  if (activeSubView === 'lesson' && selectedCourseForSubView && selectedLessonForSubView) {
    const isCompleted = false; // Will reflect real state
    return (
      <LessonContentView
        course={selectedCourseForSubView}
        module={selectedModuleForSubView || undefined}
        lesson={selectedLessonForSubView}
        materials={selectedLessonForSubView.materials || []}
        quizzes={selectedLessonForSubView.quizzes || []}
        isCompleted={isCompleted}
        onToggleComplete={async () => {
          await learningService.recordLessonProgress(selectedCourseForSubView.id, selectedLessonForSubView.id, true);
          loadClassroomData(true);
        }}
        onTakeQuiz={(quiz) => {
          setSelectedQuizForSubView(quiz);
          setActiveSubView('quiz');
        }}
        onBack={() => setActiveSubView('main')}
      />
    );
  }

  if (activeSubView === 'quiz' && selectedQuizForSubView) {
    return (
      <QuizStudentView
        quiz={selectedQuizForSubView}
        currentUser={currentUser}
        onBack={() => setActiveSubView('main')}
      />
    );
  }

  if (activeSubView === 'progress') {
    return (
      <CourseProgressView
        currentUser={currentUser}
        courses={approvedCourses}
        onBack={() => setActiveSubView('main')}
        onOpenLesson={(course, lesson) => handleOpenLesson(course, lesson)}
      />
    );
  }

  // =========================================================================
  // MAIN CLASSROOM VIEW (Header + Live / Upcoming / No Class States)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)]">
      
      {/* Top Header with Brand Logo */}
      <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-20 pt-safe">
        <BrandLogo size="sm" showText={true} showSubtitle={true} variant="dark" />
        <button className="p-2 rounded-full hover:bg-zinc-100 transition relative">
          <Bell className="w-4 h-4 text-zinc-800" />
        </button>
      </div>

      {/* Classroom Title Section */}
      <div className="px-4 sm:px-6 pt-5 pb-2">
        <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
          My Classroom
        </h1>
        <p className="text-xs text-zinc-500 font-medium mt-0.5">
          Your live classes, recordings and learning sessions
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-8 h-8 border-3 border-[#0A9D8F] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-zinc-500 font-medium mt-3">Checking your scheduled classes...</p>
        </div>
      ) : approvedCourses.length === 0 ? (
        /* GENUINE EMPTY STATE: Student has no active courses yet */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-sm mx-auto my-auto">
          <div className="w-20 h-20 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-xs">
            <BrandLogo size={48} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">
              You don't have any active courses yet.
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Once your course selections are approved by an administrator, your scheduled live classes, learning materials and class recordings will appear here.
            </p>
          </div>
        </div>
      ) : (
        /* STUDENT HAS APPROVED COURSES: Render Dynamic Live / Upcoming / No-Class Card */
        <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
          
          {/* STATE 1: ACTIVE LIVE CLASS */}
          {activeLiveSession ? (
            <div className="p-6 rounded-2xl bg-[#0A9D8F] text-white shadow-lg space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                  <span className="text-white font-bold uppercase tracking-wider text-[11px]">LIVE</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-emerald-100 font-medium">
                  {activeLiveSession.course.title}
                </span>
                <h2 className="text-xl font-extrabold tracking-tight text-white leading-snug">
                  {activeLiveSession.session.title || 'Live Learning Session'}
                </h2>
                <p className="text-xs text-emerald-100/90 font-medium">
                  {activeLiveSession.timeText}
                </p>
              </div>

              {/* Enter Classroom Action */}
              <button
                onClick={() => setActiveSubView('in-app')}
                className="w-full py-3.5 rounded-xl bg-white text-[#0A9D8F] hover:bg-emerald-50 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Enter Classroom</span>
              </button>

              {/* Class Information Card */}
              <div className="p-4 bg-white/10 rounded-xl space-y-3 text-xs border border-white/10 backdrop-blur-xs">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-100 font-medium">Instructor</span>
                  <span className="font-bold text-white">{activeLiveSession.teacherName}</span>
                </div>

                {activeLiveSession.meetingUrl ? (
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-100 font-medium">Live Meeting URL</span>
                      <button
                        onClick={() => copyToClipboard(activeLiveSession.meetingUrl)}
                        className="text-emerald-200 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSubView('in-app')}
                      className="text-white underline truncate block font-mono text-[11px] text-left hover:text-emerald-100 transition cursor-pointer"
                      title="Open Live Classroom In-App"
                    >
                      {activeLiveSession.meetingUrl}
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-white/10 text-[11px] text-emerald-100 italic">
                    Meeting URL managed within in-app classroom.
                  </div>
                )}

                <div className="pt-2 border-t border-white/10 flex items-start gap-2 text-[11px] text-emerald-100/80">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>You can join 15 minutes before the start time and up to 30 minutes after the class ends.</span>
                </div>
              </div>
            </div>
          ) : activeUpcomingSession ? (
            /* STATE 2: UPCOMING CLASS */
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#0A9D8F]">
                      Upcoming Class
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {activeUpcomingSession.course.title}
                    </h3>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[11px] font-bold">
                  {activeUpcomingSession.startsInText}
                </span>
              </div>

              <div className="space-y-1 pt-1">
                <h2 className="text-base font-extrabold text-zinc-900">
                  {activeUpcomingSession.session.title || 'Scheduled Session'}
                </h2>
                <p className="text-xs text-zinc-500 font-medium">
                  {activeUpcomingSession.timeText}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Instructor: {activeUpcomingSession.teacherName}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onOpenCourse(activeUpcomingSession.course)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>View Lessons</span>
                </button>
                <button
                  onClick={() => {
                    setInAppTargetSession({
                      session: activeUpcomingSession.session,
                      course: activeUpcomingSession.course,
                      teacherName: activeUpcomingSession.teacherName,
                      meetingUrl: activeUpcomingSession.session.meeting_url
                    });
                    setActiveSubView('in-app');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Enter Classroom</span>
                </button>
              </div>
            </div>
          ) : (
            /* STATE 3: NO CLASS RIGHT NOW (Genuine Empty State) */
            <div className="p-8 rounded-2xl bg-white border border-zinc-200 shadow-2xs text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
                <Calendar className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-extrabold text-zinc-900 tracking-tight">
                  No class is going on right now
                </h2>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Check back later for your scheduled live classes, or explore your course modules below.
                </p>
              </div>

              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 hover:border-zinc-300 text-xs font-bold text-zinc-700 transition cursor-pointer"
              >
                View Schedule
              </button>
            </div>
          )}

          {/* YOUR COURSES SECTION: Real Course Progress Cards */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Your Courses ({courseSummaries.length})
              </h3>
              <button
                onClick={() => setActiveSubView('progress')}
                className="text-xs font-bold text-[#0A9D8F] hover:underline cursor-pointer"
              >
                View Progress
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0">
              {courseSummaries.map(summary => (
                <div 
                  key={summary.course.id}
                  className="p-5 bg-white border border-zinc-200 rounded-2xl shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">{summary.course.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {summary.completedLessons} of {summary.totalLessons} lessons completed
                      </p>
                    </div>
                    <span className="text-xs font-black text-[#0A9D8F]">
                      {summary.percentage}% Complete
                    </span>
                  </div>

                  {/* Real Progress Bar */}
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0A9D8F] h-full rounded-full transition-all duration-300"
                      style={{ width: `${summary.percentage}%` }}
                    />
                  </div>

                  {/* Action Buttons for this course */}
                  <div className="flex items-center gap-2 pt-1">
                    {summary.nextLesson && (
                      <button
                        onClick={() => handleOpenLesson(summary.course, summary.nextLesson!, summary.nextModule || undefined)}
                        className="flex-1 py-2 rounded-lg bg-[#E6F5F4] text-[#0A9D8F] hover:bg-[#0A9D8F] hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Continue Learning</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenRecordings(summary.course)}
                      className="py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition cursor-pointer"
                      title="View Class Recordings"
                    >
                      Recordings
                    </button>

                    <button
                      onClick={() => onOpenCourse(summary.course)}
                      className="py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition cursor-pointer"
                      title="View Course Curriculum"
                    >
                      Syllabus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* SCHEDULE MODAL (Shows Real Approved Schedules) */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Your Class Schedules</h3>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeSchedules.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No active schedules found for your enrolled courses.
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto">
                {activeSchedules.map(sched => (
                  <div key={sched.id} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1 text-xs">
                    <p className="font-bold text-zinc-900">{sched.label}</p>
                    <p className="text-zinc-600">{sched.days?.join(', ')} • {sched.time_slot}</p>
                    {sched.meeting_url && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-[#0A9D8F] truncate font-mono">{sched.meeting_url}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowScheduleModal(false);
                            const course = approvedCourses.find(c => c.id === sched.course_id) || approvedCourses[0];
                            if (course) {
                              setInAppTargetSession({
                                session: {
                                  id: `sched-${sched.id}`,
                                  course_id: course.id,
                                  schedule_id: sched.id,
                                  title: sched.label || 'Scheduled Live Session',
                                  start_time: new Date().toISOString(),
                                  end_time: new Date(Date.now() + 3600000).toISOString(),
                                  status: 'in_progress',
                                  meeting_url: sched.meeting_url,
                                  created_at: new Date().toISOString()
                                },
                                course,
                                teacherName: 'Assigned Instructor',
                                meetingUrl: sched.meeting_url
                              });
                              setActiveSubView('in-app');
                            }
                          }}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-[#E6F5F4] hover:bg-[#0A9D8F] text-[#0A9D8F] hover:text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" />
                          <span>Join In-App</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowScheduleModal(false)}
              className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
