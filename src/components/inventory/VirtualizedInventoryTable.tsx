import React, { useMemo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockZeroAlert } from './StockZeroAlert';
import { useStockZeroAlert } from '@/hooks/useStockZeroAlert';

interface OptimizedProduct {
  id: string;
  name: string;
  barcode: string | null;
  quantity: number;
  location: string | null;
  expiration_date: string | null;
  price: number | null;
  cost: number | null;
  category_name: string | null;
  supplier_name: string | null;
  stock_status: string;
  search_rank: number;
}

interface VirtualizedInventoryTableProps {
  products: OptimizedProduct[];
  searchTerm: string;
  onEditProduct: (product: any) => void;
  onDeleteProduct: (product: any) => void;
  onViewProductImage: (product: any) => void;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
}

export const VirtualizedInventoryTable: React.FC<VirtualizedInventoryTableProps> = ({
  products,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage,
  activeStockFilter,
}) => {
  const { alertProduct, hideAlert, triggerSendToSupplier, checkForStockChanges } = useStockZeroAlert();

  // Check for stock changes (not just zero stock products)
  useEffect(() => {
    checkForStockChanges(products);
  }, [products, checkForStockChanges]);

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
        filtered = filtered.filter(product => product.stock_status === 'in_stock');
        break;
      case 'lowStock':
        filtered = filtered.filter(product => product.stock_status === 'low_stock');
        break;
      case 'outOfStock':
        filtered = filtered.filter(product => product.stock_status === 'out_of_stock');
        break;
    }

    return filtered.sort((a, b) => b.search_rank - a.search_rank);
  }, [products, searchTerm, activeStockFilter]);

  const ProductRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const product = filteredProducts[index];
    
    const getStockBadge = (stockStatus: string, quantity: number) => {
      switch (stockStatus) {
        case 'out_of_stock':
          return { status: 'אזל', color: 'bg-red-100 text-red-800' };
        case 'low_stock':
          return { status: 'נמוך', color: 'bg-yellow-100 text-yellow-800' };
        case 'in_stock':
          return { status: 'במלאי', color: 'bg-green-100 text-green-800' };
        default:
          return { status: 'לא ידוע', color: 'bg-gray-100 text-gray-800' };
      }
    };

    const stockInfo = getStockBadge(product.stock_status, product.quantity);

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
                {product.category_name || 'ללא קטגוריה'}
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
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewProductImage(product)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
              
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
            width="100%"
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
