
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { StockAlertsPanel } from '@/components/dashboard/StockAlertsPanel';
import { StaleProductsPanel } from '@/components/inventory/StaleProductsPanel';
import { ExpirationAlertsPanel } from '@/components/inventory/ExpirationAlertsPanel';
import { SessionWarningDialog } from '@/components/SessionWarningDialog';

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <h1 className="text-3xl font-bold text-gray-900">דשבורד ראשי</h1>
        
        {/* Session Warning Dialog */}
        <SessionWarningDialog />
        
        {/* Stock Alerts Panel */}
        <StockAlertsPanel />
        
        {/* Expiration Alerts Panel */}
        <ExpirationAlertsPanel />
        
        {/* Stale Products Panel */}
        <StaleProductsPanel />
        
        {/* Notification Panel */}
        <NotificationPanel />
        
        {/* Summary Grid */}
        <SummaryGrid />
        
        {/* Quick Actions */}
        <QuickActions />
        
        {/* Recent Activity */}
        <RecentActivity />
      </div>
    </MainLayout>
  );
}
