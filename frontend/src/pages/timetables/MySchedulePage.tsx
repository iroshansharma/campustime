import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Download, Clock, MapPin, User as UserIcon, BookOpen, AlertCircle } from 'lucide-react';
import { timetableService } from '../../services/timetableService';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { TimetableEntry, DayCode } from '../../types';

export const MySchedulePage: React.FC = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => timetableService.getMySchedule(),
  });

  const handleDownloadPdf = async () => {
    if (!data?.has_schedule) return;

    try {
      let blob: Blob;
      let filename = 'Timetable.pdf';

      if (data.role === 'STUDENT' && data.timetable) {
        blob = await timetableService.exportPdf(data.timetable.id, {
          type: 'section',
          section_id: user?.student_profile?.section_id,
        });
        filename = `${data.timetable.name || 'Section'}_Timetable.pdf`;
      } else if (data.role === 'FACULTY') {
        const firstEntry = data.entries?.[0];
        if (!firstEntry) return;
        blob = await timetableService.exportPdf(firstEntry.timetable, {
          type: 'faculty',
          faculty_id: user?.faculty_profile?.id,
        });
        filename = `Teaching_Schedule_${data.faculty_name || 'Faculty'}.pdf`;
      } else {
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const days: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const entries: TimetableEntry[] = data?.entries || [];

  // Group entries by day
  const entriesByDay: Record<string, TimetableEntry[]> = {};
  entries.forEach((e) => {
    if (!entriesByDay[e.day_of_week]) {
      entriesByDay[e.day_of_week] = [];
    }
    entriesByDay[e.day_of_week].push(e);
  });

  // Sort by period_number
  Object.keys(entriesByDay).forEach((d) => {
    entriesByDay[d].sort((a, b) => (a.period_number || 0) - (b.period_number || 0));
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarRange className="h-6 w-6 text-brand-600" />
            My Weekly Schedule
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {data?.role === 'STUDENT'
              ? `Official class timetable for Section ${data.section_name || ''}`
              : data?.role === 'FACULTY'
              ? `Teaching periods and laboratory allocations for Prof. ${data.faculty_name || ''}`
              : 'Institutional schedule view'}
          </p>
        </div>

        {data?.has_schedule && (
          <Button variant="primary" onClick={handleDownloadPdf} className="gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            Download Official PDF
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading your schedule...</div>
      ) : !data?.has_schedule ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-700">No Published Timetable Available</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {data?.message || 'Your section or department does not have an active published timetable yet. Please check back once released by administration.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Schedule Info Card */}
          {data.timetable && (
            <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-brand-900">
              <div className="flex items-center gap-2 font-semibold">
                <span className="text-sm font-bold">{data.timetable.name}</span>
                <Badge variant="success">PUBLISHED</Badge>
                <span className="text-brand-600">v{data.timetable.version}</span>
              </div>
              <div className="text-brand-700">
                {data.timetable.academic_year_name} • {data.timetable.shift_name}
              </div>
            </div>
          )}

          {/* Daily Schedule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {days.map((day) => {
              const dayEntries = entriesByDay[day] || [];
              if (dayEntries.length === 0) return null;

              return (
                <div
                  key={day}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-sm text-slate-900">{day}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {dayEntries.length} Classes
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {dayEntries.map((e) => {
                      const isLab = e.subject_type === 'LAB';
                      return (
                        <div
                          key={e.id}
                          className={`p-3 rounded-lg border text-xs space-y-1.5 transition-colors ${
                            isLab
                              ? 'bg-indigo-50/60 border-indigo-150 text-indigo-950'
                              : 'bg-slate-50/80 border-slate-200/80 text-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">{e.subject_code}</span>
                            <div className="flex items-center gap-1">
                              {isLab && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-200 text-indigo-800">
                                  LAB
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}
                              </span>
                            </div>
                          </div>

                          <div className="font-medium text-slate-700 truncate">
                            {e.subject_name}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span className="flex items-center gap-1 truncate max-w-[140px]">
                              {data.role === 'STUDENT' ? (
                                <>
                                  <UserIcon className="h-3 w-3 text-slate-400" />
                                  {e.faculty_name}
                                </>
                              ) : (
                                <>
                                  <BookOpen className="h-3 w-3 text-slate-400" />
                                  Sec {e.section_name}
                                </>
                              )}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {e.room_code}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
export default MySchedulePage;
