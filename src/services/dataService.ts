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
          id: `local-uuid-${Date.now()}`,
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
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase
          .from('course_categories')
          .select('*')
          .order('name', { ascending: true });
        return (data as CourseCategory[]) || [];
      } else {
        return getLocalData<CourseCategory>('categories');
      }
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
          id: `category-uuid-${Date.now()}`,
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
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase
          .from('course_pricing')
          .select('*')
          .eq('course_id', courseId)
          .maybeSingle();
        return data as CoursePricing | null;
      } else {
        const pricings = getLocalData<CoursePricing>('course_pricing');
        return pricings.find(p => p.course_id === courseId) || null;
      }
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
            id: `pricing-uuid-${Date.now()}`,
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
        const { data } = await supabase
          .from('courses')
          .select(`
            *,
            pricing:course_pricing(*),
            category_relation:course_categories(name)
          `)
          .order('title', { ascending: true });
        
        return ((data || []) as any[]).map(c => ({
          ...c,
          category: c.category_relation?.name || c.category || 'Uncategorized',
          pricing: c.pricing?.[0] || c.pricing || undefined // Supabase returns single row, but occasionally arrays depending on relation mapping. Handle both.
        })) as Course[];
      } else {
        const courses = getLocalData<Course>('courses');
        const pricings = getLocalData<CoursePricing>('course_pricing');
        const categories = getLocalData<CourseCategory>('categories');

        return courses.map(c => {
          const pricing = pricings.find(p => p.course_id === c.id);
          const categoryObj = categories.find(cat => cat.id === c.category_id);
          return {
            ...c,
            category: categoryObj?.name || c.category || 'Uncategorized',
            pricing: pricing || undefined
          };
        });
      }
    },

    async getCourseSchedules(courseId: string, activeOnly: boolean = true): Promise<CourseSchedule[]> {
      if (isSupabaseConfigured && supabase) {
        let query = supabase
          .from('course_schedules')
          .select('*')
          .eq('course_id', courseId);
        if (activeOnly) {
          query = query.eq('is_active', true);
        }
        const { data } = await query.order('created_at', { ascending: false });
        return (data as CourseSchedule[]) || [];
      } else {
        const all = getLocalData<CourseSchedule>('schedules').filter(s => s.course_id === courseId);
        return activeOnly ? all.filter(s => s.is_active) : all;
      }
    },

    async createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Promise<Course> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('courses')
          .insert([course])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as Course;
      } else {
        const courses = getLocalData<Course>('courses');
        const newCourse: Course = {
          ...course,
          id: `course-uuid-${Date.now()}`,
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
        const { data, error } = await supabase
          .from('courses')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
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
          id: `schedule-uuid-${Date.now()}`,
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
      const totalRequests = isSupabaseConfigured && supabase
        ? 0 
        : getLocalData<CourseSelection>('selections').length;
      
      const countStr = String(totalRequests + 1).padStart(6, '0');
      const referenceId = `ITA-2026-${countStr}`;

      if (isSupabaseConfigured && supabase) {
        const { count } = await supabase
          .from('course_selections')
          .select('*', { count: 'exact', head: true });
        
        const dbCountStr = String((count || 0) + 1).padStart(6, '0');
        const dbRefId = `ITA-2026-${dbCountStr}`;

        const { data, error } = await supabase
          .from('course_selections')
          .insert([{
            student_id: studentId,
            course_id: courseId,
            schedule_id: scheduleId,
            reference_id: dbRefId,
            status: 'pending',
            payment_method: 'whatsapp_manual',
            price_snapshot: priceSnapshot,
            currency_snapshot: currencySnapshot,
            student_country: studentCountry
          }])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as CourseSelection;
      } else {
        const selections = getLocalData<CourseSelection>('selections');
        const exists = selections.some(s => s.student_id === studentId && s.course_id === courseId);
        if (exists) {
          throw new Error('You have already requested this course.');
        }

        const newSelection: CourseSelection = {
          id: `selection-uuid-${Date.now()}`,
          student_id: studentId,
          course_id: courseId,
          schedule_id: scheduleId,
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
        return newSelection;
      }
    },

    async getCourseSelections(studentId?: string): Promise<CourseSelection[]> {
      if (isSupabaseConfigured && supabase) {
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

        const { data } = await query.order('created_at', { ascending: false });
        
        return ((data || []) as any[]).map(s => ({
          ...s,
          course_title: s.course?.title,
          student_email: s.student?.email,
          student_name: s.student?.full_name,
          schedule_label: s.schedule?.label
        }));
      } else {
        const selections = getLocalData<CourseSelection>('selections');
        const courses = getLocalData<Course>('courses');
        const profiles = getLocalData<Profile>('profiles');
        const schedules = getLocalData<CourseSchedule>('schedules');

        const filtered = studentId ? selections.filter(s => s.student_id === studentId) : selections;

        return filtered.map(s => {
          const course = courses.find(c => c.id === s.course_id);
          const student = profiles.find(p => p.id === s.student_id);
          const schedule = schedules.find(sc => sc.id === s.schedule_id);

          return {
            ...s,
            course_title: course?.title || 'Unknown Course',
            student_email: student?.email || 'Unknown Email',
            student_name: student?.full_name || 'Unknown Student',
            schedule_label: schedule?.label || 'Not Scheduled'
          };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
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
                amount: selection.price_snapshot || 0,
                currency: selection.currency_snapshot || 'USD',
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
              id: `enrollment-uuid-${Date.now()}`,
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
            id: `payment-uuid-${Date.now()}`,
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
    }
  },

  // 5. ENROLLMENTS
  enrollments: {
    async getEnrollments(studentId?: string): Promise<Enrollment[]> {
      if (isSupabaseConfigured && supabase) {
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

        const { data } = await query.order('created_at', { ascending: false });

        return ((data || []) as any[]).map(e => ({
          ...e,
          course_title: e.course?.title,
          course_image: e.course?.image_url,
          schedule_label: e.schedule?.label
        }));
      } else {
        const enrollments = getLocalData<Enrollment>('enrollments');
        const courses = getLocalData<Course>('courses');
        const schedules = getLocalData<CourseSchedule>('schedules');

        const filtered = studentId ? enrollments.filter(e => e.student_id === studentId) : enrollments;

        return filtered.map(e => {
          const course = courses.find(c => c.id === e.course_id);
          const schedule = schedules.find(sc => sc.id === e.schedule_id);

          return {
            ...e,
            course_title: course?.title || 'Unknown Course',
            course_image: course?.image_url,
            schedule_label: schedule?.label || 'Not Scheduled'
          };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
    },

    async createManualEnrollment(
      studentId: string, 
      courseId: string, 
      scheduleId: string | undefined, 
      adminId: string
    ): Promise<Enrollment> {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('enrollments')
          .insert([{
            student_id: studentId,
            course_id: courseId,
            schedule_id: scheduleId,
            status: 'active',
            access_granted: true,
            access_type: 'manual',
            approved_by: adminId,
            approved_at: new Date().toISOString()
          }])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data as Enrollment;
      } else {
        const enrollments = getLocalData<Enrollment>('enrollments');
        const exists = enrollments.some(e => e.student_id === studentId && e.course_id === courseId);
        if (exists) {
          throw new Error('Student is already enrolled in this course.');
        }

        const newEnrollment: Enrollment = {
          id: `enrollment-uuid-${Date.now()}`,
          student_id: studentId,
          course_id: courseId,
          schedule_id: scheduleId,
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
  }
};
