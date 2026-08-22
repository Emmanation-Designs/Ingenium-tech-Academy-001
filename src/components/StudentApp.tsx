import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Profile, Course, CourseSchedule, CourseSelection, Enrollment, Notification, CourseCategory } from '../types';
import { 
  Home as HomeIcon, BookOpen, GraduationCap, User, Bell, LogOut, CheckCircle2, 
  MapPin, Clock, Phone, AlertCircle, ChevronRight, CheckCircle, Plus, Send, Sun, Moon 
} from 'lucide-react';

interface StudentAppProps {
  currentUser: Profile;
  onLogout: () => void;
  onProfileUpdate: (profile: Profile) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const StudentApp: React.FC<StudentAppProps> = ({
  currentUser,
  onLogout,
  onProfileUpdate,
  theme,
  onToggleTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'courses' | 'learning' | 'profile'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selections, setSelections] = useState<CourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, CourseSchedule[]>>({});
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Filter courses by search input and category select
  const filteredCourses = courses.filter(course => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ? true : (
      course.title.toLowerCase().includes(query) ||
      course.short_description?.toLowerCase().includes(query) ||
      course.category?.toLowerCase().includes(query)
    );
    const matchesCategory = !selectedCategoryId ? true : course.category_id === selectedCategoryId;
    return matchesSearch && matchesCategory;
  });

