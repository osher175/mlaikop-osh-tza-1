
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { ProtectedFeature } from '@/components/ProtectedFeature';

export const NotificationSettingsPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            הגדרות התראות
          </h1>
          <p className="text-gray-600">
            נהל את הגדרות ההתראות עבור העסק שלך
          </p>
        </div>

        <ProtectedFeature requiredRole="smart_master_user">
          <NotificationSettings />
        </ProtectedFeature>
      </div>
    </MainLayout>
  );
};
