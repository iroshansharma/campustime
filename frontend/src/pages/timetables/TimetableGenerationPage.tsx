import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, AlertCircle, CheckCircle2, Clock,
  Layers, ShieldCheck, Lock, Unlock,
  RefreshCw, Send, AlertTriangle, Download,
  BarChart3, GitFork, Edit3
} from 'lucide-react';
import { academicsService } from '../../services/academicsService';
import { timetableService } from '../../services/timetableService';
import { roomsService } from '../../services/roomsService';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  GenerateSchedulePayload,
  GenerationResult,
  Timetable,
  TimetableEntry,
  ValidationReport,
  DayCode,
  Room,
} from '../../types';

export const TimetableGenerationPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Scope Form State
  const [academicYearId, setAcademicYearId] = useState<number | ''>('');
  const [shiftId, setShiftId] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [semesterId, setSemesterId] = useState<number | ''>('');
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);

  // Engine Settings
  const [timetableName, setTimetableName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [maxBacktracks, setMaxBacktracks] = useState<number>(5000);
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(30);

  // Result & Active Timetable
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [activeTimetableId, setActiveTimetableId] = useState<number | null>(null);
  const [filterSectionId, setFilterSectionId] = useState<number | ''>('');
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  // Manual Edit Modal State
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [targetSlotId, setTargetSlotId] = useState<number | ''>('');
  const [targetRoomId, setTargetRoomId] = useState<number | ''>('');
  const [editError, setEditError] = useState<string | null>(null);

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [pdfType, setPdfType] = useState<'section' | 'faculty' | 'room'>('section');
  const [pdfSectionId, setPdfSectionId] = useState<number | ''>('');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Reports Modal State
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);
  const [reportsTab, setReportsTab] = useState<'workload' | 'rooms'>('workload');

  // Scope Data Queries
  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicsService.getAcademicYears(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ['semesters', departmentId, academicYearId],
    queryFn: () => academicsService.getSemesters(
      departmentId ? Number(departmentId) : undefined,
      academicYearId ? Number(academicYearId) : undefined
    ),
    enabled: !!academicYearId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', semesterId],
    queryFn: () => academicsService.getSections(semesterId ? Number(semesterId) : undefined),
    enabled: !!semesterId,
  });

  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: () => roomsService.getRooms(),
  });

  // Active Timetable Details & Entries
  const { data: activeTimetable, refetch: refetchTimetable } = useQuery<Timetable>({
    queryKey: ['timetable', activeTimetableId],
    queryFn: () => timetableService.getTimetable(activeTimetableId!),
    enabled: !!activeTimetableId,
  });

  const { data: activeEntries = [], refetch: refetchEntries } = useQuery<TimetableEntry[]>({
    queryKey: ['timetable-entries', activeTimetableId, filterSectionId],
    queryFn: () => timetableService.getTimetableEntries(
      activeTimetableId!,
      filterSectionId ? { section: Number(filterSectionId) } : undefined
    ),
    enabled: !!activeTimetableId,
  });

  // Reports Queries
  const { data: workloadReport = [] } = useQuery({
    queryKey: ['report-workload', activeTimetableId],
    queryFn: () => timetableService.getWorkloadReport(activeTimetableId!),
    enabled: !!activeTimetableId && isReportsModalOpen,
  });

  const { data: roomReport = [] } = useQuery({
    queryKey: ['report-rooms', activeTimetableId],
    queryFn: () => timetableService.getRoomUtilizationReport(activeTimetableId!),
    enabled: !!activeTimetableId && isReportsModalOpen,
  });

  // Period slots for grid display
  const targetShiftId = shiftId || (activeTimetable ? activeTimetable.shift : undefined);
  const { data: periodSlots = [] } = useQuery({
    queryKey: ['period-slots', targetShiftId],
    queryFn: () => academicsService.getPeriodSlots(targetShiftId ? Number(targetShiftId) : undefined),
    enabled: !!targetShiftId,
  });

  // Generation Mutation
  const generateMutation = useMutation({
    mutationFn: (payload: GenerateSchedulePayload) => timetableService.generateSchedule(payload),
    onSuccess: (data) => {
      setGenerationResult(data);
      if (data.validation_report) {
        setValidationReport(data.validation_report);
      }
      if (data.timetable_id) {
        setActiveTimetableId(data.timetable_id);
      }
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    },
    onError: (error: any) => {
      const errData = error.response?.data;
      if (errData) {
        setGenerationResult(errData);
        if (errData.validation_report) {
          setValidationReport(errData.validation_report);
        }
      } else {
        setGenerationResult({
          success: false,
          status: 'ERROR',
          message: error.message || 'Generation request failed',
          sessions_required: 0,
          sessions_scheduled: 0,
          backtracks_count: 0,
          duration_seconds: 0,
          nodes_explored: 0,
          bottlenecks: [],
        });
      }
    },
  });

  // Validate Draft Mutation
  const validateMutation = useMutation({
    mutationFn: (id: number) => timetableService.validateDraft(id),
    onSuccess: (report) => {
      setValidationReport(report);
    },
  });

  // Publish Mutation
  const publishMutation = useMutation({
    mutationFn: (id: number) => timetableService.publishTimetable(id),
    onSuccess: () => {
      refetchTimetable();
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    },
  });

  // Create Revision Mutation
  const createRevisionMutation = useMutation({
    mutationFn: (id: number) => timetableService.createRevision(id),
    onSuccess: (newTt) => {
      setActiveTimetableId(newTt.id);
      refetchTimetable();
      refetchEntries();
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    },
  });

  // Move / Manual Edit Mutation
  const moveEntryMutation = useMutation({
    mutationFn: async ({ entryId, payload }: { entryId: number; payload: any }) => {
      return timetableService.moveEntry(entryId, payload);
    },
    onSuccess: () => {
      setEditingEntry(null);
      setEditError(null);
      refetchEntries();
      refetchTimetable();
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    },
    onError: (error: any) => {
      const err = error.response?.data;
      if (err?.message) {
        setEditError(`${err.conflict_code || 'ERROR'}: ${err.message} ${err.suggested_action ? `(${err.suggested_action})` : ''}`);
      } else if (err?.detail) {
        setEditError(err.detail);
      } else {
        setEditError('Failed to move class session.');
      }
    },
  });

  // Lock/Unlock Entry Mutation
  const toggleLockMutation = useMutation({
    mutationFn: async ({ entryId, isLocked }: { entryId: number; isLocked: boolean }) => {
      if (isLocked) {
        return timetableService.unlockEntry(entryId);
      } else {
        return timetableService.lockEntry(entryId);
      }
    },
    onSuccess: () => {
      refetchEntries();
    },
  });

  const handleGenerate = () => {
    if (!academicYearId) return;

    const payload: GenerateSchedulePayload = {
      academic_year_id: Number(academicYearId),
      shift_id: shiftId ? Number(shiftId) : undefined,
      department_ids: departmentId ? [Number(departmentId)] : [],
      semester_ids: semesterId ? [Number(semesterId)] : [],
      section_ids: selectedSectionIds.length > 0 ? selectedSectionIds : undefined,
      name: timetableName.trim() || undefined,
      notes: notes.trim() || undefined,
      max_backtracks: maxBacktracks,
      timeout_seconds: timeoutSeconds,
      persist: true,
    };

    generateMutation.mutate(payload);
  };

  const handleExportPdf = async () => {
    if (!activeTimetable) return;
    setIsExportingPdf(true);
    try {
      const blob = await timetableService.exportPdf(activeTimetable.id, {
        type: pdfType,
        section_id: pdfSectionId ? Number(pdfSectionId) : undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTimetable.name}_${pdfType}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setIsPdfModalOpen(false);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setTargetSlotId(entry.period_slot);
    setTargetRoomId(entry.room);
    setEditError(null);
  };

  const handleSaveMove = () => {
    if (!editingEntry || !targetSlotId) return;
    moveEntryMutation.mutate({
      entryId: editingEntry.id,
      payload: {
        period_slot_id: Number(targetSlotId),
        room_id: targetRoomId ? Number(targetRoomId) : undefined,
      },
    });
  };

  // Build grid data: Days and unique periods
  const days: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const uniquePeriodNumbers = Array.from(
    new Set(periodSlots.map((s) => s.period_number))
  ).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-600" />
            Automatic Timetable Generation & Editor
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Constraint satisfaction engine (MRV + Forward Checking), interactive slot editing & publication.
          </p>
        </div>
      </div>

      {/* Scope Configuration & Generation Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scope Selection */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-brand-600" />
            1. Academic Scope Selection
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Academic Year *
              </label>
              <select
                aria-label="Academic Year"
                value={academicYearId}
                onChange={(e) => {
                  setAcademicYearId(e.target.value ? Number(e.target.value) : '');
                  setSemesterId('');
                  setSelectedSectionIds([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} {ay.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Shift
              </label>
              <select
                aria-label="Shift"
                value={shiftId}
                onChange={(e) => setShiftId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value="">All Shifts</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                aria-label="Department"
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value ? Number(e.target.value) : '');
                  setSemesterId('');
                  setSelectedSectionIds([]);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Semester
              </label>
              <select
                aria-label="Semester"
                value={semesterId}
                onChange={(e) => {
                  setSemesterId(e.target.value ? Number(e.target.value) : '');
                  setSelectedSectionIds([]);
                }}
                disabled={!academicYearId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sem {s.semester_number} ({s.department_code || 'Dept'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section Selection */}
          {semesterId && sections.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Sections ({selectedSectionIds.length === 0 ? 'All Sections' : `${selectedSectionIds.length} Selected`})
              </label>
              <div className="flex flex-wrap gap-2">
                {sections.map((sec) => {
                  const isSelected = selectedSectionIds.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSectionIds(selectedSectionIds.filter((id) => id !== sec.id));
                        } else {
                          setSelectedSectionIds([...selectedSectionIds, sec.id]);
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-700 font-semibold'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {sec.name} ({sec.student_count} students)
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Engine Settings & Trigger */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-600" />
              2. Engine Optimization
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Timetable Title
              </label>
              <input
                type="text"
                placeholder="e.g. CSE Odd Sem Timetable"
                value={timetableName}
                onChange={(e) => setTimetableName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Scheduling Notes
              </label>
              <textarea
                rows={2}
                placeholder="Administrative guidelines or constraints notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Max Backtracks
                </label>
                <input
                  type="number"
                  min="500"
                  max="50000"
                  step="500"
                  value={maxBacktracks}
                  onChange={(e) => setMaxBacktracks(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Timeout (s)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <Button
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2 py-3 shadow-md shadow-brand-500/20"
              disabled={!academicYearId || generateMutation.isPending}
              onClick={handleGenerate}
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating Schedule...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Timetable
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Generation Results Banner & Metrics */}
      {generationResult && (
        <div className="space-y-4">
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              generationResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            {generationResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {generationResult.success ? 'Generation Succeeded' : `Generation ${generationResult.status}`}
                </span>
                <Badge variant={generationResult.success ? 'success' : 'danger'}>
                  {generationResult.status}
                </Badge>
              </div>
              <p className="text-sm mt-0.5 opacity-90">{generationResult.message}</p>
            </div>
          </div>

          {/* Engine Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Sessions Required</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {generationResult.sessions_required}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Sessions Scheduled</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {generationResult.sessions_scheduled}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Backtracks</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {generationResult.backtracks_count}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Duration</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {generationResult.duration_seconds}s
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Nodes Explored</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {generationResult.nodes_explored}
              </div>
            </div>
          </div>

          {/* Conflict Diagnostics Panel */}
          {generationResult.bottlenecks && generationResult.bottlenecks.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Operational Bottlenecks & Recommendations
              </div>
              <div className="space-y-2">
                {generationResult.bottlenecks.map((b, idx) => (
                  <div key={idx} className="bg-white/80 p-3 rounded-lg border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{b.affected_entity}</span>
                      <Badge variant="warning">{b.category}</Badge>
                    </div>
                    <p className="text-slate-600">{b.summary}</p>
                    <p className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="font-bold">Suggested action:</span> {b.suggested_action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Report Conflicts */}
          {validationReport && validationReport.conflicts && validationReport.conflicts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Independent Validation Conflicts ({validationReport.hard_constraint_violations} Violations)
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {validationReport.conflicts.map((c, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-rose-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-700">{c.conflict_code}</span>
                      <Badge variant="danger">{c.severity}</Badge>
                    </div>
                    <p className="text-slate-700">{c.message}</p>
                    {c.suggested_action && (
                      <p className="text-slate-500 italic">Action: {c.suggested_action}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Timetable Controls & Grid Preview */}
      {activeTimetable && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{activeTimetable.name}</h3>
                <Badge variant={activeTimetable.status === 'PUBLISHED' ? 'success' : 'brand'}>
                  {activeTimetable.status_display || activeTimetable.status}
                </Badge>
                <span className="text-xs text-slate-400">v{activeTimetable.version}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTimetable.academic_year_name} • {activeTimetable.shift_name} • {activeTimetable.entries_count} scheduled slots
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => validateMutation.mutate(activeTimetable.id)}
                disabled={validateMutation.isPending}
                className="gap-1 text-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                Validate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReportsModalOpen(true)}
                className="gap-1 text-xs"
              >
                <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
                Reports
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPdfModalOpen(true)}
                className="gap-1 text-xs"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                Export PDF
              </Button>

              {activeTimetable.status === 'PUBLISHED' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createRevisionMutation.mutate(activeTimetable.id)}
                  disabled={createRevisionMutation.isPending}
                  className="gap-1 text-xs font-semibold text-brand-700 bg-brand-50 border-brand-200"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Fork Revision Draft
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => publishMutation.mutate(activeTimetable.id)}
                  disabled={publishMutation.isPending}
                  className="gap-1 text-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish Timetable
                </Button>
              )}
            </div>
          </div>

          {/* Section Filter */}
          {sections.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filter Section:</span>
              <select
                aria-label="Filter Section"
                value={filterSectionId}
                onChange={(e) => setFilterSectionId(e.target.value ? Number(e.target.value) : '')}
                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs bg-slate-50 text-slate-700"
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Timetable Weekly Grid */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-semibold text-slate-700 w-24">Day</th>
                  {uniquePeriodNumbers.map((pNum) => {
                    const slotExample = periodSlots.find((s) => s.period_number === pNum);
                    return (
                      <th key={pNum} className="py-2.5 px-3 font-semibold text-slate-700 min-w-[140px]">
                        Period {pNum}
                        {slotExample && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {slotExample.start_time.slice(0, 5)} - {slotExample.end_time.slice(0, 5)}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {days.map((day) => {
                  const daySlots = periodSlots.filter((s) => s.day_of_week === day);
                  if (daySlots.length === 0) return null;

                  return (
                    <tr key={day} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-bold text-slate-800 bg-slate-50/80 border-r border-slate-200">
                        {day}
                      </td>
                      {uniquePeriodNumbers.map((pNum) => {
                        const slot = daySlots.find((s) => s.period_number === pNum);
                        if (!slot) {
                          return <td key={pNum} className="py-2 px-2 text-slate-300">-</td>;
                        }

                        if (slot.is_break) {
                          return (
                            <td
                              key={pNum}
                              className="py-2 px-2 bg-slate-100/70 text-slate-400 font-medium text-center border-r border-slate-100"
                            >
                              <span className="italic text-[11px]">{slot.break_label || 'Break'}</span>
                            </td>
                          );
                        }

                        const entry = activeEntries.find(
                          (e) => e.day_of_week === day && e.period_slot === slot.id
                        );

                        if (!entry) {
                          return (
                            <td key={pNum} className="py-2 px-2 text-slate-300 text-center border-r border-slate-100">
                              <span className="text-[11px]">—</span>
                            </td>
                          );
                        }

                        const isLab = entry.subject_type === 'LAB';

                        return (
                          <td
                            key={pNum}
                            className={`py-2 px-2.5 border-r border-slate-100 transition-colors ${
                              isLab ? 'bg-indigo-50/50' : 'bg-white'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900 text-xs">
                                  {entry.subject_code}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isLab && (
                                    <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">
                                      LAB
                                    </span>
                                  )}
                                  <button
                                    title={entry.is_locked ? 'Unlock entry' : 'Lock entry'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLockMutation.mutate({
                                        entryId: entry.id,
                                        isLocked: entry.is_locked,
                                      });
                                    }}
                                    className={`p-0.5 rounded transition-colors ${
                                      entry.is_locked
                                        ? 'text-amber-600 hover:text-amber-700'
                                        : 'text-slate-300 hover:text-slate-500'
                                    }`}
                                  >
                                    {entry.is_locked ? (
                                      <Lock className="h-3 w-3" />
                                    ) : (
                                      <Unlock className="h-3 w-3" />
                                    )}
                                  </button>
                                  {activeTimetable.status !== 'PUBLISHED' && (
                                    <button
                                      title="Edit or move session"
                                      onClick={() => handleOpenEditModal(entry)}
                                      className="p-0.5 rounded text-slate-400 hover:text-brand-600 transition-colors"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] text-slate-600 truncate max-w-[130px]">
                                {entry.subject_name}
                              </span>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                                <span className="truncate max-w-[70px]">{entry.faculty_name}</span>
                                <span className="font-semibold text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                  {entry.room_code}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Slot Edit / Move Modal */}
      {editingEntry && (
        <Modal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          title={`Edit Class Slot — ${editingEntry.subject_code}`}
          description={`Reassign time slot or facility for Section ${editingEntry.section_name}.`}
        >
          <div className="space-y-4">
            {editingEntry.is_locked && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This entry is locked. Unlock it in the grid before reassigning.
              </div>
            )}

            {editError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Validation Conflict
                </div>
                <p className="opacity-95">{editError}</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Period Slot *
                </label>
                <select
                  aria-label="Target Period Slot"
                  value={targetSlotId}
                  onChange={(e) => setTargetSlotId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  {periodSlots
                    .filter((s) => !s.is_break)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.day_of_week} • Period {s.period_number} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Room
                </label>
                <select
                  aria-label="Assigned Room"
                  value={targetRoomId}
                  onChange={(e) => setTargetRoomId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} ({r.name}) • Cap {r.capacity} • {r.room_type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveMove}
                disabled={moveEntryMutation.isPending || editingEntry.is_locked}
              >
                {moveEntryMutation.isPending ? 'Saving...' : 'Apply Move'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PDF Export Modal */}
      {isPdfModalOpen && activeTimetable && (
        <Modal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          title="Export Timetable as PDF"
          description="Generate official collegiate printable schedule in landscape format."
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Schedule View
              </label>
              <select
                aria-label="Schedule View"
                value={pdfType}
                onChange={(e) => setPdfType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
              >
                <option value="section">Section Timetable</option>
                <option value="faculty">Faculty Teaching Schedule</option>
                <option value="room">Room Utilization Schedule</option>
              </select>
            </div>

            {pdfType === 'section' && sections.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Section
                </label>
                <select
                  aria-label="Target Section"
                  value={pdfSectionId}
                  onChange={(e) => setPdfSectionId(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                >
                  <option value="">Default (First Active Section)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setIsPdfModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                {isExportingPdf ? 'Exporting...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reports & Analytics Modal */}
      {isReportsModalOpen && activeTimetable && (
        <Modal
          isOpen={isReportsModalOpen}
          onClose={() => setIsReportsModalOpen(false)}
          title={`Reports & Analytics — ${activeTimetable.name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setReportsTab('workload')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  reportsTab === 'workload'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Faculty Workload ({workloadReport.length})
              </button>
              <button
                onClick={() => setReportsTab('rooms')}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  reportsTab === 'rooms'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Room Utilization ({roomReport.length})
              </button>
            </div>

            {reportsTab === 'workload' ? (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {workloadReport.map((f: any) => (
                  <div key={f.faculty_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{f.faculty_name}</div>
                      <div className="text-slate-500 text-[11px]">{f.employee_id} • {f.department_code}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-brand-700">{f.assigned_periods} / {f.max_weekly_periods} periods</div>
                      <div className="text-slate-400 text-[11px]">{f.utilization_pct}% utilization</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {roomReport.map((r: any) => (
                  <div key={r.room_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{r.room_code} ({r.room_name})</div>
                      <div className="text-slate-500 text-[11px]">{r.room_type} • Cap {r.capacity}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-brand-700">{r.booked_slots} booked</div>
                      <div className="text-slate-400 text-[11px]">{r.utilization_pct}% utilization</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
export default TimetableGenerationPage;
