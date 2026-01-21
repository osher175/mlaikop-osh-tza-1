
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { SuppliersChart } from '@/components/dashboard/SuppliersChart';
import { MonthlyPurchasesChart } from '@/components/dashboard/MonthlyPurchasesChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden" dir="rtl">
        {/* Dashboard Header */}
        <div className="w-full">
          <h1 className="text-3xl font-bold text-foreground font-rubik break-words">לוח הבקרה</h1>
          <p className="text-muted-foreground font-rubik break-words">סקירה כללית של המלאי והפעילות העסקית</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <div className="w-full min-w-0">
            <RevenueChart />
          </div>
          <div className="w-full min-w-0">
            <TopProductsChart />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <div className="w-full min-w-0">
            <SuppliersChart />
          </div>
          <div className="w-full min-w-0">
            <MonthlyPurchasesChart />
          </div>
        </div>

        {/* Additional Dashboard Components */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
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
