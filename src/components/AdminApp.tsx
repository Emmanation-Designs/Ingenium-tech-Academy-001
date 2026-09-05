import React, { useState, useEffect, useCallback } from 'react';
import { 
  Profile, Course, CourseCategory, CourseSchedule, CourseSelection, 
  Enrollment, TrainingMode, TeacherInvitation, TeacherCourseAssignment 
} from '../types';
import { dataService } from '../services/dataService';
import { realtimeSync } from '../services/realtimeSync';
import { AdminHeader } from './admin/AdminHeader';
import { AdminSidebar, AdminTab } from './admin/AdminSidebar';
import { AdminBottomNav } from './admin/AdminBottomNav';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminCourses } from './admin/AdminCourses';
import { AdminCourseForm } from './admin/AdminCourseForm';
import { AdminClassTimes } from './admin/AdminClassTimes';
import { AdminRequests } from './admin/AdminRequests';
import { AdminStudents } from './admin/AdminStudents';
import { AdminCategories } from './admin/AdminCategories';
import { AdminTeachers } from './admin/AdminTeachers';
import { Plus, RefreshCw, LogOut, ShieldCheck, BarChart2, GraduationCap, Settings } from 'lucide-react';

interface AdminAppProps {
  currentUser: Profile;
  onLogout: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const AdminApp: React.FC<AdminAppProps> = ({
  currentUser,
  onLogout
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Sub-view overlays
  const [isCreatingCourse, setIsCreatingCourse] = useState<boolean>(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourseForTimes, setSelectedCourseForTimes] = useState<Course | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CourseSelection | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  // Supabase Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [selections, setSelections] = useState<CourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [instructors, setInstructors] = useState<Profile[]>([]);
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<TeacherInvitation[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherCourseAssignment[]>([]);

  // Fetch all authoritative records from Supabase
  const loadData = useCallback(async (isBackground: boolean = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }
      const [
        fetchedCourses,
        fetchedCategories,
        fetchedSchedules,
        fetchedSelections,
        fetchedEnrollments,
        fetchedStudents,
        fetchedInstructors,
        fetchedTeachers,
        fetchedInvitations,
        fetchedAssignments
      ] = await Promise.all([
        dataService.getCourses(),
        dataService.getCategories(),
        dataService.getCourseSchedules(),
        dataService.getCourseSelections(),
        dataService.getEnrollments(),
        dataService.getStudents(),
        dataService.getInstructors(),
        dataService.getTeachers(),
        dataService.getTeacherInvitations(),
        dataService.getTeacherAssignments()
      ]);

      setCourses(fetchedCourses);
      setCategories(fetchedCategories);
      setSchedules(fetchedSchedules);
      setSelections(fetchedSelections);
      setEnrollments(fetchedEnrollments);
      setStudents(fetchedStudents);
      setInstructors(fetchedInstructors);
      setTeachers(fetchedTeachers);
      setInvitations(fetchedInvitations);
      setTeacherAssignments(fetchedAssignments);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to load authoritative admin data:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    loadData(false);

    // Smart Real-time Auto-refresh subscription
    const unsubscribe = realtimeSync.subscribe((event) => {
      // Refresh cleanly in background without unmounting or blocking the UI
      loadData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  const pendingRequestsCount = selections.filter(s => s.status === 'pending').length;

  // Course Handlers
  const handleSaveCourse = async (formData: {
    title: string;
    short_description: string;
    description: string;
    category_id: string;
    category: string;
    duration: string;
    training_mode: TrainingMode;
    status: 'draft' | 'published' | 'archived';
    usd_price: number;
    ngn_price: number;
    eur_price: number;
    heroFile: File | null;
    removeImage: boolean;
  }) => {
    let imageUrl = editingCourse?.image_url || '';

    // Upload hero image to Supabase storage if selected
    if (formData.heroFile) {
      const uploaded = await dataService.uploadCourseImage(formData.heroFile);
      if (uploaded) imageUrl = uploaded;
    } else if (formData.removeImage) {
      imageUrl = '';
    }

    if (editingCourse) {
      // Update existing
      await dataService.updateCourse(editingCourse.id, {
        title: formData.title,
        short_description: formData.short_description,
        description: formData.description,
        category_id: formData.category_id,
        category: formData.category,
        duration: formData.duration,
        training_mode: formData.training_mode,
        status: formData.status,
        is_published: formData.status === 'published',
        image_url: imageUrl
      });

      // Update pricing
      await dataService.saveCoursePricing(editingCourse.id, {
        usd_price: formData.usd_price,
        ngn_price: formData.ngn_price,
        eur_price: formData.eur_price
      });
    } else {
      // Create new
      const courseSlug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'course';
      const newCourse = await dataService.createCourse({
        title: formData.title,
        slug: courseSlug,
        short_description: formData.short_description,
        description: formData.description,
        category_id: formData.category_id,
        category: formData.category,
        duration: formData.duration,
        training_mode: formData.training_mode,
        status: formData.status,
        is_published: formData.status === 'published',
        image_url: imageUrl
      });

      if (newCourse?.id) {
        await dataService.saveCoursePricing(newCourse.id, {
          usd_price: formData.usd_price,
          ngn_price: formData.ngn_price,
          eur_price: formData.eur_price
        });
      }
    }

    await loadData(true);
    setIsCreatingCourse(false);
    setEditingCourse(null);
  };

  const handleToggleCourseStatus = async (course: Course) => {
    const nextStatus = (course.is_published || course.status === 'published') ? 'draft' : 'published';
    await dataService.updateCourse(course.id, {
      status: nextStatus,
      is_published: nextStatus === 'published'
    });
    await loadData(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    await dataService.deleteCourse(courseId);
    await loadData(true);
  };

  // Schedule Handlers
  const handleAddSchedule = async (scheduleData: {
    course_id: string;
    label: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    timezone: string;
  }) => {
    await dataService.createCourseSchedule({
      ...scheduleData,
      is_active: true
    });
    await loadData(true);
  };

  const handleToggleSchedule = async (schedule: CourseSchedule) => {
    await dataService.updateCourseSchedule(schedule.id, {
      is_active: !schedule.is_active
    });
    await loadData(true);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await dataService.deleteCourseSchedule(scheduleId);
    await loadData(true);
  };

  // Selection Handlers
  const handleApproveSelection = async (selectionId: string) => {
    try {
      await dataService.approveCourseSelection(selectionId, currentUser?.id);
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to approve course selection:', err);
      throw err;
    }
  };

  const handleRejectSelection = async (selectionId: string) => {
    try {
      await dataService.rejectCourseSelection(selectionId, currentUser?.id);
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to reject course selection:', err);
      throw err;
    }
  };

  // Category Handlers
  const handleCreateCategory = async (name: string, file?: File | null): Promise<any> => {
    const created = await dataService.createCategory(name, file);
    await loadData(true);
    return created;
  };

  // Teacher Management Handlers
  const handleCreateTeacherInvitation = async (email: string): Promise<TeacherInvitation> => {
    const inv = await dataService.createTeacherInvitation(email, currentUser.id);
    await loadData(true);
    return inv;
  };

  const handleResendTeacherInvitation = async (id: string): Promise<TeacherInvitation> => {
    const inv = await dataService.resendTeacherInvitation(id);
    await loadData(true);
    return inv;
  };

  const handleRevokeTeacherInvitation = async (id: string) => {
    await dataService.revokeTeacherInvitation(id);
    await loadData(true);
  };

  const handleAssignTeacher = async (teacherId: string, courseId: string, scheduleId?: string) => {
    await dataService.assignTeacher(teacherId, courseId, scheduleId, currentUser.id);
    await loadData(true);
  };

  const handleRemoveTeacherAssignment = async (assignmentId: string) => {
    await dataService.removeTeacherAssignment(assignmentId);
    await loadData(true);
  };

  // Header Titles and Actions
  const getHeaderTitle = () => {
    if (isCreatingCourse) return 'Create Course';
    if (editingCourse) return 'Edit Course';
    if (selectedCourseForTimes) return 'Class Times';
    if (selectedStudent) return 'Student Details';

    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'courses': return 'Courses';
      case 'categories': return 'Categories';
      case 'times': return 'Class Times';
      case 'requests': return 'Course Requests';
      case 'students': return 'Students';
      case 'instructors': return 'Teachers';
      case 'enrollments': return 'Enrollments';
      case 'reports': return 'Reports';
      case 'settings': return 'Settings';
      default: return 'Admin';
    }
  };

  const renderHeaderRightAction = () => {
    if (isCreatingCourse || editingCourse || selectedCourseForTimes || selectedStudent) {
      return null;
    }

    if (activeTab === 'courses') {
      return (
        <button
          onClick={() => {
            setEditingCourse(null);
            setIsCreatingCourse(true);
          }}
          className="inline-flex items-center gap-1.5 bg-[#0A9D8F] hover:bg-[#087A6F] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Course</span>
        </button>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex flex-col font-sans">
      {/* Slideout Drawer / Navigation */}
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsCreatingCourse(false);
          setEditingCourse(null);
          setSelectedCourseForTimes(null);
          setSelectedStudent(null);
        }}
        currentUser={currentUser}
        onLogout={onLogout}
        pendingRequestsCount={pendingRequestsCount}
      />

      {/* Persistent Sticky Top Header */}
      <AdminHeader
        title={getHeaderTitle()}
        onOpenMenu={() => setIsSidebarOpen(true)}
        rightAction={renderHeaderRightAction()}
        unreadCount={pendingRequestsCount}
        isSyncing={isSyncing}
        onRefresh={() => loadData(true)}
        lastSyncedAt={lastSyncedAt}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 md:py-6">
        {loading && courses.length === 0 && students.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-2 text-xs font-semibold text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin text-[#0A9D8F]" />
            <span>Syncing authoritative Supabase records...</span>
          </div>
        )}

        {/* 1. COURSE FORM (CREATE / EDIT) */}
        {(isCreatingCourse || editingCourse) && (
          <AdminCourseForm
            initialCourse={editingCourse}
            categories={categories}
            onBack={() => {
              setIsCreatingCourse(false);
              setEditingCourse(null);
            }}
            onSubmit={handleSaveCourse}
            onCreateCategoryInline={async (name) => {
              const res = await dataService.createCategory(name);
              await loadData(true);
              return res;
            }}
          />
        )}

        {/* 2. CLASS TIMES VIEW FOR SPECIFIC COURSE */}
        {!isCreatingCourse && !editingCourse && selectedCourseForTimes && (
          <AdminClassTimes
            course={selectedCourseForTimes}
            schedules={schedules.filter(s => s.course_id === selectedCourseForTimes.id)}
            onBack={() => setSelectedCourseForTimes(null)}
            onAddSchedule={handleAddSchedule}
            onToggleActive={handleToggleSchedule}
            onDeleteSchedule={handleDeleteSchedule}
          />
        )}

        {/* 3. PRIMARY TABS */}
        {!isCreatingCourse && !editingCourse && !selectedCourseForTimes && (
          <>
            {activeTab === 'dashboard' && (
              <AdminDashboard
                students={students}
                courses={courses}
                selections={selections}
                enrollments={enrollments}
                currentUser={currentUser}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenRequest={(req) => {
                  setSelectedRequest(req);
                  setActiveTab('requests');
                }}
                isSyncing={isSyncing}
                onRefresh={() => loadData(true)}
                lastSyncedAt={lastSyncedAt}
              />
            )}

            {activeTab === 'courses' && (
              <AdminCourses
                courses={courses}
                onCreateCourse={() => {
                  setEditingCourse(null);
                  setIsCreatingCourse(true);
                }}
                onEditCourse={(course) => {
                  setEditingCourse(course);
                  setIsCreatingCourse(false);
                }}
                onManageTimes={(course) => {
                  setSelectedCourseForTimes(course);
                }}
                onToggleStatus={handleToggleCourseStatus}
                onDeleteCourse={handleDeleteCourse}
              />
            )}

            {activeTab === 'categories' && (
              <AdminCategories
                categories={categories}
                courses={courses}
                onCreateCategory={async (name, file) => {
                  await handleCreateCategory(name, file);
                }}
              />
            )}

            {activeTab === 'times' && (
              <div className="space-y-4 pb-20">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
                  <h3 className="text-sm font-bold text-gray-950 mb-1">Select a course to manage class times:</h3>
                  <p className="text-xs text-gray-500 mb-3">Each course has its own tailored live class schedule times.</p>
                  <div className="divide-y divide-gray-100">
                    {courses.map(c => {
                      const count = schedules.filter(s => s.course_id === c.id).length;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCourseForTimes(c)}
                          className="py-3 flex items-center justify-between hover:bg-gray-50/80 px-2 rounded-xl cursor-pointer transition-all"
                        >
                          <div>
                            <h4 className="text-xs font-bold text-gray-950">{c.title}</h4>
                            <p className="text-[11px] text-gray-400">{c.duration || '8 Weeks'} • {count} active schedules</p>
                          </div>
                          <span className="text-xs font-bold text-[#0A9D8F] hover:underline">
                            Configure →
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <AdminRequests
                selections={selections}
                selectedRequest={selectedRequest}
                onSelectRequest={setSelectedRequest}
                onApprove={handleApproveSelection}
                onReject={handleRejectSelection}
              />
            )}

            {activeTab === 'students' && (
              <AdminStudents
                students={students}
                selections={selections}
                enrollments={enrollments}
                courses={courses}
                selectedStudent={selectedStudent}
                onSelectStudent={setSelectedStudent}
                onApproveSelection={handleApproveSelection}
                onRejectSelection={handleRejectSelection}
              />
            )}

            {activeTab === 'instructors' && (
              <AdminTeachers
                teachers={teachers}
                invitations={invitations}
                assignments={teacherAssignments}
                courses={courses}
                schedules={schedules}
                currentUser={currentUser}
                onCreateInvitation={handleCreateTeacherInvitation}
                onResendInvitation={handleResendTeacherInvitation}
                onRevokeInvitation={handleRevokeTeacherInvitation}
                onAssignTeacher={handleAssignTeacher}
                onRemoveAssignment={handleRemoveTeacherAssignment}
                onRefresh={() => loadData(true)}
              />
            )}

            {activeTab === 'enrollments' && (
              <div className="space-y-4 pb-20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-950">Active Student Enrollments</h3>
                  <span className="text-xs font-bold text-[#0A9D8F] bg-[#E6F5F4] px-2.5 py-0.5 rounded-full">
                    {enrollments.length} Total
                  </span>
                </div>

                {enrollments.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-gray-100 text-center shadow-xs">
                    <ShieldCheck className="w-10 h-10 text-[#0A9D8F] mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-bold text-gray-900">No active enrollments yet.</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Enrollments are created when student course requests are approved.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {enrollments.map(enr => (
                      <div
                        key={enr.id}
                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-gray-950">{enr.student_name || 'Enrolled Student'}</h4>
                          <p className="text-[11px] text-gray-500 font-medium">{enr.course_title || 'Course'}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{enr.schedule_label || 'Assigned Schedule'}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs text-center space-y-3 pb-20">
                <div className="w-12 h-12 rounded-full bg-[#E6F5F4] text-[#0A9D8F] flex items-center justify-center mx-auto">
                  <BarChart2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-gray-950">Analytics & Reports</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Real-time enrollment metrics, country demographics, and course performance driven directly by Supabase.
                </p>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4 pb-20">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-950 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <span>Admin Settings</span>
                  </h3>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{currentUser.full_name}</p>
                      <p className="text-[11px] text-gray-500">{currentUser.email}</p>
                      <span className="text-[10px] font-bold text-[#0A9D8F] uppercase tracking-wider">
                        {currentUser.role}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={loadData}
                      className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Database Cache</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={onLogout}
                      className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky Mobile Bottom Navigation */}
      <AdminBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsCreatingCourse(false);
          setEditingCourse(null);
          setSelectedCourseForTimes(null);
          setSelectedStudent(null);
        }}
        onOpenMenu={() => setIsSidebarOpen(true)}
        pendingRequestsCount={pendingRequestsCount}
      />
    </div>
  );
};
