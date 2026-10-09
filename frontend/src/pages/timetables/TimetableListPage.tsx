import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarRange, Sparkles, Eye, Clock, FileText } from 'lucide-react';
import { timetableService } from '../../services/timetableService';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Timetable } from '../../types';

export const TimetableListPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: timetables = [], isLoading } = useQuery<Timetable[]>({
    queryKey: ['timetables', statusFilter],
    queryFn: () => timetableService.getTimetables(statusFilter ? { status: statusFilter } : undefined),
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-brand-600" />
            Institutional Timetables
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, manage, and inspect published college schedules and working drafts.
          </p>
        </div>

        <Link to="/timetables/generate">
          <Button variant="primary" className="gap-2 shadow-sm">
            <Sparkles className="h-4 w-4" />
            Generate Timetable
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['', 'DRAFT', 'PUBLISHED', 'ARCHIVED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st ? st : 'All Schedules'}
          </button>
        ))}
      </div>

      {/* Timetables Table / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading timetables...</div>
      ) : timetables.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <CalendarRange className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700">No Timetables Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No institutional timetables match the current filter. Use the Automatic Generation engine to construct one.
          </p>
          <Link to="/timetables/generate">
            <Button variant="outline" size="sm" className="gap-1 mt-2">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" />
              Generate First Timetable
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {timetables.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={t.status === 'PUBLISHED' ? 'success' : 'brand'}>
                    {t.status_display || t.status}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-400">v{t.version}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 line-clamp-1">{t.name}</h3>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
                    <span>{t.academic_year_name} • {t.shift_name}</span>
                  </div>
                  {t.department_name && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.department_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{t.entries_count} scheduled slots</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {new Date(t.created_at).toLocaleDateString()}
                </span>
                <Link to="/timetables/generate">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Inspect / Edit
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default TimetableListPage;
