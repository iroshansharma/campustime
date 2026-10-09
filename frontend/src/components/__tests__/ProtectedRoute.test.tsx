import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute, FacultyRoute, StudentRoute } from '../common/ProtectedRoute';
import * as AuthContextModule from '../../context/AuthContext';

describe('Route Guards', () => {
  const mockAuth = (overrides = {}) => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      isAuthenticated: false,
      isAdmin: false,
      isFaculty: false,
      isStudent: false,
      role: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      ...overrides,
    });
  };

  it('ProtectedRoute redirects unauthenticated users to /login', () => {
    mockAuth({ isAuthenticated: false, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Private Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('ProtectedRoute renders content for authenticated users', () => {
    mockAuth({ isAuthenticated: true, loading: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Private Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Private Content')).toBeInTheDocument();
  });

  it('AdminRoute redirects non-admin authenticated users to /unauthorized', () => {
    mockAuth({ isAuthenticated: true, isAdmin: false, isFaculty: true, loading: false });

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <AdminRoute>
                <div>Admin Secret</div>
              </AdminRoute>
            }
          />
          <Route path="/unauthorized" element={<div>Access Restricted</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
  });

  it('AdminRoute renders content for admin users', () => {
    mockAuth({ isAuthenticated: true, isAdmin: true, loading: false });

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route
            path="/admin-only"
            element={
              <AdminRoute>
                <div>Admin Secret</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Secret')).toBeInTheDocument();
  });

  it('FacultyRoute allows faculty and admin users', () => {
    mockAuth({ isAuthenticated: true, isFaculty: true, isAdmin: false, loading: false });

    render(
      <MemoryRouter initialEntries={['/faculty']}>
        <Routes>
          <Route
            path="/faculty"
            element={
              <FacultyRoute>
                <div>Faculty Schedule</div>
              </FacultyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Faculty Schedule')).toBeInTheDocument();
  });

  it('StudentRoute allows student and admin users', () => {
    mockAuth({ isAuthenticated: true, isStudent: true, isAdmin: false, loading: false });

    render(
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route
            path="/student"
            element={
              <StudentRoute>
                <div>Student Timetable</div>
              </StudentRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Student Timetable')).toBeInTheDocument();
  });
});
