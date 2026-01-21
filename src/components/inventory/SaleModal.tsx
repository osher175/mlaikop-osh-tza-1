import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingDown, Calculator, DollarSign } from 'lucide-react';

interface SaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: SaleData) => void;
  quantitySold: number;
  productName: string;
  listPrice: number; // מחיר מחירון ליחידה
  costPrice: number; // עלות ליחידה
  isLoading?: boolean;
}

export interface SaleData {
  saleTotalIls: number;
  notes?: string;
}

export const SaleModal: React.FC<SaleModalProps> = ({
  open,
  onOpenChange,
  onConfirm,
  quantitySold,
  productName,
  listPrice,
  costPrice,
  isLoading = false,
}) => {
  const [saleTotalIls, setSaleTotalIls] = useState<string>('');
  const [notes, setNotes] = useState('');

  const listTotal = listPrice * quantitySold;
  const saleTotal = parseFloat(saleTotalIls) || 0;
  const discountIls = listTotal - saleTotal;
  const discountPercent = listTotal > 0 ? (discountIls / listTotal) * 100 : 0;
  const grossProfit = saleTotal - (costPrice * quantitySold);
  const profitMargin = saleTotal > 0 ? (grossProfit / saleTotal) * 100 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleTotalIls || parseFloat(saleTotalIls) <= 0) return;

    onConfirm({
      saleTotalIls: parseFloat(saleTotalIls),
      notes: notes || undefined,
    });

    // Reset form
    setSaleTotalIls('');
    setNotes('');
  };

  const handleClose = () => {
    setSaleTotalIls('');
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
            <TrendingDown className="h-5 w-5 text-red-500" />
            רישום מכירה
          </DialogTitle>
          <DialogDescription>
            נמכרו <strong>{quantitySold}</strong> יחידות של <strong>{productName}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* מידע על מחיר מחירון */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">מחיר מחירון ליחידה:</span>
              <span className="font-medium">{formatCurrency(listPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">סה"כ לפי מחירון:</span>
              <span className="font-medium">{formatCurrency(listTotal)}</span>
            </div>
          </div>

          {/* סכום כולל */}
          <div>
            <Label htmlFor="saleTotal" className="text-sm font-medium">
              סכום ששולם בפועל (₪) *
            </Label>
            <div className="relative mt-1">
              <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="saleTotal"
                type="number"
                min="0"
                step="0.01"
                value={saleTotalIls}
                onChange={(e) => setSaleTotalIls(e.target.value)}
                placeholder="הזן את הסכום ששולם"
                className="pr-10 h-12 text-lg"
                required
                autoFocus
              />
            </div>
          </div>

          {/* חישובים אוטומטיים */}
          {saleTotal > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">חישוב אוטומטי</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">מחיר ליחידה בפועל:</span>
                <span className="font-medium">{formatCurrency(saleTotal / quantitySold)}</span>
              </div>
              
              {discountIls > 0 && (
                <>
                  <div className="flex justify-between text-orange-700">
                    <span>הנחה:</span>
                    <span className="font-medium">
                      {formatCurrency(discountIls)} ({discountPercent.toFixed(1)}%)
                    </span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between pt-2 border-t border-blue-200">
                <span className="text-gray-700">רווח גולמי:</span>
                <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(grossProfit)} ({profitMargin.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* הערות */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">הערות (אופציונלי)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="פרטים נוספים על המכירה..."
              className="mt-1 h-20"
            />
          </div>

          {/* אזהרה אם מחיר מכירה גבוה ממחירון */}
          {saleTotal > listTotal && (
            <Alert variant="destructive">
              <AlertDescription>
                שים לב: הסכום גבוה ממחיר המחירון
              </AlertDescription>
            </Alert>
          )}

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
              disabled={isLoading || !saleTotalIls || parseFloat(saleTotalIls) <= 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'שומר...' : 'אשר מכירה'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
