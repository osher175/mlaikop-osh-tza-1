
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Sparkles } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import type { Database } from '@/integrations/supabase/types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

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
    },
  });

  const getPlanIcon = (role: string) => {
    switch (role) {
      case 'free_user':
        return <Sparkles className="w-6 h-6 text-green-500" />;
      case 'pro_starter_user':
        return <Crown className="w-6 h-6 text-amber-500" />;
      case 'smart_master_user':
        return <Zap className="w-6 h-6 text-blue-500" />;
      case 'elite_pilot_user':
        return <Star className="w-6 h-6 text-purple-500" />;
      default:
        return <Sparkles className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null || price === 0) return 'חינם';
    return `₪${price.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans?.map((plan) => {
          const isCurrentPlan = plan.role === userRole;
          const features = plan.features as any;

          return (
            <Card 
              key={plan.id} 
              className={`relative ${isCurrentPlan ? 'ring-2 ring-primary' : ''} ${
                plan.role === 'smart_master_user' ? 'border-blue-500 shadow-lg' : ''
              }`}
            >
              {plan.role === 'smart_master_user' && (
                <Badge className="absolute -top-2 right-4 bg-blue-500">מומלץ</Badge>
              )}
              
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.role)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-primary">
                  {formatPrice(plan.monthly_price)}
                  {plan.monthly_price && plan.monthly_price > 0 && (
                    <span className="text-sm text-gray-500">/חודש</span>
                  )}
                </CardDescription>
                {plan.setup_fee && plan.setup_fee > 0 && (
                  <p className="text-sm text-gray-600">
                    דמי הקמה: {formatPrice(plan.setup_fee)}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{plan.storage_gb}GB אחסון</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>
                      {plan.max_users === 999 ? 'משתמשים ללא הגבלה' : `עד ${plan.max_users} משתמשים`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>תוקף למשך {plan.duration_months} חודשים</span>
                  </div>

                  {plan.ai_access && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>גישה ל-AI</span>
                    </div>
                  )}

                  {features?.unlimited_inventory && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>מלאי ללא הגבלה</span>
                    </div>
                  )}

                  {features?.basic_reports && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>דוחות בסיסיים</span>
                    </div>
                  )}

                  {features?.advanced_reports && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>דוחות מתקדמים</span>
                    </div>
                  )}

                  {features?.priority_support && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>תמיכה עדיפה</span>
                    </div>
                  )}
                </div>

                <Button 
                  className={`w-full ${isCurrentPlan ? 'bg-gray-400' : 'bg-primary hover:bg-primary-600'}`}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? 'התוכנית הנוכחית' : 'בחר תוכנית'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
