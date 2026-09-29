import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, BookOpen, CheckCircle, Clock, Award, 
  ArrowRight, Play, Trophy, Calendar, Check, Layers, Sparkles
} from 'lucide-react';
import { Course, CourseLesson, Profile } from '../../types';
import { learningService } from '../../services/learningService';

interface CourseProgressViewProps {
  currentUser: Profile;
  courses: Course[];
  onBack: () => void;
  onOpenLesson?: (course: Course, lesson: CourseLesson) => void;
}

interface CourseProgressMetric {
  course: Course;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  nextLesson?: CourseLesson | null;
  nextLessonModuleName?: string;
  durationMinutes?: number;
}

interface RecentActivityItem {
  id: string;
  type: 'lesson' | 'quiz';
  title: string;
  courseTitle: string;
  date: string;
  scoreInfo?: string;
  passed?: boolean;
}

interface DayActivity {
  day: string;
  fullDate: string;
  lessonsCompleted: number;
  estimatedMinutes: number;
  isToday: boolean;
}

const getCourseImage = (course: Course) => {
  const url = course.image_url;
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url.startsWith('data:'))) {
    return url;
  }
  const title = (course.title || '').toLowerCase();
  if (title.includes('data') || title.includes('analytics') || title.includes('excel') || title.includes('power bi')) {
    return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('design') || title.includes('ui') || title.includes('ux') || title.includes('figma') || title.includes('product')) {
    return 'https://images.unsplash.com/photo-1561070791-26c113006238?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('code') || title.includes('develop') || title.includes('software') || title.includes('web') || title.includes('python') || title.includes('javascript') || title.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('scrum') || title.includes('agile') || title.includes('project') || title.includes('management')) {
    return 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';
};

