import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { realtimeSync } from './realtimeSync';
import { 
  Profile, Course, CourseSchedule, CourseSelection, 
  Enrollment, Payment, UserRole, SelectionStatus, PaymentStatus, EnrollmentStatus,
  CourseCategory, CoursePricing, TeacherInvitation, TeacherCourseAssignment, ClassSession
} from '../types';

// ====================================================================
// UUID Helper Functions & Cryptographic Tokens
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

export const generateSecureInviteToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return generateValidUUID().replace(/-/g, '') + generateValidUUID().replace(/-/g, '');
};

export const normalizeToUUID = (id?: string | null): string | undefined => {
  if (!id) return undefined;
  return id;
};

// ====================================================================
// Production Data Service (Supabase is Single Source of Truth)
// ====================================================================

export const dataService = {
  // 1. AUTHENTICATION SERVICES
  auth: {
    /**
     * Subscribe to Supabase Auth state changes.
     * Reacts to SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION.
     */
    onAuthStateChange(
      callback: (event: string, session: any, user: Profile | null) => void
    ) {
      if (!isSupabaseConfigured || !supabase) {
        return { unsubscribe: () => {} };
      }
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            const profile = await dataService.auth.getProfileForUser(session.user.id);
            callback(event, session, profile);
          } else {
            callback(event, null, null);
          }
        }
      );
      return subscription;
    },

    async getProfileForUser(userId: string): Promise<Profile | null> {
      if (!isSupabaseConfigured || !supabase) return null;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error('[Supabase Auth] Error querying user profile:', error.message);
          return null;
        }
        return data as Profile | null;
      } catch (err) {
        console.error('[Supabase Auth] Exception fetching user profile:', err);
        return null;
      }
    },

    async signUp(
      email: string, 
      password: string, 
      fullName: string, 
      phone?: string, 
      country?: string,
      timezone: string = 'Africa/Lagos'
    ): Promise<{ user: Profile | null; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { 
          user: null, 
          error: 'Supabase database is not configured. Please ensure production credentials are set.' 
        };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone || '',
              country: country || '',
              timezone: timezone
            }
          }
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: 'Registration failed. No user was returned by Supabase.' };

        // Allow microsecond for triggers, then fetch profile
        await new Promise(resolve => setTimeout(resolve, 500));
        let profile = await this.getProfileForUser(data.user.id);

        if (!profile) {
          // If profile was not created by trigger, create it explicitly linked to Supabase Auth ID
          const newProfile: Profile = {
            id: data.user.id,
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone || '',
            country: country || '',
            timezone: timezone,
            role: 'student',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: upsertedProfile, error: upsertError } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .maybeSingle();

          if (upsertError) {
            console.error('[Supabase Auth] Profile creation error:', upsertError.message);
            return { user: newProfile, error: null };
          }
          profile = upsertedProfile as Profile;
        }

        return { user: profile, error: null };
      } catch (e: any) {
        return { user: null, error: e.message || 'An unexpected error occurred during registration.' };
      }
    },

    async signIn(email: string, password: string): Promise<{ user: Profile | null; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { 
          user: null, 
          error: 'Supabase database is not configured. Please check your environment variables.' 
        };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: 'Sign in failed. No user returned.' };

        // Fetch authoritative profile linked to this Supabase Auth user ID
        let profile = await this.getProfileForUser(data.user.id);

        if (!profile) {
          // If profile row doesn't exist in public.profiles table, create it linked to user.id
          const metadata = data.user.user_metadata || {};
          const fallbackProfile: Profile = {
            id: data.user.id,
            full_name: metadata.full_name || metadata.name || 'Student',
            email: data.user.email ? data.user.email.toLowerCase() : email.trim().toLowerCase(),
            phone: metadata.phone || '',
            country: metadata.country || '',
            timezone: metadata.timezone || 'Africa/Lagos',
            role: 'student',
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: upsertedProfile } = await supabase
            .from('profiles')
            .upsert(fallbackProfile)
            .select()
            .maybeSingle();

          profile = (upsertedProfile as Profile) || fallbackProfile;
        }

        return { user: profile, error: null };
      } catch (e: any) {
        return { user: null, error: e.message || 'An unexpected error occurred during sign in.' };
      }
    },

    async signOut(): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    },

    async forgotPassword(email: string): Promise<{ success: boolean; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { success: false, error: 'Supabase database is not configured.' };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { success: !error, error: error ? error.message : null };
    },

    async updatePassword(password: string): Promise<{ success: boolean; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { success: false, error: 'Supabase database is not configured.' };
      }
      try {
        const { error } = await supabase.auth.updateUser({ password });
        return { success: !error, error: error ? error.message : null };
      } catch (e: any) {
        return { success: false, error: e.message || 'Failed to update password' };
      }
    },

    async getCurrentUser(): Promise<Profile | null> {
      if (!isSupabaseConfigured || !supabase) {
        return null;
      }
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return null;

        const profile = await this.getProfileForUser(user.id);
        return profile;
      } catch (err) {
        console.error('[Supabase Auth] Error fetching current user:', err);
        return null;
      }
    },

    async signUpTeacherWithInvite(
      token: string,
      email: string,
      password: string,
      fullName: string,
      phone?: string,
      country?: string,
      timezone: string = 'Africa/Lagos'
    ): Promise<{ user: Profile | null; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { user: null, error: 'Database is not configured.' };
      }

      try {
        // 1. Validate invitation token first
        const validation = await dataService.teacherInvitations.validateInvitation(token);
        if (!validation.valid) {
          return { user: null, error: validation.message || 'Invalid or expired invitation.' };
        }

        // 2. Strict email normalization and comparison
        const normalizedInvited = (validation.invited_email || '').trim().toLowerCase();
        const normalizedSignup = email.trim().toLowerCase();

        if (normalizedInvited !== normalizedSignup) {
          return { 
            user: null, 
            error: `Email mismatch. This invitation is reserved for ${normalizedInvited}. You cannot claim it with ${normalizedSignup}.` 
          };
        }

        // 3. Create the Supabase Auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: normalizedSignup,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone || '',
              country: country || '',
              timezone: timezone,
              role: 'teacher'
            }
          }
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            return { 
              user: null, 
              error: 'An account with this email already exists. Please sign in to activate your teacher privileges.' 
            };
          }
          return { user: null, error: authError.message };
        }

        if (!authData.user) {
          return { user: null, error: 'Account creation failed. Please try again.' };
        }

        const userId = authData.user.id;

        // 4. Upsert profile with role = 'teacher'
        const teacherProfile: Profile = {
          id: userId,
          full_name: fullName.trim(),
          email: normalizedSignup,
          phone: phone || '',
          country: country || '',
          timezone: timezone,
          role: 'teacher',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await supabase
          .from('profiles')
          .upsert(teacherProfile);

        // 5. Claim the invitation
        await dataService.teacherInvitations.claimInvitation(token, userId);

        const finalProfile = await this.getProfileForUser(userId);
        return { user: finalProfile || teacherProfile, error: null };
      } catch (e: any) {
        return { user: null, error: e.message || 'An error occurred while creating teacher account.' };
      }
    },

    async signInTeacherWithInvite(
      token: string,
      email: string,
      password: string
    ): Promise<{ user: Profile | null; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { user: null, error: 'Database is not configured.' };
      }

      try {
        const validation = await dataService.teacherInvitations.validateInvitation(token);
        if (!validation.valid) {
          return { user: null, error: validation.message || 'Invalid or expired invitation.' };
        }

        const normalizedInvited = (validation.invited_email || '').trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedInvited !== normalizedEmail) {
          return {
            user: null,
            error: `Email mismatch. This invitation is reserved for ${normalizedInvited}.`
          };
        }

        const signInResult = await this.signIn(normalizedEmail, password);
        if (signInResult.error || !signInResult.user) {
          return signInResult;
        }

        // Claim and upgrade user to teacher
        await dataService.teacherInvitations.claimInvitation(token, signInResult.user.id);
        const updated = await this.getProfileForUser(signInResult.user.id);

        return { user: updated || signInResult.user, error: null };
      } catch (e: any) {
        return { user: null, error: e.message || 'Failed to sign in and activate teacher account.' };
      }
    }
  },

  // 2. PROFILE SERVICES
  profile: {
    async updateProfile(id: string, updates: Partial<Profile>): Promise<{ profile: Profile | null; error: string | null }> {
      if (!isSupabaseConfigured || !supabase) {
        return { profile: null, error: 'Supabase is not configured.' };
      }
      try {
        const { role, id: _, created_at, email, ...safeUpdates } = updates as any;
        const { data, error } = await supabase
          .from('profiles')
          .update(safeUpdates)
          .eq('id', id)
          .select()
          .single();

        if (error) return { profile: null, error: error.message };
        realtimeSync.notifyMutation('profiles', 'UPDATE');
        return { profile: data as Profile, error: null };
      } catch (e: any) {
        return { profile: null, error: e.message };
      }
    },

    async getStudents(): Promise<Profile[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .order('created_at', { ascending: false });
        return (data as Profile[]) || [];
      } catch (e) {
        console.error('[Supabase] Error fetching students:', e);
        return [];
      }
    },

    async getInstructors(): Promise<Profile[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'instructor'])
          .order('created_at', { ascending: false });
        return (data as Profile[]) || [];
      } catch (e) {
        console.error('[Supabase] Error fetching instructors:', e);
        return [];
      }
    },

    async toggleDevRole(id: string, role: UserRole): Promise<Profile | null> {
      if (!isSupabaseConfigured || !supabase) return null;
      try {
        const { data } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', id)
          .select()
          .single();
        return data as Profile | null;
      } catch (e) {
        console.error('[Supabase] Error updating user role:', e);
        return null;
      }
    }
  },

  // 3. COURSE CATEGORIES SERVICES
  categories: {
    async getCategories(): Promise<CourseCategory[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        const { data, error } = await supabase
          .from('course_categories')
          .select('*')
          .order('name', { ascending: true });
        if (error) {
          console.error('[Supabase] Error fetching categories:', error.message);
          return [];
        }
        return (data as CourseCategory[]) || [];
      } catch (e) {
        console.error('[Supabase] Exception fetching categories:', e);
        return [];
      }
    },

    async createCategory(category: Omit<CourseCategory, 'id' | 'created_at' | 'updated_at'>): Promise<CourseCategory> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { data, error } = await supabase
        .from('course_categories')
        .insert([category])
        .select()
        .single();
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_categories', 'INSERT');
      return data as CourseCategory;
    },

    async updateCategory(id: string, updates: Partial<CourseCategory>): Promise<CourseCategory> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { data, error } = await supabase
        .from('course_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_categories', 'UPDATE');
      return data as CourseCategory;
    },

    async uploadCategoryImage(categoryId: string, file: File): Promise<string> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const rawExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
      const safeExt = rawExt && /^[a-z0-9]+$/i.test(rawExt) ? rawExt : 'jpg';
      const filePath = `categories/${categoryId}/hero.${safeExt}`;

      const { error } = await supabase.storage
        .from('course-images')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });
      
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('bucket not found') || (error as any).statusCode === '404' || (error as any).status === 400) {
          throw new Error("Supabase Storage bucket 'course-images' not found. Please create the public bucket 'course-images' in your Supabase project (see migration 008).");
        }
        if (msg.includes('policy') || (error as any).statusCode === '403') {
          throw new Error("Permission denied uploading image to 'course-images'. Please check your Supabase Storage RLS policies.");
        }
        throw new Error(error.message);
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('course-images')
        .getPublicUrl(filePath);
        
      return publicUrl;
    }
  },

  // 4. COURSE PRICING SERVICES
  pricing: {
    async getPricingForCourse(courseId: string): Promise<CoursePricing | null> {
      if (!isSupabaseConfigured || !supabase) return null;
      try {
        const { data, error } = await supabase
          .from('course_pricing')
          .select('*')
          .eq('course_id', courseId)
          .maybeSingle();
        if (error) {
          console.error('[Supabase] Error fetching course pricing:', error.message);
          return null;
        }
        return (data as CoursePricing) || null;
      } catch (e) {
        console.error('[Supabase] Exception fetching course pricing:', e);
        return null;
      }
    },

    async updatePricing(pricing: Omit<CoursePricing, 'id' | 'created_at' | 'updated_at'> | Partial<CoursePricing> & { course_id: string }): Promise<CoursePricing> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { data, error } = await supabase
        .from('course_pricing')
        .upsert([pricing], { onConflict: 'course_id' })
        .select()
        .single();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('schema cache') || msg.includes('course_pricing') || (error as any).code === 'PGRST205') {
          throw new Error(
            "The 'course_pricing' table was not found in your Supabase database. Please run migration 009 in your Supabase SQL Editor to create the table and refresh the schema cache."
          );
        }
        throw new Error(error.message);
      }
      realtimeSync.notifyMutation('course_pricing', 'UPDATE');
      return data as CoursePricing;
    }
  },

  // 5. COURSE SERVICES
  courses: {
    async getCourses(): Promise<Course[]> {
      if (!isSupabaseConfigured || !supabase) {
        return [];
      }
      try {
        // Fetch courses directly from Supabase
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .order('title', { ascending: true });

        if (coursesError) {
          console.error('[Supabase] Error fetching courses:', coursesError.message);
          return [];
        }

        if (!coursesData || coursesData.length === 0) {
          return [];
        }

        // Fetch pricing and categories from Supabase in parallel
        const [pricingRes, categoriesRes] = await Promise.all([
          supabase.from('course_pricing').select('*'),
          supabase.from('course_categories').select('*')
        ]);

        const pricingData: CoursePricing[] = pricingRes.data || [];
        const categoriesData: CourseCategory[] = categoriesRes.data || [];

        const catMap = new Map<string, string>();
        for (const cat of categoriesData) {
          if (cat.id && cat.name) catMap.set(cat.id, cat.name);
        }

        return coursesData.map(c => {
          const categoryName = (c.category_id && catMap.get(c.category_id)) 
            || c.category 
            || 'Uncategorized';

          const foundPricing = pricingData.find(p => p.course_id === c.id);

          return {
            ...c,
            category: categoryName,
            pricing: foundPricing || undefined
          };
        }) as Course[];
      } catch (err) {
        console.error('[Supabase] Exception in getCourses:', err);
        return [];
      }
    },

    async getCourseSchedules(courseId?: string, activeOnly: boolean = false): Promise<CourseSchedule[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        let query = supabase
          .from('course_schedules')
          .select('*');
        if (courseId) {
          query = query.eq('course_id', courseId);
        }
        if (activeOnly) {
          query = query.eq('is_active', true);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
          console.error('[Supabase] Error fetching schedules:', error.message);
          return [];
        }
        return (data as CourseSchedule[]) || [];
      } catch (e) {
        console.error('[Supabase] Exception in getCourseSchedules:', e);
        return [];
      }
    },

    async createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<Course> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { pricing, ...cleanCourse } = course as any;
      const { data, error } = await supabase
        .from('courses')
        .insert([cleanCourse])
        .select()
        .single();

      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('courses', 'INSERT');
      return data as Course;
    },

    async updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { pricing, ...cleanUpdates } = updates as any;
      const { data, error } = await supabase
        .from('courses')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('courses', 'UPDATE');
      return data as Course;
    },

    async deleteCourse(id: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('courses', 'DELETE');
    },

    async uploadHeroImage(courseId: string, file: File): Promise<string> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const rawExt = file.name ? file.name.split('.').pop()?.toLowerCase() : 'jpg';
      const safeExt = rawExt && /^[a-z0-9]+$/i.test(rawExt) ? rawExt : 'jpg';
      const filePath = `${courseId}/hero.${safeExt}`;

      const { error } = await supabase.storage
        .from('course-images')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });
      
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('bucket not found') || (error as any).statusCode === '404' || (error as any).status === 400) {
          throw new Error("Supabase Storage bucket 'course-images' not found. Please create the public bucket 'course-images' in your Supabase project (see migration 008).");
        }
        if (msg.includes('policy') || (error as any).statusCode === '403') {
          throw new Error("Permission denied uploading course image to 'course-images'. Please check your Supabase Storage RLS policies.");
        }
        throw new Error(error.message);
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('course-images')
        .getPublicUrl(filePath);
        
      return publicUrl;
    },

    async removeHeroImage(courseId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: files } = await supabase.storage.from('course-images').list(courseId);
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${courseId}/${f.name}`);
            await supabase.storage.from('course-images').remove(filePaths);
          }
        } catch (e) {
          console.warn('[Supabase Storage] Error removing course image files:', e);
        }
      }
    },

    async createCourseSchedule(schedule: Omit<CourseSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<CourseSchedule> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { data, error } = await supabase
        .from('course_schedules')
        .insert([schedule])
        .select()
        .single();
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_schedules', 'INSERT');
      return data as CourseSchedule;
    },

    async updateCourseSchedule(id: string, updates: Partial<CourseSchedule>): Promise<CourseSchedule> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { data, error } = await supabase
        .from('course_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_schedules', 'UPDATE');
      return data as CourseSchedule;
    },

    async deleteCourseSchedule(id: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { error } = await supabase
        .from('course_schedules')
        .delete()
        .eq('id', id);
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_schedules', 'DELETE');
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
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }

      // Generate reference ID from database count
      let dbRefId = `ITA-2026-${Date.now().toString().slice(-6)}`;
      try {
        const { count } = await supabase
          .from('course_selections')
          .select('*', { count: 'exact', head: true });
        
        const dbCountStr = String((count || 0) + 1).padStart(6, '0');
        dbRefId = `ITA-2026-${dbCountStr}`;
      } catch {
        // Fall back to timestamp-based ref
      }

      const payload: Record<string, any> = {
        student_id: studentId,
        course_id: courseId,
        reference_id: dbRefId,
        status: 'pending',
        payment_method: 'whatsapp_manual'
      };
      if (scheduleId) payload.schedule_id = scheduleId;
      if (priceSnapshot !== undefined) payload.price_snapshot = priceSnapshot;
      if (currencySnapshot !== undefined) payload.currency_snapshot = currencySnapshot;
      if (studentCountry !== undefined) payload.student_country = studentCountry;

      const { data, error } = await supabase
        .from('course_selections')
        .insert([payload])
        .select()
        .single();

      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (error.code === '23505' || errMsg.includes('unique') || errMsg.includes('already exists')) {
          throw new Error('You have already added this course to your selections.');
        }
        throw new Error(error.message);
      }

      realtimeSync.notifyMutation('course_selections', 'INSERT');
      return data as CourseSelection;
    },

    async getCourseSelections(studentId?: string): Promise<CourseSelection[]> {
      if (!isSupabaseConfigured || !supabase) return [];
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

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
          console.error('[Supabase] Error fetching selections:', error.message);
          return [];
        }

        return ((data || []) as any[]).map(s => ({
          ...s,
          course_title: s.course?.title,
          student_email: s.student?.email,
          student_name: s.student?.full_name,
          schedule_label: s.schedule?.label
        }));
      } catch (e) {
        console.error('[Supabase] Exception in getCourseSelections:', e);
        return [];
      }
    },

    async updateSelectionStatus(selectionId: string, status: SelectionStatus, adminId?: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }

      const now = new Date().toISOString();
      const { data: updatedSelection, error: updateErr } = await supabase
        .from('course_selections')
        .update({ status, updated_at: now })
        .eq('id', selectionId)
        .select()
        .single();

      if (updateErr) throw new Error(updateErr.message);

      // When approved, grant enrollment and log payment directly in Supabase
      if (status === 'approved' && updatedSelection) {
        const target = updatedSelection as CourseSelection;

        // Upsert enrollment in Supabase
        const { data: existingEnr } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', target.student_id)
          .eq('course_id', target.course_id)
          .maybeSingle();

        if (existingEnr) {
          await supabase
            .from('enrollments')
            .update({
              status: 'active',
              access_granted: true,
              access_type: 'paid',
              approved_by: adminId || null,
              approved_at: now,
              schedule_id: target.schedule_id || null,
              updated_at: now
            })
            .eq('id', existingEnr.id);
        } else {
          await supabase
            .from('enrollments')
            .insert([{
              student_id: target.student_id,
              course_id: target.course_id,
              schedule_id: target.schedule_id || null,
              status: 'active',
              access_granted: true,
              access_type: 'paid',
              approved_by: adminId || null,
              approved_at: now
            }]);
        }

        // Insert payment record in Supabase
        await supabase
          .from('payments')
          .insert([{
            student_id: target.student_id,
            reference_id: target.reference_id,
            amount: target.price_snapshot ?? 0,
            currency: target.currency_snapshot ?? 'USD',
            status: 'confirmed',
            payment_method: 'whatsapp_manual',
            notes: 'Approved via Course Requests dashboard',
            confirmed_by: adminId || null,
            confirmed_at: now
          }]);
      }

      realtimeSync.notifyMutation('course_selections', 'UPDATE');
      if (status === 'approved') {
        realtimeSync.notifyMutation('enrollments', 'INSERT');
        realtimeSync.notifyMutation('payments', 'INSERT');
      }
    },

    async deleteCourseSelection(selectionId: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { error } = await supabase
        .from('course_selections')
        .delete()
        .eq('id', selectionId);
      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('course_selections', 'DELETE');
    }
  },

  // 7. ENROLLMENTS
  enrollments: {
    async getEnrollments(studentId?: string): Promise<Enrollment[]> {
      if (!isSupabaseConfigured || !supabase) return [];
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

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
          console.error('[Supabase] Error fetching enrollments:', error.message);
          return [];
        }

        return ((data || []) as any[]).map(e => ({
          ...e,
          course_title: e.course?.title,
          course_image: e.course?.image_url,
          schedule_label: e.schedule?.label
        }));
      } catch (e) {
        console.error('[Supabase] Exception in getEnrollments:', e);
        return [];
      }
    },

    async createManualEnrollment(
      studentId: string, 
      courseId: string, 
      scheduleId: string | undefined, 
      adminId: string
    ): Promise<Enrollment> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }

      const payload: Record<string, any> = {
        student_id: studentId,
        course_id: courseId,
        status: 'active',
        access_granted: true,
        access_type: 'manual',
        approved_by: adminId,
        approved_at: new Date().toISOString()
      };
      if (scheduleId) {
        payload.schedule_id = scheduleId;
      }

      const { data, error } = await supabase
        .from('enrollments')
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('enrollments', 'INSERT');
      return data as Enrollment;
    }
  },

  // 8. PAYMENTS
  payments: {
    async getPayments(studentId?: string): Promise<Payment[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        let query = supabase
          .from('payments')
          .select(`
            *,
            student:profiles(full_name)
          `);
        
        if (studentId) {
          query = query.eq('student_id', studentId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
          console.error('[Supabase] Error fetching payments:', error.message);
          return [];
        }

        return ((data || []) as any[]).map(p => ({
          ...p,
          student_name: p.student?.full_name
        }));
      } catch (e) {
        console.error('[Supabase] Exception in getPayments:', e);
        return [];
      }
    }
  },

  // 9. TEACHER INVITATIONS
  teacherInvitations: {
    async getInvitations(): Promise<TeacherInvitation[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        const { data, error } = await supabase
          .from('teacher_invitations')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Supabase] Error fetching teacher invitations:', error.message);
          return [];
        }

        const now = new Date();
        return (data || []).map((row: any) => {
          const isExpired = new Date(row.expires_at) < now && row.status === 'pending';
          return {
            id: row.id,
            invited_email: row.invited_email || row.email,
            token: row.token,
            invited_by: row.invited_by,
            status: isExpired ? 'expired' : row.status,
            expires_at: row.expires_at,
            accepted_at: row.accepted_at || row.used_at,
            accepted_user_id: row.accepted_user_id,
            created_at: row.created_at,
            updated_at: row.updated_at || row.created_at
          };
        }) as TeacherInvitation[];
      } catch (e) {
        console.error('[Supabase] Exception fetching invitations:', e);
        return [];
      }
    },

    async createInvitation(email: string, adminId?: string): Promise<TeacherInvitation> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }

      // Check if user is already registered as teacher
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, role, email')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingUser && existingUser.role === 'teacher') {
        throw new Error('A teacher account with this email address already exists.');
      }

      const token = generateSecureInviteToken();
      // 7 days expiration
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      // Check if an invitation already exists for this email address
      const { data: existingInvs } = await supabase
        .from('teacher_invitations')
        .select('*')
        .or(`invited_email.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
        .order('created_at', { ascending: false });

      let data: any = null;
      let error: any = null;

      // If an existing invitation already exists (e.g. pending, revoked, expired),
      // update and refresh it to prevent duplicate key constraint violations and give a fresh valid link
      if (existingInvs && existingInvs.length > 0) {
        const existingInv = existingInvs[0];
        const updateRes = await supabase
          .from('teacher_invitations')
          .update({
            invited_email: normalizedEmail,
            email: normalizedEmail,
            token,
            invited_by: adminId || existingInv.invited_by || null,
            status: 'pending',
            expires_at: expiresAt,
            accepted_at: null,
            accepted_user_id: null,
            updated_at: now
          })
          .eq('id', existingInv.id)
          .select()
          .single();

        data = updateRes.data;
        error = updateRes.error;
      }

      // If no existing record or update failed, insert a new invitation record
      if (!data) {
        const newInv = {
          invited_email: normalizedEmail,
          email: normalizedEmail,
          token,
          invited_by: adminId || null,
          status: 'pending',
          expires_at: expiresAt,
          created_at: now,
          updated_at: now
        };

        const insertRes = await supabase
          .from('teacher_invitations')
          .insert([newInv])
          .select()
          .single();

        data = insertRes.data;
        error = insertRes.error;
      }

      if (error) {
        console.error('[Supabase] Error creating teacher invitation:', error.message);
        throw new Error(error.message);
      }

      realtimeSync.notifyMutation('teacher_invitations', 'INSERT');

      return {
        id: data.id,
        invited_email: data.invited_email || data.email,
        token: data.token,
        invited_by: data.invited_by,
        status: data.status,
        expires_at: data.expires_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    },

    async resendInvitation(id: string): Promise<TeacherInvitation> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const newToken = generateSecureInviteToken();
      const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('teacher_invitations')
        .update({
          token: newToken,
          status: 'pending',
          expires_at: newExpires,
          updated_at: now
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('teacher_invitations', 'UPDATE');

      return {
        id: data.id,
        invited_email: data.invited_email || data.email,
        token: data.token,
        invited_by: data.invited_by,
        status: data.status,
        expires_at: data.expires_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    },

    async revokeInvitation(id: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
      const { error } = await supabase
        .from('teacher_invitations')
        .update({
          status: 'revoked',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
      realtimeSync.notifyMutation('teacher_invitations', 'UPDATE');
    },

    async validateInvitation(token: string): Promise<{
      valid: boolean;
      invited_email?: string;
      status?: string;
      reason?: string;
      message?: string;
    }> {
      if (!isSupabaseConfigured || !supabase) {
        return { valid: false, reason: 'unconfigured', message: 'Database is not configured.' };
      }

      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('validate_teacher_invitation', { p_token: token });

        if (!rpcError && rpcData) {
          return rpcData;
        }

        const { data, error } = await supabase
          .from('teacher_invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (error || !data) {
          return { valid: false, reason: 'invalid', message: 'Invitation not found or invalid link.' };
        }

        const email = data.invited_email || data.email;
        if (data.status === 'revoked') {
          return { valid: false, invited_email: email, reason: 'revoked', message: 'This invitation has been revoked.' };
        }
        if (data.status === 'accepted') {
          return { valid: false, invited_email: email, reason: 'accepted', message: 'This invitation has already been accepted.' };
        }
        if (new Date(data.expires_at) < new Date() || data.status === 'expired') {
          return { valid: false, invited_email: email, reason: 'expired', message: 'This invitation has expired.' };
        }

        return {
          valid: true,
          invited_email: email,
          status: data.status
        };
      } catch (e: any) {
        return { valid: false, reason: 'error', message: e.message || 'Validation error.' };
      }
    },

    async claimInvitation(token: string, userId: string): Promise<{ success: boolean; message?: string }> {
      if (!isSupabaseConfigured || !supabase) {
        return { success: false, message: 'Database is not configured.' };
      }

      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('claim_teacher_invitation', { p_token: token });

        if (!rpcError && rpcData) {
          realtimeSync.notifyMutation('profiles', 'UPDATE');
          realtimeSync.notifyMutation('teacher_invitations', 'UPDATE');
          return rpcData;
        }

        const { data: inv, error: invError } = await supabase
          .from('teacher_invitations')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (invError || !inv) {
          return { success: false, message: 'Invitation not found.' };
        }

        await supabase
          .from('profiles')
          .update({ role: 'teacher', updated_at: new Date().toISOString() })
          .eq('id', userId);

        await supabase
          .from('teacher_invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_user_id: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', inv.id);

        realtimeSync.notifyMutation('profiles', 'UPDATE');
        realtimeSync.notifyMutation('teacher_invitations', 'UPDATE');

        return { success: true, message: 'Teacher account activated successfully.' };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    }
  },

  // 10. TEACHERS & ASSIGNMENTS
  teachers: {
    async getTeachers(): Promise<Profile[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'teacher')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('[Supabase] Error fetching teachers:', error.message);
          return [];
        }
        return (data as Profile[]) || [];
      } catch (e) {
        console.error('[Supabase] Exception fetching teachers:', e);
        return [];
      }
    },

    async getTeacherAssignments(teacherId?: string): Promise<TeacherCourseAssignment[]> {
      if (!isSupabaseConfigured || !supabase) return [];
      try {
        let query = supabase
          .from('teacher_course_assignments')
          .select('*, courses(title), course_schedules(label), profiles:teacher_id(full_name, email)');

        if (teacherId) {
          query = query.eq('teacher_id', teacherId);
        }

        const { data, error } = await query;
        if (error) {
          console.warn('[Supabase] Error fetching teacher assignments:', error.message);
          return [];
        }

        return (data || []).map((row: any) => ({
          id: row.id,
          teacher_id: row.teacher_id,
          course_id: row.course_id,
          schedule_id: row.schedule_id,
          assigned_by: row.assigned_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          course_title: row.courses?.title,
          schedule_label: row.course_schedules?.label,
          teacher_name: row.profiles?.full_name,
          teacher_email: row.profiles?.email
        }));
      } catch (e) {
        console.error('[Supabase] Exception fetching assignments:', e);
        return [];
      }
    },

    async assignTeacher(teacherId: string, courseId: string, scheduleId?: string, adminId?: string): Promise<TeacherCourseAssignment> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Database is not configured.');
      }

      const newAssn = {
        teacher_id: teacherId,
        course_id: courseId,
        schedule_id: scheduleId || null,
        assigned_by: adminId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('teacher_course_assignments')
        .insert([newAssn])
        .select()
        .single();

      if (error) throw new Error(error.message);

      if (scheduleId) {
        await supabase
          .from('course_schedules')
          .update({ teacher_id: teacherId, updated_at: new Date().toISOString() })
          .eq('id', scheduleId);
      }

      realtimeSync.notifyMutation('teacher_course_assignments', 'INSERT');
      realtimeSync.notifyMutation('course_schedules', 'UPDATE');

      return data as TeacherCourseAssignment;
    },

    async removeAssignment(assignmentId: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');
      
      const { data: assn } = await supabase
        .from('teacher_course_assignments')
        .select('schedule_id')
        .eq('id', assignmentId)
        .maybeSingle();

      const { error } = await supabase
        .from('teacher_course_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw new Error(error.message);

      if (assn?.schedule_id) {
        await supabase
          .from('course_schedules')
          .update({ teacher_id: null })
          .eq('id', assn.schedule_id);
      }

      realtimeSync.notifyMutation('teacher_course_assignments', 'DELETE');
      realtimeSync.notifyMutation('course_schedules', 'UPDATE');
    },

    async getTeacherClasses(teacherId: string): Promise<{
      course: Course;
      schedule?: CourseSchedule;
      assignmentId?: string;
      meetingUrl?: string;
      students: { id: string; name: string; email: string; enrollmentStatus: string; enrolledAt: string }[];
    }[]> {
      if (!isSupabaseConfigured || !supabase) return [];

      try {
        const { data: assignments } = await supabase
          .from('teacher_course_assignments')
          .select('*, courses(*), course_schedules(*)')
          .eq('teacher_id', teacherId);

        const { data: directSchedules } = await supabase
          .from('course_schedules')
          .select('*, courses(*)')
          .eq('teacher_id', teacherId);

        const classesMap = new Map<string, any>();

        (assignments || []).forEach((a: any) => {
          if (a.courses) {
            const key = `${a.course_id}_${a.schedule_id || 'all'}`;
            classesMap.set(key, {
              course: a.courses,
              schedule: a.course_schedules || undefined,
              assignmentId: a.id,
              meetingUrl: a.course_schedules?.meeting_url
            });
          }
        });

        (directSchedules || []).forEach((s: any) => {
          if (s.courses) {
            const key = `${s.course_id}_${s.id}`;
            if (!classesMap.has(key)) {
              classesMap.set(key, {
                course: s.courses,
                schedule: s,
                assignmentId: undefined,
                meetingUrl: s.meeting_url
              });
            }
          }
        });

        const result: any[] = [];
        for (const item of Array.from(classesMap.values())) {
          let enrollmentsQuery = supabase
            .from('enrollments')
            .select('*, profiles:student_id(id, full_name, email)')
            .eq('course_id', item.course.id)
            .eq('status', 'active')
            .eq('access_granted', true);

          if (item.schedule?.id) {
            enrollmentsQuery = enrollmentsQuery.or(`schedule_id.eq.${item.schedule.id},schedule_id.is.null`);
          }

          const { data: enrs } = await enrollmentsQuery;

          const students = (enrs || []).map((e: any) => ({
            id: e.profiles?.id || e.student_id,
            name: e.profiles?.full_name || 'Student',
            email: e.profiles?.email || '',
            enrollmentStatus: e.status,
            enrolledAt: e.created_at
          }));

          result.push({
            course: item.course,
            schedule: item.schedule,
            assignmentId: item.assignmentId,
            meetingUrl: item.meetingUrl,
            students
          });
        }

        return result;
      } catch (e) {
        console.error('[Supabase] Error loading teacher classes:', e);
        return [];
      }
    },

    async saveMeetingUrl(scheduleId: string, meetingUrl: string, sessionId?: string): Promise<void> {
      if (!isSupabaseConfigured || !supabase) throw new Error('Database not configured.');
      
      const trimmedUrl = meetingUrl.trim();

      const { error: schedError } = await supabase
        .from('course_schedules')
        .update({ meeting_url: trimmedUrl, updated_at: new Date().toISOString() })
        .eq('id', scheduleId);

      if (schedError) throw new Error(schedError.message);

      if (sessionId) {
        await supabase
          .from('class_sessions')
          .update({ meeting_url: trimmedUrl, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }

      realtimeSync.notifyMutation('course_schedules', 'UPDATE');
      realtimeSync.notifyMutation('class_sessions', 'UPDATE');
    },

    async getStudentMeetingUrl(scheduleId?: string, sessionId?: string): Promise<{
      accessible: boolean;
      meeting_url?: string;
      message?: string;
    }> {
      if (!isSupabaseConfigured || !supabase) {
        return { accessible: false, message: 'Database not configured.' };
      }

      try {
        const { data, error } = await supabase.rpc('get_student_meeting_url', {
          p_schedule_id: scheduleId || null,
          p_session_id: sessionId || null
        });

        if (!error && data) {
          return data;
        }

        if (scheduleId) {
          const { data: sched } = await supabase
            .from('course_schedules')
            .select('meeting_url')
            .eq('id', scheduleId)
            .maybeSingle();

          if (sched?.meeting_url) {
            return { accessible: true, meeting_url: sched.meeting_url };
          }
        }
        return { accessible: false, message: 'No meeting link is currently active.' };
      } catch (e: any) {
        return { accessible: false, message: e.message };
      }
    }
  },

  // 11. CONVENIENCE / FLAT DELEGATORS (for multi-dashboard interoperability)
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
    return dataService.selections.updateSelectionStatus(selectionId, 'approved', adminId);
  },
  rejectCourseSelection(selectionId: string, adminId?: string): Promise<void> {
    return dataService.selections.updateSelectionStatus(selectionId, 'rejected', adminId);
  },
  getEnrollments(studentId?: string): Promise<Enrollment[]> {
    return dataService.enrollments.getEnrollments(studentId);
  },
  getStudents(): Promise<Profile[]> {
    return dataService.profile.getStudents();
  },
  getInstructors(): Promise<Profile[]> {
    return dataService.profile.getInstructors();
  },
  getTeacherInvitations(): Promise<TeacherInvitation[]> {
    return dataService.teacherInvitations.getInvitations();
  },
  createTeacherInvitation(email: string, adminId?: string): Promise<TeacherInvitation> {
    return dataService.teacherInvitations.createInvitation(email, adminId);
  },
  resendTeacherInvitation(id: string): Promise<TeacherInvitation> {
    return dataService.teacherInvitations.resendInvitation(id);
  },
  revokeTeacherInvitation(id: string): Promise<void> {
    return dataService.teacherInvitations.revokeInvitation(id);
  },
  getTeachers(): Promise<Profile[]> {
    return dataService.teachers.getTeachers();
  },
  getTeacherAssignments(teacherId?: string): Promise<TeacherCourseAssignment[]> {
    return dataService.teachers.getTeacherAssignments(teacherId);
  },
  assignTeacher(teacherId: string, courseId: string, scheduleId?: string, adminId?: string): Promise<TeacherCourseAssignment> {
    return dataService.teachers.assignTeacher(teacherId, courseId, scheduleId, adminId);
  },
  removeTeacherAssignment(assignmentId: string): Promise<void> {
    return dataService.teachers.removeAssignment(assignmentId);
  },
  getTeacherClasses(teacherId: string) {
    return dataService.teachers.getTeacherClasses(teacherId);
  },
  saveClassMeetingUrl(scheduleId: string, meetingUrl: string) {
    return dataService.teachers.saveMeetingUrl(scheduleId, meetingUrl);
  }
};
