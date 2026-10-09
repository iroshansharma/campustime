import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facultyService } from '../../services/facultyService';
import { academicsService } from '../../services/academicsService';
import { useAuth } from '../../context/AuthContext';
import { PeriodSlot, DayCode, SingleSlotUpdate } from '../../types';
import { Button } from '../../components/common/Button';
import {
  CalendarDays, Check, X, Star, AlertTriangle, Save,
  RotateCcw, Coffee, CheckCircle2, AlertCircle
} from 'lucide-react';

interface SlotCellState {
  is_available: boolean;
  is_preferred: boolean;
  reason: string;
}

const DAYS_OF_WEEK: { code: DayCode; label: string }[] = [
  { code: 'MON', label: 'Monday' },
  { code: 'TUE', label: 'Tuesday' },
  { code: 'WED', label: 'Wednesday' },
  { code: 'THU', label: 'Thursday' },
  { code: 'FRI', label: 'Friday' },
  { code: 'SAT', label: 'Saturday' },
];

export const FacultyAvailabilityPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedFacultyId, setSelectedFacultyId] = useState<number>(0);
  const [selectedShiftId, setSelectedShiftId] = useState<number>(0);
  const [gridState, setGridState] = useState<Record<number, SlotCellState>>({});
  const [initialGridState, setInitialGridState] = useState<Record<number, SlotCellState>>({});
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch Faculty list (or lock to self if faculty user)
  const { data: facultyList = [], isLoading: facultyLoading } = useQuery({
    queryKey: ['faculty-list'],
    queryFn: () => facultyService.getFaculty(),
    enabled: isAdmin,
  });

  // Determine active faculty ID
  useEffect(() => {
    if (!isAdmin && user?.faculty_profile?.id) {
      setSelectedFacultyId(user.faculty_profile.id);
    } else if (isAdmin) {
      const urlFac = searchParams.get('faculty');
      if (urlFac && !isNaN(Number(urlFac))) {
        setSelectedFacultyId(Number(urlFac));
      } else if (facultyList.length > 0 && selectedFacultyId === 0) {
        setSelectedFacultyId(facultyList[0].id);
      }
    }
  }, [isAdmin, user, facultyList, searchParams, selectedFacultyId]);

  // 2. Fetch Shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const activeShiftId = selectedShiftId || shifts[0]?.id || 0;

  // 3. Fetch Selected Faculty Profile
  const { data: activeFaculty } = useQuery({
    queryKey: ['faculty-detail', selectedFacultyId],
    queryFn: () => facultyService.getFacultyById(selectedFacultyId),
    enabled: selectedFacultyId > 0,
  });

  // 4. Fetch Period Slots for the shift
  const { data: periodSlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['period-slots', activeShiftId],
    queryFn: () => academicsService.getPeriodSlots(activeShiftId || undefined),
    enabled: activeShiftId > 0,
  });

  // 5. Fetch Faculty's existing availability records
  const { data: existingAvailabilities = [], isLoading: availLoading } = useQuery({
    queryKey: ['faculty-availabilities', selectedFacultyId, activeShiftId],
    queryFn: () =>
      facultyService.getAvailabilities({
        faculty: selectedFacultyId,
        shift: activeShiftId,
      }),
    enabled: selectedFacultyId > 0 && activeShiftId > 0,
  });

  // Initialize matrix state when period slots or existing records load
  useEffect(() => {
    if (periodSlots.length === 0) return;

    const newMap: Record<number, SlotCellState> = {};
    const existingMap = new Map<number, { is_available: boolean; is_preferred: boolean; reason: string }>();

    existingAvailabilities.forEach((a) => {
      existingMap.set(a.period_slot, {
        is_available: a.is_available,
        is_preferred: a.is_preferred,
        reason: a.reason || '',
      });
    });

    periodSlots.forEach((slot) => {
      if (slot.is_break) {
        // Breaks are always unavailable
        newMap[slot.id] = { is_available: false, is_preferred: false, reason: slot.break_label || 'Break' };
      } else if (existingMap.has(slot.id)) {
        newMap[slot.id] = existingMap.get(slot.id)!;
      } else {
        // Default for regular slots is available
        newMap[slot.id] = { is_available: true, is_preferred: false, reason: '' };
      }
    });

    setGridState(newMap);
    setInitialGridState(newMap);
    setStatusMessage(null);
  }, [periodSlots, existingAvailabilities]);

  // Compute unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    const keys = Object.keys(gridState);
    if (keys.length === 0 || Object.keys(initialGridState).length === 0) return false;
    return keys.some((k) => {
      const id = Number(k);
      const curr = gridState[id];
      const init = initialGridState[id];
      if (!init || !curr) return false;
      return (
        curr.is_available !== init.is_available ||
        curr.is_preferred !== init.is_preferred ||
        curr.reason !== init.reason
      );
    });
  }, [gridState, initialGridState]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const slotsPayload: SingleSlotUpdate[] = periodSlots
        .filter((slot) => !slot.is_break)
        .map((slot) => {
          const cell = gridState[slot.id] || { is_available: true, is_preferred: false, reason: '' };
          return {
            period_slot_id: slot.id,
            is_available: cell.is_available,
            is_preferred: cell.is_preferred,
            reason: cell.reason || '',
          };
        });

      return facultyService.batchUpdateAvailability({
        faculty_id: selectedFacultyId,
        slots: slotsPayload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faculty-availabilities'] });
      setInitialGridState({ ...gridState });
      setStatusMessage({ type: 'success', text: 'Faculty availability matrix saved successfully.' });
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[] | string> } };
      const msg = axErr.response?.data
        ? JSON.stringify(axErr.response.data)
        : 'Failed to save availability matrix.';
      setStatusMessage({ type: 'error', text: msg });
    },
  });

  // Cycle slot state: Available -> Preferred -> Unavailable -> Available
  const toggleSlot = (slot: PeriodSlot) => {
    if (slot.is_break) return;

    setGridState((prev) => {
      const current = prev[slot.id] || { is_available: true, is_preferred: false, reason: '' };
      let next: SlotCellState;

      if (current.is_available && !current.is_preferred) {
        // Available -> Preferred
        next = { is_available: true, is_preferred: true, reason: current.reason };
      } else if (current.is_available && current.is_preferred) {
        // Preferred -> Unavailable
        next = { is_available: false, is_preferred: false, reason: current.reason || 'Blocked slot' };
      } else {
        // Unavailable -> Available
        next = { is_available: true, is_preferred: false, reason: '' };
      }

      return { ...prev, [slot.id]: next };
    });
  };

  // Bulk Actions
  const markDay = (day: DayCode, available: boolean) => {
    const slotsForDay = periodSlots.filter((s) => s.day_of_week === day && !s.is_break);
    setGridState((prev) => {
      const copy = { ...prev };
      slotsForDay.forEach((s) => {
        copy[s.id] = {
          is_available: available,
          is_preferred: false,
          reason: available ? '' : 'Day blocked',
        };
      });
      return copy;
    });
  };

  const markPeriod = (periodNum: number, available: boolean) => {
    const slotsForPeriod = periodSlots.filter((s) => s.period_number === periodNum && !s.is_break);
    setGridState((prev) => {
      const copy = { ...prev };
      slotsForPeriod.forEach((s) => {
        copy[s.id] = {
          is_available: available,
          is_preferred: false,
          reason: available ? '' : `Period ${periodNum} blocked`,
        };
      });
      return copy;
    });
  };

  const markAll = (available: boolean) => {
    setGridState((prev) => {
      const copy = { ...prev };
      periodSlots.forEach((s) => {
        if (!s.is_break) {
          copy[s.id] = {
            is_available: available,
            is_preferred: false,
            reason: available ? '' : 'Mass blocked',
          };
        }
      });
      return copy;
    });
  };

  const resetChanges = () => {
    setGridState({ ...initialGridState });
    setStatusMessage(null);
  };

  // Distinct period numbers for columns
  const distinctPeriodNumbers = useMemo(() => {
    const set = new Set<number>();
    periodSlots.forEach((s) => set.add(s.period_number));
    return Array.from(set).sort((a, b) => a - b);
  }, [periodSlots]);

  // Calculate available slot counts
  const availableSlotsCount = useMemo(() => {
    return Object.values(gridState).filter((s) => s.is_available).length;
  }, [gridState]);

  const preferredSlotsCount = useMemo(() => {
    return Object.values(gridState).filter((s) => s.is_preferred).length;
  }, [gridState]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-600" />
            Weekly Faculty Availability Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define teaching availability and preferred time slots by day and period.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={resetChanges}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save Matrix Changes'}
          </Button>
        </div>
      </div>

      {/* Unsaved Changes Alert Banner */}
      {hasUnsavedChanges && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between text-amber-800 dark:text-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>You have unsaved changes in the availability matrix. Click "Save Matrix Changes" to apply.</span>
          </div>
          <Button size="sm" variant="primary" onClick={() => saveMutation.mutate()}>
            Save Now
          </Button>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3 text-sm rounded-xl border flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Context Selection Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Faculty Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Faculty Member
          </label>
          {isAdmin ? (
            <select
              value={selectedFacultyId}
              onChange={(e) => {
                const newId = Number(e.target.value);
                setSelectedFacultyId(newId);
                setSearchParams({ faculty: String(newId) });
              }}
              disabled={facultyLoading}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.user_details?.first_name} {f.user_details?.last_name} ({f.employee_id}) - {f.department_code}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm font-semibold text-slate-900 dark:text-white py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {activeFaculty
                ? `${activeFaculty.user_details?.first_name} ${activeFaculty.user_details?.last_name} (${activeFaculty.employee_id})`
                : 'My Profile'}
            </div>
          )}
        </div>

        {/* Shift Context */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Active Shift Schedule
          </label>
          <select
            value={activeShiftId}
            onChange={(e) => setSelectedShiftId(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
              </option>
            ))}
          </select>
        </div>

        {/* Workload Profile Summary */}
        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-2 md:pt-0 md:pl-4">
          <div>
            <div className="text-xs text-slate-500">Max Daily Periods</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {activeFaculty?.max_daily_periods ?? 4}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Max Weekly Limit</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {activeFaculty?.max_weekly_periods ?? 18}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Slots Available</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {availableSlotsCount} <span className="text-xs text-amber-500 font-normal">({preferredSlotsCount} pref)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Bulk Control Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-500">Legend:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-600">
              <Check className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700 dark:text-slate-300">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-600">
              <Star className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700 dark:text-slate-300">Preferred</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-600">
              <X className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-700 dark:text-slate-300">Unavailable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-slate-800/40 border border-slate-700 flex items-center justify-center text-slate-500">
              <Coffee className="w-2.5 h-2.5" />
            </div>
            <span className="text-slate-500">Recess / Break</span>
          </div>
        </div>

        {/* Global Bulk Toggles */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Global:</span>
          <Button variant="outline" size="sm" onClick={() => markAll(true)}>
            Mark All Available
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll(false)}>
            Block All Slots
          </Button>
        </div>
      </div>

      {/* Interactive Matrix Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-x-auto">
        {slotsLoading || availLoading ? (
          <div className="p-12 text-center text-slate-500">
            Loading schedule and availability records...
          </div>
        ) : periodSlots.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No period slots configured for the selected shift. Please configure period slots under Academic Setup.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 text-left font-bold text-slate-700 dark:text-slate-300 w-36">
                  Day / Period
                </th>
                {distinctPeriodNumbers.map((pNum) => {
                  const sampleSlot = periodSlots.find((s) => s.period_number === pNum);
                  return (
                    <th
                      key={pNum}
                      className="p-3 text-center border-l border-slate-200 dark:border-slate-800 min-w-[110px]"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">Period {pNum}</div>
                      {sampleSlot && (
                        <div className="text-[11px] text-slate-500 font-normal">
                          {sampleSlot.start_time.slice(0, 5)} - {sampleSlot.end_time.slice(0, 5)}
                        </div>
                      )}
                      {/* Column Bulk Toggle */}
                      <div className="mt-1 flex items-center justify-center gap-1">
                        <button
                          onClick={() => markPeriod(pNum, true)}
                          title={`Mark Period ${pNum} available on all days`}
                          className="px-1 py-0.5 text-[10px] rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300"
                        >
                          All Open
                        </button>
                        <button
                          onClick={() => markPeriod(pNum, false)}
                          title={`Block Period ${pNum} on all days`}
                          className="px-1 py-0.5 text-[10px] rounded bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300"
                        >
                          Block
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {DAYS_OF_WEEK.map((day) => {
                return (
                  <tr
                    key={day.code}
                    className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                  >
                    {/* Day Column Header with Bulk Row Toggles */}
                    <td className="p-3 font-semibold text-slate-900 dark:text-white bg-slate-50/80 dark:bg-slate-800/40">
                      <div>{day.label}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <button
                          onClick={() => markDay(day.code, true)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          All Open
                        </button>
                        <button
                          onClick={() => markDay(day.code, false)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        >
                          Block Day
                        </button>
                      </div>
                    </td>

                    {/* Period Slot Cells */}
                    {distinctPeriodNumbers.map((pNum) => {
                      const slot = periodSlots.find(
                        (s) => s.day_of_week === day.code && s.period_number === pNum
                      );

                      if (!slot) {
                        return (
                          <td
                            key={pNum}
                            className="p-3 text-center border-l border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-100/30 dark:bg-slate-800/20"
                          >
                            —
                          </td>
                        );
                      }

                      if (slot.is_break) {
                        return (
                          <td
                            key={pNum}
                            className="p-2 border-l border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed select-none"
                          >
                            <div className="h-16 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-500">
                              <Coffee className="w-4 h-4 mb-1" />
                              <span className="text-[11px] font-medium">
                                {slot.break_label || 'Break'}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      const cell = gridState[slot.id] || {
                        is_available: true,
                        is_preferred: false,
                        reason: '',
                      };

                      const isAvail = cell.is_available;
                      const isPref = cell.is_preferred;

                      return (
                        <td
                          key={pNum}
                          className="p-2 border-l border-slate-200 dark:border-slate-800 text-center"
                        >
                          <button
                            type="button"
                            onClick={() => toggleSlot(slot)}
                            className={`w-full h-16 rounded-lg p-2 transition-all flex flex-col items-center justify-between border select-none group relative ${
                              isPref
                                ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-sm'
                                : isAvail
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300'
                            }`}
                            title={
                              isPref
                                ? 'Preferred Slot (Click to Block)'
                                : isAvail
                                ? 'Available Slot (Click to make Preferred)'
                                : `Unavailable: ${cell.reason || 'Blocked'} (Click to make Available)`
                            }
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-semibold opacity-75">
                                P{slot.period_number}
                              </span>
                              {isPref ? (
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              ) : isAvail ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                              )}
                            </div>

                            <span className="text-xs font-bold tracking-tight">
                              {isPref ? 'Preferred' : isAvail ? 'Available' : 'Blocked'}
                            </span>

                            {!isAvail && cell.reason && (
                              <span className="text-[10px] truncate max-w-[90px] opacity-75">
                                {cell.reason}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
