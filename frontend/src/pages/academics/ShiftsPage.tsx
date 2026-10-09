import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { Shift } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const ShiftsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const [collegeId, setCollegeId] = useState<number>(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: academicsService.getColleges,
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Shift>) => {
      if (editingShift) {
        return academicsService.updateShift(editingShift.id, payload);
      }
      return academicsService.createShift(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save shift.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });

  const openCreateModal = () => {
    setEditingShift(null);
    setCollegeId(colleges[0]?.id || 0);
    setName('');
    setCode('');
    setStartTime('08:30');
    setEndTime('14:30');
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (s: Shift) => {
    setEditingShift(s);
    setCollegeId(s.college);
    setName(s.name);
    setCode(s.code);
    setStartTime(s.start_time.slice(0, 5));
    setEndTime(s.end_time.slice(0, 5));
    setIsActive(s.is_active);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingShift(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startTime >= endTime) {
      setFormError('Shift start time must be before end time.');
      return;
    }
    saveMutation.mutate({
      college: collegeId,
      name,
      code,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      is_active: isActive,
    });
  };

  const columns: Column<Shift>[] = [
    {
      header: 'Shift Name',
      accessorKey: 'name',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{item.name}</span>
          <Badge variant={item.is_active ? 'brand' : 'slate'}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      ),
    },
    { header: 'Code', accessorKey: 'code', className: 'font-mono text-xs font-semibold' },
    {
      header: 'Timings',
      cell: (item) => (
        <span className="font-mono text-xs font-medium text-slate-700">
          {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
        </span>
      ),
    },
    { header: 'College', accessorKey: 'college_name' },
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
                if (window.confirm(`Delete shift '${item.name}'?`)) {
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
        title="College Shifts"
        description="Shift I (Morning) and Shift II (Evening) operating hours."
        columns={columns}
        data={shifts}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Shift"
        searchPlaceholder="Search shift..."
        searchFilter={(item, q) =>
          item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingShift ? 'Edit Shift' : 'Add New Shift'}
        description="Configure shift timings and codes."
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
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
              Shift Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shift I (Morning)"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Shift Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SHIFT_1"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isShiftActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isShiftActive" className="text-xs font-medium text-slate-700">
              Shift is currently active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingShift ? 'Update Shift' : 'Create Shift'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
