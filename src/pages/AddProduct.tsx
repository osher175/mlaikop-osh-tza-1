import React, { useState, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCategories } from '@/hooks/useCategories';
import { useBusiness } from '@/hooks/useBusiness';
import { useAuth } from '@/hooks/useAuth';
import { Package, Calendar as CalendarIcon, Camera, Upload, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { AddSupplierDialog } from '@/components/inventory/AddSupplierDialog';

export const AddProduct: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { business } = useBusiness();
  const { createProduct } = useProducts();
  const { suppliers } = useSuppliers();
  const { categories } = useCategories();

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    quantity: 0,
    price: 0,
    cost: 0,
    location: '',
    supplier_id: '',
    category_id: '',
    enable_whatsapp_supplier_notification: false,
    image: '',
  });

  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם מוצר",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id || !business?.id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להוסיף מוצר ללא זיהוי משתמש או עסק",
        variant: "destructive",
      });
      return;
    }

    try {
      await createProduct.mutateAsync({
        name: formData.name.trim(),
        barcode: formData.barcode || undefined,
        quantity: formData.quantity,
        price: formData.price || undefined,
        cost: formData.cost || undefined,
        location: formData.location || undefined,
        expiration_date: expirationDate ? format(expirationDate, 'yyyy-MM-dd') : undefined,
        supplier_id: formData.supplier_id || undefined,
        product_category_id: formData.category_id || undefined,
        enable_whatsapp_supplier_notification: formData.enable_whatsapp_supplier_notification,
        image: formData.image || undefined,
      });

      // Reset form
      setFormData({
        name: '',
        barcode: '',
        quantity: 0,
        price: 0,
        cost: 0,
        location: '',
        supplier_id: '',
        category_id: '',
        enable_whatsapp_supplier_notification: false,
        image: '',
      });
      setExpirationDate(undefined);

      toast({
        title: "מוצר נוסף בהצלחה",
        description: `המוצר "${formData.name}" נוסף למלאי`,
      });
    } catch (error) {
      console.error('Error creating product:', error);
    }
  };

  // Camera capture logic (useState, useRef, functions)
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleOpenCamera = () => {
    setShowCamera(true);
    startCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "שגיאה",
        description: "לא ניתן לגשת למצלמה. אנא ודא שנתת הרשאה לשימוש במצלמה.",
        variant: "destructive",
      });
    }
  };

  const handleCapture = () => {
    if (cameraRef.current && canvasRef.current) {
      const video = cameraRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        setFormData({ ...formData, image: dataUrl });
        stopCamera();
        setShowCamera(false);
      }
    }
  };

  const stopCamera = () => {
    if (cameraRef.current && cameraRef.current.srcObject) {
      const stream = cameraRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      cameraRef.current.srcObject = null;
    }
  };

  const handleCloseCamera = () => {
    stopCamera();
    setShowCamera(false);
  };

  const handleRemoveImage = () => {
    setCapturedImage(null);
    setFormData({ ...formData, image: '' });
  };

  // Image upload logic
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setCapturedImage(imageUrl);
        setFormData({ ...formData, image: imageUrl });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-turquoise" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">הוספת מוצר חדש</h1>
            <p className="text-gray-600">הוסף מוצר חדש למלאי העסק</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>פרטי המוצר</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">שם המוצר *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="הזן שם המוצר"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">ברקוד</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="סרוק או הזן ברקוד"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">כמות במלאי</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">מחיר מכירה (₪)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost">מחיר עלות (₪)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">מיקום במחסן</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="למשל: מדף A, קומה 2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>תאריך תפוגה</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-right font-normal",
                        !expirationDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {expirationDate ? format(expirationDate, "dd/MM/yyyy", { locale: he }) : "בחר תאריך תפוגה"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={setExpirationDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="supplier">ספק</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddSupplier(true)}
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      הוסף ספק
                    </Button>
                  </div>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="category">קטגוריה</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddCategory(true)}
                    >
                      <Plus className="w-4 h-4 ml-1" />
                      הוסף קטגוריה
                    </Button>
                  </div>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
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

              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label>תמונה</Label>
                {capturedImage ? (
                  <div className="relative">
                    <img src={capturedImage} alt="Captured" className="w-32 h-32 object-cover rounded-md" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-0 left-0"
                      onClick={handleRemoveImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleOpenCamera}>
                      <Camera className="w-4 h-4 ml-2" />
                      צלם תמונה
                    </Button>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      ref={fileInputRef}
                    />
                    <Button type="button" variant="outline" onClick={handleUploadButtonClick}>
                      <Upload className="w-4 h-4 ml-2" />
                      העלה תמונה
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="whatsapp-notification"
                  checked={formData.enable_whatsapp_supplier_notification}
                  onCheckedChange={(checked) => setFormData({ ...formData, enable_whatsapp_supplier_notification: checked })}
                />
                <Label htmlFor="whatsapp-notification">
                  שלח התרעת WhatsApp לספק כאשר המוצר אוזל
                </Label>
              </div>

              <div className="flex gap-4 pt-6">
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={createProduct.isPending}
                >
                  {createProduct.isPending ? 'שומר...' : 'הוסף מוצר'}
                </Button>
                <Button type="button" variant="outline">
                  ביטול
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <AddProductCategoryDialog
          open={showAddCategory}
          onOpenChange={setShowAddCategory}
          businessCategoryId={business?.business_category_id || 'default'}
        />

        <AddSupplierDialog
          open={showAddSupplier}
          onOpenChange={setShowAddSupplier}
        />
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>צלם תמונה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <video ref={cameraRef} autoPlay className="w-full aspect-video" />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="flex justify-between">
                <Button type="button" variant="secondary" onClick={handleCapture}>
                  צלם
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseCamera}>
                  ביטול
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
};
