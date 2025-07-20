
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { BarcodeScanner } from '@/components/ui/barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBusiness } from '@/hooks/useBusiness';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { AddSupplierDialog } from '@/components/suppliers/AddSupplierDialog';
import { Plus, Scan, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AddProduct: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createProduct } = useProducts();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { business } = useBusiness();
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    location: '',
    expiration_date: '',
    image: '',
    product_category_id: '',
    supplier_id: '',
    low_stock_threshold: 5,
    enable_whatsapp_supplier_notification: false,
  });

  const handleBarcodeScanned = (barcode: string) => {
    setFormData(prev => ({ ...prev, barcode }));
    setShowBarcodeScanner(false);
    toast({
      title: "ברקוד נסרק בהצלחה",
      description: `ברקוד: ${barcode}`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createProduct.mutateAsync({
        name: formData.name,
        barcode: formData.barcode || null,
        quantity: formData.quantity,
        price: formData.price || null,
        cost: formData.cost || null,
        location: formData.location || null,
        expiration_date: formData.expiration_date || null,
        image: formData.image || null,
        product_category_id: formData.product_category_id || null,
        supplier_id: formData.supplier_id || null,
        low_stock_threshold: formData.low_stock_threshold,
        enable_whatsapp_supplier_notification: formData.enable_whatsapp_supplier_notification,
      });

      // Reset form
      setFormData({
        name: '',
        barcode: '',
        quantity: 0,
        price: 0,
        cost: 0,
        location: '',
        expiration_date: '',
        image: '',
        product_category_id: '',
        supplier_id: '',
        low_stock_threshold: 5,
        enable_whatsapp_supplier_notification: false,
      });

      toast({
        title: "מוצר נוסף בהצלחה",
        description: "המוצר נוסף למערכת",
      });

      // Navigate to inventory after successful creation
      navigate('/inventory');
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, image: imageUrl }));
  };

  const handleImageRemove = () => {
    setFormData(prev => ({ ...prev, image: '' }));
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Package className="h-8 w-8" />
            הוספת מוצר חדש
          </h1>
          <p className="text-gray-600">
            הוסף מוצר חדש למלאי שלך
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>פרטי המוצר</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">שם המוצר *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-1"
                      placeholder="הזן שם המוצר"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="barcode" className="text-sm font-medium">ברקוד</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="הזן ברקוד או סרוק"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-3"
                      >
                        <Scan className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-sm font-medium">קטגוריה</Label>
                    <div className="flex gap-2 mt-1">
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
                          className="px-3"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="supplier" className="text-sm font-medium">ספק</Label>
                    <div className="flex gap-2 mt-1">
                      <Select
                        value={formData.supplier_id}
                        onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                      >
                        <SelectTrigger className="flex-1">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddSupplier(true)}
                        className="px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity" className="text-sm font-medium">כמות *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        required
                        className="mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="low_stock_threshold" className="text-sm font-medium">סף מלאי נמוך</Label>
                      <Input
                        id="low_stock_threshold"
                        type="number"
                        min="0"
                        value={formData.low_stock_threshold}
                        onChange={(e) => setFormData({ ...formData, low_stock_threshold: Number(e.target.value) })}
                        className="mt-1"
                        placeholder="5"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="location" className="text-sm font-medium">מיקום</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="mt-1"
                      placeholder="מדף, אזור, וכו'"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cost" className="text-sm font-medium">עלות (₪)</Label>
                      <Input
                        id="cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                        className="mt-1"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price" className="text-sm font-medium">מחיר מכירה (₪)</Label>
                      <Input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="mt-1"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="expiration_date" className="text-sm font-medium">תאריך פג תוקף</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  {/* WhatsApp Supplier Notification Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="whatsapp_notification" className="text-sm font-medium">
                        בקש הצעת מחיר אוטומטית מהספק
                      </Label>
                      <p className="text-xs text-gray-600 mt-1">
                        כאשר המוצר אוזל מהמלאי, תישלח הודעת WhatsApp לספק באופן אוטומטי
                      </p>
                    </div>
                    <Switch
                      id="whatsapp_notification"
                      checked={formData.enable_whatsapp_supplier_notification}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        enable_whatsapp_supplier_notification: checked
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium block mb-2">תמונת מוצר</Label>
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
                      <ImageUpload
                        currentImageUrl={formData.image}
                        onImageUpload={handleImageUpload}
                        onImageRemove={handleImageRemove}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t">
                <Button 
                  type="submit" 
                  disabled={createProduct.isPending}
                  className="flex-1"
                >
                  {createProduct.isPending ? 'שומר...' : 'שמור מוצר'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory')}
                  className="flex-1"
                >
                  ביטול
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <BarcodeScanner
          open={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {business?.business_category_id && (
          <AddProductCategoryDialog
            open={showAddCategory}
            onOpenChange={setShowAddCategory}
            businessCategoryId={business.business_category_id}
          />
        )}

        <AddSupplierDialog
          open={showAddSupplier}
          onOpenChange={setShowAddSupplier}
        />
      </div>
    </MainLayout>
  );
};
