
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';

export const StaleProductsPanel: React.FC = () => {
  const { businessContext } = useBusinessAccess();

  const { data: staleProducts = [], isLoading } = useQuery({
    queryKey: ['stale-products', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      // Query the actual products table instead of stale_products view
      // to get all the needed fields
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          quantity,
          location,
          cost,
          price,
          expiration_date,
          created_at,
          updated_at,
          suppliers!supplier_id(name)
        `)
        .eq('business_id', businessContext.business_id)
        .lt('quantity', 10) // Show products with low quantity as "stale"
        .order('updated_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('Error fetching stale products:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!businessContext?.business_id,
  });

  if (isLoading) {
    return <div>טוען מוצרים ישנים...</div>;
  }

  if (staleProducts.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-600">
          <Calendar className="h-5 w-5" />
          מוצרים במלאי נמוך
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {staleProducts.map((product) => {
            // Calculate days since last update as approximation
            const daysSinceUpdate = product.updated_at 
              ? Math.floor((new Date().getTime() - new Date(product.updated_at).getTime()) / (1000 * 60 * 60 * 24))
              : 0;

            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50"
                dir="rtl"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">{product.name}</span>
                    <Badge variant="secondary">
                      {daysSinceUpdate} ימים מעדכון אחרון
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    מיקום: {product.location || 'לא צוין'} | כמות: {product.quantity}
                  </div>
                  <div className="text-sm text-gray-600">
                    עלות: ₪{product.cost || 0} | מחיר: ₪{product.price || 0}
                  </div>
                  {product.suppliers && (
                    <div className="text-xs text-gray-500 mt-1">
                      ספק: {product.suppliers.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
