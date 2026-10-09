import { apiClient } from './api';
import { Room, PaginatedResponse } from '../types';

function extractData<T>(res: { data: PaginatedResponse<T> | T[] }): T[] {
  if (Array.isArray(res.data)) {
    return res.data;
  }
  return res.data.results || [];
}

export const roomsService = {
  async getRooms(params?: {
    college?: number;
    department?: number;
    room_type?: string;
    min_capacity?: number;
    is_active?: boolean;
  }): Promise<Room[]> {
    const res = await apiClient.get<PaginatedResponse<Room> | Room[]>('/rooms/rooms/', { params });
    return extractData(res);
  },

  async createRoom(payload: Partial<Room>): Promise<Room> {
    const { data } = await apiClient.post<Room>('/rooms/rooms/', payload);
    return data;
  },

  async updateRoom(id: number, payload: Partial<Room>): Promise<Room> {
    const { data } = await apiClient.patch<Room>(`/rooms/rooms/${id}/`, payload);
    return data;
  },

  async deleteRoom(id: number): Promise<void> {
    await apiClient.delete(`/rooms/rooms/${id}/`);
  },
};
