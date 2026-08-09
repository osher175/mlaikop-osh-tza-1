
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
import { MobileSearchBar } from '@/components/inventory/MobileSearchBar';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { UndoActionBanner } from '@/components/inventory/UndoActionBanner';
import { useInventoryProductsPage, useInventoryStockCounts, type StockFilter } from '@/hooks/useInventoryProductsPage';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/use-debounce';
import type { Database } from '@/integrations/supabase/types';

// Use the database type directly - this matches what useProducts returns
type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  product_thresholds?: { low_stock_threshold: number } | null;
};

export const Inventory: React.FC = () => {
  const PAGE_SIZE = 50;

  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [viewingProductImage, setViewingProductImage] = useState<Product | null>(null);
  const [activeStockFilter, setActiveStockFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Keep typing instant while the server-side query runs debounced
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { businessContext, isLoading: businessLoading } = useBusinessAccess();

  // Phase A5.1 — bounded server-side page (search + filter + ordering in Postgres)
  const {
    products,
    total: matchingCount,
    isLoading: productsLoading,
    isFetching,
    refetch,
  } = useInventoryProductsPage(debouncedSearchTerm, activeStockFilter, page, PAGE_SIZE);

  // Global counters over the whole catalog (never derived from the loaded page)
  const { counts, refetch: refetchCounts } = useInventoryStockCounts();

  // Reset to the first page whenever the query changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, activeStockFilter]);

  const handleProductUpdated = React.useCallback(() => {
    refetch();
    refetchCounts();
  }, [refetch, refetchCounts]);

  const handleProductDeleted = React.useCallback(() => {
    refetch();
    refetchCounts();
  }, [refetch, refetchCounts]);

  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const { inStock, lowStock, outOfStock, totalUnits, total: totalProducts } = counts;


  // Only block render when we have no data at all. Otherwise show cached data while refetching.
  if ((businessLoading || productsLoading) && products.length === 0 && page === 1 && !debouncedSearchTerm) {
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
          exportContext={{
            businessId: businessContext.business_id,
            search: debouncedSearchTerm,
            stockFilter: activeStockFilter,
            matchingCount,
          }}
        />

        {/* התראות תפוגה */}
        <ExpirationAlertsPanel />

        {/* שורת החיפוש */}
        <MobileSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        {/* סטטיסטיקות המלאי */}
        <InventoryStats
          totalProducts={totalProducts}
          totalUnits={totalUnits}
          inStock={inStock}
          lowStock={lowStock}
          outOfStock={outOfStock}
          activeStockFilter={activeStockFilter}
          setActiveStockFilter={setActiveStockFilter}
        />

        {/* טבלת המוצרים — מקבלת רשימה שכבר סוננה (מעבר סינון יחיד) */}
        <InventoryTable
          products={products as unknown as Product[]}
          searchTerm={debouncedSearchTerm}
          onEditProduct={setEditingProduct}
          onDeleteProduct={setDeletingProduct}
          onViewProductImage={setViewingProductImage}
          activeStockFilter={activeStockFilter}
        />

        {/* עימוד — הדפדפן מרנדר עמוד אחד בכל רגע נתון */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-sm text-gray-600">
            {matchingCount === 0
              ? 'לא נמצאו מוצרים'
              : `מציג ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, matchingCount)} מתוך ${matchingCount} מוצרים`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              הקודם
            </Button>
            <span className="text-sm text-gray-600">
              עמוד {page} מתוך {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              הבא
            </Button>
          </div>
        </div>

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
      <UndoActionBanner />
    </MainLayout>
  );
};
