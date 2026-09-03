import React, { useState } from 'react';
import { 
  Search, SlidersHorizontal, Plus, MoreVertical, 
  BookOpen, Edit, Clock, Eye, EyeOff, Trash2 
} from 'lucide-react';
import { Course } from '../../types';

interface AdminCoursesProps {
  courses: Course[];
  onCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onManageTimes: (course: Course) => void;
  onToggleStatus: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
}

export const AdminCourses: React.FC<AdminCoursesProps> = ({
  courses,
  onCreateCourse,
  onEditCourse,
  onManageTimes,
  onToggleStatus,
  onDeleteCourse
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'published') return matchesSearch && (course.is_published || course.status === 'published');
    if (activeFilter === 'draft') return matchesSearch && (!course.is_published && course.status !== 'archived');
    if (activeFilter === 'archived') return matchesSearch && course.status === 'archived';
    return matchesSearch;
  });

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
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#00B074] transition-all"
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
                isActive ? 'text-[#00B074]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B074]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Courses List or Empty State */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-6 space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#EAFBF3] text-[#00B074] flex items-center justify-center mx-auto">
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
              className="inline-flex items-center gap-2 bg-[#00B074] hover:bg-[#00905D] text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Course</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map(course => {
            const isPublished = course.is_published || course.status === 'published';
            const primaryPrice = course.pricing 
              ? (course.pricing.usd_price ? `$${course.pricing.usd_price}` : course.pricing.ngn_price ? `₦${course.pricing.ngn_price.toLocaleString()}` : `€${course.pricing.eur_price}`)
              : '$400';

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-100/90 p-4 flex gap-3.5 items-start shadow-xs hover:border-gray-200 transition-all relative"
              >
                {/* Course Thumbnail */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gray-100 border border-gray-100 overflow-hidden shrink-0">
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

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EAFBF3] text-[#00B074]">
                      {course.category || 'Data Science'}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {course.duration || '8 Weeks'} • {course.training_mode === 'online' ? 'Live Online' : course.training_mode || 'Live Online'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs md:text-sm font-extrabold text-gray-950">
                      {primaryPrice}
                    </span>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isPublished
                        ? 'bg-[#EAFBF3] text-[#00B074]'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
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
    </div>
  );
};
