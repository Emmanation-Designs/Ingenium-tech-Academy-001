import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Profile, Course, CourseSchedule, CourseSelection, 
  Enrollment, Payment, UserRole, SelectionStatus, PaymentStatus, EnrollmentStatus,
  CourseCategory, CoursePricing
} from '../types';

// ====================================================================
// Local Database Engine (Fallback when Supabase is not connected)
// ====================================================================

const getLocalData = <T>(key: string): T[] => {
  const data = localStorage.getItem(`ingenium_${key}`);
  return data ? JSON.parse(data) : [];
};

const setLocalData = <T>(key: string, data: T[]): void => {
  localStorage.setItem(`ingenium_${key}`, JSON.stringify(data));
};

const getLocalSession = (): Profile | null => {
  const session = localStorage.getItem('ingenium_session');
  return session ? JSON.parse(session) : null;
};

const setLocalSession = (profile: Profile | null): void => {
  if (profile) {
    localStorage.setItem('ingenium_session', JSON.stringify(profile));
  } else {
    localStorage.removeItem('ingenium_session');
  }
};

interface SelectionSnapshotMeta {
  price_snapshot?: number;
  currency_snapshot?: string;
  student_country?: string;
}

const getSelectionMetaMap = (): Record<string, SelectionSnapshotMeta> => {
  try {
    const raw = localStorage.getItem('ingenium_selection_meta');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveSelectionMeta = (idOrRef: string, meta: SelectionSnapshotMeta): void => {
  try {
    const map = getSelectionMetaMap();
    map[idOrRef] = { ...map[idOrRef], ...meta };
    localStorage.setItem('ingenium_selection_meta', JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
};

// ====================================================================
// ====================================================================
// Default Catalog Data (Data Science, Design, Marketing, Development)
// ====================================================================

export const isValidUUID = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export const generateValidUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const LEGACY_ID_TO_UUID: Record<string, string> = {
  'course-fullstack-dev': 'c0000001-0000-4000-8000-000000000001',
  'course-data-science': 'c0000001-0000-4000-8000-000000000002',
  'course-ui-ux-design': 'c0000001-0000-4000-8000-000000000003',
  'course-digital-marketing': 'c0000001-0000-4000-8000-000000000004',
  'sched-dev-weekend': 's0000001-0000-4000-8000-000000000001',
  'sched-dev-weekday': 's0000001-0000-4000-8000-000000000002',
  'sched-ds-weekend': 's0000001-0000-4000-8000-000000000003',
  'sched-design-weekend': 's0000001-0000-4000-8000-000000000004',
  'sched-mkt-weekday': 's0000001-0000-4000-8000-000000000005',
  'cat-development': 'd0000001-0000-4000-8000-000000000001',
  'cat-data-science': 'd0000001-0000-4000-8000-000000000002',
  'cat-design': 'd0000001-0000-4000-8000-000000000003',
  'cat-marketing': 'd0000001-0000-4000-8000-000000000004',
  'price-dev-1': 'p0000001-0000-4000-8000-000000000001',
  'price-ds-1': 'p0000001-0000-4000-8000-000000000002',
  'price-design-1': 'p0000001-0000-4000-8000-000000000003',
  'price-mkt-1': 'p0000001-0000-4000-8000-000000000004',
};

export const normalizeToUUID = (id?: string | null): string | undefined => {
  if (!id) return undefined;
  return LEGACY_ID_TO_UUID[id] || id;
};

export const DEFAULT_CATEGORIES: CourseCategory[] = [
  {
    id: 'd0000001-0000-4000-8000-000000000002',
    name: 'Data Science',
    slug: 'data-science',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'd0000001-0000-4000-8000-000000000003',
    name: 'Design',
    slug: 'design',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'd0000001-0000-4000-8000-000000000004',
    name: 'Marketing',
    slug: 'marketing',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'd0000001-0000-4000-8000-000000000001',
    name: 'Development',
    slug: 'development',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

export const DEFAULT_COURSES: Course[] = [
  {
    id: 'c0000001-0000-4000-8000-000000000001',
    title: 'Full Stack Web Development',
    slug: 'full-stack-web-development',
    short_description: 'Master React, TypeScript, Node.js, and modern cloud deployment pipelines from scratch.',
    description: 'A comprehensive, industry-grade training program designed to take you from fundamentals to deploying full-scale, scalable web applications with React, Node.js, and modern cloud infrastructure.',
    category_id: 'd0000001-0000-4000-8000-000000000001',
    category: 'Development',
    duration: '12 weeks',
    training_mode: 'online',
    status: 'published',
    is_published: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    pricing: {
      id: 'p0000001-0000-4000-8000-000000000001',
      course_id: 'c0000001-0000-4000-8000-000000000001',
      ngn_price: 250000,
      usd_price: 500,
      eur_price: 450,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }
  },
  {
    id: 'c0000001-0000-4000-8000-000000000002',
    title: 'Data Science & Machine Learning',
    slug: 'data-science-machine-learning',
    short_description: 'Analyze data, build predictive models with Python, Pandas, Scikit-Learn, and SQL.',
    description: 'Learn modern data science from top practitioners. Covers exploratory data analysis, statistical methods, machine learning models, and real-world business forecasting.',
    category_id: 'd0000001-0000-4000-8000-000000000002',
    category: 'Data Science',
    duration: '10 weeks',
    training_mode: 'hybrid',
    status: 'published',
    is_published: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    pricing: {
      id: 'p0000001-0000-4000-8000-000000000002',
      course_id: 'c0000001-0000-4000-8000-000000000002',
      ngn_price: 220000,
      usd_price: 450,
      eur_price: 400,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }
  },
  {
    id: 'c0000001-0000-4000-8000-000000000003',
    title: 'UI/UX Product Design Masterclass',
    slug: 'ui-ux-product-design-masterclass',
    short_description: 'Create human-centered products, design systems, and clickable prototypes in Figma.',
    description: 'Master user research, wireframing, high-fidelity UI design, prototyping, and design systems for mobile and web apps using Figma.',
    category_id: 'd0000001-0000-4000-8000-000000000003',
    category: 'Design',
    duration: '8 weeks',
    training_mode: 'online',
    status: 'published',
    is_published: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    pricing: {
      id: 'p0000001-0000-4000-8000-000000000003',
      course_id: 'c0000001-0000-4000-8000-000000000003',
      ngn_price: 180000,
      usd_price: 350,
      eur_price: 320,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }
  },
  {
    id: 'c0000001-0000-4000-8000-000000000004',
    title: 'Digital Marketing & Growth Mastery',
    slug: 'digital-marketing-growth-mastery',
    short_description: 'Scale brands with performance advertising, search engine optimization, and conversion funnels.',
    description: 'Learn growth marketing, Google Ads, Meta Ads, SEO optimization, and data-driven conversion strategies to drive measurable customer acquisition.',
    category_id: 'd0000001-0000-4000-8000-000000000004',
    category: 'Marketing',
    duration: '6 weeks',
    training_mode: 'online',
    status: 'published',
    is_published: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    pricing: {
      id: 'p0000001-0000-4000-8000-000000000004',
      course_id: 'c0000001-0000-4000-8000-000000000004',
      ngn_price: 150000,
      usd_price: 300,
      eur_price: 270,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z'
    }
  }
];

export const DEFAULT_SCHEDULES: CourseSchedule[] = [
  {
    id: 's0000001-0000-4000-8000-000000000001',
    course_id: 'c0000001-0000-4000-8000-000000000001',
    label: 'Weekend Intensive',
    day_of_week: 'Saturday & Sunday',
    start_time: '10:00 AM',
    end_time: '01:00 PM',
    timezone: 'WAT',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 's0000001-0000-4000-8000-000000000002',
    course_id: 'c0000001-0000-4000-8000-000000000001',
    label: 'Weekday Evening',
    day_of_week: 'Tuesday & Thursday',
    start_time: '06:00 PM',
    end_time: '08:30 PM',
    timezone: 'WAT',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 's0000001-0000-4000-8000-000000000003',
    course_id: 'c0000001-0000-4000-8000-000000000002',
    label: 'Saturday Morning Cohort',
    day_of_week: 'Saturday',
    start_time: '09:00 AM',
    end_time: '01:00 PM',
    timezone: 'WAT',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 's0000001-0000-4000-8000-000000000004',
    course_id: 'c0000001-0000-4000-8000-000000000003',
    label: 'Weekend Masterclass',
    day_of_week: 'Saturday',
    start_time: '11:00 AM',
    end_time: '02:00 PM',
    timezone: 'WAT',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 's0000001-0000-4000-8000-000000000005',
    course_id: 'c0000001-0000-4000-8000-000000000004',
    label: 'Evening Cohort',
    day_of_week: 'Wednesday & Friday',
    start_time: '06:30 PM',
    end_time: '08:30 PM',
    timezone: 'WAT',
    is_active: true,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z'
  }
];

// ====================================================================
// Core Data Service
// ====================================================================

export const dataService = {
  isCloudMode(): boolean {
    return isSupabaseConfigured;
  },

  // 1. AUTHENTICATION SERVICES
  auth: {
    async signUp(
      email: string, 
      password: string, 
      fullName: string, 
      phone?: string, 
      country?: string,
      timezone: string = 'Africa/Lagos'
    ): Promise<{ user: Profile | null; error: string | null }> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                phone: phone || '',
                country: country || '',
                timezone: timezone
              }
            }
          });

          if (error) return { user: null, error: error.message };
          if (!data.user) return { user: null, error: 'Registration failed' };

          // Fetch or prepare profile (triggers can sometimes take a microsecond)
          // We wait briefly and then try to fetch the profile
          await new Promise(resolve => setTimeout(resolve, 800));
          let { data: profile, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            // Determine if email should be admin based on core admin configurations
            const isAdminEmail = [
              'emmanuelnwaije21@gmail.com',
              'ingeniumvirtualassistant@zohomail.com'
            ].includes(email.toLowerCase());

            // Fallback: Create and insert profile row directly from client
            const tempProfile: Profile = {
              id: data.user.id,
              full_name: fullName,
              email: email.toLowerCase(),
              phone: phone || '',
              country: country || '',
              timezone: timezone,
              role: isAdminEmail ? 'admin' : 'student',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: upsertedProfile, error: upsertError } = await supabase
              .from('profiles')
              .upsert(tempProfile)
              .select()
              .maybeSingle();

            if (!upsertError && upsertedProfile) {
              profile = upsertedProfile;
            } else {
              // Return the temp profile to allow UI session continuation without breaking
              return { user: tempProfile, error: null };
            }
          }

          return { user: profile as Profile, error: null };
        } catch (e: any) {
          return { user: null, error: e.message || 'An unexpected error occurred' };
        }
      } else {
        // Fallback local registration
        const profiles = getLocalData<Profile>('profiles');
        const emailExists = profiles.some(p => p.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
          return { user: null, error: 'User already exists with this email' };
        }

        // Determine if email should be admin based on prompt requirements
        const isAdminEmail = [
          'emmanuelnwaije21@gmail.com',
          'ingeniumvirtualassistant@zohomail.com'
        ].includes(email.toLowerCase());

        const newProfile: Profile = {
          id: generateValidUUID(),
          full_name: fullName,
          email: email.toLowerCase(),
          phone: phone || '',
          country: country || '',
          timezone: timezone,
          role: isAdminEmail ? 'admin' : 'student',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        profiles.push(newProfile);
        setLocalData('profiles', profiles);
        setLocalSession(newProfile);

        return { user: newProfile, error: null };
      }
    },

    async signIn(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) return { user: null, error: error.message };
          if (!data.user) return { user: null, error: 'Sign in failed' };

          let { data: profile, error: pError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (!profile) {
            // Self-healing: If user exists in Auth but profiles record is missing,
            // create it now.
            const metadata = data.user.user_metadata || {};
            const isAdminEmail = [
              'emmanuelnwaije21@gmail.com',
              'ingeniumvirtualassistant@zohomail.com'
            ].includes(email.toLowerCase());

            const tempProfile: Profile = {
              id: data.user.id,
              full_name: metadata.full_name || metadata.name || 'Student',
              email: email.toLowerCase(),
              phone: metadata.phone || '',
              country: metadata.country || '',
              timezone: metadata.timezone || 'Africa/Lagos',
              role: isAdminEmail ? 'admin' : 'student',
              created_at: data.user.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { data: upsertedProfile } = await supabase
              .from('profiles')
              .upsert(tempProfile)
              .select()
              .maybeSingle();

            if (upsertedProfile) {
              profile = upsertedProfile;
            } else {
              return { user: tempProfile, error: null };
            }
          }

          return { user: profile as Profile, error: null };
        } catch (e: any) {
          return { user: null, error: e.message || 'An unexpected error occurred' };
        }
      } else {
        // Fallback local sign in
        const profiles = getLocalData<Profile>('profiles');
        const found = profiles.find(p => p.email.toLowerCase() === email.toLowerCase());
        if (!found) {
          return { user: null, error: 'Invalid email or password' };
        }
        
        // Simulating matching password (allow any password in offline mode for convenience)
        setLocalSession(found);
        return { user: found, error: null };
      }
    },

    async signOut(): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        setLocalSession(null);
      }
    },

    async forgotPassword(email: string): Promise<{ success: boolean; error: string | null }> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        return { success: !error, error: error ? error.message : null };
      } else {
        // Local simulation
        const profiles = getLocalData<Profile>('profiles');
        const found = profiles.some(p => p.email.toLowerCase() === email.toLowerCase());
        if (!found) {
          return { success: false, error: 'No account registered with this email' };
        }
        return { success: true, error: null };
      }
    },

    async getCurrentUser(): Promise<Profile | null> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;

          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          return profile as Profile | null;
        } catch {
          return null;
        }
      } else {
        return getLocalSession();
      }
    }
  },

  // 2. PROFILE SERVICES
  profile: {
    async updateProfile(id: string, updates: Partial<Profile>): Promise<{ profile: Profile | null; error: string | null }> {
      if (isSupabaseConfigured && supabase) {
        try {
          // Exclude role to satisfy RLS policies for students
          const { role, id: _, created_at, email, ...safeUpdates } = updates as any;
          const { data, error } = await supabase
            .from('profiles')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

          if (error) return { profile: null, error: error.message };
          return { profile: data as Profile, error: null };
        } catch (e: any) {
          return { profile: null, error: e.message };
        }
      } else {
        const profiles = getLocalData<Profile>('profiles');
        const index = profiles.findIndex(p => p.id === id);
        if (index === -1) return { profile: null, error: 'Profile not found' };

        // Prevent standard update from modifying role offline unless specified explicitly
        const currentRole = profiles[index].role;
        const updatedProfile = {
          ...profiles[index],
          ...updates,
          id, // ensure ID doesn't change
          email: profiles[index].email, // email is read-only
          role: updates.role || currentRole, // support role updates if specifically passed by admin tools
          updated_at: new Date().toISOString()
        };

        profiles[index] = updatedProfile;
        setLocalData('profiles', profiles);

        // If updating the currently logged-in user, refresh their session
        const currentSession = getLocalSession();
        if (currentSession && currentSession.id === id) {
          setLocalSession(updatedProfile);
        }

        return { profile: updatedProfile, error: null };
      }
    },

    async getStudents(): Promise<Profile[]> {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .order('created_at', { ascending: false });
        return (data as Profile[]) || [];
      } else {
        return getLocalData<Profile>('profiles').filter(p => p.role === 'student');
      }
    },

    async getInstructors(): Promise<Profile[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['admin', 'instructor'])
            .order('created_at', { ascending: false });
          return (data as Profile[]) || [];
        } catch {
          return [];
        }
      } else {
        return getLocalData<Profile>('profiles').filter(p => p.role === 'admin' || (p.role as string) === 'instructor');
      }
    },

    // Dev/Testing helper to assign Admin roles
    async toggleDevRole(id: string, role: UserRole): Promise<Profile | null> {
      if (isSupabaseConfigured && supabase) {
        // In Cloud mode, developers must use the SQL script (as per prompt instructions)
        // However, we can warn or update it if RPC/Admin Client exists. 
        // We will execute a standard query, but RLS will protect it.
        const { data } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', id)
          .select()
          .single();
        return data as Profile | null;
      } else {
        // Offline role assignment
        const profiles = getLocalData<Profile>('profiles');
        const index = profiles.findIndex(p => p.id === id);
        if (index !== -1) {
          profiles[index].role = role;
          setLocalData('profiles', profiles);
          
          const currentSession = getLocalSession();
          if (currentSession && currentSession.id === id) {
            profiles[index].role = role;
            setLocalSession(profiles[index]);
          }
          return profiles[index];
        }
        return null;
      }
    }
  },

  // 3. COURSE CATEGORIES SERVICES
  categories: {
    async getCategories(): Promise<CourseCategory[]> {
      let result: CourseCategory[] = [];
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('course_categories')
            .select('*')
            .order('name', { ascending: true });
          result = (data as CourseCategory[]) || [];
        } catch {
          result = [];
        }
      } else {
        result = getLocalData<CourseCategory>('categories');
      }

      // Merge with DEFAULT_CATEGORIES so standard categories (Data Science, Design, Marketing, Development) are ALWAYS present
      if (!result || result.length === 0) {
        result = [...DEFAULT_CATEGORIES];
        if (!isSupabaseConfigured) {
          setLocalData('categories', DEFAULT_CATEGORIES);
        }
      } else {
        const existingNames = new Set(result.map(c => c.name.toLowerCase().trim()));
        const missing = DEFAULT_CATEGORIES.filter(d => !existingNames.has(d.name.toLowerCase().trim()));
        if (missing.length > 0) {
          result = [...result, ...missing];
          if (!isSupabaseConfigured) {
            setLocalData('categories', result);
          }
        }
      }

      return result;
    },

    async createCategory(category: Omit<CourseCategory, 'id' | 'created_at' | 'updated_at'>): Promise<CourseCategory> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('course_categories')
          .insert([category])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CourseCategory;
      } else {
        const categories = getLocalData<CourseCategory>('categories');
        const newCategory: CourseCategory = {
          ...category,
          id: generateValidUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        categories.push(newCategory);
        setLocalData('categories', categories);
        return newCategory;
      }
    },

    async updateCategory(id: string, updates: Partial<CourseCategory>): Promise<CourseCategory> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('course_categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CourseCategory;
      } else {
        const categories = getLocalData<CourseCategory>('categories');
        const index = categories.findIndex(c => c.id === id);
        if (index === -1) throw new Error('Category not found');
        const updated = {
          ...categories[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        categories[index] = updated;
        setLocalData('categories', categories);
        return updated;
      }
    },

    async uploadCategoryImage(categoryId: string, file: File): Promise<string> {
      if (isSupabaseConfigured && supabase) {
        const filePath = `categories/${categoryId}/hero`;
        const { error } = await supabase.storage
          .from('course-images')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type
          });
        
        if (error) throw new Error(error.message);
        
        const { data: { publicUrl } } = supabase.storage
          .from('course-images')
          .getPublicUrl(filePath);
          
        return publicUrl;
      } else {
        return URL.createObjectURL(file);
      }
    }
  },

  // 4. COURSE PRICING SERVICES
  pricing: {
    async getPricingForCourse(courseId: string): Promise<CoursePricing | null> {
      const normalizedCourseId = normalizeToUUID(courseId) || courseId;
      if (isSupabaseConfigured && supabase && isValidUUID(normalizedCourseId)) {
        try {
          const { data } = await supabase
            .from('course_pricing')
            .select('*')
            .eq('course_id', normalizedCourseId)
            .maybeSingle();
          if (data) return data as CoursePricing;
        } catch {
          // fall through to local/default lookup
        }
      }
      const pricings = getLocalData<CoursePricing>('course_pricing');
      const foundLocal = pricings.find(p => p.course_id === normalizedCourseId || p.course_id === courseId);
      if (foundLocal) return foundLocal;

      return null;
    },

    async updatePricing(pricing: Omit<CoursePricing, 'id' | 'created_at' | 'updated_at'> | Partial<CoursePricing> & { course_id: string }): Promise<CoursePricing> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('course_pricing')
          .upsert([pricing], { onConflict: 'course_id' })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CoursePricing;
      } else {
        const pricings = getLocalData<CoursePricing>('course_pricing');
        const index = pricings.findIndex(p => p.course_id === pricing.course_id);
        const now = new Date().toISOString();
        if (index === -1) {
          const newPricing: CoursePricing = {
            ...pricing,
            id: generateValidUUID(),
            created_at: now,
            updated_at: now
          } as CoursePricing;
          pricings.push(newPricing);
          setLocalData('course_pricing', pricings);
          return newPricing;
        } else {
          const updated = {
            ...pricings[index],
            ...pricing,
            updated_at: now
          } as CoursePricing;
          pricings[index] = updated;
          setLocalData('course_pricing', pricings);
          return updated;
        }
      }
    }
  },

  // 5. COURSE SERVICES
  courses: {
    async getCourses(): Promise<Course[]> {
      if (isSupabaseConfigured && supabase) {
        try {
          // 1. Fetch courses table directly (independent of PostgREST relational foreign key schema cache)
          let coursesData: any[] = [];
          try {
            const { data, error } = await supabase
              .from('courses')
              .select('*')
              .order('title', { ascending: true });
            if (!error && data && data.length > 0) {
              coursesData = data;
            }
          } catch {
            coursesData = [];
          }

          // If no courses found in database, return empty array (real database state)
          if (coursesData.length === 0) {
            return [];
          }

          // 2. Fetch pricing table safely in parallel (without schema cache join dependency)
          let pricingData: CoursePricing[] = [];
          try {
            const { data: pData } = await supabase
              .from('course_pricing')
              .select('*');
            if (pData && Array.isArray(pData)) {
              pricingData = pData as CoursePricing[];
            }
          } catch {
            pricingData = [];
          }

          // 3. Fetch categories mapping safely
          let categories: CourseCategory[] = [];
          try {
            categories = await dataService.categories.getCategories();
          } catch {
            categories = [];
          }
          const catMap = new Map<string, string>();
          for (const cat of categories) {
            if (cat.id && cat.name) catMap.set(cat.id, cat.name);
          }

          const localPricings = getLocalData<CoursePricing>('course_pricing');

          // 4. Combine courses with categories and pricing in memory
          return coursesData.map(c => {
            const normCourseId = normalizeToUUID(c.id) || c.id;
            const categoryName = (c.category_id && catMap.get(c.category_id)) 
              || c.category 
              || 'Uncategorized';

            const foundPricing = pricingData.find(p => p.course_id === c.id || p.course_id === normCourseId)
              || localPricings.find(p => p.course_id === c.id || p.course_id === normCourseId);

            return {
              ...c,
              category: categoryName,
              pricing: foundPricing
            };
          }) as Course[];
        } catch {
          return [];
        }
      } else {
        let courses = getLocalData<Course>('courses');
        let pricings = getLocalData<CoursePricing>('course_pricing');
        const categories = await dataService.categories.getCategories();

        // Migrate any cached legacy non-UUID IDs in local storage
        if (courses.length > 0) {
          let coursesMigrated = false;
          courses = courses.map(c => {
            const normId = normalizeToUUID(c.id) || c.id;
            const normCatId = normalizeToUUID(c.category_id) || c.category_id;
            if (normId !== c.id || normCatId !== c.category_id) {
              coursesMigrated = true;
              return { ...c, id: normId, category_id: normCatId };
            }
            return c;
          });
          if (coursesMigrated) {
            setLocalData('courses', courses);
          }
        }

        return courses.map(c => {
          const pricing = pricings.find(p => p.course_id === c.id) || c.pricing;
          const categoryObj = categories.find(cat => cat.id === c.category_id || cat.name.toLowerCase().trim() === (c.category || '').toLowerCase().trim());
          return {
            ...c,
            category: categoryObj?.name || c.category || 'Uncategorized',
            category_id: c.category_id || categoryObj?.id,
            pricing: pricing || undefined
          };
        });
      }
    },

    async getCourseSchedules(courseId?: string, activeOnly: boolean = false): Promise<CourseSchedule[]> {
      let list: CourseSchedule[] = [];
      const normalizedCourseId = courseId ? (normalizeToUUID(courseId) || courseId) : undefined;

      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase
            .from('course_schedules')
            .select('*');
          if (normalizedCourseId && isValidUUID(normalizedCourseId)) {
            query = query.eq('course_id', normalizedCourseId);
          }
          if (activeOnly) {
            query = query.eq('is_active', true);
          }
          const { data } = await query.order('created_at', { ascending: false });
          list = (data as CourseSchedule[]) || [];
        } catch {
          list = [];
        }
      } else {
        const all = getLocalData<CourseSchedule>('schedules');
        const filtered = normalizedCourseId ? all.filter(s => s.course_id === courseId || s.course_id === normalizedCourseId) : all;
        list = activeOnly ? filtered.filter(s => s.is_active) : filtered;
      }

      return list;
    },

    async createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<Course> {
      if (isSupabaseConfigured && supabase) {
        // Strip out non-column joined attributes if present
        const { pricing, ...cleanCourse } = course as any;
        let { data, error } = await supabase
          .from('courses')
          .insert([cleanCourse])
          .select()
          .single();

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('category_id') || errMsg.includes('category') || errMsg.includes('schema cache') || errMsg.includes('column')) {
            console.warn('Courses table schema missing category column, retrying with core columns:', error.message);
            const { category_id, category, ...baseCourse } = cleanCourse;
            const fallbackRes = await supabase
              .from('courses')
              .insert([baseCourse])
              .select()
              .single();
            data = fallbackRes.data;
            error = fallbackRes.error;
          }
        }

        if (error) throw new Error(error.message);
        return data as Course;
      } else {
        const courses = getLocalData<Course>('courses');
        const newCourse: Course = {
          ...course,
          id: generateValidUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        courses.push(newCourse);
        setLocalData('courses', courses);
        return newCourse;
      }
    },

    async updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
      if (isSupabaseConfigured && supabase) {
        const { pricing, ...cleanUpdates } = updates as any;
        let { data, error } = await supabase
          .from('courses')
          .update(cleanUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (errMsg.includes('category_id') || errMsg.includes('category') || errMsg.includes('schema cache') || errMsg.includes('column')) {
            console.warn('Courses table schema missing category column on update, retrying with core columns:', error.message);
            const { category_id, category, ...baseUpdates } = cleanUpdates;
            const fallbackRes = await supabase
              .from('courses')
              .update(baseUpdates)
              .eq('id', id)
              .select()
              .single();
            data = fallbackRes.data;
            error = fallbackRes.error;
          }
        }

        if (error) throw new Error(error.message);
        return data as Course;
      } else {
        const courses = getLocalData<Course>('courses');
        const index = courses.findIndex(c => c.id === id);
        if (index === -1) throw new Error('Course not found');
        const updated = {
          ...courses[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        courses[index] = updated;
        setLocalData('courses', courses);
        return updated;
      }
    },

    async deleteCourse(id: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('courses')
          .delete()
          .eq('id', id);
        if (error) throw new Error(error.message);
      } else {
        const courses = getLocalData<Course>('courses');
        const filtered = courses.filter(c => c.id !== id);
        setLocalData('courses', filtered);
      }
    },

    async uploadHeroImage(courseId: string, file: File): Promise<string> {
      if (isSupabaseConfigured && supabase) {
        const filePath = `${courseId}/hero`;
        const { error } = await supabase.storage
          .from('course-images')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type
          });
        
        if (error) throw new Error(error.message);
        
        const { data: { publicUrl } } = supabase.storage
          .from('course-images')
          .getPublicUrl(filePath);
          
        return publicUrl;
      } else {
        return URL.createObjectURL(file);
      }
    },

    async removeHeroImage(courseId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const filePath = `${courseId}/hero`;
        const { error } = await supabase.storage
          .from('course-images')
          .remove([filePath]);
        if (error) {
          console.warn('Error removing from storage:', error.message);
        }
      }
    },

    async createCourseSchedule(schedule: Omit<CourseSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<CourseSchedule> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('course_schedules')
          .insert([schedule])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CourseSchedule;
      } else {
        const schedules = getLocalData<CourseSchedule>('schedules');
        const newSchedule: CourseSchedule = {
          ...schedule,
          id: generateValidUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        schedules.push(newSchedule);
        setLocalData('schedules', schedules);
        return newSchedule;
      }
    },

    async updateCourseSchedule(id: string, updates: Partial<CourseSchedule>): Promise<CourseSchedule> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('course_schedules')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CourseSchedule;
      } else {
        const schedules = getLocalData<CourseSchedule>('schedules');
        const index = schedules.findIndex(s => s.id === id);
        if (index === -1) throw new Error('Schedule not found');
        const updated = {
          ...schedules[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        schedules[index] = updated;
        setLocalData('schedules', schedules);
        return updated;
      }
    },

    async deleteCourseSchedule(id: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('course_schedules')
          .delete()
          .eq('id', id);
        if (error) throw new Error(error.message);
      } else {
        const schedules = getLocalData<CourseSchedule>('schedules');
        const filtered = schedules.filter(s => s.id !== id);
        setLocalData('schedules', filtered);
      }
    }
  },

  // 6. COURSE SELECTIONS
  selections: {
    async createCourseSelection(
      studentId: string, 
      courseId: string, 
      scheduleId?: string,
      priceSnapshot?: number,
      currencySnapshot?: string,
      studentCountry?: string
    ): Promise<CourseSelection> {
      const targetCourseId = normalizeToUUID(courseId) || courseId;
      const targetScheduleId = scheduleId ? (normalizeToUUID(scheduleId) || scheduleId) : undefined;

      const totalRequests = isSupabaseConfigured && supabase
        ? 0 
        : getLocalData<CourseSelection>('selections').length;
      
      const countStr = String(totalRequests + 1).padStart(6, '0');
      let referenceId = `ITA-2026-${countStr}`;

      const isCourseUUID = isValidUUID(targetCourseId);
      const isScheduleUUID = !targetScheduleId || isValidUUID(targetScheduleId);

      if (isSupabaseConfigured && supabase && isCourseUUID) {
        let dbRefId = referenceId;
        try {
          const { count } = await supabase
            .from('course_selections')
            .select('*', { count: 'exact', head: true });
          
          const dbCountStr = String((count || 0) + 1).padStart(6, '0');
          dbRefId = `ITA-2026-${dbCountStr}`;
          referenceId = dbRefId;
        } catch {
          // Keep referenceId
        }

        // 1. Try full insert with price/currency snapshot columns
        const fullPayload: Record<string, any> = {
          student_id: studentId,
          course_id: targetCourseId,
          reference_id: dbRefId,
          status: 'pending',
          payment_method: 'whatsapp_manual'
        };
        if (targetScheduleId && isScheduleUUID) fullPayload.schedule_id = targetScheduleId;
        if (priceSnapshot !== undefined) fullPayload.price_snapshot = priceSnapshot;
        if (currencySnapshot !== undefined) fullPayload.currency_snapshot = currencySnapshot;
        if (studentCountry !== undefined) fullPayload.student_country = studentCountry;

        let { data, error } = await supabase
          .from('course_selections')
          .insert([fullPayload])
          .select()
          .single();

        // 2. If Supabase rejects due to missing columns in schema cache, fallback to core columns
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (
            errMsg.includes('currency_snapshot') ||
            errMsg.includes('price_snapshot') ||
            errMsg.includes('student_country') ||
            errMsg.includes('schema cache') ||
            errMsg.includes('column')
          ) {
            console.warn('Supabase course_selections missing snapshot columns in schema cache. Gracefully retrying with core columns:', error.message);
            const basePayload: Record<string, any> = {
              student_id: studentId,
              course_id: targetCourseId,
              reference_id: dbRefId,
              status: 'pending',
              payment_method: 'whatsapp_manual'
            };
            if (targetScheduleId && isScheduleUUID) basePayload.schedule_id = targetScheduleId;

            const fallbackRes = await supabase
              .from('course_selections')
              .insert([basePayload])
              .select()
              .single();

            data = fallbackRes.data;
            error = fallbackRes.error;
          }
        }

        // If duplicate selection in Supabase
        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (error.code === '23505' || errMsg.includes('unique') || errMsg.includes('already exists')) {
            throw new Error('You have already added this course to your selections.');
          }

          // If foreign key constraint or UUID type error occurs (e.g. course hasn't been seeded into Supabase public.courses table yet)
          if (
            error.code === '23503' || 
            error.code === '22P02' || 
            errMsg.includes('foreign key') || 
            errMsg.includes('violates foreign key') || 
            errMsg.includes('invalid input syntax for type uuid')
          ) {
            console.warn('Course or schedule reference not found in Supabase database. Falling back to local persistence:', error.message);
            // Fall through to local persistence so user is NOT blocked
          } else {
            throw new Error(error.message);
          }
        }

        if (data) {
          const created = data as CourseSelection;

          // Persist metadata snapshot locally so client UI and payment processing retain snapshot details
          const metaPayload = {
            price_snapshot: priceSnapshot,
            currency_snapshot: currencySnapshot,
            student_country: studentCountry
          };
          if (created?.id) saveSelectionMeta(created.id, metaPayload);
          if (dbRefId) saveSelectionMeta(dbRefId, metaPayload);

          return {
            ...created,
            price_snapshot: created?.price_snapshot ?? priceSnapshot,
            currency_snapshot: created?.currency_snapshot ?? currencySnapshot,
            student_country: created?.student_country ?? studentCountry
          };
        }
      }

      // Local storage persistence (used for local mode, offline, or fallback when course is not yet seeded in Supabase)
      const selections = getLocalData<CourseSelection>('selections');
      const exists = selections.some(s => 
        s.student_id === studentId && 
        (s.course_id === targetCourseId || s.course_id === courseId)
      );
      if (exists) {
        throw new Error('You have already added this course to your selections.');
      }

      const generatedId = generateValidUUID();
      const newSelection: CourseSelection = {
        id: generatedId,
        student_id: studentId,
        course_id: targetCourseId,
        schedule_id: targetScheduleId,
        reference_id: referenceId,
        status: 'pending',
        payment_method: 'whatsapp_manual',
        price_snapshot: priceSnapshot,
        currency_snapshot: currencySnapshot,
        student_country: studentCountry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      selections.push(newSelection);
      setLocalData('selections', selections);

      const metaPayload = {
        price_snapshot: priceSnapshot,
        currency_snapshot: currencySnapshot,
        student_country: studentCountry
      };
      saveSelectionMeta(newSelection.id, metaPayload);
      saveSelectionMeta(referenceId, metaPayload);

      return newSelection;
    },

    async getCourseSelections(studentId?: string): Promise<CourseSelection[]> {
      let dbList: CourseSelection[] = [];
      const metaMap = getSelectionMetaMap();

      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase
            .from('course_selections')
            .select(`
              *,
              course:courses(title),
              student:profiles(email, full_name),
              schedule:course_schedules(label)
            `);
          
          if (studentId) {
            query = query.eq('student_id', studentId);
          }

          let { data, error } = await query.order('created_at', { ascending: false });
          if (error) {
            let baseQuery = supabase.from('course_selections').select('*');
            if (studentId) {
              baseQuery = baseQuery.eq('student_id', studentId);
            }
            const fallbackRes = await baseQuery.order('created_at', { ascending: false });
            data = fallbackRes.data;
          }

          if (data) {
            dbList = (data as any[]).map(s => {
              const meta = metaMap[s.id] || metaMap[s.reference_id] || {};
              return {
                ...s,
                price_snapshot: s.price_snapshot ?? meta.price_snapshot,
                currency_snapshot: s.currency_snapshot ?? meta.currency_snapshot ?? 'USD',
                student_country: s.student_country ?? meta.student_country,
                course_title: s.course?.title,
                student_email: s.student?.email,
                student_name: s.student?.full_name,
                schedule_label: s.schedule?.label
              };
            });
          }
        } catch {
          // Gracefully handled
        }
      }

      // Merge local selections (for offline or local-fallback items)
      const localSelections = getLocalData<CourseSelection>('selections');
      const courses = getLocalData<Course>('courses');
      const profiles = getLocalData<Profile>('profiles');
      const schedules = getLocalData<CourseSchedule>('schedules');

      const filteredLocal = studentId ? localSelections.filter(s => s.student_id === studentId) : localSelections;
      const existingRefs = new Set(dbList.map(s => s.reference_id));
      const existingIds = new Set(dbList.map(s => s.id));
      const existingCourseKeys = new Set(dbList.map(s => `${s.student_id}_${s.course_id}`));

      for (const local of filteredLocal) {
        const normCourseId = normalizeToUUID(local.course_id) || local.course_id;
        const key1 = `${local.student_id}_${local.course_id}`;
        const key2 = `${local.student_id}_${normCourseId}`;

        if (!existingIds.has(local.id) && !existingRefs.has(local.reference_id) && !existingCourseKeys.has(key1) && !existingCourseKeys.has(key2)) {
          const course = courses.find(c => c.id === local.course_id || c.id === normCourseId);
          const student = profiles.find(p => p.id === local.student_id);
          const schedule = schedules.find(sc => sc.id === local.schedule_id);

          const meta = metaMap[local.id] || metaMap[local.reference_id] || {};
          dbList.push({
            ...local,
            price_snapshot: local.price_snapshot ?? meta.price_snapshot,
            currency_snapshot: local.currency_snapshot ?? meta.currency_snapshot ?? 'USD',
            student_country: local.student_country ?? meta.student_country,
            course_title: course?.title || 'Course',
            student_email: student?.email || 'Student',
            student_name: student?.full_name || 'Student',
            schedule_label: schedule?.label || 'Scheduled'
          });
        }
      }

      return dbList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    async updateSelectionStatus(selectionId: string, status: SelectionStatus, adminId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('course_selections')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', selectionId);
        
        if (error) throw new Error(error.message);

        if (status === 'approved') {
          const { data: selection } = await supabase
            .from('course_selections')
            .select('*')
            .eq('id', selectionId)
            .single();

          if (selection) {
            const metaMap = getSelectionMetaMap();
            const meta = metaMap[selection.id] || metaMap[selection.reference_id] || {};
            const resolvedPrice = selection.price_snapshot ?? meta.price_snapshot ?? 0;
            const resolvedCurrency = selection.currency_snapshot ?? meta.currency_snapshot ?? 'USD';

            await supabase
              .from('enrollments')
              .insert([{
                student_id: selection.student_id,
                course_id: selection.course_id,
                schedule_id: selection.schedule_id,
                status: 'active',
                access_granted: true,
                access_type: 'paid',
                approved_by: adminId,
                approved_at: new Date().toISOString()
              }])
              .select();
            
            await supabase
              .from('payments')
              .insert([{
                student_id: selection.student_id,
                reference_id: selection.reference_id,
                amount: resolvedPrice,
                currency: resolvedCurrency,
                status: 'confirmed',
                payment_method: 'whatsapp_manual',
                notes: 'Approved via Course Requests dashboard',
                confirmed_by: adminId,
                confirmed_at: new Date().toISOString()
              }]);
          }
        }
      } else {
        const selections = getLocalData<CourseSelection>('selections');
        const index = selections.findIndex(s => s.id === selectionId);
        if (index === -1) throw new Error('Selection request not found.');

        selections[index].status = status;
        selections[index].updated_at = new Date().toISOString();
        setLocalData('selections', selections);

        if (status === 'approved') {
          const selection = selections[index];
          
          const enrollments = getLocalData<Enrollment>('enrollments');
          const exists = enrollments.some(e => e.student_id === selection.student_id && e.course_id === selection.course_id);
          if (!exists) {
            enrollments.push({
              id: generateValidUUID(),
              student_id: selection.student_id,
              course_id: selection.course_id,
              schedule_id: selection.schedule_id,
              status: 'active',
              access_granted: true,
              access_type: 'paid',
              approved_by: adminId,
              approved_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            setLocalData('enrollments', enrollments);
          }

          const payments = getLocalData<Payment>('payments');
          payments.push({
            id: generateValidUUID(),
            student_id: selection.student_id,
            reference_id: selection.reference_id,
            amount: selection.price_snapshot || 0,
            currency: selection.currency_snapshot || 'USD',
            status: 'confirmed',
            payment_method: 'whatsapp_manual',
            notes: 'Approved via Course Requests dashboard',
            confirmed_by: adminId,
            confirmed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          setLocalData('payments', payments);
        }
      }
    },

    async deleteCourseSelection(selectionId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('course_selections')
          .delete()
          .eq('id', selectionId);
        if (error) throw new Error(error.message);
      } else {
        const selections = getLocalData<CourseSelection>('selections');
        const filtered = selections.filter(s => s.id !== selectionId);
        setLocalData('selections', filtered);
      }
    }
  },

  // 5. ENROLLMENTS
  enrollments: {
    async getEnrollments(studentId?: string): Promise<Enrollment[]> {
      let dbList: Enrollment[] = [];

      if (isSupabaseConfigured && supabase) {
        try {
          let query = supabase
            .from('enrollments')
            .select(`
              *,
              course:courses(title, image_url),
              schedule:course_schedules(label)
            `);
          
          if (studentId) {
            query = query.eq('student_id', studentId);
          }

          let { data, error } = await query.order('created_at', { ascending: false });
          if (error) {
            let baseQuery = supabase.from('enrollments').select('*');
            if (studentId) {
              baseQuery = baseQuery.eq('student_id', studentId);
            }
            const fallbackRes = await baseQuery.order('created_at', { ascending: false });
            data = fallbackRes.data;
          }

          if (data) {
            dbList = (data as any[]).map(e => ({
              ...e,
              course_title: e.course?.title,
              course_image: e.course?.image_url,
              schedule_label: e.schedule?.label
            }));
          }
        } catch {
          // Gracefully handled
        }
      }

      // Merge local enrollments (for offline or local fallback)
      const enrollments = getLocalData<Enrollment>('enrollments');
      const courses = getLocalData<Course>('courses');
      const schedules = getLocalData<CourseSchedule>('schedules');

      const filtered = studentId ? enrollments.filter(e => e.student_id === studentId) : enrollments;
      const existingIds = new Set(dbList.map(e => e.id));
      const existingCourseKeys = new Set(dbList.map(e => `${e.student_id}_${e.course_id}`));

      for (const e of filtered) {
        const normCourseId = normalizeToUUID(e.course_id) || e.course_id;
        const key1 = `${e.student_id}_${e.course_id}`;
        const key2 = `${e.student_id}_${normCourseId}`;

        if (!existingIds.has(e.id) && !existingCourseKeys.has(key1) && !existingCourseKeys.has(key2)) {
          const course = courses.find(c => c.id === e.course_id || c.id === normCourseId);
          const schedule = schedules.find(sc => sc.id === e.schedule_id);

          dbList.push({
            ...e,
            course_title: course?.title || 'Enrolled Course',
            course_image: course?.image_url,
            schedule_label: schedule?.label || 'Not Scheduled'
          });
        }
      }

      return dbList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    async createManualEnrollment(
      studentId: string, 
      courseId: string, 
      scheduleId: string | undefined, 
      adminId: string
    ): Promise<Enrollment> {
      const normCourseId = normalizeToUUID(courseId) || courseId;
      const normScheduleId = scheduleId ? (normalizeToUUID(scheduleId) || scheduleId) : undefined;

      const isCourseUUID = isValidUUID(normCourseId);
      const isScheduleUUID = !normScheduleId || isValidUUID(normScheduleId);

      if (isSupabaseConfigured && supabase && isCourseUUID) {
        const payload: Record<string, any> = {
          student_id: studentId,
          course_id: normCourseId,
          status: 'active',
          access_granted: true,
          access_type: 'manual',
          approved_by: adminId,
          approved_at: new Date().toISOString()
        };
        if (normScheduleId && isScheduleUUID) {
          payload.schedule_id = normScheduleId;
        }

        const { data, error } = await supabase
          .from('enrollments')
          .insert([payload])
          .select()
          .single();

        if (error) {
          const errMsg = (error.message || '').toLowerCase();
          if (
            error.code === '23503' || 
            error.code === '22P02' || 
            errMsg.includes('foreign key') || 
            errMsg.includes('invalid input syntax for type uuid')
          ) {
            console.warn('Supabase enrollments foreign key missing, saving locally:', error.message);
          } else {
            throw new Error(error.message);
          }
        } else if (data) {
          return data as Enrollment;
        }
      }

      const enrollments = getLocalData<Enrollment>('enrollments');
      const exists = enrollments.some(e => e.student_id === studentId && (e.course_id === courseId || e.course_id === normCourseId));
      if (exists) {
        throw new Error('Student is already enrolled in this course.');
      }

      const newEnrollment: Enrollment = {
        id: generateValidUUID(),
        student_id: studentId,
        course_id: normCourseId,
        schedule_id: normScheduleId,
        status: 'active',
        access_granted: true,
        access_type: 'manual',
        approved_by: adminId,
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      enrollments.push(newEnrollment);
      setLocalData('enrollments', enrollments);
      return newEnrollment;
    }
  },

  // 6. PAYMENTS
  payments: {
    async getPayments(studentId?: string): Promise<Payment[]> {
      if (isSupabaseConfigured && supabase) {
        let query = supabase
          .from('payments')
          .select(`
            *,
            student:profiles(full_name)
          `);
        
        if (studentId) {
          query = query.eq('student_id', studentId);
        }

        const { data } = await query.order('created_at', { ascending: false });

        return ((data || []) as any[]).map(p => ({
          ...p,
          student_name: p.student?.full_name
        }));
      } else {
        const payments = getLocalData<Payment>('payments');
        const profiles = getLocalData<Profile>('profiles');

        const filtered = studentId ? payments.filter(p => p.student_id === studentId) : payments;

        return filtered.map(p => {
          const student = profiles.find(pr => pr.id === p.student_id);
          return {
            ...p,
            student_name: student?.full_name || 'Unknown Student'
          };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    }
  },

  // 7. CONVENIENCE / FLAT DELEGATORS (for multi-dashboard interoperability)
  getCourses(): Promise<Course[]> {
    return dataService.courses.getCourses();
  },
  createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<Course> {
    return dataService.courses.createCourse(course);
  },
  updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
    return dataService.courses.updateCourse(id, updates);
  },
  deleteCourse(id: string): Promise<void> {
    return dataService.courses.deleteCourse(id);
  },
  uploadCourseImage(file: File, courseId?: string): Promise<string> {
    const targetId = courseId || generateValidUUID();
    return dataService.courses.uploadHeroImage(targetId, file);
  },
  saveCoursePricing(courseId: string, pricing: { usd_price: number; ngn_price: number; eur_price: number }): Promise<CoursePricing> {
    return dataService.pricing.updatePricing({ course_id: courseId, ...pricing });
  },
  getCategories(): Promise<CourseCategory[]> {
    return dataService.categories.getCategories();
  },
  async createCategory(name: string, file?: File | null): Promise<CourseCategory> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'category';
    const newCat = await dataService.categories.createCategory({
      name,
      slug,
      is_active: true
    });
    if (file && newCat.id) {
      try {
        const url = await dataService.categories.uploadCategoryImage(newCat.id, file);
        if (url) {
          return await dataService.categories.updateCategory(newCat.id, { image_url: url });
        }
      } catch (e) {
        console.warn('Failed to upload category image:', e);
      }
    }
    return newCat;
  },
  updateCategory(id: string, updates: Partial<CourseCategory>): Promise<CourseCategory> {
    return dataService.categories.updateCategory(id, updates);
  },
  getCourseSchedules(courseId?: string, activeOnly: boolean = false): Promise<CourseSchedule[]> {
    return dataService.courses.getCourseSchedules(courseId, activeOnly);
  },
  createCourseSchedule(schedule: Omit<CourseSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<CourseSchedule> {
    return dataService.courses.createCourseSchedule(schedule);
  },
  updateCourseSchedule(id: string, updates: Partial<CourseSchedule>): Promise<CourseSchedule> {
    return dataService.courses.updateCourseSchedule(id, updates);
  },
  deleteCourseSchedule(id: string): Promise<void> {
    return dataService.courses.deleteCourseSchedule(id);
  },
  getCourseSelections(studentId?: string): Promise<CourseSelection[]> {
    return dataService.selections.getCourseSelections(studentId);
  },
  approveCourseSelection(selectionId: string, adminId?: string): Promise<void> {
    return dataService.selections.updateSelectionStatus(selectionId, 'approved', adminId || 'admin');
  },
  rejectCourseSelection(selectionId: string, adminId?: string): Promise<void> {
    return dataService.selections.updateSelectionStatus(selectionId, 'rejected', adminId || 'admin');
  },
  getEnrollments(studentId?: string): Promise<Enrollment[]> {
    return dataService.enrollments.getEnrollments(studentId);
  },
  getStudents(): Promise<Profile[]> {
    return dataService.profile.getStudents();
  },
  getInstructors(): Promise<Profile[]> {
    return dataService.profile.getInstructors();
  }
};
