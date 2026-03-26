import * as React from 'react';
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, AlertCircle, Loader2, Shield, Lightbulb } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useRealtimeReports } from '@/hooks/useRealtimeReports';
import { useNavigate } from 'react-router-dom';
import { useReportFilters } from '@/hooks/useReportFilters';
import { useReportsData } from '@/hooks/useReportsData';
import { ReportsFilterBar } from '@/components/reports/ReportsFilterBar';
import { ReportsSummaryCards } from '@/components/reports/ReportsSummaryCards';
import ReportsCharts from '@/components/reports/ReportsCharts';
import { InsightsTabs } from '@/components/reports/InsightsTabs';
import { TopProductsRanking } from '@/components/reports/TopProductsRanking';
import { useBusinessInsights } from '@/features/reports/businessInsights/useBusinessInsights';
import { BusinessInsightsSection } from '@/features/reports/components/BusinessInsightsSection';

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

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const navigate = useNavigate();

  const { permissions } = useUserRole();

  // Single source of truth for all report filters
  const filtersResult = useReportFilters();
  const { filters, dateRange, dateRangeLabel } = filtersResult;

  // Single data fetch — all widgets consume this
  const { reportsData, isLoading, error } = useReportsData(filters, dateRange);

  // Realtime subscription for auto-refresh
  useRealtimeReports();

  // Business Insights — uses same filters and reportsData (single source of truth)
  const { insights, isLoading: isInsightsLoading } = useBusinessInsights(filters, dateRange, reportsData);

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
            {/* Unified Filter Bar */}
            <div className="mb-6">
              <ReportsFilterBar filtersResult={filtersResult} />
            </div>

            {/* Loader */}
            {isLoading ? (
              <div className="flex justify-center items-center min-h-[30vh]">
                <Loader2 className="animate-spin w-10 h-10 text-muted-foreground" />
              </div>
            ) : reportsData ? (
              <>
                {/* Summary Cards — same data, same date range */}
                <ReportsSummaryCards reportsData={reportsData} />

                {/* Top 20 Products Ranking — same data, same date range */}
                <div className="mb-6">
                  <TopProductsRanking
                    products={reportsData.top_products_list || []}
                    dateRangeLabel={dateRangeLabel}
                  />
                </div>

                {/* Charts — same data, same date range */}
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
