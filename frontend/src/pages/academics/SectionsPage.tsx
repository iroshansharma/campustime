import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { Section } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const SectionsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSec, setEditingSec] = useState<Section | null>(null);

  const [semesterId, setSemesterId] = useState<number>(0);
  const [name, setName] = useState('');
  const [studentCount, setStudentCount] = useState<number>(60);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: semesters = [] } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => academicsService.getSemesters(),
  });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['sections'],
    queryFn: () => academicsService.getSections(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Section>) => {
      if (editingSec) {
        return academicsService.updateSection(editingSec.id, payload);
      }
      return academicsService.createSection(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save section.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });

  const openCreateModal = () => {
    setEditingSec(null);
    setSemesterId(semesters[0]?.id || 0);
    setName('A');
    setStudentCount(60);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sec: Section) => {
    setEditingSec(sec);
    setSemesterId(sec.semester);
    setName(sec.name);
    setStudentCount(sec.student_count);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSec(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentCount <= 0) {
      setFormError('Student count must be greater than zero.');
      return;
    }
    saveMutation.mutate({
      semester: semesterId,
      name,
      student_count: studentCount,
    });
  };

  const columns: Column<Section>[] = [
    {
      header: 'Section Name',
      cell: (item) => (
        <span className="font-semibold text-slate-900">
          Section {item.name}
        </span>
      ),
    },
    {
      header: 'Parent Semester',
      cell: (item) => (
        <span className="font-medium text-slate-700">
          {item.semester_info
            ? `${item.semester_info.department_code} Sem ${item.semester_info.semester_number} (${item.semester_info.shift_name})`
            : `Semester #${item.semester}`}
        </span>
      ),
    },
    {
      header: 'Enrolled Headcount',
      accessorKey: 'student_count',
      cell: (item) => (
        <span className="font-mono text-slate-800 font-semibold">
          {item.student_count} students
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
                if (window.confirm(`Delete Section '${item.name}'?`)) {
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
        title="Student Sections"
        description="Classroom student cohorts and section enrollment sizes."
        columns={columns}
        data={sections}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Section"
        searchPlaceholder="Search section..."
        searchFilter={(item, q) =>
          item.name.toLowerCase().includes(q) ||
          (item.semester_info?.department_code || '').toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingSec ? 'Edit Section' : 'Add New Section'}
        description="Configure student section name and headcount."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Semester *
            </label>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.department_code} Sem {s.semester_number} ({s.shift_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Section Label *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A, B, or Sec-1"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 uppercase font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Student Count *
            </label>
            <input
              type="number"
              min="1"
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingSec ? 'Update Section' : 'Create Section'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
