import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Gauge, CalendarDays, ChevronDown, Wrench, Truck, Package, Plus, ShoppingCart, Coins, Percent, Disc3, Boxes,
  AlertTriangle, UserRound, PieChart as PieIcon, Clock, Bell, ChevronLeft, CheckCircle2, Circle,
  BarChart3, Layers, Users, Tag, LineChart, Target, ListChecks, Zap, TrendingUp, TrendingDown, Ship,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Header } from '@/components/layout/Header';
import { useIsSidebarDrawer } from '@/hooks/use-mobile';
import { useUserRole } from '@/hooks/useUserRole';
import { LoadingSkeleton, ErrorState, EmptyState, Bidi } from '@/components/v2';
import {
  resolveRange, previousRange, formatDayHe, summarize, dailySeries, topProductsByProfit, pctChange, defaultRange,
  type DayRange,
} from '@/lib/v2/dashboardMetrics';
import {
  useDashboardSales, useDashboardStock, useDashboardActiveImport, useOpenProcurementCount,
} from '@/hooks/v2/useV2Dashboard';
import { useEmployeeAttribution } from '@/hooks/v2/useEmployeeAttribution';
import { useEmployeeSalesReport } from '@/hooks/v2/useEmployeeSalesReport';
import { useEmployees } from '@/hooks/v2/useEmployees';
import { V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';
import type { EmployeeSalesReport } from '@/lib/v2/employeeSalesReport';
import { EmployeeDistributionBody, EmployeePanelStatus, EmployeeRankingBody } from '@/components/v2/dashboard/EmployeeAnalyticsPanels';
import type { ImportStatus } from '@/hooks/useImportOrders';

const ils0 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const num0 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const axisNum = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const money = (v: number) => <bdi className="whitespace-nowrap">{ils0.format(v)}</bdi>;

const Panel: React.FC<{
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string; note?: React.ReactNode;
}> = ({ title, icon: Icon, children, className, note }) => (
  <section className={cn('rounded-[18px] border border-v2-border bg-v2-surface shadow-v2 px-4 py-3.5 flex flex-col min-w-0', className)} aria-label={title}>
    <header className="flex items-center gap-2 mb-3 min-w-0">
      <Icon className="h-[18px] w-[18px] text-v2-navy shrink-0" aria-hidden />
      <h2 className="text-[15px] md:text-[16px] font-bold text-v2-text truncate">{title}</h2>
    </header>
    <div className="flex-1 min-w-0">{children}</div>
    {note && <p className="mt-2 text-[11px] leading-snug text-v2-muted">{note}</p>}
  </section>
);

const Unavailable: React.FC<{ title: string; description: string; icon?: React.ElementType }> = ({ title, description, icon: Icon = UserRound }) => (
  <div className="h-full min-h-[210px] flex flex-col items-center justify-center text-center gap-2 px-3">
    <span className="h-11 w-11 rounded-full bg-v2-table-head text-v2-muted inline-flex items-center justify-center" aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
    <p className="text-[14px] font-bold text-v2-text">{title}</p>
    <p className="text-[13px] leading-relaxed text-v2-muted max-w-[280px]">{description}</p>
  </div>
);

const Unauthorized = () => (
  <EmptyState title="אין הרשאה לצפייה" description="הנתונים זמינים לבעלי הרשאת צפייה בדוחות." className="py-6" />
);

const Change: React.FC<{ value: number | null; unit?: 'pct' | 'pp' }> = ({ value, unit = 'pct' }) => {
  if (value === null) return <span className="text-v2-muted text-[12px]">אין נתוני השוואה</span>;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[13px] font-bold', up ? 'text-v2-green' : 'text-v2-red')}>
      <bdi dir="ltr">{up ? '+' : ''}{pct1.format(value)}{unit === 'pct' ? '%' : ''}</bdi>
      {unit === 'pp' && <span className="font-semibold">נק׳</span>}
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
};

const kpiBg = {
  blue: 'bg-[#e7f1ff]',
  green: 'bg-[#e5f8ee]',
  purple: 'bg-[#f3e9ff]',
  sky: 'bg-[#e7f4ff]',
  mint: 'bg-[#e7f8f2]',
  amber: 'bg-[#fff1e4]',
};
const kpiText = {
  blue: 'text-[#1d6fe0]', green: 'text-[#14944a]', purple: 'text-[#7c3aed]',
  sky: 'text-[#1d6fe0]', mint: 'text-[#14944a]', amber: 'text-[#d97706]',
};

const Kpi: React.FC<{
  label: string; icon: React.ElementType; tone: keyof typeof kpiBg; value: React.ReactNode | null;
  footer?: React.ReactNode; loading?: boolean; error?: boolean; unavailable?: string;
}> = ({ label, icon: Icon, tone, value, footer, loading, error, unavailable }) => (
  <div className={cn('rounded-[18px] border border-white/70 shadow-v2 px-3 py-3.5 flex flex-col items-center text-center gap-1 min-h-[128px] justify-between min-w-0', kpiBg[tone])}>
    <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
      <span className="text-[13px] xl:text-[14px] font-bold text-v2-text leading-tight">{label}</span>
      <Icon className={cn('h-5 w-5 shrink-0', kpiText[tone])} aria-hidden />
    </div>
    {loading ? (
      <div className="animate-pulse h-8 w-2/3 rounded-lg bg-white/70" role="status"><span className="sr-only">טוען…</span></div>
    ) : error ? (
      <span className="text-sm font-semibold text-v2-red" role="alert">שגיאה בטעינה</span>
    ) : value === null ? (
      <span className="text-sm text-v2-muted">{unavailable ?? 'לא זמין'}</span>
    ) : (
      <span className={cn('text-[26px] xl:text-[30px] font-extrabold leading-none tracking-tight', kpiText[tone])}>{value}</span>
    )}
    <div className="min-h-[18px] text-[12px] leading-tight">{!loading && !error && footer}</div>
  </div>
);

const DateRangePicker: React.FC<{ range: DayRange; onChange: (r: DayRange) => void }> = ({ range, onChange }) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const invalid = !from || !to || from > to;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setFrom(range.from); setTo(range.to); } }}>
      <PopoverTrigger className="h-11 px-3 inline-flex items-center gap-2 rounded-[12px] border border-v2-border bg-v2-surface text-v2-text text-[13px] font-semibold hover:bg-v2-table-head" aria-label="בחירת טווח תאריכים">
        <CalendarDays className="h-[18px] w-[18px] text-v2-navy" aria-hidden />
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
    'h-11 px-3 xl:px-3.5 inline-flex items-center gap-1.5 rounded-[12px] font-semibold text-[13px] xl:text-[14px] transition-colors duration-300 whitespace-nowrap',
    primary ? 'bg-v2-primary text-white hover:bg-v2-primary-dark' : 'border border-v2-border bg-v2-surface text-v2-text hover:bg-v2-table-head',
  );
  const content = <><span>{label}</span>{primary ? <Plus className="h-4 w-4" aria-hidden /> : <Icon className="h-[18px] w-[18px]" aria-hidden />}</>;
  if (!to) return <span aria-disabled="true" title={`${label} — עדיין לא זמין`} className={cn(cls, 'opacity-50 cursor-not-allowed')}>{content}</span>;
  return <Link to={to} className={cls}>{content}</Link>;
};

