import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingSkeleton, EmptyState, ErrorState } from './States';

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/** Server pagination is controlled by the caller — the table never slices data itself. */
export interface PaginationState { page: number; pageSize: number; total: number | null; onPageChange: (p: number) => void }

export function DataTable<T>({
  columns, rows, getRowId, loading, error, onRetry, emptyTitle = 'אין נתונים להצגה', emptyDescription,
  selectable, selectedIds, onSelectionChange, rowActions, pagination, caption,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  getRowId: (r: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  rowActions?: (row: T) => React.ReactNode;
  pagination?: PaginationState;
  caption?: string;
}) {
  if (loading) return <LoadingSkeleton variant="table" />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const sel = selectedIds ?? new Set<string>();
  const allSelected = rows.length > 0 && rows.every((r) => sel.has(getRowId(r)));
  const toggle = (id: string) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange?.(next);
  };

  const totalPages = pagination?.total != null ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : null;

  return (
    <div className="rounded-v2-card border border-v2-border bg-v2-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-[14px]">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-v2-table-head text-v2-navy">
            <tr className="h-11">
              {selectable && (
                <th scope="col" className="w-12 px-3">
                  <input type="checkbox" aria-label="בחירת הכל" checked={allSelected}
                    onChange={() => onSelectionChange?.(allSelected ? new Set() : new Set(rows.map(getRowId)))} className="h-4 w-4" />
                </th>
              )}
              {columns.map((c) => <th key={c.key} scope="col" className={cn('px-4 font-semibold whitespace-nowrap', c.className)}>{c.header}</th>)}
              {rowActions && <th scope="col" className="px-4"><span className="sr-only">פעולות</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const id = getRowId(r);
              return (
                <tr key={id} className="h-14 border-t border-v2-border even:bg-v2-bg/60">
                  {selectable && (
                    <td className="px-3"><input type="checkbox" aria-label="בחירת שורה" checked={sel.has(id)} onChange={() => toggle(id)} className="h-4 w-4" /></td>
                  )}
                  {columns.map((c) => <td key={c.key} className={cn('px-4 py-2', c.className)}>{c.cell(r)}</td>)}
                  {rowActions && <td className="px-4 text-left">{rowActions(r)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination && (
        <nav aria-label="דפדוף" className="flex items-center justify-between gap-2 border-t border-v2-border px-4 py-2 text-sm">
          <span className="text-v2-muted">עמוד {pagination.page}{totalPages ? ` מתוך ${totalPages}` : ''}</span>
          <div className="flex gap-1">
            <button type="button" aria-label="עמוד קודם" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="h-11 w-11 inline-flex items-center justify-center rounded-v2-control border border-v2-border disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden /></button>
            <button type="button" aria-label="עמוד הבא" disabled={totalPages != null && pagination.page >= totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="h-11 w-11 inline-flex items-center justify-center rounded-v2-control border border-v2-border disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          </div>
        </nav>
      )}
    </div>
  );
}

export const MobileRecordCard: React.FC<{
  title: React.ReactNode; subtitle?: React.ReactNode; status?: React.ReactNode;
  metrics?: { label: string; value: React.ReactNode }[]; primaryAction?: React.ReactNode; overflow?: React.ReactNode;
}> = ({ title, subtitle, status, metrics, primaryAction, overflow }) => (
  <article className="rounded-v2-card border border-v2-border bg-v2-surface shadow-v2 p-4 space-y-3">
    <header className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-bold text-[16px] break-words">{title}</h3>
        {subtitle && <p className="text-xs text-v2-muted break-words">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">{status}{overflow}</div>
    </header>
    {metrics && metrics.length > 0 && (
      <dl className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-v2-sm bg-v2-bg p-2">
            <dt className="text-xs text-v2-muted">{m.label}</dt>
            <dd className="font-semibold">{m.value}</dd>
          </div>
        ))}
      </dl>
    )}
    {primaryAction}
  </article>
);
