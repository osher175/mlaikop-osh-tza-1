import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Gauge, CalendarDays, ChevronDown, Wrench, Truck, Package, Plus, ShoppingCart, Coins, Percent, Disc3, Boxes,
  AlertTriangle, UserRound, PieChart as PieIcon, Clock, Bell, ChevronLeft, CheckCircle2, CircleDashed, Circle,
  BarChart3, Layers, Users, Tag, LineChart, Target, ListChecks, Zap, TrendingUp, TrendingDown, Lock, Ship,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUserRole } from '@/hooks/useUserRole';
import { LoadingSkeleton, ErrorState, EmptyState, Bidi } from '@/components/v2';
import {
  resolveRange, previousRange, formatDayHe, summarize, dailySeries, topProductsByProfit, pctChange, defaultRange,
  type DayRange,
} from '@/lib/v2/dashboardMetrics';
import {
  useDashboardSales, useDashboardStock, useDashboardActiveImport, useOpenProcurementCount,
} from '@/hooks/v2/useV2Dashboard';
import type { ImportStatus } from '@/hooks/useImportOrders';

const ils0 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const money = (v: number) => <bdi className="whitespace-nowrap">{ils0.format(v)}</bdi>;

/* ---------- layout primitives ---------- */
const Panel: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode; className?: string; note?: React.ReactNode }> = ({
  title, icon: Icon, children, className, note,
}) => (
  <section className={cn('rounded-[14px] border border-v2-border bg-v2-surface shadow-v2 p-4 flex flex-col min-w-0', className)} aria-label={title}>
    <header className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-v2-navy shrink-0" aria-hidden />
      <h2 className="text-[16px] font-bold text-v2-text truncate">{title}</h2>
    </header>
    <div className="flex-1 min-w-0">{children}</div>
    {note && <p className="mt-2 text-[11px] text-v2-muted">{note}</p>}
  </section>
);

const Blocked: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <EmptyState icon={<Lock className="h-6 w-6" />} title={title} description={description} className="py-6" />
);

const Unauthorized = () => <Blocked title="אין הרשאה לצפייה" description="הנתונים זמינים לבעלי הרשאת צפייה בדוחות." />;

const Change: React.FC<{ value: number | null; unit?: 'pct' | 'pp' }> = ({ value, unit = 'pct' }) => {
  if (value === null) return <span className="text-v2-muted text-[13px]">אין נתוני השוואה</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[14px] font-bold', up ? 'text-v2-green' : 'text-v2-red')}>
      <bdi dir="ltr">{up ? '+' : ''}{pct1.format(value)}{unit === 'pct' ? '%' : ''}</bdi>
      {unit === 'pp' && <span>נק׳</span>}
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
};

const kpiBg = {
  blue: 'bg-v2-blue-soft/50', green: 'bg-v2-green-soft/50', purple: 'bg-v2-purple-soft/60',
  sky: 'bg-v2-blue-soft/30', amber: 'bg-v2-amber-soft/60',
};
const kpiText = { blue: 'text-v2-blue', green: 'text-v2-green', purple: 'text-v2-purple', sky: 'text-v2-blue', amber: 'text-v2-amber' };

const Kpi: React.FC<{
  label: string; icon: React.ElementType; tone: keyof typeof kpiBg; value: React.ReactNode | null;
  footer?: React.ReactNode; loading?: boolean; error?: boolean; unavailable?: string;
}> = ({ label, icon: Icon, tone, value, footer, loading, error, unavailable }) => (
  <div className={cn('rounded-[14px] border border-v2-border shadow-v2 px-4 py-3 flex flex-col items-center text-center gap-1 min-h-[124px] justify-between', kpiBg[tone])}>
    <div className="flex items-center justify-center gap-3 w-full">
      <span className="text-[15px] font-semibold text-v2-text">{label}</span>
      <Icon className={cn('h-7 w-7 shrink-0', kpiText[tone])} aria-hidden />
    </div>
    {loading ? (
      <div className="animate-pulse h-8 w-2/3 rounded bg-v2-table-head" role="status"><span className="sr-only">טוען…</span></div>
    ) : error ? (
      <span className="text-sm font-semibold text-v2-red" role="alert">שגיאה בטעינה</span>
    ) : value === null ? (
      <span className="text-sm text-v2-muted">{unavailable ?? 'לא זמין'}</span>
    ) : (
      <span className={cn('text-[26px] xl:text-[30px] font-extrabold leading-tight', kpiText[tone])}>{value}</span>
    )}
    <div className="min-h-[20px] text-[13px]">{!loading && !error && footer}</div>
  </div>
);

