import React, { useState, useEffect } from 'react';
import { 
  X, Save, BookOpen, Clock, BarChart2, Plus, 
  Trash2, Check, AlertCircle, Sparkles, HelpCircle, Eye
} from 'lucide-react';
import { Course } from '../../types';

interface TeacherCourseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course | null;
  onSave: (courseId: string, updates: Partial<Course>) => Promise<void>;
  isSaving?: boolean;
}

export const TeacherCourseManagerModal: React.FC<TeacherCourseManagerModalProps> = ({
  isOpen,
  onClose,
  course,
  onSave,
  isSaving = false
}) => {
  if (!isOpen || !course) return null;

  // Parse existing duration (e.g. "8 Weeks", "3 Months", "10 Days", "1 Year")
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
  const [durationAmount, setDurationAmount] = useState<string>(initialDuration.amount);
  const [durationUnit, setDurationUnit] = useState<string>(initialDuration.unit);
  const [level, setLevel] = useState<string>(course.level || 'Beginner');
  const [shortDescription, setShortDescription] = useState<string>(course.short_description || '');
  const [description, setDescription] = useState<string>(course.description || '');

  // Parse learning outcomes
  const parseLearningOutcomes = (): string[] => {
    if (course.what_you_will_learn) {
      if (Array.isArray(course.what_you_will_learn) && course.what_you_will_learn.length > 0) {
        return course.what_you_will_learn;
      }
      if (typeof course.what_you_will_learn === 'string' && course.what_you_will_learn.trim()) {
        return course.what_you_will_learn.split('\n').map(s => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
      }
    }
    // Intelligent defaults based on course title if empty
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

  // Sync state if course changes
  useEffect(() => {
    if (course) {
      const parsedDur = parseDuration(course.duration);
      setDurationAmount(parsedDur.amount);
      setDurationUnit(parsedDur.unit);
      setLevel(course.level || 'Beginner');
      setShortDescription(course.short_description || '');
      setDescription(course.description || '');
      setLearningOutcomes(parseLearningOutcomes());
      setErrorMsg(null);
    }
  }, [course?.id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;

    if (!durationAmount || Number(durationAmount) <= 0) {
      setErrorMsg('Please enter a valid positive number for course duration.');
      return;
    }

    const filteredOutcomes = learningOutcomes.map(o => o.trim()).filter(Boolean);
    const combinedDuration = `${durationAmount} ${durationUnit}`;

    setErrorMsg(null);
    try {
      await onSave(course.id, {
        duration: combinedDuration,
        level,
        short_description: shortDescription.trim(),
        description: description.trim(),
        what_you_will_learn: filteredOutcomes
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update course details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full my-8 shadow-2xl border border-[#0A9D8F]/25 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#0A9D8F]/15 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-950">Manage Course Details</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                  Instructor Syllabus
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium truncate max-w-md">
                {course.title}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Information Notice */}
          <div className="p-3.5 bg-[#E6F5F4]/30 rounded-2xl border border-[#0A9D8F]/20 text-xs text-gray-600 leading-relaxed flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-[#0A9D8F] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-gray-900">What students will see:</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                The information you set here (Duration, Level, About This Course, and What You Will Learn) is immediately visible on the public student portal.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Duration and Level Controls */}
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
                Preview: {durationAmount || '8'} {durationUnit}
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
              <p className="text-[10px] text-gray-400 mt-1">
                Helps students choose courses matching their experience.
              </p>
            </div>
          </div>

          {/* 2. Subtitle / Tagline */}
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
            <p className="text-[10px] text-gray-400 mt-1">
              Short summary displayed right below the course title.
            </p>
          </div>

          {/* 3. About This Course (Full Description) */}
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1.5">
              About This Course (Detailed Overview) *
            </label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide a comprehensive description of what this course covers, the teaching methodology, project deliverables, and career benefits..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-[#0A9D8F]/30 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F] focus:bg-white transition-all leading-relaxed placeholder-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Displayed under the "About this course" section in student details.
            </p>
          </div>

          {/* 4. What You Will Learn (Key Outcomes) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#0A9D8F] stroke-[3]" />
                <span>What You Will Learn (Key Takeaways)</span>
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
                    placeholder={`Learning objective #${idx + 1}...`}
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
            <p className="text-[10px] text-gray-400 mt-1.5">
              These points appear with checkmarks under "What you will learn".
            </p>
          </div>

          {/* Form Submit Footer */}
          <div className="pt-3 border-t border-[#0A9D8F]/15 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Course Details'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
