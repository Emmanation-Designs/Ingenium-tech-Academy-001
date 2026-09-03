import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Profile, Course, CourseSchedule, CourseSelection, 
  Enrollment, Payment, UserRole, SelectionStatus, PaymentStatus, EnrollmentStatus,
  CourseCategory, CoursePricing
} from '../types';

// ====================================================================
// UUID Helper Functions
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
      return data as CourseCategory;
    },

    async uploadCategoryImage(categoryId: string, file: File): Promise<string> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
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
      if (error) throw new Error(error.message);
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
    },

    async uploadHeroImage(courseId: string, file: File): Promise<string> {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }
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
    },

    async removeHeroImage(courseId: string): Promise<void> {
      if (isSupabaseConfigured && supabase) {
        const filePath = `${courseId}/hero`;
        const { error } = await supabase.storage
          .from('course-images')
          .remove([filePath]);
        if (error) {
          console.warn('[Supabase Storage] Error removing course image:', error.message);
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

  // 9. CONVENIENCE / FLAT DELEGATORS (for multi-dashboard interoperability)
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
  }
};
