import React from 'react';
import { Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useReversibleAction } from '@/hooks/useReversibleAction';

const formatMs = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Floating undo pill for the most recent stock removal / sale.
 * Appears for up to 10 minutes after the action.
 */
export const UndoActionBanner: React.FC = () => {
  const { action, msRemaining, reverse, clear } = useReversibleAction();

  if (!action || msRemaining <= 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-orange-200 bg-white shadow-lg px-3 py-2 max-w-[92vw]"
      role="status"
      aria-live="polite"
    >
      <Undo2 className="h-4 w-4 text-orange-600 shrink-0" />
      <span className="text-sm text-gray-800 truncate">
        {action.action_type === 'sale' ? 'מכירה' : 'הורדה'} של {action.quantity} יח' —{' '}
        <strong className="font-semibold">{action.product_name}</strong>
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-3 border-orange-300 text-orange-700 hover:bg-orange-50 shrink-0"
        onClick={reverse}
      >
        בטל ({formatMs(msRemaining)})
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={clear}
        aria-label="סגור"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
