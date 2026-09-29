import React, { useState } from 'react';
import { 
  X, BookOpen, Clock, BarChart2, Check, 
  Plus, Trash2, Save, AlertCircle, CheckCircle2, 
  Sparkles, Video, HelpCircle, Layers
} from 'lucide-react';
import { Course } from '../../types';
import { dataService } from '../../services/dataService';
import { parseDuration, formatDuration, parseWhatYouWillLearn, DurationUnit } from '../../utils/courseUtils';

interface TeacherManageCourseModalProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onCourseUpdated: (updated: Course) => void;
}

export const TeacherManageCourseModal: React.FC<TeacherManageCourseModalProps> = ({
  course,
  isOpen,
  onClose,
  onCourseUpdated
}) => {
  if (!isOpen || !course) return null;

  const initialDuration = parseDuration(course.duration);
  const initialOutcomes = parseWhatYouWillLearn(course.what_you_will_learn, course.title, course.category);

  // Form states
  const [description, setDescription] = useState<string>(
    course.description || course.short_description || ''
  );
  const [shortDescription, setShortDescription] = useState<string>(
    course.short_description || ''
  );
  const [durationValue, setDurationValue] = useState<string>(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(initialDuration.unit);
  const [level, setLevel] = useState<string>(course.level || 'Beginner');
  const [trainingMode, setTrainingMode] = useState<string>(course.training_mode || 'online');

  // Learning outcomes list
  const [outcomes, setOutcomes] = useState<string[]>(
    initialOutcomes.length > 0 ? initialOutcomes : [
      'Master core concepts and foundational skills',
      'Build hands-on practical portfolio projects',
      'Data preparation and structured problem-solving',
      'Direct instructor feedback and career readiness'
    ]
  );
  const [newOutcomeInput, setNewOutcomeInput] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleAddOutcome = () => {
    const trimmed = newOutcomeInput.trim();
    if (!trimmed) return;
    setOutcomes([...outcomes, trimmed]);
    setNewOutcomeInput('');
  };

  const handleRemoveOutcome = (index: number) => {
    setOutcomes(outcomes.filter((_, i) => i !== index));
  };

  const handleOutcomeChange = (index: number, val: string) => {
    const updated = [...outcomes];
    updated[index] = val;
    setOutcomes(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!description.trim()) {
      setFeedback({ type: 'error', message: 'Please write an "About this course" description.' });
      return;
    }

    const cleanOutcomes = outcomes.map(o => o.trim()).filter(Boolean);
    if (cleanOutcomes.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one learning outcome under "What you will learn".' });
      return;
    }

    const formattedDuration = formatDuration(durationValue, durationUnit);

    setIsSaving(true);
    try {
      const updatedCourse = await dataService.updateCourse(course.id, {
        description: description.trim(),
        short_description: shortDescription.trim() || description.trim().slice(0, 120),
        duration: formattedDuration,
        level: level as any,
        training_mode: trainingMode as any,
        what_you_will_learn: JSON.stringify(cleanOutcomes)
      });

      setFeedback({ type: 'success', message: 'Course information and curriculum details saved successfully!' });
      onCourseUpdated(updatedCourse);
      
      // Auto close after brief moment
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update course:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to update course information.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-950">Manage Course Curriculum & Details</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                  Instructor Controls
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium truncate max-w-sm">
                {course.title} • {course.category || 'Course'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Info Banner */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-2.5 text-xs text-gray-600">
            <Sparkles className="w-4 h-4 text-[#0A9D8F] shrink-0 mt-0.5" />
            <p>
              As the assigned instructor, provide the authoritative syllabus information, course description, learning outcomes, duration, and level. This content is displayed directly to prospective students before purchase and to enrolled students.
            </p>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* 1. About this Course (Full Description) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900">
                About this Course (Description) <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">
                Shown under "About this course" on student page
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a comprehensive description of what this course entails, why students should take it, and how it will transform their career..."
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] transition-all leading-relaxed placeholder:text-gray-400 bg-white"
            />
          </div>

          {/* 2. Short Tagline / Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-900">
              Short Tagline / Summary
            </label>
            <input
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="e.g. Master modern analytics with hands-on live mentorship"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] transition-all placeholder:text-gray-400"
            />
          </div>

          {/* 3. Duration & Level (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Duration: Number input + Unit Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>Course Duration <span className="text-red-500">*</span></span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={durationValue}
                  onChange={(e) => setDurationValue(e.target.value)}
                  placeholder="8"
                  className="w-24 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#0A9D8F] bg-white text-center"
                />
                <select
                  value={durationUnit}
                  onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#0A9D8F] bg-white cursor-pointer"
                >
                  <option value="Days">Days</option>
                  <option value="Weeks">Weeks</option>
                  <option value="Months">Months</option>
                  <option value="Years">Years</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-400">
                Preview: <strong className="text-gray-700">{formatDuration(durationValue, durationUnit)}</strong>
              </p>
            </div>

            {/* Level: Dropdown with Beginner, Intermediate, Advanced */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#0A9D8F]" />
                <span>Difficulty Level <span className="text-red-500">*</span></span>
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#0A9D8F] bg-white cursor-pointer"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="All Levels">All Levels</option>
              </select>
              <p className="text-[10px] text-gray-400">
                Shown in the "Level" stat box on course page.
              </p>
            </div>
          </div>

          {/* 4. What You Will Learn (Interactive Bullet Outcomes) */}
          <div className="space-y-2.5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#0A9D8F] stroke-[3]" />
                  <span>What You Will Learn (Learning Outcomes) <span className="text-red-500">*</span></span>
                </label>
                <p className="text-[11px] text-gray-400">
                  These items appear with green checkmarks under "What you will learn"
                </p>
              </div>
              <span className="text-xs font-bold text-[#0A9D8F] bg-[#E6F5F4] px-2.5 py-0.5 rounded-full">
                {outcomes.length} Points
              </span>
            </div>

            {/* Existing list */}
            <div className="space-y-2">
              {outcomes.map((outcome, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <input
                    type="text"
                    required
                    value={outcome}
                    onChange={(e) => handleOutcomeChange(idx, e.target.value)}
                    placeholder="e.g. Master core analytical formulas and modeling"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOutcome(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Remove point"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new point input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newOutcomeInput}
                onChange={(e) => setNewOutcomeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOutcome();
                  }
                }}
                placeholder="+ Add another learning outcome point..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-dashed border-gray-300 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#0A9D8F] bg-gray-50/50"
              />
              <button
                type="button"
                onClick={handleAddOutcome}
                disabled={!newOutcomeInput.trim()}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-[#0A9D8F] hover:text-white text-gray-700 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Course Info...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Course Details</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
