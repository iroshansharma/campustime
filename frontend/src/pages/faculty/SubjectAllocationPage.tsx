import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { facultyService } from '../../services/facultyService';
import { roomsService } from '../../services/roomsService';
import { Subject, SectionSubjectAssignment } from '../../types';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  BookOpen, CheckCircle2, AlertTriangle, AlertCircle,
  Building, UserCheck, Plus, Trash2, ShieldAlert
} from 'lucide-react';

export const SubjectAllocationPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Cascading Context Filters
  const [selectedAY, setSelectedAY] = useState<number>(0);
  const [selectedDept, setSelectedDept] = useState<number>(0);
  const [selectedShift, setSelectedShift] = useState<number>(0);
  const [selectedSemester, setSelectedSemester] = useState<number>(0);
  const [selectedSection, setSelectedSection] = useState<number>(0);

  // Assign Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [assigningSubject, setAssigningSubject] = useState<Subject | null>(null);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number>(0);
  const [isPrimary, setIsPrimary] = useState(true);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // 1. Fetch Academic Years, Departments, Shifts
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

  const activeAY = selectedAY || academicYears.find((y) => y.is_current)?.id || academicYears[0]?.id || 0;
  const activeDept = selectedDept || departments[0]?.id || 0;
  const activeShift = selectedShift || shifts[0]?.id || 0;

  // 2. Fetch Semesters matching AY and Dept
  const { data: semesters = [] } = useQuery({
    queryKey: ['semesters', activeDept, activeAY],
    queryFn: () =>
      academicsService.getSemesters(activeDept || undefined, activeAY || undefined),
    enabled: activeAY > 0 && activeDept > 0,
  });

  const activeSemester = selectedSemester || semesters[0]?.id || 0;

  // 3. Fetch Sections for Semester
  const { data: sections = [] } = useQuery({
    queryKey: ['sections', activeSemester],
    queryFn: () => academicsService.getSections(activeSemester || undefined),
    enabled: activeSemester > 0,
  });

  const activeSectionId = selectedSection || sections[0]?.id || 0;
  const activeSectionObj = sections.find((s) => s.id === activeSectionId);

  // 4. Fetch Subjects for Department
  const { data: departmentSubjects = [] } = useQuery({
    queryKey: ['subjects', activeDept],
    queryFn: () => academicsService.getSubjects(activeDept || undefined),
    enabled: activeDept > 0,
  });

  // 5. Fetch Faculty for Department with workload
  const { data: facultyMembers = [] } = useQuery({
    queryKey: ['faculty-list', activeDept],
    queryFn: () => facultyService.getFaculty({ department: activeDept || undefined }),
    enabled: activeDept > 0,
  });

  // 6. Fetch Subject Qualifications for Department
  const { data: qualifications = [] } = useQuery({
    queryKey: ['qualifications', activeDept],
    queryFn: () => facultyService.getQualifications({ department: activeDept || undefined }),
    enabled: activeDept > 0,
  });

  // 7. Fetch Section Subject Assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['section-assignments', activeSectionId],
    queryFn: () => facultyService.getAssignments({ section: activeSectionId }),
    enabled: activeSectionId > 0,
  });

  // 8. Fetch Rooms for Capacity Feasibility Check
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsService.getRooms({ is_active: true }),
  });

  // Mutations
  const assignMutation = useMutation({
    mutationFn: (payload: { section: number; subject: number; faculty: number; is_primary: boolean }) =>
      facultyService.createAssignment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[] | string> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to assign faculty member.';
      setAssignmentError(msg);
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: number) => facultyService.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['faculty-list'] });
    },
  });

  // Map of subject assignments
  const assignmentMap = useMemo(() => {
    const map = new Map<number, SectionSubjectAssignment[]>();
    assignments.forEach((a) => {
      const list = map.get(a.subject) || [];
      list.push(a);
      map.set(a.subject, list);
    });
    return map;
  }, [assignments]);

  // Unassigned subjects count
  const unassignedCount = useMemo(() => {
    return departmentSubjects.filter((s) => !assignmentMap.has(s.id)).length;
  }, [departmentSubjects, assignmentMap]);

  // Suitable Rooms Feasibility Calculation
  const roomFeasibility = useMemo(() => {
    if (!activeSectionObj) return { suitableClassrooms: 0, suitableLabs: 0 };
    const headcount = activeSectionObj.student_count;

    const suitableClassrooms = rooms.filter(
      (r) => (r.room_type === 'CLASSROOM' || r.room_type === 'SEMINAR_HALL') && r.capacity >= headcount
    ).length;

    const suitableLabs = rooms.filter(
      (r) => r.room_type === 'LAB' && r.capacity >= headcount
    ).length;

    return { suitableClassrooms, suitableLabs };
  }, [rooms, activeSectionObj]);

  const openAssignModal = (subject: Subject) => {
    setAssigningSubject(subject);
    setAssignmentError(null);
    setIsPrimary(true);

    // Filter qualified faculty for this subject
    const qualified = qualifications.filter((q) => q.subject === subject.id);
    if (qualified.length > 0) {
      setSelectedFacultyId(qualified[0].faculty);
    } else {
      setSelectedFacultyId(0);
    }

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setAssigningSubject(null);
    setAssignmentError(null);
  };

  // Qualified faculty for the modal's active subject
  const qualifiedFacultyForModal = useMemo(() => {
    if (!assigningSubject) return [];
    const qualifiedIds = new Set(
      qualifications.filter((q) => q.subject === assigningSubject.id).map((q) => q.faculty)
    );
    return facultyMembers.filter((f) => qualifiedIds.has(f.id));
  }, [assigningSubject, qualifications, facultyMembers]);

  // Live workload check for modal selection
  const selectedFacultyWorkloadInfo = useMemo(() => {
    if (!selectedFacultyId || !assigningSubject) return null;
    const fac = facultyMembers.find((f) => f.id === selectedFacultyId);
    if (!fac) return null;

    const currentLoad = fac.current_weekly_load || 0;
    const additionalLoad = assigningSubject.weekly_periods;
    const projectedLoad = currentLoad + additionalLoad;
    const maxLimit = fac.max_weekly_periods;
    const exceeds = projectedLoad > maxLimit;

    return {
      currentLoad,
      additionalLoad,
      projectedLoad,
      maxLimit,
      exceeds,
      remaining: maxLimit - currentLoad,
    };
  }, [selectedFacultyId, assigningSubject, facultyMembers]);

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSectionId || !assigningSubject || !selectedFacultyId) {
      setAssignmentError('Please select a qualified faculty member.');
      return;
    }

    if (selectedFacultyWorkloadInfo?.exceeds) {
      setAssignmentError(
        `Workload limit exceeded! Instructor max limit is ${selectedFacultyWorkloadInfo.maxLimit} periods/wk, but assignment would reach ${selectedFacultyWorkloadInfo.projectedLoad} periods/wk.`
      );
      return;
    }

    assignMutation.mutate({
      section: activeSectionId,
      subject: assigningSubject.id,
      faculty: selectedFacultyId,
      is_primary: isPrimary,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-600" />
            Subject–Teacher–Section Allocation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Allocate certified instructors to sections based on weekly curriculum requirements and capacity limits.
          </p>
        </div>
      </div>

      {/* Cascading Context Selectors */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Academic Year */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Academic Year
          </label>
          <select
            value={activeAY}
            onChange={(e) => setSelectedAY(Number(e.target.value))}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-slate-900 dark:text-white"
          >
            {academicYears.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.is_current ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Department
          </label>
          <select
            value={activeDept}
            onChange={(e) => {
              setSelectedDept(Number(e.target.value));
              setSelectedSemester(0);
              setSelectedSection(0);
            }}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-slate-900 dark:text-white"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        {/* Shift */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Shift
          </label>
          <select
            value={activeShift}
            onChange={(e) => {
              setSelectedShift(Number(e.target.value));
              setSelectedSemester(0);
              setSelectedSection(0);
            }}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-slate-900 dark:text-white"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Semester
          </label>
          <select
            value={activeSemester}
            onChange={(e) => {
              setSelectedSemester(Number(e.target.value));
              setSelectedSection(0);
            }}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-slate-900 dark:text-white"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Semester {s.semester_number}
              </option>
            ))}
          </select>
        </div>

        {/* Section */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Target Section
          </label>
          <select
            value={activeSectionId}
            onChange={(e) => setSelectedSection(Number(e.target.value))}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-slate-900 dark:text-white font-bold"
          >
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                Section {sec.name} ({sec.student_count} students)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview & Feasibility Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Allocation Completeness */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Allocation Status</div>
          <div className="flex items-center gap-2 mt-2">
            {unassignedCount === 0 ? (
              <Badge variant="success">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                All {departmentSubjects.length} Subjects Allocated
              </Badge>
            ) : (
              <Badge variant="warning">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {unassignedCount} Unassigned Subject{unassignedCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Section: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeSectionObj ? `Section ${activeSectionObj.name}` : 'None'}</span> ({activeSectionObj?.student_count ?? 0} enrolled)
          </div>
        </div>

        {/* Room Capacity Validation Check */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-brand-600" />
            Room Capacity Feasibility
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Classrooms (Capacity ≥ {activeSectionObj?.student_count ?? 60}):</span>
              <span className={`font-bold ${roomFeasibility.suitableClassrooms > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {roomFeasibility.suitableClassrooms} available
              </span>
            </div>
            <div className="flex justify-between">
              <span>Labs (Capacity ≥ {activeSectionObj?.student_count ?? 60}):</span>
              <span className={`font-bold ${roomFeasibility.suitableLabs > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {roomFeasibility.suitableLabs} available
              </span>
            </div>
          </div>
        </div>

        {/* Faculty Pool Health */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-brand-600" />
            Faculty Qualification Pool
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {facultyMembers.length} <span className="text-xs font-normal text-slate-500">Department Teachers</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {qualifications.length} verified subject qualifications registered
          </div>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Curriculum Requirements & Teacher Assignments
          </h2>
          <span className="text-xs text-slate-500">
            {departmentSubjects.length} subjects in department curriculum
          </span>
        </div>

        {departmentSubjects.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No subjects configured for this department yet. Add subjects in Academic Setup.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Weekly Demand</th>
                  <th className="py-3 px-4">Consecutive Slots</th>
                  <th className="py-3 px-4">Assigned Instructor</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {departmentSubjects.map((sub) => {
                  const assignedList = assignmentMap.get(sub.id) || [];
                  const isAssigned = assignedList.length > 0;

                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${
                        !isAssigned ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Subject Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {sub.name}
                        </div>
                        <div className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400">
                          {sub.code}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={sub.subject_type === 'LAB' ? 'warning' : 'brand'}
                        >
                          {sub.subject_type}
                        </Badge>
                      </td>

                      {/* Weekly Periods */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {sub.weekly_periods}
                        </span>{' '}
                        <span className="text-xs text-slate-500">periods/wk</span>
                      </td>

                      {/* Consecutive Slots */}
                      <td className="py-3.5 px-4">
                        <span className="text-slate-700 dark:text-slate-300">
                          {sub.consecutive_slots > 1
                            ? `${sub.consecutive_slots} consecutive`
                            : 'Single slots'}
                        </span>
                      </td>

                      {/* Assigned Instructor */}
                      <td className="py-3.5 px-4">
                        {isAssigned ? (
                          <div className="space-y-1">
                            {assignedList.map((assignment) => (
                              <div
                                key={assignment.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {assignment.faculty_name}
                                </span>
                                <span className="font-mono text-slate-500">
                                  ({assignment.faculty_employee_id})
                                </span>
                                {assignment.is_primary && (
                                  <Badge variant="success">
                                    Lead
                                  </Badge>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm(`Remove ${assignment.faculty_name} from ${sub.code}?`)) {
                                      deleteAssignmentMutation.mutate(assignment.id);
                                    }
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Unassign instructor"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant={isAssigned ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => openAssignModal(sub)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {isAssigned ? 'Add / Replace' : 'Assign Teacher'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {assigningSubject && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={`Assign Teacher: ${assigningSubject.name} (${assigningSubject.code})`}
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            {assignmentError && (
              <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignmentError}</span>
              </div>
            )}

            {/* Subject details card */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Required Weekly Periods:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {assigningSubject.weekly_periods} periods
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subject Type:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {assigningSubject.subject_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consecutive Slots:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {assigningSubject.consecutive_slots}
                </span>
              </div>
            </div>

            {/* Qualified Teachers Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Certified Faculty Member
              </label>

              {qualifiedFacultyForModal.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    No instructors currently hold qualifications for this subject. Please register a qualification first under Subject Qualifications.
                  </span>
                </div>
              ) : (
                <select
                  value={selectedFacultyId}
                  onChange={(e) => setSelectedFacultyId(Number(e.target.value))}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value={0}>-- Select Qualified Instructor --</option>
                  {qualifiedFacultyForModal.map((f) => {
                    const load = f.current_weekly_load || 0;
                    const max = f.max_weekly_periods;
                    const remaining = max - load;
                    return (
                      <option key={f.id} value={f.id}>
                        {f.user_details?.first_name} {f.user_details?.last_name} ({f.employee_id}) — Load: {load}/{max} ({remaining} remaining)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Real-time Workload Capacity Forecast */}
            {selectedFacultyWorkloadInfo && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  selectedFacultyWorkloadInfo.exceeds
                    ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>Workload Projection:</span>
                  <span>
                    {selectedFacultyWorkloadInfo.currentLoad} + {selectedFacultyWorkloadInfo.additionalLoad} ={' '}
                    {selectedFacultyWorkloadInfo.projectedLoad} / {selectedFacultyWorkloadInfo.maxLimit} periods/wk
                  </span>
                </div>
                {selectedFacultyWorkloadInfo.exceeds ? (
                  <p className="text-[11px] font-bold">
                    ⚠️ Assignment exceeds instructor's maximum limit of {selectedFacultyWorkloadInfo.maxLimit} weekly periods!
                  </p>
                ) : (
                  <p className="text-[11px]">
                    ✓ Within capacity limits. {selectedFacultyWorkloadInfo.maxLimit - selectedFacultyWorkloadInfo.projectedLoad} periods will remain.
                  </p>
                )}
              </div>
            )}

            {/* Primary Instructor Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_primary"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label
                htmlFor="is_primary"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Designate as Primary / Lead Instructor
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  assignMutation.isPending ||
                  !selectedFacultyId ||
                  selectedFacultyWorkloadInfo?.exceeds
                }
              >
                {assignMutation.isPending ? 'Saving...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
