import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { Semester } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const SemestersPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSem, setEditingSem] = useState<Semester | null>(null);

  const [academicYearId, setAcademicYearId] = useState<number>(0);
  const [departmentId, setDepartmentId] = useState<number>(0);
  const [shiftId, setShiftId] = useState<number>(0);
  const [semesterNumber, setSemesterNumber] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicsService.getAcademicYears(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const { data: semesters = [], isLoading } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => academicsService.getSemesters(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Semester>) => {
      if (editingSem) {
        return academicsService.updateSemester(editingSem.id, payload);
      }
      return academicsService.createSemester(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save semester. Check cross-college validity.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteSemester,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
    },
  });

  const openCreateModal = () => {
    setEditingSem(null);
    setAcademicYearId(academicYears[0]?.id || 0);
    setDepartmentId(departments[0]?.id || 0);
    setShiftId(shifts[0]?.id || 0);
    setSemesterNumber(1);
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Semester) => {
    setEditingSem(s);
    setAcademicYearId(s.academic_year);
    setDepartmentId(s.department);
    setShiftId(s.shift);
    setSemesterNumber(s.semester_number);
    setIsActive(s.is_active);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSem(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      academic_year: academicYearId,
      department: departmentId,
      shift: shiftId,
      semester_number: semesterNumber,
      is_active: isActive,
    });
  };

  const columns: Column<Semester>[] = [
    {
      header: 'Semester',
      cell: (item) => (
        <span className="font-semibold text-slate-900">
          {item.department_code} - Sem {item.semester_number}
        </span>
      ),
    },
    { header: 'Department', accessorKey: 'department_name' },
    { header: 'Shift', accessorKey: 'shift_name' },
    { header: 'Academic Cycle', accessorKey: 'academic_year_name' },
    {
      header: 'Status',
      cell: (item) => (
        <Badge variant={item.is_active ? 'brand' : 'slate'}>
          {item.is_active ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (item) =>
        isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEditModal(item)}
              className="p-1 text-slate-400 hover:text-brand-600 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete Semester ${item.semester_number}?`)) {
                  deleteMutation.mutate(item.id);
                }
              }}
              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Read-only</span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        title="Department Semesters"
        description="Semesters organized by Department, Academic Cycle, and Shift."
        columns={columns}
        data={semesters}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Semester"
        searchFilter={(item, q) =>
          (item.department_code || '').toLowerCase().includes(q) ||
          item.semester_number.toString().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingSem ? 'Edit Semester' : 'Add New Semester'}
        description="Link department, academic cycle, and shift offerings."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year *
            </label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} ({ay.college_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department *
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Semester Number (1..8) *
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={semesterNumber}
                onChange={(e) => setSemesterNumber(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shift *
              </label>
              <select
                value={shiftId}
                onChange={(e) => setShiftId(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isSemActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isSemActive" className="text-xs font-medium text-slate-700">
              Semester is active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingSem ? 'Update Semester' : 'Create Semester'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
