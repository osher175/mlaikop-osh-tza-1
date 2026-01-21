
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          רכישות חודשיות לפי מוצר
        </CardTitle>
        <div className="text-sm text-gray-600" dir="rtl">
          המוצר עם הכי הרבה רכישות בכל חודש
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-500 animate-pulse">טוען נתונים...</div>
          </div>
        ) : !analytics?.hasPurchaseData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-gray-500 mb-2 text-lg">אין נתוני רכישות להצגה כרגע</div>
            <div className="text-sm text-gray-400">
              גרף זה יציג את המוצר עם הכי הרבה רכישות בכל חודש
            </div>
          </div>
        ) : !analytics.monthlyPurchases.some(data => data.quantity > 0) ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-4">
            <div className="text-gray-500 mb-2">אין רכישות רשומות עדיין לשנה זו</div>
            <div className="text-sm text-gray-400">
              הגרף יעודכן כאשר יירשמו רכישות חדשות
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};
