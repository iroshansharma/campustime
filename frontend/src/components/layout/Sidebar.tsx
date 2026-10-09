import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CalendarRange, Clock,
  CalendarDays, Layers, BookOpen, Users, LogOut,
  ChevronLeft, ChevronRight, GraduationCap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}) => {
  const { user, isAdmin, isFaculty, logout } = useAuth();

  const adminNav = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Faculty Directory', to: '/faculty/members', icon: Users },
    { label: 'Availability Matrix', to: '/faculty/availability', icon: CalendarDays },
    { label: 'Qualifications', to: '/faculty/qualifications', icon: GraduationCap },
    { label: 'Subject Allocations', to: '/faculty/allocations', icon: BookOpen },
    { label: 'Workload Overview', to: '/faculty/workload', icon: Layers },
    { label: 'Rooms & Labs', to: '/rooms', icon: Building2 },
    { label: 'Colleges', to: '/academics/colleges', icon: Building2 },
    { label: 'Academic Years', to: '/academics/academic-years', icon: CalendarRange },
    { label: 'Shifts', to: '/academics/shifts', icon: Clock },
    { label: 'Working Days', to: '/academics/working-days', icon: CalendarDays },
    { label: 'Period Slots', to: '/academics/period-slots', icon: Clock },
    { label: 'Departments', to: '/academics/departments', icon: Layers },
    { label: 'Semesters', to: '/academics/semesters', icon: GraduationCap },
    { label: 'Sections', to: '/academics/sections', icon: Users },
    { label: 'Subjects', to: '/academics/subjects', icon: BookOpen },
  ];

  const facultyNav = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'My Availability', to: '/faculty/availability', icon: CalendarDays },
    { label: 'Workload Overview', to: '/faculty/workload', icon: Layers },
    { label: 'Departments', to: '/academics/departments', icon: Layers },
    { label: 'Subjects', to: '/academics/subjects', icon: BookOpen },
  ];

  const studentNav = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'My Section', to: '/academics/sections', icon: Users },
    { label: 'Subjects', to: '/academics/subjects', icon: BookOpen },
  ];

  const navItems = isAdmin ? adminNav : isFaculty ? facultyNav : studentNav;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out lg:static ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white font-bold shadow-md shadow-brand-500/20">
              CT
            </div>
            {!collapsed && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-base font-bold text-white tracking-tight truncate">
                  CampusTime
                </span>
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  Timetable System
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onToggle}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  } ${collapsed ? 'justify-center' : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800">
          <div
            className={`flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 font-bold text-xs ring-1 ring-brand-500/30">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-white truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
                </span>
                <span className="text-[10px] text-slate-400">
                  <Badge variant={isAdmin ? 'brand' : isFaculty ? 'success' : 'slate'} className="scale-90 origin-left">
                    {user?.role}
                  </Badge>
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-400 transition-colors p-1 rounded-md"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
