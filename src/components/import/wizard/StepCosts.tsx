import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { COST_CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from '@/hooks/useImportOrder';
import { DocumentsCard } from './DocumentsCard';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'CNY', 'GBP'];

interface Props {
  order: any;
  costs: any[];
  payments: any[];
  landed: any[];
  costSummary: any;
  documents: any[];
  addCost: any;
  finalizeCost: any;
  addPayment: any;
  uploadDocument: any;
  openDocument: (path: string) => void;
  isReadOnly?: boolean;
  onNext: () => void;
}

const Stat: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="rounded-lg border p-3">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className={strong ? 'text-lg font-bold' : 'text-base font-semibold'}>{value}</p>
  </div>
);

/**
 * STEP 2 — "שילוח ועלויות": goods cost, import expenses (estimated → final),
 * payments and documents in one business step. Reuses the existing cost-line
 * finalization mechanism verbatim.
 */
export const StepCosts: React.FC<Props> = ({
  order, costs, payments, landed, costSummary, documents, addCost, finalizeCost, addPayment,
  uploadDocument, openDocument, isReadOnly, onNext,
}) => {
  const [costForm, setCostForm] = React.useState({
    category: 'international_freight', description: '', amount: '',
    currency_code: 'ILS', exchange_rate_to_ils: '',
  });
  const [finalDrafts, setFinalDrafts] = React.useState<Record<string, string>>({});
  const [paymentForm, setPaymentForm] = React.useState({
    payment_type: 'deposit', amount: '', currency_code: 'ILS', exchange_rate_to_ils: '',
    payment_date: new Date().toISOString().slice(0, 10), payment_status: 'paid', reference: '',
  });

  const goods = landed.reduce(
    (s, r) => s + Number(r.unit_purchase_cost_ils ?? 0) * Number(r.ordered_quantity ?? 0), 0
  );
  const expenses = Number(costSummary?.effective_total_ils ?? 0);
  const totalToShelf = goods + expenses;
  const paid = payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((s, p) => s + Number(p.amount_ils ?? 0), 0);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="עלות סחורה" value={formatCurrency(goods)} />
        <Stat label="הוצאות יבוא נוספות" value={formatCurrency(expenses)} />
        <Stat label="עלות עד המדף (סה״כ)" value={formatCurrency(totalToShelf)} strong />
        <Stat label="שולם עד כה" value={formatCurrency(paid)} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">שילוח ועלויות</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end"
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
              <Label>סוג הוצאה</Label>
              <Select value={costForm.category} onValueChange={(v) => setCostForm({ ...costForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COST_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שער המרה לש״ח</Label>
              <Input type="number" step="0.0001" min="0" value={costForm.exchange_rate_to_ils}
                onChange={(e) => setCostForm({ ...costForm, exchange_rate_to_ils: e.target.value })} />
            </div>
            <Button type="submit" className="min-h-[44px]" disabled={isReadOnly || addCost.isPending}>
              <Plus className="h-4 w-4 ml-2" />הוספת הוצאה
            </Button>
          </form>

          <div className="space-y-2">
            {costs.map((c: any) => {
              const isFinal = c.cost_state === 'final';
              return (
                <div key={c.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{COST_CATEGORY_LABELS[c.category] ?? c.category}</span>
                      <Badge variant={isFinal ? 'secondary' : 'outline'}>{isFinal ? 'סופי' : 'משוער'}</Badge>
                    </div>
                    <span className="font-semibold">{formatCurrency(Number(c.effective_amount_ils ?? 0))}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.description ? `${c.description} · ` : ''}
                    משוער {formatCurrency(Number(c.amount_ils ?? 0))}
                    {c.final_amount_ils != null && ` · סופי ${formatCurrency(Number(c.final_amount_ils))}`}
                    {c.variance_ils != null && ` · סטייה ${Number(c.variance_ils) > 0 ? '+' : ''}${formatCurrency(Number(c.variance_ils))}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" step="0.01" min="0" className="w-32 h-10"
                      placeholder={`סכום סופי (${c.currency_code})`}
                      disabled={isReadOnly}
                      value={finalDrafts[c.id] ?? (c.final_amount != null ? String(c.final_amount) : '')}
                      onChange={(e) => setFinalDrafts((p) => ({ ...p, [c.id]: e.target.value }))}
                    />
                    <Button
                      size="sm" variant="outline" className="min-h-[40px]"
                      disabled={isReadOnly || finalizeCost.isPending}
                      onClick={() => {
                        const raw = finalDrafts[c.id] ?? (c.final_amount != null ? String(c.final_amount) : '');
                        finalizeCost.mutate({
                          costId: c.id,
                          finalAmount: raw === '' ? null : Number(raw),
                          finalExchangeRate: c.exchange_rate_to_ils ?? null,
                        });
                      }}
                    >
                      שמירת סכום סופי
                    </Button>
                  </div>
                </div>
              );
            })}
            {costs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">טרם נרשמו הוצאות יבוא</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            כל הוצאה נרשמת כשורה אחת. כשמתקבלת חשבונית מזינים את הסכום הסופי באותה שורה, והוא מחליף
            את ההערכה בחישוב עלות עד המדף (הערכה וסופי לעולם לא נסכמים יחד).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">תשלומים</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end"
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
                  {Object.entries(PAYMENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
              <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
            </div>
            <Button type="submit" className="min-h-[44px]" disabled={isReadOnly || addPayment.isPending}>
              <Plus className="h-4 w-4 ml-2" />רישום תשלום
            </Button>
          </form>

          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>{PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type} · {p.payment_date}</span>
                <span className="text-muted-foreground">{p.reference ?? '—'}</span>
                <span className="font-semibold">{formatCurrency(Number(p.amount_ils ?? 0))}</span>
              </div>
            ))}
            {payments.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">טרם נרשמו תשלומים</p>}
          </div>
        </CardContent>
      </Card>

      <DocumentsCard
        documents={documents}
        uploadDocument={uploadDocument}
        openDocument={openDocument}
        isReadOnly={isReadOnly}
      />

      {onNext && (
        <div className="flex justify-start">
          <Button className="min-h-[44px]" onClick={onNext}>
            המשך לתמונת מצב
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
        </div>
      )}
    </div>
  );
};
