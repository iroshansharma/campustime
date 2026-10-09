import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimetableGenerationPage } from '../TimetableGenerationPage';
import { academicsService } from '../../../services/academicsService';
import { timetableService } from '../../../services/timetableService';
import { AcademicYear, Shift, Department, GenerationResult, Timetable } from '../../../types';

vi.mock('../../../services/academicsService');
vi.mock('../../../services/timetableService');

describe('TimetableGenerationPage', () => {
  let queryClient: QueryClient;

  const mockAcademicYears: AcademicYear[] = [
    {
      id: 1,
      college: 1,
      name: '2024-25',
      start_date: '2024-08-01',
      end_date: '2025-05-31',
      is_current: true,
    },
  ];

  const mockShifts: Shift[] = [
    {
      id: 1,
      college: 1,
      name: 'Morning Shift',
      code: 'M1',
      start_time: '09:00:00',
      end_time: '15:00:00',
      is_active: true,
    },
  ];

  const mockDepartments: Department[] = [
    {
      id: 1,
      college: 1,
      name: 'Computer Science',
      code: 'CSE',
      is_active: true,
    },
  ];

  const mockTimetable: Timetable = {
    id: 10,
    academic_year: 1,
    academic_year_name: '2024-25',
    shift: 1,
    shift_name: 'Morning Shift',
    name: 'Odd Sem CSE Schedule',
    status: 'DRAFT',
    status_display: 'Draft',
    version: 1,
    entries_count: 8,
    created_at: '2024-08-10T10:00:00Z',
    updated_at: '2024-08-10T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.mocked(academicsService.getAcademicYears).mockResolvedValue(mockAcademicYears);
    vi.mocked(academicsService.getShifts).mockResolvedValue(mockShifts);
    vi.mocked(academicsService.getDepartments).mockResolvedValue(mockDepartments);
    vi.mocked(academicsService.getSemesters).mockResolvedValue([]);
    vi.mocked(academicsService.getSections).mockResolvedValue([]);
    vi.mocked(academicsService.getPeriodSlots).mockResolvedValue([]);
    vi.mocked(timetableService.getTimetable).mockResolvedValue(mockTimetable);
    vi.mocked(timetableService.getTimetableEntries).mockResolvedValue([]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TimetableGenerationPage />
      </QueryClientProvider>
    );

  it('renders scope selection form and generation controls', async () => {
    renderComponent();

    expect(screen.getByText('Automatic Timetable Generation')).toBeInTheDocument();
    expect(screen.getByText('1. Academic Scope Selection')).toBeInTheDocument();
    expect(screen.getByText('2. Engine Optimization')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('2024-25 (Current)')).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole('button', { name: /generate timetable/i });
    expect(generateBtn).toBeDisabled(); // Disabled until academic year is picked
  });

  it('triggers generation mutation and displays success metrics', async () => {
    const successResult: GenerationResult = {
      success: true,
      status: 'SUCCESS',
      message: 'Valid optimal timetable schedule generated successfully.',
      timetable_id: 10,
      sessions_required: 8,
      sessions_scheduled: 8,
      backtracks_count: 3,
      duration_seconds: 0.12,
      nodes_explored: 12,
      bottlenecks: [],
      validation_report: {
        is_valid: true,
        total_conflicts: 0,
        hard_constraint_violations: 0,
        sessions_required: 8,
        sessions_scheduled: 8,
        summary: 'Validation passed: 0 conflicts detected.',
        conflicts: [],
      },
    };

    vi.mocked(timetableService.generateSchedule).mockResolvedValue(successResult);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2024-25 (Current)')).toBeInTheDocument();
    });

    // Select Academic Year
    const aySelect = screen.getByLabelText('Academic Year');
    fireEvent.change(aySelect, { target: { value: '1' } });

    const generateBtn = screen.getByRole('button', { name: /generate timetable/i });
    expect(generateBtn).not.toBeDisabled();

    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Generation Succeeded')).toBeInTheDocument();
      expect(screen.getByText('Valid optimal timetable schedule generated successfully.')).toBeInTheDocument();
      expect(screen.getByText('Sessions Required')).toBeInTheDocument();
      expect(screen.getByText('Sessions Scheduled')).toBeInTheDocument();
    });
  });

  it('renders conflict diagnostics panel when generation reports bottlenecks', async () => {
    const failureResult: GenerationResult = {
      success: false,
      status: 'INFEASIBLE',
      message: 'Initial infeasibility detected: Session has 0 valid placements.',
      sessions_required: 8,
      sessions_scheduled: 0,
      backtracks_count: 0,
      duration_seconds: 0.05,
      nodes_explored: 0,
      bottlenecks: [
        {
          category: 'ROOM_CAPACITY',
          summary: 'No classroom in inventory has sufficient capacity for Section CSE-3A.',
          affected_entity: 'Section CSE-3A',
          suggested_action: 'Add a larger classroom or reduce section student batch size.',
        },
      ],
      validation_report: null,
    };

    vi.mocked(timetableService.generateSchedule).mockResolvedValue(failureResult);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2024-25 (Current)')).toBeInTheDocument();
    });

    const aySelect = screen.getByLabelText('Academic Year');
    fireEvent.change(aySelect, { target: { value: '1' } });

    const generateBtn = screen.getByRole('button', { name: /generate timetable/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByText('Generation INFEASIBLE')).toBeInTheDocument();
      expect(screen.getByText('Operational Bottlenecks & Recommendations')).toBeInTheDocument();
      expect(screen.getByText('ROOM_CAPACITY')).toBeInTheDocument();
      expect(
        screen.getByText(/No classroom in inventory has sufficient capacity/i)
      ).toBeInTheDocument();
    });
  });
});
