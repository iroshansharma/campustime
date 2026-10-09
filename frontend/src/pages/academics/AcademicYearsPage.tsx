import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { AcademicYear } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const AcademicYearsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  const [collegeId, setCollegeId] = useState<number>(0);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: academicsService.getColleges,
  });

  const { data: academicYears = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicsService.getAcademicYears(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<AcademicYear>) => {
      if (editingYear) {
        return academicsService.updateAcademicYear(editingYear.id, payload);
      }
      return academicsService.createAcademicYear(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save academic year.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });

  const openCreateModal = () => {
    setEditingYear(null);
    setCollegeId(colleges[0]?.id || 0);
    setName('');
    setStartDate('');
    setEndDate('');
    setIsCurrent(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (ay: AcademicYear) => {
    setEditingYear(ay);
    setCollegeId(ay.college);
    setName(ay.name);
    setStartDate(ay.start_date);
    setEndDate(ay.end_date);
    setIsCurrent(ay.is_current);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingYear(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate >= endDate) {
      setFormError('Start date must be strictly before end date.');
      return;
    }
    saveMutation.mutate({
      college: collegeId,
      name,
      start_date: startDate,
      end_date: endDate,
      is_current: isCurrent,
    });
  };

  const columns: Column<AcademicYear>[] = [
    {
      header: 'Academic Cycle',
      accessorKey: 'name',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{item.name}</span>
          {item.is_current && <Badge variant="success">Active Current</Badge>}
        </div>
      ),
    },
    { header: 'College', accessorKey: 'college_name' },
    { header: 'Start Date', accessorKey: 'start_date' },
    { header: 'End Date', accessorKey: 'end_date' },
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
                if (window.confirm(`Delete academic year '${item.name}'?`)) {
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
        title="Academic Years"
        description="Scheduling cycles and active collegiate calendars."
        columns={columns}
        data={academicYears}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Academic Year"
        searchPlaceholder="Search year..."
        searchFilter={(item, q) => item.name.toLowerCase().includes(q)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
        description="Configure academic dates and active cycle."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Affiliated College *
            </label>
            <select
              value={collegeId}
              onChange={(e) => setCollegeId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
              required
            >
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Year Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2024-2025"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isCurrent"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isCurrent" className="text-xs font-medium text-slate-700">
              Set as Current Active Academic Year
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingYear ? 'Update Year' : 'Create Year'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
