import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatCurrency';
import { ClosurePanel } from '../ClosurePanel';
import { computeLocalComparison, itemTitle } from './importItemUtils';

interface Props {
  orderId: string;
  items: any[];
  landed: any[];
  costSummary: any;
  payments: any[];
  /** Optional: lets the section state whether it shows a forecast or actuals. */
  receivedUnits?: number;
}

const Stat: React.FC<{ label: string; value: string; strong?: boolean; tone?: 'pos' | 'neg' }> = ({
  label, value, strong, tone,
}) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={[
      strong ? 'text-lg font-bold' : 'text-base font-semibold',
      tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-destructive' : '',
    ].join(' ')}>{value}</p>
  </div>
);

/**
 * STEP 4 — management summary + closure.
 *
 * Local-vs-import comparison (per product, per unit):
 *   חיסכון ליחידה   = מחיר רכישה בישראל − עלות עד המדף ליחידה
 *   חיסכון כולל     = חיסכון ליחידה × כמות
 *   רווח ביבוא      = (מחיר מכירה − עלות עד המדף) × כמות
 *   רווח ברכישה בארץ= (מחיר מכירה − מחיר רכישה בישראל) × כמות
 * A negative saving is displayed as a loss, never hidden.
 */
export const StepSummary: React.FC<Props> = ({ orderId, items, landed, costSummary, payments }) => {
  const byId = new Map(items.map((i) => [i.id, i]));

  const totals = landed.reduce(
    (acc, r) => {
      const qty = Number(r.ordered_quantity ?? 0);
      return {
        units: acc.units + qty,
        goods: acc.goods + Number(r.unit_purchase_cost_ils ?? 0) * qty,
        overhead: acc.overhead + Number(r.overhead_per_unit_ils ?? 0) * qty,
        shelf: acc.shelf + Number(r.expected_landed_unit_cost_ils ?? 0) * qty,
        revenue: acc.revenue + Number(r.planned_sale_price_ils ?? 0) * qty,
      };
    },
    { units: 0, goods: 0, overhead: 0, shelf: 0, revenue: 0 }
  );
  const receivedUnits = items.reduce((s, i) => s + Number(i.received_quantity ?? 0), 0);
  const paid = payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((s, p) => s + Number(p.amount_ils ?? 0), 0);
  const plannedProfit = totals.revenue - totals.shelf;

  const comparisons = landed
    .map((r) => {
      const item = byId.get(r.item_id);
      const cmp = computeLocalComparison(
        item?.local_alternative_unit_cost_ils,
        r.expected_landed_unit_cost_ils,
        r.planned_sale_price_ils,
        Number(r.ordered_quantity ?? 0)
      );
      return cmp ? { row: r, item, cmp } : null;
    })
    .filter(Boolean) as { row: any; item: any; cmp: any }[];

  const totalSaving = comparisons.reduce((s, c) => s + c.cmp.totalSaving, 0);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="יחידות שהוזמנו" value={String(totals.units)} />
        <Stat label="יחידות שנקלטו" value={String(receivedUnits)} />
        <Stat label="עלות סחורה" value={formatCurrency(totals.goods)} />
        <Stat label="הוצאות יבוא" value={formatCurrency(Number(costSummary?.effective_total_ils ?? totals.overhead))} />
        <Stat label="עלות עד המדף (סה״כ)" value={formatCurrency(totals.shelf)} strong />
        <Stat label="שולם עד כה" value={formatCurrency(paid)} />
        <Stat label="הכנסה צפויה" value={formatCurrency(totals.revenue)} />
        <Stat
          label="רווח צפוי"
          value={formatCurrency(plannedProfit)}
          strong
          tone={plannedProfit >= 0 ? 'pos' : 'neg'}
        />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">ניתוח לפי מוצר</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {landed.map((r: any) => {
            const item = byId.get(r.item_id);
            const profitUnit = r.expected_gross_profit_per_unit_ils;
            return (
              <div key={r.item_id} className="rounded-lg border p-3 space-y-1">
                <p className="font-medium">{item ? itemTitle(item) : r.product_description}</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                  <span className="text-muted-foreground">כמות: {r.ordered_quantity}</span>
                  <span className="text-muted-foreground">
                    עלות עד המדף ליחידה: {r.expected_landed_unit_cost_ils != null ? formatCurrency(Number(r.expected_landed_unit_cost_ils)) : '—'}
                  </span>
                  <span className="text-muted-foreground">
                    מחיר מכירה: {r.planned_sale_price_ils ? formatCurrency(Number(r.planned_sale_price_ils)) : '—'}
                  </span>
                  <span className={profitUnit != null && Number(profitUnit) < 0 ? 'text-destructive' : 'text-emerald-600'}>
                    רווח ליחידה: {profitUnit != null ? formatCurrency(Number(profitUnit)) : '—'}
                    {r.expected_gross_margin_percent != null && ` (${Number(r.expected_gross_margin_percent).toFixed(1)}%)`}
                  </span>
                </div>
              </div>
            );
          })}
          {landed.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">אין נתונים לחישוב</p>}
        </CardContent>
      </Card>

      {comparisons.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              יבוא מול רכישה בישראל
              <Badge variant={totalSaving >= 0 ? 'secondary' : 'destructive'}>
                {totalSaving >= 0 ? 'חיסכון כולל' : 'הפסד כולל'} {formatCurrency(Math.abs(totalSaving))}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comparisons.map(({ row, item, cmp }) => (
              <div key={row.item_id} className="rounded-lg border p-3 space-y-1 text-sm">
                <p className="font-medium">{item ? itemTitle(item) : row.product_description}</p>
                <p className="text-muted-foreground">
                  מחיר בישראל {formatCurrency(cmp.localUnit)} · עלות עד המדף ביבוא {formatCurrency(cmp.importUnit)}
                </p>
                <p className={cmp.savingPerUnit >= 0 ? 'text-emerald-600' : 'text-destructive'}>
                  {cmp.savingPerUnit >= 0 ? 'חיסכון' : 'הפסד'} ליחידה {formatCurrency(Math.abs(cmp.savingPerUnit))} ·
                  {' '}סה״כ {formatCurrency(Math.abs(cmp.totalSaving))}
                </p>
                {cmp.profitIfImported != null && (
                  <p className="text-muted-foreground">
                    רווח ביבוא {formatCurrency(cmp.profitIfImported)} · רווח ברכישה בארץ {formatCurrency(cmp.profitIfLocal!)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ClosurePanel orderId={orderId} />
    </div>
  );
};
