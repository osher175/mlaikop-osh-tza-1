import React from 'react';
import { Anchor, Check, ClipboardList, Factory, PackageCheck, Ship, Stamp, Truck, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOGISTICS_STAGES, logisticsStageIndex } from '@/lib/v2/importDashboardMetrics';

const STAGE_ICONS = {
  ordered: ClipboardList,
  preparing: Factory,
  transit: Ship,
  port: Anchor,
  customs: Stamp,
  haul: Truck,
  warehouse: Warehouse,
  closed: PackageCheck,
} as const;

export function LogisticsStageIcon({ status, className }: { status: string; className?: string }) {
  const index = logisticsStageIndex(status);
  const stage = index >= 0 ? LOGISTICS_STAGES[index] : undefined;
  if (!stage) return null;
  const Icon = STAGE_ICONS[stage.key];
  return <Icon className={className} strokeWidth={2} />;
}

interface Props {
  status: string;
  dates?: Record<string, string | undefined>;
  compact?: boolean;
  /** Card rail is larger than the compact list rail and does not change the order-details rail. */
  variant?: 'compact' | 'card' | 'full';
}

/** Discrete logistics stages. A stage is complete only when the saved status has passed it. */
export const LogisticsRail: React.FC<Props> = ({ status, dates, compact, variant }) => {
  const current = logisticsStageIndex(status);
  const cancelled = status === 'cancelled';
  const size = variant ?? (compact ? 'compact' : 'full');

  if (cancelled) {
    return <p className="text-sm text-destructive">ההזמנה בוטלה. ציר המשלוח אינו פעיל.</p>;
  }

  if (current < 0) {
    return <p className="text-sm text-muted-foreground">מצב לוגיסטי לא מוגדר עדיין.</p>;
  }

  return (
    <ol className={cn('flex items-start gap-0 min-w-max', compact ? 'py-1' : 'py-2')} dir="rtl">
      {LOGISTICS_STAGES.map((stage, index) => {
        const done = index < current;
        const now = index === current;
        const dateStatus = stage.statuses.find((value) => dates?.[value]);
        const date = dateStatus ? dates?.[dateStatus] : undefined;
        return (
          <li key={stage.key} className="flex items-start">
            <div className={cn('flex flex-col items-center', size === 'compact' ? 'w-14' : size === 'card' ? 'w-[4.6rem]' : 'w-[4.5rem] sm:w-20')}>
              <span
                className={cn(
                  'flex items-center justify-center rounded-full border',
                  size === 'compact' ? 'h-5 w-5' : size === 'card' ? 'h-8 w-8' : 'h-7 w-7',
                  size === 'card' && done && 'border-[hsl(var(--v2-green))] bg-[hsl(var(--v2-green))] text-white',
                  size === 'card' && now && 'h-9 w-9 border-[hsl(var(--v2-green))] bg-[hsl(var(--v2-green))] text-white ring-4 ring-[hsl(var(--v2-green))]/20',
                  size === 'card' && !done && !now && 'border-[hsl(215_16%_78%)] bg-white',
                  size !== 'card' && done && 'border-primary bg-primary text-primary-foreground',
                  size !== 'card' && now && 'border-primary bg-primary/15 text-primary',
                  size !== 'card' && !done && !now && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className={size === 'compact' ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={2.5} /> : size === 'card' && now ? (
                  <LogisticsStageIcon status={stage.statuses[0]} className="h-4 w-4" />
                ) : size === 'card' ? null : (
                  <span className={cn('rounded-full bg-current', now ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5')} />
                )}
              </span>
              <span className={cn(
                'mt-1.5 text-center leading-tight',
                size === 'compact' ? 'text-[10px]' : 'text-xs',
                size === 'card' && now && 'font-semibold text-[hsl(var(--v2-green))]',
                size === 'card' && !now && 'text-[hsl(var(--v2-navy))]',
                size !== 'card' && (now ? 'font-semibold text-primary' : 'text-muted-foreground'),
              )}>
                {stage.label}
              </span>
              {size === 'full' && date && (
                <span className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString('he-IL')}</span>
              )}
            </div>
            {index < LOGISTICS_STAGES.length - 1 && (
              <span className={cn(
                'h-0.5 flex-1 min-w-2',
                size === 'compact' ? 'mt-2' : size === 'card' ? 'mt-4' : 'mt-3',
                index < current
                  ? (size === 'card' ? 'bg-[hsl(var(--v2-green))]' : 'bg-primary')
                  : (size === 'card' ? 'bg-[hsl(215_16%_82%)]' : 'bg-border'),
              )} />
            )}
          </li>
        );
      })}
    </ol>
  );
};
