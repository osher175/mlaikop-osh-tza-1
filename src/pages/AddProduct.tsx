import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { BarcodeScanner } from '@/components/ui/barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useAuth } from '@/hooks/useAuth';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCategories } from '@/hooks/useCategories';
import { useBusiness } from '@/hooks/useBusiness';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { AddSupplierDialog } from '@/components/inventory/AddSupplierDialog';
import { Plus, ArrowRight, Package, Scan } from 'lucide-react';
import { useInventoryLogger } from '@/hooks/useInventoryLogger';

export const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { suppliers } = useSuppliers();
  const { categories } = useCategories();
  const { business } = useBusiness();
  const { logInventoryAction } = useInventoryLogger();
  const [loading, setLoading] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    location: '',
    expiration_date: '',
    supplier_id: '',
    product_category_id: '',
    image: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !businessContext?.business_id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להוסיף מוצר ללא זיהוי משתמש או עסק",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Duplicate check
      const { data: existing, error: existingError } = await supabase
        .from("products")
        .select("id")
        .or(`name.eq.${formData.name},barcode.eq.${formData.barcode}`)
        .eq("business_id", businessContext.business_id)
        .maybeSingle();
      if (existing) {
        toast({
          title: "המוצר כבר קיים במלאי",
          description: "שם המוצר או הברקוד שהזנת כבר קיימים.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const productData = {
        name: formData.name,
        barcode: formData.barcode || null,
        quantity: formData.quantity,
        price: formData.price || null,
        cost: formData.cost || null,
        location: formData.location || null,
        expiration_date: formData.expiration_date || null,
        supplier_id: formData.supplier_id || null,
        product_category_id: formData.product_category_id || null,
        image: formData.image || null,
        business_id: businessContext.business_id,
        created_by: user.id,
      };

      const { data: product, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) throw error;

      // Log inventory action for initial stock
      if (formData.quantity > 0) {
        await logInventoryAction(
          product.id, 
          'add', 
          formData.quantity,
          `הוספת מוצר חדש עם ${formData.quantity} יחידות ראשוניות`
        );
      }

      toast({
        title: "מוצר נוסף בהצלחה!",
        description: `המוצר "${formData.name}" נוסף למלאי`,
      });

      navigate('/inventory');
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "שגיאה בהוספת המוצר",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    setFormData({ ...formData, barcode });
    setShowBarcodeScanner(false);
    toast({
      title: "ברקוד נסרק בהצלחה",
      description: `ברקוד: ${barcode}`,
    });
  };

  const handleImageUpload = (imageUrl: string) => {
    setFormData({ ...formData, image: imageUrl });
  };

  const handleImageRemove = () => {
    setFormData({ ...formData, image: '' });
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            חזור למלאי
          </Button>
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-turquoise" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">הוספת מוצר חדש</h1>
              <p className="text-gray-600">הוסף מוצר חדש למלאי העסק</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>פרטי המוצר</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">שם המוצר *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="הזן שם מוצר"
                    />
                  </div>

                  <div>
                    <Label htmlFor="barcode">ברקוד</Label>
                    <div className="flex gap-2">
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddCategory(true)}
                        className="px-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="supplier">ספק</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.supplier_id}
                        onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="בחר ספק (אופציונלי)" />
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
                        className="px-2"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
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
                    </div>
                    <div>
                      <Label htmlFor="location">מיקום</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="מיקום במחסן"
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
                        placeholder="0.00"
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
                        placeholder="0.00"
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

              <div className="flex gap-2 pt-6">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'מוסיף מוצר...' : 'הוסף מוצר'}
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

        {/* Barcode Scanner Dialog */}
        <BarcodeScanner
          open={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onBarcodeScanned={handleBarcodeScanned}
        />

        {/* Add Category Dialog - Now available for all businesses */}
        <AddProductCategoryDialog
          open={showAddCategory}
          onOpenChange={setShowAddCategory}
          businessCategoryId={business?.business_category_id || 'default'}
        />

        {/* Add Supplier Dialog */}
        <AddSupplierDialog
          open={showAddSupplier}
          onOpenChange={setShowAddSupplier}
        />
      </div>
    </MainLayout>
  );
};
