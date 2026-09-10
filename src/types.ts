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
  teacher_id?: string;
  meeting_url?: string;
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

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface TeacherInvitation {
  id: string;
  invited_email: string;
  token: string;
  invited_by?: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at?: string;
  accepted_user_id?: string;
  created_at: string;
  updated_at: string;
  inviter_name?: string;
  accepted_teacher_name?: string;
}

export interface TeacherCourseAssignment {
  id: string;
  teacher_id: string;
  course_id: string;
  schedule_id?: string;
  assigned_by?: string;
  created_at: string;
  updated_at: string;
  course_title?: string;
  schedule_label?: string;
  teacher_name?: string;
  teacher_email?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ====================================================================
// Live Learning Platform Types
// ====================================================================

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  lessons?: CourseLesson[];
}

export interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  content?: string;
  duration?: string;
  video_url?: string;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  materials?: LessonMaterial[];
  quizzes?: Quiz[];
  is_completed?: boolean;
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  course_id: string;
  title: string;
  file_url: string;
  file_type: 'pdf' | 'document' | 'link';
  file_size?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface ClassRecording {
  id: string;
  session_id?: string;
  course_id: string;
  lesson_id?: string;
  title: string;
  recording_url: string;
  duration?: string;
  recorded_at: string;
  created_by?: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  module_id?: string;
  lesson_id?: string;
  session_id?: string;
  title: string;
  description?: string;
  raw_text?: string;
  total_marks: number;
  pass_percentage: number;
  is_published: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  questions?: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_number: number;
  question_text: string;
  correct_answer: string;
  marks: number;
  explanation?: string;
  created_at: string;
  options?: QuizOption[];
}

export interface QuizOption {
  id: string;
  question_id: string;
  option_key: string; // 'A', 'B', 'C', 'D'
  option_text: string;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  course_id: string;
  score: number;
  total_marks: number;
  percentage: number;
  passed: boolean;
  submitted_at: string;
  created_at: string;
  student_name?: string;
  quiz_title?: string;
  answers?: QuizAnswer[];
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
  marks_awarded: number;
  created_at: string;
}

export interface StudentLessonProgress {
  id: string;
  student_id: string;
  course_id: string;
  lesson_id: string;
  is_completed: boolean;
  completed_at?: string;
  last_accessed_at: string;
  created_at: string;
}

export interface StudentCourseProgress {
  id: string;
  student_id: string;
  course_id: string;
  completed_lessons: number;
  total_lessons: number;
  percentage: number;
  last_lesson_id?: string;
  last_accessed_at: string;
  created_at: string;
  updated_at: string;
}

