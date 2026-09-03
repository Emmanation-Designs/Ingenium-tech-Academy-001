import React, { useState } from 'react';
import { 
  Search, SlidersHorizontal, Users, ArrowLeft, 
  ChevronRight, Edit, BookOpen, Clock, ShieldCheck, 
  Calendar, Globe, CheckCircle2, Check, Loader2 
} from 'lucide-react';
import { Profile, CourseSelection, Enrollment, Course } from '../../types';

interface AdminStudentsProps {
  students: Profile[];
  selections: CourseSelection[];
  enrollments: Enrollment[];
  courses: Course[];
  selectedStudent: Profile | null;
  onSelectStudent: (student: Profile | null) => void;
  onApproveSelection?: (selectionId: string) => Promise<void>;
  onRejectSelection?: (selectionId: string) => Promise<void>;
}

export const AdminStudents: React.FC<AdminStudentsProps> = ({
  students,
  selections,
  enrollments,
  courses,
  selectedStudent,
  onSelectStudent,
  onApproveSelection,
  onRejectSelection
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'selections' | 'enrollments' | 'activity'>('overview');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredStudents = students.filter(s => 
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If a student is selected, render SCREEN 8: STUDENT DETAILS
  if (selectedStudent) {
    const studentSelections = selections.filter(s => s.student_id === selectedStudent.id);
    const studentEnrollments = enrollments.filter(e => e.student_id === selectedStudent.id);
    const approvedSelections = studentSelections.filter(s => s.status === 'approved');

    const joinDateStr = new Date(selectedStudent.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <div className="space-y-4 pb-20 max-w-xl mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectStudent(null)}
              className="p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-gray-950">Student Details</h2>
          </div>
          <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">
            <Edit className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100/90 p-5 shadow-xs flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#E6F5F4] border-2 border-[#0A9D8F]/30 flex items-center justify-center text-[#0A9D8F] font-black text-xl mb-3 shadow-xs">
            {selectedStudent.full_name?.charAt(0).toUpperCase() || 'S'}
          </div>

          <h3 className="text-base font-black text-gray-950">
            {selectedStudent.full_name || 'Student Name'}
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            {selectedStudent.email}
          </p>

          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-gray-600 flex-wrap">
            <span className="flex items-center gap-1.5 font-semibold">
              <Globe className="w-3.5 h-3.5 text-[#0A9D8F]" />
              <span>{selectedStudent.country || 'International'}</span>
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">
              {selectedStudent.timezone || 'Africa/Lagos (GMT+1)'}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">
              Joined {joinDateStr}
            </span>
          </div>
        </div>

        {/* Tabs: Overview | Selections | Enrollments | Activity */}
        <div className="flex border-b border-gray-200">
          {(['overview', 'selections', 'enrollments', 'activity'] as const).map(tab => {
            const isActive = activeDetailTab === tab;
            const label = tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <button
                key={tab}
                onClick={() => setActiveDetailTab(tab)}
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

        {/* Row of 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs text-center">
            <p className="text-[11px] text-gray-500 font-medium">Selected</p>
            <p className="text-lg font-black text-gray-950 mt-0.5">{studentSelections.length}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs text-center">
            <p className="text-[11px] text-gray-500 font-medium">Approved</p>
            <p className="text-lg font-black text-gray-950 mt-0.5">{approvedSelections.length}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs text-center">
            <p className="text-[11px] text-gray-500 font-medium">Enrollments</p>
            <p className="text-lg font-black text-gray-950 mt-0.5">{studentEnrollments.length}</p>
          </div>
        </div>

        {/* Tab Content */}
        {(activeDetailTab === 'overview' || activeDetailTab === 'selections') && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider text-gray-500">
              Recent Selections
            </h4>

            {studentSelections.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-xs text-gray-400 font-medium shadow-xs">
                No course selections for this student yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {studentSelections.map(sel => (
                  <div
                    key={sel.id}
                    className="bg-white p-3.5 rounded-2xl border border-gray-100/90 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-gray-950">{sel.course_title || 'Course'}</h5>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{sel.schedule_label || 'Default Time'}</p>
                      <p className="text-xs font-extrabold text-gray-900 mt-1">
                        {sel.price_snapshot ? `${sel.currency_snapshot === 'NGN' ? '₦' : sel.currency_snapshot === 'EUR' ? '€' : '$'}${Number(sel.price_snapshot).toLocaleString()}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sel.status === 'approved'
                          ? 'bg-[#E6F5F4] text-[#0A9D8F]'
                          : sel.status === 'rejected'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {sel.status?.charAt(0).toUpperCase() + sel.status?.slice(1)}
                      </span>

                      {sel.status === 'pending' && onApproveSelection && (
                        <button
                          onClick={async () => {
                            setProcessingId(sel.id);
                            try {
                              await onApproveSelection(sel.id);
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                          disabled={processingId === sel.id}
                          className="px-2.5 py-1 bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs"
                        >
                          {processingId === sel.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Approve</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeDetailTab === 'enrollments' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-950 uppercase tracking-wider text-gray-500">
              Active Enrollments
            </h4>
            {studentEnrollments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-xs text-gray-400 font-medium shadow-xs">
                No active enrollments for this student yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {studentEnrollments.map(enr => (
                  <div
                    key={enr.id}
                    className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-gray-950">{enr.course_title || 'Course'}</h5>
                      <p className="text-[11px] text-gray-500 font-medium">{enr.schedule_label || 'Assigned Time'}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                      Enrolled
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeDetailTab === 'activity' && (
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3 text-xs">
            <div className="flex gap-3 items-start">
              <div className="w-2 h-2 rounded-full bg-[#0A9D8F] mt-1.5" />
              <div>
                <p className="font-bold text-gray-900">Student Account Created</p>
                <p className="text-[11px] text-gray-400">{joinDateStr}</p>
              </div>
            </div>
            {studentSelections.map(sel => (
              <div key={sel.id} className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full bg-[#0A9D8F] mt-1.5" />
                <div>
                  <p className="font-bold text-gray-900">Selected: {sel.course_title}</p>
                  <p className="text-[11px] text-gray-400">
                    Status: {sel.status} • {new Date(sel.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SCREEN 7: STUDENTS LIST
  return (
    <div className="space-y-4 pb-20">
      {/* Search Input & Filter */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#0A9D8F] transition-all"
          />
        </div>
        <button
          aria-label="Filter"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center my-6 space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-950">No students yet.</h4>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            When students register on Ingenium Tech Academy, their profiles will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredStudents.map(student => {
            const joinDate = new Date(student.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="bg-white p-4 rounded-2xl border border-gray-100/90 shadow-xs hover:border-gray-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-800 shrink-0">
                    {student.full_name?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-950">
                      {student.full_name || 'Student Name'}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium">
                      {student.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="flex items-center gap-1.5 justify-end text-xs font-semibold text-gray-800">
                      <Globe className="w-3.5 h-3.5 text-[#0A9D8F]" />
                      <span>{student.country || 'International'}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Joined {joinDate}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
