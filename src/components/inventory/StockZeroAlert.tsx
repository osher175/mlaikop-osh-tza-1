
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface StockZeroAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productId: string;
  onConfirm: () => void;
}

export const StockZeroAlert: React.FC<StockZeroAlertProps> = ({
  open,
  onOpenChange,
  productName,
  productId,
  onConfirm,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
          </div>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            המוצר אזל מהמלאי
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center py-4">
          <p className="text-gray-700 mb-2">
            ❗️המוצר <span className="font-semibold">{productName}</span> אזל מהמלאי.
          </p>
          <p className="text-gray-600">
            האם לשלוח הודעה לסוכן?
          </p>
        </div>

        <DialogFooter className="flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="min-w-[80px]"
          >
            ❌ לא
          </Button>
          <Button
            onClick={handleConfirm}
            className="min-w-[80px] bg-green-600 hover:bg-green-700"
          >
            ✅ כן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
