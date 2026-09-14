import React, { useState, useEffect, useCallback } from 'react';
import { 
  GraduationCap, BookOpen, Users, Calendar, Video, Clock, 
  Search, ExternalLink, Copy, Check, Save, User, Settings, 
  LogOut, RefreshCw, AlertCircle, ChevronRight, X, Mail,
  Play, Sparkles, Plus, Globe
} from 'lucide-react';
import { Profile, Course, CourseSchedule, ClassSession } from '../types';
import { dataService } from '../services/dataService';
import { realtimeSync } from '../services/realtimeSync';
import { TeacherCourseWorkspace } from './teacher/TeacherCourseWorkspace';
import { BrandLogo } from './common/BrandLogo';
import { navigateSameTab } from '../lib/navigation';

interface TeacherAppProps {
  currentUser: Profile;
  onLogout: () => void;
}

type TeacherTab = 'overview' | 'classes' | 'students' | 'profile';

interface TeacherClassItem {
  course: Course;
  schedule?: CourseSchedule;
  schedules?: CourseSchedule[];
  assignmentId?: string;
  meetingUrl?: string;
  nextSession?: ClassSession;
  students: { id: string; name: string; email: string; enrollmentStatus: string; enrolledAt: string; scheduleLabel?: string }[];
}

export const TeacherApp: React.FC<TeacherAppProps> = ({
  currentUser,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<TeacherTab>('overview');
  const [workspaceCourse, setWorkspaceCourse] = useState<{
    course: Course;
    scheduleLabel?: string;
    scheduleId?: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [classes, setClasses] = useState<TeacherClassItem[]>([]);
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Meeting Link & Schedule edit modal state
  const [editingSchedule, setEditingSchedule] = useState<{
    courseId: string;
    courseTitle: string;
    scheduleId?: string;
    scheduleLabel?: string;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    currentUrl: string;
  } | null>(null);

  const [meetUrlInput, setMeetUrlInput] = useState<string>('');
  const [scheduleLabelInput, setScheduleLabelInput] = useState<string>('');
  const [dayOfWeekInput, setDayOfWeekInput] = useState<string>('');
  const [startTimeInput, setStartTimeInput] = useState<string>('18:00');
  const [endTimeInput, setEndTimeInput] = useState<string>('20:00');
  const [timezoneInput, setTimezoneInput] = useState<string>('Africa/Lagos');

  const [isSavingUrl, setIsSavingUrl] = useState<boolean>(false);
  const [urlFeedback, setUrlFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Profile edit state
  const [profileName, setProfileName] = useState<string>(currentUser.full_name || '');
  const [profileTimezone, setProfileTimezone] = useState<string>(currentUser.timezone || 'Africa/Lagos');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Password update
  const [newPassword, setNewPassword] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Fetch teacher's authoritative assigned classes and students
  const loadTeacherData = useCallback(async (isBackground: boolean = false) => {
    try {
      if (!isBackground) setLoading(true);
      else setIsSyncing(true);

      const teacherClasses = await dataService.getTeacherClasses(currentUser.id);
      setClasses(teacherClasses);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load teacher classes:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadTeacherData(false);

    const unsubscribe = realtimeSync.subscribe(() => {
      loadTeacherData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [loadTeacherData]);

  // Aggregate stats
  const totalCourses = new Set(classes.map(c => c.course.id)).size;
  const totalSchedules = classes.reduce((acc, c) => acc + (c.schedules?.length || (c.schedule ? 1 : 0)), 0);
  
  // Unique active students
  const uniqueStudentsMap = new Map<string, { id: string; name: string; email: string; courseTitle: string; enrolledAt: string; scheduleLabel?: string }>();
  classes.forEach(c => {
    c.students.forEach(s => {
      if (!uniqueStudentsMap.has(s.id)) {
        uniqueStudentsMap.set(s.id, {
          ...s,
          courseTitle: c.course.title
        });
      }
    });
  });
  const allStudents = Array.from(uniqueStudentsMap.values());

  const filteredStudents = allStudents.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.courseTitle.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Handlers for Google Meet URL & Schedule
  const handleOpenMeetModal = (item: TeacherClassItem) => {
    setEditingSchedule({
      courseId: item.course.id,
      courseTitle: item.course.title,
      scheduleId: item.schedule?.id,
      scheduleLabel: item.schedule?.label || 'Regular Class Schedule',
      dayOfWeek: item.schedule?.day_of_week || 'Monday, Wednesday, Friday',
      startTime: item.schedule?.start_time || '18:00',
      endTime: item.schedule?.end_time || '20:00',
      timezone: item.schedule?.timezone || currentUser.timezone || 'Africa/Lagos',
      currentUrl: item.meetingUrl || ''
    });
    setMeetUrlInput(item.meetingUrl || '');
    setScheduleLabelInput(item.schedule?.label || 'Regular Class Schedule');
    setDayOfWeekInput(item.schedule?.day_of_week || 'Monday, Wednesday, Friday');
    setStartTimeInput(item.schedule?.start_time || '18:00');
    setEndTimeInput(item.schedule?.end_time || '20:00');
    setTimezoneInput(item.schedule?.timezone || currentUser.timezone || 'Africa/Lagos');
    setUrlFeedback(null);
  };

  const handleSaveMeetUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setIsSavingUrl(true);
    setUrlFeedback(null);

    const trimmed = meetUrlInput.trim();
    if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlFeedback({ type: 'error', message: 'Meeting URL must start with https:// (e.g. https://meet.google.com/...)' });
      setIsSavingUrl(false);
      return;
    }

    try {
      await dataService.saveTeacherClassDetails({
        teacherId: currentUser.id,
        courseId: editingSchedule.courseId,
        scheduleId: editingSchedule.scheduleId,
        meetingUrl: trimmed,
        scheduleLabel: scheduleLabelInput.trim() || 'Regular Class Schedule',
        dayOfWeek: dayOfWeekInput.trim() || 'Flexible / Online',
        startTime: startTimeInput.trim() || '18:00',
        endTime: endTimeInput.trim() || '20:00',
        timezone: timezoneInput
      });

      setUrlFeedback({ type: 'success', message: 'Class schedule and meeting link updated successfully.' });
      await loadTeacherData(true);
      setTimeout(() => {
        setEditingSchedule(null);
      }, 1000);
    } catch (err: any) {
      setUrlFeedback({ type: 'error', message: err.message || 'Failed to save class details.' });
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileSuccessMsg(null);
    try {
      await dataService.profile.updateProfile(currentUser.id, {
        full_name: profileName.trim(),
        timezone: profileTimezone
      });
      setProfileSuccessMsg('Profile updated successfully.');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    setIsUpdatingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await dataService.auth.updatePassword(newPassword);
      if (res.error) setPasswordMsg(res.error);
      else {
        setPasswordMsg('Password updated successfully.');
        setNewPassword('');
      }
    } catch (e: any) {
      setPasswordMsg(e.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (workspaceCourse) {
    return (
      <TeacherCourseWorkspace
        course={workspaceCourse.course}
        currentUser={currentUser}
        onBack={() => setWorkspaceCourse(null)}
        scheduleLabel={workspaceCourse.scheduleLabel}
        scheduleId={workspaceCourse.scheduleId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 font-sans flex flex-col selection:bg-[#0A9D8F]/20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="font-extrabold text-sm tracking-tight text-gray-950 truncate max-w-[140px] sm:max-w-none">
                  Ingenium Tech Academy
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] shrink-0">
                  Teacher Portal
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate max-w-[180px] sm:max-w-none">
                Welcome back, {currentUser.full_name || 'Instructor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadTeacherData(true)}
              disabled={isSyncing}
              className="p-2 text-gray-400 hover:text-gray-950 transition-colors rounded-lg hover:bg-gray-100 cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#0A9D8F]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:text-gray-950 hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-gray-100 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#0A9D8F] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'classes'
                ? 'bg-[#0A9D8F] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Classes ({classes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-[#0A9D8F] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Students ({allStudents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#0A9D8F] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center space-y-3 shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0A9D8F] mx-auto" />
            <p className="text-xs font-bold text-gray-950">Loading your instructor portal...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Assigned Courses</p>
                      <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{totalCourses}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center">
                      <BookOpen className="w-5 h-5 stroke-[2]" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Class Schedules</p>
                      <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{totalSchedules}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                      <Calendar className="w-5 h-5 stroke-[2]" />
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Active Students</p>
                      <h3 className="text-2xl font-extrabold text-gray-950 mt-1">{allStudents.length}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center">
                      <Users className="w-5 h-5 stroke-[2]" />
                    </div>
                  </div>
                </div>

                {/* Live Class Links & Upcoming Schedules */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-950">Active Class Schedules & Google Meet Links</h3>
                      <p className="text-xs text-gray-500">
                        Provide students with your Google Meet link. Links become visible to enrolled students 15 minutes prior to class.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('classes')}
                      className="text-xs font-bold text-[#0A9D8F] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {classes.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-100 space-y-2">
                      <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
                      <h4 className="text-xs font-bold text-gray-950">No Classes Assigned Yet</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Your teacher account is active. When an academy administrator assigns you to a course or schedule, it will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {classes.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80 space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A9D8F]">
                                  {item.course.category || 'Course'}
                                </span>
                                <h4 className="text-xs font-bold text-gray-950">{item.course.title}</h4>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 shrink-0">
                                {item.students.length} {item.students.length === 1 ? 'Student' : 'Students'}
                              </span>
                            </div>

                            {item.schedule && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-white p-2 rounded-xl border border-gray-100">
                                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="font-semibold truncate">{item.schedule.label}</span>
                                <span className="text-gray-400">•</span>
                                <span className="truncate">{item.schedule.day_of_week} {item.schedule.start_time} - {item.schedule.end_time}</span>
                              </div>
                            )}

                            {/* Meeting Link Status */}
                            <div className="text-xs">
                              {item.meetingUrl ? (
                                <div className="flex items-center justify-between p-2 rounded-xl bg-[#E6F5F4] border border-[#0A9D8F]/20 text-[#0A9D8F]">
                                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                    <Video className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate text-[11px] font-mono">{item.meetingUrl}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => navigateSameTab(item.meetingUrl!)}
                                      className="px-2 py-0.5 rounded bg-[#0A9D8F] text-white text-[10px] font-bold hover:bg-[#087A6F] transition-colors cursor-pointer"
                                      title="Join Google Meet"
                                    >
                                      Join
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(item.meetingUrl!)}
                                      className="p-1 hover:bg-white rounded transition-colors cursor-pointer"
                                      title="Copy meeting link"
                                    >
                                      {copiedLink === item.meetingUrl ? (
                                        <Check className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-800 text-[11px] flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="truncate">No Google Meet link set</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenMeetModal(item)}
                                    className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-bold hover:bg-amber-700 transition-colors shrink-0 cursor-pointer"
                                  >
                                    Set Link
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWorkspaceCourse({
                                course: item.course,
                                scheduleLabel: item.schedule?.label,
                                scheduleId: item.schedule?.id
                              })}
                              className="flex-1 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Workspace</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenMeetModal(item)}
                              className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                              title="Configure Schedule and Meet Link"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>{item.meetingUrl ? 'Edit Meet' : 'Set Meet'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MY CLASSES */}
            {activeTab === 'classes' && (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-950">Assigned Courses & Classes</h3>
                    <p className="text-xs text-gray-500">
                      Manage live Google Meet links, class timings, curriculum, and student rosters.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0A9D8F] bg-[#E6F5F4] px-3 py-1 rounded-full">
                      {classes.length} Assigned {classes.length === 1 ? 'Course' : 'Courses'}
                    </span>
                    <span className="text-xs font-bold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-full">
                      {allStudents.length} Active {allStudents.length === 1 ? 'Student' : 'Students'}
                    </span>
                  </div>
                </div>

                {classes.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center space-y-3">
                    <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
                    <h4 className="text-sm font-bold text-gray-950">No Assigned Classes</h4>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                      You are currently not assigned to any courses. Once an academy administrator assigns a course to your account, it will appear here in real-time.
                    </p>
                    <button
                      type="button"
                      onClick={() => loadTeacherData(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Check for Assignments</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {classes.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4"
                      >
                        {/* Course Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A9D8F] bg-[#E6F5F4] px-2 py-0.5 rounded-md">
                                {item.course.category || 'Course'}
                              </span>
                              <span className="text-[10px] font-bold text-gray-500">
                                {item.course.training_mode || 'Online'} • {item.course.difficulty_level || 'All Levels'}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-gray-950">{item.course.title}</h4>
                            <p className="text-xs text-gray-500">
                              Duration: {item.course.duration || 'Self-paced / Cohort'} • {item.students.length} {item.students.length === 1 ? 'Student' : 'Students'} Enrolled
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setWorkspaceCourse({
                                course: item.course,
                                scheduleLabel: item.schedule?.label,
                                scheduleId: item.schedule?.id
                              })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors shadow-xs cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Course Workspace</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenMeetModal(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 text-zinc-800 text-xs font-bold hover:bg-zinc-200 transition-colors cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5 text-[#0A9D8F]" />
                              <span>{item.meetingUrl ? 'Edit Meet Link' : 'Set Meet Link'}</span>
                            </button>

                            {item.meetingUrl && (
                              <button
                                type="button"
                                onClick={() => navigateSameTab(item.meetingUrl!)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Join Class</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live Panels: Class Schedule & Google Meet Link */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* Schedule Panel */}
                          <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                  <Calendar className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                  <span>Class Schedule & Timing</span>
                                </div>
                                {item.schedule && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Active Schedule
                                  </span>
                                )}
                              </div>

                              {item.schedule ? (
                                <div className="space-y-1 text-xs text-gray-900 bg-white p-2.5 rounded-xl border border-gray-100">
                                  <p className="font-bold text-gray-950">{item.schedule.label}</p>
                                  <p className="text-gray-600 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{item.schedule.day_of_week} • {item.schedule.start_time} - {item.schedule.end_time}</span>
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    Timezone: {item.schedule.timezone || currentUser.timezone || 'Africa/Lagos'}
                                  </p>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-white rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 space-y-1">
                                  <p className="font-semibold text-gray-700">No specific timetable configured yet</p>
                                  <p className="text-[11px] text-gray-400">Assign recurring days and class hours so students know when to attend.</p>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenMeetModal(item)}
                              className="w-full mt-2 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Settings className="w-3 h-3 text-gray-500" />
                              <span>{item.schedule ? 'Adjust Schedule & Times' : '+ Set Schedule Days & Hours'}</span>
                            </button>
                          </div>

                          {/* Google Meet Link Panel */}
                          <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                  <Video className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                  <span>Google Meet Class Link</span>
                                </div>
                                {item.meetingUrl ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] border border-[#0A9D8F]/20">
                                    Live Ready
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    Link Needed
                                  </span>
                                )}
                              </div>

                              {item.meetingUrl ? (
                                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-gray-100">
                                  <div className="flex items-center justify-between gap-2">
                                    <a
                                      href={item.meetingUrl}
                                      target="_top"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        navigateSameTab(item.meetingUrl!);
                                      }}
                                      className="text-xs font-mono font-bold text-[#0A9D8F] hover:underline truncate"
                                      title="Open in same tab"
                                    >
                                      {item.meetingUrl}
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(item.meetingUrl!)}
                                      className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors cursor-pointer shrink-0"
                                      title="Copy meeting link"
                                    >
                                      {copiedLink === item.meetingUrl ? (
                                        <Check className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                                      )}
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-gray-400">
                                    Visible to enrolled students starting 15 minutes before class.
                                  </p>
                                </div>
                              ) : (
                                <div className="p-2.5 bg-white rounded-xl border border-dashed border-amber-200 text-xs text-gray-500 space-y-1">
                                  <p className="font-semibold text-amber-800">No Google Meet link configured</p>
                                  <p className="text-[11px] text-gray-400">Set a Google Meet URL so your students can join live lectures.</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => handleOpenMeetModal(item)}
                                className="flex-1 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Video className="w-3 h-3 text-[#0A9D8F]" />
                                <span>{item.meetingUrl ? 'Update Meet Link' : '+ Set Google Meet Link'}</span>
                              </button>

                              {item.meetingUrl && (
                                <button
                                  type="button"
                                  onClick={() => navigateSameTab(item.meetingUrl!)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Start Meeting</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Session Banner (if scheduled) */}
                        {item.nextSession && (
                          <div className="p-3 bg-gradient-to-r from-[#E6F5F4] to-emerald-50 rounded-2xl border border-[#0A9D8F]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <Sparkles className="w-4 h-4 text-[#0A9D8F] shrink-0" />
                              <span className="font-bold text-gray-950">Next Live Session:</span>
                              <span className="text-gray-700">{item.nextSession.title || 'Live Interactive Class'}</span>
                              <span className="text-gray-400">•</span>
                              <span className="font-mono text-gray-600">{new Date(item.nextSession.start_time).toLocaleString()}</span>
                            </div>
                            {item.meetingUrl && (
                              <button
                                type="button"
                                onClick={() => navigateSameTab(item.meetingUrl!)}
                                className="px-3 py-1 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors self-start sm:self-auto cursor-pointer"
                              >
                                Launch Session
                              </button>
                            )}
                          </div>
                        )}

                        {/* Enrolled Students in this class */}
                        <div className="pt-2 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">
                                Enrolled Students ({item.students.length})
                              </span>
                              <span className="text-[10px] text-gray-400">
                                Live Database Records
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => loadTeacherData(true)}
                              className="text-xs text-[#0A9D8F] hover:underline flex items-center gap-1 cursor-pointer"
                              title="Refresh student roster"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Refresh Roster</span>
                            </button>
                          </div>

                          {item.students.length === 0 ? (
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-1">
                              <p className="text-xs font-semibold text-gray-700">
                                No students currently registered for this course.
                              </p>
                              <p className="text-[11px] text-gray-400">
                                Once students enroll through the student portal or are assigned by the admin, they will immediately appear here.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {item.students.map(s => (
                                <div key={s.id} className="p-3 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-100 text-xs transition-colors flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-xl bg-[#0A9D8F]/10 text-[#0A9D8F] font-bold text-xs flex items-center justify-center shrink-0">
                                      {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-gray-950 truncate">{s.name || 'Student'}</p>
                                      <p className="text-[11px] text-gray-500 font-mono truncate">{s.email}</p>
                                    </div>
                                  </div>
                                  {s.email && (
                                    <a
                                      href={`mailto:${s.email}`}
                                      className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                                      title={`Email ${s.name}`}
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: STUDENTS */}
            {activeTab === 'students' && (
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-950">Enrolled Students Roster</h3>
                    <p className="text-xs text-gray-500">
                      Students registered across all of your assigned courses and schedules.
                    </p>
                  </div>
                  <div className="relative max-w-xs w-full">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search student or course..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                    />
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-gray-100 text-center space-y-2">
                    <Users className="w-8 h-8 text-gray-400 mx-auto" />
                    <h4 className="text-sm font-bold text-gray-950">No Students Found</h4>
                    <p className="text-xs text-gray-500">
                      {studentSearch ? 'Try a different search keyword.' : 'No active students enrolled in your classes yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-3.5 pl-5">Student</th>
                            <th className="p-3.5">Email</th>
                            <th className="p-3.5">Assigned Course</th>
                            <th className="p-3.5">Status</th>
                            <th className="p-3.5 pr-5">Enrolled Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                          {filteredStudents.map(student => (
                            <tr key={student.id} className="hover:bg-gray-50/60 transition-colors">
                              <td className="p-3.5 pl-5 font-bold text-gray-950">
                                {student.name}
                              </td>
                              <td className="p-3.5 text-gray-500 font-mono text-[11px]">
                                {student.email}
                              </td>
                              <td className="p-3.5 font-medium text-gray-900">
                                {student.courseTitle}
                              </td>
                              <td className="p-3.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                                  Active
                                </span>
                              </td>
                              <td className="p-3.5 pr-5 text-gray-400 text-[11px]">
                                {student.enrolledAt ? new Date(student.enrolledAt).toLocaleDateString() : 'Active'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: PROFILE */}
            {activeTab === 'profile' && (
              <div className="space-y-6 max-w-2xl mx-auto">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-6">
                  <div className="flex items-center gap-4 border-b border-gray-100 pb-5">
                    <div className="w-14 h-14 rounded-2xl bg-[#0A9D8F] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                      {currentUser.full_name?.charAt(0)?.toUpperCase() || 'T'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-950">{currentUser.full_name || 'Instructor'}</h3>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                          Teacher Account
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{currentUser.email}</p>
                    </div>
                  </div>

                  {profileSuccessMsg && (
                    <div className="p-3 bg-[#E6F5F4] text-[#0A9D8F] rounded-xl text-xs font-semibold flex items-center gap-2 border border-[#0A9D8F]/20">
                      <Check className="w-4 h-4" />
                      <span>{profileSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">Account Details</h4>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1">Email Address</label>
                      <input
                        type="email"
                        disabled
                        value={currentUser.email}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Teacher emails are bound by verified administrator invitations.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1">Timezone</label>
                      <select
                        value={profileTimezone}
                        onChange={e => setProfileTimezone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                      >
                        <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                        <option value="UTC">UTC / GMT</option>
                        <option value="Europe/London">Europe/London</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#0A9D8F]/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </form>

                  {/* Change Password Section */}
                  <form onSubmit={handleUpdatePassword} className="pt-6 border-t border-gray-100 space-y-4">
                    <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider">Security & Password</h4>

                    {passwordMsg && (
                      <div className="p-3 bg-gray-50 text-gray-800 rounded-xl text-xs font-semibold border border-gray-200">
                        {passwordMsg}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1">New Password</label>
                      <input
                        type="password"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingPassword || !newPassword}
                      className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-bold hover:bg-zinc-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Google Meet & Schedule Configuration Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-950">Live Class & Schedule Settings</h3>
                  <p className="text-[11px] text-gray-500 truncate max-w-[280px]">
                    {editingSchedule.courseTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMeetUrl} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-[11px] text-gray-600 space-y-1">
                <p className="font-semibold text-gray-900">Live Class Automated Access:</p>
                <p>Enrolled students will be able to join using this Google Meet link starting 15 minutes before the scheduled time.</p>
              </div>

              {urlFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  urlFeedback.type === 'success' 
                    ? 'bg-[#E6F5F4] text-[#0A9D8F] border border-[#0A9D8F]/20' 
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {urlFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{urlFeedback.message}</span>
                </div>
              )}

              {/* Google Meet URL */}
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1">
                  Google Meet Link URL
                </label>
                <input
                  type="url"
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetUrlInput}
                  onChange={e => setMeetUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 font-mono placeholder:font-sans focus:outline-none focus:border-[#0A9D8F] focus:ring-1 focus:ring-[#0A9D8F]"
                />
                <p className="text-[10px] text-gray-400 mt-1">Provide a valid Google Meet link that opens directly in Chrome.</p>
              </div>

              {/* Schedule Details */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-gray-900">Schedule & Timetable</h4>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Batch / Cohort Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Regular Batch, Evening Cohort"
                    value={scheduleLabelInput}
                    onChange={e => setScheduleLabelInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Meeting Days
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monday, Wednesday, Friday or Saturdays"
                    value={dayOfWeekInput}
                    onChange={e => setDayOfWeekInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="text"
                      placeholder="18:00"
                      value={startTimeInput}
                      onChange={e => setStartTimeInput(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#0A9D8F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="text"
                      placeholder="20:00"
                      value={endTimeInput}
                      onChange={e => setEndTimeInput(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 font-mono focus:outline-none focus:border-[#0A9D8F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezoneInput}
                    onChange={e => setTimezoneInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  >
                    <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                    <option value="UTC">UTC / GMT</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUrl}
                  className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUrl ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
