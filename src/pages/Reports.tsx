
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, DollarSign, Package, Download, AlertCircle } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { useReports } from '@/hooks/useReports';
import { useCategories } from '@/hooks/useCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import ReportsCharts from '@/components/reports/ReportsCharts';
import TopProductsList from '@/components/reports/TopProductsList';

const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  </div>
);

const ErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <Card className="border-red-200 bg-red-50">
    <CardContent className="p-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-red-800 mb-2">שגיאה בטעינת הדוחות</h3>
      <p className="text-red-600 mb-4">{error.message}</p>
      <Button onClick={retry} variant="outline" className="text-red-600 border-red-300">
        נסה שוב
      </Button>
    </CardContent>
  </Card>
);

export const Reports: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { reportsData, isLoading, error } = useReports({
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

  const retryFetch = () => {
    window.location.reload();
  };

  if (error) {
    return (
      <MainLayout>
        <div className="p-6" dir="rtl">
          <ErrorFallback error={error as Error} retry={retryFetch} />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות וגרפים</h1>
            <p className="text-gray-600">ניתוח נתונים ותובנות עסקיות</p>
          </div>
          
          <ProtectedFeature 
            requiredPermission="canViewReports"
            fallback={<div></div>}
            showUpgradePrompt={false}
          >
            <Button variant="outline">
              <Download className="w-4 h-4 ml-2" />
              יצא דוח
            </Button>
          </ProtectedFeature>
        </div>

        {/* Filters */}
        <ProtectedFeature 
          requiredPermission="canViewReports"
          fallback={
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-600">נדרשות הרשאות נוספות לצפייה בדוחות</p>
              </CardContent>
            </Card>
          }
          showUpgradePrompt={false}
        >
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
        <ProtectedFeature 
          requiredPermission="canViewReports"
          fallback={<div></div>}
          showUpgradePrompt={false}
        >
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <LoadingSkeleton />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
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
          )}
        </ProtectedFeature>

        {/* Charts Section */}
        <ProtectedFeature 
          requiredPermission="canViewReports"
          fallback={<div></div>}
          showUpgradePrompt={false}
        >
          <ReportsCharts reportsData={reportsData} isLoading={isLoading} />
        </ProtectedFeature>

        {/* Top Products */}
        <ProtectedFeature 
          requiredPermission="canViewReports"
          fallback={<div></div>}
          showUpgradePrompt={false}
        >
          <TopProductsList 
            topProducts={reportsData?.topProducts || []} 
            isLoading={isLoading}
            formatCurrency={formatCurrency}
          />
        </ProtectedFeature>

        {/* AI Insights Placeholder */}
        <ProtectedFeature requiredRole="smart_master_user" showUpgradePrompt={false}>
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
              </div>
            </CardContent>
          </Card>
        </ProtectedFeature>
      </div>
    </MainLayout>
  );
};
