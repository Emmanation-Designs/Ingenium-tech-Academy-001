/**
 * Ingenium Tech Academy - Type Definitions
 */

export type UserRole = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CoursePricing {
  id: string;
  course_id: string;
  usd_price: number;
  ngn_price: number;
  eur_price: number;
  created_at: string;
  updated_at: string;
}

export type TrainingMode = 'online' | 'physical' | 'hybrid';
export type CourseStatus = 'draft' | 'published' | 'archived';

export interface Course {
  id: string;
  title: string;
  slug: string;
  short_description?: string;
  description?: string;
  image_url?: string;
  category_id?: string;
  category?: string; // Fallback / joined category name
  duration?: string;
  training_mode: TrainingMode;
  status: CourseStatus;
  is_published: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Dynamic pricing fields loaded on demand
  pricing?: CoursePricing;
}

export interface CourseSchedule {
  id: string;
  course_id: string;
  label: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type SelectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CourseSelection {
  id: string;
  student_id: string;
  course_id: string;
  schedule_id?: string;
  reference_id: string;
  status: SelectionStatus;
  payment_method: string;
  price_snapshot?: number;
  currency_snapshot?: string;
  student_country?: string;
  created_at: string;
  updated_at: string;
  // Joined fields for UI convenience
  course_title?: string;
  student_email?: string;
  student_name?: string;
  schedule_label?: string;
}

export type EnrollmentStatus = 'active' | 'completed' | 'suspended';

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  schedule_id?: string;
  status: EnrollmentStatus;
  access_granted: boolean;
  access_type: 'paid' | 'manual' | 'scholarship';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  course_title?: string;
  course_image?: string;
  schedule_label?: string;
}

export type PaymentStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface Payment {
  id: string;
  student_id: string;
  reference_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string;
  notes?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  student_name?: string;
}

export interface ClassSession {
  id: string;
  course_id: string;
  schedule_id?: string;
  teacher_id?: string;
  start_time: string;
  end_time: string;
  meeting_url?: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
