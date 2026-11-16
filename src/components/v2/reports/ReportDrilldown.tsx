import React, { useEffect } from 'react';
import { Download, RotateCcw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { v2Button } from '@/components/v2/Controls';

export interface DrilldownFilter {
  from: string;
  to: string;
  productId: string | null;
  brandId: string | null;
  supplierId: string | null;
}

interface Option { id: string; name: string }

interface Props {
  open: boolean;
  title: string;
  description: string;
  filters: DrilldownFilter;
  brands: Option[];
  suppliers: Option[];
  products: Option[];
  onFilters: (next: DrilldownFilter) => void;
  onReset: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** One analytical overlay. A second report dialog is not opened from inside it. */
export const ReportDrilldown: React.FC<Props> = ({
  open, title, description, filters, brands, suppliers, products,
  onFilters, onReset, onExport, exportDisabled, onClose, children,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="v2-root left-1/2 top-0 flex h-[100dvh] w-full max-w-none translate-x-[-50%] translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-v2-bg p-0 shadow-v2 sm:top-1/2 sm:h-auto sm:max-h-[92vh] sm:w-[min(960px,calc(100%-1.5rem))] sm:translate-y-[-50%] sm:rounded-[18px] [&>button]:hidden"
        onOpenAutoFocus={(event) => {
          const close = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('[data-report-close]');
          if (close) {
            event.preventDefault();
            close.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-v2-border bg-v2-surface px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-extrabold text-v2-text">{title}</DialogTitle>
            <DialogDescription className="mt-1 line-clamp-2 text-sm text-v2-muted">{description}</DialogDescription>
          </div>
          <button type="button" data-report-close aria-label="סגירה" onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-v2-border bg-v2-surface text-v2-navy hover:bg-v2-table-head">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 grid grid-cols-1 gap-2 rounded-[14px] border border-v2-border bg-v2-surface p-2 sm:flex sm:flex-wrap sm:items-center">
            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-v2-muted sm:justify-start">מתאריך
              <input type="date" className="h-10 min-w-0 flex-1 rounded-[12px] border border-v2-border bg-v2-surface px-2 text-sm text-v2-text sm:flex-none" value={filters.from} onChange={(event) => onFilters({ ...filters, from: event.target.value })} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-v2-muted sm:justify-start">עד
              <input type="date" className="h-10 min-w-0 flex-1 rounded-[12px] border border-v2-border bg-v2-surface px-2 text-sm text-v2-text sm:flex-none" value={filters.to} onChange={(event) => onFilters({ ...filters, to: event.target.value })} />
            </label>
            <Select label="מוצר" value={filters.productId} options={products} onChange={(productId) => onFilters({ ...filters, productId })} />
            <Select label="מותג" value={filters.brandId} options={brands} onChange={(brandId) => onFilters({ ...filters, brandId })} />
            <Select label="ספק" value={filters.supplierId} options={suppliers} onChange={(supplierId) => onFilters({ ...filters, supplierId })} />
            <button type="button" className={v2Button.secondary} onClick={onReset}><RotateCcw className="h-4 w-4" aria-hidden />איפוס מסננים</button>
            <button type="button" className={v2Button.primary} disabled={exportDisabled} onClick={onExport}><Download className="h-4 w-4" aria-hidden />ייצוא</button>
          </div>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Select: React.FC<{
  label: string; value: string | null; options: Option[]; onChange: (value: string | null) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="flex items-center justify-between gap-2 text-xs font-semibold text-v2-muted sm:justify-start">{label}
    <select aria-label={label} className="h-10 min-w-0 flex-1 rounded-[12px] border border-v2-border bg-v2-surface px-2 text-sm font-semibold text-v2-text sm:max-w-[11rem] sm:flex-none" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">הכל</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
  </label>
);