/* ---------- header ---------- */
const DateRangePicker: React.FC<{ range: DayRange; onChange: (r: DayRange) => void }> = ({ range, onChange }) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const invalid = !from || !to || from > to;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(range.from); setTo(range.to); } }}>
      <PopoverTrigger className="h-11 px-3 inline-flex items-center gap-3 rounded-[10px] border border-v2-border bg-v2-surface text-v2-text text-[14px] font-medium hover:bg-v2-table-head" aria-label="בחירת טווח תאריכים">
        <CalendarDays className="h-5 w-5 text-v2-navy" aria-hidden />
        <Bidi>{formatDayHe(range.to)} – {formatDayHe(range.from)}</Bidi>
        <ChevronDown className="h-4 w-4 text-v2-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="v2-root w-72" dir="rtl" align="start">
        <div className="space-y-3">
          <label className="block text-sm font-semibold">מתאריך
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-10 rounded-[10px] border border-v2-border px-2" />
          </label>
          <label className="block text-sm font-semibold">עד תאריך
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-10 rounded-[10px] border border-v2-border px-2" />
          </label>
          {invalid && <p className="text-xs text-v2-red" role="alert">תאריך הסיום חייב להיות אחרי תאריך ההתחלה</p>}
          <div className="flex gap-2">
            <button type="button" disabled={invalid} onClick={() => { onChange({ from, to }); setOpen(false); }}
              className="flex-1 h-10 rounded-[10px] bg-v2-primary text-white font-semibold disabled:opacity-50">החלה</button>
            <button type="button" onClick={() => { onChange(defaultRange()); setOpen(false); }}
              className="h-10 px-3 rounded-[10px] border border-v2-border font-semibold">החודש</button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ActionBtn: React.FC<{ label: string; icon: React.ElementType; to: string | null; primary?: boolean }> = ({ label, icon: Icon, to, primary }) => {
  const cls = cn(
    'h-11 px-4 inline-flex items-center gap-2 rounded-[10px] font-semibold text-[14px] transition-colors duration-300',
    primary ? 'bg-v2-primary text-white hover:bg-v2-primary-dark min-w-[160px] justify-center' : 'border border-v2-border bg-v2-surface text-v2-text hover:bg-v2-table-head',
  );
  const content = <><span>{label}</span>{primary ? <Plus className="h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}</>;
  if (!to) return <span aria-disabled="true" title={`${label} — עדיין לא זמין`} className={cn(cls, 'opacity-50 cursor-not-allowed')}>{content}</span>;
  return <Link to={to} className={cls}>{content}</Link>;
};

/* ---------- import stages ---------- */
const STAGES = ['הזמנה אושרה', 'בייצור', 'בדרך לנמל', 'שחרור מכס', 'הובלה אלינו'] as const;
/** Real status → number of completed stages + in-progress stage. Linear status progression only; no time inference. */
const STAGE_MAP: Partial<Record<ImportStatus, { done: number; current: number | null }>> = {
  ordered: { done: 1, current: null },
  preparing: { done: 1, current: 1 },
  shipped: { done: 2, current: 2 },
  in_transit: { done: 2, current: 2 },
  arrived_israel: { done: 3, current: null },
  customs_clearance: { done: 3, current: 3 },
  receiving: { done: 4, current: 4 },
  received_pending_costs: { done: 5, current: null },
};

/* ---------- main ---------- */
export const DashboardV2: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => resolveRange(params.get('from'), params.get('to')), [params]);
  const prev = useMemo(() => previousRange(range), [range]);
  const setRange = (r: DayRange) => {
    const next = new URLSearchParams(params);
    next.set('from', r.from); next.set('to', r.to);
    setParams(next, { replace: true });
  };

  const { permissions } = useUserRole();
  const canFin = !!permissions.canViewReports;
  const canStock = !!permissions.canViewProducts;
  const canImports = !!permissions.canManageSettings;
  const canProcure = !!permissions.canEditProducts;

  const cur = useDashboardSales(range, canFin);
  const old = useDashboardSales(prev, canFin);
  const stock = useDashboardStock(canStock);
  const imp = useDashboardActiveImport(canImports);
  const proc = useOpenProcurementCount(canProcure);

  const s = useMemo(() => (cur.data ? summarize(cur.data.rows) : null), [cur.data]);
  const p = useMemo(() => (old.data ? summarize(old.data.rows) : null), [old.data]);
  const daily = useMemo(() => (cur.data ? dailySeries(cur.data.rows, range) : []), [cur.data, range]);
  const top = useMemo(() => (cur.data ? topProductsByProfit(cur.data.rows, 5) : null), [cur.data]);

  const nameById = useMemo(() => new Map((stock.data ?? []).map((x) => [x.id, x.name])), [stock.data]);
  const available = useMemo(() => (stock.data ? stock.data.reduce((a, x) => a + Math.max(x.quantity, 0), 0) : null), [stock.data]);
  const lowStock = useMemo(
    () => (stock.data ?? []).filter((x) => x.quantity <= x.threshold)
      .sort((a, b) => a.quantity - b.quantity || a.quantity / Math.max(a.threshold, 1) - b.quantity / Math.max(b.threshold, 1)),
    [stock.data],
  );

  const finLoading = cur.isLoading || old.isLoading;
  const finError = cur.isError;
  const partialCost = s && s.costCoveragePct !== null && s.costCoveragePct < 99.95;
  const marginPP = s?.marginPct != null && p?.marginPct != null ? s.marginPct - p.marginPct : null;

  return (
    <div dir="rtl" className="w-full max-w-full overflow-x-hidden font-[Heebo] text-v2-text">
      {/* Header */}
      <div className="flex flex-col-reverse xl:flex-row-reverse xl:items-start xl:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 xl:flex-row-reverse xl:justify-start">
          <ActionBtn label="מכירה חדשה" icon={Plus} to={canStock ? '/inventory' : null} primary />
          <ActionBtn label="קליטת סחורה" icon={Package} to={canImports ? '/import' : null} />
          <ActionBtn label="הזמנת רכש" icon={Truck} to={canProcure ? '/procurement' : null} />
          <ActionBtn label="תיקון מלאי" icon={Wrench} to={canStock ? '/inventory' : null} />
          <DateRangePicker range={range} onChange={setRange} />
        </div>
        <div className="flex items-start gap-3">
          <Gauge className="h-10 w-10 text-v2-primary shrink-0" aria-hidden />
          <div>
            <h1 className="text-[26px] md:text-[32px] font-extrabold leading-tight">דשבורד ראשי | מלאיקו</h1>
            <p className="text-[14px] text-v2-muted">מבט כולל על המכירות, המלאי, הרכש והפעילות העסקית</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 min-[1440px]:grid-cols-6 gap-3 mb-4">
        <Kpi label="מחזור מכירות" icon={ShoppingCart} tone="blue" loading={finLoading} error={finError}
          value={!canFin ? null : s ? money(s.revenueGross) : null} unavailable={!canFin ? 'אין הרשאה' : undefined}
          footer={s && <Change value={pctChange(s.revenueGross, p?.revenueGross ?? null)} />} />
        <Kpi label="רווח גולמי" icon={Coins} tone="green" loading={finLoading} error={finError}
          value={!canFin ? null : s?.grossProfit != null ? money(s.grossProfit) : null}
          unavailable={!canFin ? 'אין הרשאה' : 'אין נתוני עלות'}
          footer={s?.grossProfit != null && (partialCost
            ? <span className="text-v2-amber font-semibold">חלקי · עלות ידועה ל-{pct1.format(s.costCoveragePct!)}%</span>
            : <Change value={pctChange(s.grossProfit, p?.grossProfit ?? null)} />)} />
        <Kpi label="שיעור רווח גולמי" icon={Percent} tone="purple" loading={finLoading} error={finError}
          value={!canFin ? null : s?.marginPct != null ? <bdi dir="ltr">{pct1.format(s.marginPct)}%</bdi> : null}
          unavailable={!canFin ? 'אין הרשאה' : 'אין נתוני עלות'}
          footer={s?.marginPct != null && <Change value={marginPP} unit="pp" />} />
        <Kpi label="צמיגים שנמכרו" icon={Disc3} tone="sky" loading={finLoading} error={finError}
          value={!canFin ? null : s ? num0.format(s.units) : null} unavailable={!canFin ? 'אין הרשאה' : undefined}
          footer={s && <Change value={pctChange(s.units, p?.units ?? null)} />} />
        <Kpi label="מלאי זמין למכירה" icon={Boxes} tone="green" loading={stock.isLoading} error={stock.isError}
          value={!canStock ? null : available !== null ? num0.format(available) : null} unavailable={!canStock ? 'אין הרשאה' : undefined}
          footer={<span className="text-v2-muted">יחידות במלאי כעת</span>} />
        <Kpi label="פריטים במינימום" icon={AlertTriangle} tone="amber" loading={stock.isLoading} error={stock.isError}
          value={!canStock ? null : stock.data ? num0.format(lowStock.length) : null} unavailable={!canStock ? 'אין הרשאה' : undefined}
          footer={lowStock.length > 0 && <span className="text-v2-amber font-semibold">דורש טיפול</span>} />
      </div>
      {cur.data?.truncated && (
        <p role="alert" className="mb-3 text-xs text-v2-amber font-semibold">הטווח כולל יותר מ-20,000 תנועות מכירה — הנתונים מוצגים באופן חלקי. מומלץ לצמצם את הטווח.</p>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1fr_1fr_1.15fr] gap-3 mb-3">
        <Panel title="ביצועי עובדים (לפי רווח גולמי)" icon={UserRound}>
          <Blocked title="שיוך מכירות לעובד עדיין לא קיים" description="אין במערכת טבלת עובדים או שיוך מכירה לעובד, ולכן לא ניתן לדרג. יתווסף בשלב העובדים." />
        </Panel>
        <Panel title="חלוקת מכירות לפי עובד" icon={PieIcon}>
          <Blocked title="חלוקה לפי עובד אינה זמינה" description={s ? `כל המכירות בטווח (${ils0.format(s.revenueGross)}) אינן משויכות לעובד.` : 'אין שיוך מכירות לעובדים במערכת.'} />
        </Panel>
        <Panel title="מכירות ורווח גולמי לפי ימים" icon={Clock} className="md:col-span-2 min-[1440px]:col-span-1"
          note={partialCost ? 'נקודות רווח חסרות = ימים ללא עלות ידועה (לא אפס). רווח מחושב לפני מע״מ.' : 'רווח מחושב לפני מע״מ; מחזור כולל מע״מ.'}>
          {!canFin ? <Unauthorized /> : cur.isLoading ? <LoadingSkeleton variant="panel" /> : cur.isError ? <ErrorState onRetry={() => cur.refetch()} /> : (
            <div className="h-[220px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daily.map((d) => ({ ...d, label: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` }))} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--v2-border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(v) => ils0.format(v)} />
                  <Tooltip formatter={(v: number | null, n) => [v === null ? 'לא ידוע' : ils0.format(v), n]} />
                  <Legend wrapperStyle={{ fontSize: 12, direction: 'rtl' }} />
                  <Bar dataKey="revenue" name="מחזור מכירות" fill="hsl(var(--v2-primary))" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Line dataKey="profit" name="רווח גולמי" stroke="hsl(var(--v2-purple))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1fr_1.1fr_1fr] gap-3 mb-3">
        <Panel title="התראות מלאי" icon={Bell}>
          {!canStock ? <Unauthorized /> : stock.isLoading ? <LoadingSkeleton variant="panel" /> : stock.isError ? <ErrorState onRetry={() => stock.refetch()} /> :
            lowStock.length === 0 ? <EmptyState title="אין מוצרים מתחת למינימום" className="py-6" /> : (
              <ul className="divide-y divide-v2-border">
                {lowStock.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <Link to="/inventory" className="flex items-center gap-3 py-2 hover:bg-v2-table-head rounded-[10px] px-1">
                      {x.image ? <img src={x.image} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" loading="lazy" />
                        : <span className="h-10 w-10 rounded-full bg-v2-table-head flex items-center justify-center shrink-0"><Disc3 className="h-6 w-6 text-v2-navy" aria-hidden /></span>}
                      <span className="flex-1 min-w-0 text-[14px] font-medium truncate"><Bidi>{x.name}</Bidi></span>
                      <span className={cn('rounded-[8px] px-2 py-1 text-center leading-tight font-bold', x.quantity <= 0 ? 'bg-v2-red-soft text-v2-red' : 'bg-v2-amber-soft text-v2-amber')}>
                        <span className="block text-[16px]">{num0.format(x.quantity)}</span><span className="block text-[11px]">יח׳</span>
                      </span>
                      <ChevronLeft className="h-4 w-4 text-v2-muted shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="הזמנות רכש והיבוא בתהליך" icon={Truck} note={imp.data?.current ? 'שלבים מוצגים לפי סטטוס ההזמנה בלבד; תאריכי שלבים אינם נשמרים במערכת.' : undefined}>
          {!canImports ? <Unauthorized /> : imp.isLoading ? <LoadingSkeleton variant="panel" /> : imp.isError ? <ErrorState onRetry={() => imp.refetch()} /> :
            !imp.data?.current ? <EmptyState icon={<Ship className="h-6 w-6" />} title="אין הזמנות יבוא פעילות" className="py-6" /> : (() => {
              const o = imp.data.current!;
              const st = STAGE_MAP[o.status] ?? { done: 0, current: null };
              return (
                <Link to={`/import/${o.id}`} className="block">
                  <div className="rounded-[10px] bg-v2-table-head px-3 py-2 text-center text-[14px] font-semibold flex flex-wrap justify-center gap-x-3">
                    <Bidi>#{o.import_number}</Bidi><span className="text-v2-muted">|</span>
                    <span>{num0.format(o.ordered_units)} יח׳</span><span className="text-v2-muted">|</span>
                    <span>ETA: {o.estimated_arrival_date ? <Bidi>{formatDayHe(o.estimated_arrival_date.slice(0, 10))}</Bidi> : 'לא ידוע'}</span>
                  </div>
                  <ol className="mt-5 grid grid-cols-5 relative">
                    <span className="absolute top-4 right-[10%] left-[10%] h-0.5 bg-v2-border" aria-hidden />
                    {STAGES.map((label, i) => {
                      const done = i < st.done && st.current !== i;
                      const current = st.current === i;
                      return (
                        <li key={label} className="relative flex flex-col items-center text-center gap-1">
                          <span className={cn('h-8 w-8 rounded-full flex items-center justify-center z-10 bg-v2-surface',
                            done ? 'text-v2-green' : current ? 'text-v2-primary' : 'text-v2-muted')}>
                            {done ? <CheckCircle2 className="h-8 w-8 fill-v2-green text-white" aria-hidden /> : current ? <CircleDashed className="h-7 w-7" aria-hidden /> : <Circle className="h-7 w-7" aria-hidden />}
                          </span>
                          <span className="text-[12px] font-medium leading-tight">{label}</span>
                          <span className="text-[11px] text-v2-muted">{done ? 'הושלם' : current ? 'בתהליך' : '—'}</span>
                        </li>
                      );
                    })}
                  </ol>
                </Link>
              );
            })()}
        </Panel>

        <Panel title="מוצרים מובילים (לפי רווח גולמי)" icon={Disc3} className="md:col-span-2 min-[1440px]:col-span-1"
          note={top && top.excludedUnknown > 0 ? `${top.excludedUnknown} מוצרים שנמכרו ללא עלות ידועה אינם מדורגים.` : undefined}>
          {!canFin ? <Unauthorized /> : cur.isLoading ? <LoadingSkeleton variant="table" rows={5} /> : cur.isError ? <ErrorState onRetry={() => cur.refetch()} /> :
            !top || top.ranked.length === 0 ? <EmptyState title="אין מכירות עם עלות ידועה בטווח" className="py-6" /> : (
              <table className="w-full text-[14px]">
                <thead><tr className="bg-v2-table-head text-v2-muted text-[13px]">
                  <th className="text-right font-semibold py-1.5 px-2">מוצר</th>
                  <th className="text-center font-semibold py-1.5 px-2">כמות</th>
                  <th className="text-left font-semibold py-1.5 px-2">רווח גולמי</th>
                </tr></thead>
                <tbody>
                  {top.ranked.map((r) => (
                    <tr key={r.product_id} className="border-b border-v2-border last:border-0">
                      <td className="py-1.5 px-2 truncate max-w-[180px]"><Bidi>{nameById.get(r.product_id) ?? '—'}</Bidi></td>
                      <td className="py-1.5 px-2 text-center">{num0.format(r.units)}</td>
                      <td className="py-1.5 px-2 text-left font-bold text-v2-green">{money(r.profit)}{r.unknownCostUnits > 0 && <span className="text-v2-amber" title="חלק מהמכירות ללא עלות ידועה">*</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Panel>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1.45fr_0.9fr_1fr] gap-3">
        <Panel title="תובנות לתקופה הנבחרת" icon={LineChart}>
          {(() => {
            const items: { tone: string; icon: React.ElementType; text: string }[] = [];
            if (canStock && stock.data) items.push({ tone: 'bg-v2-blue-soft/60 text-v2-blue', icon: Package,
              text: lowStock.length > 0 ? `${num0.format(lowStock.length)} פריטים במינימום מלאי או מתחתיו.` : 'כל הפריטים מעל סף המינימום.' });
            if (canFin && marginPP !== null && s?.marginPct != null) items.push({ tone: 'bg-v2-purple-soft/70 text-v2-purple', icon: Target,
              text: `שיעור הרווח הגולמי ${marginPP >= 0 ? 'עלה' : 'ירד'} ל-${pct1.format(s.marginPct)}% (${marginPP >= 0 ? '+' : ''}${pct1.format(marginPP)} נק׳) לעומת התקופה הקודמת.` });
            const rc = s && p ? pctChange(s.revenueGross, p.revenueGross) : null;
            if (canFin && rc !== null) items.push({ tone: 'bg-v2-green-soft/60 text-v2-green', icon: rc >= 0 ? TrendingUp : TrendingDown,
              text: `${rc >= 0 ? 'עלייה' : 'ירידה'} של ${pct1.format(Math.abs(rc))}% במחזור המכירות בהשוואה לתקופה הקודמת.` });
            if (cur.isLoading || stock.isLoading) return <LoadingSkeleton variant="panel" />;
            if (items.length === 0) return <EmptyState title="אין מספיק נתונים לתובנות" className="py-6" />;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {items.map((it, i) => (
                  <div key={i} className={cn('rounded-[12px] p-3 flex flex-col items-center text-center gap-2', it.tone)}>
                    <it.icon className="h-7 w-7" aria-hidden />
                    <p className="text-[13px] font-medium text-v2-text leading-snug">{it.text}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </Panel>

        <Panel title="משימות להיום" icon={ListChecks} note="פריטים מבוססי נתונים בלבד — לחיצה מובילה למסך הטיפול.">
          {(() => {
            const tasks: { label: string; to: string }[] = [];
            if (canProcure && proc.data) tasks.push({ label: `לטפל בבקשות רכש פתוחות (${num0.format(proc.data)})`, to: '/procurement' });
            if (canImports && imp.data?.activeCount) tasks.push({ label: `מעקב הזמנות יבוא פעילות (${num0.format(imp.data.activeCount)})`, to: '/import' });
            if (canStock && lowStock.length) tasks.push({ label: `לטפל בפריטי מלאי במינימום (${num0.format(lowStock.length)})`, to: '/inventory' });
            if (proc.isLoading || imp.isLoading || stock.isLoading) return <LoadingSkeleton variant="panel" />;
            if (tasks.length === 0) return <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="אין משימות פתוחות" className="py-6" />;
            return (
              <ul className="divide-y divide-v2-border">
                {tasks.map((t) => (
                  <li key={t.label}>
                    <Link to={t.to} className="flex items-center gap-3 py-2 text-[14px] hover:text-v2-primary-dark">
                      <span className="h-5 w-5 rounded-[5px] border border-v2-border shrink-0" aria-hidden />
                      <span className="flex-1">{t.label}</span>
                      <ChevronLeft className="h-4 w-4 text-v2-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Panel>

        <Panel title="פעולות מהירות" icon={Zap} className="md:col-span-2 min-[1440px]:col-span-1">
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'דוח מלאי', icon: Layers, to: canStock ? '/inventory' : null, tone: 'bg-v2-primary-soft text-v2-primary-dark' },
              { label: 'דוח מכירות', icon: BarChart3, to: canFin ? '/reports' : null, tone: 'bg-v2-blue-soft text-v2-blue' },
              { label: 'ביצועי עובדים', icon: Users, to: null, tone: 'bg-v2-blue-soft text-v2-blue' },
              { label: 'רווחיות מוצרים', icon: Tag, to: canFin ? '/reports' : null, tone: 'bg-v2-purple-soft text-v2-purple' },
            ] as const).map((a) => {
              const inner = <><a.icon className="h-6 w-6" aria-hidden /><span className="text-[14px] font-semibold text-v2-text">{a.label}</span></>;
              const cls = cn('h-14 rounded-[12px] flex items-center justify-center gap-3', a.tone);
              return a.to
                ? <Link key={a.label} to={a.to} className={cn(cls, 'hover:opacity-80 transition-opacity')}>{inner}</Link>
                : <span key={a.label} aria-disabled="true" title="עדיין לא זמין" className={cn(cls, 'opacity-50 cursor-not-allowed flex-col gap-0')}>
                    <span className="flex items-center gap-2">{inner}</span><span className="text-[10px] text-v2-muted">בקרוב</span>
                  </span>;
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default DashboardV2;
