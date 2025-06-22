
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Save } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { CreateBusinessDialog } from '@/components/CreateBusinessDialog';

export const AddProduct: React.FC = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { createProduct } = useProducts();
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    quantity: 0,
    expiration_date: '',
    location: '',
    cost: 0,
    price: 0,
    image: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessContext?.business_id || !user?.id) {
      console.error('Business ID or User ID not found');
      return;
    }

    try {
      await createProduct.mutateAsync({
        ...formData,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        expiration_date: formData.expiration_date || null,
      });
      
      // Reset form
      setFormData({
        name: '',
        barcode: '',
        category_id: '',
        supplier_id: '',
        quantity: 0,
        expiration_date: '',
        location: '',
        cost: 0,
        price: 0,
        image: '',
      });
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (imageUrl: string) => {
    handleInputChange('image', imageUrl);
  };

  const handleImageRemove = () => {
    handleInputChange('image', '');
  };

  if (!businessContext) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Package className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle>צור עסק חדש</CardTitle>
              <p className="text-gray-600">כדי להוסיף מוצרים, תחילה עליך ליצור עסק</p>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setShowCreateBusiness(true)}
                className="w-full bg-primary hover:bg-primary-600"
              >
                צור עסק חדש
              </Button>
            </CardContent>
          </Card>
          <CreateBusinessDialog
            open={showCreateBusiness}
            onClose={() => setShowCreateBusiness(false)}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הוספת מוצר חדש</h1>
            <p className="text-gray-600">הוסף מוצר חדש למערכת הניהול</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Main Product Info */}
            <Card>
              <CardHeader>
                <CardTitle>פרטי מוצר בסיסיים</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">שם המוצר *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="הכנס שם מוצר..."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="barcode">ברקוד</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => handleInputChange('barcode', e.target.value)}
                    placeholder="הכנס ברקוד..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">קטגוריה</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => handleInputChange('category_id', value)}
                    >
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

                  <div>
                    <Label htmlFor="supplier">ספק</Label>
                    <Select
                      value={formData.supplier_id}
                      onValueChange={(value) => handleInputChange('supplier_id', value)}
                    >
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
                </div>

                <div>
                  <Label>תמונת מוצר</Label>
                  <ImageUpload
                    currentImageUrl={formData.image}
                    onImageUpload={handleImageUpload}
                    onImageRemove={handleImageRemove}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Inventory & Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>מלאי ותמחור</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="quantity">כמות במלאי *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    min="0"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location">מיקום במחסן</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="מדף A, תא 5..."
                  />
                </div>

                <div>
                  <Label htmlFor="expiration_date">תאריך תפוגה</Label>
                  <Input
                    id="expiration_date"
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => handleInputChange('expiration_date', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost">מחיר עלות (₪)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="price">מחיר מכירה (₪)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>

                {formData.cost > 0 && formData.price > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      רווח צפוי: ₪{(formData.price - formData.cost).toFixed(2)} 
                      ({(((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary-600"
              disabled={createProduct.isPending}
            >
              <Save className="w-4 h-4 ml-2" />
              {createProduct.isPending ? 'שומר...' : 'שמור מוצר'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
