
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { MonthlyProfitChart } from '@/components/dashboard/MonthlyProfitChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { AdminNavigationHelper } from '@/components/AdminNavigationHelper';

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Admin Navigation Helper */}
        <AdminNavigationHelper />
        
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-rubik">לוח הבקרה</h1>
          <p className="text-gray-600 font-rubik">סקירה כללית של המלאי והפעילות העסקית</p>
        </div>

        {/* Summary Cards */}
        <SummaryGrid />

        {/* Charts and Quick Actions */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <MonthlyProfitChart />
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
