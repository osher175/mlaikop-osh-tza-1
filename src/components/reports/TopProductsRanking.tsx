import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

interface TopProduct {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  revenue: number;
}

type RankingRange = 'weekly' | 'monthly' | 'yearly';

interface TopProductsRankingProps {
  products: TopProduct[];
  isLoading?: boolean;
  selectedRange: RankingRange;
  onRangeChange: (range: RankingRange) => void;
}

const rangeOptions: { label: string; value: RankingRange }[] = [
  { label: 'שבועי', value: 'weekly' },
  { label: 'חודשי', value: 'monthly' },
  { label: 'שנתי', value: 'yearly' },
];

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
  }
};

const getRankBadgeClass = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800';
    case 2:
      return 'bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700';
    case 3:
      return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
    default:
      return 'bg-background border-border';
  }
};

export const TopProductsRanking: React.FC<TopProductsRankingProps> = ({
  products,
  isLoading,
  selectedRange,
  onRangeChange,
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דירוג 20 המוצרים הפופולריים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דירוג 20 המוצרים הפופולריים
          </CardTitle>
          <div className="flex gap-2">
            {rangeOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={selectedRange === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onRangeChange(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!products || products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            אין נתוני מכירות לתקופה זו
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-16">דירוג</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">שם מוצר</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-28">כמות נמכרה</th>
                  <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground w-28">הכנסות</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => {
                  const rank = index + 1;
                  return (
                    <tr
                      key={product.product_id}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${getRankBadgeClass(rank)}`}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center">
                          {getRankIcon(rank)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-medium text-foreground">{product.product_name}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-muted-foreground">
                          {product.quantity_sold.toLocaleString('he-IL')} יחידות
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm font-medium text-emerald-600">
                          {formatCurrency(product.revenue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
