import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, BookOpen, CheckCircle, Clock, Award, 
  ArrowRight, BarChart2, AlertCircle, Play
} from 'lucide-react';
import { Course, CourseLesson, Profile, StudentLessonProgress } from '../../types';
import { learningService } from '../../services/learningService';
import { BrandLogo } from '../common/BrandLogo';

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
}

interface RecentActivityItem {
  id: string;
  type: 'lesson' | 'quiz';
  title: string;
  courseTitle: string;
  date: string;
  scoreInfo?: string;
}

export const CourseProgressView: React.FC<CourseProgressViewProps> = ({
  currentUser,
  courses,
  onBack,
  onOpenLesson
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'courses'>('progress');
  const [metrics, setMetrics] = useState<CourseProgressMetric[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);

  const hasLoadedOnce = useRef<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const coursesKey = courses.map(c => c.id).sort().join(',');

  useEffect(() => {
    let isMounted = true;

    const loadRealData = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        if (!hasLoadedOnce.current) {
          setLoading(true);
        }
        if (courses.length === 0) {
          if (isMounted) {
            setMetrics([]);
            setRecentActivities([]);
            hasLoadedOnce.current = true;
          }
          return;
        }

        const metricsResults: CourseProgressMetric[] = [];
        const activities: RecentActivityItem[] = [];

        for (const course of courses) {
          const [curriculum, progressData, attempts] = await Promise.all([
            learningService.getCourseCurriculum(course.id),
            learningService.getStudentCourseProgress(course.id, currentUser.id),
            learningService.getStudentQuizAttempts(course.id, currentUser.id)
          ]);

          const flatLessons: CourseLesson[] = curriculum.flatMap(m => m.lessons || []);
          const totalLessons = flatLessons.length;
          const completedLessonIds = new Set(
            progressData.lessonProgress.filter(lp => lp.is_completed).map(lp => lp.lesson_id)
          );
          const completedCount = flatLessons.filter(l => completedLessonIds.has(l.id)).length;
          const percentage = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

          // Determine next uncompleted lesson
          const nextLesson = flatLessons.find(l => !completedLessonIds.has(l.id)) || (flatLessons.length > 0 ? flatLessons[0] : null);
          const nextLessonParentMod = nextLesson 
            ? curriculum.find(m => m.lessons?.some(l => l.id === nextLesson.id))
            : null;

          metricsResults.push({
            course,
            totalLessons,
            completedLessons: completedCount,
            percentage,
            nextLesson,
            nextLessonModuleName: nextLessonParentMod?.title
          });

          // Populate real activities from completed lessons
          progressData.lessonProgress
            .filter(lp => lp.is_completed && lp.completed_at)
            .forEach(lp => {
              const matchedLesson = flatLessons.find(l => l.id === lp.lesson_id);
              activities.push({
                id: `lesson_${lp.id}`,
                type: 'lesson',
                title: matchedLesson ? `Completed: ${matchedLesson.title}` : 'Completed a lesson',
                courseTitle: course.title,
                date: lp.completed_at!
              });
            });

          // Populate real activities from quiz attempts
          attempts.forEach(att => {
            activities.push({
              id: `quiz_${att.id}`,
              type: 'quiz',
              title: `Took Quiz: ${att.quiz_title || 'Quiz'}`,
              courseTitle: course.title,
              date: att.submitted_at,
              scoreInfo: `Score: ${att.score}/${att.total_marks} (${att.percentage}%)`
            });
          });
        }

        // Sort activities by latest date
        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (isMounted) {
          setMetrics(metricsResults);
          setRecentActivities(activities);
          hasLoadedOnce.current = true;
        }
      } catch (err) {
        console.error('Failed to calculate course progress from Supabase:', err);
      } finally {
        inFlightRef.current = false;
        if (isMounted) setLoading(false);
      }
    };

    loadRealData();
    return () => { isMounted = false; };
  }, [coursesKey, currentUser.id]);

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const primaryMetric = metrics.length > 0 ? metrics[0] : null;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-[calc(100vh-60px)] pb-20">
      
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1 rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-zinc-900">Course Progress</h1>
            <p className="text-xs text-zinc-400">Real-time learning stats & milestones</p>
          </div>
        </div>
        <BrandLogo size="xs" />
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12">
          <div className="w-8 h-8 border-3 border-[#0A9D8F] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-zinc-500 font-medium mt-3">Calculating course progress from database...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-zinc-800">You don't have any active courses yet.</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Once enrolled in a course, your completion progress and lesson activity will be tracked here.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-6 max-w-xl mx-auto w-full">
          
          {/* Segmented Tab Filter */}
          <div className="border-b border-zinc-200 flex">
            <button
              onClick={() => setActiveTab('progress')}
              className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
                activeTab === 'progress' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>Progress Overview</span>
              {activeTab === 'progress' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('courses')}
              className={`flex-1 py-3 text-xs font-bold transition-all relative cursor-pointer text-center ${
                activeTab === 'courses' ? 'text-[#0A9D8F]' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>All Courses ({metrics.length})</span>
              {activeTab === 'courses' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
              )}
            </button>
          </div>

          {activeTab === 'progress' && primaryMetric && (
            <div className="space-y-6">
              
              {/* Primary Course Progress Card */}
              <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[10px] font-bold">
                    Active Course
                  </span>
                  <span className="text-sm font-black text-[#0A9D8F]">
                    {primaryMetric.percentage}% Complete
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-zinc-900 tracking-tight">
                    {primaryMetric.course.title}
                  </h2>
                  <p className="text-xs text-zinc-500 font-medium">
                    {primaryMetric.completedLessons} of {primaryMetric.totalLessons} lessons completed
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#0A9D8F] h-full rounded-full transition-all duration-500"
                    style={{ width: `${primaryMetric.percentage}%` }}
                  />
                </div>
              </div>

              {/* Continue Learning Action Card */}
              {primaryMetric.nextLesson ? (
                <div className="p-5 rounded-2xl bg-[#E6F5F4]/40 border border-[#0A9D8F]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#0A9D8F]">
                      Up Next
                    </span>
                    {primaryMetric.nextLessonModuleName && (
                      <span className="text-[10px] text-zinc-500 font-medium truncate max-w-[180px]">
                        {primaryMetric.nextLessonModuleName}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {primaryMetric.nextLesson.title}
                    </h3>
                    {primaryMetric.nextLesson.duration && (
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Duration: {primaryMetric.nextLesson.duration}
                      </p>
                    )}
                  </div>

                  {onOpenLesson && (
                    <button
                      onClick={() => onOpenLesson(primaryMetric.course, primaryMetric.nextLesson!)}
                      className="w-full py-3 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Continue Learning</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
                  <Award className="w-8 h-8 text-[#0A9D8F] mx-auto" />
                  <h4 className="text-xs font-bold text-emerald-900">All Lessons Completed!</h4>
                  <p className="text-[11px] text-emerald-700">Great job! You have completed all lessons in this course.</p>
                </div>
              )}

              {/* Recent Activity Section */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  Recent Activity
                </h3>

                {recentActivities.length === 0 ? (
                  <div className="p-5 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-1">
                    <p className="text-xs font-medium text-zinc-600">No recent activity yet.</p>
                    <p className="text-[11px] text-zinc-400">Complete lessons or submit quizzes to build your activity history.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.slice(0, 8).map(act => (
                      <div 
                        key={act.id}
                        className="p-3 bg-white border border-zinc-200 rounded-xl flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            act.type === 'lesson' ? 'bg-emerald-50 text-[#0A9D8F]' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {act.type === 'lesson' ? <CheckCircle className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-800 line-clamp-1">{act.title}</p>
                            <p className="text-[10px] text-zinc-400">
                              {act.courseTitle} • {formatDate(act.date)}
                            </p>
                          </div>
                        </div>

                        {act.scoreInfo && (
                          <span className="text-[11px] font-bold text-zinc-700 shrink-0">
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

          {/* Tab 2: All Approved Courses Progress Cards */}
          {activeTab === 'courses' && (
            <div className="space-y-3">
              {metrics.map(m => (
                <div 
                  key={m.course.id}
                  className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-900 line-clamp-1">{m.course.title}</h3>
                    <span className="text-xs font-black text-[#0A9D8F] shrink-0 ml-2">{m.percentage}%</span>
                  </div>

                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0A9D8F] h-full rounded-full transition-all"
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{m.completedLessons} of {m.totalLessons} lessons completed</span>
                    {m.nextLesson && onOpenLesson && (
                      <button
                        onClick={() => onOpenLesson(m.course, m.nextLesson!)}
                        className="text-[#0A9D8F] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Resume</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
