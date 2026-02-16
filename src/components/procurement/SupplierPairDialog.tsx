import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierPairs } from '@/hooks/useSupplierPairs';
import { useProcurementActions } from '@/hooks/useProcurementActions';
import { Save } from 'lucide-react';

interface SupplierPairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    id: string;
    product_id: string;
    supplier_a_id?: string | null;
    supplier_b_id?: string | null;
    products?: { name: string; product_category_id?: string | null } | null;
  };
}

export const SupplierPairDialog: React.FC<SupplierPairDialogProps> = ({
  open,
  onOpenChange,
  request,
}) => {
  const { suppliers } = useSuppliers();
  const { upsertPair } = useSupplierPairs();
  const { updateSupplierPair } = useProcurementActions();

  const [supplierA, setSupplierA] = useState(request.supplier_a_id || '');
  const [supplierB, setSupplierB] = useState(request.supplier_b_id || '');
  const [strategy, setStrategy] = useState('balanced');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!supplierA || !supplierB) return;
    if (supplierA === supplierB) return;
    setSaving(true);
    try {
      const categoryId = request.products?.product_category_id;

      // Determine pair source
      let pairSource: 'category' | 'product' = 'product';
      if (saveAsDefault && categoryId) {
        pairSource = 'category';
      }

      // Update the procurement request
      await updateSupplierPair.mutateAsync({
        requestId: request.id,
        supplierAId: supplierA,
        supplierBId: supplierB,
        pairSource,
      });

      // Save pair config
      if (saveAsDefault) {
        if (!categoryId) {
          // No category on this product — skip category save, just save as product
          await upsertPair.mutateAsync({
            scope: 'product',
            product_id: request.product_id,
            supplier_a_id: supplierA,
            supplier_b_id: supplierB,
            strategy,
          });
        } else {
          await upsertPair.mutateAsync({
            scope: 'category',
            category_id: categoryId,
            supplier_a_id: supplierA,
            supplier_b_id: supplierB,
            strategy,
          });
        }
      } else {
        await upsertPair.mutateAsync({
          scope: 'product',
          product_id: request.product_id,
          supplier_a_id: supplierA,
          supplier_b_id: supplierB,
          strategy,
        });
      }

      onOpenChange(false);
    } catch {
      // errors handled by hooks
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliersA = suppliers;
  const filteredSuppliersB = suppliers.filter(s => s.id !== supplierA);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הגדרת זוג ספקים — {request.products?.name || 'מוצר'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>ספק A</Label>
            <Select value={supplierA} onValueChange={setSupplierA}>
              <SelectTrigger><SelectValue placeholder="בחר ספק A" /></SelectTrigger>
              <SelectContent>
                {filteredSuppliersA.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ספק B</Label>
            <Select value={supplierB} onValueChange={setSupplierB}>
              <SelectTrigger><SelectValue placeholder="בחר ספק B" /></SelectTrigger>
              <SelectContent>
                {filteredSuppliersB.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>אסטרטגיה</Label>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cheapest">הזול ביותר</SelectItem>
                <SelectItem value="quality">איכות</SelectItem>
                <SelectItem value="balanced">מאוזן</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {request.products?.product_category_id && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-default"
                checked={saveAsDefault}
                onCheckedChange={(checked) => setSaveAsDefault(!!checked)}
              />
              <Label htmlFor="save-default" className="text-sm cursor-pointer">
                שמור כברירת מחדל לקטגוריה
              </Label>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!supplierA || !supplierB || supplierA === supplierB || saving}
            className="w-full"
          >
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'שומר...' : 'שמור'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
