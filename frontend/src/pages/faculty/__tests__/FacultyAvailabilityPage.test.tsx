import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FacultyAvailabilityPage } from '../FacultyAvailabilityPage';
import * as AuthContextModule from '../../../context/AuthContext';
import { facultyService } from '../../../services/facultyService';
import { academicsService } from '../../../services/academicsService';
import { PeriodSlot, Faculty, Shift, FacultyAvailability } from '../../../types';

vi.mock('../../../services/facultyService');
vi.mock('../../../services/academicsService');

describe('FacultyAvailabilityPage', () => {
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
    department: 2,
    department_code: 'CSE',
    designation: 'PROFESSOR',
    max_weekly_periods: 18,
    max_daily_periods: 4,
    is_active: true,
    current_weekly_load: 8,
  };

  const mockShift: Shift = {
    id: 1,
    college: 1,
    name: 'Morning Shift',
    code: 'M1',
    start_time: '09:00:00',
    end_time: '17:00:00',
    is_active: true,
  };

  const mockSlots: PeriodSlot[] = [
    {
      id: 101,
      shift: 1,
      day_of_week: 'MON',
      period_number: 1,
      start_time: '09:00:00',
      end_time: '10:00:00',
      is_break: false,
    },
    {
      id: 102,
      shift: 1,
      day_of_week: 'MON',
      period_number: 2,
      start_time: '10:00:00',
      end_time: '11:00:00',
      is_break: false,
    },
    {
      id: 103,
      shift: 1,
      day_of_week: 'MON',
      period_number: 3,
      start_time: '11:00:00',
      end_time: '11:30:00',
      is_break: true,
      break_label: 'Recess',
    },
  ];

  const mockAvailabilities: FacultyAvailability[] = [
    {
      id: 501,
      faculty: 1,
      period_slot: 101,
      is_available: true,
      is_preferred: false,
    },
    {
      id: 502,
      faculty: 1,
      period_slot: 102,
      is_available: false,
      is_preferred: false,
      reason: 'Research meeting',
    },
  ];

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
    vi.mocked(facultyService.getFacultyById).mockResolvedValue(mockFaculty);
    vi.mocked(academicsService.getShifts).mockResolvedValue([mockShift]);
    vi.mocked(academicsService.getPeriodSlots).mockResolvedValue(mockSlots);
    vi.mocked(facultyService.getAvailabilities).mockResolvedValue(mockAvailabilities);
    vi.mocked(facultyService.batchUpdateAvailability).mockResolvedValue(mockAvailabilities);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FacultyAvailabilityPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders weekly availability matrix and header controls', async () => {
    renderComponent();

    expect(await screen.findByText('Weekly Faculty Availability Matrix')).toBeInTheDocument();
    expect(await screen.findByText('Monday')).toBeInTheDocument();
    expect(await screen.findByText('Period 1')).toBeInTheDocument();
    expect(await screen.findByText('Recess')).toBeInTheDocument();
  });

  it('toggles slot state and triggers unsaved changes banner', async () => {
    renderComponent();

    // Find Period 1 button for Monday
    const p1Button = await screen.findByTitle('Available Slot (Click to make Preferred)');
    expect(p1Button).toBeInTheDocument();

    // Click slot to make it Preferred
    fireEvent.click(p1Button);

    // Unsaved changes banner should appear
    expect(
      await screen.findByText(/You have unsaved changes in the availability matrix/i)
    ).toBeInTheDocument();

    // Slot title should now be preferred
    expect(screen.getByTitle('Preferred Slot (Click to Block)')).toBeInTheDocument();
  });

  it('resets unsaved changes when Reset button is clicked', async () => {
    renderComponent();

    const p1Button = await screen.findByTitle('Available Slot (Click to make Preferred)');
    fireEvent.click(p1Button);

    expect(await screen.findByText(/You have unsaved changes/i)).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();
    });
  });

  it('handles batch save successfully', async () => {
    renderComponent();

    const p1Button = await screen.findByTitle('Available Slot (Click to make Preferred)');
    fireEvent.click(p1Button);

    const saveButton = screen.getByRole('button', { name: /save matrix changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(facultyService.batchUpdateAvailability).toHaveBeenCalled();
      expect(
        screen.getByText('Faculty availability matrix saved successfully.')
      ).toBeInTheDocument();
    });
  });

  it('displays API validation error when batch update fails', async () => {
    vi.mocked(facultyService.batchUpdateAvailability).mockRejectedValueOnce({
      response: {
        data: { slots: 'Cannot mark break period as available.' },
      },
    });

    renderComponent();

    const p1Button = await screen.findByTitle('Available Slot (Click to make Preferred)');
    fireEvent.click(p1Button);

    const saveButton = screen.getByRole('button', { name: /save matrix changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot mark break period as available/i)
      ).toBeInTheDocument();
    });
  });
});
