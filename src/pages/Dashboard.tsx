
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { MonthlyProfitChart } from '@/components/dashboard/MonthlyProfitChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { useNotificationChecker } from '@/hooks/useNotificationChecker';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Brain, Users, Settings } from 'lucide-react';

export const Dashboard: React.FC = () => {
  // Initialize notification checking
  useNotificationChecker();
  const { user } = useAuth();

  // Get user's first name for welcome message
  const userName = user?.user_metadata?.first_name || 'משתמש';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            שלום, {userName}!
          </h1>
          <p className="text-gray-600">
            סקירה כללית של המלאי והפעילות העסקית שלך
          </p>
        </div>

        {/* Summary Cards */}
        <SummaryGrid />

        {/* Monthly Profit Chart */}
        <MonthlyProfitChart />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <QuickActions />
            
            {/* Advanced Reports - Pro Starter and above */}
            <ProtectedFeature requiredRole="pro_starter_user">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" dir="rtl">
                    <BarChart3 className="w-5 h-5" />
                    דוחות מתקדמים
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600" dir="rtl">
                    גישה לדוחות מתקדמים וניתוח מכירות מפורט
                  </p>
                </CardContent>
              </Card>
            </ProtectedFeature>
          </div>
          
          <div className="space-y-6">
            <NotificationPanel />
            
            {/* AI Features - Smart Master and above */}
            <ProtectedFeature requiredRole="smart_master_user">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" dir="rtl">
                    <Brain className="w-5 h-5" />
                    תכונות AI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600" dir="rtl">
                    המלצות חכמות, חיזוי מכירות וניתוח מגמות
                  </p>
                </CardContent>
              </Card>
            </ProtectedFeature>

            {/* Team Management - Elite Pilot only */}
            <ProtectedFeature requiredRole="elite_pilot_user">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" dir="rtl">
                    <Users className="w-5 h-5" />
                    ניהול צוות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600" dir="rtl">
                    ניהול משתמשים, הרשאות ותמיכה עדיפה
                  </p>
                </CardContent>
              </Card>
            </ProtectedFeature>

            {/* Admin Panel - Admin only */}
            <ProtectedFeature requiredRole="admin">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" dir="rtl">
                    <Settings className="w-5 h-5" />
                    פאנל מנהל
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600" dir="rtl">
                    ניהול מערכת, הגדרות גלובליות ומעקב אחר כל המשתמשים
                  </p>
                </CardContent>
              </Card>
            </ProtectedFeature>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};
