import React, { useState } from 'react';
import { Search, Loader2, Plus, Inbox } from 'lucide-react';
import { Button } from './Button';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  title: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  isLoading: boolean;
  onAddClick?: () => void;
  addLabel?: string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
}

export function DataTable<T extends { id: number }>({
  title,
  description,
  columns,
  data,
  isLoading,
  onAddClick,
  addLabel = 'Add New',
  searchPlaceholder = 'Search...',
  searchFilter,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim() || !searchFilter) return data;
    return data.filter((item) => searchFilter(item, searchQuery.toLowerCase()));
  }, [data, searchQuery, searchFilter]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {searchFilter && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-56 sm:w-64 pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-sm"
              />
            </div>
          )}

          {onAddClick && (
            <Button onClick={onAddClick} icon={<Plus className="h-4 w-4" />}>
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-2" />
            <p className="text-sm">Loading records...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <Inbox className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-base font-medium text-slate-800">No records found</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              {searchQuery
                ? 'No matching results for your query. Try clearing the search.'
                : 'Get started by creating your first entry.'}
            </p>
            {onAddClick && !searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddClick}
                className="mt-4"
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                {addLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {columns.map((col, idx) => (
                    <th key={idx} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {columns.map((col, cIdx) => (
                      <td key={cIdx} className={`py-3 px-4 ${col.className || ''}`}>
                        {col.cell
                          ? col.cell(item)
                          : col.accessorKey
                          ? String(item[col.accessorKey] ?? '')
                          : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
