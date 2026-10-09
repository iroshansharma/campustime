import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FacultyListPage } from '../FacultyListPage';
import * as AuthContextModule from '../../../context/AuthContext';
import { facultyService } from '../../../services/facultyService';
import { academicsService } from '../../../services/academicsService';
import { Faculty, Department } from '../../../types';

vi.mock('../../../services/facultyService');
vi.mock('../../../services/academicsService');

describe('FacultyListPage', () => {
  let queryClient: QueryClient;

  const mockFaculty: Faculty = {
    id: 1,
    user: 10,
    user_details: {
      id: 10,
      username: 'aturing',
      email: 'turing@tech.edu',
      first_name: 'Alan',
      last_name: 'Turing',
    },
    employee_id: 'EMP-001',
    department: 1,
    department_code: 'CSE',
    designation: 'PROFESSOR',
    max_weekly_periods: 18,
    max_daily_periods: 4,
    is_active: true,
    current_weekly_load: 8,
  };

  const mockDepartment: Department = {
    id: 1,
    college: 1,
    name: 'Computer Science and Engineering',
    code: 'CSE',
    is_active: true,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@tech.edu',
        first_name: 'Admin',
        last_name: 'User',
        role: 'ADMIN',
        is_verified: true,
        is_staff: true,
      },
      loading: false,
      isAuthenticated: true,
      isAdmin: true,
      isFaculty: false,
      isStudent: false,
      role: 'ADMIN',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(facultyService.getFaculty).mockResolvedValue([mockFaculty]);
    vi.mocked(academicsService.getDepartments).mockResolvedValue([mockDepartment]);
    vi.mocked(facultyService.createFaculty).mockResolvedValue({
      ...mockFaculty,
      id: 2,
      employee_id: 'EMP-002',
      user_details: {
        id: 11,
        username: 'ghopper',
        email: 'hopper@tech.edu',
        first_name: 'Grace',
        last_name: 'Hopper',
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FacultyListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders faculty list and Add Faculty button for admin', async () => {
    renderComponent();

    expect(await screen.findByText('Faculty Management')).toBeInTheDocument();
    expect(await screen.findByText('Add Faculty')).toBeInTheDocument();
    expect(await screen.findByText('Alan Turing')).toBeInTheDocument();
    expect(await screen.findByText('EMP-001')).toBeInTheDocument();
  });

  it('hides Add Faculty button for non-admin users', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 2,
        username: 'faculty1',
        email: 'faculty@tech.edu',
        first_name: 'Faculty',
        last_name: 'Member',
        role: 'FACULTY',
        is_verified: true,
        is_staff: false,
      },
      loading: false,
      isAuthenticated: true,
      isAdmin: false,
      isFaculty: true,
      isStudent: false,
      role: 'FACULTY',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderComponent();

    expect(await screen.findByText('Faculty Management')).toBeInTheDocument();
    expect(screen.queryByText('Add Faculty')).not.toBeInTheDocument();
  });

  it('opens Add Faculty modal when clicking Add Faculty button', async () => {
    renderComponent();

    const addButton = await screen.findByRole('button', { name: /add faculty/i });
    fireEvent.click(addButton);

    expect(await screen.findByRole('heading', { name: 'Add New Faculty Member' })).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Employee ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Department \*/i)).toBeInTheDocument();
  });

  it('validates required fields in Add Faculty form', async () => {
    renderComponent();

    const addButton = await screen.findByRole('button', { name: /add faculty/i });
    fireEvent.click(addButton);

    expect(await screen.findByRole('heading', { name: 'Add New Faculty Member' })).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /create faculty/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText(/first name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/email address is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/employee id \/ faculty code is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/department is required/i)).toBeInTheDocument();
    expect(facultyService.createFaculty).not.toHaveBeenCalled();
  });

  it('submits valid faculty form and calls facultyService.createFaculty', async () => {
    renderComponent();

    const addButton = await screen.findByRole('button', { name: /add faculty/i });
    fireEvent.click(addButton);

    expect(await screen.findByRole('heading', { name: 'Add New Faculty Member' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Hopper' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'hopper@tech.edu' } });
    fireEvent.change(screen.getByLabelText(/Employee ID/i), { target: { value: 'EMP-002' } });
    fireEvent.change(screen.getByLabelText(/^Department \*/i), { target: { value: '1' } });

    const submitButton = screen.getByRole('button', { name: /create faculty/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(facultyService.createFaculty).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Grace',
          last_name: 'Hopper',
          email: 'hopper@tech.edu',
          employee_id: 'EMP-002',
          department: 1,
          designation: 'ASSISTANT_PROF',
        })
      );
    });

    expect(await screen.findByText(/was created successfully/i)).toBeInTheDocument();
  });

  it('displays API error message when faculty creation fails', async () => {
    vi.mocked(facultyService.createFaculty).mockRejectedValueOnce({
      response: {
        data: {
          employee_id: ['Faculty with this employee id already exists.'],
        },
      },
    });

    renderComponent();

    const addButton = await screen.findByRole('button', { name: /add faculty/i });
    fireEvent.click(addButton);

    expect(await screen.findByRole('heading', { name: 'Add New Faculty Member' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Hopper' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'hopper@tech.edu' } });
    fireEvent.change(screen.getByLabelText(/Employee ID/i), { target: { value: 'EMP-001' } });
    fireEvent.change(screen.getByLabelText(/^Department \*/i), { target: { value: '1' } });

    const submitButton = screen.getByRole('button', { name: /create faculty/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Faculty with this employee id already exists/i)
      ).toBeInTheDocument();
    });
  });
});
