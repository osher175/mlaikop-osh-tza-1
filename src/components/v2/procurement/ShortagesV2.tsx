import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { ProcurementStatusBadge } from '@/components/procurement/ProcurementStatusBadge';
import { pageSlice, type PageSize } from '@/lib/v2/listPage';
import { ListPager } from '@/components/v2/procurement/ListPager';
import type { LowStockProduct } from '@/hooks/useLowStockProducts';

/** Client-side pages over the shortage list the existing query already returns in full. */
export const ShortagesV2: React.FC<{
  products: LowStockProduct[];
  isLoading: boolean;
  isError: boolean;
}> = ({ products, isLoading, isError }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(25);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.product_name, product.barcode].some((value) => (value ?? '').toLowerCase().includes(term)),
    );
  }, [products, search]);
  const view = pageSlice(filtered, page, size);

  useEffect(() => {
    if (view.page !== page) setPage(view.page);
  }, [page, view.page]);

  return (
    <section data-screen="shortages-v2" className="font-[Heebo] text-v2-text">
      <header className="mb-3">
        <h2 className="text-xl font-extrabold">חוסרים</h2>
        <p className="mt-1 text-sm text-v2-muted">מוצרים שכמותם אינה מעל סף המינימום. הסריקה היא שפותחת בקשת רכש.</p>
      </header>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" aria-hidden />
          <input
            aria-label="חיפוש חוסר"
            value={search}
            placeholder="שם, מידה בתוך השם, או ברקוד"
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            className="h-11 w-full rounded-[14px] border border-[#dbe4ee] bg-white pr-10 pl-3 text-sm"
          />
        </label>
      </div>
      {isLoading && <p className="rounded-[18px] border border-[#e6eef6] bg-white px-4 py-10 text-center text-sm font-bold">טוען חוסרים…</p>}
      {isError && !isLoading && <p className="rounded-[18px] border border-[#fecdd3] bg-[#fff1f2] px-4 py-8 text-center text-sm font-bold text-v2-red" role="alert">רשימת החוסרים לא נטענה.</p>}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="rounded-[18px] border border-[#e6eef6] bg-white px-4 py-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-[#12a37a]" aria-hidden />
          <p className="font-extrabold">{products.length === 0 ? 'אין חוסרים כרגע' : 'אין חוסר שמתאים לחיפוש'}</p>
          <p className="mt-1 text-sm text-v2-muted">{products.length === 0 ? 'כל המוצרים מעל סף המינימום.' : 'הסף והספירה לא השתנו.'}</p>
        </div>
      )}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="overflow-hidden rounded-[18px] border border-[#e6eef6] bg-white">
          <div className="hidden md:block">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-[#f6f8fb] text-xs font-bold text-[#7b8798]">
                <tr>
                  <th className="w-[46%] px-3 py-2 text-right">מוצר</th>
                  <th className="w-[12%] px-3 py-2 text-right">כמות</th>
                  <th className="w-[12%] px-3 py-2 text-right">סף</th>
                  <th className="px-3 py-2 text-right">בקשה פתוחה</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((product) => <ShortageRow key={product.product_id} product={product} />)}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {view.items.map((product) => (
              <article key={product.product_id} className="rounded-[14px] border border-[#e6eef6] p-3">
                <p className="font-extrabold">{product.product_name}</p>
                <p className="mt-1 text-sm">כמות <Qty product={product} /> · סף {product.low_stock_threshold}</p>
                <div className="mt-2"><RequestState product={product} /></div>
              </article>
            ))}
          </div>
          <ListPager from={view.from} to={view.to} total={view.total} page={view.page} pages={view.pages} size={size} onPage={setPage} onSize={(next) => { setSize(next); setPage(1); }} />
        </div>
      )}
    </section>
  );
};

const ShortageRow: React.FC<{ product: LowStockProduct }> = ({ product }) => (
  <tr className="border-t border-[#eef3f8]">
    <td className="truncate px-3 py-2 font-bold">{product.product_name}</td>
    <td className="px-3 py-2"><Qty product={product} /></td>
    <td className="px-3 py-2">{product.low_stock_threshold}</td>
    <td className="px-3 py-2"><RequestState product={product} /></td>
  </tr>
);

const Qty: React.FC<{ product: LowStockProduct }> = ({ product }) => (
  <span className={product.quantity === 0 ? 'font-extrabold text-v2-red' : 'font-extrabold text-[#c2410c]'}>{product.quantity}</span>
);

const RequestState: React.FC<{ product: LowStockProduct }> = ({ product }) => (
  product.open_request_id
    ? <ProcurementStatusBadge status={product.open_request_status!} />
    : <span className="text-xs text-v2-muted">אין בקשה — לחץ על סריקה</span>
);
