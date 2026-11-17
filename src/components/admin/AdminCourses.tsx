import React, { useState } from 'react';
import { 
  Search, SlidersHorizontal, Plus, MoreVertical, 
  BookOpen, Edit, Clock, Eye, EyeOff, Trash2,
  UserPlus, X, AlertCircle, GraduationCap
} from 'lucide-react';
import { Course, Profile, TeacherCourseAssignment, CourseSchedule } from '../../types';
import { formatCapitalizedName } from '../../utils/nameFormatter';

interface AdminCoursesProps {
  courses: Course[];
  teachers?: Profile[];
  assignments?: TeacherCourseAssignment[];
  schedules?: CourseSchedule[];
  onCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onManageTimes: (course: Course) => void;
  onToggleStatus: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onAssignTeacher?: (teacherId: string, courseId: string, scheduleId?: string) => Promise<void>;
  onRemoveAssignment?: (assignmentId: string) => Promise<void>;
  onGoToTeachers?: () => void;
}

export const AdminCourses: React.FC<AdminCoursesProps> = ({
  courses,
  teachers = [],
  assignments = [],
  schedules = [],
  onCreateCourse,
  onEditCourse,
  onManageTimes,
  onToggleStatus,
  onDeleteCourse,
  onAssignTeacher,
  onRemoveAssignment,
  onGoToTeachers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Assign Teacher Modal State
  const [assigningCourse, setAssigningCourse] = useState<Course | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const openAssignModal = (course: Course) => {
    setAssigningCourse(course);
    setSelectedTeacherId('');
    setSelectedScheduleId('');
    setAssignError(null);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningCourse || !selectedTeacherId || !onAssignTeacher) return;
    setAssignError(null);
    setIsAssigning(true);
    try {
      await onAssignTeacher(selectedTeacherId, assigningCourse.id, selectedScheduleId || undefined);
      setSelectedTeacherId('');
      setSelectedScheduleId('');
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign teacher to this course.');
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'published') return matchesSearch && (course.is_published || course.status === 'published');
    if (activeFilter === 'draft') return matchesSearch && (!course.is_published && course.status !== 'archived');
    if (activeFilter === 'archived') return matchesSearch && course.status === 'archived';
    return matchesSearch;
  });

  const courseAssignmentsForModal = assigningCourse
    ? assignments.filter(a => a.course_id === assigningCourse.id)
    : [];
  const courseSchedulesForModal = assigningCourse
    ? schedules.filter(s => s.course_id === assigningCourse.id && s.is_active)
    : [];

  return (
    <div className="space-y-4 pb-20">
      {/* Search Bar & Filter Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0A9D8F] transition-all"
          />
        </div>
        <button
          aria-label="Filter courses"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        {(['all', 'published', 'draft', 'archived'] as const).map(tab => {
          const isActive = activeFilter === tab;
          const label = tab.charAt(0).toUpperCase() + tab.slice(1);
          return (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center transition-all cursor-pointer relative ${
                isActive ? 'text-[#0A9D8F]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Courses List or Empty State */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-6 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-gray-950">
              {searchQuery ? 'No matching courses found' : 'No courses available yet.'}
            </h3>
            <p className="text-xs text-gray-500">
              {searchQuery 
                ? 'Try adjusting your search query or filter settings.' 
                : 'Create your first course to make it available for students.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={onCreateCourse}
              className="inline-flex items-center gap-2 bg-[#0A9D8F] hover:bg-[#087A6F] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 space-y-0">
          {filteredCourses.map(course => {
            const isPublished = course.is_published || course.status === 'published';
            const courseAssignments = assignments.filter(a => a.course_id === course.id);
            const hasTeacher = course.has_assigned_teacher || courseAssignments.length > 0;
            const assignedTeacherLabel = course.teacher_name || courseAssignments[0]?.teacher_name || 'Assigned';
            const primaryPrice = course.pricing 
              ? (course.pricing.usd_price ? `$${course.pricing.usd_price}` : course.pricing.ngn_price ? `₦${course.pricing.ngn_price.toLocaleString()}` : `€${course.pricing.eur_price}`)
              : '$400';

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-[#0A9D8F]/25 p-4 flex gap-3.5 items-start shadow-xs hover:border-[#0A9D8F] transition-all relative"
              >
                {/* Course Thumbnail */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gray-100 border border-[#0A9D8F]/20 overflow-hidden shrink-0">
                  {course.image_url ? (
                    <img
                      src={course.image_url}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                      <BookOpen className="w-8 h-8 opacity-40 text-gray-600" />
                    </div>
                  )}
                </div>

                {/* Course Info */}
                <div className="flex-1 min-w-0 pr-6">
                  <h4 className="text-xs md:text-sm font-bold text-gray-950 truncate leading-snug">
                    {course.title}
                  </h4>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                      {course.category || 'Data Science'}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {course.duration || '8 Weeks'} • {course.level || 'Beginner'} • {course.training_mode === 'online' ? 'Live Online' : course.training_mode || 'Live Online'}
                    </span>
                    {hasTeacher ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
                        <span>Instructor:</span>
                        <span>{assignedTeacherLabel}</span>
                      </span>
                    ) : (
                      <span 
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                        title="Without a teacher assigned, this course is hidden from students to buy."
                      >
                        Awaiting Teacher (Hidden from Students)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs md:text-sm font-extrabold text-gray-950">
                        {primaryPrice}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isPublished
                          ? 'bg-[#E6F5F4] text-[#0A9D8F]'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>

                    {onAssignTeacher && (
                      <button
                        type="button"
                        onClick={() => openAssignModal(course)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          hasTeacher
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-[#0A9D8F] hover:bg-[#087A6F] text-white shadow-2xs'
                        }`}
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>{hasTeacher ? 'Manage Teacher' : 'Assign Teacher'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 3-Dots Action Menu */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === course.id ? null : course.id)}
                    aria-label="Course options"
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {openMenuId === course.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setOpenMenuId(null)}
                      />
                      <div className="absolute right-0 top-8 z-30 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 text-xs">
                        {onAssignTeacher && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              openAssignModal(course);
                            }}
                            className="w-full px-3.5 py-2 text-left font-medium text-[#0A9D8F] hover:bg-[#E6F5F4]/40 flex items-center gap-2 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5 text-[#0A9D8F]" />
                            <span>Assign Teacher</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onEditCourse(course);
                          }}
                          className="w-full px-3.5 py-2 text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-gray-400" />
                          <span>Edit Course</span>
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onManageTimes(course);
                          }}
                          className="w-full px-3.5 py-2 text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Class Times</span>
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            onToggleStatus(course);
                          }}
                          className="w-full px-3.5 py-2 text-left font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                        >
                          {isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                              <span>Set to Draft</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-gray-400" />
                              <span>Publish Course</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            if (confirm(`Are you sure you want to delete "${course.title}"?`)) {
                              onDeleteCourse(course.id);
                            }
                          }}
                          className="w-full px-3.5 py-2 text-left font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-gray-100 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span>Delete Course</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN TEACHER TO COURSE MODAL */}
      {assigningCourse && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Assign Teacher to Course</h3>
                <p className="text-xs text-gray-500 truncate max-w-sm">
                  {assigningCourse.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningCourse(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              {/* Current Assigned Teachers */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 mb-2">Currently Assigned Teachers</h4>
                {courseAssignmentsForModal.length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-xl">
                    No teacher assigned yet. Assign a teacher so they can fill in course details and teach this course.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {courseAssignmentsForModal.map(a => (
                      <div
                        key={a.id}
                        className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-gray-950">
                            {formatCapitalizedName(a.teacher_name || a.teacher_email, 'Instructor')}
                          </h5>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {a.teacher_email ? `${a.teacher_email} • ` : ''}{a.schedule_label || 'All Schedules'}
                          </p>
                        </div>
                        {onRemoveAssignment && (
                          <button
                            type="button"
                            onClick={() => onRemoveAssignment(a.id)}
                            className="text-xs font-bold text-gray-500 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign Teacher Form */}
              {teachers.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2.5">
                  <GraduationCap className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="text-xs font-bold text-gray-900">No Active Teachers Yet</p>
                  <p className="text-[11px] text-gray-600">
                    Invite a teacher first under the Teachers tab so they can register and be assigned to courses.
                  </p>
                  {onGoToTeachers && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigningCourse(null);
                        onGoToTeachers();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Go to Teachers & Invite
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAssignSubmit} className="pt-3 border-t border-gray-100 space-y-3">
                  <h4 className="text-xs font-bold text-gray-900">Assign a Teacher</h4>

                  {assignError && (
                    <div className="p-2.5 bg-red-50 text-red-700 border border-red-100 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{assignError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      Select Teacher *
                    </label>
                    <select
                      required
                      value={selectedTeacherId}
                      onChange={e => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                    >
                      <option value="">-- Choose Teacher --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {formatCapitalizedName(t.full_name || t.email, 'Instructor')} ({t.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  {courseSchedulesForModal.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-gray-800 mb-1">
                        Class Schedule (Optional)
                      </label>
                      <select
                        value={selectedScheduleId}
                        onChange={e => setSelectedScheduleId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-[#0A9D8F]"
                      >
                        <option value="">All Schedules for this Course</option>
                        {courseSchedulesForModal.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label} ({s.day_of_week} {s.start_time} - {s.end_time})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAssigning || !selectedTeacherId}
                    className="w-full py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isAssigning ? 'Assigning...' : 'Assign Teacher to Course'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

