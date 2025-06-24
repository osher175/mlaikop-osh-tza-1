
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Save, Plus } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { CreateBusinessDialog } from '@/components/CreateBusinessDialog';
import { useCategories } from '@/hooks/useCategories';
import { useBusiness } from '@/hooks/useBusiness';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { supabase } from '@/integrations/supabase/client';

export const AddProduct: React.FC = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { business } = useBusiness();
  const { suppliers } = useSuppliers();
  const { createProduct } = useProducts();
  const { categories } = useCategories();
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    product_category_id: '',
    supplier_id: '',
    supplier_name: '',
    quantity: 0,
    expiration_date: '',
    location: '',
    cost: 0,
    price: 0,
    image: '',
  });

  // Filter suppliers based on input
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierInput.toLowerCase())
  );

  const handleSupplierInputChange = (value: string) => {
    setSupplierInput(value);
    setFormData(prev => ({ ...prev, supplier_name: value, supplier_id: '' }));
    setShowSupplierSuggestions(value.length > 0);
  };

  const handleSupplierSelect = (supplier: any) => {
    setSupplierInput(supplier.name);
    setFormData(prev => ({ ...prev, supplier_id: supplier.id, supplier_name: supplier.name }));
    setShowSupplierSuggestions(false);
  };

  const findOrCreateSupplier = async (supplierName: string) => {
    if (!supplierName.trim() || !businessContext?.business_id) return null;

    // Check if supplier already exists
    const existingSupplier = suppliers.find(s => 
      s.name.toLowerCase() === supplierName.toLowerCase()
    );

    if (existingSupplier) {
      return existingSupplier.id;
    }

    // Create new supplier
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: supplierName.trim(),
          business_id: businessContext.business_id
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Error creating supplier:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!businessContext?.business_id || !user?.id) {
      console.error('Business ID or User ID not found');
      return;
    }

    try {
      let supplierId = formData.supplier_id;
      
      // If supplier name is provided but no ID, find or create supplier
      if (formData.supplier_name && !formData.supplier_id) {
        supplierId = await findOrCreateSupplier(formData.supplier_name);
      }

      // Prepare product data - only use product_category_id
      const productData: any = {
        name: formData.name,
        barcode: formData.barcode || null,
        supplier_id: supplierId || null,
        quantity: formData.quantity,
        expiration_date: formData.expiration_date || null,
        location: formData.location,
        cost: formData.cost,
        price: formData.price,
        image: formData.image,
        product_category_id: formData.product_category_id || null,
      };

      await createProduct.mutateAsync(productData);
      
      // Reset form
      setFormData({
        name: '',
        barcode: '',
        product_category_id: '',
        supplier_id: '',
        supplier_name: '',
        quantity: 0,
        expiration_date: '',
        location: '',
        cost: 0,
        price: 0,
        image: '',
      });
      setSupplierInput('');
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
                    <div className="flex gap-2">
                      <Select
                        value={formData.product_category_id}
                        onValueChange={(value) => handleInputChange('product_category_id', value)}
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

                  <div>
                    <Label htmlFor="supplier">ספק</Label>
                    <div className="relative">
                      <Input
                        id="supplier"
                        value={supplierInput}
                        onChange={(e) => handleSupplierInputChange(e.target.value)}
                        onFocus={() => setShowSupplierSuggestions(supplierInput.length > 0)}
                        onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                        placeholder="הקלד או בחר ספק..."
                      />
                      {showSupplierSuggestions && filteredSuppliers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {filteredSuppliers.map((supplier) => (
                            <div
                              key={supplier.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-right"
                              onClick={() => handleSupplierSelect(supplier)}
                            >
                              {supplier.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

        {/* Add Category Dialog */}
        {business?.business_category_id && (
          <AddProductCategoryDialog
            open={showAddCategory}
            onOpenChange={setShowAddCategory}
            businessCategoryId={business.business_category_id}
          />
        )}
      </div>
    </MainLayout>
  );
};
