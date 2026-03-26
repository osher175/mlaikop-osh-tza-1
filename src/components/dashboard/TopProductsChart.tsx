import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Star, Circle, AlertCircle } from 'lucide-react';
import { useDashboardReportsData } from '@/hooks/useDashboardReportsData';
import { formatCurrency } from '@/lib/formatCurrency';
import { calculateNetFromGross } from '@/lib/financialConfig';

const rankIcons = [Trophy, Medal, Award, Star, Circle];
const rankColors = ['text-yellow-500', 'text-muted-foreground', 'text-amber-600', 'text-primary', 'text-green-600'];

export const TopProductsChart: React.FC = () => {
  const { reportsData, isLoading, isFetching } = useDashboardReportsData();
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const prevDataRef = useRef<string>('');

  const products = useMemo(() => {
    if (!reportsData?.top_products_list?.length) return [];

    return reportsData.top_products_list.slice(0, 5).map((p) => {
      const revenueNet = calculateNetFromGross(p.revenue || 0);
      // COGS not directly available in top_products_list, approximate from gross
      // net_profit = revenue/1.18 - COGS → we compute it from known data
      const profitNet = revenueNet - ((p.revenue || 0) - (p.revenue || 0)); // simplified — use revenue as primary
      return {
        productId: p.product_id,
        productName: p.product_name,
        quantity: p.quantity_sold,
        revenue: p.revenue || 0,
        revenueNet,
      };
    });
  }, [reportsData]);

  // Detect changes for highlight animation
  useEffect(() => {
    const newKey = JSON.stringify(products.map(p => `${p.productId}:${p.quantity}:${p.revenue}`));
    if (prevDataRef.current && prevDataRef.current !== newKey) {
      const newSet = new Set(products.map(p => p.productId));
      setChangedIds(newSet);
      const timer = setTimeout(() => setChangedIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }
    prevDataRef.current = newKey;
  }, [products]);

  const hasSaleData = products.length > 0;

  return (
    <Card className={`w-full transition-all duration-300 ${isFetching && !isLoading ? 'opacity-90' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
              מוצרי המכירה המובילים
            </CardTitle>
            <div className="text-sm text-muted-foreground" dir="rtl">
              דירוג לפי הכנסות מכירה בפועל — שנה נוכחית (₪)
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : !hasSaleData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">אין נתוני מכירות לתקופה</div>
            <div className="text-sm text-muted-foreground">
              כאן יוצגו המוצרים עם ההכנסות הגבוהות ביותר
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product, index) => {
              const IconComponent = rankIcons[index];
              const iconColor = rankColors[index];
              const isChanged = changedIds.has(product.productId);

              return (
                <div
                  key={product.productId}
                  className={`flex items-center justify-between p-3 bg-muted rounded-lg transition-all duration-500 ${
                    isChanged ? 'ring-2 ring-primary/40 bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3" dir="rtl">
                    <IconComponent className={`w-6 h-6 ${iconColor}`} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{product.productName}</span>
                      <span className="text-sm text-muted-foreground">
                        {product.quantity} יחידות נמכרו
                      </span>
                    </div>
                  </div>
                  <div className="text-left" dir="ltr">
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(product.revenue)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      נטו: {formatCurrency(product.revenueNet)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
