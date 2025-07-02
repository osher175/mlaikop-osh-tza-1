
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductCategories } from '@/hooks/useProductCategories';

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
  const { createProductCategory } = useProductCategories(businessCategoryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      await createProductCategory.mutateAsync({
        name: categoryName.trim(),
        business_category_id: businessCategoryId,
      });
      
      setCategoryName('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating category:', error);
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
            <Button type="submit" disabled={createProductCategory.isPending} className="flex-1">
              {createProductCategory.isPending ? 'שומר...' : 'הוסף קטגוריה'}
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
