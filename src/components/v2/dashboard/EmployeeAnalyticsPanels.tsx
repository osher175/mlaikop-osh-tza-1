import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { LoadingSkeleton, ErrorState, EmptyState, Bidi } from '@/components/v2';
import type { EmployeeAnalytics } from '@/lib/v2/dashboardMetrics';

const ils0 = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const COLORS = [
  'hsl(var(--v2-primary))',
  'hsl(var(--v2-purple))',
  'hsl(var(--v2-blue))',
  'hsl(var(--v2-green))',
  'hsl(var(--v2-amber))',
];

const partial = (coverage: number | null) => coverage !== null && coverage < 99.95;

export const EmployeeRankingBody: React.FC<{
  analytics: EmployeeAnalytics;
  names: Map<string, string>;
  truncated: boolean;
}> = ({ analytics, names, truncated }) => {
  const rows = [...analytics.ranked, ...analytics.unranked];
  if (!analytics.reconciles) {
    return <EmptyState title="סיכום העובדים אינו תואם את מחזור המכירות" description="הדירוג הוסתר כדי לא להציג סכום כפול או חסר." className="py-6" />;
  }
  if (rows.length === 0) {
    return <EmptyState title="אין מכירות משויכות לעובד בטווח" className="py-6" />;
  }
  return (
    <div className="min-w-0">
      <ul className="divide-y divide-v2-border">
        {rows.map((row) => {
          const name = names.get(row.employeeId) ?? '—';
          return (
            <li key={row.employeeId} className="flex items-center gap-2 py-2 min-w-0">
              <span className="h-7 w-7 rounded-full bg-v2-table-head text-[12px] font-bold text-v2-navy inline-flex items-center justify-center shrink-0">
                {row.rank ?? '—'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold truncate"><Bidi>{name}</Bidi></span>
                <span className="block text-[11px] text-v2-muted">
                  {row.transactions} עסקאות · <bdi>{ils0.format(row.revenueGross)}</bdi>
                </span>
              </span>
              <span className="text-left shrink-0">
                <span className="block text-[14px] font-extrabold text-v2-green">
                  {row.grossProfit === null ? <span className="text-v2-muted text-[12px] font-semibold">אין נתוני עלות</span> : <bdi>{ils0.format(row.grossProfit)}</bdi>}
                </span>
                <span className="block text-[11px] text-v2-muted">
                  {row.marginPct === null ? '—' : <bdi dir="ltr">{pct1.format(row.marginPct)}%</bdi>}
                  {partial(row.costCoveragePct) && <span className="text-v2-amber font-semibold"> · חלקי</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {analytics.unranked.length > 0 && (
        <p className="mt-2 text-[11px] text-v2-muted">עובדים בלי כיסוי עלות מלא אינם מדורגים. עלות חסרה אינה נספרת כאפס.</p>
      )}
      {truncated && <p className="mt-2 text-[11px] text-v2-amber font-semibold">הטווח חלקי — הדירוג אינו מלא.</p>}
    </div>
  );
};

export const EmployeeDistributionBody: React.FC<{
  analytics: EmployeeAnalytics;
  names: Map<string, string>;
}> = ({ analytics, names }) => {
  if (!analytics.reconciles) {
    return <EmptyState title="חלוקת המכירות אינה תואמת את מחזור המכירות" className="py-6" />;
  }
  const slices = [...analytics.ranked, ...analytics.unranked].filter((row) => row.revenueGross > 0);
  if (slices.length === 0 || analytics.attributedRevenue <= 0) {
    return <EmptyState title="אין מכירות משויכות לעובד בטווח" className="py-6" />;
  }
  const data = slices.map((row) => ({
    id: row.employeeId,
    name: names.get(row.employeeId) ?? '—',
    revenue: row.revenueGross,
    share: (row.revenueGross / analytics.attributedRevenue) * 100,
  }));
  return (
    <div className="min-w-0">
      <div className="relative h-[180px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="revenue" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">
              {data.map((slice, i) => <Cell key={slice.id} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-v2-muted">משויך</span>
          <span className="text-[16px] font-extrabold text-v2-text"><bdi>{ils0.format(analytics.attributedRevenue)}</bdi></span>
        </div>
      </div>
      <ul className="mt-2 space-y-1">
        {data.map((slice, i) => (
          <li key={slice.id} className="flex items-center gap-2 text-[13px] min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <span className="flex-1 truncate font-medium"><Bidi>{slice.name}</Bidi></span>
            <bdi className="font-semibold">{ils0.format(slice.revenue)}</bdi>
            <bdi dir="ltr" className="w-12 text-left text-v2-muted">{pct1.format(slice.share)}%</bdi>
          </li>
        ))}
      </ul>
      {analytics.unattributedRevenue > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-v2-amber">
          כיסוי שיוך {analytics.coveragePct === null ? '—' : <bdi dir="ltr">{pct1.format(analytics.coveragePct)}%</bdi>}.
          {' '}<bdi>{ils0.format(analytics.unattributedRevenue)}</bdi> אינם משויכים לעובד ואינם נכללים בטבעת.
        </p>
      )}
    </div>
  );
};

export const EmployeePanelStatus: React.FC<{ loading: boolean; error: boolean; onRetry: () => void; children: React.ReactNode }> = ({
  loading, error, onRetry, children,
}) => {
  if (loading) return <LoadingSkeleton variant="panel" />;
  if (error) return <ErrorState onRetry={onRetry} />;
  return <>{children}</>;
};
