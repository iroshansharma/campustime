import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { PeriodSlot, DayCode } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Edit2, Trash2 } from 'lucide-react';

export const PeriodSlotsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PeriodSlot | null>(null);

  const [selectedShift, setSelectedShift] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<string>('');

  const [shiftId, setShiftId] = useState<number>(0);
  const [dayOfWeek, setDayOfWeek] = useState<DayCode>('MON');
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isBreak, setIsBreak] = useState(false);
  const [breakLabel, setBreakLabel] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const activeShiftId = selectedShift || shifts[0]?.id || 0;

  const { data: periodSlots = [], isLoading } = useQuery({
    queryKey: ['period-slots', activeShiftId, selectedDay],
    queryFn: () => academicsService.getPeriodSlots(activeShiftId || undefined, selectedDay || undefined),
    enabled: !!activeShiftId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<PeriodSlot>) => {
      if (editingSlot) {
        return academicsService.updatePeriodSlot(editingSlot.id, payload);
      }
      return academicsService.createPeriodSlot(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-slots'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save period slot.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: academicsService.deletePeriodSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['period-slots'] });
    },
  });

  const openCreateModal = () => {
    setEditingSlot(null);
    setShiftId(activeShiftId);
    setDayOfWeek((selectedDay as DayCode) || 'MON');
    setPeriodNumber(1);
    setStartTime('08:30');
    setEndTime('09:25');
    setIsBreak(false);
    setBreakLabel('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (slot: PeriodSlot) => {
    setEditingSlot(slot);
    setShiftId(slot.shift);
    setDayOfWeek(slot.day_of_week);
    setPeriodNumber(slot.period_number);
    setStartTime(slot.start_time.slice(0, 5));
    setEndTime(slot.end_time.slice(0, 5));
    setIsBreak(slot.is_break);
    setBreakLabel(slot.break_label || '');
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSlot(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startTime >= endTime) {
      setFormError('Period start time must be before end time.');
      return;
    }
    saveMutation.mutate({
      shift: shiftId,
      day_of_week: dayOfWeek,
      period_number: periodNumber,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      is_break: isBreak,
      break_label: isBreak ? breakLabel || 'Break' : '',
    });
  };

  const columns: Column<PeriodSlot>[] = [
    {
      header: 'Period #',
      accessorKey: 'period_number',
      cell: (item) => (
        <span className="font-mono font-bold text-slate-900">
          Period {item.period_number}
        </span>
      ),
    },
    {
      header: 'Day',
      accessorKey: 'day_of_week_display',
      cell: (item) => (
        <span className="font-medium text-slate-700">
          {item.day_of_week_display || item.day_of_week}
        </span>
      ),
    },
    {
      header: 'Duration',
      cell: (item) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
        </span>
      ),
    },
    {
      header: 'Slot Type',
      cell: (item) =>
        item.is_break ? (
          <Badge variant="warning">{item.break_label || 'Break Slot'}</Badge>
        ) : (
          <Badge variant="brand">Lecture Period</Badge>
        ),
    },
    { header: 'Shift', accessorKey: 'shift_name' },
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
                if (window.confirm(`Delete period ${item.period_number}?`)) {
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
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Shift:</label>
          <select
            value={activeShiftId}
            onChange={(e) => setSelectedShift(Number(e.target.value))}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Day:</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Days</option>
            <option value="MON">Monday</option>
            <option value="TUE">Tuesday</option>
            <option value="WED">Wednesday</option>
            <option value="THU">Thursday</option>
            <option value="FRI">Friday</option>
            <option value="SAT">Saturday</option>
          </select>
        </div>
      </div>

      <DataTable
        title="Period Slots & Breaks"
        description="Daily teaching periods and break slot schedules."
        columns={columns}
        data={periodSlots}
        isLoading={isLoading}
        onAddClick={isAdmin ? openCreateModal : undefined}
        addLabel="Add Period Slot"
        searchFilter={(item, q) =>
          item.period_number.toString().includes(q) ||
          (item.break_label || '').toLowerCase().includes(q)
        }
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingSlot ? 'Edit Period Slot' : 'Add New Period Slot'}
        description="Define start/end times and lecture/break designations."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Shift *
            </label>
            <select
              value={shiftId}
              onChange={(e) => setShiftId(Number(e.target.value))}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              required
            >
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Day of Week *
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayCode)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              >
                <option value="MON">Monday</option>
                <option value="TUE">Tuesday</option>
                <option value="WED">Wednesday</option>
                <option value="THU">Thursday</option>
                <option value="FRI">Friday</option>
                <option value="SAT">Saturday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Period Number (1..N) *
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                required
              />
            </div>
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
              id="isBreakSlot"
              checked={isBreak}
              onChange={(e) => setIsBreak(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isBreakSlot" className="text-xs font-medium text-slate-700">
              Is Break Slot (e.g. Lunch Break, Recess)
            </label>
          </div>

          {isBreak && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Break Label
              </label>
              <input
                type="text"
                value={breakLabel}
                onChange={(e) => setBreakLabel(e.target.value)}
                placeholder="e.g. Lunch Break"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saveMutation.isPending}>
              {editingSlot ? 'Update Period Slot' : 'Create Period Slot'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
