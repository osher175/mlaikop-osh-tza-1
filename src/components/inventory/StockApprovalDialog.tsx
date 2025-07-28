
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface StockApprovalDialogProps {
  productName: string;
  productId: string;
  onApprove: (productId: string) => void;
  isApproving: boolean;
  children: React.ReactNode;
}

export const StockApprovalDialog: React.FC<StockApprovalDialogProps> = ({
  productName,
  productId,
  onApprove,
  isApproving,
  children,
}) => {
  const [open, setOpen] = React.useState(false);

  const handleApprove = () => {
    onApprove(productId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            אישור שליחה לספק
          </DialogTitle>
          <DialogDescription>
            האם אתה בטוח שברצונך לשלוח הודעה לספק עבור המוצר "{productName}"?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isApproving}
          >
            ביטול
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApproving}
            className="bg-primary hover:bg-primary/90"
          >
            {isApproving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                שולח...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 ml-2" />
                כן, שלח
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
