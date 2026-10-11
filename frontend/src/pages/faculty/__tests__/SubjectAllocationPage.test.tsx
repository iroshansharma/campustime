import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SubjectAllocationPage } from '../SubjectAllocationPage';
import { academicsService } from '../../../services/academicsService';
import { facultyService } from '../../../services/facultyService';
import { roomsService } from '../../../services/roomsService';
import {
  AcademicYear, Department, Shift, Semester, Section,
  Subject, Faculty, FacultySubjectQualification, Room
} from '../../../types';

vi.mock('../../../services/academicsService');
vi.mock('../../../services/facultyService');
vi.mock('../../../services/roomsService');

describe('SubjectAllocationPage', () => {
  let queryClient: QueryClient;

  const mockAY: AcademicYear = {
    id: 1,
    college: 1,
    name: '2024-2025',
    start_date: '2024-08-01',
    end_date: '2025-05-31',
    is_current: true,
  };

  const mockDept: Department = {
    id: 1,
    college: 1,
    name: 'Computer Science',
    code: 'CSE',
    is_active: true,
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

  const mockSemester: Semester = {
    id: 1,
    academic_year: 1,
    department: 1,
    semester_number: 1,
    shift: 1,
    is_active: true,
  };

  const mockSection: Section = {
    id: 10,
    semester: 1,
    name: 'A',
    student_count: 50,
  };

  const mockSubjects: Subject[] = [
    {
      id: 101,
      department: 1,
      code: 'CS101',
      name: 'Data Structures',
      subject_type: 'THEORY',
      credits: 4,
      weekly_periods: 4,
      consecutive_slots: 1,
    },
    {
      id: 102,
      department: 1,
      code: 'CS102',
      name: 'Data Structures Lab',
      subject_type: 'LAB',
      credits: 2,
      weekly_periods: 2,
      consecutive_slots: 2,
    },
  ];

  const mockFaculty: Faculty = {
    id: 201,
    user: 1,
    user_details: {
      id: 1,
      username: 'ghopper',
      email: 'grace@tech.edu',
      first_name: 'Grace',
      last_name: 'Hopper',
    },
    employee_id: 'EMP-002',
    department: 1,
    department_code: 'CSE',
    designation: 'PROFESSOR',
    max_weekly_periods: 16,
    max_daily_periods: 4,
    is_active: true,
    current_weekly_load: 6,
  };

  const mockQualifications: FacultySubjectQualification[] = [
    {
      id: 301,
      faculty: 201,
      subject: 101,
      preference_level: 5,
    },
  ];

  const mockRooms: Room[] = [
    {
      id: 1,
      college: 1,
      name: 'Lecture Hall 101',
      code: 'LH-101',
      room_type: 'CLASSROOM',
      capacity: 60,
      is_active: true,
    },
    {
      id: 2,
      college: 1,
      name: 'Computer Lab 1',
      code: 'CL-1',
      room_type: 'LAB',
      capacity: 55,
      is_active: true,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(academicsService.getAcademicYears).mockResolvedValue([mockAY]);
    vi.mocked(academicsService.getDepartments).mockResolvedValue([mockDept]);
    vi.mocked(academicsService.getShifts).mockResolvedValue([mockShift]);
    vi.mocked(academicsService.getSemesters).mockResolvedValue([mockSemester]);
    vi.mocked(academicsService.getSections).mockResolvedValue([mockSection]);
    vi.mocked(academicsService.getSubjects).mockResolvedValue(mockSubjects);
    vi.mocked(facultyService.getFaculty).mockResolvedValue([mockFaculty]);
    vi.mocked(facultyService.getQualifications).mockResolvedValue(mockQualifications);
    vi.mocked(facultyService.getAssignments).mockResolvedValue([]);
    vi.mocked(roomsService.getRooms).mockResolvedValue(mockRooms);
    vi.mocked(facultyService.createAssignment).mockResolvedValue({
      id: 999,
      section: 10,
      subject: 101,
      faculty: 201,
      is_primary: true,
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SubjectAllocationPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders allocation page with section context and curriculum subjects', async () => {
    renderComponent();

    expect(
      await screen.findByText('Subject–Teacher–Section Allocation')
    ).toBeInTheDocument();
    expect(await screen.findByText('Data Structures')).toBeInTheDocument();
    expect(await screen.findByText('Data Structures Lab')).toBeInTheDocument();
    expect(await screen.findByText('Room Capacity Feasibility')).toBeInTheDocument();
    expect(await screen.findByText(/Classrooms \(Capacity ≥ 50\):/i)).toBeInTheDocument();
    expect(await screen.findByText(/Labs \(Capacity ≥ 50\):/i)).toBeInTheDocument();
  });

  it('identifies unassigned subjects and displays warning status', async () => {
    renderComponent();

    expect(
      await screen.findByText(/2 Unassigned Subjects/i)
    ).toBeInTheDocument();
  });

  it('opens assignment modal and allows allocating qualified instructor', async () => {
    renderComponent();

    // Click assign button for first subject
    const assignButtons = await screen.findAllByRole('button', { name: /Assign Teacher/i });
    fireEvent.click(assignButtons[0]);

    // Modal should open
    expect(
      await screen.findByText(/Assign Teacher: Data Structures \(CS101\)/i)
    ).toBeInTheDocument();

    // Qualified instructor should be selected and workload projected
    expect(await screen.findByText(/Within capacity limits/i)).toBeInTheDocument();

    // Submit assignment
    const submitButton = screen.getByRole('button', { name: /Confirm Assignment/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(facultyService.createAssignment).toHaveBeenCalledWith({
        section: 10,
        subject: 101,
        faculty: 201,
        is_primary: true,
      });
    });
  });
});
