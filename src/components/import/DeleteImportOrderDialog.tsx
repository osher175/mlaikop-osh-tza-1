import React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importNumber?: string | null;
  isDeleting?: boolean;
  onConfirm: (pin: string) => void;
}

/**
 * Deleting an import record is destructive, so it requires the same
 * server-verified import PIN used to unlock the module. The PIN is sent to the
 * `import_order_delete` RPC and never stored on the client.
 */
export const DeleteImportOrderDialog: React.FC<Props> = ({
  open, onOpenChange, importNumber, isDeleting, onConfirm,
}) => {
  const [pin, setPin] = React.useState('');

  React.useEffect(() => {
    if (open) setPin('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader className="text-right">
          <DialogTitle>מחיקת רישום הזמנת יבוא</DialogTitle>
          <DialogDescription>
            {importNumber ? `הזמנה ${importNumber} ` : ''}
            תימחק לצמיתות יחד עם הפריטים, העלויות, התשלומים והמסמכים שלה.
            הזמנה שכבר נקלטה למלאי אינה ניתנת למחיקה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-import-pin">קוד סודי (4 ספרות)</Label>
          <Input
            id="delete-import-pin"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="text-center tracking-[0.5em]"
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            variant="destructive"
            disabled={pin.length !== 4 || isDeleting}
            onClick={() => onConfirm(pin)}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 ml-2" />
            )}
            מחיקה סופית
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
