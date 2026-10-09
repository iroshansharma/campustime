import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicsService } from '../../services/academicsService';
import { WorkingDay } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';

export const WorkingDaysPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['working-days'],
    queryFn: () => academicsService.getWorkingDays(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (day: WorkingDay) => {
      return academicsService.updateWorkingDay(day.id, { is_active: !day.is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-days'] });
    },
  });

  const columns: Column<WorkingDay>[] = [
    {
      header: 'Working Day',
      accessorKey: 'day_display',
      cell: (item) => (
        <span className="font-semibold text-slate-900">
          {item.day_display || item.day}
        </span>
      ),
    },
    { header: 'Code', accessorKey: 'day', className: 'font-mono text-xs' },
    { header: 'Order in Week', accessorKey: 'order' },
    {
      header: 'Status',
      cell: (item) => (
        <Badge variant={item.is_active ? 'success' : 'slate'}>
          {item.is_active ? 'Active Working Day' : 'Weekend / Off'}
        </Badge>
      ),
    },
    {
      header: 'Toggle',
      cell: (item) =>
        isAdmin ? (
          <button
            onClick={() => toggleMutation.mutate(item)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors"
          >
            {item.is_active ? 'Deactivate' : 'Activate'}
          </button>
        ) : (
          <span className="text-xs text-slate-400 italic">Read-only</span>
        ),
    },
  ];

  return (
    <DataTable
      title="Institutional Working Days"
      description="Weekly schedule days (Monday through Saturday) available for timetable period scheduling."
      columns={columns}
      data={days}
      isLoading={isLoading}
      searchFilter={(item, q) =>
        (item.day_display || item.day).toLowerCase().includes(q)
      }
    />
  );
};
