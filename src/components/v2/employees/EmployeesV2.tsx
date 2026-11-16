import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { useUserRole } from '@/hooks/useUserRole';
import { useDashboardSales } from '@/hooks/v2/useV2Dashboard';
import { useEmployeeAttribution } from '@/hooks/v2/useEmployeeAttribution';
import { saveEmployee, setEmployeeActive, useEmployees } from '@/hooks/v2/useEmployees';
import {
  defaultRange, employeeInsights, formatDayHe, pctChange, previousRange, summarize, type DayRange,
} from '@/lib/v2/dashboardMetrics';
import { EmployeeDistributionBody } from '@/components/v2/dashboard/EmployeeAnalyticsPanels';
import { v2Button } from '@/components/v2/Controls';
import { CurrencyValue } from '@/components/v2/Display';
import { hebrewEmployeeError } from '@/lib/v2/saleErrors';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/v2/States';

const ils0 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
type SortKey = 'revenueGross' | 'grossProfit' | 'transactions' | 'tiresSold' | 'averageTransactionValue';

const money = (value: number | null) => value === null ? '—' : ils0.format(value);

export const EmployeesV2: React.FC = () => {
  const { permissions } = useUserRole();
  const { activeBusiness } = useActiveBusiness();
  const canFin = !!permissions.canViewReports;
  const isOwner = !!activeBusiness?.is_owner;
  const businessId = activeBusiness?.business_id ?? null;
  const [tab, setTab] = useState<'performance' | 'manage'>('performance');
  const [range, setRange] = useState<DayRange>(() => defaultRange());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('grossProfit');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const saveLock = useRef(false);
  const toggleLock = useRef<string | null>(null);

  const safeRange = range.from <= range.to ? range : { from: range.to, to: range.from };
  const current = useDashboardSales(safeRange, canFin && tab === 'performance');
  const previous = useDashboardSales(previousRange(safeRange), canFin && tab === 'performance');
  const attribution = useEmployeeAttribution(safeRange, canFin && tab === 'performance');
  const priorAttribution = useEmployeeAttribution(previousRange(safeRange), canFin && tab === 'performance' && attribution.ready);
  const directory = useEmployees();

  const summary = current.data ? summarize(current.data.rows) : null;
  const priorSummary = previous.data ? summarize(previous.data.rows) : null;
  const people = useMemo(
    () => (attribution.analytics ? [...attribution.analytics.ranked, ...attribution.analytics.unranked] : []),
    [attribution.analytics],
  );
  const names = attribution.names;

  const productIds = useMemo(
    () => [...new Set((attribution.analytics?.products ?? []).map((row) => row.productId))],
    [attribution.analytics],
  );
  const productNames = useQuery({
    queryKey: ['v2-employee-product-names', productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name').in('id', productIds);
      if (error) throw error;
      return new Map((data ?? []).map((product) => [product.id, product.name]));
    },
  });

  const rows = useMemo(() => {
    const filtered = people.filter((person) => !selectedId || person.employeeId === selectedId);
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return (bv as number) - (av as number);
    });
  }, [people, selectedId, sortKey]);

  const insights = attribution.analytics ? employeeInsights(attribution.analytics, priorAttribution.analytics) : [];
  const products = (attribution.analytics?.products ?? []).filter((row) => {
    if (selectedId && row.employeeId !== selectedId) return false;
    if (productId && row.productId !== productId) return false;
    return row.employeeId !== null;
  });
  const daily = (attribution.analytics?.daily ?? [])
    .filter((row) => row.employeeId === selectedId)
    .map((row) => ({ label: formatDayHe(row.day).slice(0, 5), revenue: row.revenueGross }));

  const save = async () => {
    if (!directory.canManage || !isOwner || !businessId || saveLock.current) return;
    saveLock.current = true;
    setSavingEmployee(true);
    setFormError(null);
    setFormNotice(null);
    const wasEditing = editingId;
    try {
      await saveEmployee(businessId, name, editingId ?? undefined);
      setName('');
      setEditingId(null);
      setFormNotice(wasEditing ? 'השם עודכן.' : 'העובד נוסף.');
      directory.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : hebrewEmployeeError(error));
    } finally {
      saveLock.current = false;
      setSavingEmployee(false);
    }
  };
  const toggleEmployee = async (employeeId: string, isActive: boolean) => {
    if (!directory.canManage || !businessId || !isOwner || toggleLock.current) return;
    toggleLock.current = employeeId;
    setPendingToggleId(employeeId);
    setFormError(null);
    setFormNotice(null);
    setConfirmDeactivateId(null);
    try {
      await setEmployeeActive(businessId, employeeId, isActive);
      setFormNotice(isActive ? 'העובד הופעל.' : 'העובד הושבת. מכירות קודמות נשארו.');
      directory.refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : hebrewEmployeeError(error));
    } finally {
      toggleLock.current = null;
      setPendingToggleId(null);
    }
  };

  return (
    <div dir="rtl" className="font-[Heebo] text-v2-text min-w-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
        <div>
          <h1 className="text-[26px] md:text-[30px] font-extrabold">עובדים</h1>
          <p className="text-sm text-v2-muted">ביצועי מכירה לפי שיוך. אין כאן חישוב לפי שעת עבודה.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={tab === 'performance' ? v2Button.primary : v2Button.secondary} onClick={() => setTab('performance')}>ביצועי עובדים</button>
          <button type="button" className={tab === 'manage' ? v2Button.primary : v2Button.secondary} onClick={() => setTab('manage')}>ניהול עובדים</button>
        </div>
      </div>

      {tab === 'manage' ? (
        <section className="rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] p-4">
          {!directory.canManage ? (
            <EmptyState title="ניהול העובדים כבוי" description="טבלת העובדים כבר קיימת. ההוספה, העריכה וההפעלה ייפתחו בנפרד משמירת המכירה, אחרי אישור נפרד. לא נוצרו עובדים לדוגמה." />
          ) : directory.isLoading ? <LoadingSkeleton variant="panel" /> : directory.isError ? <ErrorState onRetry={directory.refetch} /> : (
            <>
              <p className="text-sm text-v2-muted mb-3">השבתה לא מוחקת עובד ולא משייכת מכירות קיימות. לעובד בלי מכירות משויכות אין מחזור.</p>
              <ul className="divide-y divide-v2-border mb-4">
                {directory.employees.length === 0 && <li className="py-3 text-sm text-v2-muted">אין עדיין עובדים. בעל העסק יכול להוסיף את העובד הראשון.</li>}
                {directory.employees.map((employee) => (
                  <li key={employee.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="font-semibold min-w-0 break-words">{employee.display_name}</span>
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${employee.is_active ? 'bg-[#e9f9ef] text-v2-green' : 'bg-v2-table-head text-v2-muted'}`}>{employee.is_active ? 'פעיל' : 'לא פעיל'}</span>
                    {isOwner && (
                      <span className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button type="button" className="min-h-11 px-3 text-v2-blue font-semibold" onClick={() => { setEditingId(employee.id); setName(employee.display_name); setFormError(null); setFormNotice(null); }}>עריכה</button>
                        {employee.is_active ? (
                          <button type="button" className="min-h-11 px-3 text-v2-navy font-semibold" onClick={() => setConfirmDeactivateId(employee.id)}>השבתה</button>
                        ) : (
                          <button type="button" className="min-h-11 px-3 text-v2-navy font-semibold disabled:opacity-40" disabled={pendingToggleId !== null} onClick={() => { void toggleEmployee(employee.id, true); }}>הפעלה</button>
                        )}
                      </span>
                    )}
                    {confirmDeactivateId === employee.id && (
                      <div className="w-full rounded-2xl bg-v2-table-head p-3 text-sm">
                        <p>להשבית את {employee.display_name}? המכירות שכבר נשמרו לא ישתנו.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" className={v2Button.primary} disabled={pendingToggleId !== null} onClick={() => { void toggleEmployee(employee.id, false); }}>אישור השבתה</button>
                          <button type="button" className={v2Button.secondary} onClick={() => setConfirmDeactivateId(null)}>ביטול</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {isOwner ? (
                <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
                  <input className="h-11 flex-1 min-w-[10rem] rounded-v2-control border border-v2-border px-3" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="שם העובד" aria-label="שם העובד" />
                  <button type="submit" className={v2Button.primary} disabled={!name.trim() || savingEmployee}>{editingId ? 'שמירת שם' : 'הוספת עובד'}</button>
                  {editingId && <button type="button" className={v2Button.secondary} onClick={() => { setEditingId(null); setName(''); }}>ביטול עריכה</button>}
                </form>
              ) : <p className="text-sm text-v2-muted">רק בעל העסק יכול להוסיף או לערוך עובדים. אפשר לצפות ברשימה.</p>}
              {formNotice && <p className="mt-2 text-sm text-v2-green font-semibold">{formNotice}</p>}
              {formError && <p className="mt-2 text-sm text-v2-red">{formError}</p>}
            </>
          )}
        </section>
      ) : !canFin ? (
        <EmptyState title="אין הרשאה לנתוני מכירות" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <label className="text-sm">מתאריך
              <input type="date" className="mr-2 h-11 rounded-v2-control border border-v2-border px-2" value={range.from} onChange={(event) => setRange((currentRange) => ({ ...currentRange, from: event.target.value }))} />
            </label>
            <label className="text-sm">עד
              <input type="date" className="mr-2 h-11 rounded-v2-control border border-v2-border px-2" value={range.to} onChange={(event) => setRange((currentRange) => ({ ...currentRange, to: event.target.value }))} />
            </label>
            <p className="text-xs text-v2-muted self-center">אין סניפים במערכת, ולכן אין סינון סניף.</p>
          </div>

          {current.isLoading ? <LoadingSkeleton variant="panel" /> : current.isError ? <ErrorState onRetry={() => current.refetch()} /> : summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                <Kpi tone={kpiTones[0]} label="צמיגים שנמכרו" value={String(summary.units)} change={pctChange(summary.units, priorSummary?.units ?? null)} />
                <Kpi tone={kpiTones[1]} label="עסקאות" value={String(summary.saleCount)} change={pctChange(summary.saleCount, priorSummary?.saleCount ?? null)} />
                <Kpi tone={kpiTones[2]} label="מחזור" value={ils0.format(summary.revenueGross)} change={pctChange(summary.revenueGross, priorSummary?.revenueGross ?? null)} />
                <Kpi tone={kpiTones[3]} label="רווח גולמי ידוע" value={money(summary.grossProfit)} change={summary.grossProfit !== null && priorSummary?.grossProfit != null ? pctChange(summary.grossProfit, priorSummary.grossProfit) : null} />
                <Kpi tone={kpiTones[4]} label="שיעור רווח" value={summary.costCoveragePct !== null && summary.costCoveragePct < 99.95 ? 'חלקי' : summary.marginPct === null ? '—' : `${pct1.format(summary.marginPct)}%`} change={null} />
              </div>
              <p className="text-xs text-v2-muted mb-3">
                {attribution.ready
                  ? 'הכרטיסים הם סיכום העסק. הטבלה היא רק מכירות משויכות.'
                  : `כל המחזור בטווח (${ils0.format(summary.revenueGross)}) אינו משויך לעובד.`}
                {summary.costCoveragePct !== null && summary.costCoveragePct < 99.95 && ` שיעור הרווח מחושב רק על שורות עם עלות ידועה (${pct1.format(summary.costCoveragePct)}% מהמחזור).`}
              </p>
              {attribution.discounts && (
                <p className="text-xs text-v2-muted mb-3">
                  הנחה ידועה: {ils0.format(attribution.discounts.knownAmount)} על {attribution.discounts.knownUnits} צמיגים. עסקאות במחיר מלא: {attribution.discounts.fullPriceSales}. עסקאות עם הנחה: {attribution.discounts.discountedSales}. בודד {attribution.discounts.shapes.single}, זוג {attribution.discounts.shapes.pair}, רביעייה {attribution.discounts.shapes.set}, מעורב {attribution.discounts.shapes.mixed}.
                  {attribution.discounts.unknownRows > 0 ? ` ${attribution.discounts.unknownRows} שורות בלי מחיר מחירון שמור לא נספרות כהנחה.` : ''}
                  {attribution.discounts.ungroupedKnownRows > 0 ? ` ${attribution.discounts.ungroupedKnownRows} שורות בלי מזהה עסקה לא סווגו כסט.` : ''}
                  {attribution.discounts.byEmployee.map((person) => ` ${names.get(person.employeeId ?? '') ?? 'בלי שיוך'}: ${ils0.format(person.discountIls)}${person.ratePct === null ? '' : ` (${pct1.format(person.ratePct)}% ממחיר המחירון הידוע)`}.`).join('')}
                </p>
              )}

              <div className="rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] overflow-hidden mb-3">
                <div className="flex flex-wrap gap-2 p-3 border-b border-v2-border">
                  <label className="text-sm">מיון
                    <select className="mr-2 h-10 rounded-v2-control border border-v2-border px-2" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                      <option value="grossProfit">רווח גולמי ידוע</option>
                      <option value="revenueGross">מחזור</option>
                      <option value="transactions">עסקאות</option>
                      <option value="tiresSold">צמיגים</option>
                      <option value="averageTransactionValue">ממוצע לעסקה</option>
                    </select>
                  </label>
                  <label className="text-sm">עובד
                    <select className="mr-2 h-10 rounded-v2-control border border-v2-border px-2" value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value || null)}>
                      <option value="">כל העובדים המשויכים</option>
                      {people.map((person) => <option key={person.employeeId} value={person.employeeId}>{names.get(person.employeeId) ?? '—'}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">מוצר
                    <select className="mr-2 h-10 rounded-v2-control border border-v2-border px-2" value={productId ?? ''} onChange={(event) => setProductId(event.target.value || null)} disabled={productIds.length === 0}>
                      <option value="">כל המוצרים שנמכרו</option>
                      {productIds.map((id) => <option key={id} value={id}>{productNames.data?.get(id) ?? '—'}</option>)}
                    </select>
                  </label>
                </div>
                {!attribution.ready || !attribution.analytics ? (
                  <EmptyState title="אין דירוג עובדים" description="הקשר בין מכירה לעובד אינו שמור, ולכן אף עובד לא מוצג." />
                ) : rows.length === 0 ? (
                  <EmptyState title="אין מכירות משויכות בטווח" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-v2-table-head text-v2-muted">
                        <tr>
                          {['עובד', 'מחזור', 'רווח גולמי', 'שיעור', 'עסקאות', 'צמיגים', 'ממוצע לעסקה'].map((heading) => (
                            <th key={heading} className="px-3 py-2 text-right font-semibold">{heading}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.employeeId} className="border-t border-v2-border cursor-pointer" onClick={() => setSelectedId(row.employeeId)}>
                            <td className="px-3 py-2 font-semibold">{names.get(row.employeeId) ?? '—'}</td>
                            <td className="px-3 py-2"><CurrencyValue value={row.revenueGross} /></td>
                            <td className="px-3 py-2">{row.grossProfit === null ? 'אין עלות' : <CurrencyValue value={row.grossProfit} />}{row.rank === null && row.grossProfit !== null ? ' · חלקי' : ''}</td>
                            <td className="px-3 py-2">{row.marginPct === null ? '—' : `${pct1.format(row.marginPct)}%`}</td>
                            <td className="px-3 py-2">{row.transactions}</td>
                            <td className="px-3 py-2">{row.tiresSold}</td>
                            <td className="px-3 py-2">{row.averageTransactionValue === null ? '—' : ils0.format(row.averageTransactionValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {attribution.analytics && (
                <div className="grid gap-3 lg:grid-cols-3">
                  <section className="rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] p-3">
                    <h2 className="font-extrabold mb-2">חלוקת מחזור משויך</h2>
                    <EmployeeDistributionBody analytics={attribution.analytics} names={names} />
                  </section>
                  <section className="rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] p-3">
                    <h2 className="font-extrabold mb-2">מגמה יומית</h2>
                    {selectedId && daily.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={daily}>
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="revenue" fill="hsl(var(--v2-primary))" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-sm text-v2-muted">בחרו עובד כדי לראות את המחזור היומי שלו. מכירות לא משויכות אינן נצבעות כעובד.</p>}
                  </section>
                  <section className="rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] p-3">
                    <h2 className="font-extrabold mb-2">מוצרים</h2>
                    {products.length === 0 ? <p className="text-sm text-v2-muted">אין מוצרים משויכים להצגה.</p> : (
                      <ul className="space-y-1 text-sm">
                        {products.slice(0, 6).map((row) => (
                          <li key={`${row.employeeId}-${row.productId}`} className="flex justify-between gap-2">
                            <span className="truncate">{productNames.data?.get(row.productId) ?? '—'}</span>
                            <bdi>{ils0.format(row.revenueGross)}</bdi>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}

              <section className="mt-3 rounded-v2-card bg-v2-surface shadow-[var(--v2-shadow)] p-4">
                <h2 className="font-extrabold mb-2">ממצאים</h2>
                {insights.length === 0 ? <p className="text-sm text-v2-muted">אין מספיק מכירות משויכות כדי להציג ממצא.</p> : (
                  <ul className="space-y-2 text-sm">
                    {insights.map((insight) => {
                      const employeeName = names.get(insight.employeeId);
                      if (!employeeName) return null;
                      return (
                        <li key={`${insight.title}-${insight.employeeId}`}>
                          <span className="font-semibold">{insight.title}: </span>
                          {employeeName}
                          {' · '}
                          <bdi>{insight.title.includes('שיעור') || insight.title.includes('רווח נמוך') ? `${pct1.format(insight.currentValue)}%` : insight.title.includes('עסקאות') ? String(insight.currentValue) : ils0.format(insight.currentValue)}</bdi>
                          {insight.previousValue !== null && <> מול <bdi>{insight.title.includes('עסקאות') ? String(insight.previousValue) : ils0.format(insight.previousValue)}</bdi></>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

const kpiTones = ['bg-[#e7f6ff]', 'bg-[#fff6e8]', 'bg-[#e7f1ff]', 'bg-[#e9f9ef]', 'bg-[#f4edff]'];

const Kpi: React.FC<{ label: string; value: string; change: number | null; tone: string }> = ({ label, value, change, tone }) => (
  <article className={`rounded-[18px] border border-white shadow-[var(--v2-shadow)] px-3 py-3 ${tone}`}>
    <p className="text-xs font-semibold text-v2-navy">{label}</p>
    <p className="text-[26px] font-extrabold leading-tight mt-1"><bdi>{value}</bdi></p>
    {change !== null && <p className={`text-xs font-semibold ${change >= 0 ? 'text-v2-green' : 'text-v2-red'}`}><bdi>{pct1.format(change)}%</bdi> מול התקופה הקודמת</p>}
  </article>
);
