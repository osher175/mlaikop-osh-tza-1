
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Edit, Trash2, AlertTriangle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { LazyImage } from '@/components/inventory/LazyImage';
import { StockApprovalDialog } from '@/components/inventory/StockApprovalDialog';
import { useStockApprovals } from '@/hooks/useStockApprovals';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  product_thresholds?: { low_stock_threshold: number } | null;
};

interface InventoryTableProps {
  products: Product[];
  searchTerm: string;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewProductImage: (product: Product) => void;
  activeStockFilter: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
}

export const InventoryTable: React.FC<InventoryTableProps> = React.memo(({
  products,
  searchTerm,
  onEditProduct,
  onDeleteProduct,
  onViewProductImage,
  activeStockFilter,
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { businessContext } = useBusinessAccess();
  const { approveStock, isApproving, canSendToSupplier } = useStockApprovals();

  // Only show approval button for business owners
  const canApproveStock = businessContext?.is_owner;

  const getStatusBadge = (product: Product) => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    
    if (quantity === 0) {
      return <Badge className="bg-red-500 text-white text-xs">אזל</Badge>;
    } else if (quantity <= threshold && quantity > 0) {
      return <Badge className="bg-yellow-500 text-white flex items-center gap-1 text-xs">
        <AlertTriangle className="w-3 h-3" />
        נמוך
      </Badge>;
    } else {
      return <Badge className="bg-green-500 text-white text-xs">במלאי</Badge>;
    }
  };

  const isLowStock = (product: Product) => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    return quantity > 0 && quantity <= threshold;
  };

  const getCategoryName = (product: Product) => {
    return product.product_categories?.name || '-';
  };

  // Filter products by search term first
  const searchFilteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.barcode && product.barcode.includes(searchTerm)) ||
    (product.location && product.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Then filter by stock status
  const filteredProducts = searchFilteredProducts.filter(product => {
    const quantity = product.quantity;
    const threshold = product.product_thresholds?.low_stock_threshold || 5;
    
    switch (activeStockFilter) {
      case 'inStock':
        return quantity > threshold;
      case 'lowStock':
        return quantity > 0 && quantity <= threshold;
      case 'outOfStock':
        return quantity === 0;
      case 'all':
      default:
        return true;
    }
  });

  const getFilterTitle = () => {
    switch (activeStockFilter) {
      case 'inStock':
        return 'מוצרים במלאי';
      case 'lowStock':
        return 'מוצרים במלאי נמוך';
      case 'outOfStock':
        return 'מוצרים שאזלו';
      case 'all':
      default:
        return 'רשימת מוצרים';
    }
  };

  // Mobile optimized card view
  if (isMobile) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">{getFilterTitle()} ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4 text-sm md:text-base">
                {searchTerm || activeStockFilter !== 'all' 
                  ? 'לא נמצאו מוצרים מתאימים' 
                  : 'עדיין לא נוספו מוצרים'}
              </p>
              {!searchTerm && activeStockFilter === 'all' && (
                <Button 
                  className="w-full h-12 min-h-[44px] text-base md:text-lg" 
                  onClick={() => navigate('/add-product')}
                >
                  הוסף מוצר ראשון
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3 max-h-[60vh] overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card 
                  key={product.id} 
                  className={`${isLowStock(product) ? 'border-l-4 border-l-yellow-500 shadow-sm' : 'shadow-sm'}`}
                >
                  <CardContent className="p-2 md:p-3">
                    <div className="flex items-start gap-2 md:gap-3 mb-2 md:mb-3">
                      <LazyImage
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 md:w-12 md:h-12 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity flex-shrink-0"
                        onClick={() => onViewProductImage(product)}
                        title="לחץ לצפייה בתמונה מוגדלת"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-600 truncate">
                          {getCategoryName(product)}
                        </p>
                        {product.barcode && (
                          <p className="text-xs md:text-sm text-gray-500 truncate">
                            {product.barcode}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(product)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 md:gap-2 text-xs md:text-sm mb-2 md:mb-3">
                      <div className="truncate">
                        <span className="text-gray-600">כמות: </span>
                        <span className="font-medium">{product.quantity}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">מחיר: </span>
                        <span className="font-medium">₪{product.price || '-'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">מיקום: </span>
                        <span className="font-medium">{product.location || '-'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-gray-600">עלות: </span>
                        <span className="font-medium">₪{product.cost || '-'}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 md:gap-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onEditProduct(product)}
                        className="flex-1 h-10 min-h-[44px] text-base md:text-lg"
                        title="ערוך מוצר"
                      >
                        <Edit className="w-4 h-4 ml-1" />
                        ערוך
                      </Button>
                      
                      {/* Show approve button only for out of stock products that can be sent to supplier */}
                      {canApproveStock && product.quantity === 0 && canSendToSupplier(product.id) && (
                        <StockApprovalDialog
                          productName={product.name}
                          productId={product.id}
                          onApprove={(productId) => approveStock({ productId, productName: product.name })}
                          isApproving={isApproving}
                        >
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-blue-600 hover:text-blue-700 h-10 min-h-[44px] px-2 text-base md:text-lg"
                            title="שלח לספק"
                          >
                            <Send className="w-4 h-4 ml-1" />
                            שלח לספק
                          </Button>
                        </StockApprovalDialog>
                      )}
                      
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 h-10 min-h-[44px] px-2 text-base md:text-lg"
                        onClick={() => onDeleteProduct(product)}
                        title="מחק מוצר"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Desktop table view - optimized
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{getFilterTitle()} ({filteredProducts.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm || activeStockFilter !== 'all' 
                ? 'לא נמצאו מוצרים מתאימים' 
                : 'עדיין לא נוספו מוצרים'}
            </p>
            {!searchTerm && activeStockFilter === 'all' && (
              <Button 
                className="mt-4" 
                onClick={() => navigate('/add-product')}
              >
                הוסף מוצר ראשון
              </Button>
            )}
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[900px]">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b">
                  <th className="text-right p-3 font-medium text-sm min-w-[60px]">תמונה</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[150px]">שם המוצר</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[120px] hidden md:table-cell">ברקוד</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[120px]">קטגוריה</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[80px]">כמות</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[100px]">מחיר</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[120px] hidden md:table-cell">מיקום</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[100px]">סטטוס</th>
                  <th className="text-right p-3 font-medium text-sm min-w-[150px]">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      isLowStock(product) ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : ''
                    }`}
                  >
                    <td className="p-3 min-w-[60px]">
                      <LazyImage
                        src={product.image}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-75 transition-opacity"
                        onClick={() => onViewProductImage(product)}
                        title="לחץ לצפייה בתמונה מוגדלת"
                      />
                    </td>
                    <td className="p-3 font-medium text-sm max-w-[150px] min-w-[150px] truncate">
                      {isLowStock(product) && <AlertTriangle className="w-4 h-4 text-yellow-600 inline ml-2" />}
                      {product.name}
                    </td>
                    <td className="p-3 text-gray-600 text-sm max-w-[100px] min-w-[120px] truncate hidden md:table-cell">{product.barcode || '-'}</td>
                    <td className="p-3 text-gray-600 text-sm max-w-[100px] min-w-[120px] truncate">{getCategoryName(product)}</td>
                    <td className="p-3 font-medium text-sm min-w-[80px]">{product.quantity}</td>
                    <td className="p-3 text-sm min-w-[100px]">₪{product.price || '-'}</td>
                    <td className="p-3 text-sm max-w-[100px] min-w-[120px] truncate hidden md:table-cell">{product.location || '-'}</td>
                    <td className="p-3 min-w-[100px]">{getStatusBadge(product)}</td>
                    <td className="p-3 min-w-[150px]">
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onEditProduct(product)}
                          title="ערוך מוצר"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        
                        {/* Show approve button only for out of stock products that can be sent to supplier */}
                        {canApproveStock && product.quantity === 0 && canSendToSupplier(product.id) && (
                          <StockApprovalDialog
                            productName={product.name}
                            productId={product.id}
                            onApprove={(productId) => approveStock({ productId, productName: product.name })}
                            isApproving={isApproving}
                          >
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-blue-600 hover:text-blue-700 h-7 w-7 p-0"
                              title="שלח לספק"
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                          </StockApprovalDialog>
                        )}
                        
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                          onClick={() => onDeleteProduct(product)}
                          title="מחק מוצר"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

InventoryTable.displayName = 'InventoryTable';
