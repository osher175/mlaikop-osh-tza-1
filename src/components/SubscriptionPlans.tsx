
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Sparkles } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export const SubscriptionPlans: React.FC = () => {
  const { userRole } = useUserRole();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans-new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans_new')
        .select('*')
        .order('storage_limit', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'free':
        return <Sparkles className="w-6 h-6 text-green-500" />;
      case 'starter':
        return <Crown className="w-6 h-6 text-green-600" />;
      case 'premium1':
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 'premium2':
        return <Zap className="w-6 h-6 text-blue-500" />;
      case 'premium3':
        return <Star className="w-6 h-6 text-purple-500" />;
      default:
        return <Sparkles className="w-6 h-6 text-gray-500" />;
    }
  };

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'free':
        return 'חינמי';
      case 'starter':
        return 'מתחילים';
      case 'premium1':
        return 'פרימיום 1';
      case 'premium2':
        return 'פרימיום 2';
      case 'premium3':
        return 'פרימיום 3';
      default:
        return plan;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[...Array(5)].map((_, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {plans?.map((plan) => (
          <Card 
            key={plan.plan} 
            className={`relative ${plan.plan === 'premium2' ? 'border-blue-500 shadow-lg' : ''}`}
          >
            {plan.plan === 'premium2' && (
              <Badge className="absolute -top-2 right-4 bg-blue-500">מומלץ</Badge>
            )}
            
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                {getPlanIcon(plan.plan)}
              </div>
              <CardTitle className="text-xl">{getPlanDisplayName(plan.plan)}</CardTitle>
              <CardDescription className="text-2xl font-bold text-primary">
                {plan.plan === 'free' ? 'חינם' : 'צור קשר'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{plan.storage_limit}GB אחסון</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>
                    {plan.user_limit === -1 ? 'משתמשים ללא הגבלה' : `עד ${plan.user_limit} משתמשים`}
                  </span>
                </div>

                {plan.ai_credit > 0 && (
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>
                      {plan.ai_credit === -1 ? 'AI ללא הגבלה' : `₪${plan.ai_credit} קרדיט AI`}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>תמיכה {plan.support_level === 'basic' ? 'בסיסית' : 
                              plan.support_level === 'standard' ? 'סטנדרטית' :
                              plan.support_level === 'advanced' ? 'מתקדמת' : 'VIP'}</span>
                </div>
              </div>

              <Button className="w-full bg-primary hover:bg-primary-600">
                בחר תוכנית
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
