import { apiClient } from './api';
import {
  College, AcademicYear, Shift, WorkingDay,
  PeriodSlot, Department, Semester, Section, Subject,
  PaginatedResponse
} from '../types';

function extractData<T>(res: { data: PaginatedResponse<T> | T[] }): T[] {
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data.results || [];
}

export const academicsService = {
  // Colleges
  async getColleges(): Promise<College[]> {
    const res = await apiClient.get<PaginatedResponse<College> | College[]>('/academics/colleges/');
    return extractData(res);
  },
  async createCollege(payload: Partial<College>): Promise<College> {
    const { data } = await apiClient.post<College>('/academics/colleges/', payload);
    return data;
  },
  async updateCollege(id: number, payload: Partial<College>): Promise<College> {
    const { data } = await apiClient.patch<College>(`/academics/colleges/${id}/`, payload);
    return data;
  },
  async deleteCollege(id: number): Promise<void> {
    await apiClient.delete(`/academics/colleges/${id}/`);
  },

  // Academic Years
  async getAcademicYears(collegeId?: number): Promise<AcademicYear[]> {
    const params = collegeId ? { college: collegeId } : {};
    const res = await apiClient.get<PaginatedResponse<AcademicYear> | AcademicYear[]>('/academics/academic-years/', { params });
    return extractData(res);
  },
  async createAcademicYear(payload: Partial<AcademicYear>): Promise<AcademicYear> {
    const { data } = await apiClient.post<AcademicYear>('/academics/academic-years/', payload);
    return data;
  },
  async updateAcademicYear(id: number, payload: Partial<AcademicYear>): Promise<AcademicYear> {
    const { data } = await apiClient.patch<AcademicYear>(`/academics/academic-years/${id}/`, payload);
    return data;
  },
  async deleteAcademicYear(id: number): Promise<void> {
    await apiClient.delete(`/academics/academic-years/${id}/`);
  },

  // Shifts
  async getShifts(collegeId?: number): Promise<Shift[]> {
    const params = collegeId ? { college: collegeId } : {};
    const res = await apiClient.get<PaginatedResponse<Shift> | Shift[]>('/academics/shifts/', { params });
    return extractData(res);
  },
  async createShift(payload: Partial<Shift>): Promise<Shift> {
    const { data } = await apiClient.post<Shift>('/academics/shifts/', payload);
    return data;
  },
  async updateShift(id: number, payload: Partial<Shift>): Promise<Shift> {
    const { data } = await apiClient.patch<Shift>(`/academics/shifts/${id}/`, payload);
    return data;
  },
  async deleteShift(id: number): Promise<void> {
    await apiClient.delete(`/academics/shifts/${id}/`);
  },

  // Working Days
  async getWorkingDays(collegeId?: number): Promise<WorkingDay[]> {
    const params = collegeId ? { college: collegeId } : {};
    const res = await apiClient.get<PaginatedResponse<WorkingDay> | WorkingDay[]>('/academics/working-days/', { params });
    return extractData(res);
  },
  async createWorkingDay(payload: Partial<WorkingDay>): Promise<WorkingDay> {
    const { data } = await apiClient.post<WorkingDay>('/academics/working-days/', payload);
    return data;
  },
  async updateWorkingDay(id: number, payload: Partial<WorkingDay>): Promise<WorkingDay> {
    const { data } = await apiClient.patch<WorkingDay>(`/academics/working-days/${id}/`, payload);
    return data;
  },
  async deleteWorkingDay(id: number): Promise<void> {
    await apiClient.delete(`/academics/working-days/${id}/`);
  },

  // Period Slots
  async getPeriodSlots(shiftId?: number, day?: string): Promise<PeriodSlot[]> {
    const params: Record<string, unknown> = {};
    if (shiftId) params.shift = shiftId;
    if (day) params.day_of_week = day;
    const res = await apiClient.get<PaginatedResponse<PeriodSlot> | PeriodSlot[]>('/academics/period-slots/', { params });
    return extractData(res);
  },
  async createPeriodSlot(payload: Partial<PeriodSlot>): Promise<PeriodSlot> {
    const { data } = await apiClient.post<PeriodSlot>('/academics/period-slots/', payload);
    return data;
  },
  async updatePeriodSlot(id: number, payload: Partial<PeriodSlot>): Promise<PeriodSlot> {
    const { data } = await apiClient.patch<PeriodSlot>(`/academics/period-slots/${id}/`, payload);
    return data;
  },
  async deletePeriodSlot(id: number): Promise<void> {
    await apiClient.delete(`/academics/period-slots/${id}/`);
  },

  // Departments
  async getDepartments(collegeId?: number): Promise<Department[]> {
    const params = collegeId ? { college: collegeId } : {};
    const res = await apiClient.get<PaginatedResponse<Department> | Department[]>('/academics/departments/', { params });
    return extractData(res);
  },
  async createDepartment(payload: Partial<Department>): Promise<Department> {
    const { data } = await apiClient.post<Department>('/academics/departments/', payload);
    return data;
  },
  async updateDepartment(id: number, payload: Partial<Department>): Promise<Department> {
    const { data } = await apiClient.patch<Department>(`/academics/departments/${id}/`, payload);
    return data;
  },
  async deleteDepartment(id: number): Promise<void> {
    await apiClient.delete(`/academics/departments/${id}/`);
  },

  // Semesters
  async getSemesters(deptId?: number, academicYearId?: number): Promise<Semester[]> {
    const params: Record<string, unknown> = {};
    if (deptId) params.department = deptId;
    if (academicYearId) params.academic_year = academicYearId;
    const res = await apiClient.get<PaginatedResponse<Semester> | Semester[]>('/academics/semesters/', { params });
    return extractData(res);
  },
  async createSemester(payload: Partial<Semester>): Promise<Semester> {
    const { data } = await apiClient.post<Semester>('/academics/semesters/', payload);
    return data;
  },
  async updateSemester(id: number, payload: Partial<Semester>): Promise<Semester> {
    const { data } = await apiClient.patch<Semester>(`/academics/semesters/${id}/`, payload);
    return data;
  },
  async deleteSemester(id: number): Promise<void> {
    await apiClient.delete(`/academics/semesters/${id}/`);
  },

  // Sections
  async getSections(semesterId?: number): Promise<Section[]> {
    const params = semesterId ? { semester: semesterId } : {};
    const res = await apiClient.get<PaginatedResponse<Section> | Section[]>('/academics/sections/', { params });
    return extractData(res);
  },
  async createSection(payload: Partial<Section>): Promise<Section> {
    const { data } = await apiClient.post<Section>('/academics/sections/', payload);
    return data;
  },
  async updateSection(id: number, payload: Partial<Section>): Promise<Section> {
    const { data } = await apiClient.patch<Section>(`/academics/sections/${id}/`, payload);
    return data;
  },
  async deleteSection(id: number): Promise<void> {
    await apiClient.delete(`/academics/sections/${id}/`);
  },

  // Subjects
  async getSubjects(deptId?: number): Promise<Subject[]> {
    const params = deptId ? { department: deptId } : {};
    const res = await apiClient.get<PaginatedResponse<Subject> | Subject[]>('/academics/subjects/', { params });
    return extractData(res);
  },
  async createSubject(payload: Partial<Subject>): Promise<Subject> {
    const { data } = await apiClient.post<Subject>('/academics/subjects/', payload);
    return data;
  },
  async updateSubject(id: number, payload: Partial<Subject>): Promise<Subject> {
    const { data } = await apiClient.patch<Subject>(`/academics/subjects/${id}/`, payload);
    return data;
  },
  async deleteSubject(id: number): Promise<void> {
    await apiClient.delete(`/academics/subjects/${id}/`);
  },
};