const STAGES = ['הזמנה אושרה', 'בייצור', 'בדרך לנמל', 'שחרור מכס', 'הובלה אלינו'] as const;
/** Real status → completed stages and the in-progress stage. No inferred dates. */
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

const isCurrentMonth = (range: DayRange) => {
  const month = defaultRange();
  return range.from === month.from && range.to === month.to;
};

export const DashboardV2: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const range = useMemo(() => resolveRange(params.get('from'), params.get('to')), [params]);
  const prev = useMemo(() => previousRange(range), [range]);
  const setRange = (r: DayRange) => {
    const next = new URLSearchParams(params);
    next.set('from', r.from); next.set('to', r.to);
    setParams(next, { replace: true });
  };

  const inDrawer = useIsSidebarDrawer();
  const { permissions } = useUserRole();
  const canFin = !!permissions.canViewReports;
  const canStock = !!permissions.canViewProducts;
  const canImports = !!permissions.canManageSettings;
  const canProcure = !!permissions.canEditProducts;

  const cur = useDashboardSales(range, canFin);
  const attribution = useEmployeeAttribution(range, canFin);
  const sqlReport = useEmployeeSalesReport(range, canFin);
  const old = useDashboardSales(prev, canFin);
  const stock = useDashboardStock(canStock);
  const imp = useDashboardActiveImport(canImports);
  const proc = useOpenProcurementCount(canProcure);

  const s = useMemo(() => (cur.data ? summarize(cur.data.rows) : null), [cur.data]);
  const p = useMemo(() => (old.data ? summarize(old.data.rows) : null), [old.data]);
  const daily = useMemo(() => (cur.data ? dailySeries(cur.data.rows, range) : []), [cur.data, range]);
  const top = useMemo(() => (cur.data ? topProductsByProfit(cur.data.rows, 4) : null), [cur.data]);

  const nameById = useMemo(() => new Map((stock.data ?? []).map((x) => [x.id, x.name])), [stock.data]);
  const imageById = useMemo(() => new Map((stock.data ?? []).map((x) => [x.id, x.image])), [stock.data]);
  const available = useMemo(() => (stock.data ? stock.data.reduce((a, x) => a + Math.max(x.quantity, 0), 0) : null), [stock.data]);
  const lowStock = useMemo(
    () => (stock.data ?? []).filter((x) => x.quantity <= x.threshold)
      .sort((a, b) => a.quantity - b.quantity || a.quantity / Math.max(a.threshold, 1) - b.quantity / Math.max(b.threshold, 1)),
    [stock.data],
  );

  const finLoading = cur.isLoading || old.isLoading;
  const finError = cur.isError;
  const partialCost = !!(s && s.costCoveragePct !== null && s.costCoveragePct < 99.95);
  const marginPP = s?.marginPct != null && p?.marginPct != null ? s.marginPct - p.marginPct : null;
  const revenueChange = s && p ? pctChange(s.revenueGross, p.revenueGross) : null;
  const chartData = daily.map((d) => ({ ...d, label: `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}` }));

  return (
    <div dir="rtl" className="w-full max-w-full overflow-x-hidden font-[Heebo] text-v2-text">
      <div className="flex flex-col gap-4 mb-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 min-w-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <Gauge className="h-9 w-9 text-v2-primary shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-[24px] md:text-[30px] font-extrabold leading-tight">דשבורד ראשי | מלאיקו</h1>
              <p className="text-[13px] md:text-[14px] text-v2-muted">מבט כולל על המכירות, המלאי, הרכש והפעילות העסקית</p>
            </div>
          </div>
          {!inDrawer && (
            <div className="shrink-0">
              <Header variant="inline" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker range={range} onChange={setRange} />
          <ActionBtn label="תיקון מלאי" icon={Wrench} to={canStock ? '/inventory' : null} />
          <ActionBtn label="הזמנת רכש" icon={Truck} to={canProcure ? '/procurement' : null} />
          <ActionBtn label="קליטת סחורה" icon={Package} to={canImports ? '/import' : null} />
          <ActionBtn label="מכירה חדשה" icon={Plus} to={canStock ? '/sale' : null} primary />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 min-[1440px]:grid-cols-6 gap-3 mb-3">
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
        <Kpi label="מלאי זמין למכירה" icon={Boxes} tone="mint" loading={stock.isLoading} error={stock.isError}
          value={!canStock ? null : available !== null ? num0.format(available) : null} unavailable={!canStock ? 'אין הרשאה' : undefined}
          footer={<span className="text-v2-muted">יחידות במלאי כעת</span>} />
        <Kpi label="פריטים במינימום" icon={AlertTriangle} tone="amber" loading={stock.isLoading} error={stock.isError}
          value={!canStock ? null : stock.data ? num0.format(lowStock.length) : null} unavailable={!canStock ? 'אין הרשאה' : undefined}
          footer={lowStock.length > 0 ? <span className="text-v2-amber font-semibold">דורש טיפול</span> : <span className="text-v2-muted">אין חריגה</span>} />
      </div>
      {cur.data?.truncated && (
        <p role="alert" className="mb-3 text-xs text-v2-amber font-semibold">הטווח כולל יותר מ-20,000 תנועות מכירה — הנתונים מוצגים באופן חלקי. מומלץ לצמצם את הטווח.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1.05fr_0.92fr_1.22fr] gap-3 mb-3">
        <Panel title="ביצועי עובדים (לפי רווח גולמי)" icon={UserRound}>
          {!canFin ? <Unauthorized /> : V2_REPORTS_SQL_READY ? (
            <AuthorizedEmployeeReport loading={sqlReport.isLoading} error={sqlReport.isError} report={sqlReport.data} onRetry={() => { void sqlReport.refetch(); }} />
          ) : !attribution.ready ? (
            <Unavailable
              title="שיוך מכירות לעובד כבוי"
              description={s
                ? `מחזור ${ils0.format(s.revenueGross)} ו-${num0.format(s.units)} צמיגים בטווח אינם משויכים לעובד, כי שיוך המכירות כבוי.`
                : 'טבלת העובדים קיימת. שיוך המכירות כבוי, ולכן אין דירוג.'}
            />
          ) : (
            <EmployeePanelStatus loading={attribution.isLoading} error={attribution.isError} onRetry={attribution.refetch}>
              {attribution.analytics && (
                <EmployeeRankingBody analytics={attribution.analytics} names={attribution.names} truncated={attribution.truncated} />
              )}
            </EmployeePanelStatus>
          )}
        </Panel>
        <Panel title="חלוקת מכירות לפי עובד" icon={PieIcon}>
          {!canFin ? <Unauthorized /> : V2_REPORTS_SQL_READY ? (
            <AuthorizedEmployeeReport loading={sqlReport.isLoading} error={sqlReport.isError} report={sqlReport.data} onRetry={() => { void sqlReport.refetch(); }} />
          ) : !attribution.ready ? (
            <Unavailable
              icon={PieIcon}
              title="חלוקה לפי עובד אינה זמינה"
              description={s
                ? `כיסוי שיוך 0%. ${ils0.format(s.revenueGross)} אינם משויכים לעובד, ולכן אין תרשים.`
                : 'אין שיוך של מכירה לעובד, ולכן לא ניתן לחלק את המחזור.'}
            />
          ) : (
            <EmployeePanelStatus loading={attribution.isLoading} error={attribution.isError} onRetry={attribution.refetch}>
              {attribution.analytics && (
                <EmployeeDistributionBody analytics={attribution.analytics} names={attribution.names} />
              )}
            </EmployeePanelStatus>
          )}
        </Panel>
        <Panel title="מכירות ורווח גולמי לפי ימים" icon={Clock} className="md:col-span-2 min-[1440px]:col-span-1"
          note={partialCost ? 'נקודות רווח חסרות = ימים ללא עלות ידועה. רווח מחושב לפני מע״מ. מחזור כולל מע״מ.' : 'רווח מחושב לפני מע״מ. מחזור כולל מע״מ.'}>
          {!canFin ? <Unauthorized /> : cur.isLoading ? <LoadingSkeleton variant="panel" /> : cur.isError ? <ErrorState onRetry={() => cur.refetch()} /> : (
            <div className="min-w-0">
              <div className="h-[210px] w-full min-w-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--v2-border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--v2-muted))' }} interval={chartData.length > 12 ? Math.ceil(chartData.length / 6) : 0} minTickGap={12} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--v2-muted))' }} width={52} axisLine={false} tickLine={false} tickFormatter={(v) => axisNum.format(Number(v))} />
                    <Tooltip formatter={(v: number | null, n) => [v === null || Number.isNaN(Number(v)) ? 'לא ידוע' : ils0.format(Number(v)), String(n)]} />
                    <Bar dataKey="revenue" name="מחזור מכירות" fill="hsl(var(--v2-primary))" radius={[5, 5, 0, 0]} maxBarSize={18} />
                    <Line dataKey="profit" name="רווח גולמי" stroke="hsl(var(--v2-purple))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--v2-purple))' }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex items-center justify-center gap-4 text-[12px] text-v2-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-v2-primary" aria-hidden />מחזור מכירות</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-v2-purple" aria-hidden />רווח גולמי</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1fr_1.15fr_1fr] gap-3 mb-3">
        <Panel title="התראות מלאי" icon={Bell}>
          {!canStock ? <Unauthorized /> : stock.isLoading ? <LoadingSkeleton variant="panel" /> : stock.isError ? <ErrorState onRetry={() => stock.refetch()} /> :
            lowStock.length === 0 ? <EmptyState title="אין מוצרים מתחת למינימום" className="py-6" /> : (
              <ul className="divide-y divide-v2-border">
                {lowStock.slice(0, 3).map((x) => (
                  <li key={x.id}>
                    <Link to="/inventory" className="flex items-center gap-3 py-2.5 hover:bg-v2-table-head rounded-[12px] px-1 min-w-0">
                      <span className={cn('min-w-[46px] rounded-[10px] px-1.5 py-1 text-center leading-tight font-bold shrink-0', x.quantity <= 0 ? 'bg-v2-red-soft text-v2-red' : 'bg-[#ffe8d6] text-[#e07a12]')}>
                        <span className="block text-[16px]">{num0.format(x.quantity)}</span><span className="block text-[11px]">יח׳</span>
                      </span>
                      <span className="flex-1 min-w-0 text-[14px] font-semibold truncate"><Bidi>{x.name}</Bidi></span>
                      {x.image ? <img src={x.image} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 bg-v2-table-head" loading="lazy" />
                        : <span className="h-11 w-11 rounded-full bg-v2-table-head flex items-center justify-center shrink-0"><Disc3 className="h-6 w-6 text-v2-navy" aria-hidden /></span>}
                      <ChevronLeft className="h-4 w-4 text-v2-muted shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title="הזמנות רכש והיבוא בתהליך" icon={Truck} note={imp.data?.current ? 'תאריך מוצג רק כשהוא שמור על ההזמנה. שאר השלבים מוצגים לפי סטטוס בלבד.' : undefined}>
          {!canImports ? <Unauthorized /> : imp.isLoading ? <LoadingSkeleton variant="panel" /> : imp.isError ? <ErrorState onRetry={() => imp.refetch()} /> :
            !imp.data?.current ? <EmptyState icon={<Ship className="h-6 w-6" />} title="אין הזמנות יבוא פעילות" className="py-6" /> : (() => {
              const o = imp.data.current;
              const st = STAGE_MAP[o.status] ?? { done: 0, current: null };
              const line = Math.max(0, st.done - 1) / (STAGES.length - 1);
              return (
                <Link to={`/import/${o.id}`} className="block min-w-0">
                  <div className="rounded-[12px] bg-v2-table-head px-3 py-2 text-center text-[13px] font-semibold flex flex-wrap justify-center gap-x-3 gap-y-1">
                    <Bidi>#{o.import_number}</Bidi>
                    <span className="text-v2-muted">|</span>
                    <span>{num0.format(o.ordered_units)} יח׳</span>
                    <span className="text-v2-muted">|</span>
                    <span>ETA: {o.estimated_arrival_date ? <Bidi>{formatDayHe(o.estimated_arrival_date.slice(0, 10))}</Bidi> : 'לא ידוע'}</span>
                  </div>
                  <ol className="mt-5 grid grid-cols-5 relative min-w-0">
                    <span className="absolute top-[15px] right-[10%] left-[10%] h-[3px] rounded-full bg-v2-border" aria-hidden />
                    <span className="absolute top-[15px] right-[10%] h-[3px] rounded-full bg-v2-green" style={{ width: `${line * 80}%` }} aria-hidden />
                    {STAGES.map((label, i) => {
                      const done = i < st.done && st.current !== i;
                      const current = st.current === i;
                      const date = i === 0 && o.order_date ? formatDayHe(o.order_date.slice(0, 10)) : null;
                      return (
                        <li key={label} className="relative flex flex-col items-center text-center gap-1 min-w-0 px-0.5">
                          <span className={cn('h-8 w-8 rounded-full flex items-center justify-center z-10',
                            done ? 'bg-v2-green text-white' : current ? 'bg-v2-surface text-v2-primary ring-2 ring-v2-primary' : 'bg-v2-surface text-v2-muted ring-2 ring-v2-border')}>
                            {done ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
                          </span>
                          <span className="text-[11px] md:text-[12px] font-semibold leading-tight">{label}</span>
                          <span className="text-[11px] text-v2-muted">{date ? <Bidi>{date}</Bidi> : done ? 'הושלם' : current ? 'בתהליך' : '—'}</span>
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
          {!canFin ? <Unauthorized /> : cur.isLoading ? <LoadingSkeleton variant="table" rows={4} /> : cur.isError ? <ErrorState onRetry={() => cur.refetch()} /> :
            !top || top.ranked.length === 0 ? <EmptyState title="אין מכירות עם עלות ידועה בטווח" className="py-6" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] min-w-[260px]">
                  <thead>
                    <tr className="text-v2-muted text-[12px]">
                      <th className="text-right font-semibold py-1.5 px-1">מוצר</th>
                      <th className="text-center font-semibold py-1.5 px-1 w-16">כמות</th>
                      <th className="text-left font-semibold py-1.5 px-1 w-28">רווח גולמי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.ranked.map((r) => (
                      <tr key={r.product_id} className="border-t border-v2-border">
                        <td className="py-2 px-1 max-w-[180px]">
                          <span className="flex items-center gap-2 min-w-0">
                            {imageById.get(r.product_id)
                              ? <img src={imageById.get(r.product_id) ?? ''} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" loading="lazy" />
                              : <Disc3 className="h-4 w-4 text-v2-muted shrink-0" aria-hidden />}
                            <span className="truncate font-medium"><Bidi>{nameById.get(r.product_id) ?? '—'}</Bidi></span>
                          </span>
                        </td>
                        <td className="py-2 px-1 text-center text-v2-navy">{num0.format(r.units)}</td>
                        <td className="py-2 px-1 text-left font-extrabold text-v2-green whitespace-nowrap">
                          {money(r.profit)}
                          {r.unknownCostUnits > 0 && <span className="text-v2-amber font-bold" title="חלק מהיחידות ללא עלות ידועה">*</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 min-[1440px]:grid-cols-[1.4fr_0.95fr_0.95fr] gap-3">
        <Panel title={isCurrentMonth(range) ? 'תובנות לחודש הנוכחי' : 'תובנות לתקופה הנבחרת'} icon={LineChart}>
          {(() => {
            const items: { tone: string; icon: React.ElementType; title: string; detail: string }[] = [];
            if (canStock && stock.data) {
              items.push(lowStock.length > 0
                ? { tone: 'bg-[#e7f1ff] text-[#1d6fe0]', icon: Package, title: `${num0.format(lowStock.length)} פריטים מתחת למינימום מלאי`, detail: 'מומלץ לבצע הזמנת רכש משלימה' }
                : { tone: 'bg-[#e7f1ff] text-[#1d6fe0]', icon: Package, title: 'כל הפריטים מעל סף המינימום', detail: 'אין כרגע התראת מלאי פתוחה' });
            }
            if (canFin && marginPP !== null && s?.marginPct != null) {
              items.push({
                tone: 'bg-[#f3e9ff] text-[#7c3aed]', icon: Target,
                title: `שיעור הרווח הגולמי ${marginPP >= 0 ? 'עלה' : 'ירד'} ל-${pct1.format(s.marginPct)}%`,
                detail: `(${marginPP >= 0 ? '+' : ''}${pct1.format(marginPP)} נקודות אחוז)`,
              });
            }
            if (canFin && revenueChange !== null) {
              items.push({
                tone: 'bg-[#e5f8ee] text-[#14944a]', icon: revenueChange >= 0 ? TrendingUp : TrendingDown,
                title: `${revenueChange >= 0 ? 'עלייה' : 'ירידה'} של ${pct1.format(Math.abs(revenueChange))}% במחזור המכירות`,
                detail: 'בהשוואה לתקופה הקודמת',
              });
            }
            if (cur.isLoading || stock.isLoading) return <LoadingSkeleton variant="panel" />;
            if (items.length === 0) return <EmptyState title="אין מספיק נתונים לתובנות" className="py-6" />;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {items.map((it) => (
                  <div key={it.title} className={cn('rounded-[16px] px-3 py-4 flex flex-col items-center text-center gap-2 min-h-[132px] justify-center', it.tone)}>
                    <it.icon className="h-7 w-7" aria-hidden />
                    <p className="text-[13px] font-bold text-v2-text leading-snug">{it.title}</p>
                    <p className="text-[12px] text-v2-muted leading-snug">{it.detail}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </Panel>

        <Panel title="משימות להיום" icon={ListChecks}>
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
                    <Link to={t.to} className="flex items-center gap-3 py-2.5 text-[14px] font-medium hover:text-v2-primary-dark min-w-0">
                      <span className="h-5 w-5 rounded-[6px] border-2 border-v2-border bg-v2-surface shrink-0" aria-hidden />
                      <span className="flex-1 min-w-0">{t.label}</span>
                      <ChevronLeft className="h-4 w-4 text-v2-muted shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            );
          })()}
        </Panel>

        <Panel title="פעולות מהירות" icon={Zap} className="md:col-span-2 min-[1440px]:col-span-1">
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { label: 'דוח מכירות', icon: BarChart3, to: canFin ? '/reports' : null, tone: 'bg-[#e7f1ff] text-[#1d6fe0]' },
              { label: 'דוח מלאי', icon: Layers, to: canStock ? '/inventory' : null, tone: 'bg-[#e5f8ee] text-[#14944a]' },
              { label: 'רווחיות מוצרים', icon: Tag, to: canFin ? '/reports' : null, tone: 'bg-[#f3e9ff] text-[#7c3aed]' },
              { label: 'ביצועי עובדים', icon: Users, to: canFin ? '/employees' : null, tone: 'bg-[#e7f4ff] text-[#1d6fe0]' },
            ] as const).map((a) => {
              const inner = (
                <>
                  <a.icon className="h-6 w-6 shrink-0" aria-hidden />
                  <span className="text-[13px] xl:text-[14px] font-bold text-v2-text text-center leading-tight">{a.label}</span>
                </>
              );
              const cls = cn('min-h-[72px] rounded-[16px] flex flex-col items-center justify-center gap-1.5 px-2', a.tone);
              return a.to
                ? <Link key={a.label} to={a.to} className={cn(cls, 'hover:opacity-80 transition-opacity')}>{inner}</Link>
                : <span key={a.label} aria-disabled="true" title="אין הרשאה" className={cn(cls, 'opacity-60 cursor-not-allowed')}>
                    {inner}<span className="text-[10px] font-semibold text-v2-muted">לא זמין</span>
                  </span>;
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};

const AuthorizedEmployeeReport: React.FC<{
  loading: boolean;
  error: boolean;
  report: EmployeeSalesReport | undefined;
  onRetry: () => void;
}> = ({ loading, error, report, onRetry }) => {
  const employees = useEmployees(true);
  if (loading) return <LoadingSkeleton variant="panel" />;
  if (error || !report) return <ErrorState onRetry={onRetry} />;
  const profit = (value: number | null) => value === null ? 'עלות לא ידועה' : ils0.format(value);
  const name = (id: string) => employees.employees.find((employee) => employee.id === id)?.display_name ?? 'שם לא זמין';
  return (
    <div className="space-y-2 text-sm">
      <p className="font-bold">ללא שיוך: {ils0.format(report.unattributed.revenueGross)} · {profit(report.unattributed.grossProfit)}</p>
      {report.employees.length === 0 ? <p className="text-v2-muted">אין מכירה עם מוכר בטווח.</p> : report.employees.map((employee) => (
        <p key={employee.employeeId} className="flex justify-between gap-3">
          <span className="truncate">{name(employee.employeeId)}</span>
          <span>{ils0.format(employee.revenueGross)} · {profit(employee.grossProfit)}</span>
        </p>
      ))}
      <p className="text-xs text-v2-muted">החזרות לקוח בטווח: {num0.format(report.customerReturnUnits)} יחידות. הן אינן מפחיתות את המחזור.</p>
    </div>
  );
};

export default DashboardV2;
