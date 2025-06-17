
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Package, Camera, Save, ArrowRight } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';

export const AddProduct: React.FC = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: '',
    quantity: '',
    cost: '',
    price: '',
    location: '',
    description: '',
    supplier: '',
    expirationDate: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here would be the actual save logic
    toast({
      title: "המוצר נשמר בהצלחה",
      description: "המוצר נוסף למלאי שלך",
    });
  };

  const generateBarcode = () => {
    const barcode = Math.random().toString().substr(2, 12);
    setFormData(prev => ({ ...prev, barcode }));
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הוספת מוצר חדש</h1>
            <p className="text-gray-600">הוסף מוצר חדש למלאי שלך</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>מידע בסיסי</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">שם המוצר *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="הזן שם מוצר..."
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="barcode">ברקוד</Label>
                      <div className="flex gap-2">
                        <Input
                          id="barcode"
                          value={formData.barcode}
                          onChange={(e) => handleInputChange('barcode', e.target.value)}
                          placeholder="ברקוד המוצר"
                        />
                        <Button type="button" variant="outline" onClick={generateBarcode}>
                          צור ברקוד
                        </Button>
                        <ProtectedFeature requiredRole="pro_starter_user">
                          <Button type="button" variant="outline">
                            <Camera className="w-4 h-4" />
                          </Button>
                        </ProtectedFeature>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">קטגוריה</Label>
                      <Select onValueChange={(value) => handleInputChange('category', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר קטגוריה" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electronics">אלקטרוניקה</SelectItem>
                          <SelectItem value="clothing">ביגוד</SelectItem>
                          <SelectItem value="food">מזון</SelectItem>
                          <SelectItem value="accessories">אביזרים</SelectItem>
                          <SelectItem value="other">אחר</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="supplier">ספק</Label>
                      <Input
                        id="supplier"
                        value={formData.supplier}
                        onChange={(e) => handleInputChange('supplier', e.target.value)}
                        placeholder="שם הספק"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">תיאור</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="תיאור המוצר (אופציונלי)"
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="quantity">כמות *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange('quantity', e.target.value)}
                        placeholder="0"
                        required
                        min="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cost">עלות רכישה (₪)</Label>
                      <Input
                        id="cost"
                        type="number"
                        value={formData.cost}
                        onChange={(e) => handleInputChange('cost', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">מחיר מכירה (₪) *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location">מיקום במחסן</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        placeholder="למשל: מדף A1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="expirationDate">תאריך תפוגה</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        value={formData.expirationDate}
                        onChange={(e) => handleInputChange('expirationDate', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Product Image & Actions */}
            <div className="space-y-6">
              <ProtectedFeature requiredRole="pro_starter_user">
                <Card>
                  <CardHeader>
                    <CardTitle>תמונת מוצר</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Camera className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-600">לחץ להעלאת תמונה</p>
                      <p className="text-sm text-gray-400 mt-1">PNG, JPG עד 5MB</p>
                    </div>
                  </CardContent>
                </Card>
              </ProtectedFeature>

              <Card>
                <CardHeader>
                  <CardTitle>פעולות</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary-600">
                    <Save className="w-4 h-4 ml-2" />
                    שמור מוצר
                  </Button>
                  
                  <Button type="button" variant="outline" className="w-full">
                    <ArrowRight className="w-4 h-4 ml-2" />
                    שמור והוסף עוד
                  </Button>
                  
                  <Button type="button" variant="ghost" className="w-full">
                    ביטול
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card>
                <CardHeader>
                  <CardTitle>מידע מהיר</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><strong>רווח צפוי:</strong> {formData.price && formData.cost ? `₪${(parseFloat(formData.price) - parseFloat(formData.cost)).toFixed(2)}` : '₪0.00'}</p>
                    <p><strong>אחוז רווח:</strong> {formData.price && formData.cost && parseFloat(formData.cost) > 0 ? `${(((parseFloat(formData.price) - parseFloat(formData.cost)) / parseFloat(formData.cost)) * 100).toFixed(1)}%` : '0%'}</p>
                    <p><strong>ערך מלאי:</strong> {formData.quantity && formData.cost ? `₪${(parseFloat(formData.quantity) * parseFloat(formData.cost)).toFixed(2)}` : '₪0.00'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
};
