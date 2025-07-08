
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Bell, MessageCircle, User, Building } from 'lucide-react';
import { WhatsAppNotificationsManager } from '@/components/whatsapp/WhatsAppNotificationsManager';
import { NotificationManagement } from '@/components/notifications/NotificationManagement';
import { ProtectedFeature } from '@/components/ProtectedFeature';

export const Settings: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        <div className="text-hebrew">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            הגדרות
          </h1>
          <p className="text-gray-600">
            נהל את הגדרות המערכת, ההתראות והאוטומציות
          </p>
        </div>

        <ProtectedFeature requiredRole="OWNER">
          <Tabs defaultValue="notifications" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                התראות
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="general" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                כללי
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notifications" className="space-y-6">
              <NotificationManagement />
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-6">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">
                    אוטומציה לשליחת הודעות WhatsApp
                  </h3>
                  <p className="text-blue-700 text-sm">
                    כאשר מוצר מגיע למלאי 0 ואוטומציית WhatsApp מופעלת עבורו, 
                    תיווצר הודעה אוטומטית לספק לבקשת הצעת מחיר.
                  </p>
                </div>
                <WhatsAppNotificationsManager />
              </div>
            </TabsContent>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    הגדרות כלליות
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8 text-gray-500">
                      הגדרות כלליות יתווספו בעתיד
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ProtectedFeature>
      </div>
    </MainLayout>
  );
};
