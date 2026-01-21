
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Star, Circle, AlertCircle } from 'lucide-react';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const rankIcons = [Trophy, Medal, Award, Star, Circle];
const rankColors = ['text-yellow-500', 'text-muted-foreground', 'text-amber-600', 'text-primary', 'text-green-600'];

export const TopProductsChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  const formatCurrency = (amount: number) => {
    return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
          מוצרי המכירה המובילים
        </CardTitle>
        <div className="text-sm text-muted-foreground" dir="rtl">
          דירוג לפי הכנסות מכירה בפועל (₪)
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : !analytics?.hasSaleData || analytics.topProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">אין נתוני מכירות לתקופה</div>
            <div className="text-sm text-muted-foreground">
              כאן יוצגו המוצרים עם ההכנסות הגבוהות ביותר
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {analytics.topProducts.map((product, index) => {
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
                    <div className={`text-sm ${product.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      רווח: {formatCurrency(product.profit)}
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
