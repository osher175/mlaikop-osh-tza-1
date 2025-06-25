
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useBIAnalytics } from '@/hooks/useBIAnalytics';

const chartConfig = {
  quantity: {
    label: "כמות רכישה",
    color: "#00BFBF",
  },
};

export const MonthlyPurchasesChart: React.FC = () => {
  const { analytics, isLoading } = useBIAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            רכישות חודשיות לפי מוצר
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500">טוען נתונים...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics?.hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
            רכישות חודשיות לפי מוצר
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="text-gray-500 mb-2">עדיין אין נתוני רכישות</div>
            <div className="text-sm text-gray-400">
              גרף זה יציג את המוצר הנרכש ביותר בכל חודש
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPurchases = analytics.monthlyPurchases.some(data => data.quantity > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          רכישות חודשיות לפי מוצר
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          המוצר הנרכש ביותר בכל חודש
        </div>
      </CardHeader>
      <CardContent>
        {!hasPurchases ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="text-gray-500 mb-2">עדיין אין רכישות רשומות</div>
            <div className="text-sm text-gray-400">
              הגרף יעודכן כאשר יתווספו נתוני רכישות חדשים
            </div>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-64">
            <BarChart data={analytics.monthlyPurchases}>
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
                tickFormatter={(value) => `${value} יח'`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name, props) => [
                  `${Number(value).toLocaleString()} יחידות`,
                  props.payload.productName
                ]}
                labelFormatter={(label) => `חודש ${label}`}
              />
              <Bar 
                dataKey="quantity" 
                fill="#00BFBF" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
