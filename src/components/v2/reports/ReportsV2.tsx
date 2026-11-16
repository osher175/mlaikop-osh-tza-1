import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, CalendarDays, ChevronDown, ChevronLeft, Clock, Coins, Download,
  Home, LineChart, Package, PieChart, RotateCcw, Search, Ship, ShoppingCart, Tag, Truck, Trophy, X,
} from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useUserRole } from '@/hooks/useUserRole';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Bidi } from '@/components/v2';
import { defaultRange, formatDayHe, isValidDay, type DayRange } from '@/lib/v2/dashboardMetrics';
import { useV2Reports } from '@/hooks/v2/useV2Reports';
import { v2Button } from '@/components/v2/Controls';
import { EmptyState } from '@/components/v2/States';
import { ReportDrilldown, type DrilldownFilter } from '@/components/v2/reports/ReportDrilldown';

const ils0 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });

type Topic = 'revenue' | 'profit' | 'margin' | 'inventory' | 'discount' | 'trend' | 'aging' | 'top' | 'slow' | 'receipts' | 'imports';
type Panel = 'overview' | 'sales' | 'stock' | 'purchasing' | 'imports';
type Tone = 'amber' | 'blue' | 'mint' | 'green' | 'purple';

const TOPICS: Record<Topic, { title: string; lead: string; detail: string }> = {
  revenue: {
    title: 'הכנסות ממכירות',
    lead: 'מחיר המכירה כולל מע״מ, בלי שורות ביטול.',
    detail: 'הסכום מגיע מכל שורות המכירה בטווח. רווח גולמי אינו מחושב מהמספר הזה.',
  },
  profit: {
    title: 'רווח גולמי',
    lead: 'מחזור לפני מע״מ פחות עלות ידועה. זה אינו רווח נקי.',
    detail: 'הדוח החי מחשב רווח כולל מע״מ ומחליף עלות חסרה ב-0, ולכן המספר אינו מוצג.',
  },
  margin: {
    title: 'רווחיות גולמית',
    lead: 'השיעור נגזר רק משורות עם עלות ידועה.',
    detail: 'בלי רווח גולמי לפי החוזה אין שיעור, והחסר אינו מוצג כאפס.',
  },
  inventory: {
    title: 'שווי מלאי נוכחי',
    lead: 'יתרה נוכחית כפול עלות ידועה.',
    detail: 'קליטות התקופה אינן שווי המלאי, ועלות חסרה אינה אפס.',
  },
  discount: {
    title: 'סך הנחות',
    lead: 'הנחה ידועה דורשת מחיר מחירון שנשמר במכירה.',
    detail: 'מחיר מחירון חסר אינו אפס ואינו משוחזר מהמחירון הנוכחי. הנחה אפס היא מכירה במחיר מלא.',
  },
  trend: {
    title: 'מגמת מכירות ורווח גולמי',
    lead: 'הקו הוא מחזור יומי כולל מע״מ.',
    detail: 'קו הרווח הגולמי חסר כל עוד אין סיכום עלות ידועה לכל הטווח.',
  },
  aging: {
    title: 'התפלגות שווי מלאי לפי גיל (FIFO)',
    lead: 'גיל המחסן יחושב לפי תאריך קליטה.',
    detail: 'מלאי בלי תאריך קליטה אמין יישאר בגיל לא ידוע ולא ייכנס לממוצע. זה אינו גיל הייצור שעל הצמיג.',
  },
  top: {
    title: 'מוצרים מובילים ברווח גולמי',
    lead: 'הדירוג דורש רווח גולמי ידוע לכל מוצר.',
    detail: 'דירוג לפי כמות מהדוח החי אינו מוצג במקומו.',
  },
  slow: {
    title: 'מוצרים במלאי איטי',
    lead: 'פריט איטי הוא מלאי עם גיל מחסן ידוע.',
    detail: 'בלי שכבות FIFO אין רשימה, ואין הערכה.',
  },
  receipts: {
    title: 'קליטות רכש',
    lead: 'יחידות שנקלטו למלאי אינן תשלום לספק.',
    detail: 'הזמנת רכש לבדה אינה מגדילה מלאי, וקליטה אינה מוכיחה שהכסף שולם.',
  },
  imports: {
    title: 'תשלומי יבוא',
    lead: 'תשלום יבוא אינו עלות המכר ואינו קליטת מלאי.',
    detail: 'תשלום יכול להקדים את הגעת הסחורה. סטטוס הזמנה אינו מוכיח שהכסף שולם.',
  },
};

