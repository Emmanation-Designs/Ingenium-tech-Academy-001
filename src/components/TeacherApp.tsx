import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  GraduationCap, BookOpen, Users, Calendar, Video, Clock, 
  Search, ExternalLink, Copy, Check, Save, User, Settings, 
  LogOut, RefreshCw, AlertCircle, ChevronRight, ChevronDown, X, Mail,
  Play, Sparkles, Plus, Globe, Bell, Megaphone, SlidersHorizontal,
  Home, BarChart2, Link as LinkIcon, Menu, ArrowRight
} from 'lucide-react';
import { Profile, Course, CourseSchedule, ClassSession, Notification } from '../types';
import { dataService } from '../services/dataService';
import { realtimeSync } from '../services/realtimeSync';
import { TeacherCourseWorkspace } from './teacher/TeacherCourseWorkspace';
import { TeacherCourseManagerModal } from './teacher/TeacherCourseManagerModal';
import { NotificationCenterModal } from './common/NotificationCenterModal';
import { BrandLogo } from './common/BrandLogo';
import { navigateSameTab } from '../lib/navigation';
import { formatCapitalizedName, sanitizeCapitalizedInput } from '../utils/nameFormatter';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);

  // Manage Course details modal state
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [isSavingCourseDetails, setIsSavingCourseDetails] = useState<boolean>(false);

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

      const [teacherClasses, teacherNotifications] = await Promise.all([
        dataService.getTeacherClasses(currentUser.id),
        dataService.notifications.getForUser(currentUser.id)
      ]);
      setClasses(teacherClasses);
      setNotifications(teacherNotifications);
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
  const totalCourses = useMemo(() => new Set(classes.map(c => c.course.id)).size, [classes]);
  const totalSchedules = useMemo(() => classes.reduce((acc, c) => acc + (c.schedules?.length || (c.schedule ? 1 : 0)), 0), [classes]);
  
  // Unique active students
  const allStudents = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; courseTitle: string; enrolledAt: string; scheduleLabel?: string }>();
    classes.forEach(c => {
      c.students.forEach(s => {
        if (!map.has(s.id)) {
          map.set(s.id, {
            ...s,
            courseTitle: c.course.title
          });
        }
      });
    });
    return Array.from(map.values());
  }, [classes]);

  const filteredStudents = useMemo(() => {
    return allStudents.filter(s => 
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.courseTitle.toLowerCase().includes(studentSearch.toLowerCase())
    );
  }, [allStudents, studentSearch]);

  // Formatted today string
  const formattedToday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date());
    } catch (e) {
      return new Date().toDateString();
    }
  }, []);

  const teacherDisplayName = formatCapitalizedName(currentUser.full_name || currentUser.email, 'Teacher');

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

    const trimmed = meetUrlInput.trim();
    if (trimmed && !trimmed.startsWith('https://meet.google.com/') && !trimmed.startsWith('https://')) {
      setUrlFeedback({
        type: 'error',
        message: 'Please provide a valid URL (e.g., https://meet.google.com/xxx-yyyy-zzz)'
      });
      return;
    }

    setIsSavingUrl(true);
    setUrlFeedback(null);
    try {
      await dataService.teachers.saveTeacherClassDetails({
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

  const handleSaveCourseDetails = async (courseId: string, updates: Partial<Course>) => {
    setIsSavingCourseDetails(true);
    try {
      await dataService.updateCourse(courseId, updates);
      await loadTeacherData(true);
      setManagingCourse(null);
    } catch (err: any) {
      console.error('Failed to update course details:', err);
      throw err;
    } finally {
      setIsSavingCourseDetails(false);
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
      const cleanName = formatCapitalizedName(profileName.trim(), 'Instructor');
      await dataService.profile.updateProfile(currentUser.id, {
        full_name: cleanName,
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
    if (!newPassword || newPassword.length < 6) {
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

  // Sidebar navigation items
  const navItems = [
    {
      id: 'overview' as TeacherTab,
      label: 'Dashboard',
      icon: Home,
      badge: null
    },
    {
      id: 'classes' as TeacherTab,
      label: `My Classes (${classes.length})`,
      icon: Calendar,
      badge: classes.length
    },
    {
      id: 'students' as TeacherTab,
      label: `Students (${allStudents.length})`,
      icon: Users,
      badge: allStudents.length
    },
    {
      id: 'profile' as TeacherTab,
      label: 'Profile',
      icon: User,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 font-sans flex">
      {/* 1. LEFT SIDEBAR (Desktop Fixed, Mobile Slide-over) */}
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#0A9D8F]/20 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Logo Header */}
          <div className="flex items-center justify-between">
            <BrandLogo size="md" showText={true} showSubtitle={true} />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0A9D8F] text-white shadow-xs'
                      : 'text-gray-700 hover:text-gray-950 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && !isActive && (
                    <span className="w-5 h-5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[10px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Promo / Mission Footer Box */}
        <div className="p-5">
          <div className="bg-[#EBF7F5] rounded-2xl p-4 border border-[#0A9D8F]/25 space-y-2">
            <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-[#0A9D8F] shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-tight">Better Teachers</p>
              <p className="text-xs font-bold text-gray-900 leading-tight">Build Brighter</p>
              <p className="text-xs font-extrabold text-[#0A9D8F] leading-tight">Futures</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT AREA */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#0A9D8F]/20 h-16 flex items-center justify-between px-4 sm:px-8">
          {/* Mobile Menu trigger */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-950 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-extrabold text-sm text-gray-950">Teacher Portal</span>
          </div>

          <div className="hidden md:block">
            {/* Breadcrumb / Section label */}
            <span className="text-xs font-semibold text-gray-400">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'classes' && 'My Assigned Classes'}
              {activeTab === 'students' && 'Enrolled Students Roster'}
              {activeTab === 'profile' && 'Instructor Profile Settings'}
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Sync Refresh Button */}
            <button
              type="button"
              onClick={() => loadTeacherData(true)}
              disabled={isSyncing}
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-xl hover:bg-gray-100 cursor-pointer"
              title="Refresh live data"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#0A9D8F]' : ''}`} />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationCenter(true)}
                className="p-2 text-gray-500 hover:text-gray-950 transition-colors rounded-xl hover:bg-gray-100 cursor-pointer relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0A9D8F] animate-pulse" />
                )}
              </button>
            </div>

            {/* Teacher Profile Dropdown Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border border-[#0A9D8F]/30 hover:border-[#0A9D8F] bg-white transition-all cursor-pointer shadow-2xs"
              >
                <div className="w-7 h-7 rounded-full bg-[#0A9D8F] text-white flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-900 hidden sm:inline">Teacher Portal</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {userDropdownOpen && (
                <div 
                  className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-[#0A9D8F]/25 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-[#0A9D8F]/15">
                    <p className="text-xs font-bold text-gray-950 truncate">{teacherDisplayName}</p>
                    <p className="text-[10px] text-gray-400 truncate">{currentUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTeacherData(true)}
                    className="w-full px-4 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                    <span>Sync Live Data</span>
                  </button>
                  <div className="border-t border-[#0A9D8F]/15 my-1" />
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-7 max-w-7xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="bg-white p-12 rounded-3xl border border-[#0A9D8F]/25 text-center space-y-3 shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0A9D8F] mx-auto" />
              <p className="text-xs font-bold text-gray-950">Loading instructor dashboard...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: DASHBOARD (OVERVIEW) */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Greeting & Date Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 flex items-center gap-2">
                        <span>Welcome back, {teacherDisplayName}</span>
                      </h1>
                      <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Here's an overview of your classes, schedule and your students.
                      </p>
                    </div>

                    {/* Today Date Card */}
                    <div className="bg-white border border-[#0A9D8F]/25 rounded-2xl px-4 py-2.5 shadow-2xs flex items-center gap-3 shrink-0 self-start sm:self-auto">
                      <div className="w-8 h-8 rounded-xl bg-[#E6F5F4] flex items-center justify-center text-[#0A9D8F]">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Today</p>
                        <p className="text-xs font-bold text-gray-900">{formattedToday}</p>
                      </div>
                    </div>
                  </div>

                  {/* 3 Top Primary Stat Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stat Card 1: Assigned Courses */}
                    <div 
                      onClick={() => setActiveTab('classes')}
                      className="bg-white p-5 rounded-3xl border border-[#0A9D8F]/25 shadow-xs hover:border-[#0A9D8F] transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                          <BookOpen className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">Assigned Courses</p>
                          <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{totalCourses}</h3>
                          <p className="text-[11px] text-gray-400">Courses you're teaching</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#E6F5F4] text-gray-400 group-hover:text-[#0A9D8F] flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Stat Card 2: Class Schedules */}
                    <div 
                      onClick={() => setActiveTab('classes')}
                      className="bg-white p-5 rounded-3xl border border-[#0A9D8F]/25 shadow-xs hover:border-[#0A9D8F] transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                          <Calendar className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">Class Schedules</p>
                          <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{totalSchedules}</h3>
                          <p className="text-[11px] text-gray-400">Active class schedules</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#E6F5F4] text-gray-400 group-hover:text-[#0A9D8F] flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Stat Card 3: Active Students */}
                    <div 
                      onClick={() => setActiveTab('students')}
                      className="bg-white p-5 rounded-3xl border border-[#0A9D8F]/25 shadow-xs hover:border-[#0A9D8F] transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                          <Users className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">Active Students</p>
                          <h3 className="text-2xl font-extrabold text-gray-950 mt-0.5">{allStudents.length}</h3>
                          <p className="text-[11px] text-gray-400">Students in your classes</p>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#E6F5F4] text-gray-400 group-hover:text-[#0A9D8F] flex items-center justify-center transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Section: Active Class Schedules & Google Meet Links */}
                  <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#0A9D8F]/15 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="text-sm sm:text-base font-bold text-gray-950">
                            Active Class Schedules & Google Meet Links
                          </h2>
                          <p className="text-xs text-gray-500">
                            Live classes you're scheduled to teach. Click on a class to view the Google Meet link and manage the session.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('classes')}
                        className="text-xs font-bold text-[#0A9D8F] hover:underline flex items-center gap-1 shrink-0 self-start sm:self-auto cursor-pointer"
                      >
                        <span>View All</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {classes.length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 rounded-2xl border border-[#0A9D8F]/25 space-y-2">
                        <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
                        <h4 className="text-xs font-bold text-gray-950">No Classes Assigned Yet</h4>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                          Your teacher account is active. When an academy administrator assigns you to a course or schedule, it will appear here.
                        </p>
                        <button
                          type="button"
                          onClick={() => loadTeacherData(true)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Check Assignments</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {classes.map((item, idx) => {
                          const timingLabel = item.schedule?.label || 'Regular Class Schedule';
                          const timingDetails = item.schedule 
                            ? `${item.schedule.day_of_week} ${item.schedule.start_time} - ${item.schedule.end_time}`
                            : 'Flexible / Online Cohort';

                          return (
                            <div
                              key={idx}
                              className="bg-white p-5 rounded-3xl border border-[#0A9D8F]/25 shadow-2xs space-y-3.5 flex flex-col justify-between hover:border-[#0A9D8F] transition-all"
                            >
                              <div className="space-y-3">
                                {/* Top Category and Student count row */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0A9D8F] bg-[#E6F5F4] px-2.5 py-1 rounded-md">
                                    {item.course.category || 'DATA SCIENCE'}
                                  </span>

                                  <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 bg-gray-50 border border-[#0A9D8F]/20 px-2.5 py-0.5 rounded-full">
                                    <Users className="w-3 h-3 text-gray-500" />
                                    <span>{item.students.length} {item.students.length === 1 ? 'Student' : 'Students'}</span>
                                  </div>
                                </div>

                                {/* Title */}
                                <h3 className="text-base sm:text-lg font-bold text-gray-950 truncate">
                                  {item.course.title}
                                </h3>

                                {/* Timing line */}
                                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                                  <div className="flex items-center gap-1 text-gray-700 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{timingLabel}</span>
                                  </div>
                                  <span className="text-gray-300">•</span>
                                  <div className="flex items-center gap-1 text-gray-500 text-[11px]">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                    <span>{timingDetails}</span>
                                  </div>
                                </div>

                                {/* Meet Link Status Bar */}
                                <div className="bg-[#F0FAF8] border border-[#0A9D8F]/30 rounded-2xl p-2.5 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate text-xs">
                                    <LinkIcon className="w-3.5 h-3.5 text-[#0A9D8F] shrink-0" />
                                    {item.meetingUrl ? (
                                      <span className="text-xs font-semibold text-[#0A9D8F] truncate font-mono">
                                        {item.meetingUrl}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold text-gray-600 truncate">
                                        No Google Meet link set
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenMeetModal(item)}
                                    className="px-3 py-1.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    <span>{item.meetingUrl ? 'Update Link' : 'Set Link'}</span>
                                  </button>
                                </div>
                              </div>

                              {/* 3 Action Buttons */}
                              <div className="grid grid-cols-12 gap-2 pt-1 border-t border-[#0A9D8F]/15">
                                <button
                                  type="button"
                                  onClick={() => setWorkspaceCourse({
                                    course: item.course,
                                    scheduleLabel: item.schedule?.label,
                                    scheduleId: item.schedule?.id
                                  })}
                                  className="col-span-6 py-2.5 px-3 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>View/Inspect</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setManagingCourse(item.course)}
                                  className="col-span-3 py-2.5 px-2 rounded-xl border border-[#0A9D8F]/30 bg-white hover:bg-[#E6F5F4]/40 text-gray-800 text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                                  title="Manage Course Duration, Level & Syllabus"
                                >
                                  <SlidersHorizontal className="w-3 h-3 text-[#0A9D8F]" />
                                  <span>Manage</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenMeetModal(item)}
                                  className="col-span-3 py-2.5 px-2 rounded-xl border border-[#0A9D8F]/30 bg-white hover:bg-[#E6F5F4]/40 text-gray-800 text-xs font-bold transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                                  title="Configure schedule timings and Google Meet link"
                                >
                                  <ExternalLink className="w-3 h-3 text-[#0A9D8F]" />
                                  <span>Set Meet</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Quick Overview (Left) & Upcoming Classes (Right) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Quick Overview Card */}
                    <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-4 flex flex-col justify-between">
                      <div className="flex items-center gap-2.5 border-b border-[#0A9D8F]/15 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center">
                          <BarChart2 className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-950">Quick Overview</h3>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1">
                        {/* Box 1: Assigned Courses */}
                        <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/20 rounded-2xl p-3 flex flex-col items-center text-center space-y-1">
                          <BookOpen className="w-4 h-4 text-[#0A9D8F]" />
                          <span className="text-xl font-extrabold text-gray-950">{totalCourses}</span>
                          <span className="text-[10px] font-semibold text-gray-500">Assigned Courses</span>
                        </div>

                        {/* Box 2: Class Schedules */}
                        <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/20 rounded-2xl p-3 flex flex-col items-center text-center space-y-1">
                          <Calendar className="w-4 h-4 text-[#0A9D8F]" />
                          <span className="text-xl font-extrabold text-gray-950">{totalSchedules}</span>
                          <span className="text-[10px] font-semibold text-gray-500">Class Schedules</span>
                        </div>

                        {/* Box 3: Active Students */}
                        <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/20 rounded-2xl p-3 flex flex-col items-center text-center space-y-1">
                          <Users className="w-4 h-4 text-[#0A9D8F]" />
                          <span className="text-xl font-extrabold text-gray-950">{allStudents.length}</span>
                          <span className="text-[10px] font-semibold text-gray-500">Active Students</span>
                        </div>

                        {/* Box 4: Announcements/Notifications */}
                        <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/20 rounded-2xl p-3 flex flex-col items-center text-center space-y-1">
                          <Megaphone className="w-4 h-4 text-[#0A9D8F]" />
                          <span className="text-xl font-extrabold text-gray-950">{notifications.length}</span>
                          <span className="text-[10px] font-semibold text-gray-500">Announcements</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-400 text-center pt-1">
                        Authoritative academy statistics synced with cloud database.
                      </p>
                    </div>

                    {/* Right: Upcoming Classes Card */}
                    <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b border-[#0A9D8F]/15 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-950">Upcoming Classes</h3>
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
                        <div className="p-6 text-center text-xs text-gray-400">
                          No scheduled classes to display.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {classes.slice(0, 3).map((c, i) => {
                            const dayName = c.schedule?.day_of_week || 'Scheduled Class';
                            const hours = c.schedule ? `${c.schedule.start_time} - ${c.schedule.end_time}` : 'Regular Class Session';
                            const startTimeDisplay = c.schedule?.start_time || 'Live';

                            return (
                              <div
                                key={i}
                                onClick={() => setWorkspaceCourse({
                                  course: c.course,
                                  scheduleLabel: c.schedule?.label,
                                  scheduleId: c.schedule?.id
                                })}
                                className="p-3 bg-[#E6F5F4]/20 hover:bg-[#E6F5F4]/40 rounded-2xl border border-[#0A9D8F]/20 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-2.5 h-2.5 rounded-full bg-[#0A9D8F] shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-900 truncate group-hover:text-[#0A9D8F] transition-colors">
                                      {dayName}
                                    </p>
                                    <p className="text-[11px] text-gray-400 truncate">
                                      {c.course.title} • {hours}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-[#0A9D8F]/25 text-gray-700 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#0A9D8F]" />
                                    <span>{startTimeDisplay}</span>
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-950 transition-colors" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p className="text-[11px] text-gray-400 text-right pt-1">
                        Click on any session to launch classroom workspace.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MY CLASSES */}
              {activeTab === 'classes' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-gray-950">Assigned Courses & Classes</h2>
                      <p className="text-xs text-gray-500">
                        Manage live Google Meet links, class timings, curriculum syllabus, and student rosters.
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
                    <div className="bg-white p-12 rounded-3xl border border-[#0A9D8F]/25 text-center space-y-3">
                      <BookOpen className="w-8 h-8 text-[#0A9D8F] mx-auto" />
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
                          className="bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-4"
                        >
                          {/* Course Card Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0A9D8F]/15 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0A9D8F] bg-[#E6F5F4] px-2.5 py-0.5 rounded-md">
                                  {item.course.category || 'Course'}
                                </span>
                                <span className="text-[10px] font-bold text-gray-500">
                                  {item.course.training_mode || 'Online'} • {item.course.level || 'Beginner'}
                                </span>
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-gray-950">{item.course.title}</h3>
                              <p className="text-xs text-gray-500">
                                Duration: <span className="font-semibold text-gray-800">{item.course.duration || '8 Weeks'}</span> • Level: <span className="font-semibold text-[#0A9D8F]">{item.course.level || 'Beginner'}</span> • {item.students.length} {item.students.length === 1 ? 'Student' : 'Students'} Enrolled
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setManagingCourse(item.course)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 text-[#0A9D8F] border border-[#0A9D8F]/30 text-xs font-bold hover:bg-teal-100 transition-colors shadow-2xs cursor-pointer"
                                title="Set course duration, level, description, and what students will learn"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Manage Course</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWorkspaceCourse({
                                  course: item.course,
                                  scheduleLabel: item.schedule?.label,
                                  scheduleId: item.schedule?.id
                                })}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors shadow-xs cursor-pointer"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Workspace</span>
                              </button>

                              {item.meetingUrl && (
                                <button
                                  type="button"
                                  onClick={() => navigateSameTab(item.meetingUrl!)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
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
                            <div className="p-4 bg-gray-50/80 rounded-2xl border border-[#0A9D8F]/25 space-y-2 flex flex-col justify-between">
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
                                  <div className="space-y-1 text-xs text-gray-900 bg-white p-3 rounded-xl border border-[#0A9D8F]/20">
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
                                  <div className="p-3 bg-white rounded-xl border border-dashed border-[#0A9D8F]/30 text-xs text-gray-500 space-y-1">
                                    <p className="font-semibold text-gray-700">No specific timetable configured yet</p>
                                    <p className="text-[11px] text-gray-400">Assign recurring days and class hours so students know when to attend.</p>
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenMeetModal(item)}
                                className="w-full mt-2 py-2 rounded-xl border border-[#0A9D8F]/30 bg-white hover:bg-[#E6F5F4]/40 text-xs font-semibold text-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Settings className="w-3 h-3 text-[#0A9D8F]" />
                                <span>{item.schedule ? 'Adjust Schedule & Times' : '+ Set Schedule Days & Hours'}</span>
                              </button>
                            </div>

                            {/* Google Meet Link Panel */}
                            <div className="p-4 bg-gray-50/80 rounded-2xl border border-[#0A9D8F]/25 space-y-2 flex flex-col justify-between">
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
                                  <div className="space-y-2 bg-white p-3 rounded-xl border border-[#0A9D8F]/20">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-mono font-medium text-emerald-700 truncate">
                                        {item.meetingUrl}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyLink(item.meetingUrl!)}
                                        className="p-1 hover:bg-[#E6F5F4] rounded text-gray-500 transition-colors cursor-pointer shrink-0"
                                        title="Copy link"
                                      >
                                        {copiedLink === item.meetingUrl ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400">
                                      Visible to enrolled students starting 15 minutes before class.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-3 bg-white rounded-xl border border-dashed border-amber-200 text-xs text-gray-500 space-y-1">
                                    <p className="font-semibold text-amber-800">No Google Meet link configured</p>
                                    <p className="text-[11px] text-gray-400">Set a Google Meet URL so your students can join live lectures.</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMeetModal(item)}
                                  className="flex-1 py-2 rounded-xl border border-[#0A9D8F]/30 bg-white hover:bg-[#E6F5F4]/40 text-xs font-semibold text-gray-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Video className="w-3 h-3 text-[#0A9D8F]" />
                                  <span>{item.meetingUrl ? 'Update Meet Link' : '+ Set Google Meet Link'}</span>
                                </button>

                                {item.meetingUrl && (
                                  <button
                                    type="button"
                                    onClick={() => navigateSameTab(item.meetingUrl!)}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Start</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STUDENTS ROSTER */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#0A9D8F]/25 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-950">Active Students Roster</h2>
                      <p className="text-xs text-gray-500">
                        View enrolled students across your assigned courses and their class groups.
                      </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search student or course..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-[#0A9D8F]/25 text-center space-y-2">
                      <Users className="w-8 h-8 text-[#0A9D8F] mx-auto" />
                      <h4 className="text-sm font-bold text-gray-950">No Students Found</h4>
                      <p className="text-xs text-gray-500">
                        {allStudents.length === 0 
                          ? 'No students are currently enrolled in your assigned courses.' 
                          : 'No students matched your search criteria.'}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-[#0A9D8F]/25 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#E6F5F4]/40 border-b border-[#0A9D8F]/20 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="px-5 py-3.5">Student</th>
                              <th className="px-5 py-3.5">Course Enrolled</th>
                              <th className="px-5 py-3.5">Batch / Schedule</th>
                              <th className="px-5 py-3.5">Status</th>
                              <th className="px-5 py-3.5">Joined Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#0A9D8F]/15">
                            {filteredStudents.map((student, i) => (
                              <tr key={i} className="hover:bg-[#E6F5F4]/30 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#E6F5F4] text-[#0A9D8F] font-bold text-xs flex items-center justify-center">
                                      {student.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-gray-950">{student.name}</p>
                                      <p className="text-[11px] text-gray-400">{student.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 font-semibold text-gray-800">
                                  {student.courseTitle}
                                </td>
                                <td className="px-5 py-3.5 text-gray-600">
                                  {student.scheduleLabel || 'Flexible / Online'}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Enrolled
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-gray-400 text-[11px]">
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
                  <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-6">
                    <div className="flex items-center gap-4 border-b border-[#0A9D8F]/15 pb-5">
                      <div className="w-14 h-14 rounded-2xl bg-[#0A9D8F] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                        {formatCapitalizedName(currentUser.full_name || currentUser.email, 'Instructor').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-gray-950">
                            {formatCapitalizedName(currentUser.full_name || currentUser.email, 'Instructor')}
                          </h3>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                            Teacher Account
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{currentUser.email}</p>
                      </div>
                    </div>

                    {profileSuccessMsg && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{profileSuccessMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Name</label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(sanitizeCapitalizedInput(e.target.value))}
                          className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all font-medium"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Primary Timezone</label>
                        <select
                          value={profileTimezone}
                          onChange={(e) => setProfileTimezone(e.target.value)}
                          className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
                        >
                          <option value="Africa/Lagos">Africa/Lagos (WAT, GMT+1)</option>
                          <option value="Europe/London">Europe/London (GMT/BST)</option>
                          <option value="America/New_York">America/New_York (EST/EDT)</option>
                          <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                          <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                          <option value="UTC">UTC (Universal Coordinated Time)</option>
                        </select>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isUpdatingProfile}
                          className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Password Change Box */}
                  <div className="bg-white p-6 sm:p-7 rounded-3xl border border-[#0A9D8F]/25 shadow-xs space-y-4">
                    <h4 className="text-sm font-bold text-gray-950">Update Account Password</h4>
                    <p className="text-xs text-gray-500">Ensure your instructor account uses a strong password.</p>

                    {passwordMsg && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        passwordMsg.includes('success') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{passwordMsg}</span>
                      </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isUpdatingPassword || !newPassword}
                        className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
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
      </div>

      {/* MODAL: Configure Google Meet & Timings */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#0A9D8F]/25 space-y-5 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#0A9D8F]/15 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-950">Schedule & Google Meet Link</h3>
                <p className="text-xs text-gray-500 font-semibold">{editingSchedule.courseTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {urlFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                urlFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {urlFeedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{urlFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSaveMeetUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1.5">
                  Google Meet Link
                </label>
                <div className="relative">
                  <Video className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    value={meetUrlInput}
                    onChange={(e) => setMeetUrlInput(e.target.value)}
                    className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Enrolled students will be able to access this meeting starting 15 minutes before scheduled lectures.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Schedule Name / Batch
                  </label>
                  <input
                    type="text"
                    value={scheduleLabelInput}
                    onChange={(e) => setScheduleLabelInput(e.target.value)}
                    placeholder="e.g. Weekday Evening Batch"
                    className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Class Days
                  </label>
                  <input
                    type="text"
                    value={dayOfWeekInput}
                    onChange={(e) => setDayOfWeekInput(e.target.value)}
                    placeholder="e.g. Mon & Wed"
                    className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="w-full bg-gray-50 border border-[#0A9D8F]/30 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#0A9D8F]/15">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUrl}
                  className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUrl ? 'Saving...' : 'Save Schedule & Link'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructor Course Details & Syllabus Manager Modal */}
      <TeacherCourseManagerModal
        isOpen={!!managingCourse}
        course={managingCourse}
        onClose={() => setManagingCourse(null)}
        onSave={handleSaveCourseDetails}
        isSaving={isSavingCourseDetails}
      />

      {/* Universal Notification Center Modal */}
      <NotificationCenterModal
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        currentUser={currentUser}
        onRefreshNotifications={() => loadTeacherData(true)}
      />
    </div>
  );
};
