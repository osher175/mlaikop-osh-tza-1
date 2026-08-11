import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Link2, Package, Plus, Save, Trash2 } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { formatCurrency } from '@/lib/formatCurrency';
import { LinkProductDialog } from '../LinkProductDialog';
import { composeDescription, itemBrand, itemModel, itemSize, itemTitle } from './importItemUtils';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'CNY', 'GBP', 'JPY', 'TRY'];

interface Props {
  order: any;
  items: any[];
  updateOrder: any;
  addItem: any;
  updateItem: any;
  deleteItem: any;
  linkProduct: any;
  isReadOnly?: boolean;
  onNext: () => void;
}

const emptyItem = {
  brand: '',
  model: '',
  size: '',
  quantity: '1',
  unitCost: '',
  plannedSale: '',
  localAlternative: '',
};

/** STEP 1 — order header + "מה הזמנתי?" lines. Nothing here touches stock. */
export const StepOrderDetails: React.FC<Props> = ({
  order, items, updateOrder, addItem, updateItem, deleteItem, linkProduct, isReadOnly, onNext,
}) => {
  const { suppliers = [] } = useSuppliers() as any;
  const [header, setHeader] = React.useState({
    supplier_id: order.supplier_id ?? '__none__',
    purchase_type: order.purchase_type ?? 'direct_import',
    supplier_country: order.supplier_country ?? '',
    currency_code: order.currency_code ?? 'USD',
    working_exchange_rate_to_ils: order.working_exchange_rate_to_ils != null ? String(order.working_exchange_rate_to_ils) : '',
    order_date: order.order_date ?? '',
    estimated_arrival_date: order.estimated_arrival_date ?? '',
    supplier_order_reference: order.supplier_order_reference ?? '',
    notes: order.notes ?? '',
  });
  const [form, setForm] = React.useState(emptyItem);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [linkItem, setLinkItem] = React.useState<any | null>(null);

  const rate = Number(header.working_exchange_rate_to_ils) || Number(order.working_exchange_rate_to_ils) || 0;
  const lines = items.length;
  const units = items.reduce((s, i) => s + Number(i.ordered_quantity ?? 0), 0);
  const foreignValue = items.reduce(
    (s, i) => s + Number(i.ordered_quantity ?? 0) * Number(i.supplier_unit_cost ?? 0), 0
  );
  const ilsValue = items.reduce(
    (s, i) => s + Number(i.ordered_quantity ?? 0) *
      (i.expected_unit_cost_ils != null ? Number(i.expected_unit_cost_ils) : Number(i.supplier_unit_cost ?? 0) * rate),
    0
  );

  const saveHeader = () =>
    updateOrder.mutate({
      supplier_id: header.supplier_id === '__none__' ? null : header.supplier_id,
      purchase_type: header.purchase_type,
      supplier_country: header.supplier_country || null,
      currency_code: header.currency_code,
      working_exchange_rate_to_ils: header.working_exchange_rate_to_ils ? Number(header.working_exchange_rate_to_ils) : null,
      order_date: header.order_date,
      estimated_arrival_date: header.estimated_arrival_date || null,
      supplier_order_reference: header.supplier_order_reference || null,
      notes: header.notes || null,
    });

  const itemPayload = () => ({
    manufacturer_name: form.brand.trim() || null,
    model_name: form.model.trim() || null,
    size_label: form.size.trim() || null,
    product_description: composeDescription(form.brand, form.model, form.size),
    ordered_quantity: Math.max(1, Math.trunc(Number(form.quantity) || 1)),
    supplier_unit_cost: Number(form.unitCost) || 0,
    currency_code: header.currency_code,
    planned_sale_price_ils: form.plannedSale ? Number(form.plannedSale) : null,
    local_alternative_unit_cost_ils: form.localAlternative ? Number(form.localAlternative) : null,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateItem.mutate({ itemId: editing, payload: itemPayload() }, { onSuccess: () => { setEditing(null); setForm(emptyItem); } });
    } else {
      addItem.mutate(itemPayload(), { onSuccess: () => setForm(emptyItem) });
    }
  };

  const startEdit = (it: any) => {
    setEditing(it.id);
    setForm({
      brand: itemBrand(it),
      model: itemModel(it),
      size: itemSize(it),
      quantity: String(it.ordered_quantity ?? 1),
      unitCost: it.supplier_unit_cost != null ? String(it.supplier_unit_cost) : '',
      plannedSale: it.planned_sale_price_ils != null ? String(it.planned_sale_price_ils) : '',
      localAlternative: it.local_alternative_unit_cost_ils != null ? String(it.local_alternative_unit_cost_ils) : '',
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">פרטי ההזמנה</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>ספק / סוחר בחו״ל</Label>
              <Select value={header.supplier_id} onValueChange={(v) => setHeader({ ...header, supplier_id: v })} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא ספק</SelectItem>
                  {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סוג רכישה</Label>
              <Select value={header.purchase_type} onValueChange={(v) => setHeader({ ...header, purchase_type: v })} disabled={isReadOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_import">יבוא ישיר</SelectItem>
                  <SelectItem value="parallel_import">יבוא מקביל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>מדינת ספק</Label>
              <Input value={header.supplier_country} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, supplier_country: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>מטבע</Label>
              <Select value={header.currency_code} onValueChange={(v) => setHeader({ ...header, currency_code: v })} disabled={isReadOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שער עבודה לש״ח</Label>
              <Input type="number" step="0.0001" min="0" value={header.working_exchange_rate_to_ils} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, working_exchange_rate_to_ils: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>תאריך הזמנה</Label>
              <Input type="date" value={header.order_date} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, order_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>תאריך הגעה משוער</Label>
              <Input type="date" value={header.estimated_arrival_date} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, estimated_arrival_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>אסמכתא אצל הספק</Label>
              <Input value={header.supplier_order_reference} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, supplier_order_reference: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label>הערות</Label>
              <Textarea rows={2} value={header.notes} disabled={isReadOnly}
                onChange={(e) => setHeader({ ...header, notes: e.target.value })} />
            </div>
          </div>
          <Button variant="outline" className="min-h-[44px]" disabled={isReadOnly || updateOrder.isPending} onClick={saveHeader}>
            <Save className="h-4 w-4 ml-2" />שמירת פרטי ההזמנה
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">מה הזמנתי?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end" onSubmit={submit}>
            <div className="space-y-2">
              <Label>מותג</Label>
              <Input value={form.brand} disabled={isReadOnly} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>דגם</Label>
              <Input required value={form.model} disabled={isReadOnly} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>מידה</Label>
              <Input value={form.size} disabled={isReadOnly} placeholder="195/65R15 91V"
                onChange={(e) => setForm({ ...form, size: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>כמות</Label>
              <Input type="number" min="1" required value={form.quantity} disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>עלות ראשונית מהספק ({header.currency_code})</Label>
              <Input type="number" step="0.01" min="0" required value={form.unitCost} disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>מחיר מכירה מתוכנן (₪)</Label>
              <Input type="number" step="0.01" min="0" value={form.plannedSale} disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, plannedSale: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>מחיר רכישה חלופי בישראל (₪, אופציונלי)</Label>
              <Input type="number" step="0.01" min="0" value={form.localAlternative} disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, localAlternative: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px]" disabled={isReadOnly || addItem.isPending || updateItem.isPending}>
                <Plus className="h-4 w-4 ml-2" />{editing ? 'שמירת שינוי' : 'הוספה'}
              </Button>
              {editing && (
                <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(emptyItem); }}>ביטול</Button>
              )}
            </div>
          </form>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Summary label="שורות מוצר" value={String(lines)} />
            <Summary label="סה״כ יחידות" value={String(units)} />
            <Summary label="ערך סחורה במטבע זר" value={`${foreignValue.toFixed(2)} ${header.currency_code}`} />
            <Summary label="ערך סחורה משוער בש״ח" value={formatCurrency(ilsValue)} />
          </div>

          <div className="space-y-2">
            {items.map((it) => {
              const received = Number(it.received_quantity ?? 0);
              return (
                <div key={it.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{itemTitle(it)}</p>
                      <p className="text-xs text-muted-foreground">
                        כמות {it.ordered_quantity} · עלות {Number(it.supplier_unit_cost).toFixed(2)} {it.currency_code}
                        {it.planned_sale_price_ils != null && ` · מכירה ${formatCurrency(Number(it.planned_sale_price_ils))}`}
                        {it.local_alternative_unit_cost_ils != null && ` · חלופה בישראל ${formatCurrency(Number(it.local_alternative_unit_cost_ils))}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {it.product_id ? (
                        <Badge variant="secondary"><Package className="h-3 w-3 ml-1" />מקושר למוצר קיים</Badge>
                      ) : (
                        <Button size="sm" variant="outline" disabled={isReadOnly} onClick={() => setLinkItem(it)}>
                          <Link2 className="h-4 w-4 ml-1" />קשר למוצר קיים
                        </Button>
                      )}
                    </div>
                  </div>
                  {!it.product_id && (
                    <p className="text-xs text-amber-600">מוצר חדש — יש לקשר למוצר קיים לפני אישור הקליטה.</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" disabled={isReadOnly} onClick={() => startEdit(it)}>עריכה</Button>
                    <Button
                      size="sm" variant="ghost" className="text-destructive"
                      disabled={isReadOnly || received > 0 || deleteItem.isPending}
                      onClick={() => deleteItem.mutate(it.id)}
                    >
                      <Trash2 className="h-4 w-4 ml-1" />הסרה
                    </Button>
                    {received > 0 && <span className="text-xs text-muted-foreground self-center">נקלטו {received} — לא ניתן להסיר</span>}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">טרם נוספו פריטים להזמנה</p>}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-start">
        <Button className="min-h-[44px]" onClick={() => { if (!isReadOnly) saveHeader(); onNext(); }}>
          שמור והמשך לשילוח ועלויות
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>

      <LinkProductDialog
        open={!!linkItem}
        onOpenChange={(o) => !o && setLinkItem(null)}
        businessId={order.business_id}
        suggestedName={linkItem ? itemModel(linkItem) : ''}
        isLinking={linkProduct.isPending}
        onSelect={(productId) =>
          linkProduct.mutate({ itemId: linkItem.id, productId }, { onSuccess: () => setLinkItem(null) })
        }
      />
    </div>
  );
};

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className="text-base font-semibold">{value}</p>
  </div>
);
