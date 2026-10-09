import React from 'react';

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'slate';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    brand: 'bg-brand-50 text-brand-700 ring-brand-700/10',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    danger: 'bg-rose-50 text-rose-700 ring-rose-600/10',
    slate: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
