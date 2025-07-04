
import React, { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Package, Loader2 } from 'lucide-react';
import { EditProductDialog } from '@/components/inventory/EditProductDialog';
import { DeleteProductDialog } from '@/components/inventory/DeleteProductDialog';
import { ProductImageViewer } from '@/components/inventory/ProductImageViewer';
import { ExpirationAlertsPanel } from '@/components/inventory/ExpirationAlertsPanel';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { InventoryStats } from '@/components/inventory/InventoryStats';
import { MobileSearchBar } from '@/components/inventory/MobileSearchBar';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import { useOptimizedProducts } from '@/hooks/useOptimizedProducts';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/use-debounce';

export const OptimizedInventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProduct, setDeletingProduct] = useState<any>(null);
  const [viewingProductImage, setViewingProductImage] = useState<any>(null);
  const [activeStockFilter, setActiveStockFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');
  const navigate = useNavigate();
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { businessContext, isLoading: businessLoading } = useBusinessAccess();
  const { products, isLoading: productsLoading, refetch } = useOptimizedProducts(debouncedSearchTerm, 100);

  const getStatusCounts = useMemo(() => {
    const inStock = products.filter(p => p.stock_status === 'in_stock').length;
    const lowStock = products.filter(p => p.stock_status === 'low_stock').length;
    const outOfStock = products.filter(p => p.stock_status === 'out_of_stock').length;
    
    return { inStock, lowStock, outOfStock };
  }, [products]);

  const handleProductUpdated = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleProductDeleted = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const { inStock, lowStock, outOfStock } = getStatusCounts;

  if (businessLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!businessContext) {
    return (
      <MainLayout>
        <div className="text-center py-12" dir="rtl">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            לא נמצא עסק מקושר
          </h2>
          <p className="text-gray-600 mb-6">
            אנא וודא שהצטרפת לעסק או יצרת עסק חדש
          </p>
          <Button onClick={() => navigate('/onboarding')}>
            חזור להגדרת העסק
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4" dir="rtl">
        <InventoryHeader
          businessName={businessContext.business_name}
          userRole={businessContext.user_role}
          isOwner={businessContext.is_owner}
        />

        <ExpirationAlertsPanel />

        <MobileSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <InventoryStats
          totalProducts={products.length}
          inStock={inStock}
          lowStock={lowStock}
          outOfStock={outOfStock}
          activeStockFilter={activeStockFilter}
          setActiveStockFilter={setActiveStockFilter}
        />

        {productsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <VirtualizedInventoryTable
            products={products}
            searchTerm={debouncedSearchTerm}
            onEditProduct={setEditingProduct}
            onDeleteProduct={setDeletingProduct}
            onViewProductImage={setViewingProductImage}
            activeStockFilter={activeStockFilter}
          />
        )}

        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onProductUpdated={handleProductUpdated}
        />

        <DeleteProductDialog
          product={deletingProduct}
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          onProductDeleted={handleProductDeleted}
        />

        <ProductImageViewer
          product={viewingProductImage}
          open={!!viewingProductImage}
          onOpenChange={(open) => !open && setViewingProductImage(null)}
        />
      </div>
    </MainLayout>
  );
};
