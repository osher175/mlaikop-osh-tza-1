
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useQueryClient } from '@tanstack/react-query';

interface AddProductCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessCategoryId: string;
}

export const AddProductCategoryDialog: React.FC<AddProductCategoryDialogProps> = ({
  open,
  onOpenChange,
  businessCategoryId,
}) => {
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use the hook only if we have a proper business_category_id
  const { createProductCategory } = useProductCategories(
    businessCategoryId !== 'default' ? businessCategoryId : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    if (!user?.id || !business?.id) return;

    setLoading(true);
    try {
      if (businessCategoryId !== 'default' && business.business_category_id) {
        // Use the existing product categories system
        await createProductCategory.mutateAsync({
          name: categoryName.trim(),
          business_category_id: businessCategoryId,
        });
      } else {
        // Create a category in the old categories table for businesses without business_category_id
        const { error } = await supabase
          .from('categories')
          .insert({
            name: categoryName.trim(),
            business_id: business.id,
          });

        if (error) throw error;

        // Invalidate categories query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['old-categories'] });
        
        toast({
          title: "קטגוריה נוצרה בהצלחה",
          description: `הקטגוריה "${categoryName.trim()}" נוספה למערכת`,
        });
      }
      
      setCategoryName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating category:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה ביצירת הקטגוריה",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת קטגוריית מוצר חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="categoryName">שם הקטגוריה</Label>
            <Input
              id="categoryName"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="הכנס שם קטגוריה..."
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'שומר...' : 'הוסף קטגוריה'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
