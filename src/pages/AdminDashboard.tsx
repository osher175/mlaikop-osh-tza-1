
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { AdminSummaryGrid } from '@/components/admin/AdminSummaryGrid';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { PlanDistribution } from '@/components/admin/PlanDistribution';
import { UserSearch } from '@/components/admin/UserSearch';
import { SubscriptionTable } from '@/components/admin/SubscriptionTable';
import { Shield } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <MainLayout>
      <ProtectedFeature requiredRole="admin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Shield className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-rubik">פאנל ניהול מערכת</h1>
              <p className="text-gray-600">סטטיסטיקות ונתונים עבור מנהל הפלטפורמה</p>
            </div>
          </div>

          {/* Summary Grid */}
          <AdminSummaryGrid />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueChart />
            <PlanDistribution />
          </div>

          {/* User Management Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1">
              <UserSearch />
            </div>
            <div className="xl:col-span-2">
              <SubscriptionTable />
            </div>
          </div>
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
