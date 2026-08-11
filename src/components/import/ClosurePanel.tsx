import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle2, Loader2, Lock, XCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { useImportClosure, MIN_GROSS_MARGIN_PERCENT, type ClosureItem } from '@/hooks/useImportClosure';
import { useImportPin } from '@/hooks/useImportPin';

interface ClosurePanelProps {
  orderId: string;
}

const CheckRow: React.FC<{ ok: boolean; label: string; detail?: string }> = ({ ok, label, detail }) => (
  <div className="flex items-start gap-2 py-1.5">
    {ok ? (
      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
    )}
    <div className="text-sm">
      <span>{label}</span>
      {detail && <span className="text-muted-foreground"> — {detail}</span>}
    </div>
  </div>
);

/**
 * Phase 3 closure screen.
 *
 * Cost-only: nothing here changes stock quantities. Sale prices are updated
 * only for lines the user explicitly ticks.
 */
export const ClosurePanel: React.FC<ClosurePanelProps> = ({ orderId }) => {
  const { readiness, adjustments, summary, closeOrder } = useImportClosure(orderId);
  const { getToken } = useImportPin();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [priceItems, setPriceItems] = React.useState<Record<string, boolean>>({});

  const r = readiness.data;
  const posted = ((adjustments.data as any[]) ?? []);
  const s = summary.data as any;

  if (readiness.isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!r) return null;

  const items = r.items ?? [];
  const lowMargin = items.filter(
    (i) => i.gross_margin_percent != null && i.gross_margin_percent < MIN_GROSS_MARGIN_PERCENT
  );

  const priceUpdates = items
    .filter((i) => priceItems[i.item_id] && i.planned_sale_price_ils != null)
    .map((i) => ({ item_id: i.item_id, price: Number(i.planned_sale_price_ils) }));

  const totalVariance = items.reduce((a, i) => a + Number(i.total_variance_ils ?? 0), 0);
  const applied = items.reduce(
    (a, i) => a + Number(i.unit_variance_ils ?? 0) * Math.min(i.received_quantity, Math.max(i.quantity_on_hand, 0)),
    0
  );
  const unabsorbed = totalVariance - applied;

  return (
    <div className="space-y-4">
      {/* -------------------------- readiness checklist ------------------------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">מוכנות לסגירת היבוא</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckRow ok={r.has_confirmed_receipt} label="קיימת לפחות קליטה אחת מאושרת" />
          <CheckRow
            ok={r.open_quantity === 0}
            label="כל הכמויות נקלטו או נסגרו כחוסר"
            detail={r.open_quantity > 0 ? `נותרו ${r.open_quantity} יחידות פתוחות` : undefined}
          />
          <CheckRow
            ok={r.unlinked_received_items === 0}
            label="כל הפריטים שנקלטו מקושרים למוצר"
            detail={r.unlinked_received_items > 0 ? `${r.unlinked_received_items} פריטים ללא קישור` : undefined}
          />
          <CheckRow
            ok={r.open_draft_receipts === 0}
            label="אין טיוטות קליטה פתוחות"
            detail={r.open_draft_receipts > 0 ? `${r.open_draft_receipts} טיוטות` : undefined}
          />
          <CheckRow
            ok={r.unfinalized_cost_lines === 0}
            label="כל שורות העלות סופיות"
            detail={
              r.unfinalized_cost_lines > 0
                ? `${r.unfinalized_cost_lines} שורות עדיין באומדן — הסגירה תשתמש באומדן`
                : undefined
            }
          />
          <CheckRow ok={!r.already_posted} label="עלות סופית טרם נרשמה להזמנה זו" />

          {r.unfinalized_cost_lines > 0 && !r.already_posted && (
            <Alert className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                שורות עלות שאינן סופיות ייכללו לפי האומדן שלהן. לאחר הסגירה לא ניתן לרשום עלות סופית
                נוספת להזמנה זו.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* --------------------------- cost calculation --------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground mb-1">סה״כ עלויות יבוא</p>
          <p className="text-lg font-semibold">{formatCurrency(Number(r.total_overhead_ils ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground mb-1">יחידות שנקלטו</p>
          <p className="text-lg font-semibold">{r.applicable_received_units}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground mb-1">תקורה ליחידה</p>
          <p className="text-lg font-semibold">{formatCurrency(Number(r.overhead_per_unit_ils ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-xs text-muted-foreground mb-1">סטייה כוללת</p>
          <p className="text-lg font-semibold">{formatCurrency(totalVariance)}</p>
        </CardContent></Card>
      </div>

      {lowMargin.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {lowMargin.length} פריטים עם רווח גולמי נמוך מ-{MIN_GROSS_MARGIN_PERCENT}% לאחר עלות
            הנחיתה הסופית.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">עלות נחיתה סופית לפי פריט</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פריט</TableHead>
                <TableHead className="text-right">נקלט</TableHead>
                <TableHead className="text-right">עלות זמנית</TableHead>
                <TableHead className="text-right">עלות סופית</TableHead>
                <TableHead className="text-right">סטייה ליחידה</TableHead>
                <TableHead className="text-right">במלאי כעת</TableHead>
                <TableHead className="text-right">רווח/מרווח</TableHead>
                <TableHead className="text-right">עדכון מחיר מכירה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i: ClosureItem) => (
                <TableRow key={i.item_id}>
                  <TableCell className="max-w-[180px] truncate">{i.description ?? '—'}</TableCell>
                  <TableCell>{i.received_quantity}</TableCell>
                  <TableCell>{formatCurrency(Number(i.provisional_unit_cost_ils ?? 0))}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(i.final_unit_cost_ils ?? 0))}
                  </TableCell>
                  <TableCell>{formatCurrency(Number(i.unit_variance_ils ?? 0))}</TableCell>
                  <TableCell>{i.quantity_on_hand}</TableCell>
                  <TableCell>
                    {i.gross_margin_percent == null ? '—' : (
                      <span className="flex items-center gap-1">
                        {formatCurrency(Number(i.gross_profit_per_unit_ils ?? 0))}
                        <Badge
                          variant={i.gross_margin_percent < MIN_GROSS_MARGIN_PERCENT ? 'destructive' : 'secondary'}
                        >
                          {Number(i.gross_margin_percent).toFixed(1)}%
                        </Badge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.planned_sale_price_ils == null || r.already_closed ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!priceItems[i.item_id]}
                          onCheckedChange={(v) =>
                            setPriceItems((p) => ({ ...p, [i.item_id]: !!v }))
                          }
                        />
                        עדכן ל-{formatCurrency(Number(i.planned_sale_price_ils))}
                      </label>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    אין פריטים שנקלטו
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground mt-3">
            הסטייה מוטמעת רק ביחידות שנמצאות במלאי כרגע (ממוצע משוקלל). סטייה על יחידות שכבר נמכרו
            נרשמת ביומן ההתאמות כ״לא נספגה״ — רישומי המכירה ההיסטוריים אינם משתנים. סגירה אינה משנה
            כמויות מלאי.
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------- close CTA ------------------------------ */}
      {!r.already_closed && !r.already_posted && (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] text-sm">
              <div>הטמעה במלאי: <strong>{formatCurrency(applied)}</strong></div>
              <div className="text-muted-foreground">
                לא נספג (יחידות שנמכרו): {formatCurrency(unabsorbed)}
              </div>
            </div>
            <Button
              className="min-h-[44px]"
              disabled={!r.can_close || closeOrder.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Lock className="h-4 w-4 ml-2" />
              סגור יבוא ורשום עלות סופית
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------- posted ledger ---------------------------- */}
      {posted.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">יומן התאמות עלות (בלתי ניתן לשינוי)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">כמות שנקלטה</TableHead>
                  <TableHead className="text-right">עלות זמנית</TableHead>
                  <TableHead className="text-right">עלות סופית</TableHead>
                  <TableHead className="text-right">סטייה ליחידה</TableHead>
                  <TableHead className="text-right">הוטמע</TableHead>
                  <TableHead className="text-right">לא נספג</TableHead>
                  <TableHead className="text-right">עלות מוצר לפני/אחרי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posted.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.received_quantity}</TableCell>
                    <TableCell>{formatCurrency(Number(a.provisional_unit_cost_ils))}</TableCell>
                    <TableCell>{formatCurrency(Number(a.final_unit_cost_ils))}</TableCell>
                    <TableCell>{formatCurrency(Number(a.unit_variance_ils))}</TableCell>
                    <TableCell>{formatCurrency(Number(a.applied_amount_ils))}</TableCell>
                    <TableCell>{formatCurrency(Number(a.unabsorbed_amount_ils))}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(Number(a.product_cost_before_ils))} →{' '}
                      {formatCurrency(Number(a.product_cost_after_ils))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------- summary -------------------------------- */}
      {s && r.already_closed && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">סיכום יבוא</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">ספק</p>{s.supplier_name ?? '—'}</div>
            <div><p className="text-muted-foreground text-xs">יחידות שהוזמנו</p>{s.ordered_units}</div>
            <div><p className="text-muted-foreground text-xs">יחידות שנקלטו</p>{s.received_units}</div>
            <div><p className="text-muted-foreground text-xs">חוסר שנסגר</p>{s.not_arriving_units}</div>
            <div><p className="text-muted-foreground text-xs">עלות סחורה</p>{formatCurrency(Number(s.goods_cost_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">עלויות נוספות</p>{formatCurrency(Number(s.additional_costs_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">תקורה ליחידה</p>{formatCurrency(Number(s.overhead_per_unit_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">שווי מכירה מתוכנן</p>{formatCurrency(Number(s.planned_sales_value_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">שולם</p>{formatCurrency(Number(s.payments_paid_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">יתרה לתשלום</p>{formatCurrency(Number(s.payments_outstanding_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">הוטמע במלאי</p>{formatCurrency(Number(s.adjustment_applied_ils ?? 0))}</div>
            <div><p className="text-muted-foreground text-xs">תאריך סגירה</p>
              {s.closed_at ? new Date(s.closed_at).toLocaleDateString('he-IL') : '—'}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>סגירת יבוא ורישום עלות סופית</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה חד-פעמית: עלות המוצרים תעודכן בהתאם לעלות הנחיתה הסופית, ההזמנה תינעל לעריכה
              פיננסית ולא ניתן יהיה לרשום עלות סופית נוספת. כמויות המלאי לא ישתנו ומכירות היסטוריות
              לא ישוכתבו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="text-sm space-y-1">
            <div>שורות להתאמה: <strong>{items.length}</strong></div>
            <div>הטמעה במלאי: <strong>{formatCurrency(applied)}</strong></div>
            <div>לא נספג: <strong>{formatCurrency(unabsorbed)}</strong></div>
            <div>עדכוני מחיר מכירה: <strong>{priceUpdates.length}</strong></div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                closeOrder.mutate(
                  { pinToken: getToken(), priceUpdates },
                  { onSuccess: () => setConfirmOpen(false) }
                )
              }
            >
              אשר סגירה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
