
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/formatCurrency';

const chartData = [
  { month: 'ינואר', revenue: 12500 },
  { month: 'פברואר', revenue: 15800 },
  { month: 'מרץ', revenue: 18200 },
  { month: 'אפריל', revenue: 22400 },
  { month: 'מאי', revenue: 19600 },
  { month: 'יוני', revenue: 25300 },
];

const chartConfig = {
  revenue: {
    label: "הכנסות",
    color: "#00BFBF",
  },
};

export const MonthlyProfitChart: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900" dir="rtl">
          הכנסות חודשיות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <BarChart data={chartData}>
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
              formatter={(value) => [formatCurrency(Number(value)), 'הכנסות']}
            />
            <Bar 
              dataKey="revenue" 
              fill="#00BFBF" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
