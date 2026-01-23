
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

const chartConfig = {
  totalCost: {
    label: "סכום רכישה",
    color: "#00BFBF",
  },
};

export const MonthlyPurchasesChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  // Check for actual purchase data
  const hasPurchaseData = analytics?.monthlyPurchases?.some(data => data.totalCost > 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
          רכישות חודשיות
        </CardTitle>
        <div className="text-sm text-muted-foreground" dir="rtl">
          סכומים ששולמו לספקים בפועל (₪)
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : !analytics?.hasPurchaseData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">אין נתוני רכישות לתקופה</div>
            <div className="text-sm text-muted-foreground">
              כאשר תרשום קניות דרך עריכת מוצר, הנתונים יופיעו כאן
            </div>
          </div>
        ) : !hasPurchaseData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-muted-foreground mb-2">אין רכישות רשומות לשנה הנוכחית</div>
            <div className="text-sm text-muted-foreground">
              הגרף יעודכן כאשר יירשמו קניות חדשות
            </div>
          </div>
        ) : (
          <div className="w-full">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={analytics.monthlyPurchases} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value, name, props) => [
                    formatCurrency(Number(value)),
                    props.payload.productName !== 'אין נתונים' ? props.payload.productName : 'רכישות'
                  ]}
                  labelFormatter={(label) => `חודש ${label}`}
                />
                <Bar 
                  dataKey="totalCost" 
                  fill="#00BFBF" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
