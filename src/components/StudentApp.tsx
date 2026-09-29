import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dataService } from '../services/dataService';
import { realtimeSync } from '../services/realtimeSync';
import { Profile, Course, CourseSchedule, CourseSelection, Enrollment, Notification, CourseCategory } from '../types';
import { StudentClassroom } from './student/StudentClassroom';
import { StudentCourseDashboard } from './student/StudentCourseDashboard';
import { CourseProgressView } from './student/CourseProgressView';
import { CheckoutModal } from './student/CheckoutModal';
import { NotificationCenterModal } from './common/NotificationCenterModal';
import { determinePaymentRouting, getCoursePriceForCountry } from '../utils/paymentRouting';
import { BrandLogo } from './common/BrandLogo';
import { navigateSameTab } from '../lib/navigation';
import { formatCapitalizedName } from '../utils/nameFormatter';
import { 
  Home as HomeIcon, Heart, BookOpen, GraduationCap, User, Bell, LogOut, CheckCircle, 
  MapPin, Clock, AlertCircle, ChevronRight, Plus, Send, Search,
  SlidersHorizontal, Trash2, Camera, HelpCircle, Info, Settings, Globe, Lock, ChevronLeft,
  Check, BarChart2, Video, Pencil, Sparkles, X, Database, Palette, Megaphone, Code, Terminal, PenTool,
  ExternalLink, CreditCard, ShoppingBag, ArrowRight
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
  if (course.short_description && course.short_description.trim().length > 0) {
    return course.short_description.trim();
  }
  if (course.description && course.description.trim().length > 0) {
    return course.description.trim();
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

const getCourseLearningOutcomes = (course: Course): string[] => {
  if (course.what_you_will_learn) {
    if (Array.isArray(course.what_you_will_learn) && course.what_you_will_learn.length > 0) {
      return course.what_you_will_learn;
    }
    if (typeof course.what_you_will_learn === 'string' && course.what_you_will_learn.trim()) {
      return course.what_you_will_learn.split('\n').map(s => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
    }
  }
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

const StudentClassMeetingLink: React.FC<{ scheduleId?: string; onOpenClassroom?: () => void }> = ({ scheduleId, onOpenClassroom }) => {
  const [meetingData, setMeetingData] = useState<{ accessible: boolean; meeting_url?: string; message?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const fetchMeetingUrl = async () => {
      try {
        const res = await dataService.teachers.getStudentMeetingUrl(scheduleId);
        if (isMounted) setMeetingData(res);
      } catch (e) {
        if (isMounted) setMeetingData({ accessible: false, message: 'Class session details unavailable.' });
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchMeetingUrl();
    const timer = setInterval(fetchMeetingUrl, 60000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="p-3 bg-zinc-50 rounded-xl text-[11px] text-zinc-400">
        Checking live class schedule...
      </div>
    );
  }

  if (meetingData?.accessible && meetingData.meeting_url) {
    return (
      <div className="p-3 bg-[#E6F5F4] border border-[#0A9D8F]/30 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0A9D8F]">
            <Video className="w-3.5 h-3.5" />
            <span>Live Class Active</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0A9D8F] text-white">
            Ready to Join
          </span>
        </div>
        <p className="text-[11px] text-zinc-600 leading-relaxed">
          Your live class session is currently ongoing. Click below to join directly via Google Meet.
        </p>
        <a
          href={meetingData.meeting_url}
          target="_top"
          onClick={(e) => {
            e.preventDefault();
            navigateSameTab(meetingData.meeting_url!);
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-bold hover:bg-[#087A6F] transition-colors shadow-xs cursor-pointer"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Join Live Class (Google Meet)</span>
        </a>
      </div>
    );
  }

  return (
    <div className="p-3 bg-zinc-50 rounded-xl space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
        <Clock className="w-3.5 h-3.5 text-zinc-400" />
        <span>Live Class Session</span>
      </div>
      <p className="text-[11px] text-zinc-500 leading-relaxed">
        {meetingData?.message || 'Google Meet links unlock automatically 15 minutes before your scheduled class.'}
      </p>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState<'home' | 'classroom' | 'learning' | 'progress' | 'selections' | 'profile' | 'favorites'>('home');
  const [selectedCourseForDashboard, setSelectedCourseForDashboard] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selections, setSelections] = useState<CourseSelection[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, CourseSchedule[]>>({});
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFavoritesInSettings, setShowFavoritesInSettings] = useState(true);
  
  // Dedicated floating toast for favorites feedback anywhere in the app
  const [favoriteToast, setFavoriteToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Favorites persistence per student user ID + email + global fallback
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const id = currentUser?.id;
      const stored = id ? localStorage.getItem(`ingenium_favorites_${id}`) : null;
      if (stored) return JSON.parse(stored);
      const emailStored = currentUser?.email ? localStorage.getItem(`ingenium_favorites_${currentUser.email}`) : null;
      if (emailStored) return JSON.parse(emailStored);
      const generic = localStorage.getItem('ingenium_favorites');
      return generic ? JSON.parse(generic) : [];
    } catch {
      return [];
    }
  });

  // Re-sync favorites whenever currentUser changes
  useEffect(() => {
    try {
      const id = currentUser?.id;
      const stored = id ? localStorage.getItem(`ingenium_favorites_${id}`) : null;
      if (stored) {
        setFavorites(JSON.parse(stored));
        return;
      }
      const emailStored = currentUser?.email ? localStorage.getItem(`ingenium_favorites_${currentUser.email}`) : null;
      if (emailStored) {
        setFavorites(JSON.parse(emailStored));
        return;
      }
      const generic = localStorage.getItem('ingenium_favorites');
      if (generic) {
        setFavorites(JSON.parse(generic));
      }
    } catch (err) {
      console.warn('Failed to reload favorites:', err);
    }
  }, [currentUser?.id, currentUser?.email]);

  const toggleFavorite = (courseId: string) => {
    if (!courseId) return;
    const isFav = favorites.includes(courseId);
    const updated = isFav ? favorites.filter(id => id !== courseId) : [...favorites, courseId];
    setFavorites(updated);

    try {
      if (currentUser?.id) {
        localStorage.setItem(`ingenium_favorites_${currentUser.id}`, JSON.stringify(updated));
      }
      if (currentUser?.email) {
        localStorage.setItem(`ingenium_favorites_${currentUser.email}`, JSON.stringify(updated));
      }
      localStorage.setItem('ingenium_favorites', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save favorites to localStorage:', err);
    }

    setFavoriteToast({
      message: isFav ? 'Removed from favorites' : 'Added to favorites! ❤️',
      type: 'success'
    });
    setTimeout(() => setFavoriteToast(null), 3000);
  };

  const isFavorite = (courseId: string) => favorites.includes(courseId);

  const favoriteCourses = useMemo(() => {
    return courses.filter(c => favorites.includes(c.id));
  }, [courses, favorites]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  
  // Selection status filter
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Detailed overlays states
  const [selectedCourseForDetails, setSelectedCourseForDetails] = useState<Course | null>(null);
  const [showClassTimeSelector, setShowClassTimeSelector] = useState(false);
  const [chosenScheduleId, setChosenScheduleId] = useState<string>('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [singleCourseForCheckout, setSingleCourseForCheckout] = useState<{ course: Course; scheduleId?: string; scheduleLabel?: string } | undefined>(undefined);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarToast, setAvatarToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset value so user can re-select same file if needed
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setAvatarToast({ message: 'Please select a valid image file (PNG, JPG, WebP).', type: 'error' });
      setTimeout(() => setAvatarToast(null), 4000);
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setAvatarToast({ message: 'Image size exceeds 8MB. Please choose a smaller photo.', type: 'error' });
      setTimeout(() => setAvatarToast(null), 4000);
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarToast(null);

    try {
      // Client-side image optimization (max 480x480) for instant loading
      const optimizedBlob = await new Promise<File>((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const maxDim = 480;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                return;
              }
              resolve(file);
            }, 'image/jpeg', 0.88);
          } else {
            resolve(file);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
        };
        img.src = objectUrl;
      });

      // Upload using dataService.profile.uploadAvatar (with Supabase Storage + Data URL fallback)
      const newAvatarUrl = await dataService.profile.uploadAvatar(currentUser.id, optimizedBlob);

      // Persist to Supabase profiles table
      const { profile: updatedProfile, error } = await dataService.profile.updateProfile(currentUser.id, {
        avatar_url: newAvatarUrl
      });

      if (error) {
        throw new Error(error);
      }

      // Update local and root app state
      const nextUser: Profile = {
        ...currentUser,
        avatar_url: newAvatarUrl
      };
      onProfileUpdate(updatedProfile || nextUser);

      setAvatarToast({ message: 'Profile picture updated successfully!', type: 'success' });
      setTimeout(() => setAvatarToast(null), 3500);
    } catch (err: any) {
      console.error('[StudentApp] Failed to update avatar:', err);
      setAvatarToast({ 
        message: err?.message || 'Could not update profile picture. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => setAvatarToast(null), 4000);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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

  // Memoize approved courses and active schedules to avoid continuous reference recreation and flicker
  const approvedCourses = useMemo(() => {
    const enrolledIds = new Set([
      ...enrollments.filter(e => e.status !== 'dropped' && e.status !== 'cancelled').map(e => e.course_id),
      ...selections.filter(s => s.status === 'approved' || s.status === 'paid' || s.status === 'active').map(s => s.course_id)
    ]);
    return courses.filter(c => enrolledIds.has(c.id));
  }, [courses, enrollments, selections]);

  const activeSchedules = useMemo(() => {
    return Object.values(schedulesMap).flat();
  }, [schedulesMap]);

  const [loading, setLoading] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // Load all student specific data
  const loadStudentData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const fetchedCats = await dataService.categories.getCategories();
      setCategories(fetchedCats.filter(c => c.is_active));

      const [fetchedEnrollments, fetchedSelections] = await Promise.all([
        dataService.enrollments.getEnrollments(currentUser.id),
        dataService.selections.getCourseSelections(currentUser.id)
      ]);
      setEnrollments(fetchedEnrollments);
      setSelections(fetchedSelections);

      const enrolledOrSelectedIds = new Set([
        ...fetchedEnrollments.map(e => e.course_id),
        ...fetchedSelections.map(s => s.course_id)
      ]);

      const fetchedCourses = await dataService.courses.getCourses();
      // Requirement: Without a teacher assigned, course is not visible to students to buy yet!
      // Students who already enrolled/applied can still see their course.
      const visibleCourses = fetchedCourses.filter(c => 
        (c.is_published || c.status === 'published') && (c.has_assigned_teacher || enrolledOrSelectedIds.has(c.id))
      );
      setCourses(visibleCourses);

      const tempSchedules: Record<string, CourseSchedule[]> = {};
      for (const course of visibleCourses) {
        const scheds = await dataService.courses.getCourseSchedules(course.id);
        tempSchedules[course.id] = scheds;
      }
      setSchedulesMap(tempSchedules);

      // Fetch authentic notifications for current student
      const fetchedNotifications = await dataService.notifications.getForUser(currentUser.id);
      setNotifications(fetchedNotifications);
    } catch (e) {
      console.error("Error loading student data", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    loadStudentData(false);

    // Smart auto-refresh subscription (Supabase Realtime, tab visibility, cross-tab broadcasts)
    const unsubscribe = realtimeSync.subscribe((event) => {
      // If course selections, enrollments, courses, or schedules changed, refresh student data in background
      loadStudentData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser.id]);

  const gatewayRouting = useMemo(() => {
    return determinePaymentRouting(currentUser.country);
  }, [currentUser.country]);

  const getCoursePriceAndCurrency = (course: Course) => {
    return getCoursePriceForCountry(course, currentUser.country);
  };

  const pendingTotal = useMemo(() => {
    const enrolledIds = new Set([
      ...enrollments.filter(e => e.status !== 'dropped' && e.status !== 'cancelled').map(e => e.course_id),
      ...selections.filter(s => s.status === 'approved' || s.status === 'paid' || s.status === 'active').map(s => s.course_id)
    ]);
    return selections
      .filter(s => s.status === 'pending' && !enrolledIds.has(s.course_id))
      .reduce((acc, sel) => {
        const c = courses.find(course => course.id === sel.course_id);
        const p = getCoursePriceForCountry(c, currentUser.country);
        return acc + p.price;
      }, 0);
  }, [selections, courses, enrollments, currentUser.country]);

  const handleSelectCourse = async () => {
    if (!selectedCourseForDetails) return;
    
    // Guard: Prevent selecting an already owned course
    if (isEnrolledInCourse(selectedCourseForDetails.id)) {
      setFavoriteToast({
        message: 'You already own this course (Purchased & Enrolled).',
        type: 'info'
      });
      setTimeout(() => setFavoriteToast(null), 3500);
      setShowClassTimeSelector(false);
      return;
    }

    // Guard: Prevent duplicate pending selection
    const existingPending = selections.find(s => s.course_id === selectedCourseForDetails.id && s.status === 'pending');
    if (existingPending) {
      setFavoriteToast({
        message: 'This course is already in your course selections.',
        type: 'info'
      });
      setTimeout(() => setFavoriteToast(null), 3500);
      setShowClassTimeSelector(false);
      setSelectedCourseForDetails(null);
      setActiveTab('selections');
      return;
    }

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
    if (!courseId) return false;
    return enrollments.some(e => e.course_id === courseId && e.status !== 'dropped' && e.status !== 'cancelled') || 
           selections.some(s => s.course_id === courseId && (s.status === 'approved' || s.status === 'paid' || s.status === 'active'));
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

  if (selectedCourseForDashboard) {
    return (
      <StudentCourseDashboard
        course={selectedCourseForDashboard}
        currentUser={currentUser}
        onBack={() => setSelectedCourseForDashboard(null)}
        onOpenClassroom={() => {
          setSelectedCourseForDashboard(null);
          setActiveTab('classroom');
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#F9F9F9] text-[#111111] font-sans selection:bg-[#0A9D8F]/30 overflow-hidden flex flex-col">
      
      {/* Responsive App Container - Locked viewport, never page scrolls */}
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-white h-full max-h-[100dvh] shadow-sm sm:shadow-lg relative flex flex-col border-x border-[#0A9D8F]/20 overflow-hidden">
        
        {/* Global Floating Toast for Favorites & Feedback */}
        {favoriteToast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl bg-zinc-900/95 backdrop-blur-md text-white text-xs font-semibold shadow-2xl border border-white/15 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200">
            <Heart className="w-4 h-4 fill-red-500 text-red-500 shrink-0" />
            <span>{favoriteToast.message}</span>
          </div>
        )}
        
        {/* DETAILED OVERLAY 2: CHOOSE CLASS TIME */}
        {selectedCourseForDetails && showClassTimeSelector && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col justify-between animate-in slide-in-from-right duration-250">
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[#F2F2F2] flex items-center justify-between pt-safe">
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
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
              {/* Local timezone alert banner */}
              <div className="bg-[#E6F5F4] border border-[#0A9D8F]/30 p-4 rounded-2xl flex items-start gap-3">
                <Globe className="w-4 h-4 text-[#087A6F] shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-[#087A6F] leading-relaxed">
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
                              ? 'border-[#0A9D8F] bg-[#0A9D8F]/5' 
                              : 'border-[#EAEAEA] hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Custom Radio Button */}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'border-[#0A9D8F] bg-[#0A9D8F]' : 'border-zinc-300 bg-white'
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
                              ? 'bg-[#0A9D8F]/15 text-[#087A6F]' 
                              : 'bg-[#E6F5F4] text-[#087A6F]'
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
            <div className="p-4 sm:p-6 border-t border-[#F2F2F2] space-y-2.5 bg-white pb-safe">
              {isEnrolledInCourse(selectedCourseForDetails.id) ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>You Already Own This Course</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    You are already enrolled with active lifetime access. You cannot purchase the same course multiple times.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const c = selectedCourseForDetails;
                      setShowClassTimeSelector(false);
                      setSelectedCourseForDetails(null);
                      setSelectedCourseForDashboard(c);
                      setActiveTab('classroom');
                    }}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Go to Course & Classroom</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button 
                    onClick={handleSelectCourse}
                    disabled={loading || !(schedulesMap[selectedCourseForDetails.id] || []).some(s => s.id === chosenScheduleId || !s.id)}
                    className="w-full py-3.5 rounded-xl border border-[#0A9D8F] text-[#0A9D8F] hover:bg-[#E6F5F4]/60 text-xs font-semibold transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? 'Adding...' : 'Add to Selection'}
                  </button>

                  <button 
                    onClick={() => {
                      const sched = (schedulesMap[selectedCourseForDetails.id] || []).find(s => s.id === chosenScheduleId);
                      setSingleCourseForCheckout({
                        course: selectedCourseForDetails,
                        scheduleId: chosenScheduleId || undefined,
                        scheduleLabel: sched?.label || 'Standard Schedule'
                      });
                      setShowClassTimeSelector(false);
                      setSelectedCourseForDetails(null);
                      setShowCheckoutModal(true);
                    }}
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold transition-all shadow-xs active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Buy Now ({gatewayRouting.gatewayName})</span>
                  </button>
                </div>
              )}

              {!isEnrolledInCourse(selectedCourseForDetails.id) && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-normal">
                  <Lock className="w-3 h-3 text-[#0A9D8F]" />
                  <span>Instant activation upon payment completion</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DETAILED OVERLAY 1: COURSE DETAILS */}
        {selectedCourseForDetails && !showClassTimeSelector && (
          <div className="absolute inset-0 bg-white z-40 flex flex-col justify-between animate-in slide-in-from-right duration-250">
            {/* Scrollable Details */}
            <div className="flex-1 overflow-y-auto pb-6">
              
              {/* Back & Heart Hero Overlay Header */}
              <div className="relative w-full aspect-[16/10] max-h-80 bg-zinc-100">
                <img 
                  src={getCourseImage(selectedCourseForDetails)} 
                  alt={selectedCourseForDetails.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {/* Header buttons overlay */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pt-safe">
                  <button 
                    onClick={() => setSelectedCourseForDetails(null)}
                    className="p-2.5 rounded-full bg-white/90 shadow-md hover:bg-white text-black active:scale-95 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(selectedCourseForDetails.id);
                    }}
                    title={isFavorite(selectedCourseForDetails.id) ? "Remove from favorites" : "Add to favorites"}
                    className="p-2.5 rounded-full bg-white/90 shadow-md hover:bg-white active:scale-95 transition-all cursor-pointer"
                  >
                    <Heart className={`w-5 h-5 transition-colors ${isFavorite(selectedCourseForDetails.id) ? 'fill-red-500 text-red-500' : 'text-zinc-800'}`} />
                  </button>
                </div>
              </div>

              {/* Course Title and Badges */}
              <div className="px-4 sm:px-6 pt-5 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-[#E6F5F4] text-[#087A6F] text-xs font-semibold px-3 py-1 rounded-md">
                    {selectedCourseForDetails.category || 'Technology'}
                  </span>
                  {isEnrolledInCourse(selectedCourseForDetails.id) && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1 border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Purchased & Enrolled</span>
                    </span>
                  )}
                  {isFavorite(selectedCourseForDetails.id) && (
                    <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 border border-red-200">
                      <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      <span>In Favorites</span>
                    </span>
                  )}
                </div>

                <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                  {selectedCourseForDetails.title}
                </h1>

                {selectedCourseForDetails.teacher_name && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F]">
                      Instructor
                    </span>
                    <span className="font-semibold text-zinc-800">
                      {formatCapitalizedName(selectedCourseForDetails.teacher_name, 'Instructor')}
                    </span>
                  </div>
                )}

                <p className="text-xs text-zinc-500 font-normal leading-relaxed">
                  {selectedCourseForDetails.short_description || getCourseDescription(selectedCourseForDetails)}
                </p>

                {/* 3 Circular Horizontal Stat Info Boxes */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/25 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <Clock className="w-4 h-4 text-[#0A9D8F]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Duration</span>
                    <span className="text-xs font-semibold text-zinc-900">
                      {selectedCourseForDetails.duration || '8 Weeks'}
                    </span>
                  </div>
                  <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/25 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <BarChart2 className="w-4 h-4 text-[#0A9D8F]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Level</span>
                    <span className="text-xs font-semibold text-zinc-900">
                      {selectedCourseForDetails.level || 'Beginner'}
                    </span>
                  </div>
                  <div className="bg-[#E6F5F4]/30 border border-[#0A9D8F]/25 p-3 rounded-2xl flex flex-col items-center text-center space-y-1">
                    <Video className="w-4 h-4 text-[#0A9D8F]" />
                    <span className="text-[10px] text-zinc-400 font-medium">Mode</span>
                    <span className="text-xs font-semibold text-zinc-900">
                      {selectedCourseForDetails.training_mode === 'physical' ? 'Physical' : selectedCourseForDetails.training_mode === 'hybrid' ? 'Hybrid' : 'Live Online'}
                    </span>
                  </div>
                </div>

                {/* About This Course Section */}
                <div className="pt-4 space-y-2 border-t border-[#0A9D8F]/20">
                  <h3 className="text-sm font-semibold text-zinc-900">About this course</h3>
                  <p className="text-xs text-zinc-600 font-normal leading-relaxed whitespace-pre-line">
                    {selectedCourseForDetails.description || selectedCourseForDetails.short_description || 'Participate in professional instructor-led sessions, live weekly labs, and build a high-caliber portfolio to accelerate your career.'}
                  </p>
                </div>

                {/* What You Will Learn Section */}
                <div className="pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-900">What you will learn</h3>
                  <div className="space-y-2.5">
                    {getCourseLearningOutcomes(selectedCourseForDetails).map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-[#0A9D8F] flex items-center justify-center shrink-0 mt-0.5">
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
            <div className="px-4 sm:px-6 py-4 border-t border-[#0A9D8F]/20 bg-white flex items-center justify-between gap-4 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] pb-safe">
              {isEnrolledInCourse(selectedCourseForDetails.id) ? (
                <>
                  <div className="flex-1 min-w-0 pr-2">
                    <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold leading-none">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Purchased & Enrolled</span>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal mt-1 block">
                      Lifetime access • Already owned
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(selectedCourseForDetails.id)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                        isFavorite(selectedCourseForDetails.id)
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:text-red-500'
                      }`}
                      title={isFavorite(selectedCourseForDetails.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart className={`w-4 h-4 transition-colors ${isFavorite(selectedCourseForDetails.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </button>
                    
                    <button 
                      onClick={() => {
                        const c = selectedCourseForDetails;
                        setSelectedCourseForDetails(null);
                        setSelectedCourseForDashboard(c);
                        setActiveTab('classroom');
                      }}
                      className="py-3 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-all text-center shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Go to Classroom</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <span className="block text-[#0A9D8F] text-lg font-bold leading-none">
                      {getCoursePriceAndCurrency(selectedCourseForDetails).symbol}
                      {Number(getCoursePriceAndCurrency(selectedCourseForDetails).price).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-normal mt-1 block">
                      For your country
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    {/* Explicit Add to Favorites button */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(selectedCourseForDetails.id)}
                      className={`px-3 py-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isFavorite(selectedCourseForDetails.id)
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:text-red-500'
                      }`}
                      title={isFavorite(selectedCourseForDetails.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart className={`w-4 h-4 transition-colors ${isFavorite(selectedCourseForDetails.id) ? 'fill-red-500 text-red-500' : ''}`} />
                      <span className="hidden sm:inline">
                        {isFavorite(selectedCourseForDetails.id) ? 'Favorited' : 'Add to Favorites'}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        const courseScheds = schedulesMap[selectedCourseForDetails.id] || [];
                        if (courseScheds.length > 0) {
                          setChosenScheduleId(courseScheds[0].id);
                        }
                        setShowClassTimeSelector(true);
                      }}
                      className="px-4 sm:px-5 py-3.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs sm:text-sm font-semibold transition-all text-center shadow-sm cursor-pointer active:scale-98"
                    >
                      Choose Class Time
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* MAIN TAB 1: HOME / DISCOVERY */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
            {/* Header branding row - Pinned at top with pt-safe */}
            <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-[#F5F5F5] pt-safe sticky top-0 z-30 bg-white/95 backdrop-blur-md shrink-0">
              <BrandLogo size="sm" showText={true} showSubtitle={true} variant="dark" />

              {/* Notification bell */}
              <button 
                onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                className="p-2 rounded-full hover:bg-zinc-100 transition-colors relative cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 text-black" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0A9D8F] animate-pulse"></span>
                )}
              </button>
            </div>

            {/* Scrollable home area */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-6 pb-28">
              
              {/* Greetings */}
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-zinc-900 leading-tight">
                  Hi, {formatCapitalizedName(currentUser.full_name?.split(' ')[0] || currentUser.email?.split('@')[0], 'Student')}
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
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-50 border border-zinc-200/80 rounded-xl font-normal text-zinc-800 focus:outline-none focus:border-[#0A9D8F] placeholder:text-zinc-400"
                  />
                </div>
                {/* Filter sliders button */}
                <button 
                  onClick={() => setSelectedCategoryId('')}
                  className="p-2.5 rounded-xl bg-[#0A9D8F] text-white hover:bg-[#087A6F] transition-all flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
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
                    className="text-xs font-medium text-[#0A9D8F] hover:underline cursor-pointer"
                  >
                    See all
                  </button>
                </div>

                {/* Horizontal scrolling Categories layout exactly like reference */}
                <div className="flex items-start gap-3.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
                  {/* "All Courses" category box */}
                  <button
                    onClick={() => setSelectedCategoryId('')}
                    className="flex flex-col items-center gap-2 shrink-0 group cursor-pointer"
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                        !selectedCategoryId 
                          ? 'bg-[#0A9D8F] text-white shadow-xs' 
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
                              ? 'bg-[#0A9D8F] text-white shadow-xs' 
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
                    className="text-xs font-medium text-[#0A9D8F] hover:underline cursor-pointer"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCourses.map(course => {
                      const pricingInfo = getCoursePriceAndCurrency(course);
                      return (
                        <div 
                          key={course.id}
                          onClick={() => setSelectedCourseForDetails(course)}
                          className="bg-white border border-[#0A9D8F]/25 rounded-[20px] overflow-hidden shadow-xs hover:border-[#0A9D8F] transition-all cursor-pointer group"
                        >
                          {/* Top Image area with badges */}
                          <div className="w-full aspect-[16/9] relative bg-zinc-50 overflow-hidden">
                            <img 
                              src={getCourseImage(course)} 
                              alt={course.title} 
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                              referrerPolicy="no-referrer"
                            />
                            {/* Floating category or enrolled badge top left */}
                            {isEnrolledInCourse(course.id) ? (
                              <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Purchased</span>
                              </span>
                            ) : (
                              <span className="absolute top-3 left-3 bg-[#0A9D8F] text-white text-[10px] font-medium px-2.5 py-0.5 rounded-full shadow-xs">
                                {course.category || 'Technology'}
                              </span>
                            )}
                            {/* Heart icon top right */}
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(course.id);
                              }}
                              title={isFavorite(course.id) ? "Remove from favorites" : "Add to favorites"}
                              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/95 shadow-xs text-zinc-700 hover:scale-110 active:scale-90 transition-transform cursor-pointer"
                            >
                              <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorite(course.id) ? 'fill-red-500 text-red-500' : 'text-zinc-600 hover:text-red-500'}`} />
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
                            
                            {course.teacher_name && (
                              <p className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                                <span className="text-zinc-400">Instructor:</span>
                                <span className="font-semibold text-zinc-800">{formatCapitalizedName(course.teacher_name, 'Instructor')}</span>
                              </p>
                            )}
                            
                            {/* Stats bar */}
                            <div className="flex items-center justify-between pt-1 text-xs text-zinc-500 font-normal">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                  <span>{course.duration || '8 Weeks'}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <BarChart2 className="w-3.5 h-3.5 text-[#0A9D8F]" />
                                  <span>{course.level || 'Beginner'}</span>
                                </span>
                              </div>
                              {isEnrolledInCourse(course.id) ? (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Enrolled</span>
                                </span>
                              ) : (
                                <span className="text-sm font-bold text-[#0A9D8F]">
                                  {pricingInfo.symbol}{Number(pricingInfo.price).toLocaleString()}
                                </span>
                              )}
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

        {/* MAIN TAB: MY CLASSROOM */}
        {activeTab === 'classroom' && (
          <StudentClassroom
            currentUser={currentUser}
            approvedCourses={approvedCourses}
            activeSchedules={activeSchedules}
            onOpenCourse={(c) => setSelectedCourseForDashboard(c)}
          />
        )}

        {/* MAIN TAB: PROGRESS (Calculated from Real Supabase Learning Records) */}
        {activeTab === 'progress' && (
          <CourseProgressView 
            currentUser={currentUser}
            courses={approvedCourses}
            onBack={() => setActiveTab('home')}
            onOpenLesson={(course) => {
              setSelectedCourseForDashboard(course);
              setActiveTab('classroom');
            }}
          />
        )}

        {/* MAIN TAB: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="px-4 sm:px-6 py-4 border-b border-[#F5F5F5] flex items-center justify-between sticky top-0 bg-white z-10 pt-safe">
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => setActiveTab('home')}
                  className="p-1 rounded-lg text-zinc-700 hover:bg-zinc-100 cursor-pointer transition"
                  aria-label="Back to home"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <span>Favorite Courses</span>
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                  </h1>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {favoriteCourses.length} {favoriteCourses.length === 1 ? 'course' : 'courses'} saved to your wishlist
                  </p>
                </div>
              </div>
              <BrandLogo size="xs" />
            </div>

            <div className="p-4 sm:px-6 py-4 flex-1 overflow-y-auto">
              {favoriteCourses.length === 0 ? (
                <div className="p-10 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-3xl space-y-3 max-w-sm mx-auto my-8">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center mx-auto">
                    <Heart className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-800">No favorite courses yet</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Tap the heart icon on any course card in the catalog to bookmark courses you want to study.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-6 py-2.5 rounded-xl bg-[#0A9D8F] text-white text-xs font-semibold hover:bg-[#087A6F] transition cursor-pointer"
                  >
                    Browse Courses
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {favoriteCourses.map(course => {
                    const enrolled = isEnrolledInCourse(course.id);
                    const pricing = getCoursePriceAndCurrency(course);
                    return (
                      <div 
                        key={course.id}
                        className="p-4 bg-white border border-zinc-200 rounded-2xl flex flex-col justify-between shadow-2xs hover:border-zinc-300 transition space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-xl bg-zinc-100 overflow-hidden shrink-0">
                            <img 
                              src={getCourseImage(course)} 
                              alt={course.title}
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#0A9D8F] uppercase tracking-wider">
                                {course.category || 'Technology'}
                              </span>
                              <button
                                onClick={() => toggleFavorite(course.id)}
                                className="p-1 text-red-500 hover:text-red-700 transition cursor-pointer"
                                title="Remove from favorites"
                              >
                                <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                              </button>
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-zinc-900 line-clamp-1 mt-0.5">
                              {course.title}
                            </h4>
                            <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">
                              {getCourseDescription(course)}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                          {enrolled ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Purchased</span>
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-zinc-900">
                              {pricing.symbol}{Number(pricing.price).toLocaleString()}
                            </span>
                          )}

                          <button
                            onClick={() => {
                              if (enrolled) {
                                setSelectedCourseForDashboard(course);
                                setActiveTab('classroom');
                              } else {
                                setSelectedCourseForDetails(course);
                              }
                            }}
                            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              enrolled 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                : 'bg-[#0A9D8F] hover:bg-[#087A6F] text-white shadow-xs'
                            }`}
                          >
                            {enrolled ? (
                              <>
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Go to Course</span>
                              </>
                            ) : (
                              <>
                                <span>Enroll Now</span>
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAIN TAB 2: MY SELECTION */}
        {activeTab === 'selections' && (
          <div className="flex-1 flex flex-col bg-white">
            <div className="px-4 sm:px-6 py-4 border-b border-[#F5F5F5] flex items-center justify-between pt-safe">
              <div className="flex items-center gap-2.5">
                <BrandLogo size="xs" />
                <h1 className="text-base font-semibold text-zinc-900">My Selection</h1>
              </div>
              <button 
                onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                className="p-2 rounded-full hover:bg-zinc-100 transition-colors relative cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4 text-zinc-800" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0A9D8F] animate-pulse"></span>
                )}
              </button>
            </div>

            {/* Segmented status filter tabs with underline indicator */}
            <div className="px-4 sm:px-6 border-b border-[#F0F0F0] flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
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
                      ? 'text-[#0A9D8F] font-semibold' 
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  {tab.label}
                  {selectionFilter === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0A9D8F] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              {selections.filter(s => selectionFilter === 'all' ? true : s.status === selectionFilter).length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 border border-zinc-100 rounded-3xl space-y-2 mt-6">
                  <Heart className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-normal text-zinc-400">You haven't selected any courses yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0">
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
                            
                            {/* Status label with clear Purchased & Enrolled grammar */}
                            <div className="mt-1 flex items-center">
                              {isEnrolledInCourse(sel.course_id) || sel.status === 'approved' ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Purchased & Enrolled</span>
                                </span>
                              ) : sel.status === 'rejected' ? (
                                <span className="text-xs font-medium text-red-500 capitalize">Rejected</span>
                              ) : (
                                <span className="text-xs font-medium text-amber-500 capitalize">Pending Payment</span>
                              )}
                            </div>
                          </div>

                          {/* Price Snapshot on right */}
                          <div className="text-right shrink-0">
                            {isEnrolledInCourse(sel.course_id) || sel.status === 'approved' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (courseObj) {
                                    setSelectedCourseForDashboard(courseObj);
                                    setActiveTab('classroom');
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Go to Course</span>
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#0A9D8F]">
                                {sel.currency_snapshot === 'NGN' ? '₦' : sel.currency_snapshot === 'EUR' ? '€' : '$'}
                                {Number(sel.price_snapshot || 0).toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Red delete trash button top right */}
                          {sel.status === 'pending' && !isEnrolledInCourse(sel.course_id) && (
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

            {/* Bottom Checkout / Pay Now Box for Pending Selections */}
            {selections.some(s => s.status === 'pending' && !isEnrolledInCourse(s.course_id)) && (
              <div className="p-4 mx-4 sm:mx-6 mb-3 bg-[#E6F5F4] border border-[#0A9D8F]/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-[#087A6F]">Instant Admission with {gatewayRouting.gatewayName}</h4>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    Pay securely with {gatewayRouting.gatewayName === 'Wittypay' ? 'card or transfer' : 'PayPal or card'} for automatic, immediate classroom activation.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSingleCourseForCheckout(undefined);
                    setShowCheckoutModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pay Now ({gatewayRouting.symbol}{pendingTotal.toLocaleString()})</span>
                </button>
              </div>
            )}

            {/* Bottom Waiting Alert Box */}
            <div className="p-4 mx-4 sm:mx-6 mb-6 bg-zinc-50 border border-zinc-200/70 rounded-2xl">
              <p className="text-xs font-normal text-zinc-500 text-center leading-relaxed">
                Courses are automatically enrolled upon completed payment, or can be reviewed and approved by academy admins.
              </p>
            </div>
          </div>
        )}

        {/* MAIN TAB 3: MY LEARNING */}
        {activeTab === 'learning' && (
          <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
            <div className="px-4 sm:px-6 py-3.5 border-b border-[#F5F5F5] flex items-center justify-between pt-safe sticky top-0 z-30 bg-white/95 backdrop-blur-md shrink-0">
              <h1 className="text-base font-semibold text-zinc-900">My Learning</h1>
              <BrandLogo size="xs" />
            </div>

            {/* List of active courses */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 pb-28">
              {enrollments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 pt-20">
                  {/* Official Ingenium Brand Logo with soft green frame */}
                  <div className="relative flex items-center justify-center w-28 h-28 rounded-3xl bg-[#E6F5F4] border border-[#0A9D8F]/20 p-4 shadow-xs">
                    <BrandLogo size={56} />
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
                    className="px-8 py-3 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-semibold shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    Explore Courses
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-0">
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
                          {/* Live Meeting Link (Enforcing 15-minute window) */}
                          <StudentClassMeetingLink 
                            scheduleId={enr.schedule_id} 
                            onOpenClassroom={() => {
                              setSelectedCourseForDashboard(null);
                              setActiveTab('classroom');
                            }}
                          />

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (courseObj) setSelectedCourseForDashboard(courseObj);
                              }}
                              className="flex-1 py-2.5 px-4 rounded-xl bg-[#0A9D8F] hover:bg-[#087A6F] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Course Dashboard & Lessons</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourseForDashboard(null);
                                setActiveTab('classroom');
                              }}
                              className="py-2.5 px-3 rounded-xl bg-[#E6F5F4] hover:bg-[#0A9D8F] text-[#0A9D8F] hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                              title="Go to Live Classroom"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Classroom</span>
                            </button>
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
          <div className="flex-1 flex flex-col bg-white overflow-hidden h-full">
            
            {/* Pinned Top Header Bar with Safe Area - Never scrolls off screen */}
            <div className="bg-[#0A9D8F] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between pt-safe sticky top-0 z-30 shrink-0 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-50">Student Profile</span>
              <BrandLogo size="xs" variant="light" />
            </div>

            {/* Scrollable Profile Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain pb-28">
              {/* Green Header Banner with Avatar & Identity */}
              <div className="bg-[#0A9D8F] px-6 pb-6 pt-1 text-white text-center rounded-b-[32px] space-y-3.5 shadow-xs">
                {/* Hidden file input for avatar selection */}
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarFileSelect}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingAvatar}
                />

                {/* User photo matching Screen 6 */}
                <div className="relative w-20 h-20 mx-auto">
                  <div 
                    onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                    className="w-full h-full rounded-full border-3 border-white overflow-hidden bg-white shadow-xs flex items-center justify-center cursor-pointer group relative"
                    title="Click to change profile picture"
                  >
                    <img 
                      src={currentUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"} 
                      alt={currentUser.full_name || 'Profile'}
                      className={`w-full h-full object-cover transition-opacity ${isUploadingAvatar ? 'opacity-40' : 'group-hover:opacity-90'}`}
                      referrerPolicy="no-referrer"
                    />
                    {isUploadingAvatar ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>

                  {/* Green pencil edit button on lower right */}
                  <button 
                    type="button"
                    onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    title="Upload profile picture"
                    aria-label="Upload profile picture"
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#0A9D8F] text-white shadow-sm border-2 border-white hover:scale-110 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingAvatar ? (
                      <div className="w-3 h-3 border-1.5 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Pencil className="w-3 h-3 stroke-[2.5]" />
                    )}
                  </button>
                </div>

                {/* Toast message if uploaded or error */}
                {avatarToast && (
                  <div className={`text-xs px-3.5 py-1.5 rounded-xl font-medium max-w-xs mx-auto animate-in fade-in duration-200 ${
                    avatarToast.type === 'success' 
                      ? 'bg-white/20 text-white backdrop-blur-xs border border-white/30' 
                      : 'bg-red-500 text-white shadow-xs'
                  }`}>
                    {avatarToast.message}
                  </div>
                )}

                {/* Identity labels */}
                <div className="space-y-0.5">
                  <h3 className="text-base font-semibold tracking-tight text-white">
                    {formatCapitalizedName(currentUser.full_name || currentUser.email, 'Student')}
                  </h3>
                  <p className="text-xs text-emerald-100 font-normal">{currentUser.email}</p>
                </div>
              </div>

              {/* Read-Only demographic card details (matching Screen 6) */}
              <div className="p-6 space-y-5">
              <div className="bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden divide-y divide-[#F5F5F5] shadow-xs">
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <span className="font-normal text-zinc-500">Country</span>
                  <span className="font-semibold text-zinc-900">
                    {currentUser.country || 'Nigeria'}
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
                {currentUser.phone && currentUser.phone.trim() !== '' && (
                  <div className="p-3.5 flex items-center justify-between text-xs">
                    <span className="font-normal text-zinc-500">Phone</span>
                    <span className="font-semibold text-zinc-900">{currentUser.phone}</span>
                  </div>
                )}
              </div>

              {/* Option Rows Menu list matching Screen 6 */}
              <div className="space-y-2.5">
                {/* Favorite Courses */}
                <button 
                  onClick={() => setActiveTab('favorites')}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    <span className="font-semibold text-zinc-900">Favorite Courses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {favorites.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">
                        {favorites.length}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* My Course Selections */}
                <button 
                  onClick={() => setActiveTab('selections')}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-[#0A9D8F]" />
                    <span>My Course Selections</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selections.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#E6F5F4] text-[#0A9D8F] text-[10px] font-bold">
                        {selections.length}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Settings */}
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-zinc-500" />
                    <span>Settings</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {favorites.length > 0 && (
                      <span className="text-[10px] text-zinc-400">
                        {favorites.length} saved
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Help & Support */}
                <button 
                  onClick={() => alert("Ingenium Support: Reach out via ingeniumvirtualassistant@zohomail.com")}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-zinc-500" />
                    <span>Help & Support</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* About Ingenium Tech Academy */}
                <button 
                  onClick={() => alert("Ingenium Tech Academy - Empowering students with world-class tech education and live mentor classrooms.")}
                  className="w-full p-3.5 bg-white border border-[#EAEAEA] rounded-xl flex items-center justify-between hover:border-zinc-300 transition-colors text-xs font-medium text-zinc-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Info className="w-4 h-4 text-zinc-500" />
                    <span>About Ingenium Tech Academy</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

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
        </div>
        )}

        {/* FIXED BOTTOM TASKBAR - Pinned permanently to device bottom with pb-safe, never scrolls up */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/98 backdrop-blur-md border-t border-[#0A9D8F]/20 py-2 px-4 pb-safe flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.06)] max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto">
          
          <button
            onClick={() => {
              setSelectedCourseForDashboard(null);
              setActiveTab('home');
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'home' && !selectedCourseForDashboard ? 'text-[#0A9D8F] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <HomeIcon className={`w-5 h-5 stroke-[2] ${activeTab === 'home' && !selectedCourseForDashboard ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">Home</span>
          </button>

          <button
            onClick={() => {
              setSelectedCourseForDashboard(null);
              setActiveTab('learning');
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'learning' && !selectedCourseForDashboard ? 'text-[#0A9D8F] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <BookOpen className={`w-5 h-5 stroke-[2] ${activeTab === 'learning' && !selectedCourseForDashboard ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">My Courses</span>
          </button>

          <button
            onClick={() => {
              setSelectedCourseForDashboard(null);
              setActiveTab('classroom');
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'classroom' && !selectedCourseForDashboard ? 'text-[#0A9D8F] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Video className={`w-5 h-5 stroke-[2] ${activeTab === 'classroom' && !selectedCourseForDashboard ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">My Classroom</span>
          </button>

          <button
            onClick={() => {
              setSelectedCourseForDashboard(null);
              setActiveTab('progress');
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'progress' && !selectedCourseForDashboard ? 'text-[#0A9D8F] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <BarChart2 className={`w-5 h-5 stroke-[2] ${activeTab === 'progress' && !selectedCourseForDashboard ? 'text-[#0A9D8F]' : ''}`} />
            <span className="text-[10px] font-medium">Progress</span>
          </button>

          <button
            onClick={() => {
              setSelectedCourseForDashboard(null);
              setActiveTab('profile');
            }}
            className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
              activeTab === 'profile' && !selectedCourseForDashboard ? 'text-[#0A9D8F] font-semibold' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <User className={`w-5 h-5 stroke-[2] ${activeTab === 'profile' && !selectedCourseForDashboard ? 'fill-current' : ''}`} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
          
        </nav>

        {/* Automatic Course Checkout Modal */}
        {showCheckoutModal && (
          <CheckoutModal
            currentUser={currentUser}
            courses={courses}
            selections={selections}
            enrollments={enrollments}
            singleCourse={singleCourseForCheckout}
            onClose={() => {
              setShowCheckoutModal(false);
              setSingleCourseForCheckout(undefined);
            }}
            onSuccess={(orderId) => {
              setShowCheckoutModal(false);
              setSingleCourseForCheckout(undefined);
              loadStudentData(false);
              setActiveTab('learning');
            }}
          />
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">Account Settings</h3>
                    <p className="text-[11px] text-zinc-400">Preferences & saved courses</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* 1. Dedicated Favorite Courses section in Settings */}
                <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                      <span className="text-xs font-bold text-zinc-900">Favorite Courses</span>
                    </div>
                    <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200 shadow-2xs">
                      {favorites.length} saved
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Courses you have saved to your favorites wishlist for quick access and study.
                  </p>

                  {/* Action buttons in Settings */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowFavoritesInSettings(!showFavoritesInSettings)}
                      className="flex-1 py-2 px-3 rounded-xl bg-white border border-red-200/90 hover:bg-red-50 text-red-700 text-xs font-semibold transition flex items-center justify-between shadow-2xs cursor-pointer active:scale-98"
                    >
                      <span className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                        <span>{showFavoritesInSettings ? 'Hide Saved Courses' : `Show Saved Courses (${favoriteCourses.length})`}</span>
                      </span>
                      <ChevronRight className={`w-3.5 h-3.5 text-red-400 transition-transform ${showFavoritesInSettings ? 'rotate-90' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsModal(false);
                        setActiveTab('favorites');
                      }}
                      className="py-2 px-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-98 shrink-0"
                      title="Open full favorites page"
                    >
                      <span>Full Page</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Inline list of favorited courses */}
                  {showFavoritesInSettings && (
                    <div className="pt-1 space-y-2">
                      {favoriteCourses.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-white/90 border border-dashed border-red-200 text-center space-y-1">
                          <p className="text-xs font-semibold text-zinc-700">No favorite courses yet</p>
                          <p className="text-[11px] text-zinc-400">Tap the heart icon on any course card to bookmark it.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSettingsModal(false);
                              setActiveTab('home');
                            }}
                            className="mt-1 px-3 py-1 rounded-lg bg-[#0A9D8F] text-white text-[11px] font-semibold hover:bg-[#087A6F] cursor-pointer"
                          >
                            Browse Courses
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {favoriteCourses.map(course => {
                            const enrolled = isEnrolledInCourse(course.id);
                            const pricing = getCoursePriceAndCurrency(course);
                            return (
                              <div
                                key={course.id}
                                className="p-2.5 bg-white rounded-xl border border-red-100/90 flex items-center justify-between gap-2.5 shadow-2xs hover:border-red-200 transition"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
                                    <img
                                      src={getCourseImage(course)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h5 className="text-xs font-bold text-zinc-900 truncate">
                                      {course.title}
                                    </h5>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {enrolled ? (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded flex items-center gap-0.5 border border-emerald-200/60">
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                          <span>Purchased</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-[#0A9D8F]">
                                          {pricing.symbol}{Number(pricing.price).toLocaleString()}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-zinc-400 truncate">• {course.category || 'Tech'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowSettingsModal(false);
                                      if (enrolled) {
                                        setSelectedCourseForDashboard(course);
                                        setActiveTab('classroom');
                                      } else {
                                        setSelectedCourseForDetails(course);
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                      enrolled
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                        : 'bg-[#0A9D8F] text-white hover:bg-[#087A6F] shadow-2xs'
                                    }`}
                                  >
                                    {enrolled ? (
                                      <>
                                        <BookOpen className="w-3 h-3" />
                                        <span>Go to Course</span>
                                      </>
                                    ) : (
                                      <span>Enroll</span>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => toggleFavorite(course.id)}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 transition cursor-pointer rounded-lg hover:bg-red-50"
                                    title="Remove from favorites"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Account Details */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Student Profile</h4>
                  <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-200/80 divide-y divide-zinc-200/60 text-xs">
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Name</span>
                      <span className="font-semibold text-zinc-900">{formatCapitalizedName(currentUser.full_name || currentUser.email, 'Student')}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Email</span>
                      <span className="font-semibold text-zinc-900 truncate max-w-[200px]">{currentUser.email}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Country</span>
                      <span className="font-semibold text-zinc-900">{currentUser.country || 'Nigeria'}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Timezone</span>
                      <span className="font-semibold text-zinc-900">{currentUser.timezone || 'Africa/Lagos'}</span>
                    </div>
                  </div>
                </div>

                {/* Learning Stats Quick Overview */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Academy Enrollment</h4>
                  <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-200/80 divide-y divide-zinc-200/60 text-xs">
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Enrolled Courses</span>
                      <span className="font-bold text-[#0A9D8F]">{approvedCourses.length}</span>
                    </div>
                    <div className="py-2 flex justify-between">
                      <span className="text-zinc-500">Pending Applications</span>
                      <span className="font-bold text-amber-600">{selections.filter(s => s.status === 'pending').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex justify-end">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Universal Notification Center Modal */}
        <NotificationCenterModal
          isOpen={showNotificationCenter}
          onClose={() => setShowNotificationCenter(false)}
          notifications={notifications}
          onMarkAsRead={async (id: string) => {
            await dataService.notifications.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
          }}
          onMarkAllAsRead={async () => {
            await dataService.notifications.markAllAsRead(currentUser.id);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
          }}
          onDelete={async (id: string) => {
            await dataService.notifications.delete(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
          }}
          onRefresh={() => loadStudentData(true)}
          currentUserRole="student"
        />

      </div>
    </div>
  );
};
