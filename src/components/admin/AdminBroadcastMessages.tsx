import React, { useState, useMemo } from 'react';
import { 
  Send, Users, GraduationCap, ShieldCheck, BookOpen,
  Link as LinkIcon, CheckCircle2, AlertCircle, 
  Sparkles, ExternalLink, Eye, Clock, Megaphone
} from 'lucide-react';
import { Profile, Course, Enrollment, CourseSelection } from '../../types';
import { dataService } from '../../services/dataService';
import { LinkifiedText, normalizeUrl } from '../../utils/linkUtils';
import { formatCapitalizedName } from '../../utils/nameFormatter';

interface AdminBroadcastMessagesProps {
  currentUser: Profile;
  students: Profile[];
  teachers: Profile[];
  courses?: Course[];
  enrollments?: Enrollment[];
  selections?: CourseSelection[];
  onRefresh?: () => void;
}

export const AdminBroadcastMessages: React.FC<AdminBroadcastMessagesProps> = ({
  currentUser,
  students,
  teachers,
  courses = [],
  enrollments = [],
  selections = [],
  onRefresh
}) => {
  const [targetAudience, setTargetAudience] = useState<'all' | 'students' | 'course' | 'teachers' | 'specific'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [category, setCategory] = useState<'announcement' | 'urgent' | 'event' | 'system'>('announcement');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [broadcastHistory, setBroadcastHistory] = useState<Array<{
    id: string;
    title: string;
    message: string;
    link?: string;
    targetLabel: string;
    recipientCount: number;
    sentAt: string;
    category: string;
  }>>([]);

  // Compute enrolled student IDs for each course
  const courseEnrollmentMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    courses.forEach(c => map.set(c.id, new Set<string>()));

    enrollments.forEach(e => {
      if (e.status !== 'dropped' && e.status !== 'cancelled' && map.has(e.course_id)) {
        map.get(e.course_id)!.add(e.student_id);
      }
    });

    selections.forEach(s => {
      if ((s.status === 'approved' || s.status === 'paid' || s.status === 'active') && map.has(s.course_id)) {
        map.get(s.course_id)!.add(s.student_id);
      }
    });

    return map;
  }, [courses, enrollments, selections]);

  const selectedCourseStudentIds = useMemo(() => {
    if (!selectedCourseId) return [];
    const set = courseEnrollmentMap.get(selectedCourseId);
    return set ? Array.from(set) : [];
  }, [selectedCourseId, courseEnrollmentMap]);

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  const totalUsersCount = students.length + teachers.length;

  let recipientCount = 0;
  let targetLabel = 'All Users';

  if (targetAudience === 'all') {
    recipientCount = totalUsersCount;
    targetLabel = `All Academy Users (${totalUsersCount})`;
  } else if (targetAudience === 'students') {
    recipientCount = students.length;
    targetLabel = `All Students (${students.length})`;
  } else if (targetAudience === 'course') {
    recipientCount = selectedCourseStudentIds.length;
    targetLabel = selectedCourse ? `${selectedCourse.title} (${recipientCount} students)` : 'Course Students';
  } else if (targetAudience === 'teachers') {
    recipientCount = teachers.length;
    targetLabel = `All Teachers (${teachers.length})`;
  } else {
    recipientCount = selectedUserId ? 1 : 0;
    targetLabel = 'Specific User';
  }

  // Combined pool for specific user selector
  const allUsersPool = [
    ...students.map(s => ({ ...s, poolRole: 'Student' })),
    ...teachers.map(t => ({ ...t, poolRole: 'Instructor' }))
  ];

  const filteredPool = allUsersPool.filter(u => 
    u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a broadcast title.' });
      return;
    }
    if (!message.trim()) {
      setFeedback({ type: 'error', message: 'Please write the message content to broadcast.' });
      return;
    }
    if (targetAudience === 'course') {
      if (!selectedCourseId) {
        setFeedback({ type: 'error', message: 'Please select a course to send broadcast to its students.' });
        return;
      }
      if (selectedCourseStudentIds.length === 0) {
        setFeedback({ type: 'error', message: 'No students are currently enrolled in the selected course.' });
        return;
      }
    }
    if (targetAudience === 'specific' && !selectedUserId) {
      setFeedback({ type: 'error', message: 'Please select a specific recipient.' });
      return;
    }
    if (recipientCount === 0 && targetAudience !== 'all') {
      setFeedback({ type: 'error', message: 'No recipients matched the selected target.' });
      return;
    }

    if (actionLink.trim()) {
      const trimmed = actionLink.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('www.')) {
        setFeedback({ 
          type: 'error', 
          message: 'The action link must be a valid URL starting with https:// (e.g. https://ingeniumacademy.com/...)' 
        });
        return;
      }
    }

    setIsSending(true);

    try {
      const res = await dataService.notifications.send({
        senderId: currentUser.id,
        senderRole: 'admin',
        senderName: formatCapitalizedName(currentUser.full_name || currentUser.email, 'Ingenium Academy Admin'),
        title: title.trim(),
        message: message.trim(),
        link: actionLink.trim() ? normalizeUrl(actionLink.trim()) : undefined,
        targetAudience: targetAudience === 'course' ? 'course_students' : (targetAudience === 'specific' ? 'specific_users' : targetAudience),
        courseId: targetAudience === 'course' ? selectedCourseId : undefined,
        recipientIds: targetAudience === 'course' ? selectedCourseStudentIds : (targetAudience === 'specific' ? [selectedUserId] : undefined),
        category
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to deliver broadcast.' });
        return;
      }

      setFeedback({ 
        type: 'success', 
        message: `Broadcast message successfully delivered to ${res.deliveredCount || recipientCount} recipient${(res.deliveredCount || recipientCount) !== 1 ? 's' : ''}!` 
      });

      setBroadcastHistory(prev => [
        {
          id: String(Date.now()),
          title: title.trim(),
          message: message.trim(),
          link: actionLink.trim() ? normalizeUrl(actionLink.trim()) : undefined,
          targetLabel,
          recipientCount: res.deliveredCount || recipientCount,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category
        },
        ...prev.slice(0, 9)
      ]);

      // Reset form
      setTitle('');
      setMessage('');
      setActionLink('');
      setSelectedUserId('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error while delivering broadcast.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] uppercase tracking-wider">
              Academy Notifications
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              Admin Broadcast (All Users / Targeted)
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-950">
            Broadcast Notifications & Messages
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Send academy announcements, urgent alerts, class schedule changes, or links. Recipients receive real-time notifications with clickable links.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gray-50 border border-gray-100 shrink-0">
          <Megaphone className="w-4 h-4 text-[#0A9D8F]" />
          <span className="text-xs font-semibold text-gray-700">
            Global Admin Broadcasting
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <p className="font-bold">{feedback.type === 'success' ? 'Broadcast Delivered!' : 'Broadcast Failed'}</p>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs">
          <form onSubmit={handleSend} className="space-y-5">
            {/* 1. Target Audience */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-2">
                1. Select Target Audience
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {[
                  { id: 'all', label: 'All Users', icon: Users, sub: `${totalUsersCount} users` },
                  { id: 'students', label: 'All Students', icon: Users, sub: `${students.length} students` },
                  { id: 'course', label: 'By Course', icon: BookOpen, sub: `${courses.length} courses` },
                  { id: 'teachers', label: 'Teachers', icon: GraduationCap, sub: `${teachers.length} teachers` },
                  { id: 'specific', label: '1-on-1 User', icon: ShieldCheck, sub: '1 person' }
                ].map(opt => {
                  const Icon = opt.icon;
                  const isSelected = targetAudience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTargetAudience(opt.id as any)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#0A9D8F] bg-[#E6F5F4]/40 ring-1 ring-[#0A9D8F]'
                          : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Icon className="w-4 h-4 text-[#0A9D8F]" />
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[#0A9D8F]" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-gray-950 truncate">{opt.label}</p>
                      <p className="text-[10px] text-gray-400 truncate">{opt.sub}</p>
                    </button>
                  );
                })}
              </div>

              {/* Course-specific selection UI */}
              {targetAudience === 'course' && (
                <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      <span>Choose Target Course:</span>
                    </label>
                    <span className="text-[10px] font-semibold text-gray-500">
                      Only students enrolled in this course will receive it
                    </span>
                  </div>

                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#0A9D8F] transition-all"
                  >
                    <option value="">-- Select a course to broadcast to --</option>
                    {courses.map(course => {
                      const count = courseEnrollmentMap.get(course.id)?.size || 0;
                      return (
                        <option key={course.id} value={course.id}>
                          {course.title} ({count} {count === 1 ? 'student' : 'students'} enrolled)
                        </option>
                      );
                    })}
                  </select>

                  {selectedCourse && (
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200/80 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{selectedCourse.title}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                          {selectedCourse.category || 'Course'}
                        </span>
                      </div>
                      {selectedCourseStudentIds.length > 0 ? (
                        <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{selectedCourseStudentIds.length} enrolled {selectedCourseStudentIds.length === 1 ? 'student' : 'students'} will receive this announcement.</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>No students currently enrolled in this course yet.</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Specific user selection search */}
              {targetAudience === 'specific' && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-semibold text-gray-600">
                    Search & Select User:
                  </label>
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#0A9D8F]"
                  />
                  <div className="max-h-36 overflow-y-auto divide-y divide-gray-100 bg-white rounded-xl border border-gray-200">
                    {filteredPool.length === 0 ? (
                      <div className="p-2.5 text-[11px] text-gray-400 text-center">No users match search</div>
                    ) : (
                      filteredPool.slice(0, 10).map(u => (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`p-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            selectedUserId === u.id ? 'bg-[#E6F5F4] text-[#0A9D8F] font-bold' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{u.full_name || 'User'}</p>
                            <p className="text-[10px] text-gray-400">{u.email}</p>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {u.poolRole}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#0A9D8F] font-semibold bg-[#E6F5F4]/60 px-3 py-1.5 rounded-xl">
                <span>Audience target: Delivering to {targetLabel}.</span>
              </div>
            </div>

            {/* 2. Category */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                2. Category / Priority
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'announcement', label: 'Announcement' },
                  { id: 'urgent', label: 'Urgent / Important' },
                  { id: 'event', label: 'Live Event / Workshop' },
                  { id: 'system', label: 'System Notice' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      category === item.id
                        ? 'bg-[#0A9D8F] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Title */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                3. Broadcast Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Welcome to New Cohort! Important Academy Guidelines"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder:text-gray-400"
              />
            </div>

            {/* 4. Message Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-900">
                  4. Message Body *
                </label>
                <span className="text-[10px] text-gray-400">
                  URLs typed here will automatically become clickable links
                </span>
              </div>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write message... Any links included (e.g. https://ingeniumacademy.com or https://meet.google.com/...) will be clickable for all recipients."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder:text-gray-400 leading-relaxed"
              />
            </div>

            {/* 5. Optional Action Link */}
            <div>
              <label className="block text-xs font-bold text-gray-900 flex items-center gap-1.5 mb-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>5. Action Link / Resource URL (Optional)</span>
              </label>
              <input
                type="url"
                value={actionLink}
                onChange={(e) => setActionLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder:text-gray-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Adds a primary "Open Attached Link ↗" button directly on the user's notification card.
              </p>
            </div>

            {/* Send Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !message.trim() || (targetAudience === 'specific' && !selectedUserId)}
                className="w-full py-3 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting to Users...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Broadcast Message to {targetLabel}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Preview & History: 5 cols */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Preview Card */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-950">
                <Eye className="w-4 h-4 text-[#0A9D8F]" />
                <span>Recipient Preview</span>
              </div>
              <span className="text-[10px] text-gray-400">Live preview</span>
            </div>

            {/* Simulated Notification Item */}
            <div className="p-4 rounded-2xl bg-[#0A9D8F]/5 border border-[#0A9D8F]/25 text-left relative">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span 
                    className="w-2 h-2 rounded-full bg-[#0A9D8F] shrink-0" 
                    title="New unread message indicator"
                  />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-[#0A9D8F]">
                    Ingenium Academy
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 capitalize">
                    • {category}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-gray-400">
                  Just now
                </span>
              </div>

              <h4 className="text-xs font-bold text-gray-950 mb-1.5 leading-snug">
                {title.trim() || 'Broadcast Message Title'}
              </h4>

              <div className="text-xs text-gray-600 leading-relaxed break-words">
                {message.trim() ? (
                  <LinkifiedText text={message} />
                ) : (
                  <span className="text-gray-400 italic">
                    Your broadcast message and clickable links will appear here...
                  </span>
                )}
              </div>

              {actionLink.trim() && (
                <div className="mt-3 pt-2.5 border-t border-gray-100/80">
                  <a
                    href={normalizeUrl(actionLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] cursor-pointer shadow-xs"
                  >
                    <span>Open Attached Link</span>
                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.2]" />
                  </a>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              The green dot on the top notification bell turns on for all recipients.
            </p>
          </div>

          {/* Recently Broadcasted History */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <h3 className="text-xs font-bold text-gray-950 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Broadcast History (This Session)</span>
            </h3>

            {broadcastHistory.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-xs">
                <Megaphone className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>No broadcasts dispatched yet this session.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {broadcastHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-left text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                      <span className="font-bold text-[#0A9D8F]">{item.targetLabel}</span>
                      <span>{item.sentAt}</span>
                    </div>
                    <p className="font-bold text-gray-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{item.message}</p>
                    <div className="mt-1.5 text-[10px] font-semibold text-gray-400">
                      Delivered to {item.recipientCount} recipient{item.recipientCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
