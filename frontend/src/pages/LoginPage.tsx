import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { Lock, User as UserIcon, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsWakingUp(false);

    // If request takes more than 3.5s, inform the user about Render free-tier spin-up
    const wakeUpTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3500);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axErr = err as { response?: { status?: number; data?: { detail?: string } } };
        if (axErr.response?.status === 401) {
          setError('Invalid username or password. Please verify credentials.');
        } else {
          setError(axErr.response?.data?.detail || 'Unable to authenticate. Please check backend connection.');
        }
      } else {
        setError('Network error connecting to API server (https://campustime.onrender.com). If the free instance was sleeping, please wait ~30 seconds and retry.');
      }
    } finally {
      clearTimeout(wakeUpTimer);
      setIsLoading(false);
      setIsWakingUp(false);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8">
      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <span className="text-xl font-bold tracking-wider">CT</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            CampusTime Portal
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Smart College Timetable Management System
          </p>
        </div>

        {/* Demo Fast-Login Chips */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Quick Demo Credentials</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin', 'AdminPass@123')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 transition-colors shadow-sm"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('dr.sharma', 'FacultyPass@123')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-sm"
            >
              Faculty
            </button>
            <button
              type="button"
              onClick={() => fillCredentials('student1', 'StudentPass@123')}
              className="px-2 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors shadow-sm"
            >
              Student
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Username
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or faculty"
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-sm"
                required
              />
            </div>
          </div>

          {isWakingUp && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 animate-pulse">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Connecting to backend... Free cloud instances wake up on first request (~30–50s). Please hold on!</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-2.5 text-sm"
            isLoading={isLoading}
          >
            Sign In to Portal
          </Button>
        </form>

        <div className="text-center text-xs text-slate-400">
          Role-Based Access Protected &bull; SimpleJWT Secured
        </div>
      </div>
    </div>
  );
};
