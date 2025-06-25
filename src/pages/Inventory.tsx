
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
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { useProducts } from '@/hooks/useProducts';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useNavigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  product_categories?: { name: string } | null;
  categories?: { name: string } | null;
};

export const Inventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [viewingProductImage, setViewingProductImage] = useState<Product | null>(null);
  const navigate = useNavigate();
  
  const { businessContext, isLoading: businessLoading } = useBusinessAccess();
  const { products, isLoading: productsLoading, refetch } = useProducts();

  const getStatusCounts = () => {
    const inStock = products.filter(p => p.quantity > 5).length;
    const lowStock = products.filter(p => p.quantity > 0 && p.quantity <= 5).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    
    return { inStock, lowStock, outOfStock };
  };

  const handleProductUpdated = () => {
    refetch();
  };

  const handleProductDeleted = () => {
    refetch();
  };

  const { inStock, lowStock, outOfStock } = getStatusCounts();

  if (businessLoading || productsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
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
      <div className="space-y-6" dir="rtl">
        <InventoryHeader
          businessName={businessContext.business_name}
          userRole={businessContext.user_role}
          isOwner={businessContext.is_owner}
        />

        <ExpirationAlertsPanel />

        <InventoryFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <InventoryStats
          totalProducts={products.length}
          inStock={inStock}
          lowStock={lowStock}
          outOfStock={outOfStock}
        />

        <InventoryTable
          products={products as Product[]}
          searchTerm={searchTerm}
          onEditProduct={setEditingProduct}
          onDeleteProduct={setDeletingProduct}
          onViewProductImage={setViewingProductImage}
        />

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
