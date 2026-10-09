import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { Subject, SubjectType } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const SubjectsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subject | null>(null);

  const [departmentId, setDepartmentId] = useState<number>(0);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [subjectType, setSubjectType] = useState<SubjectType>('THEORY');
  const [credits, setCredits] = useState<number>(4);
  const [weeklyPeriods, setWeeklyPeriods] = useState<number>(4);
  const [consecutiveSlots, setConsecutiveSlots] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => academicsService.getSubjects(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Subject>) => {
      if (editingSub) {
        return academicsService.updateSubject(editingSub.id, payload);
      }
      return academicsService.createSubject(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save subject.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  const openCreateModal = () => {
    setEditingSub(null);
    setDepartmentId(departments[0]?.id || 0);
    setCode('');
    setName('');
    setSubjectType('THEORY');
    setCredits(4);
    setWeeklyPeriods(4);
    setConsecutiveSlots(1);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSub(sub);
    setDepartmentId(sub.department);
    setCode(sub.code);
    setName(sub.name);
    setSubjectType(sub.subject_type);
    setCredits(sub.credits);
    setWeeklyPeriods(sub.weekly_periods);
    setConsecutiveSlots(sub.consecutive_slots);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSub(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (consecutiveSlots > weeklyPeriods) {
      setFormError('Consecutive slot size cannot exceed total weekly periods.');
      return;
    }
    if (weeklyPeriods % consecutiveSlots !== 0) {
      setFormError(`Weekly periods (${weeklyPeriods}) must be divisible by consecutive block size (${consecutiveSlots}).`);
      return;
    }
    saveMutation.mutate({
      department: departmentId,
      code,
      name,
      subject_type: subjectType,
      credits,
      weekly_periods: weeklyPeriods,
      consecutive_slots: consecutiveSlots,
    });
  };

  const columns: Column<Subject>[] = [
    {
      header: 'Subject Code',
      accessorKey: 'code',
      cell: (item) => (
        <span className="font-mono text-xs font-bold text-brand-600">
          {item.code}
        </span>
      ),
    },
    {
      header: 'Subject Title',
      accessorKey: 'name',
      cell: (item) => (
        <span className="font-semibold text-slate-900">{item.name}</span>
      ),
    },
    {
      header: 'Type',
      cell: (item) => (
        <Badge variant={item.subject_type === 'LAB' ? 'warning' : 'brand'}>
          {item.subject_type_display || item.subject_type}
        </Badge>
      ),
    },
    { header: 'Department', accessorKey: 'department_code' },
    {
      header: 'Credits',
      accessorKey: 'credits',
      cell: (item) => <span className="font-mono">{item.credits}</span>,
    },
    {
      header: 'Weekly Schedule',
      cell: (item) => (
        <span className="font-mono text-xs text-slate-700">
          {item.weekly_periods} periods ({item.consecutive_slots} consec/block)
        </span>
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
                if (window.confirm(`Delete subject '${item.code} - ${item.name}'?`)) {
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
        title="Curriculum Subjects"
        description="Theory, laboratory, and seminar courses with weekly periods and block requirements."
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Subject"
        searchPlaceholder="Search subject..."
        searchFilter={(item, q) =>
          item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingSub ? 'Edit Subject' : 'Add New Subject'}
        description="Configure subject credits and continuous lab requirements."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

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
                Subject Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CS-501"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject Type *
              </label>
              <select
                value={subjectType}
                onChange={(e) => {
                  const val = e.target.value as SubjectType;
                  setSubjectType(val);
                  if (val === 'LAB') {
                    setConsecutiveSlots(2);
                    setWeeklyPeriods(2);
                  } else {
                    setConsecutiveSlots(1);
                    setWeeklyPeriods(4);
                  }
                }}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              >
                <option value="THEORY">Theory</option>
                <option value="LAB">Practical / Laboratory</option>
                <option value="SEMINAR">Seminar / Project</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Database Management Systems"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Credits
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weekly Periods *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={weeklyPeriods}
                onChange={(e) => setWeeklyPeriods(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Consecutive / Block *
              </label>
              <input
                type="number"
                min="1"
                max="4"
                value={consecutiveSlots}
                onChange={(e) => setConsecutiveSlots(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingSub ? 'Update Subject' : 'Create Subject'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
