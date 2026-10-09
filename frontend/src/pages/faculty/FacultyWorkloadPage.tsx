import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { facultyService } from '../../services/facultyService';
import { academicsService } from '../../services/academicsService';
import { Faculty } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Activity, Eye } from 'lucide-react';

export const FacultyWorkloadPage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [workloadFacultyId, setWorkloadFacultyId] = useState<number | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: facultyMembers = [], isLoading } = useQuery({
    queryKey: ['faculty-workload-overview', selectedDept],
    queryFn: () => facultyService.getFaculty({ department: selectedDept || undefined }),
  });

  // Fetch detailed workload summary when an instructor is selected
  const { data: workloadDetail, isLoading: workloadLoading } = useQuery({
    queryKey: ['faculty-workload-detail', workloadFacultyId],
    queryFn: () => (workloadFacultyId ? facultyService.getFacultyWorkload(workloadFacultyId) : null),
    enabled: !!workloadFacultyId,
  });

  const totalAssignedPeriods = facultyMembers.reduce(
    (sum, f) => sum + (f.current_weekly_load || 0),
    0
  );
  const totalMaxPeriods = facultyMembers.reduce(
    (sum, f) => sum + f.max_weekly_periods,
    0
  );
  const avgUtilization =
    totalMaxPeriods > 0 ? Math.round((totalAssignedPeriods / totalMaxPeriods) * 100) : 0;

  const columns: Column<Faculty>[] = [
    {
      header: 'Employee ID',
      accessorKey: 'employee_id',
      className: 'font-mono text-xs font-semibold text-brand-600 dark:text-brand-400',
    },
    {
      header: 'Name',
      cell: (f: Faculty) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">
            {f.user_details ? `${f.user_details.first_name} ${f.user_details.last_name}`.trim() : 'Unknown'}
          </span>
          <span className="text-xs text-slate-500">{f.designation_display || f.designation}</span>
        </div>
      ),
    },
    {
      header: 'Department',
      cell: (f: Faculty) => <span>{f.department_code || f.department_name}</span>,
    },
    {
      header: 'Load Utilization',
      cell: (f: Faculty) => {
        const assigned = f.current_weekly_load || 0;
        const max = f.max_weekly_periods;
        const percent = Math.min(100, Math.round((assigned / max) * 100));
        const isExceeded = assigned > max;
        const isFull = assigned === max;

        return (
          <div className="w-48 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {assigned} / {max} periods
              </span>
              <span
                className={`font-bold ${
                  isExceeded
                    ? 'text-rose-600'
                    : isFull
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {percent}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isExceeded
                    ? 'bg-rose-500'
                    : isFull
                    ? 'bg-amber-500'
                    : percent > 60
                    ? 'bg-brand-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Remaining Capacity',
      cell: (f: Faculty) => {
        const remaining = Math.max(0, f.max_weekly_periods - (f.current_weekly_load || 0));
        return (
          <Badge variant={remaining === 0 ? 'warning' : 'success'}>
            {remaining} periods free
          </Badge>
        );
      },
    },
    {
      header: 'Daily Max',
      cell: (f: Faculty) => <span>{f.max_daily_periods} periods/day</span>,
    },
    {
      header: 'Actions',
      cell: (f: Faculty) => (
        <button
          onClick={() => setWorkloadFacultyId(f.id)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Breakdown
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-600" />
            Faculty Workload Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor teacher teaching capacity, workload distribution, and assigned teaching responsibilities.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Allocated Teaching Periods</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {totalAssignedPeriods}{' '}
            <span className="text-xs font-normal text-slate-500">/ {totalMaxPeriods} capacity</span>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Average Capacity Utilization</div>
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
            {avgUtilization}%
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Faculty Members Tracked</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {facultyMembers.length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex items-center gap-4">
        <div className="w-64">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Filter by Department
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value={0}>All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          title="Teaching Capacity Overview"
          columns={columns}
          data={facultyMembers}
          isLoading={isLoading}
          searchPlaceholder="Search instructors by name or employee ID..."
        />
      </div>

      {/* Detailed Workload Breakdown Modal */}
      {workloadFacultyId && (
        <Modal
          isOpen={!!workloadFacultyId}
          onClose={() => setWorkloadFacultyId(null)}
          title={`Workload Breakdown: ${workloadDetail?.faculty_name || 'Loading...'}`}
        >
          {workloadLoading || !workloadDetail ? (
            <div className="p-8 text-center text-slate-500">Loading assignments...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500">Employee ID:</span>{' '}
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {workloadDetail.employee_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Department:</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {workloadDetail.department_code}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Weekly Load:</span>{' '}
                  <span className="font-bold text-brand-600">
                    {workloadDetail.current_weekly_load} / {workloadDetail.max_weekly_periods} periods
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Daily Max:</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {workloadDetail.max_daily_periods} periods/day
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Assigned Sections & Subjects ({workloadDetail.assignments.length})
                </h4>

                {workloadDetail.assignments.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    No active section-subject teaching assignments for this instructor.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border rounded-lg overflow-hidden">
                    {workloadDetail.assignments.map((item) => (
                      <div key={item.id} className="p-3 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.subject_name}
                          </div>
                          <div className="text-slate-500">
                            Section {item.section_name} •{' '}
                            <span className="font-mono text-brand-600">{item.subject_code}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.weekly_periods} periods/wk
                          </span>
                          <div>
                            {item.is_primary ? (
                              <Badge variant="success">
                                Lead Instructor
                              </Badge>
                            ) : (
                              <Badge variant="slate">
                                Co-Instructor
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setWorkloadFacultyId(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
