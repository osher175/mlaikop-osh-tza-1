
import * as React from 'react';
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, DollarSign, Package, AlertCircle, Loader2, Shield, Lightbulb } from 'lucide-react';
import { useReports, ReportsRange } from '@/hooks/useReports';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';
import ReportsCharts from '@/components/reports/ReportsCharts';
import { InsightsTabs } from '@/components/reports/InsightsTabs';
import { TopProductsRanking } from '@/components/reports/TopProductsRanking';
import { formatCurrency } from '@/lib/formatCurrency';

const ErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
  <Card className="border-destructive/50 bg-destructive/10">
    <CardContent className="p-6 text-center">
      <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-destructive mb-2">שגיאה בטעינת הדוחות</h3>
      <p className="text-destructive/80 mb-4">{error.message}</p>
      <Button onClick={retry} variant="outline" className="text-destructive border-destructive/50">
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
  const [activeTab, setActiveTab] = useState<string>('overview');
  const navigate = useNavigate();
  
  const { permissions } = useUserRole();
  const { reportsData, isLoading, error } = useReports(selectedRange);

  // Block admin users from accessing reports
  if (permissions.isPlatformAdmin) {
    return (
      <MainLayout>
        <div className="text-center py-12" dir="rtl">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            גישה מוגבלת
          </h2>
          <p className="text-muted-foreground mb-6">
            דף הדוחות אינו זמין למנהלי מערכת
          </p>
          <Button onClick={() => navigate('/admin')}>
            חזור לפאנל המנהל
          </Button>
        </div>
      </MainLayout>
    );
  }


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
            <h1 className="text-3xl font-bold text-foreground">דוחות עסקיים</h1>
            <p className="text-muted-foreground">סקירה וניתוח נתונים לפי טווח זמן</p>
            <p className="text-xs text-muted-foreground/70 mt-1">📊 נתונים פיננסיים מתאפסים ב-1 בינואר בכל שנה</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              סקירה כללית
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              תובנות חכמות
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            {/* Range Selector */}
            <div className="flex gap-2 mb-6">
              {rangeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={selectedRange === opt.value ? 'default' : 'outline'}
                  onClick={() => setSelectedRange(opt.value)}
                  className="min-w-[70px]"
                  type="button"
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Loader or Error */}
            {isLoading ? (
              <div className="flex justify-center items-center min-h-[30vh]">
                <Loader2 className="animate-spin w-10 h-10 text-muted-foreground" />
              </div>
            ) : reportsData ? (
              <>
                {/* Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <Package className="h-8 w-8 text-primary" />
                        <div className="mr-4">
                          <p className="text-sm font-medium text-muted-foreground">סה"כ נכנסו</p>
                          <p className="text-2xl font-bold text-primary">{reportsData.total_added ?? 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <BarChart3 className="h-8 w-8 text-accent-foreground" />
                        <div className="mr-4">
                          <p className="text-sm font-medium text-muted-foreground">סה"כ יצאו</p>
                          <p className="text-2xl font-bold text-accent-foreground">{reportsData.total_removed ?? 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <DollarSign className="h-8 w-8 text-emerald-600" />
                        <div className="mr-4">
                          <p className="text-sm font-medium text-muted-foreground">שווי מלאי</p>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(reportsData.total_value)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-blue-600" />
                        <div className="mr-4">
                          <p className="text-sm font-medium text-muted-foreground">רווח גולמי</p>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrency(reportsData.gross_profit)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Net Profit Card */}
                <div className="mb-6">
                  <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                      <DollarSign className="h-8 w-8 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">רווח נטו (לאחר מע"מ)</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(reportsData.net_profit)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Top 20 Products Ranking */}
                <div className="mb-6">
                  <TopProductsRanking
                    products={reportsData.top_products_list || []}
                    isLoading={isLoading}
                    selectedRange={selectedRange === 'daily' ? 'weekly' : selectedRange}
                    onRangeChange={(range) => setSelectedRange(range)}
                  />
                </div>

                {/* Charts */}
                <ReportsCharts
                  timeline={reportsData.timeline_breakdown}
                  suppliers={reportsData.suppliers_breakdown}
                  isLoading={isLoading}
                />
              </>
            ) : null}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights">
            <InsightsTabs />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};
