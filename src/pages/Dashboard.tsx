
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';

export const Dashboard: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            ברוך הבא ל-Mlaiko
          </h1>
          <p className="text-gray-600">
            סקירה כללית של המלאי והפעילות העסקית שלך
          </p>
        </div>

        {/* Stats Cards */}
        <StatsCards />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <QuickActions />
          </div>
          <div className="space-y-6">
            <RecentActivity />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
