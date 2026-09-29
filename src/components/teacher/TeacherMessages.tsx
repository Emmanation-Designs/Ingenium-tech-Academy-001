import React, { useState } from 'react';
import { 
  Send, Users, BookOpen, Link as LinkIcon, 
  CheckCircle2, AlertCircle, Sparkles, MessageSquare, 
  ExternalLink, Eye, Clock, ShieldCheck
} from 'lucide-react';
import { Profile, Course } from '../../types';
import { dataService } from '../../services/dataService';
import { LinkifiedText, normalizeUrl } from '../../utils/linkUtils';

interface TeacherClassItem {
  course: Course;
  schedule?: any;
  schedules?: any[];
  meetingUrl?: string;
  students: Array<{
    id: string;
    name: string;
    email: string;
    enrolledAt: string;
    status?: string;
    enrollmentStatus?: string;
    scheduleLabel?: string;
  }>;
}

interface TeacherMessagesProps {
  currentUser: Profile;
  classes: TeacherClassItem[];
  allStudents: Array<{
    id: string;
    name: string;
    email: string;
    courseTitle: string;
    enrolledAt: string;
    scheduleLabel?: string;
  }>;
  onRefresh?: () => void;
}

export const TeacherMessages: React.FC<TeacherMessagesProps> = ({
  currentUser,
  classes,
  allStudents,
  onRefresh
}) => {
  const [targetType, setTargetType] = useState<'all' | 'specific_course'>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    classes.length > 0 ? classes[0].course.id : ''
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionLink, setActionLink] = useState('');
  const [category, setCategory] = useState<'announcement' | 'live_session' | 'assignment' | 'urgent'>('announcement');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sent history (in-memory & reactive)
  const [sentHistory, setSentHistory] = useState<Array<{
    id: string;
    title: string;
    message: string;
    link?: string;
    targetName: string;
    recipientCount: number;
    sentAt: string;
    category: string;
  }>>([]);

  // Calculate recipients count for current selection
  const currentTargetClass = classes.find(c => c.course.id === selectedCourseId);
  const recipientCount = targetType === 'all' 
    ? allStudents.length 
    : (currentTargetClass?.students.length || 0);

  const selectedCourseTitle = targetType === 'all' 
    ? `All My Students (${allStudents.length})` 
    : (currentTargetClass?.course.title || 'Selected Class');

  // Quick action: insert meeting URL from selected course if exists
  const handleInsertMeetUrl = () => {
    if (currentTargetClass?.meetingUrl) {
      setActionLink(currentTargetClass.meetingUrl);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'Please provide an announcement title.' });
      return;
    }
    if (!message.trim()) {
      setFeedback({ type: 'error', message: 'Please write the message content for your students.' });
      return;
    }
    if (recipientCount === 0) {
      setFeedback({ 
        type: 'error', 
        message: 'No enrolled students found in this target. Messages can only be sent to students enrolled in your courses.' 
      });
      return;
    }

    if (actionLink.trim()) {
      const trimmed = actionLink.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('www.')) {
        setFeedback({ 
          type: 'error', 
          message: 'The action link must be a valid URL starting with https:// (e.g. https://meet.google.com/...)' 
        });
        return;
      }
    }

    setIsSending(true);

    try {
      const res = await dataService.notifications.send({
        senderId: currentUser.id,
        senderRole: 'teacher',
        senderName: currentUser.full_name || 'Class Instructor',
        title: title.trim(),
        message: message.trim(),
        link: actionLink.trim() ? normalizeUrl(actionLink.trim()) : undefined,
        targetAudience: targetType === 'all' ? 'course_students' : 'course_students',
        courseId: targetType === 'specific_course' ? selectedCourseId : undefined,
        category
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to deliver notification.' });
        return;
      }

      setFeedback({ 
        type: 'success', 
        message: `Notification successfully broadcasted to ${res.deliveredCount || recipientCount} students!` 
      });

      // Add to sent history
      setSentHistory(prev => [
        {
          id: String(Date.now()),
          title: title.trim(),
          message: message.trim(),
          link: actionLink.trim() ? normalizeUrl(actionLink.trim()) : undefined,
          targetName: selectedCourseTitle,
          recipientCount: res.deliveredCount || recipientCount,
          sentAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category
        },
        ...prev
      ]);

      // Reset fields
      setTitle('');
      setMessage('');
      setActionLink('');

      if (onRefresh) onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Network error while delivering notification.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] uppercase tracking-wider">
              Instructor Communication
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              Teacher to Students Only
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-950">
            Student Announcements & Messages
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            Send class updates, Google Meet links, homework notes, and reminders. Students receive real-time notifications with clickable links.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gray-50 border border-gray-100 shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#0A9D8F]" />
          <span className="text-xs font-semibold text-gray-700">
            {allStudents.length} Students Across {classes.length} Classes
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
            <p className="font-bold">{feedback.type === 'success' ? 'Announcement Sent!' : 'Unable to Send'}</p>
            <p className="mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-xs">
          <form onSubmit={handleSend} className="space-y-5">
            {/* 1. Recipient Audience Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-2">
                1. Select Recipients
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
                <button
                  type="button"
                  onClick={() => setTargetType('all')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    targetType === 'all'
                      ? 'border-[#0A9D8F] bg-[#E6F5F4]/40 ring-1 ring-[#0A9D8F]'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-950 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      All My Students
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {allStudents.length} total enrolled students
                    </p>
                  </div>
                  {targetType === 'all' && (
                    <div className="w-2 h-2 rounded-full bg-[#0A9D8F] shrink-0 ml-2" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('specific_course')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    targetType === 'specific_course'
                      ? 'border-[#0A9D8F] bg-[#E6F5F4]/40 ring-1 ring-[#0A9D8F]'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-950 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      Specific Class
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      Target 1 class group
                    </p>
                  </div>
                  {targetType === 'specific_course' && (
                    <div className="w-2 h-2 rounded-full bg-[#0A9D8F] shrink-0 ml-2" />
                  )}
                </button>
              </div>

              {/* Course dropdown if specific class selected */}
              {targetType === 'specific_course' && (
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in duration-150">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                    Choose Class:
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:border-[#0A9D8F]"
                  >
                    {classes.map(c => (
                      <option key={c.course.id} value={c.course.id}>
                        {c.course.title} ({c.students.length} students)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Delivery notice */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#0A9D8F] font-semibold bg-[#E6F5F4]/60 px-3 py-1.5 rounded-xl">
                <span>Delivering to {recipientCount} enrolled student{recipientCount !== 1 ? 's' : ''} in {selectedCourseTitle}.</span>
              </div>
            </div>

            {/* 2. Announcement Category */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5">
                2. Notification Type
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'announcement', label: 'General Announcement' },
                  { id: 'live_session', label: 'Live Session / Meeting' },
                  { id: 'assignment', label: 'Assignment / Material' },
                  { id: 'urgent', label: 'Urgent Notice' }
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
                3. Notification Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Live Class Link & Code Review Prep"
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
                placeholder="Write your message here... Any links inserted (e.g. https://meet.google.com/abc-xyz or https://github.com/...) will automatically be clickable for students."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder:text-gray-400 leading-relaxed"
              />
            </div>

            {/* 5. Optional Action Link */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[#0A9D8F]" />
                  <span>5. Dedicated Action Link (Optional)</span>
                </label>
                {currentTargetClass?.meetingUrl && (
                  <button
                    type="button"
                    onClick={handleInsertMeetUrl}
                    className="text-[11px] font-bold text-[#0A9D8F] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Use My Google Meet Link</span>
                  </button>
                )}
              </div>
              <input
                type="url"
                value={actionLink}
                onChange={(e) => setActionLink(e.target.value)}
                placeholder="https://meet.google.com/... or https://classroom.google.com/..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder:text-gray-400"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Displays a prominent "Open Attached Link ↗" button on the notification card.
              </p>
            </div>

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending || !title.trim() || !message.trim() || recipientCount === 0}
                className="w-full py-3 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Sending Notification to Students...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Announcement to {recipientCount} Student{recipientCount !== 1 ? 's' : ''}</span>
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
                <span>Student Preview</span>
              </div>
              <span className="text-[10px] text-gray-400">Live preview</span>
            </div>

            {/* Simulated Notification Item */}
            <div className="p-4 rounded-2xl bg-[#0A9D8F]/5 border border-[#0A9D8F]/25 text-left relative">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Green dot for unread notification */}
                  <span 
                    className="w-2 h-2 rounded-full bg-[#0A9D8F] shrink-0" 
                    title="New unread message indicator"
                  />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                    Instructor: {currentUser.full_name || 'Instructor'}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 capitalize">
                    • {category.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-gray-400">
                  Just now
                </span>
              </div>

              <h4 className="text-xs font-bold text-gray-950 mb-1.5 leading-snug">
                {title.trim() || 'Class Announcement Title'}
              </h4>

              <div className="text-xs text-gray-600 leading-relaxed break-words">
                {message.trim() ? (
                  <LinkifiedText text={message} />
                ) : (
                  <span className="text-gray-400 italic">
                    Your message text and clickable links will appear here...
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
              The green dot on the student's notification bell turns on immediately when received.
            </p>
          </div>

          {/* Recently Sent History */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <h3 className="text-xs font-bold text-gray-950 mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Recent Announcements Sent Today</span>
            </h3>

            {sentHistory.length === 0 ? (
              <div className="py-6 text-center text-gray-400 text-xs">
                <MessageSquare className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                <p>No announcements sent this session.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sentHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-left text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                      <span className="font-bold text-[#0A9D8F]">{item.targetName}</span>
                      <span>{item.sentAt}</span>
                    </div>
                    <p className="font-bold text-gray-900 truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{item.message}</p>
                    <div className="mt-1.5 text-[10px] font-semibold text-gray-400">
                      Delivered to {item.recipientCount} student{item.recipientCount !== 1 ? 's' : ''}
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
