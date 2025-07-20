
import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

// Define local types
interface SupplierInvoice {
  id: string;
  invoice_date: string;
  amount: number;
  supplier_id: string;
  business_id: string;
  file_url?: string;
}

interface DeleteSupplierInvoiceDialogProps {
  invoice: SupplierInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteSupplierInvoiceDialog: React.FC<DeleteSupplierInvoiceDialogProps> = ({
  invoice,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast({
        title: 'חשבונית נמחקה בהצלחה',
        description: 'החשבונית נמחקה מהמערכት',
      });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'שגיאה במחיקת החשבונית',
        description: 'אירעה שגיאה במחיקת החשבונית. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת חשבונית</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את החשבונית מתאריך {new Date(invoice.invoice_date).toLocaleDateString('he-IL')}?
            פעולה זו לא ניתנת לביטול.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteInvoiceMutation.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            מחק
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
