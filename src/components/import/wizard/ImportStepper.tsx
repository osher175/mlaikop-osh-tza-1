import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImportStepKey = 'order' | 'costs' | 'receiving' | 'summary';

export const IMPORT_STEPS: { key: ImportStepKey; label: string }[] = [
  { key: 'order', label: 'הזמנה' },
  { key: 'costs', label: 'שילוח ועלויות' },
  { key: 'receiving', label: 'קליטת סחורה' },
  { key: 'summary', label: 'סיכום וסגירה' },
];

interface Props {
  current: ImportStepKey;
  completed: Record<ImportStepKey, boolean>;
  onSelect: (key: ImportStepKey) => void;
}

/**
 * Guided 4-step navigation. Purely presentational — no business rules live here.
 * Every step stays clickable; edit-safety is enforced inside each step (and by
 * the server) rather than by hiding navigation.
 */
export const ImportStepper: React.FC<Props> = ({ current, completed, onSelect }) => (
  <nav dir="rtl" className="w-full overflow-x-auto">
    <ol className="flex min-w-max items-center gap-2 sm:gap-3">
      {IMPORT_STEPS.map((step, idx) => {
        const isCurrent = step.key === current;
        const isDone = completed[step.key] && !isCurrent;
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onSelect(step.key)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors min-h-[44px]',
                isCurrent && 'border-primary bg-primary text-primary-foreground font-semibold',
                !isCurrent && isDone && 'border-primary/40 bg-primary/10 text-foreground',
                !isCurrent && !isDone && 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  isCurrent ? 'bg-primary-foreground/20' : 'bg-muted'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
            {idx < IMPORT_STEPS.length - 1 && (
              <span className="hidden sm:block h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
