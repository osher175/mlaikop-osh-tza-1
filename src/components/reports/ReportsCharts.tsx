
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, PieChart } from 'lucide-react';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent 
} from '@/components/ui/chart';
import { 
  ResponsiveContainer, 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { formatCurrency } from '@/lib/formatCurrency';

const chartConfig = {
  sales: {
    label: "מכירות",
    color: "#00BFBF",
  },
  total_purchased: {
    label: "קניות",
    color: "#FFA940",
  },
};

const COLORS = ['#00BFBF', '#FFA940', '#27AE60', '#E74C3C', '#9B59B6'];

interface ReportsChartsProps {
  timeline: any[];
  suppliers: any[];
  isLoading: boolean;
}

const ReportsCharts: React.FC<ReportsChartsProps> = ({ timeline, suppliers, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-center h-64">
            <div className="animate-pulse text-gray-500">טוען נתונים...</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-center h-64">
            <div className="animate-pulse text-gray-500">טוען נתונים...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timelineData = timeline || [];
  const suppliersData = suppliers || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="w-5 h-5" />
            מגמת מכירות לפי זמן
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-64">
            <RechartsLineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value) => [formatCurrency(Number(value)), 'מכירות']}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} />
            </RechartsLineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Suppliers Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            פירוט לפי ספקים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-64">
            <RechartsPieChart>
              <Pie
                data={suppliersData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total_purchased"
                label={({ total_purchased, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {suppliersData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value) => [formatCurrency(Number(value)), 'רכישות']}
              />
            </RechartsPieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsCharts;
