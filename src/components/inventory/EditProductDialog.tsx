
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/ui/image-upload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    barcode: product?.barcode || '',
    quantity: product?.quantity || 0,
    price: product?.price || 0,
    cost: product?.cost || 0,
    location: product?.location || '',
    expiration_date: product?.expiration_date || '',
    image: product?.image || '',
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
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: formData.name,
          barcode: formData.barcode || null,
          quantity: formData.quantity,
          price: formData.price || null,
          cost: formData.cost || null,
          location: formData.location || null,
          expiration_date: formData.expiration_date || null,
          image: formData.image || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "מוצר עודכן בהצלחה",
        description: "הפרטים נשמרו במערכת",
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
  );
};
