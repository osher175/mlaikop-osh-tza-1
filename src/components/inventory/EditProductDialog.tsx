
import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Define local types
interface Product {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  cost?: number;
  barcode?: string;
  location?: string;
  expiration_date?: string;
  business_id: string;
}

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProductFormData {
  name: string;
  quantity: number;
  price?: number;
  cost?: number;
  barcode?: string;
  location?: string;
  expiration_date?: string;
}

export const EditProductDialog: React.FC<EditProductDialogProps> = ({
  product,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset } = useForm<ProductFormData>({
    defaultValues: {
      name: product.name,
      quantity: product.quantity,
      price: product.price || 0,
      cost: product.cost || 0,
      barcode: product.barcode || '',
      location: product.location || '',
      expiration_date: product.expiration_date || '',
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { error } = await supabase
        .from('products')
        .update(data)
        .eq('id', product.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'מוצר עודכן בהצלחה',
        description: `המוצר ${product.name} עודכן במערכת`,
      });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      console.error('Error updating product:', error);
      toast({
        title: 'שגיאה בעדכון המוצר',
        description: 'אירעה שגיאה בעדכון המוצר. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    updateProductMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת מוצר</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">שם המוצר</Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder="הכנס שם מוצר"
            />
          </div>
          
          <div>
            <Label htmlFor="quantity">כמות</Label>
            <Input
              id="quantity"
              type="number"
              {...register('quantity', { required: true, min: 0 })}
              placeholder="הכנס כמות"
            />
          </div>

          <div>
            <Label htmlFor="price">מחיר</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              {...register('price', { min: 0 })}
              placeholder="הכנס מחיר"
            />
          </div>

          <div>
            <Label htmlFor="cost">עלות</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              {...register('cost', { min: 0 })}
              placeholder="הכנס עלות"
            />
          </div>

          <div>
            <Label htmlFor="barcode">ברקוד</Label>
            <Input
              id="barcode"
              {...register('barcode')}
              placeholder="הכנס ברקוד"
            />
          </div>

          <div>
            <Label htmlFor="location">מיקום</Label>
            <Input
              id="location"
              {...register('location')}
              placeholder="הכנס מיקום"
            />
          </div>

          <div>
            <Label htmlFor="expiration_date">תאריך תפוגה</Label>
            <Input
              id="expiration_date"
              type="date"
              {...register('expiration_date')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={updateProductMutation.isPending}
            >
              {updateProductMutation.isPending ? 'מעדכן...' : 'עדכן'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
