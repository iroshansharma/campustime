import { apiClient, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './api';
import { User, AuthTokens } from '../types';

export const authService = {
  async login(username: string, password: string):Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>('/auth/token/', {
      username,
      password,
    });
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<User>('/auth/me/');
    return data;
  },

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  hasTokens(): boolean {
    return !!localStorage.getItem(ACCESS_TOKEN_KEY);
  },
};
