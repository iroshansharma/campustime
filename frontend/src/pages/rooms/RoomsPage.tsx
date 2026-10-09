import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsService } from '../../services/roomsService';
import { academicsService } from '../../services/academicsService';
import { Room, RoomType } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { Building2, Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<string>('');
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [roomType, setRoomType] = useState<RoomType>('CLASSROOM');
  const [capacity, setCapacity] = useState<number>(60);
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState<number>(1);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: colleges = [] } = useQuery({
    queryKey: ['colleges'],
    queryFn: () => academicsService.getColleges(),
  });

  const activeCollegeId = colleges[0]?.id || 0;

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['rooms-list', selectedType, minCapacity],
    queryFn: () =>
      roomsService.getRooms({
        room_type: selectedType || undefined,
        min_capacity: minCapacity || undefined,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Room>) => {
      if (editingRoom) {
        return roomsService.updateRoom(editingRoom.id, payload);
      }
      return roomsService.createRoom(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-list'] });
      closeModal();
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: Record<string, string[]> } };
      const msg = axErr.response?.data
        ? Object.entries(axErr.response.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ')
        : 'Failed to save room.';
      setFormError(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: roomsService.deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms-list'] });
    },
  });

  const openCreateModal = () => {
    setEditingRoom(null);
    setName('');
    setCode('');
    setRoomType('CLASSROOM');
    setCapacity(60);
    setBuilding('');
    setFloor(1);
    setDepartmentId(null);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (r: Room) => {
    setEditingRoom(r);
    setName(r.name);
    setCode(r.code);
    setRoomType(r.room_type);
    setCapacity(r.capacity);
    setBuilding(r.building || '');
    setFloor(r.floor || 1);
    setDepartmentId(r.department || null);
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRoom(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (capacity <= 0) {
      setFormError('Capacity must be greater than zero.');
      return;
    }
    saveMutation.mutate({
      college: activeCollegeId,
      name,
      code,
      room_type: roomType,
      capacity,
      building,
      floor,
      department: departmentId || null,
      is_active: true,
    });
  };

  const columns: Column<Room>[] = [
    {
      header: 'Code',
      accessorKey: 'code',
      className: 'font-mono text-xs font-bold text-brand-600 dark:text-brand-400',
    },
    {
      header: 'Room Name',
      accessorKey: 'name',
      className: 'font-semibold text-slate-900 dark:text-white',
    },
    {
      header: 'Type',
      cell: (r: Room) => (
        <Badge
          variant={
            r.room_type === 'LAB'
              ? 'warning'
              : r.room_type === 'SEMINAR_HALL'
              ? 'brand'
              : 'slate'
          }
        >
          {r.room_type_display || r.room_type}
        </Badge>
      ),
    },
    {
      header: 'Capacity',
      cell: (r: Room) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {r.capacity} seats
        </span>
      ),
    },
    {
      header: 'Location',
      cell: (r: Room) => <span>{r.building ? `${r.building}, ` : ''}Floor {r.floor}</span>,
    },
    {
      header: 'Dedicated Department',
      cell: (r: Room) => <span>{r.department_code || 'Campus-wide Shared'}</span>,
    },
    {
      header: 'Actions',
      cell: (r: Room) =>
        isAdmin ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEditModal(r)}
              className="p-1.5 text-slate-400 hover:text-brand-600 rounded transition-colors"
              title="Edit Room"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete room ${r.code}?`)) {
                  deleteMutation.mutate(r.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
              title="Delete Room"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            Rooms & Labs Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Maintain campus learning spaces, capacity sizes, and laboratory room configurations.
          </p>
        </div>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Room
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-wrap gap-4 items-center">
        <div className="w-48">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Filter by Room Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value="">All Room Types</option>
            <option value="CLASSROOM">Classrooms</option>
            <option value="LAB">Laboratories</option>
            <option value="SEMINAR_HALL">Seminar Halls</option>
          </select>
        </div>

        <div className="w-44">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Min Seating Capacity
          </label>
          <input
            type="number"
            min={0}
            step={10}
            value={minCapacity}
            onChange={(e) => setMinCapacity(Number(e.target.value))}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            placeholder="e.g. 40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          title="Rooms & Laboratories"
          columns={columns}
          data={rooms}
          isLoading={isLoading}
          searchPlaceholder="Search rooms by name, code, or building..."
        />
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingRoom ? `Edit Room ${editingRoom.code}` : 'Add Room or Laboratory'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Room Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="e.g. LH-101"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Room Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Lecture Hall 1"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Room Type
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as RoomType)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="CLASSROOM">Classroom / Lecture Hall</option>
                <option value="LAB">Computer / Hardware Lab</option>
                <option value="SEMINAR_HALL">Seminar Hall</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seating Capacity
              </label>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Building
              </label>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g. Block A"
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Floor Number
              </label>
              <input
                type="number"
                value={floor}
                onChange={(e) => setFloor(Number(e.target.value))}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dedicated Department (Optional)
            </label>
            <select
              value={departmentId || 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDepartmentId(val === 0 ? null : val);
              }}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value={0}>Shared / Campus-Wide</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Room'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
