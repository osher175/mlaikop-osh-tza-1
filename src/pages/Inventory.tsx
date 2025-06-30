
import React, { useState, useCallback } from 'react';
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
import { OptimizedSearchBar } from '@/components/inventory/OptimizedSearchBar';
import { OptimizedInventoryTable } from '@/components/inventory/OptimizedInventoryTable';
import { useProductSearch } from '@/hooks/useProductSearch';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
};

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [viewingProductImage, setViewingProductImage] = useState<Product | null>(null);
  const navigate = useNavigate();
  
  const { businessContext, isLoading: businessLoading } = useBusinessAccess();
  const { products, isLoading: searchLoading, error, isEmpty } = useProductSearch(searchTerm);

  const getStatusCounts = React.useMemo(() => {
    const inStock = products.filter(p => p.quantity > 5).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 5).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    
    return { inStock, lowStock, outOfStock };
  }, [products]);

  const { inStock, lowStock, outOfStock } = getStatusCounts;

  // Retry search functionality
  const handleRetrySearch = useCallback(() => {
    console.log('Retrying search...');
    // Force a re-search by clearing and setting the search term again
    const currentTerm = searchTerm;
    setSearchTerm('');
    setTimeout(() => {
      setSearchTerm(currentTerm);
    }, 100);
  }, [searchTerm]);

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
        {/* כותרת הדף */}
        <InventoryHeader
          businessName={businessContext.business_name}
          userRole={businessContext.user_role}
          isOwner={businessContext.is_owner}
        />

        {/* התראות תפוגה */}
        <ExpirationAlertsPanel />

        {/* שורת החיפוש המאופטמת */}
        <OptimizedSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isLoading={searchLoading}
        />

        {/* פילטרים */}
        <InventoryFilters />

        {/* סטטיסטיקות המלאי */}
        <InventoryStats
          totalProducts={products.length}
          inStock={inStock}
          lowStock={lowStock}
          outOfStock={outOfStock}
        />

        {/* טבלת המוצרים המאופטמת */}
        <OptimizedInventoryTable
          products={products}
          isLoading={searchLoading}
          isEmpty={isEmpty}
          hasError={!!error}
          searchTerm={searchTerm}
          error={error}
          onEditProduct={setEditingProduct}
          onDeleteProduct={setDeletingProduct}
          onViewProductImage={setViewingProductImage}
          onRetrySearch={handleRetrySearch}
        />

        {/* דיאלוגים */}
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onProductUpdated={() => {
            // הרענון יתבצע אוטומטית דרך useProductSearch
          }}
        />

        <DeleteProductDialog
          product={deletingProduct}
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          onProductDeleted={() => {
            // הרענון יתבצע אוטומטית דרך useProductSearch
          }}
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
