
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
    label: "יחידות",
    color: "#00BFBF",
  },
  sales_amount: {
    label: "סכום (₪)",
    color: "#FFA940",
  },
  total_purchased: {
    label: "קניות",
    color: "#27AE60",
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
              <YAxis yAxisId="left" tickFormatter={(value) => `${value}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name) => [
                  name === 'sales' ? `${value} יחידות` : formatCurrency(Number(value)),
                  name === 'sales' ? 'יחידות' : 'סכום'
                ]}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line yAxisId="left" type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} name="יחידות" />
              <Line yAxisId="right" type="monotone" dataKey="sales_amount" stroke="var(--color-sales_amount)" strokeWidth={2} name="סכום (₪)" />
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
                nameKey="supplier_name"
                label={({ supplier_name, percent }) => `${(percent * 100).toFixed(0)}%`}
              >
                {suppliersData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name, props) => [`${value} יחידות`, props.payload?.supplier_name || 'ספק']}
              />
            </RechartsPieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsCharts;
