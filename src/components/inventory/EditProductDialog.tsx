import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useBusiness } from '@/hooks/useBusiness';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { Plus } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdated: () => void;
}

export const EditProductDialog: React.FC<EditProductDialogProps> = ({
  product,
  open,
  onOpenChange,
  onProductUpdated,
}) => {
  const { toast } = useToast();
  const { business } = useBusiness();
  const { categories } = useCategories();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    barcode: product?.barcode || '',
    quantity: product?.quantity || 0,
    price: product?.price || 0,
    cost: product?.cost || 0,
    location: product?.location || '',
    expiration_date: product?.expiration_date || '',
    image: product?.image || '',
    product_category_id: product?.product_category_id || '',
  });

  React.useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        barcode: product.barcode || '',
        quantity: product.quantity || 0,
        price: product.price || 0,
        cost: product.cost || 0,
        location: product.location || '',
        expiration_date: product.expiration_date || '',
        image: product.image || '',
        product_category_id: product.product_category_id || '',
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !user || !business) return;

    setLoading(true);
    try {
      const oldQuantity = product.quantity || 0;
      const newQuantity = formData.quantity;
      const quantityDifference = newQuantity - oldQuantity;

      // Update product first
      const updateData: any = {
        name: formData.name,
        barcode: formData.barcode || null,
        quantity: formData.quantity,
        price: formData.price || null,
        cost: formData.cost || null,
        location: formData.location || null,
        expiration_date: formData.expiration_date || null,
        image: formData.image || null,
        product_category_id: formData.product_category_id || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (updateError) throw updateError;

      // Record inventory action if quantity changed
      if (quantityDifference !== 0) {
        let actionType = '';
        if (quantityDifference > 0) {
          actionType = 'add'; // Added to inventory
        } else {
          actionType = 'sale'; // Reduced from inventory (sale)
        }

        const { error: actionError } = await supabase
          .from('inventory_actions')
          .insert({
            product_id: product.id,
            business_id: business.id,
            user_id: user.id,
            action_type: actionType,
            quantity_changed: Math.abs(quantityDifference),
            timestamp: new Date().toISOString(),
            notes: actionType === 'sale' ? 'מכירה דרך עריכת מוצר' : 'הוספה למלאי דרך עריכת מוצר'
          });

        if (actionError) {
          console.error('Error recording inventory action:', actionError);
          // Don't fail the whole operation, just log the error
        } else {
          console.log(`Recorded ${actionType} action for product ${product.name}: ${Math.abs(quantityDifference)} units`);
        }
      }

      toast({
        title: "מוצר עודכן בהצלחה",
        description: quantityDifference !== 0 
          ? `הפרטים נשמרו במערכת וכמות ${Math.abs(quantityDifference)} יחידות ${quantityDifference > 0 ? 'נוספה למלאי' : 'נמכרה'}`
          : "הפרטים נשמרו במערכת",
      });

      onProductUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "שגיאה בעדכון המוצר",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, image: imageUrl }));
  };

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, image: '' }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת מוצר - {product?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">שם המוצר *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="barcode">ברקוד</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="category">קטגוריה</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.product_category_id}
                      onValueChange={(value) => setFormData({ ...formData, product_category_id: value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="בחר קטגוריה" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {business?.business_category_id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddCategory(true)}
                        className="px-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">כמות *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      required
                    />
                    {product && formData.quantity !== product.quantity && (
                      <div className="text-xs text-gray-500 mt-1">
                        {formData.quantity > (product.quantity || 0) 
                          ? `+${formData.quantity - (product.quantity || 0)} יחידות יתווספו למלאי`
                          : `${(product.quantity || 0) - formData.quantity} יחידות יירשמו כמכירה`
                        }
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="location">מיקום</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost">עלות</Label>
                    <Input
                      id="cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="price">מחיר מכירה</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expiration_date">תאריך פג תוקף</Label>
                  <Input
                    id="expiration_date"
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>תמונת מוצר</Label>
                <ImageUpload
                  currentImageUrl={formData.image}
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'שומר...' : 'שמור שינויים'}
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

      {/* Add Category Dialog */}
      {business?.business_category_id && (
        <AddProductCategoryDialog
          open={showAddCategory}
          onOpenChange={setShowAddCategory}
          businessCategoryId={business.business_category_id}
        />
      )}
    </>
  );
};
