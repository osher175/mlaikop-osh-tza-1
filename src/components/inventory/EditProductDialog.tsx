import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useProducts, Product } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCategories } from '@/hooks/useCategories';
import { useBusiness } from '@/hooks/useBusiness';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditProductDialog: React.FC<EditProductDialogProps> = ({
  product,
  open,
  onOpenChange,
}) => {
  const { business } = useBusiness();
  const { updateProduct } = useProducts();
  const { suppliers } = useSuppliers();
  const { categories } = useCategories();

  const [formData, setFormData] = useState({
    name: product.name || '',
    barcode: product.barcode || '',
    quantity: product.quantity || 0,
    price: product.price || 0,
    cost: product.cost || 0,
    location: product.location || '',
    expiration_date: product.expiration_date || '',
    supplier_id: product.supplier_id || '',
    category_id: product.product_category_id || '',
    enable_whatsapp_supplier_notification: product.enable_whatsapp_supplier_notification || false,
  });

  const [expirationDate, setExpirationDate] = useState<Date | undefined>(
    product.expiration_date ? new Date(product.expiration_date) : undefined
  );

  useEffect(() => {
    setFormData({
      name: product.name || '',
      barcode: product.barcode || '',
      quantity: product.quantity || 0,
      price: product.price || 0,
      cost: product.cost || 0,
      location: product.location || '',
      expiration_date: product.expiration_date || '',
      supplier_id: product.supplier_id || '',
      category_id: product.product_category_id || '',
      enable_whatsapp_supplier_notification: product.enable_whatsapp_supplier_notification || false,
    });
    setExpirationDate(product.expiration_date ? new Date(product.expiration_date) : undefined);
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        ...formData,
        expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : null,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת מוצר</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">שם המוצר *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="barcode">ברקוד</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="quantity">כמות</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
            
            <div>
              <Label htmlFor="price">מחיר מכירה (₪)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            
            <div>
              <Label htmlFor="cost">מחיר עלות (₪)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">מיקום</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div>
            <Label>תאריך תפוגה</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, "dd/MM/yyyy") : "בחר תאריך תפוגה"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier">ספק</Label>
              <Select value={formData.supplier_id} onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר ספק" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category">קטגוריה</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}>
                <SelectTrigger>
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
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="whatsapp-notification"
              checked={formData.enable_whatsapp_supplier_notification}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enable_whatsapp_supplier_notification: checked }))}
            />
            <Label htmlFor="whatsapp-notification">
              התרעת WhatsApp לספק כאשר המוצר אוזל
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1" disabled={updateProduct.isPending}>
              {updateProduct.isPending ? 'שומר...' : 'שמור שינויים'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
