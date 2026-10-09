import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { Department } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [collegeId, setCollegeId] = useState<number>(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: academicsService.getColleges,
  });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Department>) => {
      if (editingDept) {
        return academicsService.updateDepartment(editingDept.id, payload);
      }
      return academicsService.createDepartment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save department.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const openCreateModal = () => {
    setEditingDept(null);
    setCollegeId(colleges[0]?.id || 0);
    setName('');
    setCode('');
    setIsActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (d: Department) => {
    setEditingDept(d);
    setCollegeId(d.college);
    setName(d.name);
    setCode(d.code);
    setIsActive(d.is_active);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDept(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      college: collegeId,
      name,
      code,
      is_active: isActive,
    });
  };

  const columns: Column<Department>[] = [
    {
      header: 'Department Name',
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
    { header: 'Code', accessorKey: 'code', className: 'font-mono text-xs font-bold text-brand-600' },
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
                if (window.confirm(`Delete department '${item.name}'?`)) {
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
        title="Academic Departments"
        description="Engineering disciplines and institutional departments."
        columns={columns}
        data={departments}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Department"
        searchPlaceholder="Search department..."
        searchFilter={(item, q) =>
          item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingDept ? 'Edit Department' : 'Add New Department'}
        description="Configure department name and official acronym."
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
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Science & Engineering"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Department Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CSE"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isDeptActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isDeptActive" className="text-xs font-medium text-slate-700">
              Department is active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingDept ? 'Update Department' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
