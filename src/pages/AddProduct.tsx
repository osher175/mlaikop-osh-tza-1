
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Camera, Barcode, Calendar, MapPin, DollarSign } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBusiness } from '@/hooks/useBusiness';
import { useNavigate } from 'react-router-dom';

export const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category_id: '',
    supplier_id: '',
    quantity: 0,
    cost: 0,
    price: 0,
    location: '',
    expiration_date: '',
    image: '',
  });

  const { createProduct } = useProducts();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { business } = useBusiness();

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!business?.id) {
      console.error('No business found');
      return;
    }

    try {
      await createProduct.mutateAsync({
        ...formData,
        business_id: business.id,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        expiration_date: formData.expiration_date || null,
        cost: formData.cost || null,
        price: formData.price || null,
        location: formData.location || null,
        image: formData.image || null,
        barcode: formData.barcode || null,
      });
      
      navigate('/inventory');
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">הוספת מוצר חדש</h1>
          <p className="text-gray-600">הוסף מוצר חדש למלאי שלך</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  מידע בסיסי
                </CardTitle>
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
                  <div className="relative">
                    <Barcode className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => handleInputChange('barcode', e.target.value)}
                      placeholder="סרוק או הכנס ברקוד..."
                      className="pr-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="category">קטגוריה</Label>
                  <Select onValueChange={(value) => handleInputChange('category_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר קטגוריה..." />
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
                  <Select onValueChange={(value) => handleInputChange('supplier_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר ספק..." />
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
              </CardContent>
            </Card>

            {/* Inventory Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  פרטי מלאי
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="quantity">כמות *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location">מיקום</Label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="מדף A1, אזור ב..."
                      className="pr-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expiration_date">תאריך תפוגה</Label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => handleInputChange('expiration_date', e.target.value)}
                      className="pr-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  תמחור
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cost">מחיר עלות (₪)</Label>
                  <Input
                    id="cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="price">מחיר מכירה (₪)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                {formData.cost > 0 && formData.price > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      רווח: ₪{(formData.price - formData.cost).toFixed(2)} 
                      ({(((formData.price - formData.cost) / formData.cost) * 100).toFixed(1)}%)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  תמונת מוצר
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">גרור תמונה או לחץ לבחירה</p>
                  <Button type="button" variant="outline">
                    בחר תמונה
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/inventory')}
            >
              ביטול
            </Button>
            <Button 
              type="submit" 
              className="bg-primary hover:bg-primary-600"
              disabled={createProduct.isPending}
            >
              {createProduct.isPending ? 'שומר...' : 'שמור מוצר'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
