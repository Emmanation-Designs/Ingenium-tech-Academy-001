import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, BookOpen, Clock, BarChart2, Plus, 
  Trash2, Check, AlertCircle, Sparkles, Globe,
  Calendar, Video, Eye, Send, CheckCircle2, Loader2
} from 'lucide-react';
import { Course, CourseSchedule } from '../../types';
import { getStoredMeetOverride } from '../../services/dataService';

interface TeacherCourseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  schedule?: CourseSchedule;
  initialMeetingUrl?: string;
  onSave: (
    courseId: string, 
    updates: Partial<Course>,
    scheduleUpdates?: {
      scheduleId?: string;
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
      meetingUrl?: string;
      scheduleLabel?: string;
    }
  ) => Promise<void>;
  isSaving?: boolean;
}

export const TeacherCourseManagerModal: React.FC<TeacherCourseManagerModalProps> = ({
  isOpen,
  onClose,
  course,
  schedule,
  initialMeetingUrl,
  onSave,
  isSaving = false
}) => {
  if (!isOpen || !course) return null;

  // Helper to parse duration amount & unit
  const parseDuration = (rawDuration?: string) => {
    if (!rawDuration) return { amount: '8', unit: 'Weeks' };
    const match = rawDuration.match(/^(\d+)\s*(days?|weeks?|months?|years?)/i);
    if (match) {
      const amount = match[1];
      const rawUnit = match[2].toLowerCase();
      let unit = 'Weeks';
      if (rawUnit.startsWith('day')) unit = 'Days';
      else if (rawUnit.startsWith('week')) unit = 'Weeks';
      else if (rawUnit.startsWith('month')) unit = 'Months';
      else if (rawUnit.startsWith('year')) unit = 'Years';
      return { amount, unit };
    }
    return { amount: '8', unit: 'Weeks' };
  };

  const initialDuration = parseDuration(course.duration);

  // Form states
  const [title, setTitle] = useState<string>(course.title || '');
  const [durationAmount, setDurationAmount] = useState<string>(initialDuration.amount);
  const [durationUnit, setDurationUnit] = useState<string>(initialDuration.unit);
  const [level, setLevel] = useState<string>(course.level || 'Beginner');
  const [shortDescription, setShortDescription] = useState<string>(course.short_description || '');
  const [description, setDescription] = useState<string>(course.description || '');
  
  // Publication Status State
  const [status, setStatus] = useState<'draft' | 'published'>(
    course.is_published || course.status === 'published' ? 'published' : 'draft'
  );

  // Live Class Schedule states
  const existingMeetUrl = initialMeetingUrl || schedule?.meeting_url || (course ? (getStoredMeetOverride(course.id) || '') : '') || '';
  const [dayOfWeek, setDayOfWeek] = useState<string>(schedule?.day_of_week || 'Saturdays');
  const [startTime, setStartTime] = useState<string>(schedule?.start_time ? schedule.start_time.slice(0, 5) : '10:00');
  const [endTime, setEndTime] = useState<string>(schedule?.end_time ? schedule.end_time.slice(0, 5) : '12:00');
  const [meetingUrl, setMeetingUrl] = useState<string>(existingMeetUrl);
  const [scheduleLabel, setScheduleLabel] = useState<string>(schedule?.label || 'Live Interactive Class');

  // Parse learning outcomes
  const parseLearningOutcomes = (): string[] => {
    if (course.what_you_will_learn) {
      if (Array.isArray(course.what_you_will_learn) && course.what_you_will_learn.length > 0) {
        return course.what_you_will_learn;
      }
      if (typeof course.what_you_will_learn === 'string' && course.what_you_will_learn.trim()) {
        try {
          const parsed = JSON.parse(course.what_you_will_learn);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          return course.what_you_will_learn.split('\n').map(s => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
        }
      }
    }
    const t = (course.title || '').toLowerCase();
    if (t.includes('design') || t.includes('ui') || t.includes('ux') || t.includes('figma')) {
      return [
        'User experience research and customer journey mapping',
        'Wireframing and interactive high-fidelity prototyping',
        'Design systems architecture and component libraries',
        'Client presentation and portfolio readiness'
      ];
    }
    if (t.includes('code') || t.includes('web') || t.includes('develop') || t.includes('software')) {
      return [
        'Core programming foundations and modern software standards',
        'Interactive frontends, API integrations, and database design',
        'Git version control, testing, and production deployment',
        'End-to-end practical capstone projects for your tech portfolio'
      ];
    }
    if (t.includes('data') || t.includes('analy')) {
      return [
        'Data analysis foundations, statistical formulas, and clean modeling',
        'Interactive business dashboards with Power BI / Excel',
        'Data cleaning, transformation, and structured preparation',
        'Data storytelling and insights communication for executive teams'
      ];
    }
    return [
      'Master fundamental and advanced industry competencies',
      'Hands-on weekly labs with real-world case studies',
      'Direct mentor review, code feedback, and live Q&A',
      'High-impact portfolio projects to accelerate your career'
    ];
  };

  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(parseLearningOutcomes());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Sync state if course or schedule changes
  useEffect(() => {
    if (course) {
      setTitle(course.title || '');
      const parsedDur = parseDuration(course.duration);
      setDurationAmount(parsedDur.amount);
      setDurationUnit(parsedDur.unit);
      setLevel(course.level || 'Beginner');
      setShortDescription(course.short_description || '');
      setDescription(course.description || '');
      setStatus(course.is_published || course.status === 'published' ? 'published' : 'draft');
      setLearningOutcomes(parseLearningOutcomes());
      setErrorMsg(null);
    }
    const effectiveMeet = initialMeetingUrl || schedule?.meeting_url || (course ? (getStoredMeetOverride(course.id) || '') : '') || '';
    if (schedule) {
      setDayOfWeek(schedule.day_of_week || 'Saturdays');
      setStartTime(schedule.start_time ? schedule.start_time.slice(0, 5) : '10:00');
      setEndTime(schedule.end_time ? schedule.end_time.slice(0, 5) : '12:00');
      setMeetingUrl(effectiveMeet);
      setScheduleLabel(schedule.label || 'Live Interactive Class');
    } else {
      setMeetingUrl(effectiveMeet);
    }
  }, [course?.id, schedule?.id, initialMeetingUrl]);

  const handleAddOutcome = () => {
    setLearningOutcomes(prev => [...prev, '']);
  };

  const handleUpdateOutcome = (index: number, val: string) => {
    setLearningOutcomes(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveOutcome = (index: number) => {
    setLearningOutcomes(prev => prev.filter((_, i) => i !== index));
  };

  const executeSave = async (publishIntent?: boolean) => {
    if (!course) return;

    if (!title.trim()) {
      setErrorMsg('Please enter a course name/title.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const cleanAmount = (durationAmount || '').trim();
    const validAmount = (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) ? '8' : cleanAmount;
    const combinedDuration = `${validAmount} ${durationUnit || 'Weeks'}`;

    const filteredOutcomes = learningOutcomes.map(o => o.trim()).filter(Boolean);
    const targetStatus: 'draft' | 'published' = publishIntent !== undefined 
      ? (publishIntent ? 'published' : 'draft') 
      : status;

    const finalMeetingUrl = meetingUrl.trim() !== '' 
      ? meetingUrl.trim() 
      : (initialMeetingUrl?.trim() || schedule?.meeting_url?.trim() || '');

    setErrorMsg(null);
    try {
      await onSave(
        course.id, 
        {
          title: title.trim(),
          duration: combinedDuration,
          level,
          short_description: shortDescription.trim(),
          description: description.trim() || `Comprehensive curriculum and interactive coursework for ${title.trim()}.`,
          what_you_will_learn: filteredOutcomes,
          status: targetStatus,
          is_published: targetStatus === 'published'
        },
        {
          scheduleId: schedule?.id,
          dayOfWeek: dayOfWeek.trim() || 'Flexible / Online',
          startTime: startTime.trim() || '18:00',
          endTime: endTime.trim() || '20:00',
          meetingUrl: finalMeetingUrl,
          scheduleLabel: scheduleLabel.trim() || 'Live Interactive Class'
        }
      );
      onClose();
    } catch (err: any) {
      console.error('[TeacherCourseManager] Save error:', err);
      setErrorMsg(err.message || 'Failed to update course details. Please try again.');
      formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave();
  };

  const isCurrentlyPublished = course.is_published || course.status === 'published';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full my-8 shadow-2xl border border-[#0A9D8F]/25 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#0A9D8F]/15 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-950">Manage Course & Syllabus</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  status === 'published'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}>
                  {status === 'published' ? '● Published' : '○ Draft'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium truncate max-w-md">
                Edit name, duration, live schedule, and student curriculum
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2 border border-red-200 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Course Publication Status Switcher */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#0A9D8F]" />
                <span className="text-xs font-bold text-gray-900">Publishing Status</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {status === 'published' 
                  ? 'Visible on public discovery catalog and student classroom.' 
                  : 'Course is in draft mode and hidden from public discovery.'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    status === 'draft'
                      ? 'bg-amber-100 text-amber-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('published')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    status === 'published'
                      ? 'bg-[#0A9D8F] text-white shadow-2xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>Published</span>
                </button>
              </div>

              {status !== (course.is_published || course.status === 'published' ? 'published' : 'draft') && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => executeSave(status === 'published')}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  {status === 'published' ? 'Publish Now' : 'Save Draft'}
                </button>
              )}
            </div>
          </div>

          {/* 2. Course Name / Title */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Course Name / Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Full-Stack Web Development, UI/UX Design..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
            />
          </div>

          {/* 3. Duration & Level Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>Course Duration *</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationAmount}
                    onChange={e => setDurationAmount(e.target.value)}
                    placeholder="8"
                    className="w-full px-3 py-2 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all text-center"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={durationUnit}
                    onChange={e => setDurationUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
                  >
                    <option value="Days">Days</option>
                    <option value="Weeks">Weeks</option>
                    <option value="Months">Months</option>
                    <option value="Years">Years</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Display: {durationAmount || '8'} {durationUnit}
              </p>
            </div>

            {/* Level */}
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>Target Skill Level *</span>
              </label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="All Levels">All Levels</option>
              </select>
            </div>
          </div>

          {/* 4. Live Class Times & Schedule */}
          <div className="p-4 bg-[#E6F5F4]/20 rounded-2xl border border-[#0A9D8F]/25 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>Live Class Times & Schedule</span>
              </label>
              <span className="text-[10px] text-[#0A9D8F] font-bold">
                Student Live Cohort
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Day(s) of Week
                </label>
                <input
                  type="text"
                  value={dayOfWeek}
                  onChange={e => setDayOfWeek(e.target.value)}
                  placeholder="e.g. Saturdays or Mon, Wed, Fri"
                  className="w-full px-3 py-1.5 bg-white border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>
            </div>

            {/* Google Meet Link */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center gap-1">
                <Video className="w-3 h-3 text-[#0A9D8F]" />
                <span>Google Meet Link (Optional)</span>
              </label>
              <input
                type="url"
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                className="w-full px-3 py-1.5 bg-white border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] placeholder-gray-400"
              />
            </div>
          </div>

          {/* 5. Subtitle / Tagline */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              Course Tagline / Brief Subtitle
            </label>
            <input
              type="text"
              value={shortDescription}
              onChange={e => setShortDescription(e.target.value)}
              placeholder="e.g. Master modern frontend development and cloud deployment with live hands-on labs..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all placeholder-gray-400"
            />
          </div>

          {/* 6. What You Will Learn (Key Outcomes) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#0A9D8F] stroke-[3]" />
                <span>What Students Will Get / Learn</span>
              </label>
              <button
                type="button"
                onClick={handleAddOutcome}
                className="text-[11px] font-bold text-[#0A9D8F] hover:text-[#087A6F] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Outcome</span>
              </button>
            </div>

            <div className="space-y-2">
              {learningOutcomes.map((outcome, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                  </div>
                  <input
                    type="text"
                    value={outcome}
                    onChange={e => handleUpdateOutcome(idx, e.target.value)}
                    placeholder={`Key takeaway #${idx + 1}...`}
                    className="flex-1 px-3 py-1.5 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all"
                  />
                  {learningOutcomes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOutcome(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Remove objective"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 7. Detailed Overview (Description) */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              About This Course (Detailed Overview) *
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide a comprehensive description of what this course covers, teaching methodology, project deliverables, and career benefits..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all leading-relaxed placeholder-gray-400"
            />
          </div>

          {/* Form Submit Footer */}
          <div className="pt-3 border-t border-[#0A9D8F]/15 flex flex-col gap-2 shrink-0">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2 border border-red-200 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {/* Save as Draft or Save Changes button */}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => executeSave(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save as Draft</span>
              </button>

              {/* Save & Publish Course Button */}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => executeSave(true)}
                className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Save & Publish Course</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
