
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { ExpiringProducts } from '@/components/dashboard/ExpiringProducts';

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            לוח הבקרה
          </h1>
          <p className="text-gray-600">
            ברוכים הבאים למערכת ניהול המלאי שלכם
          </p>
        </div>

        {/* Main Dashboard Content */}
        <div className="space-y-6">
          {/* Stats Grid */}
          <StatsGrid />

          {/* Alerts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LowStockAlerts />
            <ExpiringProducts />
          </div>

          {/* Recent Activity */}
          <RecentActivity />
        </div>
      </div>
    </MainLayout>
  );
};
