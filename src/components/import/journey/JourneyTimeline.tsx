import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JOURNEY_MILESTONES, journeyIndex, milestoneDates } from './importJourney';

interface Props {
  status: string;
  events: any[];
  isReadOnly?: boolean;
  isUpdating?: boolean;
  onSetStatus: (status: string) => void;
}

/**
 * Manual, RTL journey timeline. Purely a view over `import_orders.status`:
 * advancing a milestone calls the existing `updateStatus` mutation — no new
 * backend, no inventory side effects.
 */
export const JourneyTimeline: React.FC<Props> = ({
  status, events, isReadOnly, isUpdating, onSetStatus,
}) => {
  const current = journeyIndex(status);
  const dates = milestoneDates(events);
  const next = JOURNEY_MILESTONES[current + 1];
  const cancelled = status === 'cancelled';

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">מסע היבוא</CardTitle>
        {cancelled ? (
          <Badge variant="destructive">היבוא בוטל</Badge>
        ) : next && !isReadOnly ? (
          <Button size="sm" className="min-h-[44px]" disabled={isUpdating} onClick={() => onSetStatus(next.status)}>
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <span className="ml-2">{next.icon}</span>}
            עדכן: {next.label}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-1">
          {JOURNEY_MILESTONES.map((m, idx) => {
            const done = current >= 0 && idx < current;
            const isCurrent = idx === current;
            const date = dates[m.status];
            return (
              <li key={m.status} className="flex items-start gap-3 py-2">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base',
                      isCurrent && 'border-primary bg-primary/10',
                      done && 'border-primary/40 bg-primary/5',
                      !done && !isCurrent && 'border-border bg-muted/40 opacity-60'
                    )}
                  >
                    {done ? <Check className="h-4 w-4 text-primary" /> : m.icon}
                  </span>
                  {idx < JOURNEY_MILESTONES.length - 1 && (
                    <span className={cn('w-px flex-1 min-h-[14px] mt-1', done ? 'bg-primary/40' : 'bg-border')} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm', isCurrent ? 'font-semibold' : done ? '' : 'text-muted-foreground')}>
                      {m.label}
                    </span>
                    {isCurrent && <Badge variant="secondary">עכשיו</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {date ? new Date(date).toLocaleDateString('he-IL') : m.hint}
                  </p>
                  {!isReadOnly && !cancelled && !isCurrent && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline mt-1"
                      onClick={() => onSetStatus(m.status)}
                    >
                      סמן שלב זה
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};
