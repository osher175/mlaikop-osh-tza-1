
import React, { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface DeleteSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const DeleteSupplierDialog: React.FC<DeleteSupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!supplier || !businessContext?.business_id) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן למחוק את הספק',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // First check if supplier is being used by any products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .eq('supplier_id', supplier.id)
        .eq('business_id', businessContext.business_id)
        .limit(1);

      if (productsError) {
        console.error('Error checking products:', productsError);
        throw productsError;
      }

      if (products && products.length > 0) {
        toast({
          title: 'לא ניתן למחוק',
          description: 'לא ניתן למחוק ספק שמשויך למוצרים. הסר תחילה את השיוך למוצרים.',
          variant: 'destructive',
        });
        setIsDeleting(false);
        return;
      }

      // Delete the supplier
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id)
        .eq('business_id', businessContext.business_id);

      if (error) {
        console.error('Error deleting supplier:', error);
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה במחיקת הספק',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'הצלחה!',
        description: `הספק "${supplier.name}" נמחק בהצלחה`,
      });

      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onOpenChange(false);

    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בלתי צפויה',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-right">
            מחיקת ספק
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            האם אתה בטוח שברצונך למחוק את הספק "{supplier?.name}"?
            <br />
            פעולה זו אינה הפיכה.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel disabled={isDeleting}>
            ביטול
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? 'מוחק...' : 'מחק'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
