import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MySchedulePage } from '../MySchedulePage';
import { timetableService } from '../../../services/timetableService';
import * as AuthContextModule from '../../../context/AuthContext';

vi.mock('../../../services/timetableService');

describe('MySchedulePage', () => {
  let queryClient: QueryClient;

  const mockUser = {
    id: 5,
    username: 'student_jim',
    email: 'jim@adgips.edu',
    first_name: 'Jim',
    last_name: 'Halpert',
    role: 'STUDENT' as const,
    is_verified: true,
    is_staff: false,
    student_profile: {
      id: 1,
      enrollment_number: 'STU001',
      section_id: 10,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      role: 'STUDENT',
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      isAdmin: false,
      isFaculty: false,
      isStudent: true,
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MySchedulePage />
      </QueryClientProvider>
    );

  it('renders empty-state message when no timetable is published', async () => {
    vi.mocked(timetableService.getMySchedule).mockResolvedValue({
      has_schedule: false,
      message: 'No published timetable is currently available for your section.',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No Published Timetable Available')).toBeInTheDocument();
      expect(
        screen.getByText('No published timetable is currently available for your section.')
      ).toBeInTheDocument();
    });
  });

  it('renders schedule cards with class entries for student when timetable is published', async () => {
    vi.mocked(timetableService.getMySchedule).mockResolvedValue({
      has_schedule: true,
      role: 'STUDENT',
      section_name: 'CSE-3A',
      timetable: {
        id: 1,
        name: 'Odd Semester 2024-25',
        version: 1,
        academic_year_name: '2024-25',
        shift_name: 'Morning Shift',
      },
      entries: [
        {
          id: 101,
          timetable: 1,
          section: 10,
          section_name: 'CSE-3A',
          subject: 1,
          subject_code: 'CS301',
          subject_name: 'Data Structures',
          subject_type: 'THEORY',
          faculty: 2,
          faculty_name: 'Alice Walker',
          room: 1,
          room_code: 'C101',
          period_slot: 1,
          period_number: 1,
          start_time: '09:00:00',
          end_time: '10:00:00',
          day_of_week: 'MON',
          is_locked: false,
        },
      ],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('My Weekly Schedule')).toBeInTheDocument();
      expect(screen.getByText('Odd Semester 2024-25')).toBeInTheDocument();
      expect(screen.getByText('CS301')).toBeInTheDocument();
      expect(screen.getByText('Data Structures')).toBeInTheDocument();
      expect(screen.getByText('Alice Walker')).toBeInTheDocument();
      expect(screen.getByText('C101')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download official pdf/i })).toBeInTheDocument();
    });
  });

  it('triggers PDF export download when download button is clicked', async () => {
    const fakeBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    vi.mocked(timetableService.exportPdf).mockResolvedValue(fakeBlob);
    vi.mocked(timetableService.getMySchedule).mockResolvedValue({
      has_schedule: true,
      role: 'STUDENT',
      section_name: 'CSE-3A',
      timetable: {
        id: 1,
        name: 'Odd Semester 2024-25',
        version: 1,
      },
      entries: [
        {
          id: 101,
          timetable: 1,
          section: 10,
          subject: 1,
          subject_code: 'CS301',
          day_of_week: 'MON',
          period_number: 1,
        },
      ],
    });

    // Mock createObjectURL and revokeObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    window.URL.revokeObjectURL = vi.fn();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download official pdf/i })).toBeInTheDocument();
    });

    const downloadBtn = screen.getByRole('button', { name: /download official pdf/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(timetableService.exportPdf).toHaveBeenCalledWith(1, {
        type: 'section',
        section_id: 10,
      });
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(fakeBlob);
    });
  });
});
