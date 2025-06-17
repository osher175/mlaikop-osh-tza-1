
import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { PlanManagement } from '@/components/admin/PlanManagement';
import { UserSearchPanel } from '@/components/admin/UserSearchPanel';
import { SubscriptionEditor } from '@/components/admin/SubscriptionEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Crown, BarChart3 } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [editingSubscription, setEditingSubscription] = useState<{
    userId: string;
    currentPlan: string;
    expiryDate?: Date;
  } | null>(null);

  const handleSaveSubscription = (planId: string, expiryDate: Date) => {
    console.log('Saving subscription:', { planId, expiryDate });
    // TODO: Implement actual save logic with Supabase
    setEditingSubscription(null);
  };

  return (
    <MainLayout>
      <ProtectedFeature requiredPermission="isPlatformAdmin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Settings className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-rubik">הגדרות מערכת - מנהל</h1>
              <p className="text-gray-600 font-rubik">ניהול תוכניות מנוי ומשתמשים</p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600 font-rubik">סה"כ משתמשים</p>
                    <p className="text-2xl font-bold font-rubik">1,247</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-sm text-gray-600 font-rubik">מנויים פעילים</p>
                    <p className="text-2xl font-bold font-rubik">568</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600 font-rubik">הכנסה חודשית</p>
                    <p className="text-2xl font-bold font-rubik">₪255,600</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600 font-rubik">משתמשים חדשים</p>
                    <p className="text-2xl font-bold font-rubik">89</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="plans" className="font-rubik">ניהול תוכניות</TabsTrigger>
              <TabsTrigger value="users" className="font-rubik">ניהול משתמשים</TabsTrigger>
              <TabsTrigger value="analytics" className="font-rubik">אנליטיקס</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-6">
              <PlanManagement />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UserSearchPanel />
                
                {editingSubscription && (
                  <SubscriptionEditor
                    userId={editingSubscription.userId}
                    currentPlan={editingSubscription.currentPlan}
                    expiryDate={editingSubscription.expiryDate}
                    onSave={handleSaveSubscription}
                    onCancel={() => setEditingSubscription(null)}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-rubik">אנליטיקס פלטפורמה</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 font-rubik">תכונות אנליטיקס מתקדמות יהיו זמינות בקרוב...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
