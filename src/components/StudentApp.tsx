import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Profile, Course, CourseSchedule, CourseSelection, Enrollment, Notification, CourseCategory } from '../types';
import { 
  Home as HomeIcon, Heart, BookOpen, GraduationCap, User, Bell, LogOut, CheckCircle, 
  MapPin, Clock, Phone, AlertCircle, ChevronRight, Plus, Send, Search,
  SlidersHorizontal, Trash2, Camera, HelpCircle, Info, Settings, Globe, Lock, ChevronLeft,
  Check, BarChart2, Video, Pencil, Sparkles, X, Database, Palette, Megaphone, Code, Terminal, PenTool
} from 'lucide-react';

const getCourseImage = (course: Course) => {
  const url = course.image_url;
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url.startsWith('data:'))) {
    return url;
  }
  
  const title = (course.title || '').toLowerCase();
  if (title.includes('data') || title.includes('analytics') || title.includes('excel') || title.includes('power bi')) {
    return 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('design') || title.includes('ui') || title.includes('ux') || title.includes('figma') || title.includes('product')) {
    return 'https://images.unsplash.com/photo-1561070791-26c113006238?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('code') || title.includes('develop') || title.includes('software') || title.includes('web') || title.includes('python') || title.includes('javascript') || title.includes('frontend')) {
    return 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&auto=format&fit=crop&q=80';
  }
  if (title.includes('scrum') || title.includes('agile') || title.includes('project') || title.includes('management')) {
    return 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80';
};

