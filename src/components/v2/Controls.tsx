import React, { useRef, useState } from 'react';
import { Search, X, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useIsMobile } from '@/hooks/use-mobile';

export const v2Button = {
  primary: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-v2-control bg-v2-primary text-white font-semibold hover:bg-v2-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300',
  secondary: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-v2-control border border-v2-border bg-v2-surface text-v2-navy font-semibold hover:bg-v2-table-head disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300',
  danger: 'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-v2-control bg-v2-red text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
};

export const SearchInput: React.FC<{
  value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string;
}> = ({ value, onChange, label, placeholder, className }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-v2-muted pointer-events-none" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 md:h-11 rounded-v2-control border border-v2-border bg-v2-surface pr-10 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-v2-primary"
      />
      {value && (
        <button type="button" aria-label="ניקוי חיפוש" onClick={() => { onChange(''); ref.current?.focus(); }}
          className="absolute left-1 top-1/2 -translate-y-1/2 h-10 w-10 inline-flex items-center justify-center text-v2-muted hover:text-v2-text">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
};

/** Controls (selects, date range) are passed as children. Drawer on mobile. */
export const FilterBar: React.FC<{
  children: React.ReactNode; activeCount?: number; onClear?: () => void; search?: React.ReactNode;
}> = ({ children, activeCount = 0, onClear, search }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const clear = onClear && activeCount > 0 && (
    <button type="button" onClick={onClear} className="text-sm font-semibold text-v2-blue hover:underline min-h-[44px] px-2">ניקוי מסננים</button>
  );
  if (isMobile) {
    return (
      <div className="flex gap-2 items-center mb-4">
        {search && <div className="flex-1">{search}</div>}
        <button type="button" onClick={() => setOpen(true)} className={cn(v2Button.secondary, 'h-12 relative')} aria-label={`מסננים${activeCount ? ` (${activeCount} פעילים)` : ''}`}>
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
          {activeCount > 0 && <span className="absolute -top-1 -left-1 h-5 min-w-5 px-1 rounded-full bg-v2-primary text-white text-[11px] flex items-center justify-center">{activeCount}</span>}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="v2-root rounded-t-v2-panel" dir="rtl">
            <SheetHeader><SheetTitle>מסננים</SheetTitle></SheetHeader>
            <div className="flex flex-col gap-3 py-4">{children}</div>
            <div className="flex justify-between">{clear}<button type="button" className={v2Button.primary} onClick={() => setOpen(false)}>הצגת תוצאות</button></div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 rounded-v2-card border border-v2-border bg-v2-surface p-3">
      {search && <div className="flex-1 min-w-[220px]">{search}</div>}
      {children}
      {activeCount > 0 && <span className="text-xs font-semibold text-v2-primary-dark">{activeCount} מסננים פעילים</span>}
      {clear}
    </div>
  );
};

/** Pure controlled input — never mutates inventory by itself. */
export const QuantityStepper: React.FC<{
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; disabled?: boolean;
}> = ({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, label, disabled }) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const btn = 'h-11 w-11 inline-flex items-center justify-center rounded-v2-control border border-v2-border bg-v2-surface hover:bg-v2-table-head disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label="הוספה" disabled={disabled || value >= max} onClick={() => onChange(clamp(value + step))}><Plus className="h-4 w-4" aria-hidden /></button>
      <input
        type="number" inputMode="numeric" aria-label={label} value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(clamp(Math.trunc(n))); }}
        className="h-11 w-16 text-center rounded-v2-control border border-v2-border bg-v2-surface font-semibold focus:outline-none focus:ring-2 focus:ring-v2-primary"
      />
      <button type="button" className={btn} aria-label="הפחתה" disabled={disabled || value <= min} onClick={() => onChange(clamp(value - step))}><Minus className="h-4 w-4" aria-hidden /></button>
    </div>
  );
};

/** Explicit confirm; ignores repeat clicks while pending. Closes only after onConfirm resolves. */
export const ConfirmDialog: React.FC<{
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => Promise<void> | void;
}> = ({ open, onOpenChange, title, description, confirmLabel = 'אישור', cancelLabel = 'ביטול', destructive, onConfirm }) => {
  const [pending, setPending] = useState(false);
  const handle = async () => {
    if (pending) return;
    setPending(true);
    try { await onConfirm(); onOpenChange(false); } finally { setPending(false); }
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent dir="rtl" className="v2-root rounded-v2-panel">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending} className="rounded-v2-control h-11">{cancelLabel}</AlertDialogCancel>
          <button type="button" onClick={handle} disabled={pending} aria-busy={pending} className={destructive ? v2Button.danger : v2Button.primary}>
            {pending ? 'מבצע…' : confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
