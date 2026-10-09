import { apiClient } from './api';
import {
  Timetable,
  TimetableEntry,
  GenerateSchedulePayload,
  GenerationResult,
  ValidationReport,
} from '../types';

export const timetableService = {
  getTimetables: async (params?: Record<string, any>): Promise<Timetable[]> => {
    const res = await apiClient.get<Timetable[] | { results: Timetable[] }>('/timetables/', { params });
    if (Array.isArray(res.data)) return res.data;
    return res.data.results || [];
  },

  getTimetable: async (id: number): Promise<Timetable> => {
    const res = await apiClient.get<Timetable>(`/timetables/${id}/`);
    return res.data;
  },

  generateSchedule: async (payload: GenerateSchedulePayload): Promise<GenerationResult> => {
    const res = await apiClient.post<GenerationResult>('/timetables/generate/', payload);
    return res.data;
  },

  getTimetableEntries: async (
    id: number,
    params?: { section?: number; faculty?: number; room?: number; day_of_week?: string }
  ): Promise<TimetableEntry[]> => {
    const res = await apiClient.get<TimetableEntry[]>(`/timetables/${id}/entries/`, { params });
    return res.data;
  },

  getConflicts: async (id: number): Promise<ValidationReport> => {
    const res = await apiClient.get<ValidationReport>(`/timetables/${id}/conflicts/`);
    return res.data;
  },

  validateDraft: async (id: number): Promise<ValidationReport> => {
    const res = await apiClient.post<ValidationReport>(`/timetables/${id}/validate/`);
    return res.data;
  },

  publishTimetable: async (id: number): Promise<Timetable> => {
    const res = await apiClient.post<Timetable>(`/timetables/${id}/publish/`);
    return res.data;
  },

  lockEntry: async (entryId: number): Promise<TimetableEntry> => {
    const res = await apiClient.post<TimetableEntry>(`/timetables/entry-records/${entryId}/lock/`);
    return res.data;
  },

  unlockEntry: async (entryId: number): Promise<TimetableEntry> => {
    const res = await apiClient.post<TimetableEntry>(`/timetables/entry-records/${entryId}/unlock/`);
    return res.data;
  },
};
