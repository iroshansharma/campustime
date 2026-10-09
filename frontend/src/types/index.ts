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

export type FacultyDesignation =
  | 'PROFESSOR'
  | 'ASSOCIATE_PROF'
  | 'ASSISTANT_PROF'
  | 'LECTURER'
  | 'GUEST_FACULTY';

export interface CreateFacultyPayload {
  first_name: string;
  last_name?: string;
  email: string;
  username?: string;
  password?: string;
  employee_id: string;
  department: number;
  designation: string;
  max_weekly_periods?: number;
  max_daily_periods?: number;
  is_active?: boolean;
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

export type TimetableStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface TimetableEntry {
  id: number;
  timetable: number;
  section: number;
  section_name?: string;
  subject: number;
  subject_code?: string;
  subject_name?: string;
  subject_type?: SubjectType;
  faculty: number;
  faculty_name?: string;
  faculty_employee_id?: string;
  room: number;
  room_code?: string;
  room_name?: string;
  room_type?: RoomType;
  period_slot: number;
  period_number?: number;
  start_time?: string;
  end_time?: string;
  day_of_week: DayCode;
  is_locked: boolean;
  linked_session_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Timetable {
  id: number;
  academic_year: number;
  academic_year_name?: string;
  shift: number;
  shift_name?: string;
  department?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  semester?: number | null;
  semester_name?: string | null;
  name: string;
  status: TimetableStatus;
  status_display?: string;
  version: number;
  notes?: string;
  created_by?: number | null;
  created_by_username?: string | null;
  entries_count: number;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  entries?: TimetableEntry[];
}

export interface ScheduleConflict {
  conflict_code: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  section_id?: number | null;
  section_name?: string | null;
  faculty_id?: number | null;
  faculty_name?: string | null;
  room_id?: number | null;
  room_name?: string | null;
  period_slot_ids: number[];
  day_of_week?: string | null;
  subject_code?: string | null;
  suggested_action?: string | null;
}

export interface ValidationReport {
  is_valid: boolean;
  total_conflicts: number;
  hard_constraint_violations: number;
  sessions_required: number;
  sessions_scheduled: number;
  summary: string;
  conflicts: ScheduleConflict[];
}

export interface DiagnosticBottleneck {
  category: string;
  summary: string;
  affected_entity: string;
  suggested_action: string;
}

export interface GenerateSchedulePayload {
  academic_year_id: number;
  shift_id?: number | null;
  department_ids?: number[];
  semester_ids?: number[];
  section_ids?: number[];
  timetable_id?: number | null;
  name?: string;
  notes?: string;
  max_backtracks?: number;
  timeout_seconds?: number;
  persist?: boolean;
}

export interface GenerationResult {
  success: boolean;
  status: 'SUCCESS' | 'INFEASIBLE' | 'LIMIT_REACHED' | 'VALIDATION_FAILED' | 'ERROR';
  message: string;
  timetable_id?: number | null;
  sessions_required: number;
  sessions_scheduled: number;
  backtracks_count: number;
  duration_seconds: number;
  nodes_explored: number;
  validation_report?: ValidationReport | null;
  bottlenecks: DiagnosticBottleneck[];
}

