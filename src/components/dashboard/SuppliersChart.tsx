
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { AlertCircle, Trophy, Medal, Award } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

interface SupplierRanking {
  supplierName: string;
  productCount: number;
  totalCost: number;
}

export const SuppliersChart: React.FC = () => {
  const { businessContext } = useBusinessAccess();

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['supplier-rankings', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('quantity, cost, supplier_id, suppliers(id, name)')
        .eq('business_id', businessContext.business_id)
        .not('supplier_id', 'is', null);

      if (error) {
        console.error('Error fetching supplier rankings:', error);
        throw error;
      }

      const supplierMap: Record<string, SupplierRanking> = {};

      (data || []).forEach((product: any) => {
        const supplier = product.suppliers;
        if (!supplier?.id) return;

        if (!supplierMap[supplier.id]) {
          supplierMap[supplier.id] = {
            supplierName: supplier.name || 'ספק לא ידוע',
            productCount: 0,
            totalCost: 0,
          };
        }
        supplierMap[supplier.id].productCount += 1;
        supplierMap[supplier.id].totalCost += (product.cost || 0) * (product.quantity || 0);
      });

      return Object.values(supplierMap).sort((a, b) => b.productCount - a.productCount);
    },
    enabled: !!businessContext?.business_id,
    staleTime: 2 * 60 * 1000,
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
          פילוח רכישות לפי ספקים
        </CardTitle>
        <div className="text-sm text-muted-foreground" dir="rtl">
          דירוג ספקים לפי כמות מוצרים
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : rankings.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">אין נתוני ספקים</div>
            <div className="text-sm text-muted-foreground">
              כאשר תוסיף מוצרים עם ספקים, הנתונים יופיעו כאן
            </div>
          </div>
        ) : (
          <div className="overflow-auto max-h-80" dir="rtl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 px-2 text-right font-semibold text-muted-foreground w-12">מקום</th>
                  <th className="py-2 px-2 text-right font-semibold text-muted-foreground">ספק</th>
                  <th className="py-2 px-2 text-center font-semibold text-muted-foreground">מוצרים</th>
                  <th className="py-2 px-2 text-left font-semibold text-muted-foreground">סה״כ עלות</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((supplier, index) => (
                  <tr
                    key={supplier.supplierName}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 font-medium text-foreground">{supplier.supplierName}</td>
                    <td className="py-2.5 px-2 text-center text-foreground">{supplier.productCount}</td>
                    <td className="py-2.5 px-2 text-left font-medium text-foreground">
                      {formatCurrency(supplier.totalCost)}
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
};
