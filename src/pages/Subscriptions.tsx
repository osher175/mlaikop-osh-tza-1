
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { SubscriptionPlans } from '@/components/SubscriptionPlans';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Star } from 'lucide-react';

export const Subscriptions: React.FC = () => {
  const { userRole, getRoleDisplayName } = useUserRole();

  const getRoleIcon = () => {
    switch (userRole) {
      case 'elite_pilot_user':
        return <Star className="w-6 h-6 text-purple-500" />;
      case 'smart_master_user':
        return <Crown className="w-6 h-6 text-blue-500" />;
      case 'pro_starter_user':
        return <Crown className="w-6 h-6 text-amber-500" />;
      default:
        return <Crown className="w-6 h-6 text-gray-500" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8" dir="rtl">
        {/* Current Plan Section */}
        <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {getRoleIcon()}
              התוכנית הנוכחית שלך
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge className="bg-primary text-white px-4 py-2 text-lg">
                {getRoleDisplayName(userRole)}
              </Badge>
              <p className="text-gray-600">
                אתה מנוי כרגע לתוכנית {getRoleDisplayName(userRole)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* All Plans */}
        <SubscriptionPlans />
      </div>
    </MainLayout>
  );
};
