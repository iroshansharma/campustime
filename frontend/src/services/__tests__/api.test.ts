import { describe, it, expect, beforeEach } from 'vitest';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, apiClient } from '../api';

describe('API Client & Token Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly uses declared token storage keys', () => {
    expect(ACCESS_TOKEN_KEY).toBe('campustime_access_token');
    expect(REFRESH_TOKEN_KEY).toBe('campustime_refresh_token');
  });

  it('stores and retrieves access and refresh tokens', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-access-token-xyz');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'mock-refresh-token-abc');

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe('mock-access-token-xyz');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('mock-refresh-token-abc');
  });

  it('initializes apiClient with JSON Content-Type and correct baseURL default', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    expect(apiClient.defaults.baseURL).toContain('/api/v1');
  });
});
