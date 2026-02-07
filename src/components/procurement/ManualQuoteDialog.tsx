import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useSupplierQuotes } from '@/hooks/useSupplierQuotes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

interface ManualQuoteDialogProps {
  requestId: string;
}

export const ManualQuoteDialog: React.FC<ManualQuoteDialogProps> = ({ requestId }) => {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [available, setAvailable] = useState(true);
  const [deliveryDays, setDeliveryDays] = useState('');
  const [rawMessage, setRawMessage] = useState('');
  const { addManualQuote } = useSupplierQuotes(requestId);
  const { businessContext } = useBusinessAccess();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-quote', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      const { data } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('business_id', businessContext.business_id);
      return data || [];
    },
    enabled: !!businessContext?.business_id && open,
  });

  const handleSubmit = () => {
    if (!supplierId || !pricePerUnit) return;
    addManualQuote.mutate({
      procurement_request_id: requestId,
      supplier_id: supplierId,
      price_per_unit: parseFloat(pricePerUnit),
      available,
      delivery_time_days: deliveryDays ? parseInt(deliveryDays) : undefined,
      raw_message: rawMessage || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setSupplierId('');
        setPricePerUnit('');
        setAvailable(true);
        setDeliveryDays('');
        setRawMessage('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 ml-1" />
          הוסף הצעה ידנית
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>הוספת הצעת מחיר ידנית</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>ספק</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="בחר ספק" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>מחיר ליחידה (₪)</Label>
            <Input type="number" value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)} min="0" step="0.01" />
          </div>
          <div className="flex items-center justify-between">
            <Label>זמין</Label>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>
          <div>
            <Label>ימי אספקה</Label>
            <Input type="number" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} min="0" />
          </div>
          <div>
            <Label>הערות / הודעת ספק</Label>
            <Textarea value={rawMessage} onChange={e => setRawMessage(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={!supplierId || !pricePerUnit || addManualQuote.isPending} className="w-full">
            {addManualQuote.isPending ? 'שומר...' : 'הוסף הצעה'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
