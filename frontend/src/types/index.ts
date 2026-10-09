// Core TypeScript Interfaces matching Django Models for CampusTime

export type UserRole = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number?: string;
}

export type SubjectType = 'THEORY' | 'LAB' | 'SEMINAR';

export interface Subject {
  id: number;
  code: string;
  name: string;
  subject_type: SubjectType;
  department: number;
  credits: number;
  weekly_periods: number;
  consecutive_slots: number;
}

export interface Section {
  id: number;
  name: string;
  semester: number;
  student_count: number;
}

export interface Room {
  id: number;
  name: string;
  room_type: 'CLASSROOM' | 'LAB' | 'SEMINAR_HALL';
  capacity: number;
  building?: string;
  floor?: number;
}

export interface PeriodSlot {
  id: number;
  shift: number;
  day_of_week: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
  break_label?: string;
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
  room: number;
  room_name?: string;
  period_slot: number;
  day_of_week: string;
  start_time?: string;
  end_time?: string;
  is_locked: boolean;
}
