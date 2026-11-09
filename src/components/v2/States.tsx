import React from 'react';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'card' | 'table' | 'panel' | 'page';

const Bar: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-v2-sm bg-v2-table-head', className)} />
);

export const LoadingSkeleton: React.FC<{ variant?: Variant; rows?: number; className?: string }> = ({
  variant = 'card', rows = 5, className,
}) => (
  <div role="status" aria-live="polite" className={className}>
    <span className="sr-only">טוען…</span>
    {variant === 'card' && (
      <div className="rounded-v2-card border border-v2-border bg-v2-surface p-5 space-y-3 h-[112px]">
        <Bar className="h-4 w-1/2" /><Bar className="h-8 w-2/3" />
      </div>
    )}
    {variant === 'table' && (
      <div className="space-y-2">
        <Bar className="h-11 w-full" />
        {Array.from({ length: rows }).map((_, i) => <Bar key={i} className="h-14 w-full" />)}
      </div>
    )}
    {(variant === 'panel' || variant === 'page') && (
      <div className={cn('rounded-v2-panel border border-v2-border bg-v2-surface p-6 space-y-4', variant === 'page' && 'min-h-[60vh]')}>
        <Bar className="h-7 w-1/3" />
        {Array.from({ length: variant === 'page' ? 6 : 3 }).map((_, i) => <Bar key={i} className="h-5 w-full" />)}
      </div>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode; className?: string;
}> = ({ title, description, icon, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center text-center gap-2 py-10 px-4', className)}>
    <div className="h-12 w-12 rounded-full bg-v2-table-head flex items-center justify-center text-v2-muted" aria-hidden>
      {icon ?? <Inbox className="h-6 w-6" />}
    </div>
    <p className="v2-card-title text-v2-text">{title}</p>
    {description && <p className="text-sm text-v2-muted max-w-md">{description}</p>}
    {action}
  </div>
);

/** `onRetry` only when a real retry exists. */
export const ErrorState: React.FC<{ title?: string; description?: string; onRetry?: () => void; className?: string }> = ({
  title = 'אירעה שגיאה בטעינת הנתונים', description, onRetry, className,
}) => (
  <div role="alert" className={cn('flex flex-col items-center text-center gap-2 py-10 px-4', className)}>
    <div className="h-12 w-12 rounded-full bg-v2-red-soft flex items-center justify-center text-v2-red" aria-hidden>
      <AlertTriangle className="h-6 w-6" />
    </div>
    <p className="v2-card-title">{title}</p>
    {description && <p className="text-sm text-v2-muted max-w-md">{description}</p>}
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-2 h-11 px-4 rounded-v2-control border border-v2-border bg-v2-surface font-semibold hover:bg-v2-table-head">
        <RotateCw className="h-4 w-4" aria-hidden /> נסו שוב
      </button>
    )}
  </div>
);
