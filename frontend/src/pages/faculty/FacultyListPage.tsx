import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../../services/facultyService';
import { academicsService } from '../../services/academicsService';
import { Faculty } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Eye, Users, AlertCircle, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export const FacultyListPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);

  // Form states
  const [maxDaily, setMaxDaily] = useState(4);
  const [maxWeekly, setMaxWeekly] = useState(18);
  const [designation, setDesignation] = useState('ASSISTANT_PROF');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: facultyMembers = [], isLoading } = useQuery({
    queryKey: ['faculty-list', selectedDept, selectedDesignation],
    queryFn: () =>
      facultyService.getFaculty({
        department: selectedDept || undefined,
        designation: selectedDesignation || undefined,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Faculty>) => {
      if (!editingFaculty) return;
      return facultyService.updateFaculty(editingFaculty.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to update faculty configuration.';
      setFormError(msg);
    },
  });

  const openEditModal = (faculty: Faculty) => {
    setEditingFaculty(faculty);
    setMaxDaily(faculty.max_daily_periods);
    setMaxWeekly(faculty.max_weekly_periods);
    setDesignation(faculty.designation);
    setIsActive(faculty.is_active);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingFaculty(null);
    setFormError(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (maxDaily > maxWeekly) {
      setFormError('Max daily periods cannot exceed max weekly periods.');
      return;
    }
    updateMutation.mutate({
      max_daily_periods: maxDaily,
      max_weekly_periods: maxWeekly,
      designation,
      is_active: isActive,
    });
  };

  const activeCount = facultyMembers.filter((f) => f.is_active).length;

  const columns: Column<Faculty>[] = [
    {
      header: 'Employee ID',
      accessorKey: 'employee_id',
      className: 'font-mono text-xs font-semibold text-brand-600 dark:text-brand-400',
    },
    {
      header: 'Name',
      cell: (f: Faculty) => {
        const u = f.user_details;
        const name = u ? `${u.first_name} ${u.last_name}`.trim() || u.username : 'Unknown';
        return (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-white">{name}</span>
            <span className="text-xs text-slate-500">{u?.email}</span>
          </div>
        );
      },
    },
    {
      header: 'Department',
      cell: (f: Faculty) => (
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {f.department_code || f.department_name}
        </span>
      ),
    },
    {
      header: 'Designation',
      cell: (f: Faculty) => <span>{f.designation_display || f.designation}</span>,
    },
    {
      header: 'Workload (Assigned / Max)',
      cell: (f: Faculty) => {
        const assigned = f.current_weekly_load || 0;
        const max = f.max_weekly_periods;
        const isFull = assigned >= max;
        const isNear = assigned >= max - 2 && !isFull;
        const variant = isFull ? 'danger' : isNear ? 'warning' : 'success';

        return (
          <div className="flex items-center gap-2">
            <Badge variant={variant}>
              {assigned} / {max} periods/wk
            </Badge>
            <span className="text-xs text-slate-500">(Max daily: {f.max_daily_periods})</span>
          </div>
        );
      },
    },
    {
      header: 'Status',
      cell: (f: Faculty) => (
        <Badge variant={f.is_active ? 'success' : 'slate'}>
          {f.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (f: Faculty) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/faculty/availability?faculty=${f.id}`}
            className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View & Edit Availability Matrix"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {isAdmin && (
            <button
              onClick={() => openEditModal(f)}
              className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit Workload Limits"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-600" />
            Faculty Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View instructor profiles, designations, teaching limits, and current workload allocations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/faculty/availability">
            <Button variant="outline" size="sm">
              Weekly Availability Matrix
            </Button>
          </Link>
          <Link to="/faculty/allocations">
            <Button variant="primary" size="sm">
              <BookOpen className="w-4 h-4 mr-1.5" />
              Subject Allocations
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-slate-500">Total Faculty Members</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {facultyMembers.length}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-slate-500">Active Teaching Staff</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {activeCount}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-slate-500">Departments Represented</div>
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
            {departments.length}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Filter by Department
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value={0}>All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="w-48">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Filter by Designation
          </label>
          <select
            value={selectedDesignation}
            onChange={(e) => setSelectedDesignation(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Designations</option>
            <option value="PROFESSOR">Professor</option>
            <option value="ASSOCIATE_PROF">Associate Professor</option>
            <option value="ASSISTANT_PROF">Assistant Professor</option>
            <option value="LECTURER">Lecturer</option>
            <option value="GUEST_FACULTY">Guest Faculty</option>
          </select>
        </div>
      </div>

      {/* Faculty Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          title="Faculty Directory"
          columns={columns}
          data={facultyMembers}
          isLoading={isLoading}
          searchPlaceholder="Search faculty by name or employee ID..."
        />
      </div>

      {/* Edit Workload Limits Modal */}
      {editingFaculty && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={`Configure Limits: ${editingFaculty.user_details?.first_name} ${editingFaculty.user_details?.last_name}`}
        >
          <form onSubmit={handleSave} className="space-y-4">
            {formError && (
              <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designation
              </label>
              <select
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="PROFESSOR">Professor</option>
                <option value="ASSOCIATE_PROF">Associate Professor</option>
                <option value="ASSISTANT_PROF">Assistant Professor</option>
                <option value="LECTURER">Lecturer</option>
                <option value="GUEST_FACULTY">Guest Faculty</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Daily Teaching Periods
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={maxDaily}
                  onChange={(e) => setMaxDaily(Number(e.target.value))}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Weekly Teaching Periods
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxWeekly}
                  onChange={(e) => setMaxWeekly(Number(e.target.value))}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Active for scheduling
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
