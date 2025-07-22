import React, { useMemo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockZeroAlert } from './StockZeroAlert';
import { useStockZeroAlert } from '@/hooks/useStockZeroAlert';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
};

interface InventoryTableProps {
  products: Product[];
  searchTerm: string;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  products,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage,
  activeStockFilter,
}) => {
  const { alertProduct, showAlert, hideAlert, triggerSendToSupplier } = useStockZeroAlert();

  // Check for products that just went to zero stock
  useEffect(() => {
    const zeroStockProducts = products.filter(product => product.quantity === 0);
    
    // Show alert for the first zero stock product found
    // In a real implementation, you might want to track which products
    // have already shown alerts to avoid showing the same alert multiple times
    if (zeroStockProducts.length > 0 && !alertProduct) {
      const product = zeroStockProducts[0];
      showAlert({ id: product.id, name: product.name });
    }
  }, [products, alertProduct, showAlert]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.location?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply stock filter
    switch (activeStockFilter) {
      case 'inStock':
        filtered = filtered.filter(product => product.quantity > 5);
        break;
      case 'lowStock':
        filtered = filtered.filter(product => product.quantity > 0 && product.quantity <= 5);
        break;
      case 'outOfStock':
        filtered = filtered.filter(product => product.quantity === 0);
        break;
    }

    return filtered;
  }, [products, searchTerm, activeStockFilter]);

  const ProductRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const product = filteredProducts[index];
    
    const getStockStatus = (quantity: number) => {
      if (quantity === 0) return { status: 'אזל', color: 'bg-red-100 text-red-800' };
      if (quantity <= 5) return { status: 'נמוך', color: 'bg-yellow-100 text-yellow-800' };
      return { status: 'במלאי', color: 'bg-green-100 text-green-800' };
    };

    const stockInfo = getStockStatus(product.quantity);

    return (
      <div style={style} className="px-2">
        <Card className="p-4 mb-2 hover:shadow-md transition-shadow">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            <div className="md:col-span-2">
              <div className="font-medium text-gray-900">{product.name}</div>
              {product.barcode && (
                <div className="text-sm text-gray-500">ברקוד: {product.barcode}</div>
              )}
            </div>
            
            <div className="text-center">
              <Badge className={cn('text-xs', stockInfo.color)}>
                {stockInfo.status}
              </Badge>
              <div className="text-sm text-gray-600 mt-1">{product.quantity} יח'</div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">
                {product.product_categories?.name || 'ללא קטגוריה'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">
                {product.location || 'לא צוין'}
              </div>
            </div>
            
            <div className="flex justify-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditProduct(product)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              
              {product.image && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewProductImage(product)}
                  className="h-8 w-8 p-0"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDeleteProduct(product)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  if (filteredProducts.length === 0) {
    return (
      <>
        <div className="text-center py-12" dir="rtl">
          <div className="text-gray-500 mb-2">לא נמצאו מוצרים</div>
          <div className="text-sm text-gray-400">נסה לשנות את הפילטרים או הוסף מוצרים חדשים</div>
        </div>
        
        <StockZeroAlert
          open={!!alertProduct}
          onOpenChange={hideAlert}
          productName={alertProduct?.name || ''}
          productId={alertProduct?.id || ''}
          onConfirm={() => triggerSendToSupplier(alertProduct?.id || '')}
        />
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-gray-50 border-b font-medium text-sm text-gray-700">
          <div className="md:col-span-2">מוצר</div>
          <div className="text-center">מלאי</div>
          <div className="text-center">קטגוריה</div>
          <div className="text-center">מיקום</div>
          <div className="text-center">פעולות</div>
        </div>
        
        <div className="h-[500px]">
          <List
            height={500}
            itemCount={filteredProducts.length}
            itemSize={120}
            className="scrollbar-thin"
          >
            {ProductRow}
          </List>
        </div>
      </Card>
      
      <StockZeroAlert
        open={!!alertProduct}
        onOpenChange={hideAlert}
        productName={alertProduct?.name || ''}
        productId={alertProduct?.id || ''}
        onConfirm={() => triggerSendToSupplier(alertProduct?.id || '')}
      />
    </>
  );
};
