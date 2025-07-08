
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { NotificationManagement } from '@/components/notifications/NotificationManagement';
import { ProtectedFeature } from '@/components/ProtectedFeature';

export const NotificationManagementPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            ניהול התראות
          </h1>
          <p className="text-gray-600">
            נהל את הגדרות ההתראות, ספי הרגישות ומשתמשים רלוונטיים
          </p>
        </div>

        <ProtectedFeature requiredRole="OWNER">
          <NotificationManagement />
        </ProtectedFeature>
      </div>
    </MainLayout>
  );
};
