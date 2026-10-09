import React from 'react';
import { Menu, Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';

interface NavbarProps {
  onMobileMenuClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMobileMenuClick }) => {
  const { user, isAdmin, isFaculty } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand-600 hidden sm:block" />
          <span className="text-sm font-semibold text-slate-700">
            ADGIPS Institutional Portal
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Academic status pill */}
        <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Academic Year 2024-2025 (Active)</span>
        </div>

        {/* Notification bell icon */}
        <button
          className="relative rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex flex-col text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
            </span>
            <span className="text-[11px] text-slate-500">
              {user?.email}
            </span>
          </div>

          <Badge variant={isAdmin ? 'brand' : isFaculty ? 'success' : 'slate'}>
            {user?.role}
          </Badge>
        </div>
      </div>
    </header>
  );
};
