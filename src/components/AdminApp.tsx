import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { 
  Profile, Course, CourseSchedule, CourseSelection, 
  Enrollment, Payment, SelectionStatus, CourseCategory, CoursePricing 
} from '../types';
import { 
  LayoutDashboard, BookOpen, Clock, Users, Inbox, GraduationCap, 
  UserSquare, CreditCard, Settings, LogOut, CheckCircle2, 
  AlertCircle, ShieldAlert, Plus, Layers, User, Trash2, Calendar, Edit, Eye, EyeOff
} from 'lucide-react';

interface AdminAppProps {
  currentUser: Profile;
  onLogout: () => void;
}

type AdminTab = 'dashboard' | 'courses' | 'times' | 'students' | 'requests' | 'enrollments' | 'teachers' | 'payments' | 'settings';

export const AdminApp: React.FC<AdminAppProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  
  // Real database states
  const [students, setStudents] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [selections, setSelections] = useState<CourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, CourseSchedule[]>>({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories management state
  const [newCategoryName, setNewCategoryName] = useState('');

  // Course editing state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    short_description: '',
    description: '',
    category_id: '',
    duration: '8 weeks',
    training_mode: 'online' as any,
    status: 'published' as any,
    international_price: 150,
    nigeria_price: 120000,
    uk_price: 120
  });

  // Administrative creation forms (to enable manual testing and real populating)
  const [newCourse, setNewCourse] = useState({
    title: '',
    short_description: '',
    description: '',
    category_id: '',
    duration: '8 weeks',
    training_mode: 'online' as any,
    status: 'published' as any,
    international_price: 150,
    nigeria_price: 120000,
    uk_price: 120
  });
  
  const [newSchedule, setNewSchedule] = useState({
    course_id: '',
    label: '',
    day_of_week: 'Saturday',
    start_time: '10:00:00',
    end_time: '12:00:00'
  });

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch stats & lists dynamically
      const fetchedStudents = await dataService.profile.getStudents();
      setStudents(fetchedStudents);

      const fetchedCategories = await dataService.categories.getCategories();
      setCategories(fetchedCategories);

      const fetchedCourses = await dataService.courses.getCourses();
      setCourses(fetchedCourses);

      const fetchedSelections = await dataService.selections.getCourseSelections();
      setSelections(fetchedSelections);

      const fetchedEnrollments = await dataService.enrollments.getEnrollments();
      setEnrollments(fetchedEnrollments);

      const fetchedPayments = await dataService.payments.getPayments();
      setPayments(fetchedPayments);

      // Fetch schedules per course
      const tempSchedules: Record<string, CourseSchedule[]> = {};
      for (const course of fetchedCourses) {
        // Fetch all schedules (including inactive for admin)
        const scheds = await dataService.courses.getCourseSchedules(course.id, false);
        tempSchedules[course.id] = scheds;
      }
      setSchedulesMap(tempSchedules);
    } catch (e: any) {
      setError(e.message || "Failed to synchronise data with backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const slug = newCategoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      await dataService.categories.createCategory({
        name: newCategoryName.trim(),
        slug,
        is_active: true
      });
      setNewCategoryName('');
      loadAdminData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.title.trim()) return;
    try {
      const slug = newCourse.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      
      // 1. Create the base course
      const createdCourse = await dataService.courses.createCourse({
        title: newCourse.title.trim(),
        slug,
        short_description: newCourse.short_description.trim(),
        description: newCourse.description.trim(),
        category_id: newCourse.category_id || undefined,
        duration: newCourse.duration,
        training_mode: newCourse.training_mode,
        status: newCourse.status,
        is_published: newCourse.status === 'published',
        created_by: currentUser.id
      });

      // 2. Set pricing row
      await dataService.pricing.updatePricing({
        course_id: createdCourse.id,
        international_price: Number(newCourse.international_price || 0),
        nigeria_price: Number(newCourse.nigeria_price || 0),
        uk_price: Number(newCourse.uk_price || 0),
        international_currency: 'USD',
        nigeria_currency: 'NGN',
        uk_currency: 'GBP'
      });

      setNewCourse({
        title: '',
        short_description: '',
        description: '',
        category_id: '',
        duration: '8 weeks',
        training_mode: 'online',
        status: 'published',
        international_price: 150,
        nigeria_price: 120000,
        uk_price: 120
      });
      loadAdminData();
    } catch (e: any) {
      alert("Error creating course: " + e.message);
    }
  };

  const startEditCourse = (course: Course) => {
    setEditingCourse(course);
    setEditForm({
      title: course.title,
      short_description: course.short_description || '',
      description: course.description || '',
      category_id: course.category_id || '',
      duration: course.duration || '8 weeks',
      training_mode: course.training_mode,
      status: course.status,
      international_price: course.pricing?.international_price || 0,
      nigeria_price: course.pricing?.nigeria_price || 0,
      uk_price: course.pricing?.uk_price || 0
    });
  };

  const handleUpdateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      const slug = editForm.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      
      // 1. Update Base Course
      await dataService.courses.updateCourse(editingCourse.id, {
        title: editForm.title.trim(),
        slug,
        short_description: editForm.short_description.trim(),
        description: editForm.description.trim(),
        category_id: editForm.category_id || undefined,
        duration: editForm.duration,
        training_mode: editForm.training_mode,
        status: editForm.status,
        is_published: editForm.status === 'published'
      });

      // 2. Update Pricing Row
      await dataService.pricing.updatePricing({
        course_id: editingCourse.id,
        international_price: Number(editForm.international_price || 0),
        nigeria_price: Number(editForm.nigeria_price || 0),
        uk_price: Number(editForm.uk_price || 0),
        international_currency: 'USD',
        nigeria_currency: 'NGN',
        uk_currency: 'GBP'
      });

      setEditingCourse(null);
      loadAdminData();
    } catch (e: any) {
      alert("Error updating course: " + e.message);
    }
  };

  const handleTogglePublished = async (course: Course) => {
    try {
      const nextPublished = !course.is_published;
      const nextStatus = nextPublished ? 'published' : 'draft';
      await dataService.courses.updateCourse(course.id, {
        is_published: nextPublished,
        status: nextStatus
      });
      loadAdminData();
    } catch (e: any) {
      alert("Error toggling publication status: " + e.message);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.course_id || !newSchedule.label.trim()) {
      alert("Please specify a course and time label.");
      return;
    }
    try {
      await dataService.courses.createCourseSchedule({
        course_id: newSchedule.course_id,
        label: newSchedule.label.trim(),
        day_of_week: newSchedule.day_of_week,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        timezone: 'Africa/Lagos',
        is_active: true,
        created_by: currentUser.id
      });
      setNewSchedule({
        course_id: '',
        label: '',
        day_of_week: 'Saturday',
        start_time: '10:00:00',
        end_time: '12:00:00'
      });
      loadAdminData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleToggleScheduleActive = async (schedule: CourseSchedule) => {
    try {
      await dataService.courses.updateCourseSchedule(schedule.id, {
        is_active: !schedule.is_active
      });
      loadAdminData();
    } catch (e: any) {
      alert("Error toggling schedule: " + e.message);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule option?")) return;
    try {
      await dataService.courses.deleteCourseSchedule(id);
      loadAdminData();
    } catch (e: any) {
      alert("Error deleting schedule: " + e.message);
    }
  };

  const handleApproveRequest = async (selectionId: string) => {
    if (!confirm("Are you sure you want to approve this course request and grant immediate enrollment?")) return;
    try {
      await dataService.selections.updateSelectionStatus(selectionId, 'approved', currentUser.id);
      loadAdminData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleRejectRequest = async (selectionId: string) => {
    if (!confirm("Are you sure you want to reject this course request?")) return;
    try {
      await dataService.selections.updateSelectionStatus(selectionId, 'rejected', currentUser.id);
      loadAdminData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // Compute metrics from actual database items
  const stats = {
    totalStudents: students.length,
    publishedCourses: courses.filter(c => c.is_published || c.status === 'published').length,
    pendingRequests: selections.filter(s => s.status === 'pending').length,
    activeEnrollments: enrollments.filter(e => e.status === 'active').length
  };

  return (
    <div className="min-h-screen dot-grid text-white flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR NAVIGATION - DESKTOP */}
      <aside className="w-full md:w-64 bg-zinc-900 text-white shrink-0 p-6 flex flex-col justify-between border-r border-zinc-800">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-md">
              <span className="text-[#00B074] font-black text-sm">I</span>
            </div>
            <div>
              <span className="font-black text-sm block leading-none text-white">Ingenium Tech</span>
              <span className="text-[10px] text-zinc-400 font-bold tracking-wider">ADMIN CONSOLE</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: 'courses', label: 'Courses', icon: <BookOpen className="w-4 h-4" /> },
              { id: 'times', label: 'Class Times', icon: <Clock className="w-4 h-4" /> },
              { id: 'students', label: 'Students', icon: <Users className="w-4 h-4" /> },
              { 
                id: 'requests', 
                label: 'Course Requests', 
                icon: <Inbox className="w-4 h-4" />, 
                badge: stats.pendingRequests > 0 ? stats.pendingRequests : undefined 
              },
              { id: 'enrollments', label: 'Enrollments', icon: <GraduationCap className="w-4 h-4" /> },
              { id: 'teachers', label: 'Teachers', icon: <UserSquare className="w-4 h-4" /> },
              { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full py-2.5 px-3.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                  activeTab === item.id 
                    ? 'bg-[#00B074] text-white border border-[#00905D] shadow-lg' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-zinc-950 text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-zinc-850">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer info & Logout */}
        <div className="mt-8 pt-6 border-t border-zinc-800 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xs">
              A
            </div>
            <div>
              <p className="text-xs font-bold text-white max-w-[140px] truncate">{currentUser.full_name}</p>
              <p className="text-[10px] text-zinc-400">Administrator</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-2 rounded-xl bg-zinc-950 hover:bg-red-950/40 text-zinc-300 hover:text-red-400 text-xs font-bold border border-zinc-850 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-y-auto">
        
        {/* Upper Dashboard header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">
              {activeTab}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Ingenium Tech Academy Management Console — Live Database Sync
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl shadow-md">
            <span className="w-2 h-2 rounded-full bg-[#00B074]"></span>
            <span className="text-zinc-300">Database Connected</span>
          </div>
        </div>

        {/* ==================== TAB: DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Real Metrics grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Total Students', value: stats.totalStudents, label: 'Registered users', icon: <Users className="w-5 h-5 text-white" /> },
                { title: 'Published Courses', value: stats.publishedCourses, label: 'Active curriculum catalog', icon: <BookOpen className="w-5 h-5 text-white" /> },
                { title: 'Pending Requests', value: stats.pendingRequests, label: 'Awaiting manual approval', icon: <Inbox className="w-5 h-5 text-white" /> },
                { title: 'Active Enrollments', value: stats.activeEnrollments, label: 'Students with access', icon: <GraduationCap className="w-5 h-5 text-[#00B074]" /> },
              ].map((stat, idx) => (
                <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">{stat.title}</span>
                    <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800">{stat.icon}</div>
                  </div>
                  <div className="text-3xl font-black text-white">{stat.value}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 font-semibold">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Layout Split: Quick Action & Pending Queue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left col: Pending selections queue */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Awaiting Course Approvals</h3>
                  <button onClick={() => setActiveTab('requests')} className="text-xs font-bold text-[#00B074] hover:underline">
                    View All Queue
                  </button>
                </div>

                {selections.filter(s => s.status === 'pending').length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                    No pending course requests at this time.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selections.filter(s => s.status === 'pending').slice(0, 3).map(sel => (
                      <div key={sel.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{sel.student_name}</span>
                            <span className="text-[10px] text-zinc-400 font-semibold">{sel.student_email}</span>
                          </div>
                          <p className="text-xs font-bold text-[#00B074]">{sel.course_title}</p>
                          <p className="text-[10px] text-zinc-500">Scheduled: {sel.schedule_label || 'Standard schedule'} • Ref: {sel.reference_id}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveRequest(sel.id)}
                            className="py-1.5 px-3 bg-[#00B074] text-white text-[11px] font-black rounded-lg border border-zinc-800 hover:bg-[#00905D] cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRequest(sel.id)}
                            className="py-1.5 px-3 bg-zinc-950 text-white text-[11px] font-black rounded-lg border border-zinc-800 hover:bg-zinc-800 cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right col: Administrative summary */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Quick Actions</h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3 text-xs">
                  <p className="text-zinc-400 leading-relaxed font-semibold">
                    Need to configure schedules or courses to simulate a student selection? Use the quick actions below.
                  </p>
                  <button 
                    onClick={() => setActiveTab('courses')}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs text-center shadow-md flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Manage Course Catalog
                  </button>
                  <button 
                    onClick={() => setActiveTab('times')}
                    className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs text-center border border-zinc-800 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    Configure class schedules
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB: COURSES ==================== */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            
            {/* Manage Categories Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-md">
              <h4 className="font-extrabold text-xs uppercase text-zinc-400 tracking-wider mb-3">Manage Course Categories</h4>
              <form onSubmit={handleCreateCategory} className="flex gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Create new category (e.g. Frontend Development, Data Analytics...)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-[#00B074] font-semibold"
                />
                <button 
                  type="submit" 
                  className="py-2.5 px-5 bg-[#00B074] hover:bg-[#00905D] text-white font-extrabold rounded-xl transition-all cursor-pointer shrink-0 border border-zinc-850"
                >
                  Create Category
                </button>
              </form>
              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {categories.map(cat => (
                    <span key={cat.id} className="text-[10px] font-black px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400">
                      {cat.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-zinc-500 font-semibold italic mt-2">No custom categories registered. Standard fallbacks are active.</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 cols: Courses List */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Registered Course Catalog</h3>
                
                {courses.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                    No courses registered in catalog yet. Create your first course using the creator form.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {courses.map(course => {
                      const courseCat = categories.find(c => c.id === course.category_id);
                      return (
                        <div key={course.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md hover:border-zinc-700 transition-all">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-sm text-white">{course.title}</h4>
                              {courseCat && (
                                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-zinc-950 text-zinc-400 border border-zinc-850">
                                  {courseCat.name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed max-w-md">{course.short_description}</p>
                            
                            {/* 3-Tier Prices list */}
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-semibold text-zinc-400">
                              <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850 uppercase">{course.training_mode}</span>
                              <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">{course.duration}</span>
                              <div className="flex items-center gap-1.5 bg-zinc-950/60 px-2.5 py-0.5 rounded-full border border-zinc-850">
                                <span className="text-emerald-400 font-bold">NGN ₦{Number(course.pricing?.nigeria_price || 120000).toLocaleString()}</span>
                                <span className="text-zinc-500">•</span>
                                <span className="text-indigo-400 font-bold">GBP £{Number(course.pricing?.uk_price || 120).toLocaleString()}</span>
                                <span className="text-zinc-500">•</span>
                                <span className="text-amber-400 font-bold">USD ${Number(course.pricing?.international_price || 150).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              onClick={() => handleTogglePublished(course)}
                              className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                                course.is_published 
                                  ? 'bg-[#00B074]/10 border-[#00B074]/30 text-[#00B074] hover:bg-[#00B074]/20' 
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                              title={course.is_published ? 'Published (Click to draft)' : 'Draft (Click to publish)'}
                            >
                              {course.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => startEditCourse(course)}
                              className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 cursor-pointer"
                              title="Edit Course"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right col: Edit or Create course form */}
              <div className="space-y-4">
                {editingCourse ? (
                  // EDIT COURSE FORM
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">Edit Course</h3>
                      <button onClick={() => setEditingCourse(null)} className="text-[10px] text-zinc-400 font-bold hover:underline">
                        Cancel
                      </button>
                    </div>
                    <form onSubmit={handleUpdateCourseSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Course Title</label>
                        <input
                          type="text"
                          required
                          value={editForm.title}
                          onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Short Description</label>
                        <textarea
                          required
                          value={editForm.short_description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, short_description: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold h-16 focus:outline-none focus:border-[#00B074]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Category</label>
                        <select
                          value={editForm.category_id}
                          onChange={(e) => setEditForm(prev => ({ ...prev, category_id: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                        >
                          <option value="">-- No Category --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 3-Tier Prices */}
                      <div className="space-y-2 border-t border-zinc-800 pt-2.5">
                        <p className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">3-Tier Fixed Pricing</p>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">NGR Price (₦)</label>
                            <input
                              type="number"
                              required
                              value={editForm.nigeria_price}
                              onChange={(e) => setEditForm(prev => ({ ...prev, nigeria_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">UK Price (£)</label>
                            <input
                              type="number"
                              required
                              value={editForm.uk_price}
                              onChange={(e) => setEditForm(prev => ({ ...prev, uk_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">Int'l Price ($)</label>
                            <input
                              type="number"
                              required
                              value={editForm.international_price}
                              onChange={(e) => setEditForm(prev => ({ ...prev, international_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-2.5">
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Duration</label>
                          <input
                            type="text"
                            value={editForm.duration}
                            onChange={(e) => setEditForm(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Mode</label>
                          <select
                            value={editForm.training_mode}
                            onChange={(e) => setEditForm(prev => ({ ...prev, training_mode: e.target.value as any }))}
                            className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                          >
                            <option value="online">Online</option>
                            <option value="physical">Physical</option>
                            <option value="hybrid">Hybrid</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Status</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                        >
                          <option value="draft">Draft (Unpublished)</option>
                          <option value="published">Published</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-white text-black font-extrabold border border-zinc-800 shadow-md cursor-pointer mt-2"
                      >
                        Save Changes
                      </button>
                    </form>
                  </div>
                ) : (
                  // CREATE COURSE FORM
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3 text-xs">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Quick Course Creator</h3>
                    <form onSubmit={handleCreateCourse} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Course Title</label>
                        <input
                          type="text"
                          required
                          placeholder="E.g. Data Analysis Masterclass"
                          value={newCourse.title}
                          onChange={(e) => setNewCourse(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Short Description</label>
                        <textarea
                          required
                          placeholder="Brief description for the catalog list"
                          value={newCourse.short_description}
                          onChange={(e) => setNewCourse(prev => ({ ...prev, short_description: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold h-16 focus:outline-none focus:border-[#00B074]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Category</label>
                        <select
                          value={newCourse.category_id}
                          onChange={(e) => setNewCourse(prev => ({ ...prev, category_id: e.target.value }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                        >
                          <option value="">-- Choose Category --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 3-Tier Prices */}
                      <div className="space-y-2 border-t border-zinc-800 pt-2.5">
                        <p className="text-[10px] uppercase font-extrabold text-zinc-400 tracking-wider">3-Tier Fixed Pricing</p>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">NGR Price (₦)</label>
                            <input
                              type="number"
                              required
                              value={newCourse.nigeria_price}
                              onChange={(e) => setNewCourse(prev => ({ ...prev, nigeria_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">UK Price (£)</label>
                            <input
                              type="number"
                              required
                              value={newCourse.uk_price}
                              onChange={(e) => setNewCourse(prev => ({ ...prev, uk_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-zinc-500 mb-0.5">Int'l Price ($)</label>
                            <input
                              type="number"
                              required
                              value={newCourse.international_price}
                              onChange={(e) => setNewCourse(prev => ({ ...prev, international_price: Number(e.target.value) }))}
                              className="w-full p-2 bg-zinc-950 border border-zinc-800 text-white rounded font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-2.5">
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Duration</label>
                          <input
                            type="text"
                            value={newCourse.duration}
                            onChange={(e) => setNewCourse(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Mode</label>
                          <select
                            value={newCourse.training_mode}
                            onChange={(e) => setNewCourse(prev => ({ ...prev, training_mode: e.target.value as any }))}
                            className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                          >
                            <option value="online">Online</option>
                            <option value="physical">Physical</option>
                            <option value="hybrid">Hybrid</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Status</label>
                        <select
                          value={newCourse.status}
                          onChange={(e) => setNewCourse(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                        >
                          <option value="draft">Draft (Unpublished)</option>
                          <option value="published">Published</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-[#00B074] hover:bg-[#00905D] text-white font-extrabold border border-[#00905D] shadow-md cursor-pointer mt-2"
                      >
                        Create & Publish Course
                      </button>
                    </form>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB: CLASS TIMES ==================== */}
        {activeTab === 'times' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 cols: Schedules */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Configured Class Schedules</h3>
              
              {courses.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                  You must register at least one course first before configuring schedule slots.
                </div>
              ) : (
                <div className="space-y-4">
                  {courses.map(course => {
                    const scheds = schedulesMap[course.id] || [];
                    return (
                      <div key={course.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <h4 className="font-extrabold text-sm text-white border-b border-zinc-800 pb-1.5">{course.title}</h4>
                        {scheds.length === 0 ? (
                          <p className="text-[11px] text-zinc-500 font-semibold italic">No schedules configured for this course yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {scheds.map(sch => (
                              <div key={sch.id} className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-sm">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-white">{sch.label}</p>
                                  <p className="text-[10px] text-zinc-400">{sch.day_of_week}s • {sch.start_time} - {sch.end_time}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleToggleScheduleActive(sch)}
                                    className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full border cursor-pointer ${
                                      sch.is_active 
                                        ? 'bg-emerald-950/20 text-[#00B074] border-emerald-900/30' 
                                        : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                                    }`}
                                    title="Click to toggle active status"
                                  >
                                    {sch.is_active ? 'active' : 'inactive'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSchedule(sch.id)}
                                    className="p-1 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
                                    title="Delete Schedule"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right col: Create schedule form */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Quick Schedule Creator</h3>
              <form onSubmit={handleCreateSchedule} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Target Course</label>
                  <select
                    required
                    value={newSchedule.course_id}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, course_id: e.target.value }))}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                  >
                    <option value="">-- Choose Course --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Time Label</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Saturdays 10:00 AM"
                    value={newSchedule.label}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Day of Week</label>
                  <select
                    value={newSchedule.day_of_week}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, day_of_week: e.target.value }))}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-bold focus:outline-none focus:border-[#00B074]"
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">Start Time</label>
                    <input
                      type="text"
                      required
                      placeholder="10:00:00"
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-zinc-400 mb-1">End Time</label>
                    <input
                      type="text"
                      required
                      placeholder="12:00:00"
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full p-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-lg font-semibold focus:outline-none focus:border-[#00B074]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[#00B074] hover:bg-[#00905D] text-white font-extrabold border border-[#00905D] shadow-md cursor-pointer mt-2"
                >
                  Create Class Schedule Slot
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ==================== TAB: STUDENTS ==================== */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Registered Academy Students</h3>
            
            {students.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                No students yet.
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 font-black text-zinc-400">
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Email Address</th>
                      <th className="p-4">Phone Number</th>
                      <th className="p-4">Country</th>
                      <th className="p-4">Timezone</th>
                      <th className="p-4">Registered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 font-semibold text-zinc-300">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-zinc-850/30">
                        <td className="p-4 font-bold text-white">{student.full_name}</td>
                        <td className="p-4">{student.email}</td>
                        <td className="p-4">{student.phone || '—'}</td>
                        <td className="p-4">{student.country || '—'}</td>
                        <td className="p-4">{student.timezone}</td>
                        <td className="p-4 text-zinc-500">{new Date(student.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: COURSE REQUESTS ==================== */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Manual Course Enrollment Requests</h3>
            
            {selections.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                No pending course requests.
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 font-black text-zinc-400">
                      <th className="p-4">Reference ID</th>
                      <th className="p-4">Student & Country</th>
                      <th className="p-4">Selected Course</th>
                      <th className="p-4">Locked Pricing</th>
                      <th className="p-4">Preferred Time Slot</th>
                      <th className="p-4">Request Status</th>
                      <th className="p-4 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 font-semibold text-zinc-300">
                    {selections.map(sel => (
                      <tr key={sel.id} className="hover:bg-zinc-850/30">
                        <td className="p-4 font-bold text-white">{sel.reference_id}</td>
                        <td className="p-4">
                          <div className="font-bold text-white">{sel.student_name}</div>
                          <div className="text-[10px] text-zinc-400">{sel.student_country || 'International'}</div>
                        </td>
                        <td className="p-4 font-bold text-[#00B074]">{sel.course_title}</td>
                        <td className="p-4">
                          <div className="font-extrabold text-white">
                            {sel.currency_snapshot} {Number(sel.price_snapshot || 0).toLocaleString()}
                          </div>
                          <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Fixed snapshot</div>
                        </td>
                        <td className="p-4">{sel.schedule_label || 'Weekly Class'}</td>
                        <td className="p-4">
                           <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                            sel.status === 'approved' ? 'bg-emerald-950/20 text-[#00B074] border-emerald-900/30' :
                            sel.status === 'rejected' ? 'bg-red-955/20 text-red-400 border-red-900/30' :
                            'bg-amber-955/20 text-amber-400 border-amber-900/30'
                          }`}>
                            {sel.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {sel.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveRequest(sel.id)}
                                className="py-1 px-2.5 bg-[#00B074] hover:bg-[#00905D] text-white text-[10px] font-black rounded border border-[#00905D] cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectRequest(sel.id)}
                                className="py-1 px-2.5 bg-zinc-955 hover:bg-zinc-800 text-white text-[10px] font-bold border border-zinc-800 rounded cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">No further actions available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: ENROLLMENTS ==================== */}
        {activeTab === 'enrollments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Active Learning Enrollments</h3>
            
            {enrollments.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                No active enrollments yet. Approve a course request to grant enrollments.
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 font-black text-zinc-400">
                      <th className="p-4">Enrollment ID</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Course Name</th>
                      <th className="p-4">Class Time</th>
                      <th className="p-4">Access Type</th>
                      <th className="p-4">Granted On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 font-semibold text-zinc-300">
                    {enrollments.map(enr => (
                      <tr key={enr.id} className="hover:bg-zinc-850/30">
                        <td className="p-4 font-mono text-[10px] text-zinc-500">{enr.id.substring(0, 13)}...</td>
                        <td className="p-4">{students.find(s => s.id === enr.student_id)?.full_name || 'Active Student'}</td>
                        <td className="p-4 font-bold text-white">{enr.course_title}</td>
                        <td className="p-4">{enr.schedule_label || 'Standard schedule'}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 uppercase text-[9px] font-bold border border-zinc-800">
                            {enr.access_type}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-500">{enr.approved_at ? new Date(enr.approved_at).toLocaleDateString() : 'Manual'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: TEACHERS ==================== */}
        {activeTab === 'teachers' && (
          <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-3 shadow-lg">
            <div className="inline-flex p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-500">
              <UserSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Teacher Management</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              <strong>Coming Soon:</strong> As per Section 1 guidelines, teacher registration, calendars, class assignments, and teacher invitation management are not built yet. Future database schemas are prepared.
            </p>
          </div>
        )}

        {/* ==================== TAB: PAYMENTS ==================== */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirmed Payment Ledger</h3>
            
            {payments.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-xs text-zinc-500 font-bold">
                No payments recorded yet.
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-850 font-black text-zinc-400">
                      <th className="p-4">Reference ID</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4">Amount Paid</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Notes</th>
                      <th className="p-4">Confirmed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 font-semibold text-zinc-300">
                    {payments.map(pay => (
                      <tr key={pay.id} className="hover:bg-zinc-850/30">
                        <td className="p-4 font-bold text-white">{pay.reference_id}</td>
                        <td className="p-4">{pay.student_name}</td>
                        <td className="p-4 font-bold text-[#00B074]">
                          {pay.currency} {Number(pay.amount).toLocaleString()}
                        </td>
                        <td className="p-4 uppercase text-[10px] text-zinc-400">{pay.payment_method}</td>
                        <td className="p-4 text-zinc-400">{pay.notes || '—'}</td>
                        <td className="p-4 text-zinc-500">{pay.confirmed_at ? new Date(pay.confirmed_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB: SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-3 shadow-lg">
            <div className="inline-flex p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-500">
              <Settings className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Academy Settings</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              <strong>Coming Soon:</strong> Configuration parameters for domain `ingeniumtechacademy.com`, branding presets, metadata permissions, and system audit logs.
            </p>
          </div>
        )}

      </main>

    </div>
  );
};