const getCourseDescription = (course: Course) => {
  const desc = course.short_description || '';
  if (desc.trim().length > 8) {
    return desc;
  }
  
  const title = (course.title || '').toLowerCase();
  if (title.includes('data') || title.includes('analyt')) {
    return 'Master data analytical techniques, modern visualization with Power BI/Excel, and SQL queries to unlock data-driven business insights.';
  }
  if (title.includes('design') || title.includes('ui') || title.includes('ux') || title.includes('figma')) {
    return 'Learn end-to-end UX research, wireframing, interactive prototyping, and visual interface design principles in Figma.';
  }
  if (title.includes('develop') || title.includes('code') || title.includes('software') || title.includes('web')) {
    return 'Build modern web solutions. Learn frontend and backend development with hands-on labs and direct mentor feedback.';
  }
  return 'Participate in professional instructor-led sessions, live weekly labs, and build a high-caliber portfolio to accelerate your career.';
};

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
  const [activeTab, setActiveTab] = useState<'home' | 'selections' | 'learning' | 'profile'>('home');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selections, setSelections] = useState<CourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, CourseSchedule[]>>({});
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Selection status filter
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Detailed overlays states
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<Course | null>(null);
  const [showClassTimeSelector, setShowClassTimeSelector] = useState(false);
  const [chosenScheduleId, setChosenScheduleId] = useState<string>('');

  // Course filter logic
  const filteredCourses = courses.filter(course => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ? true : (
      course.title.toLowerCase().includes(query) ||
      (course.short_description || '').toLowerCase().includes(query) ||
      (course.category || '').toLowerCase().includes(query)
    );
    if (!selectedCategoryId) return matchesSearch;
    const activeCategory = categories.find(c => c.id === selectedCategoryId);
    const matchesCategory = 
      course.category_id === selectedCategoryId ||
      (activeCategory && (course.category || '').toLowerCase().trim() === activeCategory.name.toLowerCase().trim());
    return matchesSearch && matchesCategory;
  });

  const [loading, setLoading] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // Phone number addition/editing states
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSavePhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = phoneInput.trim();
    if (!cleanPhone) {
      setPhoneError('Please enter a valid phone number');
      return;
    }
    setSavingPhone(true);
    setPhoneError(null);
    try {
      const { profile, error } = await dataService.profile.updateProfile(currentUser.id, {
        phone: cleanPhone,
      });
      if (error) {
        setPhoneError(error);
      } else if (profile) {
        onProfileUpdate(profile);
        setIsAddingPhone(false);
      }
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to update phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  // Load all student specific data
  const loadStudentData = async () => {
    setLoading(true);
    try {
      const fetchedCats = await dataService.categories.getCategories();
      setCategories(fetchedCats.filter(c => c.is_active));

      const fetchedCourses = await dataService.courses.getCourses();
      const published = fetchedCourses.filter(c => c.is_published || c.status === 'published');
      setCourses(published);

      const tempSchedules: Record<string, CourseSchedule[]> = {};
      for (const course of published) {
        const scheds = await dataService.courses.getCourseSchedules(course.id);
        tempSchedules[course.id] = scheds;
      }
      setSchedulesMap(tempSchedules);

      const fetchedSelections = await dataService.selections.getCourseSelections(currentUser.id);
      setSelections(fetchedSelections);

      const fetchedEnrollments = await dataService.enrollments.getEnrollments(currentUser.id);
      setEnrollments(fetchedEnrollments);

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
        price: pricing?.ngn_price ?? 200000,
        currency: 'NGN',
        symbol: '₦'
      };
    } else if (eurozoneCountries.includes(countryUpper)) {
      return {
        price: pricing?.eur_price ?? 400,
        currency: 'EUR',
        symbol: '€'
      };
    } else {
      return {
        price: pricing?.usd_price ?? 400,
        currency: 'USD',
        symbol: '$'
      };
    }
  };

  const handleSelectCourse = async () => {
    if (!selectedCourseForDetails) return;
    
    const courseScheds = schedulesMap[selectedCourseForDetails.id] || [];
    if (!chosenScheduleId && courseScheds.length > 0) {
      alert("Please select a preferred class time option.");
      return;
    }

    const pricingInfo = getCoursePriceAndCurrency(selectedCourseForDetails);

    try {
      setLoading(true);
      await dataService.selections.createCourseSelection(
        currentUser.id,
        selectedCourseForDetails.id,
        chosenScheduleId || undefined,
        pricingInfo.price,
        pricingInfo.currency,
        currentUser.country || 'Nigeria'
      );
      
      // Reload selections
      const updated = await dataService.selections.getCourseSelections(currentUser.id);
      setSelections(updated);
      
      // Reset overlay states and transition to selection tab
      setShowClassTimeSelector(false);
      setSelectedCourseForDetails(null);
      setChosenScheduleId('');
      setActiveTab('selections');
    } catch (err: any) {
      alert(err.message || "Could not complete selection.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelection = async (selectionId: string) => {
    if (!window.confirm("Are you sure you want to remove this course from your selections?")) {
      return;
    }
    try {
      await dataService.selections.deleteCourseSelection(selectionId);
      const updated = await dataService.selections.getCourseSelections(currentUser.id);
      setSelections(updated);
    } catch (err: any) {
      alert(err.message || "Failed to delete selection.");
    }
  };

  const getSelectionForCourse = (courseId: string) => {
    return selections.find(s => s.course_id === courseId);
  };

  const isEnrolledInCourse = (courseId: string) => {
    return enrollments.some(e => e.course_id === courseId);
  };

  // Helper to resolve dynamic category icons exactly like Mockup 1
  const getCategoryIconElement = (name: string, isSelected: boolean = false) => {
    const norm = name.toLowerCase();
    const iconClass = `w-6 h-6 stroke-[1.8] ${isSelected ? 'text-white' : 'text-zinc-700'}`;
    if (norm.includes('all')) {
      return <SlidersHorizontal className={iconClass} />;
    }
    if (norm.includes('science') || norm.includes('data') || norm.includes('analytics')) {
      return <Database className={iconClass} />;
    }
    if (norm.includes('design') || norm.includes('ui') || norm.includes('ux') || norm.includes('creative')) {
      return <Palette className={iconClass} />;
    }
    if (norm.includes('marketing') || norm.includes('digital') || norm.includes('growth')) {
      return <Megaphone className={iconClass} />;
    }
    if (norm.includes('develop') || norm.includes('code') || norm.includes('software') || norm.includes('web') || norm.includes('program')) {
      return <Code className={iconClass} />;
    }
    return <BookOpen className={iconClass} />;
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-[#111111] font-sans pb-24 selection:bg-[#00B074]/30">
      
      {/* Mobile Frame Simulator */}
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative flex flex-col justify-between border-x border-[#EAEAEA]">
        
        {/* DETAILED OVERLAY 2: CHOOSE CLASS TIME */}
        {selectedCourseForDetails && showClassTimeSelector && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col justify-between animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#F2F2F2] flex items-center justify-between">
              <button 
                onClick={() => setShowClassTimeSelector(false)} 
                className="p-1 text-zinc-800 hover:text-zinc-600 transition-all"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-base font-semibold text-zinc-900">Choose Class Time</h2>
              <div className="w-6 h-6"></div> {/* Spacer for symmetry */}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Local timezone alert banner */}
              <div className="bg-[#EAFBF3] border border-[#00B074]/30 p-4 rounded-2xl flex items-start gap-3">
                <Globe className="w-4 h-4 text-[#00875A] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#00875A] leading-relaxed">
                  All times are shown in your local time zone ({currentUser.timezone || 'Africa/Lagos'})
                </p>
              </div>

              {/* Class Scheds List */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">Available Class Times</h3>
                
                {(schedulesMap[selectedCourseForDetails.id] || []).length === 0 ? (
                  <p className="text-xs text-zinc-400 font-normal bg-[#F9F9F9] p-4 rounded-xl text-center border border-[#EAEAEA]">
                    No class schedules configured for this course yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(schedulesMap[selectedCourseForDetails.id] || []).map(sch => {
                      const isSelected = chosenScheduleId === sch.id;
                      return (
                        <div 
                          key={sch.id}
                          onClick={() => setChosenScheduleId(sch.id)}
                          className={`border p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-[#00B074] bg-[#00B074]/5' 
                              : 'border-[#EAEAEA] hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Custom Radio Button */}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'border-[#00B074] bg-[#00B074]' : 'border-zinc-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                            </div>
                            
                            {/* Class Time Info */}
                            <div className="space-y-0.5">
                              <p className="text-sm font-semibold text-zinc-900">{sch.label}</p>
                              <p className="text-xs text-zinc-500 font-medium">{sch.day_of_week}</p>
                              <p className="text-xs text-zinc-400 font-normal">Starts 3rd June, 2025</p>
                            </div>
                          </div>

                          {/* Seats Counter Badge */}
                          <div className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                            isSelected 
                              ? 'bg-[#00B074]/15 text-[#00875A]' 
                              : 'bg-[#EAFBF3] text-[#00875A]'
                          }`}>
                            {sch.capacity ? `${sch.capacity} Seats left` : '12 Seats left'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-6 border-t border-[#F2F2F2] space-y-3 bg-white">
              <button 
                onClick={handleSelectCourse}
                disabled={loading || !(schedulesMap[selectedCourseForDetails.id] || []).some(s => s.id === chosenScheduleId || !s.id)}
                className="w-full py-3.5 rounded-xl bg-[#00B074] hover:bg-[#00925F] text-white text-sm font-semibold transition-all shadow-sm active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {loading ? 'Adding...' : 'Add to My Selection'}
              </button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-normal">
                <Lock className="w-3.5 h-3.5" />
                <span>You can select multiple courses</span>
              </div>
            </div>
          </div>
        )}

        {/* DETAILED OVERLAY 1: COURSE DETAILS */}
        {selectedCourseForDetails && !showClassTimeSelector && (
          <div className="absolute inset-0 bg-white z-40 flex flex-col justify-between animate-in slide-in-from-right duration-250">
            {/* Scrollable Details */}
            <div className="flex-1 overflow-y-auto pb-6">
              
              {/* Back & Heart Hero Overlay Header */}
              <div className="relative w-full aspect-[16/10] bg-zinc-100">
                <img 
                  src={getCourseImage(selectedCourseForDetails)} 
                  alt={selectedCourseForDetails.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Header buttons overlay */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <button 
                    onClick={() => setSelectedCourseForDetails(null)}
                    className="p-2.5 rounded-full bg-white/90 shadow-md hover:bg-white text-black active:scale-95 transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button className="p-2.5 rounded-full bg-white/90 shadow-md hover:bg-white text-black active:scale-95 transition-all">
                    <Heart className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Course Title and Badges */}
              <div className="px-6 pt-5 space-y-4">
                <div className="flex">
                  <span className="bg-[#EAFBF3] text-[#00875A] text-xs font-semibold px-3 py-1 rounded-md">
                    {selectedCourseForDetails.category || 'Technology'}
                  </span>
                </div>

                <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                  {selectedCourseForDetails.title}
                </h1>

                <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                  {getCourseDescription(selectedCourseForDetails)}
                </p>

                {/* 3 Circular Horizontal Stat Info Boxes */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <Clock className="w-4 h-4 text-[#00B074]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Duration</span>
                    <span className="text-xs font-semibold text-zinc-900">8 Weeks</span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <BarChart2 className="w-4 h-4 text-[#00B074]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Level</span>
                    <span className="text-xs font-semibold text-zinc-900">Beginner</span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-100 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <Video className="w-4 h-4 text-[#00B074]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Mode</span>
                    <span className="text-xs font-semibold text-zinc-900">Live Online</span>
                  </div>
                </div>

                {/* About This Course Section */}
                <div className="pt-4 space-y-2 border-t border-[#F2F2F2]">
                  <h3 className="text-sm font-semibold text-zinc-900">About this course</h3>
                  <p className="text-xs text-zinc-600 font-normal leading-relaxed">
                    This course will take you from beginner to confident in analyzing data. You will learn data formulas, preparation, dashboards, and reporting to land your dream high-paying role.
                  </p>
                </div>

                {/* What You Will Learn Section */}
                <div className="pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-900">What you will learn</h3>
                  <div className="space-y-2.5">
                    {[
                      'Master core concepts and advanced topics',
                      'Build interactive dashboards and custom reports',
                      'Data cleaning and standard structured preparation',
                      'Hands-on projects to launch a brilliant portfolio'
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-[#00B074] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                        </div>
                        <span className="text-xs text-zinc-700 font-normal">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Sticky Details Footer */}
            <div className="px-6 py-4 border-t border-[#F2F2F2] bg-white flex items-center justify-between gap-4 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <div>
                <span className="block text-[#00B074] text-lg font-bold leading-none">
                  {getCoursePriceAndCurrency(selectedCourseForDetails).symbol}
                  {Number(getCoursePriceAndCurrency(selectedCourseForDetails).price).toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 font-normal mt-1 block">
                  For your country
                </span>
              </div>
              
              <button 
                onClick={() => {
                  const courseScheds = schedulesMap[selectedCourseForDetails.id] || [];
                  if (courseScheds.length > 0) {
                    setChosenScheduleId(courseScheds[0].id);
                  }
                  setShowClassTimeSelector(true);
                }}
                className="flex-1 py-3.5 rounded-xl bg-[#00B074] hover:bg-[#00925F] text-white text-sm font-semibold transition-all text-center shadow-sm cursor-pointer active:scale-98"
              >
                Choose Class Time
              </button>
            </div>
          </div>
        )}

        {/* MAIN TAB 1: HOME / DISCOVERY */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col bg-white">
            {/* Header branding row */}
            <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#F5F5F5]">
              <div className="flex items-center gap-2.5">
                {/* Logo Brand Icon */}
                <div className="w-8 h-8 rounded-lg bg-[#00B074] flex items-center justify-center text-white text-sm shadow-xs">
                  <span className="font-bold text-base tracking-tighter">I</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs tracking-wider text-[#00B074] leading-tight">
                    INGENIUM
                  </span>
                  <span className="font-semibold text-[8px] tracking-[0.16em] text-zinc-900 leading-none">
                    TECH ACADEMY
                  </span>
                </div>
              </div>

              {/* Notification bell */}
              <button 
                onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                className="p-2 rounded-full hover:bg-zinc-100 transition-colors relative"
              >
                <Bell className="w-4 h-4 text-black" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00B074]"></span>
              </button>
            </div>

            {/* Scrollable home area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              
              {/* Greetings */}
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                  Hi, {currentUser.full_name?.split(' ')[0] || 'Sarah'}
                </h1>
                <p className="text-sm text-zinc-500 font-normal">
                  What do you want to learn today?
                </p>
              </div>

              {/* Course Search Form Container */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Search courses"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-50 border border-zinc-200/80 rounded-xl font-normal text-zinc-800 focus:outline-none focus:border-[#00B074] placeholder:text-zinc-400"
                  />
                </div>
                {/* Filter sliders button */}
                <button 
                  onClick={() => setSelectedCategoryId('')}
                  className="p-2.5 rounded-xl bg-[#00B074] text-white hover:bg-[#00925F] transition-all flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Categories Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Categories</h3>
                  <button 
                    onClick={() => setSelectedCategoryId('')}
                    className="text-xs font-medium text-[#00B074] hover:underline cursor-pointer"
                  >
                    See all
                  </button>
                </div>

                {/* Horizontal scrolling Categories layout exactly like reference */}
                <div className="flex items-start gap-3.5 overflow-x-auto pb-2 pt-1 scrollbar-none">
                  {/* "All Courses" category box */}
                  <button
                    onClick={() => setSelectedCategoryId('')}
                    className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                        !selectedCategoryId 
                          ? 'bg-[#00B074] text-white shadow-xs' 
                          : 'bg-[#F8F9FA] border border-zinc-200/80 text-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <SlidersHorizontal className={`w-6 h-6 stroke-[1.8] ${!selectedCategoryId ? 'text-white' : 'text-zinc-700'}`} />
                    </div>
                    <span className={`text-[11px] text-center leading-tight max-w-[68px] ${
                      !selectedCategoryId ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'
                    }`}>
                      All Courses
                    </span>
                  </button>

                  {/* Rest of active categories: Data Science, Design, Marketing, Development */}
                  {categories.map(cat => {
                    const isSelected = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
                      >
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-[#00B074] text-white shadow-xs' 
                              : 'bg-[#F8F9FA] border border-zinc-200/80 text-zinc-700 hover:border-zinc-300'
                          }`}
                        >
                          {getCategoryIconElement(cat.name, isSelected)}
                        </div>
                        <span className={`text-[11px] text-center leading-tight max-w-[68px] ${
                          isSelected ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-600'
                        }`}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Popular Courses list area */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Popular Courses</h3>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategoryId('');
                    }}
                    className="text-xs font-medium text-[#00B074] hover:underline cursor-pointer"
                  >
                    See all
                  </button>
                </div>

                {filteredCourses.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2">
                    <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto" />
                    <p className="text-xs font-normal text-zinc-400">No courses available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCourses.map(course => {
                      const pricingInfo = getCoursePriceAndCurrency(course);
                      return (
                        <div 
                          key={course.id}
                          onClick={() => setSelectedCourseForDetails(course)}
                          className="bg-white border border-zinc-100 rounded-[20px] overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group"
                        >
                          {/* Top Image area with badges */}
                          <div className="w-full aspect-[16/9] relative bg-zinc-50 overflow-hidden">
                            <img 
                              src={getCourseImage(course)} 
                              alt={course.title} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                              referrerPolicy="no-referrer"
                            />
                            {/* Floating category badge top left */}
                            <span className="absolute top-3 left-3 bg-[#00B074] text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full shadow-xs">
                              {course.category || 'Technology'}
                            </span>
                            {/* Heart icon top right */}
                            <button className="absolute top-3 right-3 p-1.5 rounded-full bg-white/95 shadow-xs text-zinc-700 hover:text-red-500">
                              <Heart className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Details block */}
                          <div className="p-4 space-y-1.5">
                            <h4 className="text-sm font-semibold text-zinc-900 leading-snug">
                              {course.title}
                            </h4>
                            <p className="text-xs text-zinc-500 font-normal leading-relaxed line-clamp-2">
                              {getCourseDescription(course)}
                            </p>
                            
                            {/* Stats bar */}
                            <div className="flex items-center justify-between pt-1 text-xs text-zinc-500 font-normal">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-[#00B074]" />
                                  <span>8 Weeks</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <BarChart2 className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Beginner</span>
                                </span>
                              </div>
                              <span className="text-sm font-bold text-[#00B074]">
                                {pricingInfo.symbol}{Number(pricingInfo.price).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* MAIN TAB 2: MY SELECTION */}
        {activeTab === 'selections' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="px-6 py-4 border-b border-[#F5F5F5] flex items-center justify-between">
              <h1 className="text-base font-semibold text-zinc-900">My Selection</h1>
              <button className="p-2 rounded-full hover:bg-zinc-100">
                <Bell className="w-4 h-4 text-zinc-800" />
              </button>
            </div>

            {/* Segmented status filter tabs with underline indicator */}
            <div className="px-6 border-b border-[#F0F0F0] flex gap-6">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'approved', label: 'Approved' },
                { key: 'rejected', label: 'Rejected' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSelectionFilter(tab.key as any)}
                  className={`py-3 text-xs font-medium transition-all relative cursor-pointer ${
                    selectionFilter === tab.key 
                      ? 'text-[#00B074] font-semibold' 
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {tab.label}
                  {selectionFilter === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00B074] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {selections.filter(s => selectionFilter === 'all' ? true : s.status === selectionFilter).length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2 mt-6">
                  <Heart className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-normal text-zinc-400">You haven't selected any courses yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selections
                    .filter(s => selectionFilter === 'all' ? true : s.status === selectionFilter)
                    .map(sel => {
                      const courseObj = courses.find(c => c.id === sel.course_id);
                      return (
                        <div key={sel.id} className="p-3.5 bg-white border border-[#EAEAEA] rounded-2xl flex items-center gap-3 relative shadow-xs">
                          {/* Course square image left */}
                          <div className="w-16 h-16 rounded-xl bg-zinc-100 overflow-hidden shrink-0">
                            {courseObj && (
                              <img 
                                src={getCourseImage(courseObj)} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>

                          {/* Text middle */}
                          <div className="flex-1 min-w-0 pr-6">
                            <h4 className="text-xs font-semibold text-zinc-900 truncate">
                              {sel.course_title || 'Course Selection'}
                            </h4>
                            <p className="text-[11px] text-zinc-500 font-normal mt-0.5 leading-snug">
                              {sel.schedule_label || 'Awaiting schedule'}
                            </p>
                            
                            {/* Status label exactly matching reference */}
                            <div className="mt-1 flex items-center">
                              <span className={`text-xs font-medium capitalize ${
                                sel.status === 'approved' 
                                  ? 'text-[#00875A]' 
                                  : sel.status === 'rejected'
                                  ? 'text-red-500'
                                  : 'text-amber-500'
                              }`}>
                                {sel.status}
                              </span>
                            </div>
                          </div>

                          {/* Price Snapshot on right */}
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-[#00B074]">
                              {sel.currency_snapshot === 'NGN' ? '₦' : sel.currency_snapshot === 'EUR' ? '€' : '$'}
                              {Number(sel.price_snapshot || 0).toLocaleString()}
                            </span>
                          </div>

                          {/* Red delete trash button top right */}
                          {sel.status === 'pending' && (
                            <button 
                              onClick={() => handleDeleteSelection(sel.id)}
                              className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="Delete Selection"
                            >
                              <Trash2 className="w-3.5 h-3.5 stroke-[2]" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Bottom Waiting Alert Box */}
            <div className="p-4 mx-6 mb-6 bg-[#EAFBF3] border border-[#00B074]/30 rounded-2xl">
              <p className="text-xs font-medium text-[#00875A] text-center leading-relaxed">
                Your course selections are waiting for admin approval. You will be notified once a course is approved.
              </p>
            </div>
          </div>
        )}

        {/* MAIN TAB 3: MY LEARNING */}
        {activeTab === 'learning' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="px-6 py-4 border-b border-[#F5F5F5]">
              <h1 className="text-base font-semibold text-zinc-900">My Learning</h1>
            </div>

            {/* List of active courses */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {enrollments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-20">
                  {/* Graduation cap illustration with soft green circle and sparkles */}
                  <div className="relative flex items-center justify-center w-28 h-28 rounded-full bg-[#EAFBF3]">
                    <GraduationCap className="w-14 h-14 text-[#00875A]" />
                    <Sparkles className="w-4 h-4 text-[#00B074] absolute top-2 right-4 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-[#00B074] absolute bottom-3 left-4"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00B074]/60 absolute top-5 left-5"></span>
                  </div>

                  <div className="space-y-1.5 max-w-[280px]">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      You don't have any approved courses yet.
                    </h3>
                    <p className="text-xs text-zinc-500 font-normal leading-normal">
                      Once your course selections are approved, you will see them here.
                    </p>
                  </div>

                  <button 
                    onClick={() => setActiveTab('home')}
                    className="px-8 py-3 rounded-xl bg-[#00B074] hover:bg-[#00925F] text-white text-xs font-semibold shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    Explore Courses
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map(enr => {
                    const courseObj = courses.find(c => c.id === enr.course_id);
                    return (
                      <div key={enr.id} className="p-4 border border-[#EAEAEA] rounded-2xl space-y-3 bg-white">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden shrink-0">
                            {courseObj && (
                              <img 
                                src={getCourseImage(courseObj)} 
                                alt="" 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-zinc-900">
                              {enr.course_title || 'Approved Course'}
                            </h4>
                            <p className="text-[11px] text-zinc-500 font-normal mt-0.5">
                              {enr.schedule_label || 'Weekly Class'}
                            </p>
                          </div>
                        </div>

                        {/* Syllabus, syllabus notes, and active Classroom URL */}
                        <div className="pt-2 border-t border-[#F5F5F5] space-y-2.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-normal text-zinc-500">Syllabus Complete</span>
                            <span className="font-semibold text-[#00B074]">0%</span>
                          </div>

                          <div className="p-3 bg-zinc-50 rounded-xl space-y-1">
                            <p className="font-medium text-zinc-900">Class curriculum and video logs</p>
                            <p className="text-[11px] text-zinc-500 font-normal leading-relaxed">
                              Live classes and material links will be posted here by your assigned instructor.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex flex-col bg-white">
            
            {/* Elegant Solid green top card */}
            <div className="bg-[#00B074] p-6 text-white text-center rounded-b-[32px] space-y-3.5 shadow-xs">
              <h2 className="text-sm font-semibold uppercase tracking-wider">Student Profile</h2>
              
              {/* User photo matching Screen 6 */}
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-full h-full rounded-full border-3 border-white overflow-hidden bg-white shadow-xs flex items-center justify-center">
                  <img 
                    src={currentUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"} 
                    alt={currentUser.full_name || 'Profile'}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {/* Green pencil edit button on lower right */}
                <button className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#00B074] text-white shadow-sm border-2 border-white hover:scale-105 transition-transform cursor-pointer">
                  <Pencil className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>

              {/* Identity labels */}
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold tracking-tight text-white">
                  {currentUser.full_name || currentUser.email?.split('@')[0] || 'Student'}
                </h3>
                <p className="text-xs text-emerald-100 font-normal">{currentUser.email}</p>
              </div>
            </div>

            {/* Read-Only demographic card details (matching Screen 6) */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              <div className="bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden divide-y divide-[#F5F5F5] shadow-xs">
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-normal text-zinc-500">Country</span>
                  <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                    {currentUser.country || 'Nigeria'}
                    <span>🇳🇬</span>
                  </span>
                </div>
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-normal text-zinc-500">Time Zone</span>
                  <span className="font-semibold text-zinc-900">{currentUser.timezone || 'Africa/Lagos (GMT+1)'}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-normal text-zinc-500">Email</span>
                  <span className="font-semibold text-zinc-700 truncate max-w-[180px]">{currentUser.email}</span>
                </div>
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-normal text-zinc-500">Phone</span>
                  {currentUser.phone && currentUser.phone.trim() !== '' ? (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">{currentUser.phone}</span>
                      <button 
                        onClick={() => {
                          setPhoneInput(currentUser.phone || '');
                          setPhoneError(null);
                          setIsAddingPhone(true);
                        }}
                        className="text-zinc-400 hover:text-[#00B074] transition-colors p-0.5 cursor-pointer"
                        title="Edit Phone"
                        aria-label="Edit Phone Number"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPhoneInput('');
                        setPhoneError(null);
                        setIsAddingPhone(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EAFBF3] hover:bg-[#00B074]/20 text-[#00875A] font-semibold text-xs transition-colors cursor-pointer active:scale-95"
                      aria-label="Add Phone Number"
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Option Rows Menu list matching Screen 6 */}
              <div className="space-y-2.5">
                {[
                  { label: 'Settings', icon: <Settings className="w-4 h-4 text-zinc-500" /> },
                  { label: 'Help & Support', icon: <HelpCircle className="w-4 h-4 text-zinc-500" /> },
                  { label: 'About Ingenium Tech Academy', icon: <Info className="w-4 h-4 text-zinc-500" /> },
                ].map((row, idx) => (
                  <button 
                    key={idx}
                    className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {row.icon}
                      <span>{row.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </button>
                ))}

                {/* Account Logout with red styling matching Screen 6 */}
                <button 
                  onClick={onLogout}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-red-200 hover:bg-red-50/20 transition-colors text-xs font-semibold text-red-500 mt-2 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Logout</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* STICKY BOTTOM TASKBAR - Matching bottom navigation look of reference */}
        <nav className="sticky bottom-0 bg-white border-t border-[#F2F2F2] py-2.5 px-6 flex items-center justify-between z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
          
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'home' ? 'text-[#00B074] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <HomeIcon className={`w-5 h-5 stroke-[2] ${activeTab === 'home' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('selections')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'selections' ? 'text-[#00B074] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Heart className={`w-5 h-5 stroke-[2] ${activeTab === 'selections' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">My Selection</span>
          </button>

          <button
            onClick={() => setActiveTab('learning')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'learning' ? 'text-[#00B074] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <BookOpen className={`w-5 h-5 stroke-[2] ${activeTab === 'learning' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">My Learning</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'profile' ? 'text-[#00B074] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <User className={`w-5 h-5 stroke-[2] ${activeTab === 'profile' ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
          
        </nav>

        {/* Phone Number Modal Dialog */}
        {isAddingPhone && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl border border-zinc-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#EAFBF3] text-[#00B074]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {currentUser.phone ? 'Update Phone Number' : 'Add Phone Number'}
                  </h3>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddingPhone(false);
                    setPhoneError(null);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                Provide your WhatsApp-enabled phone number to receive class schedules, direct tutor updates, and live session links.
              </p>

              <form onSubmit={handleSavePhone} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-700">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="tel"
                      autoFocus
                      placeholder="e.g. +234 803 123 4567"
                      value={phoneInput}
                      onChange={(e) => {
                        setPhoneInput(e.target.value);
                        setPhoneError(null);
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl font-medium text-zinc-900 focus:outline-none focus:border-[#00B074] focus:ring-1 focus:ring-[#00B074]/30"
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[11px] text-red-500 font-medium">{phoneError}</p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingPhone(false);
                      setPhoneError(null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPhone || !phoneInput.trim()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#00B074] hover:bg-[#00925F] text-white text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-1.5"
                  >
                    {savingPhone ? 'Saving...' : 'Save Phone'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
