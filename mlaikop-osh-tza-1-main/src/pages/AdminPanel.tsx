
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { AdminUserSearch } from '@/components/admin/AdminUserSearch';
import { Users, Settings, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const AdminPanel: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <ProtectedFeature requiredRole="admin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-rubik">פאנל ניהול</h1>
              <p className="text-gray-600 font-rubik">ניהול משתמשים והגדרות המערכת</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin-dashboard')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  דשבורד מנהל
                </CardTitle>
                <CardDescription>
                  צפה בסטטיסטיקות ונתונים כלליים
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/users')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  ניהול משתמשים מתקדם
                </CardTitle>
                <CardDescription>
                  עבור לעמוד ניהול משתמשים המלא
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/settings')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  הגדרות מערכת
                </CardTitle>
                <CardDescription>
                  נהל הגדרות כלליות של המערכת
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* User Search Section */}
          <AdminUserSearch />
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
