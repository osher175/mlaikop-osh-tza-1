
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Define Product type inline to avoid import issues
type Product = {
  id: string;
  name: string;
  barcode?: string;
  quantity: number;
  price?: number;
  cost?: number;
  location?: string;
  expiration_date?: string;
  image?: string;
  product_category_id?: string;
  supplier_id?: string;
  business_id: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  alert_dismissed: boolean;
};

interface DeleteProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductDeleted: () => void;
}

export const DeleteProductDialog: React.FC<DeleteProductDialogProps> = ({
  product,
  open,
  onOpenChange,
  onProductDeleted,
}) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!product) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "מוצר נמחק בהצלחה",
        description: `המוצר "${product.name}" הוסר מהמערכת`,
      });

      onProductDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "שגיאה במחיקת המוצר",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
          <AlertDialogDescription>
            פעולה זו תמחק את המוצר "{product?.name}" לצמיתות מהמערכת.
            לא ניתן לבטל פעולה זו.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-red-600 hover:bg-red-700"
          >
            מחק מוצר
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
