
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { SuppliersChart } from '@/components/dashboard/SuppliersChart';
import { MonthlyPurchasesChart } from '@/components/dashboard/MonthlyPurchasesChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { AdminNavigationHelper } from '@/components/AdminNavigationHelper';

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6 p-4" dir="rtl">
        {/* Admin Navigation Helper */}
        <AdminNavigationHelper />
        
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-rubik">לוח הבקרה</h1>
          <p className="text-gray-600 font-rubik">סקירה כללית של המלאי והפעילות העסקית</p>
        </div>

        {/* Summary Cards */}
        <SummaryGrid />

        {/* BI Analytics Charts - Fixed Grid Layout */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="w-full">
              <RevenueChart />
            </div>
            <div className="w-full">
              <TopProductsChart />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="w-full">
              <SuppliersChart />
            </div>
            <div className="w-full">
              <MonthlyPurchasesChart />
            </div>
          </div>
        </div>

        {/* Additional Dashboard Components */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
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
