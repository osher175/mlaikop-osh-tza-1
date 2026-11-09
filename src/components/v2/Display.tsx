import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, Circle, Clock, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export type V2Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending' | 'purple';

const toneClass: Record<V2Tone, string> = {
  success: 'bg-v2-green-soft text-v2-green',
  warning: 'bg-v2-amber-soft text-v2-amber',
  error: 'bg-v2-red-soft text-v2-red',
  info: 'bg-v2-blue-soft text-v2-blue',
  neutral: 'bg-v2-table-head text-v2-muted',
  pending: 'bg-v2-purple-soft text-v2-purple',
  purple: 'bg-v2-purple-soft text-v2-purple',
};
const toneIcon: Record<V2Tone, React.ElementType> = {
  success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info, neutral: Circle, pending: Clock, purple: Circle,
};

/** Text + icon, never color alone. */
export const StatusBadge: React.FC<{ tone: V2Tone; children: React.ReactNode; className?: string }> = ({ tone, children, className }) => {
  const Icon = toneIcon[tone];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneClass[tone], className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
};

/** Isolates mixed-direction identifiers (SKU, tire size, dates). */
export const Bidi: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <bdi dir="ltr" className={cn('[unicode-bidi:isolate]', className)}>{children}</bdi>
);

const ilsFormatter = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });

/** NULL/undefined is shown as unknown — never as ₪0. */
export const CurrencyValue: React.FC<{ value: number | null | undefined; unknownLabel?: string; className?: string }> = ({
  value, unknownLabel = 'לא ידוע', className,
}) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn('text-v2-muted', className)}>{unknownLabel}</span>;
  }
  return <bdi className={cn('whitespace-nowrap', className)}>{ilsFormatter.format(value)}</bdi>;
};

export interface PageAction { label: string; onClick: () => void; disabled?: boolean }

export const PageHeader: React.FC<{
  title: string; subtitle?: string; icon?: React.ReactNode;
  primaryAction?: React.ReactNode; secondaryActions?: React.ReactNode; overflow?: PageAction[];
}> = ({ title, subtitle, icon, primaryAction, secondaryActions, overflow }) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-6">
    <div className="flex items-start gap-3 min-w-0">
      {icon && <span className="text-v2-primary shrink-0 mt-1" aria-hidden>{icon}</span>}
      <div className="min-w-0">
        <h1 className="v2-h1 text-v2-text">{title}</h1>
        {subtitle && <p className="text-sm text-v2-muted mt-1">{subtitle}</p>}
      </div>
    </div>
    {(primaryAction || secondaryActions || overflow?.length) && (
      <div className="flex flex-wrap items-center gap-2">
        {secondaryActions}
        {primaryAction}
        {overflow && overflow.length > 0 && (
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger aria-label="פעולות נוספות" className="h-11 w-11 inline-flex items-center justify-center rounded-v2-control border border-v2-border bg-v2-surface hover:bg-v2-table-head">
              <MoreVertical className="h-5 w-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((a) => (
                <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onClick}>{a.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    )}
  </div>
);

const kpiTone: Record<V2Tone, string> = {
  success: 'text-v2-green', warning: 'text-v2-amber', error: 'text-v2-red', info: 'text-v2-blue',
  neutral: 'text-v2-navy', pending: 'text-v2-purple', purple: 'text-v2-purple',
};

/** Values always come from the caller — no built-in sample data. `value === null` → unavailable. */
export const KpiCard: React.FC<{
  label: string; value: React.ReactNode | null; icon?: React.ReactNode; tone?: V2Tone;
  comparison?: React.ReactNode; caption?: React.ReactNode; loading?: boolean; prominent?: boolean; to?: string;
}> = ({ label, value, icon, tone = 'neutral', comparison, caption, loading, prominent, to }) => {
  const body = (
    <div className={cn(
      'rounded-v2-card border border-v2-border bg-v2-surface shadow-v2 p-4 md:p-5 flex flex-col justify-between',
      prominent ? 'min-h-[140px]' : 'min-h-[112px]', to && 'hover:border-v2-primary transition-colors duration-300',
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] md:text-[15px] font-semibold text-v2-navy">{label}</span>
        {icon && <span className={cn('shrink-0', kpiTone[tone])} aria-hidden>{icon}</span>}
      </div>
      {loading ? (
        <div className="animate-pulse h-8 w-2/3 rounded-v2-sm bg-v2-table-head" role="status"><span className="sr-only">טוען…</span></div>
      ) : value === null ? (
        <span className="text-sm text-v2-muted">לא זמין</span>
      ) : (
        <span className={cn('text-[24px] md:text-[32px] font-extrabold leading-tight', kpiTone[tone])}>{value}</span>
      )}
      {(comparison || caption) && !loading && (
        <div className="text-xs text-v2-muted flex items-center gap-2">{comparison}{caption}</div>
      )}
    </div>
  );
  return to ? <Link to={to} className="block rounded-v2-card">{body}</Link> : body;
};

export const KpiGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('grid gap-4 grid-cols-2 md:grid-cols-3 xl:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]', className)}>
    {children}
  </div>
);
