
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedFeature } from '@/components/ProtectedFeature';
import { SubscriptionPlanEditor } from '@/components/admin/SubscriptionPlanEditor';
import { SimpleUserSearch } from '@/components/admin/SimpleUserSearch';
import { AdminDataManagement } from '@/components/admin/AdminDataManagement';
import { AdminSystemSettings } from '@/components/admin/AdminSystemSettings';
import { EmailManagement } from '@/components/admin/EmailManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Crown, Database, Cog, Mail } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  return (
    <MainLayout>
      <ProtectedFeature requiredRole="admin">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Settings className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-rubik">פאנל ניהול מתקדם</h1>
              <p className="text-gray-600 font-rubik">ניהול מלא של המערכת, תוכניות מנוי ומשתמשים</p>
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="plans" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="plans" className="font-rubik flex items-center gap-2">
                <Crown className="w-4 h-4" />
                תוכניות מנוי
              </TabsTrigger>
              <TabsTrigger value="users" className="font-rubik flex items-center gap-2">
                <Users className="w-4 h-4" />
                ניהול משתמשים
              </TabsTrigger>
              <TabsTrigger value="emails" className="font-rubik flex items-center gap-2">
                <Mail className="w-4 h-4" />
                ניהול מיילים
              </TabsTrigger>
              <TabsTrigger value="data" className="font-rubik flex items-center gap-2">
                <Database className="w-4 h-4" />
                ניהול נתונים
              </TabsTrigger>
              <TabsTrigger value="system" className="font-rubik flex items-center gap-2">
                <Cog className="w-4 h-4" />
                הגדרות מערכת
              </TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-6">
              <SubscriptionPlanEditor />
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <SimpleUserSearch />
            </TabsContent>

            <TabsContent value="emails" className="space-y-6">
              <EmailManagement />
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <AdminDataManagement />
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <AdminSystemSettings />
            </TabsContent>
          </Tabs>
        </div>
      </ProtectedFeature>
    </MainLayout>
  );
};