  // Forms & UI state
  const [loading, setLoading] = useState(false);
  const [selectedSchedules, setSelectedSchedules] = useState<Record<string, string>>({}); // courseId -> scheduleId
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: currentUser.full_name,
    phone: currentUser.phone || '',
    country: currentUser.country || '',
    timezone: currentUser.timezone || 'Africa/Lagos'
  });
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Load all user-specific data from database
  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 0. Fetch active course categories
      const fetchedCats = await dataService.categories.getCategories();
      setCategories(fetchedCats.filter(c => c.is_active));

      // 1. Fetch available courses
      const fetchedCourses = await dataService.courses.getCourses();
      const published = fetchedCourses.filter(c => c.is_published || c.status === 'published');
      setCourses(published);

      // 2. Fetch schedules for each course
      const tempSchedules: Record<string, CourseSchedule[]> = {};
      for (const course of published) {
        const scheds = await dataService.courses.getCourseSchedules(course.id);
        tempSchedules[course.id] = scheds;
      }
      setSchedulesMap(tempSchedules);

      // 3. Fetch course selections (requests)
      const fetchedSelections = await dataService.selections.getCourseSelections(currentUser.id);
      setSelections(fetchedSelections);

      // 4. Fetch actual enrollments (granted courses)
      const fetchedEnrollments = await dataService.enrollments.getEnrollments(currentUser.id);
      setEnrollments(fetchedEnrollments);

      // 5. Setup basic mock notifications for active sessions
      const demoNotifications: Notification[] = [
        {
          id: 'notif-1',
          user_id: currentUser.id,
          title: 'Welcome to Ingenium!',
          message: 'Explore our catalog of professional courses and begin your customized learning journey today.',
          is_read: false,
          created_at: new Date().toISOString()
        }
      ];
      setNotifications(demoNotifications);
    } catch (e) {
      console.error("Error loading student data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [currentUser.id]);

  const getCoursePriceAndCurrency = (course: Course) => {
    const countryUpper = (currentUser.country || '').trim().toUpperCase();
    const pricing = course.pricing;

    const eurozoneCountries = [
      'AUSTRIA', 'BELGIUM', 'CROATIA', 'CYPRUS', 'ESTONIA', 'FINLAND', 'FRANCE', 'GERMANY', 
      'GREECE', 'IRELAND', 'ITALY', 'LATVIA', 'LITHUANIA', 'LUXEMBOURG', 'MALTA', 'NETHERLANDS', 
      'PORTUGAL', 'SLOVAKIA', 'SLOVENIA', 'SPAIN', 'ANDORRA', 'MONACO', 'SAN MARINO', 'VATICAN CITY',
      'MONTENEGRO', 'KOSOVO', 'EUROPE', 'EUROZONE', 'EU'
    ];

    if (countryUpper === 'NIGERIA' || countryUpper === 'NG') {
      return {
        price: pricing?.ngn_price ?? 120000,
        currency: 'NGN',
        symbol: '₦',
        isDefaultFallback: !pricing
      };
    } else if (eurozoneCountries.includes(countryUpper)) {
      return {
        price: pricing?.eur_price ?? 120,
        currency: 'EUR',
        symbol: '€',
        isDefaultFallback: !pricing
      };
    } else {
      return {
        price: pricing?.usd_price ?? 150,
        currency: 'USD',
        symbol: '$',
        isDefaultFallback: !pricing
      };
    }
  };

  const handleSelectCourse = async (courseId: string) => {
    const selectedScheduleId = selectedSchedules[courseId];
    if (!selectedScheduleId && schedulesMap[courseId]?.length > 0) {
      alert("Please select a preferred class time option before joining.");
      return;
    }

    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const pricingInfo = getCoursePriceAndCurrency(course);

    try {
      setErrorForCourse(courseId, null);
      await dataService.selections.createCourseSelection(
        currentUser.id,
        courseId,
        selectedScheduleId,
        pricingInfo.price,
        pricingInfo.currency,
        currentUser.country || 'International'
      );
      // Reload selections
      const updated = await dataService.selections.getCourseSelections(currentUser.id);
      setSelections(updated);
    } catch (err: any) {
      setErrorForCourse(courseId, err.message || "Could not select course.");
    }
  };

  const [courseErrors, setCourseErrors] = useState<Record<string, string | null>>({});
  const setErrorForCourse = (courseId: string, msg: string | null) => {
    setCourseErrors(prev => ({ ...prev, [courseId]: msg }));
  };

  const handleUpdateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(false);
    setProfileError(null);

    const { profile, error } = await dataService.profile.updateProfile(currentUser.id, {
      full_name: profileForm.full_name,
      phone: profileForm.phone,
      country: profileForm.country,
      timezone: profileForm.timezone
    });

    if (error) {
      setProfileError(error);
    } else if (profile) {
      onProfileUpdate(profile);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    }
  };

  const getSelectionForCourse = (courseId: string) => {
    return selections.find(s => s.course_id === courseId);
  };

  const isEnrolledInCourse = (courseId: string) => {
    return enrollments.some(e => e.course_id === courseId);
  };

  return (
    <div className="min-h-screen dot-grid text-white font-sans pb-24">
      {/* Mobile-centric frame centered on large viewports */}
      <div className="max-w-md mx-auto bg-zinc-950 min-h-screen shadow-2xl relative border-x border-zinc-850 flex flex-col justify-between">
        
        {/* Conditional Header Block */}
        {activeTab !== 'home' && activeTab !== 'courses' ? (
          <header className="sticky top-0 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 py-4 px-6 flex items-center justify-between z-30">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00B074]"></span>
              <span className="font-extrabold text-sm tracking-tight text-white">Ingenium Tech Academy</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleTheme}
                className="p-2 rounded-full hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer border border-zinc-800 flex items-center justify-center"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4 text-zinc-700" />
                ) : (
                  <Sun className="w-4 h-4 text-white" />
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                  className="p-2 rounded-full hover:bg-zinc-800 active:scale-95 transition-all relative cursor-pointer border border-zinc-800"
                  aria-label="View notifications"
                >
                  <Bell className="w-4 h-4 text-white" />
                  {notifications.some(n => !n.is_read) && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00B074]"></span>
                  )}
                </button>

                {/* Notification Dropdown Container */}
                {showNotificationCenter && (
                  <div className="absolute right-0 mt-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl w-72 z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
                      <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">Notifications</span>
                      <button 
                        onClick={() => setShowNotificationCenter(false)}
                        className="text-[10px] font-bold text-[#00B074] hover:underline"
                      >
                        Close
                      </button>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {notifications.map(n => (
                        <div key={n.id} className="text-xs">
                          <p className="font-bold text-white">{n.title}</p>
                          <p className="text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                          <span className="text-[9px] text-zinc-500 mt-1 block">Just now</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        ) : (
          /* Mockup Top Status Bar */
          <div className="bg-transparent py-3 px-6 flex justify-between items-center text-zinc-500 text-[10px] font-bold z-30 select-none">
            <span>10:16</span>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 fill-current text-zinc-500" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.07 19.64 10.49 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
              </svg>
              <span className="w-4 h-2 border border-zinc-600 rounded-sm p-0.5 flex items-center">
                <span className="bg-zinc-500 h-full w-4/5 block rounded-2xs"></span>
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Inner Tab View */}
        <main className="flex-1 p-6">
          
          {/* TAB 1: HOME (3rd Mockup Screen Style: "Find your favorite course") */}
          {activeTab === 'home' && (
            <div className="flex-1 flex flex-col -mx-6 -mt-6">
              {/* Green Header block with rounded bottom edges */}
              <div className="bg-[#00B074] rounded-b-[36px] px-6 pt-5 pb-8 text-white space-y-4 shadow-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black leading-tight tracking-tight">Find your favorite course</h2>
                    <p className="text-[11px] text-emerald-100 font-semibold mt-0.5">Explore practical technology fields today</p>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    className="p-2 rounded-full bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center text-white"
                    title="Toggle theme"
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Integrated Search Bar inside Green block */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2.5 pl-10 pr-4 text-xs bg-white text-zinc-950 rounded-full font-bold focus:outline-none placeholder-zinc-400 border-0 shadow-inner"
                  />
                  <svg className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Home main body contents */}
              <div className="p-6 space-y-6">
                
                {/* Explore Categories (Mockup 3 Section) */}
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-black tracking-tight text-white">Explore categories</h3>
                    <button 
                      onClick={() => {
                        setSelectedCategoryId('');
                        setActiveTab('courses');
                      }} 
                      className="text-xs font-extrabold text-[#00B074] hover:underline cursor-pointer"
                    >
                      See all
                    </button>
                  </div>
                  
                  {categories.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      No categories defined yet.
                    </div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                      {categories.map(cat => (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategoryId(cat.id);
                            setActiveTab('courses');
                          }}
                          className="bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-3 shrink-0 w-64 flex items-center gap-3 cursor-pointer active:scale-98 transition-all shadow-md"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                            <img src={cat.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=120&auto=format&fit=crop&q=60'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-white truncate">{cat.name}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold mt-0.5 truncate">Click to filter courses</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-amber-400 font-black">★ 4.8</span>
                              <span className="text-[9px] text-[#00B074] font-black uppercase tracking-wider bg-[#00B074]/10 px-1.5 py-0.5 rounded-full">Explore</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Popular Courses (Mockup 3 Section) */}
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="text-sm font-black tracking-tight text-white font-sans">Popular Courses</h3>
                    <button 
                      onClick={() => setActiveTab('courses')} 
                      className="text-xs font-extrabold text-[#00B074] hover:underline cursor-pointer"
                    >
                      See all
                    </button>
                  </div>

                  {courses.length === 0 ? (
                    <div className="p-5 text-center text-xs text-zinc-500 bg-zinc-900 rounded-2xl border border-zinc-800">
                      No courses available yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {courses.slice(0, 4).map(course => (
                        <div
                          key={course.id}
                          onClick={() => {
                            setActiveTab('courses');
                            setSearchQuery(course.title);
                          }}
                          className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:border-zinc-700 active:scale-99 transition-all shadow-md"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                            <img src={course.image_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150&auto=format&fit=crop&q=60'} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-white truncate">{course.title}</h4>
                            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">By {course.instructor_name || 'Shoun Paulk'}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-400 font-extrabold flex-wrap">
                              <span className="text-amber-400">★ 4.9 (225 reviews)</span>
                              <span>•</span>
                              <span>20 lessons</span>
                            </div>
                          </div>
                          <div className="text-xs font-black text-[#00B074] shrink-0 px-2">
                            {getCoursePriceAndCurrency(course).symbol}{getCoursePriceAndCurrency(course).price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: COURSES (2nd Mockup Screen Style: "Select your course") */}
          {activeTab === 'courses' && (
            <div className="space-y-5 flex-1 flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Select your course</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Select a course to build your curriculum selection</p>
                </div>
                <button
                  onClick={onToggleTheme}
                  className="p-2 rounded-full hover:bg-zinc-850 border border-zinc-800 active:scale-95 transition-all cursor-pointer flex items-center justify-center text-white"
                  title="Toggle theme"
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              </div>

              {courses.length > 0 && (
                <div className="space-y-3.5">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search courses"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full py-2.5 pl-9 pr-10 text-xs bg-zinc-900 border border-zinc-800 rounded-full font-bold text-white focus:outline-none focus:border-[#00B074] placeholder-zinc-500 shadow-inner"
                    />
                    <svg className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] uppercase font-black text-zinc-500 hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Category filter pills */}
                  {categories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                      <button
                        onClick={() => setSelectedCategoryId('')}
                        className={`py-1 px-3.5 rounded-full text-[10px] font-black transition-all shrink-0 cursor-pointer border ${
                          selectedCategoryId === ''
                            ? 'bg-[#00B074] text-white border-[#00905D] shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        All Categories
                      </button>
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`py-1 px-3.5 rounded-full text-[10px] font-black transition-all shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                            selectedCategoryId === cat.id
                              ? 'bg-[#00B074] text-white border-[#00905D] shadow-sm'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          {cat.image_url && (
                            <img src={cat.image_url} alt="" className="w-3.5 h-3.5 rounded-full object-cover" referrerPolicy="no-referrer" />
                          )}
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {courses.length === 0 ? (
                <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-3 my-8">
                  <div className="inline-flex p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-500">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">No courses available yet.</h3>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    The academy administrators are currently setting up the official course catalog. Please check back shortly.
                  </p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-2">
                  <p className="text-xs font-bold text-zinc-400">No courses match your filters.</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategoryId('');
                    }}
                    className="text-xs font-bold text-[#00B074] hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredCourses.map(course => {
                    const matchedSelection = getSelectionForCourse(course.id);
                    const isEnrolled = isEnrolledInCourse(course.id);
                    const courseScheds = schedulesMap[course.id] || [];
                    const err = courseErrors[course.id];

                    return (
                      <div key={course.id} className="bg-zinc-900 border border-zinc-800/80 rounded-[24px] overflow-hidden p-3.5 space-y-3 shadow-md">
                        {/* Mockup Style Top Card Hero Image */}
                        {course.image_url && (
                          <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-inner">
                            <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}

                        {/* Text and visual info layout matching Mockup 2 */}
                        <div className="px-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-black text-white leading-tight">{course.title}</h3>
                              <p className="text-[11px] text-zinc-400 font-bold mt-0.5">By {course.instructor_name || 'Shoun Paulk'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-black text-[#00B074]">
                                {getCoursePriceAndCurrency(course).symbol}{getCoursePriceAndCurrency(course).price}
                              </span>
                              <span className="block text-[8px] text-zinc-500 font-bold mt-0.5 uppercase tracking-wide">
                                {getCoursePriceAndCurrency(course).currency}
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                            {course.short_description || "High-intensity practical course with live instructor hours."}
                          </p>

                          {/* Stats line matching Select your course */}
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-extrabold pt-0.5 flex-wrap">
                            <span className="text-amber-400">★ 4.9 (225 reviews)</span>
                            <span>•</span>
                            <span>20 lessons</span>
                            <span>•</span>
                            <span>4 hours 36m</span>
                          </div>

                          {/* Scheduling & selection selection controls */}
                          {!isEnrolled && !matchedSelection && courseScheds.length > 0 && (
                            <div className="space-y-1.5 pt-1.5">
                              <label className="block text-[9px] uppercase font-extrabold text-zinc-500 tracking-wider">
                                Select class session options
                              </label>
                              <select
                                value={selectedSchedules[course.id] || ''}
                                onChange={(e) => setSelectedSchedules(prev => ({ ...prev, [course.id]: e.target.value }))}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-[#00B074] cursor-pointer"
                              >
                                <option value="">-- Choose Class Time --</option>
                                {courseScheds.map(sch => (
                                  <option key={sch.id} value={sch.id}>
                                    {sch.label} ({sch.day_of_week})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {err && (
                            <p className="text-xs font-bold text-red-400 bg-red-955/20 p-2 rounded-xl border border-red-900/40">
                              {err}
                            </p>
                          )}

                          {/* Selection Actions */}
                          <div className="pt-2">
                            {isEnrolled ? (
                              <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-955/20 border border-emerald-900/30 text-[#00B074] text-xs font-black text-center flex items-center justify-center gap-1.5">
                                <CheckCircle className="w-4 h-4" />
                                Active Enrollment
                              </div>
                            ) : matchedSelection ? (
                              <div className="w-full py-2.5 px-4 rounded-xl bg-amber-955/10 border border-amber-900/30 text-amber-400 text-xs font-black text-center flex items-center justify-between">
                                <span>Selected</span>
                                <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full border border-amber-800/30 bg-zinc-950">
                                  {matchedSelection.status}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelectCourse(course.id)}
                                className="w-full py-2.5 px-4 rounded-xl bg-[#00B074] hover:bg-[#00905D] text-white text-xs font-black border border-zinc-850 shadow-md active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Plus className="w-4 h-4" />
                                Add to My Selection
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MY LEARNING */}
          {activeTab === 'learning' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">My Learning</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Access your course curriculums, class schedules, and live sessions.
                </p>
              </div>

              {enrollments.length === 0 ? (
                <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl text-center space-y-3 my-8">
                  <div className="inline-flex p-3 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-500">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-white">You haven't enrolled in any courses yet.</h3>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Once the administrator approves your selected courses after confirming payment through WhatsApp, your active enrollments will appear here instantly.
                  </p>
                  <button 
                    onClick={() => setActiveTab('courses')}
                    className="py-2 px-5 rounded-xl bg-[#00B074] text-white font-bold text-xs border border-zinc-800 cursor-pointer inline-flex items-center gap-1"
                  >
                    Browse Courses Catalog
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map(enr => (
                    <div key={enr.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 relative">
                      
                      {/* Active course header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-955/30 text-[#00B074] border border-emerald-900/30">
                            Active Access
                          </span>
                          <h3 className="text-base font-black text-white leading-snug mt-1.5">{enr.course_title}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-semibold mt-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{enr.schedule_label || 'Standard schedule'}</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center font-black text-xl text-[#00B074]">
                          {enr.course_title?.charAt(0)}
                        </div>
                      </div>

                      {/* Course progress framework */}
                      <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-400">Curriculum Syllabus</span>
                          <span className="font-extrabold text-[#00B074]">0% Complete</span>
                        </div>
                        
                        {/* Empty course syllabus model */}
                        <div className="p-3.5 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-zinc-300">Syllabus modules coming soon</p>
                          <p className="text-[11px] text-zinc-500 leading-normal">
                            Your live classrooms, curriculum content, and modules will be populated by your assigned instructor prior to the first class.
                          </p>
                        </div>
                      </div>

                      {/* Live meeting invitation placeholder */}
                      <div className="p-3 bg-emerald-955/10 border border-emerald-900/20 rounded-xl flex items-center justify-between text-xs font-semibold">
                        <span className="text-zinc-300">Live Classroom Session Link</span>
                        <span className="text-[10px] text-[#00B074] uppercase tracking-wider font-bold">Awaiting schedule</span>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight font-sans">Student Profile</h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Manage your personal demographics, communication details, and timezone.
                </p>
              </div>

              {/* Success Notification */}
              {profileSuccess && (
                <div className="p-3.5 bg-emerald-955/20 border border-emerald-900/50 rounded-xl text-xs font-semibold text-[#00B074] flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#00B074] shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {/* Error Notification */}
              {profileError && (
                <div className="p-3.5 bg-red-955/20 border border-red-900/50 rounded-xl text-xs font-semibold text-red-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                  <span>{profileError}</span>
                </div>
              )}

              {/* Profile Demographic Form */}
              <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-400">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-white focus:outline-none focus:border-[#00B074]"
                    />
                  </div>
                </div>

                {/* Email Address (Disabled) */}
                <div className="space-y-1.5 opacity-70">
                  <label className="block text-xs font-bold text-zinc-500">Email Address (Fixed)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email"
                      disabled
                      value={currentUser.email}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-950 border border-zinc-900 rounded-xl font-bold text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-400">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-white focus:outline-none focus:border-[#00B074]"
                    />
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-400">Country</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={profileForm.country}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, country: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-white focus:outline-none focus:border-[#00B074]"
                    />
                  </div>
                </div>

                {/* Timezone (IANA selection dropdown) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-zinc-400">Timezone (IANA)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      value={profileForm.timezone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl font-bold text-white cursor-pointer focus:outline-none focus:border-[#00B074]"
                    >
                      <option value="Africa/Lagos">Africa/Lagos (West Africa Time)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                  </div>
                </div>

                {/* Submit Profile */}
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs shadow-lg active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </form>

              {/* Account Signout */}
              <div className="pt-6 border-t border-zinc-850">
                <button
                  onClick={onLogout}
                  className="w-full py-2.5 rounded-xl bg-red-955/20 hover:bg-red-955/40 text-red-400 font-bold text-xs border border-red-900/30 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out Account
                </button>
              </div>
            </div>
          )}

        </main>

        {/* Floating Green Pill Taskbar (Mockup Style) */}
        <nav className="sticky bottom-4 mx-4 mb-4 bg-[#008B5C] border border-emerald-600/30 rounded-2xl shadow-xl py-3 px-5 flex items-center justify-around z-30 text-white">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'home' ? 'text-white scale-105 font-black' : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span className="text-[10px] tracking-wider font-extrabold">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'courses' ? 'text-white scale-105 font-black' : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] tracking-wider font-extrabold">Courses</span>
          </button>

          <button
            onClick={() => setActiveTab('learning')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'learning' ? 'text-white scale-105 font-black' : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[10px] tracking-wider font-extrabold">Learning</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'profile' ? 'text-white scale-105 font-black' : 'text-emerald-200/80 hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] tracking-wider font-extrabold">Profile</span>
          </button>
        </nav>

      </div>
    </div>
  );
};
