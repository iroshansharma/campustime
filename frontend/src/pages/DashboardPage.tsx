import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarRange, Clock, Layers,
  GraduationCap, BookOpen, Users, ArrowUpRight,
  Sparkles, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { academicsService } from '../services/academicsService';
import { Badge } from '../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const { user, isAdmin, isFaculty, isStudent } = useAuth();

  // Live queries for real academic metrics
  const { data: colleges, isLoading: loadingColleges } = useQuery({
    queryKey: ['colleges'],
    queryFn: academicsService.getColleges,
  });

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicsService.getAcademicYears(),
  });

  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => academicsService.getShifts(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => academicsService.getDepartments(),
  });

  const { data: semesters } = useQuery({
    queryKey: ['semesters'],
    queryFn: () => academicsService.getSemesters(),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => academicsService.getSections(),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => academicsService.getSubjects(),
  });

  const activeCollege = colleges?.[0];
  const activeYear = academicYears?.find((ay) => ay.is_current) || academicYears?.[0];

  const statCards = [
    {
      title: 'Academic Departments',
      value: departments?.length ?? 0,
      link: '/academics/departments',
      icon: Layers,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      title: 'Configured Shifts',
      value: shifts?.length ?? 0,
      link: '/academics/shifts',
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      title: 'Active Semesters',
      value: semesters?.length ?? 0,
      link: '/academics/semesters',
      icon: GraduationCap,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Student Sections',
      value: sections?.length ?? 0,
      link: '/academics/sections',
      icon: Users,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    {
      title: 'Curriculum Subjects',
      value: subjects?.length ?? 0,
      link: '/academics/subjects',
      icon: BookOpen,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
    },
    {
      title: 'Academic Years',
      value: academicYears?.length ?? 0,
      link: '/academics/academic-years',
      icon: CalendarRange,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="brand" className="bg-brand-500/20 text-brand-300 ring-brand-400/30">
                Institutional Portal
              </Badge>
              {activeYear && (
                <span className="text-xs text-slate-300 font-medium">
                  Cycle: {activeYear.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {user?.first_name || user?.username}
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-xl">
              {isAdmin
                ? 'Manage departments, shifts, sections, curriculum subjects, and timetable constraints.'
                : isFaculty
                ? `Faculty profile active for Department of ${user?.faculty_profile?.department_name || 'Engineering'}.`
                : `Student enrolled in Section ${user?.student_profile?.section_name || 'A'}.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeCollege && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-right">
                <span className="block text-[11px] text-slate-300 font-medium uppercase tracking-wider">
                  Affiliated Institution
                </span>
                <span className="text-sm font-semibold text-white">
                  {activeCollege.name} ({activeCollege.code})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Role-Specific Overview Info */}
      {isFaculty && user?.faculty_profile && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-sm text-emerald-900">
              <span className="font-semibold">Faculty Profile:</span> {user.faculty_profile.designation} &bull;{' '}
              ID: <span className="font-mono font-medium">{user.faculty_profile.employee_id}</span> &bull;{' '}
              Max Weekly Load: {user.faculty_profile.max_weekly_periods} periods (Daily Limit: {user.faculty_profile.max_daily_periods} periods)
            </div>
          </div>
        </div>
      )}

      {isStudent && user?.student_profile && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="text-sm text-blue-900">
              <span className="font-semibold">Student Record:</span> Enrollment Number{' '}
              <span className="font-mono font-medium">{user.student_profile.enrollment_number}</span> &bull;{' '}
              Section: {user.student_profile.section_name} ({user.student_profile.department_code})
            </div>
          </div>
        </div>
      )}

      {/* Admin KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className="group relative rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {card.title}
                  </span>
                  <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">
                    {loadingColleges ? '...' : card.value}
                  </div>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700">
                <span>View configuration</span>
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Workflow Phase Guidance */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Timetable Administration Setup Status</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Follow the sequential configuration steps before initiating timetable generation:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">1</span>
              <span className="text-slate-700 font-medium">Colleges & Academic Years configured</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">2</span>
              <span className="text-slate-700 font-medium">Shifts & Period Slots ready</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">3</span>
              <span className="text-slate-700 font-medium">Departments & Sections linked</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">4</span>
              <span className="text-slate-700 font-medium">Theory & Lab Subjects defined</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold text-[10px]">5</span>
              <span className="text-slate-700 font-medium">Faculty Allocation (Phase 5)</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">6</span>
              <span className="text-slate-500">Timetable CSP Engine (Phase 6)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
