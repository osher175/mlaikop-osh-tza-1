import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Package, Zap, HardDrive, Users, HeadphonesIcon } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export const SubscriptionPlans: React.FC = () => {
  const { userRole } = useUserRole();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const getPlanIcon = (plan: string): JSX.Element => {
    switch (plan) {
      case 'Basic':
        return <Package className="w-6 h-6 text-amber-500" />;
      case 'Pro':
        return <Crown className="w-6 h-6 text-blue-500" />;
      default:
        return <Package className="w-6 h-6 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">תוכניות מנוי</h2>
        <p className="text-gray-600">בחר את התוכנית המתאימה לעסק שלך</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans?.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.name === 'Pro' ? 'ring-2 ring-primary' : ''}`}>
            {plan.name === 'Pro' && (
              <Badge className="absolute -top-2 right-4 bg-primary text-white">
                מומלץ
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                {getPlanIcon(plan.name)}
                {plan.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold text-primary">
                ₪{plan.monthly_price}
                <span className="text-sm font-normal text-gray-600">/חודש</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-gray-500" />
                  <span>אחסון: {plan.storage_gb}GB</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>משתמשים: {plan.max_users === -1 ? 'ללא הגבלה' : plan.max_users}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span>AI גישה: {plan.ai_access ? 'כלול' : 'לא כלול'}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <HeadphonesIcon className="w-4 h-4 text-gray-500" />
                  <span>תמיכה: בסיסית</span>
                </div>
              </div>
              
              <Button className="w-full">
                בחר תוכנית
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};