import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [pendingQuantityDiff, setPendingQuantityDiff] = useState(0);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  
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
  });

  React.useEffect(() => {
    if (product) {
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

    // If quantity changed, show appropriate modal
    if (quantityDiff < 0) {
      // Quantity decreased - this is a SALE (action_type = 'remove')
      setPendingQuantityDiff(quantityDiff);
      setPendingFormData({ ...formData });
      setShowSaleModal(true);
      return;
    } else if (quantityDiff > 0) {
      // Quantity increased - this is a PURCHASE (action_type = 'add')
      setPendingQuantityDiff(quantityDiff);
      setPendingFormData({ ...formData });
      setShowPurchaseModal(true);
      return;
    }

    // No quantity change - just update product data
    await saveProductUpdate(formData);
  };

  const handleSaleConfirm = async (saleData: SaleData) => {
    if (!product || !business?.id || !user?.id || !pendingFormData) return;

    setLoading(true);
    try {
      const quantitySold = Math.abs(pendingQuantityDiff);
      const listPrice = product.price || 0;
      const costPrice = product.cost || 0;
      const listTotal = listPrice * quantitySold;
      const discountIls = listTotal - saleData.saleTotalIls;
      const discountPercent = listTotal > 0 ? (discountIls / listTotal) * 100 : 0;

      // STEP 1: Insert inventory_actions FIRST (action_type = 'remove' for sales)
      const { error: actionError } = await supabase
        .from('inventory_actions')
        .insert({
          product_id: product.id,
          business_id: business.id,
          user_id: user.id,
          action_type: 'remove', // Using existing 'remove' value for sales
          quantity_changed: -quantitySold, // Negative for removal
          currency: 'ILS',
          sale_total_ils: saleData.saleTotalIls,
          sale_unit_ils: saleData.saleTotalIls / quantitySold,
          list_unit_ils: listPrice,
          discount_ils: discountIls > 0 ? discountIls : null,
          discount_percent: discountPercent > 0 ? discountPercent : null,
          cost_snapshot_ils: costPrice,
          notes: saleData.notes || `מכירה של ${quantitySold} יחידות`,
          timestamp: new Date().toISOString(),
        });

      if (actionError) {
        console.error('Error logging sale action:', actionError);
        throw actionError;
      }

      // STEP 2: Only update product AFTER successful inventory_actions insert
      await saveProductUpdate(pendingFormData);
      
      setShowSaleModal(false);
      setPendingFormData(null);
      setPendingQuantityDiff(0);
    } catch (error) {
      console.error('Error processing sale:', error);
      toast({
        title: "שגיאה ברישום המכירה",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseConfirm = async (purchaseData: PurchaseData) => {
    if (!product || !business?.id || !user?.id || !pendingFormData) return;

    setLoading(true);
    try {
      const quantityAdded = pendingQuantityDiff;
      const oldQuantity = product.quantity || 0;
      const oldCost = product.cost || 0;

      // Calculate rolling average cost
      const newAverageCost = oldQuantity + quantityAdded > 0
        ? ((oldQuantity * oldCost) + (quantityAdded * purchaseData.purchaseUnitIls)) / (oldQuantity + quantityAdded)
        : purchaseData.purchaseUnitIls;

      // STEP 1: Insert inventory_actions FIRST (action_type = 'add' for purchases)
      const { error: actionError } = await supabase
        .from('inventory_actions')
        .insert({
          product_id: product.id,
          business_id: business.id,
          user_id: user.id,
          action_type: 'add', // Using existing 'add' value for purchases
          quantity_changed: quantityAdded, // Positive for addition
          currency: 'ILS',
          purchase_unit_ils: purchaseData.purchaseUnitIls,
          purchase_total_ils: purchaseData.purchaseTotalIls,
          supplier_id: purchaseData.supplierId || null,
          notes: purchaseData.notes || `קנייה של ${quantityAdded} יחידות`,
          timestamp: new Date().toISOString(),
        });

      if (actionError) {
        console.error('Error logging purchase action:', actionError);
        throw actionError;
      }

      // STEP 2: Only update product AFTER successful inventory_actions insert
      // Update cost to rolling average
      const updatedFormData = {
        ...pendingFormData,
        cost: newAverageCost,
      };
      await saveProductUpdate(updatedFormData);
      
      setShowPurchaseModal(false);
      setPendingFormData(null);
      setPendingQuantityDiff(0);
    } catch (error) {
      console.error('Error processing purchase:', error);
      toast({
        title: "שגיאה ברישום הקנייה",
        description: "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProductUpdate = async (data: typeof formData) => {
    if (!product || !business?.id) return;

    setLoading(true);
    try {
      const updateData: any = {
        name: data.name,
        barcode: data.barcode || null,
        quantity: data.quantity,
        price: data.price || null,
        cost: data.cost || null,
        location: data.location || null,
        expiration_date: data.expiration_date || null,
        image: data.image || null,
        product_category_id: data.product_category_id || null,
        updated_at: new Date().toISOString(),
      };

      const { error: productError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', product.id);

      if (productError) throw productError;

      // Update or insert threshold
      if (product.id) {
        const response = await supabase
          .from('product_thresholds')
          .upsert(
            {
              product_id: product.id,
              business_id: business.id,
              low_stock_threshold: data.low_stock_threshold,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: ['product_id']
            }
          );
        if (response.error) {
          console.error('Threshold update error:', response.error);
        }
      }

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
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: Number(e.target.value) })}
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

      {/* Sale Modal - for quantity decrease (action_type = 'remove') */}
      <SaleModal
        open={showSaleModal}
        onOpenChange={(open) => {
          setShowSaleModal(open);
          if (!open) {
            setPendingFormData(null);
            setPendingQuantityDiff(0);
          }
        }}
        onConfirm={handleSaleConfirm}
        quantitySold={Math.abs(pendingQuantityDiff)}
        productName={product?.name || ''}
        listPrice={product?.price || 0}
        costPrice={product?.cost || 0}
        isLoading={loading}
      />

      {/* Purchase Modal - for quantity increase (action_type = 'add') */}
      <PurchaseModal
        open={showPurchaseModal}
        onOpenChange={(open) => {
          setShowPurchaseModal(open);
          if (!open) {
            setPendingFormData(null);
            setPendingQuantityDiff(0);
          }
        }}
        onConfirm={handlePurchaseConfirm}
        quantityAdded={pendingQuantityDiff}
        productName={product?.name || ''}
        currentCost={product?.cost || 0}
        currentQuantity={product?.quantity || 0}
        defaultSupplierId={product?.supplier_id}
        isLoading={loading}
      />
    </>
  );
};
