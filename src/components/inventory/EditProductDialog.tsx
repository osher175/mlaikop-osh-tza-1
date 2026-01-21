
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUpload } from '@/components/ui/image-upload';
import { BarcodeScanner } from '@/components/ui/barcode-scanner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { AddProductCategoryDialog } from '@/components/inventory/AddProductCategoryDialog';
import { SaleModal, SaleData } from '@/components/inventory/SaleModal';
import { PurchaseModal, PurchaseData } from '@/components/inventory/PurchaseModal';
import { Plus, Scan } from 'lucide-react';
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
  const { user } = useAuth();
  const { categories } = useCategories();
  const [loading, setLoading] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  // Modal states for sale/purchase
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [pendingQuantityDelta, setPendingQuantityDelta] = useState(0);
  
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
    low_stock_threshold: 5,
    enable_whatsapp_supplier_notification: product?.enable_whatsapp_supplier_notification || false,
  });

  React.useEffect(() => {
    if (product) {
      // Fetch threshold from product_thresholds table
      const fetchThreshold = async () => {
        const { data: thresholdData } = await supabase
          .from('product_thresholds')
          .select('low_stock_threshold')
          .eq('product_id', product.id)
          .single();

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
          low_stock_threshold: thresholdData?.low_stock_threshold || 5,
          enable_whatsapp_supplier_notification: product.enable_whatsapp_supplier_notification || false,
        });
      };

      fetchThreshold();
    }
  }, [product]);

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
    if (!product || !business?.id) return;

    const oldQuantity = product.quantity || 0;
    const newQuantity = formData.quantity;
    const quantityDiff = newQuantity - oldQuantity;

    // If quantity changed, open appropriate modal
    if (quantityDiff < 0) {
      // Sale - quantity decreased
      setPendingQuantityDelta(quantityDiff);
      setShowSaleModal(true);
      return;
    } else if (quantityDiff > 0) {
      // Purchase - quantity increased
      setPendingQuantityDelta(quantityDiff);
      setShowPurchaseModal(true);
      return;
    }

    // No quantity change - save normally
    await saveProduct();
  };

  const saveProduct = async (saleData?: SaleData, purchaseData?: PurchaseData) => {
    if (!product || !business?.id || !user?.id) return;

    setLoading(true);
    console.log('Starting product update with data:', formData);
    
    try {
      const oldQuantity = product.quantity || 0;
      const newQuantity = formData.quantity;
      const quantityDiff = newQuantity - oldQuantity;

      // Update product data
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
        enable_whatsapp_supplier_notification: formData.enable_whatsapp_supplier_notification,
        updated_at: new Date().toISOString(),
      };

      // If purchase, update cost to new rolling average
      if (purchaseData && quantityDiff > 0) {
        const oldCost = Number(product.cost) || 0;
        const newCost = ((oldQuantity * oldCost) + (quantityDiff * purchaseData.purchaseUnitIls)) / (oldQuantity + quantityDiff);
        updateData.cost = newCost;
      }

      console.log('Updating product with data:', updateData);

      const { error: productError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (productError) {
        console.error('Product update error:', productError);
        throw productError;
      }

      console.log('Product updated successfully, now updating threshold:', formData.low_stock_threshold);

      // Update or insert threshold
      const { error: thresholdError } = await supabase
        .from('product_thresholds')
        .upsert({
          product_id: product.id,
          business_id: business.id,
          low_stock_threshold: formData.low_stock_threshold,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'product_id'
        });

      if (thresholdError) {
        console.error('Threshold update error:', thresholdError);
        toast({
          title: "אזהרה",
          description: "המוצר עודכן אך לא ניתן היה לשמור את סף המלאי הנמוך",
          variant: "destructive",
        });
      }

      // Log inventory action with financial data
      if (quantityDiff !== 0) {
        if (saleData && quantityDiff < 0) {
          // Sale action
          const absQuantity = Math.abs(quantityDiff);
          const listUnitPrice = Number(product.price) || 0;
          const costSnapshot = Number(product.cost) || 0;
          const listTotal = listUnitPrice * absQuantity;
          const discountIls = listTotal - saleData.saleTotalIls;
          const discountPercent = listTotal > 0 ? (discountIls / listTotal) * 100 : 0;

          const { error: actionError } = await supabase
            .from('inventory_actions')
            .insert({
              business_id: business.id,
              user_id: user.id,
              product_id: product.id,
              action_type: 'sale',
              quantity_changed: quantityDiff, // negative
              currency: 'ILS',
              sale_total_ils: saleData.saleTotalIls,
              sale_unit_ils: saleData.saleTotalIls / absQuantity,
              list_unit_ils: listUnitPrice,
              cost_snapshot_ils: costSnapshot,
              discount_ils: discountIls > 0 ? discountIls : 0,
              discount_percent: discountPercent > 0 ? discountPercent : 0,
              notes: saleData.notes || `מכירה של ${absQuantity} יחידות`,
              timestamp: new Date().toISOString(),
            });

          if (actionError) {
            console.error('Error logging sale action:', actionError);
            throw actionError;
          }
        } else if (purchaseData && quantityDiff > 0) {
          // Purchase action
          const { error: actionError } = await supabase
            .from('inventory_actions')
            .insert({
              business_id: business.id,
              user_id: user.id,
              product_id: product.id,
              action_type: 'purchase',
              quantity_changed: quantityDiff, // positive
              currency: 'ILS',
              purchase_unit_ils: purchaseData.purchaseUnitIls,
              purchase_total_ils: purchaseData.purchaseTotalIls,
              supplier_id: purchaseData.supplierId || null,
              notes: purchaseData.notes || `קנייה של ${quantityDiff} יחידות`,
              timestamp: new Date().toISOString(),
            });

          if (actionError) {
            console.error('Error logging purchase action:', actionError);
            throw actionError;
          }
        }
      }

      toast({
        title: "מוצר עודכן בהצלחה",
        description: quantityDiff !== 0 
          ? quantityDiff < 0 
            ? `נרשמה מכירה של ${Math.abs(quantityDiff)} יחידות`
            : `נרשמה קנייה של ${quantityDiff} יחידות`
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

  const handleSaleConfirm = (data: SaleData) => {
    setShowSaleModal(false);
    saveProduct(data, undefined);
  };

  const handlePurchaseConfirm = (data: PurchaseData) => {
    setShowPurchaseModal(false);
    saveProduct(undefined, data);
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
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-4 sm:p-6" dir="rtl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg sm:text-xl">עריכת מוצר - {product?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">שם המוצר *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1 h-10"
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
                      className="flex-1 h-10"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBarcodeScanner(true)}
                      className="h-10 px-3 min-w-[44px]"
                      title="סרוק ברקוד"
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
                      <SelectTrigger className="flex-1 h-10">
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
                        className="h-10 px-3 min-w-[44px]"
                        title="הוסף קטגוריה"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity" className="text-sm font-medium">כמות *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      required
                      className="mt-1 h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="low_stock_threshold" className="text-sm font-medium">סף מלאי נמוך</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      value={formData.low_stock_threshold}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        console.log('Setting low_stock_threshold to:', value);
                        setFormData({ ...formData, low_stock_threshold: value });
                      }}
                      className="mt-1 h-10"
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
                    className="mt-1 h-10"
                    placeholder="מדף, אזור, וכו'"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost" className="text-sm font-medium">עלות (₪)</Label>
                    <Input
                      id="cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                      className="mt-1 h-10"
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
                      className="mt-1 h-10"
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
                    className="mt-1 h-10"
                  />
                </div>

                {/* WhatsApp Supplier Notification Toggle */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="whatsapp_notification" className="text-sm font-medium">
                      בקש הצעת מחיר אוטומטית מהספק
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
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
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <ImageUpload
                      currentImageUrl={formData.image}
                      onImageUpload={handleImageUpload}
                      onImageRemove={handleImageRemove}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1 h-12 text-base font-medium"
              >
                {loading ? 'שומר...' : 'שמור שינויים'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 text-base"
              >
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeScanned={handleBarcodeScanned}
      />

      {/* Add Category Dialog */}
      {business?.business_category_id && (
        <AddProductCategoryDialog
          open={showAddCategory}
          onOpenChange={setShowAddCategory}
          businessCategoryId={business.business_category_id}
        />
      )}

      {/* Sale Modal - when quantity decreased */}
      {product && (
        <SaleModal
          open={showSaleModal}
          onOpenChange={(open) => {
            setShowSaleModal(open);
            if (!open) {
              // Reset quantity if user cancels
              setFormData(prev => ({ ...prev, quantity: product.quantity || 0 }));
            }
          }}
          onConfirm={handleSaleConfirm}
          quantitySold={Math.abs(pendingQuantityDelta)}
          productName={product.name}
          listPrice={Number(product.price) || 0}
          costPrice={Number(product.cost) || 0}
          isLoading={loading}
        />
      )}

      {/* Purchase Modal - when quantity increased */}
      {product && (
        <PurchaseModal
          open={showPurchaseModal}
          onOpenChange={(open) => {
            setShowPurchaseModal(open);
            if (!open) {
              // Reset quantity if user cancels
              setFormData(prev => ({ ...prev, quantity: product.quantity || 0 }));
            }
          }}
          onConfirm={handlePurchaseConfirm}
          quantityAdded={pendingQuantityDelta}
          productName={product.name}
          currentCost={Number(product.cost) || 0}
          currentQuantity={product.quantity || 0}
          defaultSupplierId={product.supplier_id}
          isLoading={loading}
        />
      )}
    </>
  );
};
