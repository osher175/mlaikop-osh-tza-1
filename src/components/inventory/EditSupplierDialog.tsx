
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
interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  phone?: string;
  business_id?: string;
}

interface EditSupplierDialogProps {
  supplier: Supplier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SupplierFormData {
  name: string;
  contact_email?: string;
  phone?: string;
}

export const EditSupplierDialog: React.FC<EditSupplierDialogProps> = ({
  supplier,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, reset } = useForm<SupplierFormData>({
    defaultValues: {
      name: supplier.name,
      contact_email: supplier.contact_email || '',
      phone: supplier.phone || '',
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const { error } = await supabase
        .from('suppliers')
        .update(data)
        .eq('id', supplier.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'ספק עודכן בהצלחה',
        description: `הספק ${supplier.name} עודכן במערכת`,
      });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
      toast({
        title: 'שגיאה בעדכון הספק',
        description: 'אירעה שגיאה בעדכון הספק. נסה שוב.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: SupplierFormData) => {
    updateSupplierMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת ספק</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">שם הספק</Label>
            <Input
              id="name"
              {...register('name', { required: true })}
              placeholder="הכנס שם ספק"
            />
          </div>
          
          <div>
            <Label htmlFor="contact_email">אימייל ליצירת קשר</Label>
            <Input
              id="contact_email"
              type="email"
              {...register('contact_email')}
              placeholder="הכנס אימייל"
            />
          </div>

          <div>
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="הכנס מספר טלפון"
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
              disabled={updateSupplierMutation.isPending}
            >
              {updateSupplierMutation.isPending ? 'מעדכן...' : 'עדכן'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
