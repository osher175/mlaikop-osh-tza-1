
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, DollarSign, Package, BarChart3 } from 'lucide-react';
import { useOptimizedReports, ReportsRange } from '@/hooks/useOptimizedReports';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { Badge } from '@/components/ui/badge';
import ExportButtons from '@/components/reports/ExportButtons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/formatCurrency';

const RANGE_OPTIONS: { value: ReportsRange; label: string }[] = [
  { value: 'daily', label: 'יומי' },
  { value: 'weekly', label: 'שבועי' },
  { value: 'monthly', label: 'חודשי' },
  { value: 'yearly', label: 'שנתי' },
];

export const OptimizedReports: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<ReportsRange>('monthly');
  const { businessContext, isLoading: businessLoading } = useBusinessAccess();
  const { reportsData, isLoading: reportsLoading, error } = useOptimizedReports(selectedRange);

  if (businessLoading || reportsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="text-center py-12" dir="rtl">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            שגיאה בטעינת הדוחות
          </h2>
          <p className="text-gray-600">
            אירעה שגיאה בטעינת נתוני הדוחות. אנא נסה שוב.
          </p>
        </div>
      </MainLayout>
    );
  }

  if (!businessContext) {
    return (
      <MainLayout>
        <div className="text-center py-12" dir="rtl">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            לא נמצא עסק מקושר
          </h2>
          <p className="text-gray-600">
            אנא וודא שהצטרפת לעסק או יצרת עסק חדש
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">דוחות עסקיים</h1>
            <p className="text-gray-600">{businessContext.business_name}</p>
          </div>
          
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedRange === option.value ? 'default' : 'outline'}
                onClick={() => setSelectedRange(option.value)}
                size="sm"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {reportsData && (
          <>
            {/* Export Buttons */}
            <div className="flex justify-end">
              <ExportButtons 
                reportsData={reportsData} 
                selectedRange={RANGE_OPTIONS.find(opt => opt.value === selectedRange)?.label || 'חודשי'} 
              />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">סה״כ נכנסו</p>
                      <p className="text-2xl font-bold text-green-600">
                        {reportsData.total_added.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">סה״כ יצאו</p>
                      <p className="text-2xl font-bold text-red-600">
                        {reportsData.total_removed.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">שווי מלאי</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(reportsData.total_value)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">רווח נטו</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatCurrency(reportsData.net_profit)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline Chart */}
            {reportsData.timeline_breakdown && reportsData.timeline_breakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>מגמת מכירות לאורך זמן</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportsData.timeline_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'מכירות']} />
                      <Line 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="מכירות"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Additional Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>מוצר פופולרי</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportsData.top_product ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{reportsData.top_product}</Badge>
                      <span className="text-sm text-gray-600">המוצר הנמכר ביותר</span>
                    </div>
                  ) : (
                    <p className="text-gray-500">אין נתונים זמינים</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>רווחיות</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">רווח גולמי:</span>
                      <span className="font-medium">{formatCurrency(reportsData.gross_profit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">רווח נטו:</span>
                      <span className="font-medium">{formatCurrency(reportsData.net_profit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};
