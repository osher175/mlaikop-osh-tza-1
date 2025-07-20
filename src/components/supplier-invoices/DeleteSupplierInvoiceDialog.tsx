
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSupplierInvoices } from '@/hooks/useSupplierInvoices';
import type { Database } from '@/integrations/supabase/types';

type SupplierInvoice = Database['public']['Tables']['supplier_invoices']['Row'];

interface DeleteSupplierInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SupplierInvoice | null;
}

export const DeleteSupplierInvoiceDialog: React.FC<DeleteSupplierInvoiceDialogProps> = ({
  open,
  onOpenChange,
  invoice
}) => {
  const { deleteInvoice } = useSupplierInvoices();

  const handleDelete = async () => {
    if (!invoice) return;
    
    await deleteInvoice.mutateAsync(invoice.id);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">
            מחיקת חשבונית
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את החשבונית מתאריך {invoice?.invoice_date}?
            <br />
            פעולה זו אינה הפיכה.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel disabled={deleteInvoice.isPending}>
            ביטול
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteInvoice.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteInvoice.isPending ? 'מוחק...' : 'מחק'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
