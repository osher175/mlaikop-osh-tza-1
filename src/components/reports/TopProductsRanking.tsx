import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { TopProductItem } from '@/types/reports';

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

interface TopProductsRankingProps {
  products: TopProductItem[];
  dateRangeLabel: string;
}

export const TopProductsRanking: React.FC<TopProductsRankingProps> = ({ products, dateRangeLabel }) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            דירוג 20 המוצרים הפופולריים
          </CardTitle>
          <p className="text-sm text-muted-foreground">תקופה: {dateRangeLabel}</p>
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
