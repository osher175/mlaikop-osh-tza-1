
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { AdminUserSearch } from '@/components/admin/AdminUserSearch';
import { Users } from 'lucide-react';

export const UserManagement: React.FC = () => {
  return (
    <MainLayout>
      <ProtectedFeature requiredRole="admin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-rubik">ניהול משתמשים</h1>
              <p className="text-gray-600 font-rubik">חפש ונהל משתמשים במערכת</p>
            </div>
          </div>

          {/* User Search Component */}
          <AdminUserSearch />
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
