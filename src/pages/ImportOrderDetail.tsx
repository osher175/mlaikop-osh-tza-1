import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Loader2, Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ImportPinGate } from '@/components/import/ImportPinGate';
import { useImportOrder, COST_CATEGORY_LABELS, PAYMENT_TYPE_LABELS, DOCUMENT_TYPE_LABELS, EVENT_TYPE_LABELS } from '@/hooks/useImportOrder';
import { IMPORT_STATUSES, IMPORT_STATUS_LABELS, PURCHASE_TYPE_LABELS } from '@/hooks/useImportOrders';
import { formatCurrency } from '@/lib/formatCurrency';

const SummaryCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Card>
    <CardContent className="pt-5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </CardContent>
  </Card>
);

const ImportOrderDetailContent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    order, items, costs, payments, documents, events, landedCost, costSummary,
    updateStatus, addItem, addCost, finalizeCost, addPayment, uploadDocument, openDocument,
  } = useImportOrder(id);

  const [itemForm, setItemForm] = useState({
    product_description: '', manufacturer_name: '', supplier_sku: '',
    ordered_quantity: '1', supplier_unit_cost: '', planned_sale_price_ils: '',
  });
  const [costForm, setCostForm] = useState({
    category: 'international_freight', description: '', amount: '',
    currency_code: 'ILS', exchange_rate_to_ils: '',
  });
  // Per-cost-line draft of the final amount (keyed by cost id).
  const [finalDrafts, setFinalDrafts] = useState<Record<string, string>>({});
  const [paymentForm, setPaymentForm] = useState({
    payment_type: 'deposit', amount: '', currency_code: 'ILS',
    exchange_rate_to_ils: '', payment_date: new Date().toISOString().slice(0, 10),
    payment_status: 'paid', reference: '',
  });
  const [docType, setDocType] = useState('commercial_invoice');

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
    );
  }
  if (!order.data) {
    return <div className="text-center py-20 text-muted-foreground">הזמנת היבוא לא נמצאה</div>;
  }

  const o = order.data as any;
  const landed = (landedCost.data as any[]) ?? [];
  const summary = costSummary.data as any;
  const totals = landed.reduce(
    (acc, r) => {
      const qty = Number(r.ordered_quantity ?? 0);
      return {
        goods: acc.goods + Number(r.unit_purchase_cost_ils ?? 0) * qty,
        overhead: acc.overhead + Number(r.overhead_per_unit_ils ?? 0) * qty,
        landedTotal: acc.landedTotal + Number(r.expected_landed_unit_cost_ils ?? 0) * qty,
        revenue: acc.revenue + Number(r.planned_sale_price_ils ?? 0) * qty,
      };
    },
    { goods: 0, overhead: 0, landedTotal: 0, revenue: 0 }
  );
  const plannedMargin = totals.revenue - totals.landedTotal;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/import')}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {o.import_number}
              <Badge variant={o.status === 'completed' ? 'secondary' : 'default'}>
                {IMPORT_STATUS_LABELS[o.status as keyof typeof IMPORT_STATUS_LABELS] ?? o.status}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              {o.suppliers?.name ?? 'ללא ספק'} · {PURCHASE_TYPE_LABELS[o.purchase_type] ?? o.purchase_type} · {o.currency_code}
            </p>
          </div>
        </div>
        <Select value={o.status} onValueChange={(v) => updateStatus.mutate(v)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {IMPORT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{IMPORT_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="עלות סחורה" value={formatCurrency(totals.goods)} />
        <SummaryCard label="עלויות יבוא" value={formatCurrency(totals.overhead)} />
        <SummaryCard label="עלות נחיתה כוללת" value={formatCurrency(totals.landedTotal)} />
        <SummaryCard label="רווח מתוכנן" value={formatCurrency(plannedMargin)} />
      </div>

      <Tabs defaultValue="items">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="items">פריטים</TabsTrigger>
          <TabsTrigger value="receiving">קליטת סחורה</TabsTrigger>
          <TabsTrigger value="costs">עלויות</TabsTrigger>
          <TabsTrigger value="payments">תשלומים</TabsTrigger>
          <TabsTrigger value="landed">עלות נחיתה</TabsTrigger>
          <TabsTrigger value="documents">מסמכים</TabsTrigger>
          <TabsTrigger value="events">היסטוריה</TabsTrigger>
        </TabsList>

        {/* Receiving — the only place in the module that can move real stock */}
        <TabsContent value="receiving">
          <ReceivingPanel
            orderId={id!}
            businessId={o.business_id}
            items={(items.data as any[]) ?? []}
            isReadOnly={o.status === 'cancelled'}
          />
        </TabsContent>


        {/* Items */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">הוספת פריט</CardTitle></CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem.mutate({
                    product_description: itemForm.product_description,
                    manufacturer_name: itemForm.manufacturer_name || null,
                    supplier_sku: itemForm.supplier_sku || null,
                    ordered_quantity: Number(itemForm.ordered_quantity),
                    supplier_unit_cost: Number(itemForm.supplier_unit_cost),
                    currency_code: o.currency_code,
                    planned_sale_price_ils: itemForm.planned_sale_price_ils ? Number(itemForm.planned_sale_price_ils) : null,
                  });
                  setItemForm({ product_description: '', manufacturer_name: '', supplier_sku: '', ordered_quantity: '1', supplier_unit_cost: '', planned_sale_price_ils: '' });
                }}
              >
                <div className="space-y-2 md:col-span-2">
                  <Label>תיאור מוצר</Label>
                  <Input required value={itemForm.product_description}
                    onChange={(e) => setItemForm({ ...itemForm, product_description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>יצרן / מותג</Label>
                  <Input value={itemForm.manufacturer_name}
                    onChange={(e) => setItemForm({ ...itemForm, manufacturer_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>מק״ט ספק</Label>
                  <Input value={itemForm.supplier_sku}
                    onChange={(e) => setItemForm({ ...itemForm, supplier_sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>כמות</Label>
                  <Input type="number" min="1" required value={itemForm.ordered_quantity}
                    onChange={(e) => setItemForm({ ...itemForm, ordered_quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>עלות ליחידה ({o.currency_code})</Label>
                  <Input type="number" step="0.01" min="0" required value={itemForm.supplier_unit_cost}
                    onChange={(e) => setItemForm({ ...itemForm, supplier_unit_cost: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>מחיר מכירה מתוכנן (₪)</Label>
                  <Input type="number" step="0.01" min="0" value={itemForm.planned_sale_price_ils}
                    onChange={(e) => setItemForm({ ...itemForm, planned_sale_price_ils: e.target.value })} />
                </div>
                <Button type="submit" disabled={addItem.isPending}>
                  <Plus className="w-4 h-4 ml-2" />הוספה
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תיאור</TableHead>
                    <TableHead className="text-right">יצרן</TableHead>
                    <TableHead className="text-right">מק״ט</TableHead>
                    <TableHead className="text-right">הוזמן</TableHead>
                    <TableHead className="text-right">נקלט</TableHead>
                    <TableHead className="text-right">עלות ליחידה</TableHead>
                    <TableHead className="text-right">מחיר מכירה מתוכנן</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items.data ?? []).map((it: any) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.product_description}</TableCell>
                      <TableCell>{it.brands?.name ?? it.manufacturer_name ?? '—'}</TableCell>
                      <TableCell>{it.supplier_sku ?? '—'}</TableCell>
                      <TableCell>{it.ordered_quantity}</TableCell>
                      <TableCell>{it.received_quantity}</TableCell>
                      <TableCell>{Number(it.supplier_unit_cost).toFixed(2)} {it.currency_code}</TableCell>
                      <TableCell>{it.planned_sale_price_ils ? formatCurrency(Number(it.planned_sale_price_ils)) : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(items.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">אין פריטים</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs */}
        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">הוספת שורת עלות (סכום משוער)</CardTitle></CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCost.mutate({
                    category: costForm.category,
                    description: costForm.description || null,
                    amount: Number(costForm.amount),
                    currency_code: costForm.currency_code,
                    exchange_rate_to_ils: costForm.exchange_rate_to_ils ? Number(costForm.exchange_rate_to_ils) : null,
                  });
                  setCostForm({ ...costForm, description: '', amount: '' });
                }}
              >
                <div className="space-y-2">
                  <Label>קטגוריה</Label>
                  <Select value={costForm.category} onValueChange={(v) => setCostForm({ ...costForm, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(COST_CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>תיאור</Label>
                  <Input value={costForm.description} onChange={(e) => setCostForm({ ...costForm, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>סכום משוער</Label>
                  <Input type="number" step="0.01" min="0" required value={costForm.amount}
                    onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>מטבע</Label>
                  <Select value={costForm.currency_code} onValueChange={(v) => setCostForm({ ...costForm, currency_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['ILS', 'USD', 'EUR', 'CNY', 'GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שער המרה לש״ח</Label>
                  <Input type="number" step="0.0001" min="0" value={costForm.exchange_rate_to_ils}
                    onChange={(e) => setCostForm({ ...costForm, exchange_rate_to_ils: e.target.value })} />
                </div>
                <Button type="submit" disabled={addCost.isPending}>
                  <Plus className="w-4 h-4 ml-2" />הוספה
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3">
                כל הוצאה נרשמת כשורה אחת. כשמתקבלת חשבונית — מזינים את הסכום הסופי באותה שורה,
                והוא מחליף את ההערכה בחישוב עלות הנחיתה (הערכה וסופי לעולם לא נסכמים יחד).
              </p>
            </CardContent>
          </Card>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="סה״כ משוער" value={formatCurrency(Number(summary.estimated_total_ils ?? 0))} />
              <SummaryCard label="סה״כ סופי (שורות שנסגרו)" value={formatCurrency(Number(summary.final_total_ils ?? 0))} />
              <SummaryCard label="עלות אפקטיבית לחישוב" value={formatCurrency(Number(summary.effective_total_ils ?? 0))} />
              <SummaryCard
                label="סטייה מההערכה"
                value={`${formatCurrency(Number(summary.variance_ils ?? 0))}${
                  summary.variance_percent != null ? ` (${Number(summary.variance_percent).toFixed(2)}%)` : ''
                }`}
              />
            </div>
          )}

          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">תיאור</TableHead>
                    <TableHead className="text-right">משוער (ש״ח)</TableHead>
                    <TableHead className="text-right">סופי (ש״ח)</TableHead>
                    <TableHead className="text-right">סטייה</TableHead>
                    <TableHead className="text-right">אפקטיבי</TableHead>
                    <TableHead className="text-right">סכום סופי</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(costs.data ?? []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {COST_CATEGORY_LABELS[c.category] ?? c.category}
                          <Badge variant={c.cost_state === 'final' ? 'secondary' : 'outline'}>
                            {c.cost_state === 'final' ? 'סופי' : 'משוער'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{c.description ?? '—'}</TableCell>
                      <TableCell>
                        {formatCurrency(Number(c.amount_ils ?? 0))}
                        <span className="text-xs text-muted-foreground block">
                          {Number(c.amount).toFixed(2)} {c.currency_code}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.final_amount_ils != null ? formatCurrency(Number(c.final_amount_ils)) : '—'}
                      </TableCell>
                      <TableCell>
                        {c.variance_ils != null ? (
                          <span className={Number(c.variance_ils) > 0 ? 'text-destructive' : 'text-emerald-600'}>
                            {Number(c.variance_ils) > 0 ? '+' : ''}{formatCurrency(Number(c.variance_ils))}
                            {c.variance_percent != null && ` (${Number(c.variance_percent) > 0 ? '+' : ''}${Number(c.variance_percent).toFixed(2)}%)`}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(c.effective_amount_ils ?? 0))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28"
                            placeholder={`${c.currency_code}`}
                            value={finalDrafts[c.id] ?? (c.final_amount != null ? String(c.final_amount) : '')}
                            onChange={(e) => setFinalDrafts({ ...finalDrafts, [c.id]: e.target.value })}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={finalizeCost.isPending}
                            onClick={() => {
                              const raw = finalDrafts[c.id] ?? (c.final_amount != null ? String(c.final_amount) : '');
                              finalizeCost.mutate({
                                costId: c.id,
                                finalAmount: raw === '' ? null : Number(raw),
                                finalExchangeRate: c.exchange_rate_to_ils ?? null,
                              });
                            }}
                          >
                            שמירה
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(costs.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">אין עלויות</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Payments */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">רישום תשלום</CardTitle></CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPayment.mutate({
                    payment_type: paymentForm.payment_type,
                    amount: Number(paymentForm.amount),
                    currency_code: paymentForm.currency_code,
                    exchange_rate_to_ils: paymentForm.exchange_rate_to_ils ? Number(paymentForm.exchange_rate_to_ils) : null,
                    payment_date: paymentForm.payment_date,
                    payment_status: paymentForm.payment_status,
                    reference: paymentForm.reference || null,
                  });
                  setPaymentForm({ ...paymentForm, amount: '', reference: '' });
                }}
              >
                <div className="space-y-2">
                  <Label>סוג תשלום</Label>
                  <Select value={paymentForm.payment_type} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סכום</Label>
                  <Input type="number" step="0.01" min="0" required value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>מטבע</Label>
                  <Select value={paymentForm.currency_code} onValueChange={(v) => setPaymentForm({ ...paymentForm, currency_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['ILS', 'USD', 'EUR', 'CNY', 'GBP'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>שער המרה לש״ח</Label>
                  <Input type="number" step="0.0001" min="0" value={paymentForm.exchange_rate_to_ils}
                    onChange={(e) => setPaymentForm({ ...paymentForm, exchange_rate_to_ils: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>תאריך תשלום</Label>
                  <Input type="date" required value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>אסמכתא</Label>
                  <Input value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
                </div>
                <Button type="submit" disabled={addPayment.isPending}>
                  <Plus className="w-4 h-4 ml-2" />רישום
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">סכום</TableHead>
                    <TableHead className="text-right">סכום בש״ח</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">אסמכתא</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments.data ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type}</TableCell>
                      <TableCell>{p.payment_date}</TableCell>
                      <TableCell>{Number(p.amount).toFixed(2)} {p.currency_code}</TableCell>
                      <TableCell>{formatCurrency(Number(p.amount_ils ?? 0))}</TableCell>
                      <TableCell>{p.payment_status}</TableCell>
                      <TableCell>{p.reference ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(payments.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">אין תשלומים</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Landed cost */}
        <TabsContent value="landed">
          <Card>
            <CardHeader><CardTitle className="text-base">עלות נחיתה ורווחיות מתוכננת</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">פריט</TableHead>
                    <TableHead className="text-right">כמות</TableHead>
                    <TableHead className="text-right">עלות סחורה ליחידה</TableHead>
                    <TableHead className="text-right">עלויות יבוא ליחידה</TableHead>
                    <TableHead className="text-right">עלות נחיתה ליחידה</TableHead>
                    <TableHead className="text-right">מחיר מכירה</TableHead>
                    <TableHead className="text-right">רווח ליחידה</TableHead>
                    <TableHead className="text-right">% רווח</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {landed.map((r: any) => (
                    <TableRow key={r.item_id}>
                      <TableCell>{r.product_description}</TableCell>
                      <TableCell>{r.ordered_quantity}</TableCell>
                      <TableCell>{formatCurrency(Number(r.unit_purchase_cost_ils ?? 0))}</TableCell>
                      <TableCell>{r.overhead_per_unit_ils != null ? formatCurrency(Number(r.overhead_per_unit_ils)) : '—'}</TableCell>
                      <TableCell>{r.expected_landed_unit_cost_ils != null ? formatCurrency(Number(r.expected_landed_unit_cost_ils)) : '—'}</TableCell>
                      <TableCell>{r.planned_sale_price_ils ? formatCurrency(Number(r.planned_sale_price_ils)) : '—'}</TableCell>
                      <TableCell>{r.expected_gross_profit_per_unit_ils != null ? formatCurrency(Number(r.expected_gross_profit_per_unit_ils)) : '—'}</TableCell>
                      <TableCell>{r.expected_gross_margin_percent != null ? `${Number(r.expected_gross_margin_percent).toFixed(1)}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {landed.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">אין נתונים לחישוב</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">העלאת מסמך</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-2 min-w-[200px]">
                <Label>סוג מסמך</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>קובץ</Label>
                <Input
                  type="file"
                  disabled={uploadDocument.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadDocument.mutate({ file, documentType: docType });
                    e.target.value = '';
                  }}
                />
              </div>
              {uploadDocument.isPending && <Loader2 className="w-4 h-4 animate-spin mb-3" />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">שם קובץ</TableHead>
                    <TableHead className="text-right">הועלה</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(documents.data ?? []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</TableCell>
                      <TableCell>{d.original_filename}</TableCell>
                      <TableCell>{new Date(d.created_at).toLocaleDateString('he-IL')}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openDocument(d.storage_path)}>
                          <Upload className="w-3.5 h-3.5 ml-1 rotate-180" />פתיחה
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(documents.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">אין מסמכים</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events */}
        <TabsContent value="events">
          <Card>
            <CardHeader><CardTitle className="text-base">היסטוריית פעולות</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(events.data ?? []).map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                  <Badge variant="outline">{EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString('he-IL')}
                  </span>
                </div>
              ))}
              {(events.data ?? []).length === 0 && (
                <p className="text-center text-muted-foreground py-8">אין פעולות מתועדות</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const ImportOrderDetail: React.FC = () => (
  <ImportPinGate>
    <ImportOrderDetailContent />
  </ImportPinGate>
);

export default ImportOrderDetail;
