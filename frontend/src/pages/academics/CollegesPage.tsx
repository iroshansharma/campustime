import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { College } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const CollegesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: colleges = [], isLoading } = useQuery({
    queryKey: ['colleges'],
    queryFn: academicsService.getColleges,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<College>) => {
      if (editingCollege) {
        return academicsService.updateCollege(editingCollege.id, payload);
      }
      return academicsService.createCollege(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save college.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deleteCollege,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colleges'] });
    },
  });

  const openCreateModal = () => {
    setEditingCollege(null);
    setName('');
    setCode('');
    setAddress('');
    setEmail('');
    setPhone('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (col: College) => {
    setEditingCollege(col);
    setName(col.name);
    setCode(col.code);
    setAddress(col.address || '');
    setEmail(col.email || '');
    setPhone(col.phone || '');
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCollege(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError('Name and Code are required.');
      return;
    }
    saveMutation.mutate({ name, code, address, email, phone });
  };

  const handleDelete = (col: College) => {
    if (window.confirm(`Are you sure you want to delete '${col.name}'?`)) {
      deleteMutation.mutate(col.id);
    }
  };

  const columns: Column<College>[] = [
    { header: 'College Name', accessorKey: 'name', className: 'font-semibold text-slate-900' },
    { header: 'Code', accessorKey: 'code', className: 'font-mono text-brand-600 font-medium' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Phone', accessorKey: 'phone' },
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
              onClick={() => handleDelete(item)}
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
        title="Colleges & Campuses"
        description="Institutional entities and academic headquarters."
        columns={columns}
        data={colleges}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add College"
        searchPlaceholder="Search by name or code..."
        searchFilter={(item, q) =>
          item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingCollege ? 'Edit College' : 'Add New College'}
        description="Configure institution identifying details and contact info."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              College Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. Dr. Akhilesh Das Gupta Institute of Professional Studies"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institution Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="e.g. ADGIPS"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="info@adgips.ac.in"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              placeholder="+91-11-49905900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingCollege ? 'Update College' : 'Create College'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