const PANELS: { id: Panel; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'סקירה כללית', icon: Home },
  { id: 'sales', label: 'מכירות ורווחיות', icon: LineChart },
  { id: 'stock', label: 'מלאי והזדקנות', icon: Package },
  { id: 'purchasing', label: 'רכש וספקים', icon: Truck },
  { id: 'imports', label: 'יבוא', icon: Ship },
];

const kpiBg: Record<Tone, string> = {
  amber: 'bg-[#fff1e4]', blue: 'bg-[#e7f1ff]', mint: 'bg-[#e7f8f2]', green: 'bg-[#e5f8ee]', purple: 'bg-[#f3e9ff]',
};
const kpiText: Record<Tone, string> = {
  amber: 'text-[#d97706]', blue: 'text-[#1d6fe0]', mint: 'text-[#0f9f8f]', green: 'text-[#14944a]', purple: 'text-[#7c3aed]',
};

const BUCKETS = [
  { label: '0–30 ימים', dot: 'bg-v2-primary' },
  { label: '31–90 ימים', dot: 'bg-v2-blue' },
  { label: '91–180 ימים', dot: 'bg-v2-amber' },
  { label: 'מעל 180 ימים', dot: 'bg-v2-red' },
  { label: 'גיל לא ידוע', dot: 'bg-v2-muted' },
];

const pill = 'h-11 px-3 inline-flex items-center gap-2 rounded-[12px] border border-v2-border bg-v2-surface text-[13px] font-semibold text-v2-text hover:bg-v2-table-head';

const money = (value: number | null) => value === null ? null : ils0.format(value);

