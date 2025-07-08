
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

      const { data, error } = await supabase
        .from('stale_products')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('days_since_activity', { ascending: false })
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
          מוצרים ישנים (מעל 60 יום ללא תנועה)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {staleProducts.map((product) => (
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
                    {Math.floor(product.days_since_activity)} ימים
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  מיקום: {product.location || 'לא צוין'} | כמות: {product.quantity}
                </div>
                <div className="text-sm text-gray-600">
                  עלות: ₪{product.cost || 0} | מחיר: ₪{product.price || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  תנועה אחרונה: {new Date(product.last_activity).toLocaleDateString('he-IL')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
