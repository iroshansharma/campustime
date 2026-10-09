import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center p-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mb-4 ring-8 ring-rose-50">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Restricted</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-md">
        Your current account role does not have administrative permissions to view or modify this resource.
      </p>
      <div className="mt-6">
        <Link to="/dashboard">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
