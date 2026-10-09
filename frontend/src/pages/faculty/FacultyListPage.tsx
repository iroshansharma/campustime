import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../../services/facultyService';
import { academicsService } from '../../services/academicsService';
import { Faculty, CreateFacultyPayload, FacultyDesignation } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Eye, Users, AlertCircle, BookOpen, Plus, GraduationCap, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DESIGNATION_OPTIONS: { value: FacultyDesignation; label: string }[] = [
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'ASSOCIATE_PROF', label: 'Associate Professor' },
  { value: 'ASSISTANT_PROF', label: 'Assistant Professor' },
  { value: 'LECTURER', label: 'Lecturer' },
  { value: 'GUEST_FACULTY', label: 'Guest Faculty' },
];

export const FacultyListPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [selectedDesignation, setSelectedDesignation] = useState<string>('');

  // Create Faculty Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFacultyPayload>({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    password: '',
    employee_id: '',
    department: 0,
    designation: 'ASSISTANT_PROF',
    max_daily_periods: 4,
    max_weekly_periods: 18,
    is_active: true,
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createSuccessMsg, setCreateSuccessMsg] = useState<string | null>(null);

  // Edit Faculty Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDeptId, setEditDeptId] = useState<number>(0);
  const [editMaxDaily, setEditMaxDaily] = useState(4);
  const [editMaxWeekly, setEditMaxWeekly] = useState(18);
  const [editDesignation, setEditDesignation] = useState<string>('ASSISTANT_PROF');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Queries
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

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: CreateFacultyPayload) => facultyService.createFaculty(payload),
    onSuccess: (newFaculty) => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
      setCreateModalOpen(false);
      setCreateErrors({});
      const name = newFaculty.user_details
        ? `${newFaculty.user_details.first_name} ${newFaculty.user_details.last_name}`.trim()
        : newFaculty.employee_id;
      setCreateSuccessMsg(`Faculty member "${name}" was created successfully.`);
      setTimeout(() => setCreateSuccessMsg(null), 5000);
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[] | string> } };
      if (axErr.response?.data && typeof axErr.response.data === 'object') {
        const errors: Record<string, string> = {};
        for (const [key, val] of Object.entries(axErr.response.data)) {
          errors[key] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setCreateErrors(errors);
      } else {
        setCreateErrors({ form: 'Failed to create faculty member. Please verify required fields.' });
      }
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Faculty> & { first_name?: string; last_name?: string; email?: string }) => {
      if (!editingFaculty) return;
      return facultyService.updateFaculty(editingFaculty.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
      closeEditModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[] | string> } };
      if (axErr.response?.data && typeof axErr.response.data === 'object') {
        const msg = Object.entries(axErr.response.data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`)
          .join(' | ');
        setEditError(msg);
      } else {
        setEditError('Failed to update faculty profile.');
      }
    },
  });

  const openCreateModal = () => {
    setCreateForm({
      first_name: '',
      last_name: '',
      email: '',
      username: '',
      password: '',
      employee_id: '',
      department: selectedDept || (departments[0]?.id ?? 0),
      designation: 'ASSISTANT_PROF',
      max_daily_periods: 4,
      max_weekly_periods: 18,
      is_active: true,
    });
    setCreateErrors({});
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    setCreateErrors({});
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!createForm.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }
    if (!createForm.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!createForm.employee_id.trim()) {
      errors.employee_id = 'Employee ID / Faculty Code is required.';
    }
    if (!createForm.department) {
      errors.department = 'Department is required.';
    }
    if ((createForm.max_daily_periods ?? 0) <= 0) {
      errors.max_daily_periods = 'Max daily periods must be greater than 0.';
    }
    if ((createForm.max_weekly_periods ?? 0) <= 0) {
      errors.max_weekly_periods = 'Max weekly periods must be greater than 0.';
    }
    if ((createForm.max_daily_periods ?? 0) > (createForm.max_weekly_periods ?? 0)) {
      errors.max_daily_periods = 'Max daily periods cannot exceed max weekly periods.';
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    const payload: CreateFacultyPayload = {
      first_name: createForm.first_name.trim(),
      last_name: createForm.last_name?.trim() || '',
      email: createForm.email.trim(),
      username: createForm.username?.trim() || undefined,
      password: createForm.password || undefined,
      employee_id: createForm.employee_id.trim().toUpperCase(),
      department: Number(createForm.department),
      designation: createForm.designation,
      max_daily_periods: Number(createForm.max_daily_periods),
      max_weekly_periods: Number(createForm.max_weekly_periods),
      is_active: createForm.is_active,
    };

    createMutation.mutate(payload);
  };

  const openEditModal = (faculty: Faculty) => {
    setEditingFaculty(faculty);
    setEditFirstName(faculty.user_details?.first_name || '');
    setEditLastName(faculty.user_details?.last_name || '');
    setEditEmail(faculty.user_details?.email || '');
    setEditDeptId(faculty.department);
    setEditMaxDaily(faculty.max_daily_periods);
    setEditMaxWeekly(faculty.max_weekly_periods);
    setEditDesignation(faculty.designation);
    setEditIsActive(faculty.is_active);
    setEditError(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingFaculty(null);
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editMaxDaily > editMaxWeekly) {
      setEditError('Max daily periods cannot exceed max weekly periods.');
      return;
    }
    updateMutation.mutate({
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      email: editEmail.trim(),
      department: editDeptId,
      max_daily_periods: editMaxDaily,
      max_weekly_periods: editMaxWeekly,
      designation: editDesignation,
      is_active: editIsActive,
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
        <div className="flex items-center gap-1.5">
          <Link
            to={`/faculty/availability?faculty=${f.id}`}
            className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View & Edit Availability Matrix"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <Link
            to={`/faculty/qualifications?faculty=${f.id}`}
            className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Manage Subject Qualifications"
          >
            <GraduationCap className="w-4 h-4" />
          </Link>
          {isAdmin && (
            <button
              onClick={() => openEditModal(f)}
              className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Edit Profile & Workload Limits"
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
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              className="gap-1.5 shadow-sm shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Faculty
            </Button>
          )}
          <Link to="/faculty/availability">
            <Button variant="outline" size="sm">
              Weekly Availability Matrix
            </Button>
          </Link>
          <Link to="/faculty/allocations">
            <Button variant="outline" size="sm">
              <BookOpen className="w-4 h-4 mr-1.5" />
              Subject Allocations
            </Button>
          </Link>
        </div>
      </div>

      {/* Success Notification */}
      {createSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{createSuccessMsg}</span>
        </div>
      )}

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
            aria-label="Filter by Department"
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
            aria-label="Filter by Designation"
            value={selectedDesignation}
            onChange={(e) => setSelectedDesignation(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Designations</option>
            {DESIGNATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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

      {/* Add Faculty Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        title="Add New Faculty Member"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createErrors.form && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createErrors.form}</span>
            </div>
          )}

          {/* Section: Instructor Personal Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Personal & Account Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="add_first_name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  First Name *
                </label>
                <input
                  id="add_first_name"
                  type="text"
                  placeholder="e.g. Alan"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.first_name
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.first_name && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.first_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="add_last_name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Last Name
                </label>
                <input
                  id="add_last_name"
                  type="text"
                  placeholder="e.g. Turing"
                  value={createForm.last_name || ''}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="add_email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  id="add_email"
                  type="email"
                  placeholder="e.g. turing@adgips.ac.in"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.email
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.email && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="add_username" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Username <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  id="add_username"
                  type="text"
                  placeholder="auto-derived if blank"
                  value={createForm.username || ''}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.username
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.username && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.username}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="add_password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Password <span className="text-slate-400 font-normal">(optional, defaults to FacultyPassword@123)</span>
              </label>
              <input
                id="add_password"
                type="password"
                placeholder="••••••••"
                value={createForm.password || ''}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Section: Academic Position & Workload Limits */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Position & Scheduling Constraints
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="add_employee_id" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee ID / Faculty Code *
                </label>
                <input
                  id="add_employee_id"
                  type="text"
                  placeholder="e.g. FAC-CSE-10"
                  value={createForm.employee_id}
                  onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 font-mono uppercase text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.employee_id
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.employee_id && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.employee_id}</p>
                )}
              </div>

              <div>
                <label htmlFor="add_department" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department *
                </label>
                <select
                  id="add_department"
                  aria-label="Department"
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: Number(e.target.value) })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.department
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                >
                  <option value={0}>Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
                {createErrors.department && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.department}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="add_designation" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designation *
              </label>
              <select
                id="add_designation"
                aria-label="Designation"
                value={createForm.designation}
                onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {DESIGNATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="add_max_daily_periods" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Daily Teaching Periods *
                </label>
                <input
                  id="add_max_daily_periods"
                  type="number"
                  min={1}
                  max={8}
                  value={createForm.max_daily_periods ?? 4}
                  onChange={(e) => setCreateForm({ ...createForm, max_daily_periods: Number(e.target.value) })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.max_daily_periods
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.max_daily_periods && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.max_daily_periods}</p>
                )}
              </div>

              <div>
                <label htmlFor="add_max_weekly_periods" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Weekly Teaching Periods *
                </label>
                <input
                  id="add_max_weekly_periods"
                  type="number"
                  min={1}
                  max={30}
                  value={createForm.max_weekly_periods ?? 18}
                  onChange={(e) => setCreateForm({ ...createForm, max_weekly_periods: Number(e.target.value) })}
                  className={`w-full text-sm rounded-lg border px-3 py-2 text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 ${
                    createErrors.max_weekly_periods
                      ? 'border-rose-400 focus:ring-rose-400'
                      : 'border-slate-300 dark:border-slate-700 focus:ring-brand-500'
                  }`}
                />
                {createErrors.max_weekly_periods && (
                  <p className="text-xs text-rose-600 mt-1">{createErrors.max_weekly_periods}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="create_is_active"
                checked={createForm.is_active}
                onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="create_is_active" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Active for scheduling allocations
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating Faculty...' : 'Create Faculty Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Profile & Limits Modal */}
      {editingFaculty && (
        <Modal
          isOpen={editModalOpen}
          onClose={closeEditModal}
          title={`Edit Faculty: ${editingFaculty.user_details?.first_name} ${editingFaculty.user_details?.last_name}`}
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <select
                  value={editDeptId}
                  onChange={(e) => setEditDeptId(Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Designation
                </label>
                <select
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                >
                  {DESIGNATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Max Daily Teaching Periods
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={editMaxDaily}
                  onChange={(e) => setEditMaxDaily(Number(e.target.value))}
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
                  value={editMaxWeekly}
                  onChange={(e) => setEditMaxWeekly(Number(e.target.value))}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="edit_is_active"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="edit_is_active" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Active for scheduling
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={closeEditModal}>
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
