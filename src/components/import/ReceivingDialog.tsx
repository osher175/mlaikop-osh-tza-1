import React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ReceivingPanel } from './ReceivingPanel';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  businessId?: string | null;
  items: any[];
  isReadOnly?: boolean;
}

/**
 * Receiving as a contextual operational action rather than a wizard step.
 * The panel itself is untouched: stock still moves only through the explicit
 * confirmation dialog and the atomic `import_receipt_confirm` RPC.
 */
export const ReceivingDialog: React.FC<Props> = ({
  open, onOpenChange, orderId, businessId, items, isReadOnly,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-w-3xl max-h-[92vh] overflow-y-auto">
      <DialogHeader className="text-right">
        <DialogTitle>קליטת סחורה</DialogTitle>
        <DialogDescription>
          כאן מזינים כמה יחידות באמת הגיעו מכל פריט. המלאי מתעדכן רק לאחר אישור סופי של הקליטה.
        </DialogDescription>
      </DialogHeader>
      <ReceivingPanel
        orderId={orderId}
        businessId={businessId}
        items={items}
        isReadOnly={isReadOnly}
      />
    </DialogContent>
  </Dialog>
);
