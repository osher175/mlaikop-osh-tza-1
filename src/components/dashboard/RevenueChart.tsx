
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, Legend } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';
import { AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

const chartConfig = {
  revenue: {
    label: "הכנסות",
    color: "#00BFBF",
  },
  grossProfit: {
    label: "רווח גולמי",
    color: "#27AE60",
  },
};

export const RevenueChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  // Check if there are any real revenue values
  const hasRevenueData = analytics?.salesData?.some(data => data.revenue > 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground" dir="rtl">
          הכנסות ורווחיות חודשית
        </CardTitle>
        <div className="text-sm text-muted-foreground" dir="rtl">
          נתונים אמיתיים ממכירות שנרשמו במערכת (₪)
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-muted-foreground animate-pulse">טוען נתונים...</div>
          </div>
        ) : !analytics?.hasSaleData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <div className="text-muted-foreground mb-2 text-lg">אין נתוני מכירות לתקופה</div>
            <div className="text-sm text-muted-foreground">
              כאשר תרשום מכירה דרך עריכת מוצר, הנתונים יופיעו כאן
            </div>
          </div>
        ) : !hasRevenueData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-muted-foreground mb-2">אין הכנסות לשנה הנוכחית</div>
            <div className="text-sm text-muted-foreground">
              הגרף יעודכן כאשר יירשמו מכירות חדשות
            </div>
          </div>
        ) : (
          <div className="w-full">
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <LineChart data={analytics.salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  formatter={(value, name) => [
                    formatCurrency(Number(value)), 
                    name === 'revenue' ? 'הכנסות' : 'רווח גולמי'
                  ]}
                />
                <Legend />
                <Line 
                  dataKey="revenue" 
                  stroke="#00BFBF" 
                  strokeWidth={3}
                  dot={{ fill: '#00BFBF', strokeWidth: 2, r: 4 }}
                  name="הכנסות"
                />
                <Line 
                  dataKey="grossProfit" 
                  stroke="#27AE60" 
                  strokeWidth={3}
                  dot={{ fill: '#27AE60', strokeWidth: 2, r: 4 }}
                  name="רווח גולמי"
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
