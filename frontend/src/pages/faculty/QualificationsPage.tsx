import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../../services/facultyService';
import { academicsService } from '../../services/academicsService';
import { FacultySubjectQualification } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Award, Plus, Trash2, Star, AlertCircle } from 'lucide-react';

export const QualificationsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [selectedFaculty, setSelectedFaculty] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [facultyId, setFacultyId] = useState<number>(0);
  const [subjectId, setSubjectId] = useState<number>(0);
  const [preferenceLevel, setPreferenceLevel] = useState<number>(3);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: facultyMembers = [] } = useQuery({
    queryKey: ['faculty-list', selectedDept],
    queryFn: () => facultyService.getFaculty({ department: selectedDept || undefined }),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', selectedDept],
    queryFn: () => academicsService.getSubjects(selectedDept || undefined),
  });

  const { data: qualifications = [], isLoading } = useQuery({
    queryKey: ['qualifications', selectedDept, selectedFaculty],
    queryFn: () =>
      facultyService.getQualifications({
        department: selectedDept || undefined,
        faculty: selectedFaculty || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { faculty: number; subject: number; preference_level: number }) =>
      facultyService.createQualification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualifications'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to record subject qualification.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: facultyService.deleteQualification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualifications'] });
    },
  });

  const openCreateModal = () => {
    setFacultyId(facultyMembers[0]?.id || 0);
    setSubjectId(subjects[0]?.id || 0);
    setPreferenceLevel(3);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facultyId || !subjectId) {
      setFormError('Please select both a faculty member and a subject.');
      return;
    }
    createMutation.mutate({
      faculty: facultyId,
      subject: subjectId,
      preference_level: preferenceLevel,
    });
  };

  const columns: Column<FacultySubjectQualification>[] = [
    {
      header: 'Faculty Member',
      cell: (q: FacultySubjectQualification) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">
            {q.faculty_name}
          </span>
          <span className="text-xs font-mono text-slate-500">
            {q.faculty_employee_id}
          </span>
        </div>
      ),
    },
    {
      header: 'Subject Code',
      accessorKey: 'subject_code',
      className: 'font-mono text-xs font-bold text-brand-600 dark:text-brand-400',
    },
    {
      header: 'Subject Name',
      cell: (q: FacultySubjectQualification) => (
        <div className="flex items-center gap-2">
          <span>{q.subject_name}</span>
          <Badge variant={q.subject_type === 'LAB' ? 'warning' : 'brand'}>
            {q.subject_type}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Affinity Score',
      cell: (q: FacultySubjectQualification) => (
        <div className="flex items-center gap-1 text-amber-500">
          {[1, 2, 3, 4, 5].map((lvl) => (
            <Star
              key={lvl}
              className={`w-3.5 h-3.5 ${
                lvl <= q.preference_level ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'
              }`}
            />
          ))}
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">
            ({q.preference_level}/5)
          </span>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (q: FacultySubjectQualification) =>
        isAdmin ? (
          <button
            onClick={() => {
              if (confirm('Remove this teacher qualification record?')) {
                deleteMutation.mutate(q.id);
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
            title="Delete Qualification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-600" />
            Subject Qualifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Specify which subjects instructors are certified and eligible to teach.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Qualification
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
        <div className="w-56">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Department
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

        <div className="w-64">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Faculty Member
          </label>
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value={0}>All Faculty</option>
            {facultyMembers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.user_details?.first_name} {f.user_details?.last_name} ({f.employee_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          title="Registered Subject Qualifications"
          columns={columns}
          data={qualifications}
          isLoading={isLoading}
          searchPlaceholder="Search qualifications by subject code or instructor..."
        />
      </div>

      {/* Add Qualification Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Register Subject Qualification">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Faculty Member
            </label>
            <select
              value={facultyId}
              onChange={(e) => setFacultyId(Number(e.target.value))}
              required
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value={0}>-- Select Faculty --</option>
              {facultyMembers.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user_details?.first_name} {f.user_details?.last_name} ({f.employee_id}) - {f.department_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
              required
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value={0}>-- Select Subject --</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.name} ({s.subject_type}, {s.weekly_periods} periods)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Affinity / Preference Score (1 = Lowest, 5 = Highest)
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={preferenceLevel}
              onChange={(e) => setPreferenceLevel(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1 - Minor</span>
              <span>2 - Adequate</span>
              <span className="font-bold text-brand-600">3 - Standard</span>
              <span>4 - Strong</span>
              <span>5 - Expert / Primary</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Add Qualification'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
