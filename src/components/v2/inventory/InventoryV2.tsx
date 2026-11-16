import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Boxes, Download, Package, PackagePlus, ShoppingCart, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useUserRole } from '@/hooks/useUserRole';
import { useDebounce } from '@/hooks/use-debounce';
import { useCostVisibility } from '@/hooks/useCostVisibility';
import { useToast } from '@/hooks/use-toast';
import {
  useInventoryProductsPage, useInventoryStockCounts, fetchAllMatchingProducts, type InventoryProduct, type StockFilter,
} from '@/hooks/useInventoryProductsPage';
import { addDraftLine } from '@/lib/v2/saleDraft';
import { exportInventoryToCSV } from '@/utils/exportInventoryCSV';
import { EditProductDialog } from '@/components/inventory/EditProductDialog';
import { ProductImageViewer } from '@/components/inventory/ProductImageViewer';
import { SearchInput, v2Button } from '@/components/v2/Controls';
import { Bidi, CurrencyValue, StatusBadge } from '@/components/v2/Display';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/v2/States';

const PAGE_SIZE = 20;
const QUERY_KEY = 'mlaiko.v2.inventoryQuery';
const num0 = new Intl.NumberFormat('he-IL');
const SIZE_IN_NAME = /\d{3}\/\d{2}\s?R\d{2}/i;

export const sizeFromName = (name: string) => name.match(SIZE_IN_NAME)?.[0] ?? null;
const thresholdOf = (product: InventoryProduct) => product.product_thresholds?.low_stock_threshold ?? 5;
const statusOf = (product: InventoryProduct) => {
  if (product.quantity <= 0) return { tone: 'error' as const, label: 'אזל מהמלאי', qty: 'text-v2-red' };
  if (product.quantity <= thresholdOf(product)) return { tone: 'warning' as const, label: 'מלאי נמוך', qty: 'text-v2-amber' };
  return { tone: 'success' as const, label: 'במלאי', qty: 'text-v2-green' };
};

const isStock = (value: string | null): value is StockFilter =>
  value === 'all' || value === 'inStock' || value === 'lowStock' || value === 'outOfStock';

const storedImage = (product: InventoryProduct) => {
  const value = product.image?.trim();
  return value ? value : null;
};

const ProductThumb: React.FC<{
  product: InventoryProduct; broken: boolean; onOpen: () => void; onBroken: () => void;
}> = ({ product, broken, onOpen, onBroken }) => {
  const image = storedImage(product);
  if (!image || broken) {
    return <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-v2-table-head text-v2-muted" title="אין תמונה"><Package className="h-5 w-5" aria-hidden /></span>;
  }
  return (
    <button type="button" className="h-11 w-11 shrink-0 rounded-xl bg-v2-table-head focus:outline-none focus:ring-2 focus:ring-v2-primary" aria-label={`הצגת תמונת ${product.name}`} onClick={onOpen}>
      <img src={image} alt="" loading="lazy" decoding="async" className="h-11 w-11 rounded-xl object-contain" onError={onBroken} />
    </button>
  );
};

