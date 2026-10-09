// Core Domain TypeScript Interfaces matching Django Models & Serializers

export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface FacultySummary {
  id: number;
  employee_id: string;
  designation: string;
  department_id: number;
  department_name: string;
  department_code: string;
  max_weekly_periods: number;
  max_daily_periods: number;
}

export interface StudentSummary {
  id: number;
  enrollment_number: string;
  batch_year?: number;
  department_id?: number;
  department_name?: string;
  department_code?: string;
  section_id?: number;
  section_name?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number?: string;
  is_verified: boolean;
  is_staff: boolean;
  faculty_profile?: FacultySummary | null;
  student_profile?: StudentSummary | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

export interface College {
  id: number;
  name: string;
  code: string;
  address?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicYear {
  id: number;
  college: number;
  college_name?: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Shift {
  id: number;
  college: number;
  college_name?: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface WorkingDay {
  id: number;
  college: number;
  day: DayCode;
  day_display?: string;
  order: number;
  is_active: boolean;
}

export interface PeriodSlot {
  id: number;
  shift: number;
  shift_name?: string;
  day_of_week: DayCode;
  day_of_week_display?: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  break_label?: string;
}

export interface Department {
  id: number;
  college: number;
  college_name?: string;
  name: string;
  code: string;
  is_active: boolean;
}

export interface Semester {
  id: number;
  academic_year: number;
  academic_year_name?: string;
  department: number;
  department_name?: string;
  department_code?: string;
  semester_number: number;
  shift: number;
  shift_name?: string;
  is_active: boolean;
}

export interface Section {
  id: number;
  semester: number;
  semester_info?: {
    id: number;
    department_code: string;
    semester_number: number;
    shift_name: string;
  };
  name: string;
  student_count: number;
}

export type SubjectType = 'THEORY' | 'LAB' | 'SEMINAR';

export interface Subject {
  id: number;
  department: number;
  department_name?: string;
  department_code?: string;
  code: string;
  name: string;
  subject_type: SubjectType;
  subject_type_display?: string;
  credits: number;
  weekly_periods: number;
  consecutive_slots: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Faculty {
  id: number;
  user: number;
  user_details?: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  employee_id: string;
  department: number;
  department_name?: string;
  department_code?: string;
  designation: string;
  designation_display?: string;
  max_weekly_periods: number;
  max_daily_periods: number;
  is_active: boolean;
  current_weekly_load?: number;
}

export interface FacultySubjectQualification {
  id: number;
  faculty: number;
  faculty_name?: string;
  faculty_employee_id?: string;
  subject: number;
  subject_code?: string;
  subject_name?: string;
  subject_type?: SubjectType;
  preference_level: number;
}

export interface FacultyAvailability {
  id: number;
  faculty: number;
  period_slot: number;
  period_number?: number;
  day_of_week?: DayCode;
  start_time?: string;
  end_time?: string;
  is_break?: boolean;
  break_label?: string;
  is_available: boolean;
  is_preferred: boolean;
  reason?: string;
}

export interface SingleSlotUpdate {
  period_slot_id: number;
  is_available: boolean;
  is_preferred: boolean;
  reason?: string;
}

export interface BatchAvailabilityUpdatePayload {
  faculty_id: number;
  slots: SingleSlotUpdate[];
}

export interface SectionSubjectAssignment {
  id: number;
  section: number;
  section_name?: string;
  department_code?: string;
  semester_number?: number;
  subject: number;
  subject_code?: string;
  subject_name?: string;
  subject_type?: SubjectType;
  weekly_periods?: number;
  consecutive_slots?: number;
  faculty: number;
  faculty_name?: string;
  faculty_employee_id?: string;
  is_primary: boolean;
}

export interface FacultyWorkloadAssignment {
  id: number;
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name: string;
  weekly_periods: number;
  is_primary: boolean;
}

export interface FacultyWorkloadSummary {
  faculty_id: number;
  faculty_name: string;
  employee_id: string;
  department_code: string;
  max_weekly_periods: number;
  max_daily_periods: number;
  current_weekly_load: number;
  remaining_weekly_capacity: number;
  assignment_count: number;
  assignments: FacultyWorkloadAssignment[];
}

export type RoomType = 'CLASSROOM' | 'LAB' | 'SEMINAR_HALL';

export interface Room {
  id: number;
  college: number;
  college_name?: string;
  department?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  name: string;
  code: string;
  room_type: RoomType;
  room_type_display?: string;
  capacity: number;
  building?: string;
  floor?: number;
  is_active: boolean;
}