export const CourseProgressView: React.FC<CourseProgressViewProps> = ({
  currentUser,
  courses,
  onBack,
  onOpenLesson
}) => {
  // Start with false if no courses passed, otherwise true until quick load finishes
  const [loading, setLoading] = useState<boolean>(courses.length > 0);
  const [courseFilter, setCourseFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [metrics, setMetrics] = useState<CourseProgressMetric[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [totalQuizzesPassed, setTotalQuizzesPassed] = useState<number>(0);
  const [averageQuizScore, setAverageQuizScore] = useState<number>(0);

  const queryRunIdRef = useRef<number>(0);
  const coursesKey = useMemo(() => courses.map(c => c.id).sort().join(','), [courses]);

  useEffect(() => {
    let isCancelled = false;
    const currentRunId = ++queryRunIdRef.current;

    // Safety timeout: Never allow loading state to persist longer than 2.5 seconds
    const safetyTimer = setTimeout(() => {
      if (!isCancelled && queryRunIdRef.current === currentRunId) {
        setLoading(false);
      }
    }, 2500);

    const loadRealData = async () => {
      if (courses.length === 0) {
        if (!isCancelled) {
          setMetrics([]);
          setRecentActivities([]);
          setTotalQuizzesPassed(0);
          setAverageQuizScore(0);
          setLoading(false);
        }
        return;
      }

      try {
        // Fetch all course data in parallel with timeout safety
        const courseDataPromises = courses.map(async (course) => {
          try {
            // Helper with 2.2s individual query timeout
            function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
              return Promise.race([
                promise,
                new Promise<T>((resolve) => setTimeout(() => resolve(fallback), 2200))
              ]);
            }

            const [curriculum, progressData, attempts] = await Promise.all([
              withTimeout(learningService.getCourseCurriculum(course.id), []),
              withTimeout(learningService.getStudentCourseProgress(course.id, currentUser.id), {
                courseProgress: null,
                lessonProgress: []
              }),
              withTimeout(learningService.getStudentQuizAttempts(course.id, currentUser.id), [])
            ]);

            const flatLessons: CourseLesson[] = (curriculum || []).flatMap(m => m.lessons || []);
            const totalLessons = flatLessons.length;
            const completedLessonIds = new Set(
              (progressData?.lessonProgress || [])
                .filter(lp => lp.is_completed)
                .map(lp => lp.lesson_id)
            );
            const completedCount = flatLessons.filter(l => completedLessonIds.has(l.id)).length;
            const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

            const nextLesson = flatLessons.find(l => !completedLessonIds.has(l.id)) || (flatLessons.length > 0 ? flatLessons[0] : null);
            const nextLessonParentMod = nextLesson 
              ? (curriculum || []).find(m => m.lessons?.some(l => l.id === nextLesson.id))
              : null;

            // Generate lesson activities
            const lessonActs: RecentActivityItem[] = (progressData?.lessonProgress || [])
              .filter(lp => lp.is_completed && lp.completed_at)
              .map(lp => {
                const matchedLesson = flatLessons.find(l => l.id === lp.lesson_id);
                return {
                  id: `lesson_${lp.id}`,
                  type: 'lesson' as const,
                  title: matchedLesson ? matchedLesson.title : 'Lesson Completed',
                  courseTitle: course.title,
                  date: lp.completed_at!,
                  passed: true
                };
              });

            // Generate quiz activities
            const quizActs: RecentActivityItem[] = (attempts || []).map(att => ({
              id: `quiz_${att.id}`,
              type: 'quiz' as const,
              title: `Quiz: ${att.quiz_title || 'Module Quiz'}`,
              courseTitle: course.title,
              date: att.submitted_at,
              scoreInfo: `${att.score}/${att.total_marks} (${att.percentage}%)`,
              passed: att.passed
            }));

            return {
              metric: {
                course,
                totalLessons,
                completedLessons: completedCount,
                percentage,
                nextLesson,
                nextLessonModuleName: nextLessonParentMod?.title,
                durationMinutes: totalLessons * 30
              },
              activities: [...lessonActs, ...quizActs],
              attempts: attempts || []
            };
          } catch (err) {
            console.warn(`[CourseProgressView] Error loading data for course ${course.id}:`, err);
            return {
              metric: {
                course,
                totalLessons: 0,
                completedLessons: 0,
                percentage: 0,
                nextLesson: null,
                nextLessonModuleName: undefined,
                durationMinutes: 0
              },
              activities: [],
              attempts: []
            };
          }
        });

        const settledResults = await Promise.all(courseDataPromises);

        if (isCancelled || queryRunIdRef.current !== currentRunId) return;

        const metricsResults: CourseProgressMetric[] = [];
        const allActivities: RecentActivityItem[] = [];
        let totalScoreSum = 0;
        let totalScoreCount = 0;
        let passedCount = 0;

        for (const item of settledResults) {
          if (item?.metric) {
            metricsResults.push(item.metric);
          }
          if (item?.activities) {
            allActivities.push(...item.activities);
          }
          if (item?.attempts) {
            for (const att of item.attempts) {
              if (att.passed) passedCount++;
              totalScoreSum += att.percentage || 0;
              totalScoreCount++;
            }
          }
        }

        // Sort activities by latest date
        allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setMetrics(metricsResults);
        setRecentActivities(allActivities);
        setTotalQuizzesPassed(passedCount);
        setAverageQuizScore(totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0);
      } catch (err) {
        console.error('[CourseProgressView] Error calculating progress:', err);
      } finally {
        if (!isCancelled && queryRunIdRef.current === currentRunId) {
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    };

    loadRealData();

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [coursesKey, currentUser.id]);

  // Aggregate Calculations
  const totalLessons = useMemo(() => {
    return metrics.reduce((acc, m) => acc + m.totalLessons, 0);
  }, [metrics]);

  const completedLessons = useMemo(() => {
    return metrics.reduce((acc, m) => acc + m.completedLessons, 0);
  }, [metrics]);

  const overallPercentage = useMemo(() => {
    if (totalLessons === 0) return 0;
    return Math.round((completedLessons / totalLessons) * 100);
  }, [totalLessons, completedLessons]);

  const inProgressCount = useMemo(() => {
    return metrics.filter(m => m.percentage > 0 && m.percentage < 100).length;
  }, [metrics]);

  const completedCoursesCount = useMemo(() => {
    return metrics.filter(m => m.totalLessons > 0 && m.percentage === 100).length;
  }, [metrics]);

  // Estimated learning time: 30 mins per completed lesson + 15 mins per quiz
  const totalHoursLearned = useMemo(() => {
    const lessonMinutes = completedLessons * 30;
    const quizMinutes = recentActivities.filter(a => a.type === 'quiz').length * 15;
    const totalMins = lessonMinutes + quizMinutes;
    const hours = (totalMins / 60).toFixed(1);
    return hours === '0.0' && completedLessons > 0 ? '0.5' : hours;
  }, [completedLessons, recentActivities]);

  // Active / Highlighted Course (primary course with progress or first course)
  const activeCourseMetric = useMemo(() => {
    return metrics.find(m => m.percentage < 100 && m.completedLessons > 0) || metrics[0] || null;
  }, [metrics]);

  // Weekly Activity Days (Last 7 days calculation)
  const weeklyDays = useMemo<DayActivity[]>(() => {
    const days: DayActivity[] = [];
    const today = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayStr = dayNames[d.getDay()];
      const dateIsoPrefix = d.toISOString().split('T')[0];

      // Count activities on this date
      const matching = recentActivities.filter(a => a.date && a.date.startsWith(dateIsoPrefix));
      const count = matching.length;
      
      days.push({
        day: dayStr,
        fullDate: dateIsoPrefix,
        lessonsCompleted: count,
        estimatedMinutes: count * 30,
        isToday: i === 0
      });
    }
    return days;
  }, [recentActivities]);

  // Filtered courses
  const filteredMetrics = useMemo(() => {
    if (courseFilter === 'in_progress') {
      return metrics.filter(m => m.percentage < 100);
    }
    if (courseFilter === 'completed') {
      return metrics.filter(m => m.totalLessons > 0 && m.percentage === 100);
    }
    return metrics;
  }, [metrics, courseFilter]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // SVG Circular Gauge calculations
  const radius = 54;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallPercentage / 100) * circumference;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] min-h-[calc(100vh-65px)] pb-16">
      
      {/* 
        Clean Header: As explicitly requested by the user, 
        we ignore the logo, profile photo, and notification bell icon!
        Clean title with subtle back action.
      */}
      <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition active:scale-95"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
              Course Progress
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-time learning stats & milestones
            </p>
          </div>
        </div>

        {/* Quiet status indicator (no logo/profile/bell) */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[11px] font-semibold">
          <Sparkles className="w-3 h-3 stroke-[2.5]" />
          <span>Active Student</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-9 h-9 border-3 border-[#0A9D8F] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium mt-3.5">
            Calculating real-time progress records...
          </p>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#0A9D8F] flex items-center justify-center">
            <BookOpen className="w-8 h-8 stroke-[1.8]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Enrolled Courses Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once you enroll in courses, your live completion rate, quiz results, and study streak will be tracked here.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            Explore Courses
          </button>
        </div>
      ) : (
        <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto w-full">
          
          {/* ========================================================= */}
          {/* 1. HERO CARD: OVERALL PROGRESS WITH CIRCULAR GAUGE       */}
          {/* ========================================================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 justify-between">
              
              {/* Left Content */}
              <div className="space-y-3 text-center sm:text-left flex-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-[#0A9D8F] uppercase tracking-wider">
                    Learning Journey
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Overall Progress
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {completedLessons} of {totalLessons} total lessons completed across all enrolled courses
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <div className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#0A9D8F]" />
                    <span>{metrics.length} {metrics.length === 1 ? 'Course' : 'Courses'}</span>
                  </div>
                  {averageQuizScore > 0 && (
                    <div className="px-3 py-1 rounded-xl bg-[#E6F5F4] border border-[#0A9D8F]/20 text-[#087A6F] text-xs font-semibold flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      <span>{averageQuizScore}% Quiz Avg</span>
                    </div>
                  )}
                  {completedCoursesCount > 0 && (
                    <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-semibold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>{completedCoursesCount} Completed</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Circular Gauge */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
                  {/* Background Track */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="#E2E8F0"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  {/* Active Teal Progress */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    stroke="#0A9D8F"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Centered Percentage Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {overallPercentage}
                    </span>
                    <span className="text-sm font-bold text-[#0A9D8F] ml-0.5">%</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Completed
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. STATS ROW: 4 CLEAN METRIC CARDS                        */}
          {/* ========================================================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Card 1: Active Courses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0A9D8F] flex items-center justify-center">
                <BookOpen className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {inProgressCount || metrics.length}
                </span>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Active Courses
                </p>
              </div>
            </div>

            {/* Card 2: Hours Learned */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {totalHoursLearned}h
                </span>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Hours Studied
                </p>
              </div>
            </div>

            {/* Card 3: Lessons Finished */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {completedLessons}/{totalLessons}
                </span>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Lessons Done
                </p>
              </div>
            </div>

            {/* Card 4: Quizzes Passed */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Trophy className="w-4 h-4 stroke-[2]" />
              </div>
              <div>
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {totalQuizzesPassed}
                </span>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Quizzes Passed
                </p>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* 3. WEEKLY ACTIVITY BAR CHART                               */}
          {/* ========================================================= */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0A9D8F]" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Weekly Activity
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  Learning momentum over the past 7 days
                </p>
              </div>

              <span className="text-xs font-bold text-[#0A9D8F] bg-[#E6F5F4] px-2.5 py-1 rounded-full">
                {recentActivities.length} Actions Recorded
              </span>
            </div>

            {/* Daily Bars */}
            <div className="pt-2">
              <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-32 pt-4 border-b border-slate-100">
                {weeklyDays.map((item, idx) => {
                  const maxActivities = Math.max(1, ...weeklyDays.map(d => d.lessonsCompleted));
                  const heightPercent = item.lessonsCompleted > 0 
                    ? Math.max(25, Math.round((item.lessonsCompleted / maxActivities) * 100))
                    : 8;

                  return (
                    <div key={idx} className="flex flex-col items-center h-full justify-end group cursor-default">
                      {/* Tooltip on hover */}
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded transition mb-1 shrink-0">
                        {item.lessonsCompleted}
                      </span>
                      
                      {/* Bar */}
                      <div className="w-full max-w-[28px] sm:max-w-[36px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: `${heightPercent}%` }}>
                        <div 
                          className={`w-full h-full rounded-t-lg transition-all duration-500 ${
                            item.lessonsCompleted > 0 
                              ? 'bg-[#0A9D8F]' 
                              : item.isToday 
                              ? 'bg-slate-300' 
                              : 'bg-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-2 text-center">
                {weeklyDays.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <span className={`text-[11px] font-bold block ${
                      item.isToday ? 'text-[#0A9D8F]' : 'text-slate-500'
                    }`}>
                      {item.day}
                    </span>
                    {item.isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0A9D8F] mx-auto block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. CONTINUE LEARNING HERO BANNER                          */}
          {/* ========================================================= */}
          {activeCourseMetric && activeCourseMetric.nextLesson && onOpenLesson && (
            <div className="bg-gradient-to-br from-[#0A9D8F] to-[#087A6F] text-white p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                  Continue Learning
                </span>
                <span className="text-xs font-bold text-emerald-100">
                  {activeCourseMetric.percentage}% Complete
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {activeCourseMetric.course.title}
                </h3>
                <p className="text-xs text-emerald-100/90 font-medium">
                  {activeCourseMetric.nextLessonModuleName ? `${activeCourseMetric.nextLessonModuleName} · ` : ''}
                  Next: {activeCourseMetric.nextLesson.title}
                </p>
              </div>

              {/* Progress track */}
              <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-white h-full rounded-full transition-all duration-500"
                  style={{ width: `${activeCourseMetric.percentage}%` }}
                />
              </div>

              <button
                onClick={() => onOpenLesson(activeCourseMetric.course, activeCourseMetric.nextLesson!)}
                className="w-full py-3 rounded-2xl bg-white hover:bg-emerald-50 text-[#087A6F] text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition active:scale-98"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Lesson</span>
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. COURSES BREAKDOWN LIST                                 */}
          {/* ========================================================= */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                My Courses ({metrics.length})
              </h3>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setCourseFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    courseFilter === 'all' 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setCourseFilter('in_progress')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    courseFilter === 'in_progress' 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setCourseFilter('completed')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    courseFilter === 'completed' 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Done
                </button>
              </div>
            </div>

            {filteredMetrics.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl text-xs text-slate-500 font-medium">
                No courses match the selected filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMetrics.map(m => (
                  <div 
                    key={m.course.id}
                    className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        <img 
                          src={getCourseImage(m.course)} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[#0A9D8F] uppercase tracking-wider truncate">
                            {m.course.category || 'Technology'}
                          </span>
                          <span className="text-xs font-black text-slate-900 shrink-0">
                            {m.percentage}%
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                          {m.course.title}
                        </h4>

                        <p className="text-[11px] text-slate-400 font-medium">
                          {m.completedLessons} of {m.totalLessons} lessons completed
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.percentage === 100 ? 'bg-emerald-500' : 'bg-[#0A9D8F]'
                        }`}
                        style={{ width: `${m.percentage}%` }}
                      />
                    </div>

                    {/* Bottom Action */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        {m.percentage === 100 ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Course Completed</span>
                          </span>
                        ) : m.nextLesson ? (
                          <span className="truncate max-w-[200px] block">
                            Next: {m.nextLesson.title}
                          </span>
                        ) : (
                          <span>All enrolled lessons up to date</span>
                        )}
                      </span>

                      {m.nextLesson && onOpenLesson && (
                        <button
                          onClick={() => onOpenLesson(m.course, m.nextLesson!)}
                          className="text-[#0A9D8F] hover:text-[#087A6F] text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <span>{m.percentage === 100 ? 'Review' : 'Resume'}</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 6. RECENT ACTIVITY TIMELINE                                */}
          {/* ========================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Recent Milestones
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                Live Activity Log
              </span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-6 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-1">
                <p className="text-xs font-medium text-slate-600">No activity logged yet.</p>
                <p className="text-[11px] text-slate-400">Complete lessons or submit quizzes to generate your timeline.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivities.slice(0, 6).map(act => (
                  <div 
                    key={act.id}
                    className="p-3.5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        act.type === 'lesson' 
                          ? 'bg-emerald-50 text-[#0A9D8F]' 
                          : act.passed 
                          ? 'bg-amber-50 text-amber-600' 
                          : 'bg-blue-50 text-blue-600'
                      }`}>
                        {act.type === 'lesson' ? (
                          <CheckCircle className="w-4 h-4 stroke-[2]" />
                        ) : (
                          <Trophy className="w-4 h-4 stroke-[2]" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium truncate">
                          {act.courseTitle} · {formatDate(act.date)}
                        </p>
                      </div>
                    </div>

                    {act.scoreInfo && (
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0 ml-2">
                        {act.scoreInfo}
                      </span>
                    )}
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
