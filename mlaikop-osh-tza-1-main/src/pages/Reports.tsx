import * as React from 'react';
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, DollarSign, Package, Download, AlertCircle, Loader2, Award } from 'lucide-react';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { useReports, ReportsRange } from '@/hooks/useReports';
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

const rangeOptions: { label: string; value: ReportsRange }[] = [
  { label: 'יומי', value: 'daily' },
  { label: 'שבועי', value: 'weekly' },
  { label: 'חודשי', value: 'monthly' },
  { label: 'שנתי', value: 'yearly' },
];

export const Reports: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<ReportsRange>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');

  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  const { reportsData, isLoading, error } = useReports(selectedRange);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
    }).format(amount || 0);
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
      <div className="space-y-6 p-4 md:p-8" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">דוחות עסקיים</h1>
            <p className="text-gray-600">סקירה וניתוח נתונים לפי טווח זמן</p>
          </div>
          <div className="flex gap-2">
            {rangeOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={selectedRange === opt.value ? ("default" as ButtonProps['variant']) : ("outline" as ButtonProps['variant'])}
                onClick={() => setSelectedRange(opt.value)}
                className="min-w-[70px]"
                type="button"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Loader or Error */}
        {isLoading ? (
          <div className="flex justify-center items-center min-h-[30vh]">
            <Loader2 className="animate-spin w-10 h-10 text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center min-h-[30vh]">
            <div className="text-red-600">שגיאה בטעינת הדוחות: {error.message}</div>
          </div>
        ) : reportsData ? (
          <>
            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Package className="h-8 w-8 text-orange-500" />
                    <div className="mr-4">
                      <p className="text-sm font-medium text-gray-600">סה"כ נכנסו</p>
                      <p className="text-2xl font-bold text-orange-600">{reportsData.total_added ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                    <div className="mr-4">
                      <p className="text-sm font-medium text-gray-600">סה"כ יצאו</p>
                      <p className="text-2xl font-bold text-purple-600">{reportsData.total_removed ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-green-500" />
                    <div className="mr-4">
                      <p className="text-sm font-medium text-gray-600">שווי מלאי</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(reportsData.total_value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                    <div className="mr-4">
                      <p className="text-sm font-medium text-gray-600">רווח גולמי</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportsData.gross_profit)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Net Profit & Top Product */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6 flex items-center gap-4">
                  <Award className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">המוצר הפופולרי ביותר</p>
                    <p className="text-lg font-bold text-gray-900">
                      {reportsData.top_product?.name || '—'}
                      {reportsData.top_product?.quantity ? ` (${reportsData.top_product.quantity})` : ''}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">רווח נטו (לאחר מע"מ)</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(reportsData.net_profit)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <ReportsCharts
              timeline={reportsData.timeline_breakdown}
              suppliers={reportsData.suppliers_breakdown}
              isLoading={isLoading}
            />
          </>
        ) : null}
      </div>
    </MainLayout>
  );
};
