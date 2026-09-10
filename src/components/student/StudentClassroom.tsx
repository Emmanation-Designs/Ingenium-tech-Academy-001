import React, { useState, useEffect } from 'react';
import { Course, CourseSchedule, ClassSession, Profile } from '../../types';
import { learningService } from '../../services/learningService';
import { dataService } from '../../services/dataService';
import { realtimeSync } from '../../services/realtimeSync';
import { 
  Video, Clock, Calendar, AlertCircle, CheckCircle, 
  ExternalLink, Maximize2, Minimize2, Sparkles, BookOpen, FileText, ChevronRight 
} from 'lucide-react';

interface StudentClassroomProps {
  currentUser: Profile;
  approvedCourses: Course[];
  activeSchedules: CourseSchedule[];
  onOpenCourse: (course: Course) => void;
}

interface ActiveClassStatus {
  state: 'live' | 'upcoming' | 'idle';
  course?: Course;
  schedule?: CourseSchedule;
  session?: ClassSession;
  meetingUrl?: string;
  startsInMinutes?: number;
  message?: string;
}

export const StudentClassroom: React.FC<StudentClassroomProps> = ({
  currentUser,
  approvedCourses,
  activeSchedules,
  onOpenCourse
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [classStatus, setClassStatus] = useState<ActiveClassStatus>({ state: 'idle' });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Clock ticker for real-time window calculations
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Determine active or upcoming class
  useEffect(() => {
    let isMounted = true;

    const checkClasses = async () => {
      if (approvedCourses.length === 0) {
        if (isMounted) {
          setClassStatus({ state: 'idle', message: 'You have not been approved for any courses yet.' });
          setLoading(false);
        }
        return;
      }

      try {
        // Fetch sessions for all approved courses
        const sessionPromises = approvedCourses.map(c => learningService.getClassSessions(c.id));
        const allSessionsList = await Promise.all(sessionPromises);
        const flatSessions = allSessionsList.flat();

        const now = new Date();

        // 1. Check if any session is CURRENTLY LIVE
        // Window: 15 minutes before start until 30 minutes after end
        for (const session of flatSessions) {
          const startTime = new Date(session.start_time);
          const endTime = new Date(session.end_time);

          const windowStart = new Date(startTime.getTime() - 15 * 60 * 1000);
          const windowEnd = new Date(endTime.getTime() + 30 * 60 * 1000);

          if (now >= windowStart && now <= windowEnd) {
            const course = approvedCourses.find(c => c.id === session.course_id);
            const sched = activeSchedules.find(s => s.id === session.schedule_id);

            // Fetch time-gated meeting URL through authoritative RPC
            const meetingRes = await dataService.teachers.getStudentMeetingUrl(
              session.schedule_id, 
              session.id
            );

            if (isMounted) {
              setClassStatus({
                state: 'live',
                course,
                schedule: sched,
                session,
                meetingUrl: meetingRes.accessible ? meetingRes.meeting_url : (session.meeting_url || sched?.meeting_url),
                message: 'Your live interactive class session is currently active!'
              });
              setLoading(false);
              return;
            }
          }
        }

        // 2. Check for UPCOMING session within the next 24 hours
        const upcoming = flatSessions
          .filter(s => new Date(s.start_time) > now)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

        if (upcoming) {
          const startTime = new Date(upcoming.start_time);
          const diffMinutes = Math.round((startTime.getTime() - now.getTime()) / (60 * 1000));
          const course = approvedCourses.find(c => c.id === upcoming.course_id);
          const sched = activeSchedules.find(s => s.id === upcoming.schedule_id);

          if (isMounted) {
            setClassStatus({
              state: 'upcoming',
              course,
              schedule: sched,
              session: upcoming,
              startsInMinutes: diffMinutes,
              message: `Upcoming class starts in ${diffMinutes > 60 ? Math.round(diffMinutes / 60) + ' hours' : diffMinutes + ' minutes'}.`
            });
            setLoading(false);
            return;
          }
        }

        // 3. Fallback: check recurring schedules if no specific session is scheduled
        for (const sched of activeSchedules) {
          if (sched.meeting_url) {
            const meetingRes = await dataService.teachers.getStudentMeetingUrl(sched.id);
            if (meetingRes.accessible && meetingRes.meeting_url) {
              const course = approvedCourses.find(c => c.id === sched.course_id);
              if (isMounted) {
                setClassStatus({
                  state: 'live',
                  course,
                  schedule: sched,
                  meetingUrl: meetingRes.meeting_url,
                  message: 'Your scheduled class meeting room is open!'
                });
                setLoading(false);
                return;
              }
            }
          }
        }

        if (isMounted) {
          setClassStatus({
            state: 'idle',
            message: 'No live class is going on right now.'
          });
          setLoading(false);
        }
      } catch (e) {
        console.error('Error checking class status:', e);
        if (isMounted) {
          setClassStatus({ state: 'idle', message: 'No live class is going on right now.' });
          setLoading(false);
        }
      }
    };

    checkClasses();
    const unsub = realtimeSync.subscribe(checkClasses);
    return () => {
      isMounted = false;
      unsub();
    };
  }, [approvedCourses, activeSchedules, currentTime]);

  return (
    <div className={`flex-1 flex flex-col bg-[#F9FAFB] min-h-screen ${isFullscreen ? 'p-2' : 'p-4 sm:p-6'}`}>
      <div className="max-w-5xl w-full mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0A9D8F] animate-pulse"></span>
              <h1 className="text-lg font-bold text-zinc-900">My Classroom</h1>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live Google Meet online classes, interactive sessions, and instant classroom entrance.
            </p>
          </div>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-zinc-700">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <p className="text-[10px] text-zinc-400">
              {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-zinc-200 text-center space-y-3">
            <Clock className="w-8 h-8 text-[#0A9D8F] animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 font-medium">Checking live classroom status...</p>
          </div>
        ) : (
          <>
            {/* 1. STATE: LIVE CLASS ACTIVE */}
            {classStatus.state === 'live' && (
              <div className="bg-white border-2 border-[#0A9D8F] rounded-3xl overflow-hidden shadow-lg space-y-0">
                {/* Live Banner */}
                <div className="bg-[#0A9D8F] px-6 py-3 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-wider">Live Class In Session</span>
                  </div>
                  <span className="text-xs font-semibold bg-white/20 px-3 py-0.5 rounded-full">
                    {classStatus.course?.title}
                  </span>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-zinc-900">
                      {classStatus.session?.title || `${classStatus.course?.title} Live Interactive Class`}
                    </h2>
                    <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
                      Your instructor and fellow students are online in the Google Meet classroom. Access is unlocked for the duration of this session.
                    </p>
                  </div>

                  {/* Primary Enter Classroom Action */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                    {classStatus.meetingUrl ? (
                      <a
                        href={classStatus.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-8 py-3.5 rounded-2xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-md shadow-[#0A9D8F]/20 transition-all transform active:scale-98"
                      >
                        <Video className="w-5 h-5" />
                        <span>Enter Live Classroom</span>
                        <ExternalLink className="w-4 h-4 opacity-80" />
                      </a>
                    ) : (
                      <div className="p-3 bg-zinc-100 rounded-xl text-xs text-zinc-500">
                        Classroom link is being generated by your instructor...
                      </div>
                    )}

                    {classStatus.course && (
                      <button
                        onClick={() => onOpenCourse(classStatus.course!)}
                        className="px-5 py-3.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-zinc-500" />
                        <span>Open Course Syllabus</span>
                      </button>
                    )}
                  </div>

                  {/* Live Class Rules & Access Window note */}
                  <div className="p-4 bg-[#E6F5F4] border border-[#0A9D8F]/20 rounded-2xl text-[11px] text-[#087A6F] flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#0A9D8F]" />
                    <div>
                      <span className="font-bold">Live Room Access Window:</span> Student access is open 15 minutes before class start and extends 30 minutes after class end. Keep your microphone muted when entering.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. STATE: UPCOMING CLASS */}
            {classStatus.state === 'upcoming' && (
              <div className="bg-white border border-[#EAEAEA] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Upcoming Class</span>
                  </span>
                  <span className="text-xs font-bold text-zinc-500">
                    Starts in ~{classStatus.startsInMinutes} mins
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0A9D8F]">
                    {classStatus.course?.title}
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900">
                    {classStatus.session?.title || 'Scheduled Online Class'}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Scheduled for {new Date(classStatus.session!.start_time).toLocaleString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 text-xs text-zinc-600 space-y-1">
                  <p className="font-semibold text-zinc-800">Classroom Entry Window</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    The "Enter Classroom" button will automatically activate 15 minutes prior to the scheduled start time.
                  </p>
                </div>

                {classStatus.course && (
                  <button
                    onClick={() => onOpenCourse(classStatus.course!)}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Review Learning Materials Ahead of Class</span>
                  </button>
                )}
              </div>
            )}

            {/* 3. STATE: IDLE (NO CLASS GOING ON RIGHT NOW) */}
            {classStatus.state === 'idle' && (
              <div className="bg-white border border-[#EAEAEA] rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xs">
                <div className="w-20 h-20 rounded-full bg-[#E6F5F4] flex items-center justify-center mx-auto text-[#0A9D8F]">
                  <Video className="w-10 h-10 stroke-[1.5]" />
                </div>

                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-zinc-900">No class is going on right now.</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    When your teacher begins a scheduled live class session, the live Google Meet portal will appear right here with one-click access.
                  </p>
                </div>

                {/* Approved Courses Quick Links */}
                {approvedCourses.length > 0 && (
                  <div className="pt-4 border-t border-zinc-100 max-w-lg mx-auto space-y-3">
                    <p className="text-xs font-semibold text-zinc-700 text-left">
                      Your Approved Courses:
                    </p>
                    <div className="space-y-2">
                      {approvedCourses.map(course => (
                        <div 
                          key={course.id}
                          className="p-3 rounded-2xl border border-zinc-200 hover:border-[#0A9D8F] bg-zinc-50 hover:bg-white flex items-center justify-between transition cursor-pointer group"
                          onClick={() => onOpenCourse(course)}
                        >
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center font-bold text-xs">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-zinc-900 group-hover:text-[#0A9D8F] transition">
                                {course.title}
                              </h4>
                              <p className="text-[10px] text-zinc-400">Click to view syllabus, lessons & notes</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-[#0A9D8F] transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
