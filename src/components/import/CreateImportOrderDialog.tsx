import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCreateImportOrder } from '@/hooks/useImportOrders';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCIES = ['ILS', 'USD', 'EUR', 'CNY', 'GBP', 'JPY', 'TRY'];

export const CreateImportOrderDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const { suppliers = [] } = useSuppliers() as any;
  const createOrder = useCreateImportOrder();

  const [supplierId, setSupplierId] = useState('__none__');
  const [purchaseType, setPurchaseType] = useState<'direct_import' | 'parallel_import'>('direct_import');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eta, setEta] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createOrder.mutateAsync({
      supplier_id: supplierId === '__none__' ? null : supplierId,
      purchase_type: purchaseType,
      supplier_country: country || null,
      currency_code: currency,
      working_exchange_rate_to_ils: rate ? Number(rate) : null,
      order_date: orderDate,
      estimated_arrival_date: eta || null,
      supplier_order_reference: reference || null,
      notes: notes || null,
    });
    onOpenChange(false);
    if (result?.id) navigate(`/import/${result.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>הזמנת יבוא חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>ספק</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא ספק</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סוג רכישה</Label>
              <Select value={purchaseType} onValueChange={(v) => setPurchaseType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct_import">יבוא ישיר</SelectItem>
                  <SelectItem value="parallel_import">יבוא מקביל</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>מדינת ספק</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="לדוגמה: סין" />
            </div>
            <div className="space-y-2">
              <Label>מטבע</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>שער עבודה לש״ח</Label>
              <Input
                type="number" step="0.0001" min="0"
                value={rate} onChange={(e) => setRate(e.target.value)} placeholder="3.7000"
              />
            </div>
            <div className="space-y-2">
              <Label>תאריך הזמנה</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>הגעה משוערת</Label>
              <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>אסמכתת הזמנה אצל הספק</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>הערות</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button type="submit" disabled={createOrder.isPending}>יצירת הזמנה</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
