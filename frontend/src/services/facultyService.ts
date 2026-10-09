import { apiClient } from './api';
import {
  Faculty, FacultySubjectQualification, FacultyAvailability,
  BatchAvailabilityUpdatePayload, SectionSubjectAssignment,
  FacultyWorkloadSummary, PaginatedResponse, CreateFacultyPayload
} from '../types';

function extractData<T>(res: { data: PaginatedResponse<T> | T[] }): T[] {
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data.results || [];
}

export const facultyService = {
  // Faculty Profiles
  async getFaculty(params?: {
    department?: number;
    college?: number;
    designation?: string;
    is_active?: boolean;
  }): Promise<Faculty[]> {
    const res = await apiClient.get<PaginatedResponse<Faculty> | Faculty[]>('/faculty/profiles/', { params });
    return extractData(res);
  },

  async getFacultyById(id: number): Promise<Faculty> {
    const { data } = await apiClient.get<Faculty>(`/faculty/profiles/${id}/`);
    return data;
  },

  async createFaculty(payload: CreateFacultyPayload | Partial<Faculty>): Promise<Faculty> {
    const { data } = await apiClient.post<Faculty>('/faculty/profiles/', payload);
    return data;
  },

  async updateFaculty(id: number, payload: Partial<Faculty>): Promise<Faculty> {
    const { data } = await apiClient.patch<Faculty>(`/faculty/profiles/${id}/`, payload);
    return data;
  },

  async deleteFaculty(id: number): Promise<void> {
    await apiClient.delete(`/faculty/profiles/${id}/`);
  },

  async getFacultyWorkload(id: number): Promise<FacultyWorkloadSummary> {
    const { data } = await apiClient.get<FacultyWorkloadSummary>(`/faculty/profiles/${id}/workload/`);
    return data;
  },

  // Qualifications
  async getQualifications(params?: {
    faculty?: number;
    subject?: number;
    department?: number;
  }): Promise<FacultySubjectQualification[]> {
    const res = await apiClient.get<PaginatedResponse<FacultySubjectQualification> | FacultySubjectQualification[]>(
      '/faculty/qualifications/',
      { params }
    );
    return extractData(res);
  },

  async createQualification(payload: {
    faculty: number;
    subject: number;
    preference_level?: number;
  }): Promise<FacultySubjectQualification> {
    const { data } = await apiClient.post<FacultySubjectQualification>('/faculty/qualifications/', payload);
    return data;
  },

  async updateQualification(
    id: number,
    payload: { preference_level?: number }
  ): Promise<FacultySubjectQualification> {
    const { data } = await apiClient.patch<FacultySubjectQualification>(`/faculty/qualifications/${id}/`, payload);
    return data;
  },

  async deleteQualification(id: number): Promise<void> {
    await apiClient.delete(`/faculty/qualifications/${id}/`);
  },

  // Availability
  async getAvailabilities(params?: {
    faculty?: number;
    shift?: number;
    day_of_week?: string;
    is_available?: boolean;
  }): Promise<FacultyAvailability[]> {
    const res = await apiClient.get<PaginatedResponse<FacultyAvailability> | FacultyAvailability[]>(
      '/faculty/availability/',
      { params }
    );
    return extractData(res);
  },

  async updateAvailability(
    id: number,
    payload: Partial<FacultyAvailability>
  ): Promise<FacultyAvailability> {
    const { data } = await apiClient.patch<FacultyAvailability>(`/faculty/availability/${id}/`, payload);
    return data;
  },

  async batchUpdateAvailability(
    payload: BatchAvailabilityUpdatePayload
  ): Promise<FacultyAvailability[]> {
    const { data } = await apiClient.post<FacultyAvailability[]>(
      '/faculty/availability/batch-update/',
      payload
    );
    return data;
  },

  // Section Subject Assignments
  async getAssignments(params?: {
    section?: number;
    subject?: number;
    faculty?: number;
    department?: number;
    semester?: number;
    academic_year?: number;
  }): Promise<SectionSubjectAssignment[]> {
    const res = await apiClient.get<PaginatedResponse<SectionSubjectAssignment> | SectionSubjectAssignment[]>(
      '/faculty/assignments/',
      { params }
    );
    return extractData(res);
  },

  async createAssignment(payload: {
    section: number;
    subject: number;
    faculty: number;
    is_primary?: boolean;
  }): Promise<SectionSubjectAssignment> {
    const { data } = await apiClient.post<SectionSubjectAssignment>('/faculty/assignments/', payload);
    return data;
  },

  async updateAssignment(
    id: number,
    payload: Partial<SectionSubjectAssignment>
  ): Promise<SectionSubjectAssignment> {
    const { data } = await apiClient.patch<SectionSubjectAssignment>(`/faculty/assignments/${id}/`, payload);
    return data;
  },

  async deleteAssignment(id: number): Promise<void> {
    await apiClient.delete(`/faculty/assignments/${id}/`);
  },
};
