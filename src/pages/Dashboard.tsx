
import React, { Suspense, lazy } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { TopSalesByDimension } from '@/components/dashboard/TopSalesByDimension';
import { SuppliersChart } from '@/components/dashboard/SuppliersChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard';

/* Phase A3: the two recharts-based cards are the only consumers of the
   charting library on this screen. Loading them lazily keeps recharts out of
   the initial bundle; data, formulas and appearance are unchanged. */
const RevenueChart = lazy(() =>
  import('@/components/dashboard/RevenueChart').then(m => ({ default: m.RevenueChart }))
);
const MonthlyPurchasesChart = lazy(() =>
  import('@/components/dashboard/MonthlyPurchasesChart').then(m => ({ default: m.MonthlyPurchasesChart }))
);

const ChartSkeleton: React.FC = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-5 w-40" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-64 w-full" />
    </CardContent>
  </Card>
);

export const Dashboard: React.FC = () => {
  useRealtimeDashboard();

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full max-w-full overflow-x-hidden" dir="rtl">
        {/* Dashboard Header */}
        <div className="w-full">
          <h1 className="text-3xl font-bold text-foreground font-rubik break-words">לוח הבקרה</h1>
          <p className="text-muted-foreground font-rubik break-words">סקירה כללית של המלאי והפעילות העסקית</p>
          <p className="text-xs text-muted-foreground/70 mt-1 font-rubik">📊 נתונים פיננסיים מתאפסים ב-1 בינואר בכל שנה</p>
        </div>

        {/* Summary Cards */}
        <div className="w-full">
          <SummaryGrid />
        </div>

        {/* Smart Insights Panel */}
        <div className="w-full">
          <InsightsPanel />
        </div>

        {/* BI Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-6 w-full">
          <div className="w-full min-w-0">
            <Suspense fallback={<ChartSkeleton />}>
              <RevenueChart />
            </Suspense>
          </div>
          <div className="w-full min-w-0">
            <TopSalesByDimension />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 lg:gap-6 w-full">
          <div className="w-full min-w-0">
            <SuppliersChart />
          </div>
          <div className="w-full min-w-0">
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlyPurchasesChart />
            </Suspense>
          </div>

        </div>

        {/* Additional Dashboard Components */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 lg:gap-6 w-full">
          <div className="lg:col-span-2 w-full min-w-0">
            <RecentActivity />
          </div>
          <div className="space-y-6 w-full min-w-0">
            <NotificationPanel />
            <QuickActions />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