export const InventoryV2: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const { businessContext } = useBusinessAccess();
  const { permissions } = useUserRole();
  const { hidden: costHidden, toggle: toggleCost } = useCostVisibility();
  const [editing, setEditing] = React.useState<InventoryProduct | null>(null);
  const [viewingImage, setViewingImage] = React.useState<InventoryProduct | null>(null);
  const [brokenImages, setBrokenImages] = React.useState<ReadonlySet<string>>(() => new Set());
  const [exporting, setExporting] = React.useState(false);

  const search = params.get('q') ?? '';
  const stockFilter: StockFilter = isStock(params.get('stock')) ? params.get('stock') as StockFilter : 'all';
  const availableOnly = params.get('available') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const debounced = useDebounce(search, 300);
  const businessId = businessContext?.business_id ?? null;
  const canEdit = !!permissions.canEditProducts;
  const hideOutOfStock = availableOnly && stockFilter === 'all';

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
    try { sessionStorage.setItem(QUERY_KEY, next.toString()); } catch { /* draft navigation still works */ }
  };

  const listed = useInventoryProductsPage(debounced, hideOutOfStock ? 'all' : stockFilter, page, PAGE_SIZE);
  const available = useQuery({
    queryKey: ['v2-inventory-available', businessId, debounced, page],
    enabled: !!businessId && hideOutOfStock,
    queryFn: async () => {
      let query = supabase.from('products').select('*', { count: 'exact' }).eq('business_id', businessId!).gt('quantity', 0);
      const term = debounced.replace(/[%_,]/g, '').trim();
      if (term) query = query.or(`name.ilike.%${term}%,barcode.ilike.%${term}%,location.ilike.%${term}%`);
      const from = (page - 1) * PAGE_SIZE;
      const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: (data ?? []) as InventoryProduct[], total: count ?? 0 };
    },
  });
  const { counts, isLoading: countsLoading } = useInventoryStockCounts();
  const brands = useQuery({
    queryKey: ['v2-brands'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('id, name');
      if (error) throw error;
      return new Map((data ?? []).map((brand) => [brand.id, brand.name]));
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = hideOutOfStock ? (available.data?.items ?? []) : listed.products;
  const total = hideOutOfStock ? (available.data?.total ?? 0) : listed.total;
  const isLoading = hideOutOfStock ? available.isLoading : listed.isLoading;
  const isFetching = hideOutOfStock ? available.isFetching : listed.isFetching;
  const error = hideOutOfStock ? available.error : listed.error;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusCounts = counts.inStock + counts.lowStock + counts.outOfStock;

  const startSale = (product: InventoryProduct) => {
    if (!businessId || product.quantity <= 0) return;
    addDraftLine(businessId, {
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      quantity: 1,
      available: product.quantity,
      unitPriceGross: product.price,
      listUnitGross: product.price,
      unitCost: product.cost,
      axle: 'single',
      image: product.image,
      sizeLabel: sizeFromName(product.name),
    });
    navigate('/sale');
  };

  const exportExcel = async () => {
    if (!businessId || total === 0) return;
    setExporting(true);
    try {
      const rows = hideOutOfStock
        ? [...await fetchAllMatchingProducts(businessId, debounced, 'inStock'), ...await fetchAllMatchingProducts(businessId, debounced, 'lowStock')]
        : await fetchAllMatchingProducts(businessId, debounced, stockFilter);
      const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
      await exportInventoryToCSV(unique);
    } catch {
      toast({ title: 'הייצוא נכשל', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const kpis = useMemo(() => [
    { label: 'סה״כ מוצרים', value: counts.total, hint: 'מוצרים בקטלוג', icon: Box, card: 'bg-white border-v2-border', valueClass: 'text-v2-navy' },
    { label: 'סה״כ יחידות במלאי', value: counts.totalUnits, hint: 'יחידות פיזיות', icon: Boxes, card: 'bg-[#e7f4ff] border-[#d5e8ff]', valueClass: 'text-[#1d6fe0]' },
    { label: 'במלאי', value: counts.inStock, hint: 'מעל 5 יחידות', icon: Package, card: 'bg-[#e9f9ef] border-[#d7f3e2]', valueClass: 'text-v2-green' },
    { label: 'מלאי נמוך', value: counts.lowStock, hint: '1 עד 5 יחידות', icon: TriangleAlert, card: 'bg-[#fff6e8] border-[#ffe7c2]', valueClass: 'text-v2-amber' },
    { label: 'אזל מהמלאי', value: counts.outOfStock, hint: '0 יחידות', icon: Package, card: 'bg-[#fff1f3] border-[#ffd9df]', valueClass: 'text-v2-red' },
  ], [counts]);

  return (
    <div dir="rtl" className="font-[Heebo] text-v2-text min-w-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <Box className="h-9 w-9 text-v2-primary shrink-0" aria-hidden />
          <div>
            <h1 className="text-[26px] md:text-[30px] font-extrabold leading-tight">חיפוש מלאי</h1>
            <p className="text-sm text-v2-muted">איתור צמיגים, בדיקת זמינות ומעבר מהיר למכירה</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={v2Button.primary} onClick={() => navigate('/sale')}><ShoppingCart className="h-4 w-4" aria-hidden /> מכירה חדשה</button>
          {canEdit && <button type="button" className={v2Button.secondary} onClick={() => navigate('/add-product')}><PackagePlus className="h-4 w-4" aria-hidden /> הוספת מוצר</button>}
          <button type="button" className={v2Button.secondary} disabled={exporting || total === 0} onClick={exportExcel}><Download className="h-4 w-4" aria-hidden /> {exporting ? 'מייצא…' : 'ייצוא לאקסל'}</button>
          <button type="button" className={v2Button.secondary} onClick={toggleCost}>{costHidden ? 'הצג עלות' : 'הסתר עלות'}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className={`rounded-[18px] border shadow-[var(--v2-shadow)] px-4 py-3 min-w-0 ${kpi.card}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-v2-navy">{kpi.label}</p>
                <Icon className="h-5 w-5 text-v2-muted" aria-hidden />
              </div>
              <p className={`text-[30px] font-extrabold leading-tight mt-1 ${kpi.valueClass}`}>{countsLoading ? '…' : num0.format(kpi.value)}</p>
              <p className="text-[11px] text-v2-muted mt-1">{kpi.hint}</p>
            </article>
          );
        })}
      </div>
      {!countsLoading && statusCounts !== counts.total && (
        <p className="mb-3 text-xs text-v2-amber font-semibold">מוצרים בכמות שלילית אינם נכללים בכרטיסי הסטטוס.</p>
      )}

      <div className="rounded-[18px] bg-v2-surface border border-v2-border shadow-[var(--v2-shadow)] p-3 mb-3 flex flex-col gap-3">
        <SearchInput value={search} onChange={(value) => update({ q: value || null, page: null })} label="חיפוש מלאי" placeholder="חיפוש לפי שם, מידה בתוך השם, מותג בתוך השם, ברקוד או מיקום" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-v2-navy">
            סטטוס מלאי
            <select className="mr-2 h-11 rounded-v2-control border border-v2-border bg-v2-surface px-3" value={stockFilter} onChange={(event) => update({ stock: event.target.value === 'all' ? null : event.target.value, page: null })}>
              <option value="all">כל הסטטוסים</option>
              <option value="inStock">במלאי</option>
              <option value="lowStock">מלאי נמוך</option>
              <option value="outOfStock" disabled={availableOnly}>אזל</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold min-h-11">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[hsl(var(--v2-primary))]"
              checked={availableOnly}
              onChange={(event) => update({ available: event.target.checked ? '1' : null, stock: event.target.checked && stockFilter === 'outOfStock' ? null : stockFilter === 'all' ? null : stockFilter, page: null })}
            />
            הצג רק מוצרים זמינים
          </label>
        </div>
      </div>

      <div className="rounded-[18px] bg-v2-surface border border-v2-border shadow-[var(--v2-shadow)] overflow-hidden">
        {isLoading ? <LoadingSkeleton variant="panel" /> : error ? <ErrorState onRetry={() => { void listed.refetch(); void available.refetch(); }} /> : products.length === 0 ? (
          <EmptyState title="לא נמצאו מוצרים" description="נסו חיפוש אחר או סטטוס מלאי אחר." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-v2-table-head text-v2-muted">
                <tr>
                  {['מוצר', 'מותג', 'מידה', 'מלאי', 'מחיר מכירה', 'עלות', 'מיקום', 'סטטוס', 'פעולות'].map((heading) => (
                    <th key={heading} className="px-3 py-3 text-right font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const status = statusOf(product);
                  const brand = product.brand_id ? brands.data?.get(product.brand_id) : null;
                  const size = sizeFromName(product.name);
                  return (
                    <tr key={product.id} className="border-t border-v2-border hover:bg-[#f8fbff]">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ProductThumb product={product} broken={brokenImages.has(product.id)} onOpen={() => setViewingImage(product)} onBroken={() => setBrokenImages((current) => { if (current.has(product.id)) return current; const next = new Set(current); next.add(product.id); return next; })} />
                          <span className="min-w-0">
                            <span className="block font-bold truncate">{product.name}</span>
                            {product.barcode && <Bidi className="block text-[11px] text-v2-muted">{product.barcode}</Bidi>}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold">{brand ?? '—'}</td>
                      <td className="px-3 py-2.5">{size ? <Bidi>{size}</Bidi> : '—'}</td>
                      <td className={`px-3 py-2.5 font-extrabold ${status.qty}`}>{num0.format(product.quantity)}</td>
                      <td className="px-3 py-2.5 font-bold text-v2-primary-dark"><CurrencyValue value={product.price} /></td>
                      <td className="px-3 py-2.5">{costHidden ? 'מוסתר' : <CurrencyValue value={product.cost} />}</td>
                      <td className="px-3 py-2.5">{product.location ?? '—'}</td>
                      <td className="px-3 py-2.5"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {canEdit && <button type="button" className="h-10 px-3 rounded-v2-control text-v2-blue font-semibold" onClick={() => setEditing(product)}>פרטים</button>}
                          <button type="button" className="h-10 px-3 rounded-v2-control bg-v2-primary text-white font-semibold inline-flex items-center gap-1 disabled:opacity-40" disabled={product.quantity <= 0} onClick={() => startSale(product)}><ShoppingCart className="h-4 w-4" aria-hidden /> מכירה</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-v2-border text-sm">
          <span>{isFetching ? 'מרענן…' : `${num0.format(total)} מוצרים`}</span>
          <div className="flex items-center gap-2">
            <button type="button" className={v2Button.secondary} disabled={page <= 1} onClick={() => update({ page: page <= 2 ? null : String(page - 1) })}>הקודם</button>
            <span>{page} / {pages}</span>
            <button type="button" className={v2Button.secondary} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>הבא</button>
          </div>
        </div>
      </div>

      {canEdit && (
        <EditProductDialog product={editing} open={!!editing} showAgingSection onOpenChange={(open) => { if (!open) setEditing(null); }} onProductUpdated={() => { void listed.refetch(); void available.refetch(); }} />
      )}
      <ProductImageViewer product={viewingImage} open={!!viewingImage} onOpenChange={(open) => { if (!open) setViewingImage(null); }} />
    </div>
  );
};
