
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { 
  Shield, 
  Users, 
  BarChart3, 
  Settings, 
  AlertTriangle, 
  Database,
  Crown,
  TrendingUp,
  Activity,
  DollarSign
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const systemStats = {
    totalUsers: 1247,
    activeUsers: 892,
    totalRevenue: 125400,
    systemHealth: 98.5
  };

  const recentActivities = [
    { id: 1, action: 'משתמש חדש נרשם', user: 'יוסי כהן', time: '5 דקות' },
    { id: 2, action: 'שדרוג לפרימיום', user: 'מרים לוי', time: '15 דקות' },
    { id: 3, action: 'דוח שגיאה', user: 'מערכת', time: '1 שעה' },
    { id: 4, action: 'גיבוי מסד נתונים', user: 'מערכת', time: '2 שעות' },
  ];

  const alerts = [
    { id: 1, type: 'warning', message: 'שרת #2 עם עומס גבוה', time: '10 דקות' },
    { id: 2, type: 'info', message: 'עדכון מערכת זמין', time: '1 שעה' },
    { id: 3, type: 'error', message: 'שגיאה בתשלומים', time: '3 שעות' },
  ];

  return (
    <MainLayout>
      <ProtectedFeature requiredRole="admin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Shield className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">פאנל מנהל</h1>
              <p className="text-gray-600">ניהול מערכת ופיקוח על הפלטפורמה</p>
            </div>
          </div>

          {/* System Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">סה״כ משתמשים</p>
                    <p className="text-2xl font-bold">{systemStats.totalUsers}</p>
                    <p className="text-xs text-blue-500">+12% מהחודש הקודם</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Activity className="h-8 w-8 text-green-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">משתמשים פעילים</p>
                    <p className="text-2xl font-bold text-green-600">{systemStats.activeUsers}</p>
                    <p className="text-xs text-green-500">71.5% אקטיביות</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-purple-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">הכנסות חודשיות</p>
                    <p className="text-2xl font-bold text-purple-600">₪{systemStats.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-purple-500">+8.2% מהחודש הקודם</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">תקינות מערכת</p>
                    <p className="text-2xl font-bold text-orange-600">{systemStats.systemHealth}%</p>
                    <p className="text-xs text-orange-500">סטטוס: מצוין</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activities */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  פעילות אחרונה במערכת
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.user}</p>
                      </div>
                      <span className="text-xs text-gray-500">לפני {activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  התראות מערכת
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={
                          alert.type === 'error' ? 'bg-red-500' :
                          alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }>
                          {alert.type === 'error' ? 'שגיאה' :
                           alert.type === 'warning' ? 'אזהרה' : 'מידע'}
                        </Badge>
                        <span className="text-xs text-gray-500">לפני {alert.time}</span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Tools */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  ניהול משתמשים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  צפה בכל המשתמשים
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  נהל הרשאות
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  סטטיסטיקות משתמשים
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  ניהול מנויים
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  תוכניות מנוי
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  דוחות תשלומים
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  ניהול הנחות
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  ניהול מערכת
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  גיבוי מסד נתונים
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  עדכוני מערכת
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  לוגים ודוחות
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* System Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                אנליטיקס מערכת
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">85%</p>
                  <p className="text-sm text-gray-600">שביעות רצון משתמשים</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">2.4s</p>
                  <p className="text-sm text-gray-600">זמן טעינה ממוצע</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">99.2%</p>
                  <p className="text-sm text-gray-600">זמינות שרתים</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">156</p>
                  <p className="text-sm text-gray-600">תקלות נפתרו החודש</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
