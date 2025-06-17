
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, DollarSign, Package, Calendar, Download, PieChart, LineChart } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { useReports } from '@/hooks/useReports';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
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
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';

const chartConfig = {
  revenue: {
    label: "הכנסות",
    color: "#00BFBF",
  },
  profit: {
    label: "רווח",
    color: "#FFA940",
  },
};

const COLORS = ['#00BFBF', '#FFA940', '#27AE60', '#E74C3C', '#9B59B6', '#F39C12'];

export const Reports: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { reportsData, isLoading } = useReports({
    timeRange,
    categoryId: selectedCategory || undefined,
    supplierId: selectedSupplier || undefined,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount);
  };

  const categoryChartData = reportsData ? Object.entries(reportsData.categoryBreakdown).map(([name, data]) => ({
    name,
    value: data.revenue,
  })) : [];

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות וגרפים</h1>
            <p className="text-gray-600">ניתוח נתונים ותובנות עסקיות</p>
          </div>
          
          <ProtectedFeature requiredPermission="canViewReports">
            <div className="flex gap-3">
              <Button variant="outline">
                <Download className="w-4 h-4 ml-2" />
                יצא דוח
              </Button>
            </div>
          </ProtectedFeature>
        </div>

        {/* Filters */}
        <ProtectedFeature requiredPermission="canViewReports">
          <Card>
            <CardHeader>
              <CardTitle>מסננים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">טווח זמן</label>
                  <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">שבועי</SelectItem>
                      <SelectItem value="monthly">חודשי</SelectItem>
                      <SelectItem value="quarterly">רבעוני</SelectItem>
                      <SelectItem value="yearly">שנתי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">קטגוריה</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="כל הקטגוריות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">כל הקטגוריות</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">ספק</label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="כל הספקים" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">כל הספקים</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </ProtectedFeature>

        {/* Key Metrics */}
        <ProtectedFeature requiredPermission="canViewReports">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">סה״כ הכנסות</p>
                    <p className="text-2xl font-bold text-green-600">
                      {reportsData ? formatCurrency(reportsData.totalRevenue) : '₪0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">רווח נקי</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {reportsData ? formatCurrency(reportsData.totalProfit) : '₪0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-orange-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">עלות כוללת</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {reportsData ? formatCurrency(reportsData.totalCost) : '₪0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-purple-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">ROI</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {reportsData ? `${reportsData.roi.toFixed(1)}%` : '0%'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ProtectedFeature>

        {/* Charts Section */}
        <ProtectedFeature requiredPermission="canViewReports">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  מגמת הכנסות ורווח
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <RechartsLineChart data={reportsData?.monthlyTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} />
                    <Line type="monotone" dataKey="profit" stroke="var(--color-profit)" strokeWidth={2} />
                  </RechartsLineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  פירוט לפי קטגוריות
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <RechartsPieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RechartsPieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </ProtectedFeature>

        {/* Top Products */}
        <ProtectedFeature requiredPermission="canViewReports">
          <Card>
            <CardHeader>
              <CardTitle>המוצרים הנמכרים ביותר</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reportsData?.topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-turquoise text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">{product.unitsSold} יחידות נמכרו</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-green-600">{formatCurrency(product.revenue)}</p>
                      <p className="text-sm text-gray-600">רווח: {formatCurrency(product.profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </ProtectedFeature>

        {/* AI Insights Placeholder */}
        <ProtectedFeature requiredRole="smart_master_user">
          <Card>
            <CardHeader>
              <CardTitle>תובנות חכמות (AI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">המלצה לרכישה</p>
                  <p className="text-xs text-yellow-700">מומלץ להזמין מוצרים מקטגוריית מחשבים - הביקוש עולה</p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800">הזדמנות רווח</p>
                  <p className="text-xs text-green-700">שקול להעלות מחירים בקטגוריית אביזרים - שוק חם</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">חיזוי מכירות</p>
                  <p className="text-xs text-blue-700">צפוי גידול של 15% במכירות החודש הבא על פי הטרנד</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </ProtectedFeature>

        {/* Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle>דוחות מהירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex-col">
                <Calendar className="h-6 w-6 mb-2" />
                דוח יומי
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <Package className="h-6 w-6 mb-2" />
                דוח מלאי
              </Button>
              <Button variant="outline" className="h-20 flex-col">
                <DollarSign className="h-6 w-6 mb-2" />
                דוח רווחיות
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};
