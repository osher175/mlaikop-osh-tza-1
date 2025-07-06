
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SummaryGrid } from '@/components/dashboard/SummaryGrid';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';
import { SuppliersChart } from '@/components/dashboard/SuppliersChart';
import { MonthlyPurchasesChart } from '@/components/dashboard/MonthlyPurchasesChart';
import { NotificationPanel } from '@/components/dashboard/NotificationPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { userRole, permissions } = useUserRole();
  const navigate = useNavigate();

  const handleNavigateToAdmin = () => {
    console.log('Navigating to admin settings...');
    navigate('/admin/settings');
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Admin Navigation Helper - Only show for platform admins */}
        {permissions.isPlatformAdmin && (
          <Card className="border-2 border-red-200 bg-red-50" dir="rtl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-red-700 font-rubik flex items-center gap-2">
                <Settings className="w-5 h-5" />
                פאנל ניהול מערכת
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600 font-rubik mb-4">
                אתה מנהל מערכת! ניתן לגשת לפאנל הניהול המתקדם כדי לנהל משתמשים ותוכניות מנוי.
              </p>
              <Button 
                onClick={handleNavigateToAdmin}
                className="bg-red-600 hover:bg-red-700 text-white font-rubik"
              >
                <ArrowLeft className="w-4 h-4 ml-2" />
                עבור לפאנל ניהול
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Dashboard Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-rubik">לוח הבקרה</h1>
          <p className="text-gray-600 font-rubik">סקירה כללית של המלאי והפעילות העסקית</p>
        </div>

        {/* Summary Cards */}
        <SummaryGrid />

        {/* BI Analytics Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RevenueChart />
          <TopProductsChart />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SuppliersChart />
          <MonthlyPurchasesChart />
        </div>

        {/* Additional Dashboard Components */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
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
