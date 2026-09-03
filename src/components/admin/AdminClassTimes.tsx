import React, { useState } from 'react';
import { 
  ArrowLeft, Plus, Clock, MoreVertical, 
  Trash2, Check, X, Calendar 
} from 'lucide-react';
import { Course, CourseSchedule } from '../../types';

interface AdminClassTimesProps {
  course: Course;
  schedules: CourseSchedule[];
  onBack: () => void;
  onAddSchedule: (scheduleData: {
    course_id: string;
    label: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    timezone: string;
  }) => Promise<void>;
  onToggleActive: (schedule: CourseSchedule) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
}

export const AdminClassTimes: React.FC<AdminClassTimesProps> = ({
  course,
  schedules,
  onBack,
  onAddSchedule,
  onToggleActive,
  onDeleteSchedule
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'details' | 'times' | 'students' | 'requests'>('times');
  const [showAddModal, setShowAddModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Form states
  const [label, setLabel] = useState('Weekday Morning (Mon & Wed)');
  const [dayOfWeek, setDayOfWeek] = useState('Mon & Wed');
  const [startTime, setStartTime] = useState('09:00:00');
  const [endTime, setEndTime] = useState('11:00:00');
  const [timezone, setTimezone] = useState('Africa/Lagos');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onAddSchedule({
        course_id: course.id,
        label: label.trim() || `${dayOfWeek} (${startTime.slice(0, 5)} - ${endTime.slice(0, 5)})`,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        timezone
      });
      setShowAddModal(false);
      setLabel('Weekday Morning (Mon & Wed)');
    } catch (e: any) {
      alert('Error creating class time: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-4 pb-20 max-w-xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="overflow-hidden">
            <h2 className="text-base font-bold text-gray-950 truncate max-w-[220px] md:max-w-md">
              {course.title}
            </h2>
            <p className="text-[11px] text-gray-500 font-medium">Course Schedule Management</p>
          </div>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex border-b border-gray-200">
        {(['details', 'times', 'students', 'requests'] as const).map(tab => {
          const isActive = activeSubTab === tab;
          const labels = {
            details: 'Details',
            times: 'Class Times',
            students: 'Students',
            requests: 'Requests'
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all cursor-pointer relative ${
                isActive ? 'text-[#0A9D8F]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {labels[tab]}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F]" />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}
      {activeSubTab === 'times' && (
        <div className="space-y-4 pt-1">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-950">
              Available Class Times
            </h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Time</span>
            </button>
          </div>

          {/* List of Schedules */}
          {schedules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-4 space-y-4 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-950">No class times available.</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Add available class times so students can select when they want to learn.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Class Time</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {schedules.map(sch => (
                <div
                  key={sch.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs flex items-center justify-between hover:border-gray-200 transition-all relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0A9D8F] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-950">
                        {sch.day_of_week || 'Scheduled Days'}
                      </p>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5">
                        {formatTime(sch.start_time)} - {formatTime(sch.end_time)}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium">
                        {sch.timezone || 'Africa/Lagos'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sch.is_active ? 'bg-[#E6F5F4] text-[#0A9D8F]' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {sch.is_active ? 'Active' : 'Inactive'}
                    </span>

                    <button
                      onClick={() => setOpenMenuId(openMenuId === sch.id ? null : sch.id)}
                      className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {openMenuId === sch.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-3 top-12 z-30 w-36 bg-white border border-gray-100 rounded-xl shadow-lg py-1 text-xs">
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              onToggleActive(sch);
                            }}
                            className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                          >
                            {sch.is_active ? 'Set Inactive' : 'Set Active'}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              if (confirm('Delete this class time?')) {
                                onDeleteSchedule(sch.id);
                              }
                            }}
                            className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Other subtabs */}
      {activeSubTab === 'details' && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider text-gray-400">
            Course Overview
          </h4>
          <p className="text-xs text-gray-700 leading-relaxed">
            {course.description || course.short_description || 'No detailed description written.'}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 font-medium">Duration:</span>
              <p className="font-bold text-gray-900">{course.duration || '8 Weeks'}</p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Training Mode:</span>
              <p className="font-bold text-gray-900 capitalize">{course.training_mode || 'Online'}</p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'students' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center shadow-xs">
          <p className="text-xs text-gray-500 font-medium">
            Active enrolled students for this course will be shown here.
          </p>
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center shadow-xs">
          <p className="text-xs text-gray-500 font-medium">
            Course requests submitted specifically for this course.
          </p>
        </div>
      )}

      {/* Modal / Sheet to Add Class Time */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-gray-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-950">Add Available Class Time</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Schedule Label
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Weekday Morning (Mon & Wed)"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Days of Week
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0A9D8F]"
                >
                  <option value="Mon & Wed">Mon & Wed</option>
                  <option value="Tue & Thu">Tue & Thu</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                  <option value="Sat & Sun">Sat & Sun (Weekend)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0A9D8F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#0A9D8F]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Class Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
