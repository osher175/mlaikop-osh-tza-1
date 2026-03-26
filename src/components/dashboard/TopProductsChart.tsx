
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Star, Circle, AlertCircle } from 'lucide-react';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';
import { formatCurrency } from '@/lib/formatCurrency';
import { calculateNetFromGross } from '@/lib/financialConfig';

type Period = 'week' | 'month' | 'year';

const periodLabels: Record<Period, string> = {
  week: 'שבוע',
  month: 'חודש',
  year: 'שנה',
};

const rankIcons = [Trophy, Medal, Award, Star, Circle];
const rankColors = ['text-yellow-500', 'text-muted-foreground', 'text-amber-600', 'text-primary', 'text-green-600'];

function getDateRange(period: Period): Date {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
  }
}

export const TopProductsChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();
  const [period, setPeriod] = useState<Period>('year');

  const filteredProducts = useMemo(() => {
    if (!analytics?.financialActions) return analytics?.topProducts || [];

    const cutoff = getDateRange(period);
    const actions = analytics.financialActions;

    // Filter sales by period
    const productSales: Record<string, {
      name: string;
      quantity: number;
      revenue: number;
      cogs: number;
    }> = {};

    actions.forEach((action: any) => {
      if (
        (action.action_type === 'remove' || action.action_type === 'sale') &&
        action.sale_total_ils != null
      ) {
        const actionDate = new Date(action.timestamp);
        if (actionDate < cutoff) return;

        const product = action.products;
        if (!product) return;

        const productId = product.id;
        const revenue = Number(action.sale_total_ils) || 0;
        const cost = (Number(action.cost_snapshot_ils) || 0) * Math.abs(action.quantity_changed || 0);

        if (!productSales[productId]) {
          productSales[productId] = { name: product.name, quantity: 0, revenue: 0, cogs: 0 };
        }
        productSales[productId].quantity += Math.abs(action.quantity_changed || 0);
        productSales[productId].revenue += revenue;
        productSales[productId].cogs += cost;
      }
    });

    return Object.entries(productSales)
      .map(([productId, data]) => {
        const revenueNet = calculateNetFromGross(data.revenue);
        const profitNet = revenueNet - data.cogs;
        return {
          productId,
          productName: data.name,
          quantity: data.quantity,
          revenue: Math.round(data.revenue * 100) / 100,
          revenueNet: Math.round(revenueNet * 100) / 100,
          profit: Math.round((data.revenue - data.cogs) * 100) / 100,
          profitNet: Math.round(profitNet * 100) / 100,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [analytics, period]);

  const hasSaleData = filteredProducts.length > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
              מוצרי המכירה המובילים
            </CardTitle>
            <div className="text-sm text-muted-foreground" dir="rtl">
              דירוג לפי הכנסות מכירה בפועל (₪)
            </div>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1" dir="rtl">
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
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
            {filteredProducts.map((product, index) => {
              const IconComponent = rankIcons[index];
              const iconColor = rankColors[index];
              
              return (
                <div key={product.productId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
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
                    <div className={`text-sm ${product.profitNet >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      רווח נטו: {formatCurrency(product.profitNet)}
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
