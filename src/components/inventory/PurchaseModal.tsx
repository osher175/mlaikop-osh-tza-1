import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Calculator, DollarSign, Truck } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: PurchaseData) => void;
  quantityAdded: number;
  productName: string;
  currentCost: number; // עלות נוכחית ליחידה
  currentQuantity: number; // כמות נוכחית במלאי
  defaultSupplierId?: string | null;
  isLoading?: boolean;
}

export interface PurchaseData {
  purchaseUnitIls: number;
  purchaseTotalIls: number;
  supplierId?: string;
  notes?: string;
}

export const PurchaseModal: React.FC<PurchaseModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  quantityAdded,
  productName,
  currentCost,
  currentQuantity,
  defaultSupplierId,
  isLoading = false,
}) => {
  const { suppliers } = useSuppliers();
  const [purchaseUnitIls, setPurchaseUnitIls] = useState<string>('');
  const [purchaseTotalIls, setPurchaseTotalIls] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [inputMode, setInputMode] = useState<'unit' | 'total'>('unit');

  // Set default supplier if provided
  useEffect(() => {
    if (defaultSupplierId) {
      setSupplierId(defaultSupplierId);
    }
  }, [defaultSupplierId]);

  // Calculate values based on input mode
  const unitPrice = inputMode === 'unit' 
    ? (parseFloat(purchaseUnitIls) || 0)
    : (parseFloat(purchaseTotalIls) || 0) / quantityAdded;
  
  const totalPrice = inputMode === 'total'
    ? (parseFloat(purchaseTotalIls) || 0)
    : (parseFloat(purchaseUnitIls) || 0) * quantityAdded;

  // חישוב עלות ממוצעת מתגלגלת
  const newAverageCost = currentQuantity + quantityAdded > 0
    ? ((currentQuantity * currentCost) + (quantityAdded * unitPrice)) / (currentQuantity + quantityAdded)
    : unitPrice;

  const costDifference = unitPrice - currentCost;
  const costChangePercent = currentCost > 0 ? (costDifference / currentCost) * 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unitPrice <= 0) return;

    onConfirm({
      purchaseUnitIls: unitPrice,
      purchaseTotalIls: totalPrice,
      supplierId: supplierId || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setPurchaseUnitIls('');
    setPurchaseTotalIls('');
    setSupplierId('');
    setNotes('');
  };

  const handleClose = () => {
    setPurchaseUnitIls('');
    setPurchaseTotalIls('');
    setSupplierId('');
    setNotes('');
    onOpenChange(false);
  };

  const formatCurrency = (amount: number) => {
    return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-green-500" />
            רישום קנייה / הכנסת מלאי
          </DialogTitle>
          <DialogDescription>
            נכנסו <strong>{quantityAdded}</strong> יחידות של <strong>{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* מידע על עלות נוכחית */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">עלות נוכחית ליחידה:</span>
              <span className="font-medium">{formatCurrency(currentCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">כמות נוכחית במלאי:</span>
              <span className="font-medium">{currentQuantity}</span>
            </div>
          </div>

          {/* Toggle בין מחיר יחידה לסכום כולל */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={inputMode === 'unit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('unit')}
              className="flex-1"
            >
              מחיר ליחידה
            </Button>
            <Button
              type="button"
              variant={inputMode === 'total' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMode('total')}
              className="flex-1"
            >
              סכום כולל
            </Button>
          </div>

          {/* שדה קלט - מחיר יחידה או סכום כולל */}
          {inputMode === 'unit' ? (
            <div>
              <Label htmlFor="purchaseUnit" className="text-sm font-medium">
                מחיר ליחידה (₪) *
              </Label>
              <div className="relative mt-1">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="purchaseUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseUnitIls}
                  onChange={(e) => setPurchaseUnitIls(e.target.value)}
                  placeholder="הזן מחיר ליחידה"
                  className="pr-10 h-12 text-lg"
                  required
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="purchaseTotal" className="text-sm font-medium">
                סכום כולל ששולם (₪) *
              </Label>
              <div className="relative mt-1">
                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="purchaseTotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseTotalIls}
                  onChange={(e) => setPurchaseTotalIls(e.target.value)}
                  placeholder="הזן סכום כולל"
                  className="pr-10 h-12 text-lg"
                  required
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* חישובים אוטומטיים */}
          {unitPrice > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">חישוב אוטומטי</span>
              </div>
              
              {inputMode === 'total' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">מחיר ליחידה:</span>
                  <span className="font-medium">{formatCurrency(unitPrice)}</span>
                </div>
              )}
              
              {inputMode === 'unit' && (
                <div className="flex justify-between">
                  <span className="text-gray-600">סכום כולל:</span>
                  <span className="font-medium">{formatCurrency(totalPrice)}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">שינוי במחיר:</span>
                <span className={`font-medium ${costDifference >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {costDifference >= 0 ? '+' : ''}{formatCurrency(costDifference)} ({costChangePercent.toFixed(1)}%)
                </span>
              </div>
              
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="text-gray-700">עלות ממוצעת חדשה:</span>
                <span className="font-bold text-blue-700">
                  {formatCurrency(newAverageCost)}
                </span>
              </div>
            </div>
          )}

          {/* בחירת ספק */}
          {suppliers.length > 0 && (
            <div>
              <Label htmlFor="supplier" className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                ספק (אופציונלי)
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא ספק</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* הערות */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">הערות (אופציונלי)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="פרטים נוספים על הקנייה..."
              className="mt-1 h-20"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              ביטול
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || unitPrice <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'שומר...' : 'אשר קנייה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
