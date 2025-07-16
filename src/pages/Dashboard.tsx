
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

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-rubik">לוח הבקרה</h1>
          <p className="text-gray-600 font-rubik">סקירה כללית של המלאי והפעילות העסקית</p>
        </div>

        {/* Summary Cards */}
        <SummaryGrid />

        {/* BI Analytics Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          <RevenueChart />
          <TopProductsChart />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
          <SuppliersChart />
          <MonthlyPurchasesChart />
        </div>

        {/* Additional Dashboard Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 md:col-span-2">
            <RecentActivity />
          </div>
          <div className="space-y-6">
            <NotificationPanel />
            <QuickActions />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
