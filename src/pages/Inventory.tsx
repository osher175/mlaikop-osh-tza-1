import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Package, Loader2 } from 'lucide-react';
import { EditProductDialog } from '@/components/inventory/EditProductDialog';
import { DeleteProductDialog } from '@/components/inventory/DeleteProductDialog';
import { ProductImageViewer } from '@/components/inventory/ProductImageViewer';
import { ExpirationAlertsPanel } from '@/components/inventory/ExpirationAlertsPanel';
import { InventoryHeader } from '@/components/inventory/InventoryHeader';
import { InventoryStats } from '@/components/inventory/InventoryStats';
import { InventoryFilters } from '@/components/inventory/InventoryFilters';
import { MobileSearchBar } from '@/components/inventory/MobileSearchBar';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useNavigate } from 'react-router-dom';

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [viewingProductImage, setViewingProductImage] = useState<Product | null>(null);
  const [activeStockFilter, setActiveStockFilter] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');
  const navigate = useNavigate();
  
  const { businessContext, isLoading: businessLoading } = useBusinessAccess();
  const { products, isLoading: productsLoading, refetch } = useProducts();

  const getStatusCounts = React.useMemo(() => {
    const inStock = products.filter(p => p.quantity > 5).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 5).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    
    return { inStock, lowStock, outOfStock };
  }, [products]);

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
  };

  const handleDeleteProduct = (product: Product) => {
    setDeletingProduct(product);
  };

  const handleViewProductImage = (product: Product) => {
    setViewingProductImage(product);
  };

  const handleProductUpdated = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleProductDeleted = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const { inStock, lowStock, outOfStock } = getStatusCounts;

  if (businessLoading || productsLoading) {
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
        {/* כותרת הדף */}
        <InventoryHeader
          businessName={businessContext.business_name}
          userRole={businessContext.user_role}
          isOwner={businessContext.is_owner}
        />

        {/* התראות תפוגה */}
        <ExpirationAlertsPanel />

        {/* שורת החיפוש החדשה - ממוקמת מתחת לכותרת ומעל הפילטרים */}
        <MobileSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* פילטרים - ללא החיפוש שעבר לקומפוננטה החדשה */}
        <InventoryFilters />

        {/* סטטיסטיקות המלאי */}
        <InventoryStats
          totalProducts={products.length}
          inStock={inStock}
          lowStock={lowStock}
          outOfStock={outOfStock}
          activeStockFilter={activeStockFilter}
          setActiveStockFilter={setActiveStockFilter}
        />

        {/* טבלת המוצרים */}
        <InventoryTable
          products={products}
          searchTerm={searchTerm}
          onEditProduct={handleEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onViewProductImage={handleViewProductImage}
          activeStockFilter={activeStockFilter}
        />

        {/* דיאלוגים */}
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