export const ReportsV2: React.FC = () => {
  const { permissions } = useUserRole();
  const { activeBusinessId } = useActiveBusiness();
  const [panel, setPanel] = useState<Panel>('overview');
  const [range, setRange] = useState<DayRange>(() => defaultRange());
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);

  const extraFilter = !!(product || brandId || supplierId);
  const safeRange = isValidDay(range.from) && isValidDay(range.to) && range.from <= range.to ? range : defaultRange();
  const report = useV2Reports(safeRange, extraFilter, !!permissions.canViewReports);
  const brands = useQuery({
    queryKey: ['v2-report-brands'],
    enabled: !!permissions.canViewReports,
    queryFn: async () => {
      const { data, error } = await supabase.from('brands').select('id, name').order('name').limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const suppliers = useQuery({
    queryKey: ['v2-report-suppliers', activeBusinessId],
    enabled: !!activeBusinessId && !!permissions.canViewReports,
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').eq('business_id', activeBusinessId!).order('name').limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const products = useQuery({
    queryKey: ['v2-report-products', activeBusinessId, productSearch],
    enabled: !!activeBusinessId && productSearch.trim().length >= 2,
    queryFn: async () => {
      const term = productSearch.trim().replace(/%/g, '');
      const { data, error } = await supabase.from('products').select('id, name').eq('business_id', activeBusinessId!).ilike('name', `%${term}%`).limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productOptions = useMemo(() => {
    const rows = products.data ?? [];
    if (!product) return rows;
    return [product, ...rows.filter((row) => row.id !== product.id)];
  }, [product, products.data]);

  const filters: DrilldownFilter = {
    from: safeRange.from,
    to: safeRange.to,
    productId: product?.id ?? null,
    brandId,
    supplierId,
  };
  const chart = (report.timeline ?? []).flatMap((row) => {
    const amount = row.sales_amount;
    if (!row.date || amount === null || amount === undefined || !Number.isFinite(Number(amount))) return [];
    return [{ label: formatDayHe(row.date).slice(0, 5), revenue: Number(amount) }];
  });

  const exportRows = () => {
    if (report.overview.revenueGross === null) return;
    const lines = ['date,revenue_gross_ils', ...chart.map((row) => `${row.label},${row.revenue}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mlaiko-revenue.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => { setRange(defaultRange()); setProduct(null); setBrandId(null); setSupplierId(null); setProductSearch(''); };

  if (!permissions.canViewReports) return <EmptyState title="אין הרשאה לדוחות" />;

  const updated = report.updatedAt ? new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(report.updatedAt) : null;
  const brandName = (brands.data ?? []).find((row) => row.id === brandId)?.name;
  const supplierName = (suppliers.data ?? []).find((row) => row.id === supplierId)?.name;
  const show = (item: Panel) => panel === 'overview' || panel === item;

  return (
    <div dir="rtl" className="font-[Heebo] text-v2-text min-w-0">
      <div className="mb-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-v2-primary-soft text-v2-primary" aria-hidden>
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[26px] font-extrabold leading-none md:text-[30px]">דוחות</h1>
            <p className="mt-1 text-sm text-v2-muted">ניתוח עסקי, רווחיות, מלאי ורכישה. ביצועי עובדים נשארים במסך העובדים.</p>
          </div>
        </div>
        <button type="button" className={v2Button.primary} disabled={report.overview.revenueGross === null} onClick={exportRows}>
          <Download className="h-4 w-4" aria-hidden />ייצוא דוח
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ProductFilter
          selected={product}
          search={productSearch}
          options={productOptions}
          onSearch={setProductSearch}
          onSelect={(row) => { setProduct(row); setProductSearch(''); }}
        />
        <FilterSelect label="כל המותגים" icon={Tag} value={brandId} options={brands.data ?? []} onChange={setBrandId} />
        <FilterSelect label="כל הספקים" icon={Truck} value={supplierId} options={suppliers.data ?? []} onChange={setSupplierId} />
        <DateRange range={safeRange} onChange={setRange} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-v2-muted">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        <span>{updated ? `עודכן בשעה ${updated}` : 'ממתין לנתונים'}</span>
        {product && <FilterChip label={product.name} onClear={() => setProduct(null)} />}
        {brandName && <FilterChip label={brandName} onClear={() => setBrandId(null)} />}
        {supplierName && <FilterChip label={supplierName} onClear={() => setSupplierId(null)} />}
        {(extraFilter || safeRange.from !== defaultRange().from || safeRange.to !== defaultRange().to) && (
          <button type="button" className="inline-flex min-h-8 items-center gap-1 font-semibold text-v2-blue" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />איפוס
          </button>
        )}
      </div>
      {extraFilter && <p className="mb-3 text-xs font-semibold text-v2-amber">סינון מוצר, מותג או ספק מסתיר את סיכום הדוח החי.</p>}
      {report.isError && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-v2-red/30 bg-v2-red-soft px-3 py-2 text-sm" role="alert">
          <span>הנתונים לא נטענו. הסכומים אינם מוצגים.</span>
          <button type="button" className={v2Button.secondary} onClick={report.refetch}>ניסיון חוזר</button>
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi tone="amber" icon={Package} title="שווי מלאי נוכחי" value={money(report.overview.inventoryValue)} note="עלות ידועה בלבד" loading={report.isLoading} onOpen={() => setTopic('inventory')} />
        <Kpi tone="blue" icon={ShoppingCart} title="הכנסות ממכירות" value={money(report.overview.revenueGross)} note={report.revenueChangePct === null ? 'כולל מע״מ' : `${pct1.format(report.revenueChangePct)}% מול התקופה הקודמת`} loading={report.isLoading} onOpen={() => setTopic('revenue')} />
        <Kpi tone="mint" icon={BarChart3} title="רווח גולמי" value={money(report.overview.grossProfit)} note="עלות ידועה, לפני מע״מ" loading={report.isLoading} onOpen={() => setTopic('profit')} />
        <Kpi tone="green" icon={Coins} title="רווחיות גולמית" value={report.overview.marginPct === null ? null : `${pct1.format(report.overview.marginPct)}%`} note="אינו רווח נקי" loading={report.isLoading} onOpen={() => setTopic('margin')} />
        <Kpi tone="purple" icon={Tag} title="סך הנחות" value={money(report.overview.verifiedDiscount)} note="הנחה מאומתת בלבד" loading={report.isLoading} onOpen={() => setTopic('discount')} />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="מקטעי דוח">
        {PANELS.map((item) => {
          const Icon = item.icon;
          const active = panel === item.id;
          return (
            <button key={item.id} type="button" role="tab" aria-selected={active} onClick={() => setPanel(item.id)}
              className={cn('h-11 shrink-0 rounded-[12px] px-3 text-[13px] font-semibold inline-flex items-center gap-1.5', active ? 'bg-v2-primary text-white' : 'border border-v2-border bg-v2-surface text-v2-text hover:bg-v2-table-head')}>
              <Icon className="h-4 w-4" aria-hidden />{item.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {show('sales') && (
          <OpenCard title="מגמת מכירות ורווח גולמי" icon={LineChart} onOpen={() => setTopic('trend')} className="min-h-[320px]">
            <TrendChart points={chart} />
          </OpenCard>
        )}
        {show('stock') && (
          <OpenCard title="התפלגות שווי מלאי לפי גיל (FIFO)" icon={PieChart} onOpen={() => setTopic('aging')} className="min-h-[320px]">
            <AgingBoard />
          </OpenCard>
        )}
        {show('sales') && (
          <OpenCard title="מוצרים מובילים ברווח גולמי" icon={Trophy} onOpen={() => setTopic('top')} className="min-h-[280px]">
            <ReportTable headers={['מוצר', 'מכירות', 'רווח גולמי', 'שיעור רווחיות']} reason="דירוג הרווח לפי עלות ידועה עדיין כבוי." />
          </OpenCard>
        )}
        {show('stock') && (
          <OpenCard title="מוצרים במלאי איטי" icon={Clock} onOpen={() => setTopic('slow')} className="min-h-[280px]">
            <ReportTable headers={['מוצר', 'יתרה', 'גיל ממוצע', 'שווי מלאי', 'מכירות 90']} reason="שכבות FIFO עדיין כבויות." />
          </OpenCard>
        )}
        {show('purchasing') && (
          <OpenCard title="קליטות רכש" icon={Package} onOpen={() => setTopic('receipts')} className="min-h-[148px]">
            <SummaryLine value={report.overview.unitsReceived === null ? null : `${new Intl.NumberFormat('he-IL').format(report.overview.unitsReceived)} יחידות`} reason="אינו תשלום ואינו שווי מלאי." />
          </OpenCard>
        )}
        {show('imports') && (
          <OpenCard title="תשלומי יבוא" icon={Ship} onOpen={() => setTopic('imports')} className="min-h-[148px]">
            <SummaryLine value={null} reason="הסכום אינו מוצג מהדוח החי." />
          </OpenCard>
        )}
      </div>

      <ReportDrilldown
        open={topic !== null}
        title={topic ? TOPICS[topic].title : ''}
        description={topic ? TOPICS[topic].lead : ''}
        filters={filters}
        brands={brands.data ?? []}
        suppliers={suppliers.data ?? []}
        products={productOptions}
        onFilters={(next) => {
          if (isValidDay(next.from) && isValidDay(next.to)) setRange({ from: next.from, to: next.to });
          setBrandId(next.brandId);
          setSupplierId(next.supplierId);
          if (!next.productId) setProduct(null);
          else {
            const match = productOptions.find((row) => row.id === next.productId);
            if (match) setProduct(match);
          }
        }}
        onReset={reset}
        onExport={exportRows}
        exportDisabled={report.overview.revenueGross === null}
        onClose={() => setTopic(null)}
      >
        <DrillBody topic={topic} revenue={report.overview.revenueGross} units={report.overview.unitsReceived} filtered={extraFilter} points={chart} />
      </ReportDrilldown>
    </div>
  );
};

const Kpi: React.FC<{
  tone: Tone; icon: React.ElementType; title: string; value: string | null; note: string; loading: boolean; onOpen: () => void;
}> = ({ tone, icon: Icon, title, value, note, loading, onOpen }) => (
  <button type="button" onClick={onOpen} className={cn('relative flex min-h-[132px] flex-col items-center justify-between rounded-[18px] border border-white/80 px-3 py-3 text-center shadow-v2', kpiBg[tone])}>
    <ChevronLeft className="absolute left-2 top-2 h-4 w-4 text-v2-muted" aria-hidden />
    <span className="flex items-center justify-center gap-1.5 px-4">
      <span className="text-[13px] font-bold leading-tight xl:text-[14px]">{title}</span>
      <Icon className={cn('h-5 w-5 shrink-0', kpiText[tone])} aria-hidden />
    </span>
    {loading ? <span className="h-8 w-2/3 animate-pulse rounded-lg bg-white/70" role="status" /> : (
      <span className={cn('text-[22px] font-extrabold leading-none tracking-tight xl:text-[28px]', value ? kpiText[tone] : 'text-sm text-v2-muted')}>
        {value ? <Bidi>{value}</Bidi> : 'לא זמין'}
      </span>
    )}
    <span className="text-[12px] leading-tight text-v2-muted">{note}</span>
  </button>
);

const OpenCard: React.FC<{
  title: string; icon: React.ElementType; onOpen: () => void; className?: string; children: React.ReactNode;
}> = ({ title, icon: Icon, onOpen, className, children }) => (
  <section className={cn('flex h-full min-w-0 flex-col rounded-[18px] border border-v2-border bg-v2-surface px-4 py-3.5 shadow-v2', className)}>
    <button type="button" onClick={onOpen} className="mb-3 flex w-full items-center justify-between gap-2 text-right">
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-[18px] w-[18px] shrink-0 text-v2-navy" aria-hidden />
        <span className="truncate text-[15px] font-bold">{title}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-v2-primary">פירוט<ChevronLeft className="h-3.5 w-3.5" aria-hidden /></span>
    </button>
    <div className="min-h-0 flex-1">{children}</div>
  </section>
);

const TrendChart: React.FC<{ points: { label: string; revenue: number }[] }> = ({ points }) => {
  if (points.length === 0) return <Unavailable reason="אין סדרת מחזור בטווח הזה." />;
  return (
    <div className="flex h-full flex-col">
      <div className="h-[220px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--v2-border))" vertical={false} />
            <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 11, fill: 'hsl(var(--v2-muted))' }} axisLine={false} tickLine={false} />
            <YAxis orientation="right" width={52} tick={{ fontSize: 11, fill: 'hsl(var(--v2-muted))' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => new Intl.NumberFormat('he-IL', { notation: 'compact' }).format(value)} />
            <Tooltip formatter={(value: number) => [ils0.format(Number(value)), 'הכנסות ממכירות']} contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: 12, borderColor: 'hsl(var(--v2-border))' }} />
            <Area type="monotone" dataKey="revenue" name="הכנסות ממכירות" stroke="hsl(var(--v2-primary))" fill="hsl(var(--v2-primary) / 0.16)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-v2-primary" />הכנסות ממכירות</span>
        <span className="inline-flex items-center gap-1.5 text-v2-muted"><i className="h-2.5 w-2.5 rounded-full bg-v2-purple/40" />רווח גולמי אינו זמין</span>
      </div>
    </div>
  );
};

const AgingBoard: React.FC = () => (
  <div className="grid h-full items-center gap-4 sm:grid-cols-[1fr_148px]">
    <div>
      <ul className="space-y-2">
        {BUCKETS.map((bucket) => (
          <li key={bucket.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2"><i className={cn('h-2.5 w-2.5 rounded-full', bucket.dot)} />{bucket.label}</span>
            <span className="text-xs text-v2-muted">לא זמין</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-v2-muted">השווי והחלק היחסי דורשים שכבות FIFO.</p>
    </div>
    <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-[14px] border-dashed border-v2-border text-center text-xs font-semibold text-v2-muted">
      אין התפלגות
    </div>
  </div>
);

const ReportTable: React.FC<{ headers: string[]; reason: string }> = ({ headers, reason }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[280px] text-sm">
      <thead className="bg-v2-table-head text-v2-muted">
        <tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-right text-xs font-semibold">{header}</th>)}</tr>
      </thead>
      <tbody>
        <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-v2-muted">{reason}</td></tr>
      </tbody>
    </table>
  </div>
);

const SummaryLine: React.FC<{ value: string | null; reason: string }> = ({ value, reason }) => (
  <div className="flex h-full flex-col justify-center gap-1">
    <p className={cn('text-[26px] font-extrabold leading-none', value ? 'text-v2-navy' : 'text-sm text-v2-muted')}>{value ? <Bidi>{value}</Bidi> : 'לא זמין'}</p>
    <p className="text-xs text-v2-muted">{reason}</p>
  </div>
);

const Unavailable: React.FC<{ reason: string }> = ({ reason }) => (
  <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-1 text-center">
    <p className="text-sm font-bold">לא זמין</p>
    <p className="max-w-[240px] text-xs leading-relaxed text-v2-muted">{reason}</p>
  </div>
);

const FilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <button type="button" onClick={onClear} className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-v2-primary-soft px-2 py-1 font-semibold text-v2-primary-dark">
    <span className="truncate">{label}</span><X className="h-3 w-3" aria-hidden />
  </button>
);

const FilterSelect: React.FC<{
  label: string; icon: React.ElementType; value: string | null; options: { id: string; name: string }[]; onChange: (value: string | null) => void;
}> = ({ label, icon: Icon, value, options, onChange }) => (
  <label className={cn(pill, 'max-w-full')}>
    <Icon className="h-4 w-4 shrink-0 text-v2-navy" aria-hidden />
    <select aria-label={label} className="max-w-[9rem] bg-transparent text-[13px] font-semibold outline-none" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    <ChevronDown className="h-4 w-4 text-v2-muted" aria-hidden />
  </label>
);

const ProductFilter: React.FC<{
  selected: { id: string; name: string } | null;
  search: string;
  options: { id: string; name: string }[];
  onSearch: (value: string) => void;
  onSelect: (row: { id: string; name: string } | null) => void;
}> = ({ selected, search, options, onSearch, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={pill} aria-label="סינון מוצר">
        <Package className="h-4 w-4 text-v2-navy" aria-hidden />
        <span className="max-w-[9rem] truncate">{selected?.name ?? 'כל המוצרים'}</span>
        <ChevronDown className="h-4 w-4 text-v2-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="v2-root w-72" dir="rtl" align="start">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" aria-hidden />
          <input aria-label="חיפוש מוצר" value={search} placeholder="לפחות שתי אותיות" onChange={(event) => onSearch(event.target.value)}
            className="h-10 w-full rounded-[10px] border border-v2-border pr-9 pl-2 text-sm" />
        </div>
        <button type="button" className="mt-2 w-full rounded-[10px] px-2 py-2 text-right text-sm hover:bg-v2-table-head" onClick={() => { onSelect(null); setOpen(false); }}>כל המוצרים</button>
        <ul className="max-h-56 overflow-y-auto">
          {options.map((row) => (
            <li key={row.id}>
              <button type="button" className="w-full rounded-[10px] px-2 py-2 text-right text-sm hover:bg-v2-table-head" onClick={() => { onSelect(row); setOpen(false); }}>{row.name}</button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const DateRange: React.FC<{ range: DayRange; onChange: (range: DayRange) => void }> = ({ range, onChange }) => (
  <Popover>
    <PopoverTrigger className={pill} aria-label="בחירת טווח תאריכים">
      <CalendarDays className="h-4 w-4 text-v2-navy" aria-hidden />
      <Bidi>{formatDayHe(range.to)} – {formatDayHe(range.from)}</Bidi>
      <ChevronDown className="h-4 w-4 text-v2-muted" aria-hidden />
    </PopoverTrigger>
    <PopoverContent className="v2-root w-72" dir="rtl" align="start">
      <div className="space-y-3">
        <label className="block text-sm font-semibold">מתאריך
          <input type="date" value={range.from} max={range.to} onChange={(event) => onChange({ ...range, from: event.target.value })} className="mt-1 h-10 w-full rounded-[10px] border border-v2-border px-2" />
        </label>
        <label className="block text-sm font-semibold">עד תאריך
          <input type="date" value={range.to} min={range.from} onChange={(event) => onChange({ ...range, to: event.target.value })} className="mt-1 h-10 w-full rounded-[10px] border border-v2-border px-2" />
        </label>
      </div>
    </PopoverContent>
  </Popover>
);

const DrillBody: React.FC<{
  topic: Topic | null; revenue: number | null; units: number | null; filtered: boolean; points: { label: string; revenue: number }[];
}> = ({ topic, revenue, units, filtered, points }) => {
  if (!topic) return null;
  const copy = TOPICS[topic];
  const sales = topic === 'revenue' || topic === 'trend';
  const value = sales ? (filtered ? null : money(revenue)) : topic === 'receipts' && units !== null ? `${new Intl.NumberFormat('he-IL').format(units)} יחידות` : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Mini label={copy.title} value={value} />
        <Mini label="סינון פעיל" value={filtered ? 'מוצר, מותג או ספק' : 'טווח תאריכים'} />
      </div>
      {sales && <div className="rounded-[16px] border border-v2-border bg-v2-surface p-3"><TrendChart points={filtered ? [] : points} /></div>}
      <p className="text-sm text-v2-muted">{copy.detail}</p>
      <p className="text-xs text-v2-muted">אין סניפים במערכת. אין כאן ציון עובד.</p>
    </div>
  );
};

const Mini: React.FC<{ label: string; value: string | null }> = ({ label, value }) => (
  <div className="rounded-[14px] border border-v2-border bg-v2-surface px-3 py-3">
    <p className="text-xs font-semibold text-v2-muted">{label}</p>
    <p className={cn('mt-1 text-lg font-extrabold', value ? 'text-v2-navy' : 'text-sm font-semibold text-v2-muted')}>{value ? <Bidi>{value}</Bidi> : 'לא זמין'}</p>
  </div>
);
