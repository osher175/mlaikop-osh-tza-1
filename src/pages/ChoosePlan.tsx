
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Star, Sparkles } from 'lucide-react';

export const ChoosePlan: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

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

  const selectPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Update user profile with selected plan
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ selected_plan_id: planId })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Assign OWNER role
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: 'OWNER' })
        .eq('user_id', user.id);

      if (roleError) throw roleError;

      return planId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-role'] });
      toast({
        title: "תוכנית נבחרה בהצלחה",
        description: "אתה יכול כעת לגשת לכל התכונות",
      });
      navigate('/');
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בבחירת התוכנית",
        variant: "destructive",
      });
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

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    selectPlanMutation.mutate(planId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">טוען תוכניות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">בחר את התוכנית המתאימה לך</h1>
          <p className="text-xl text-gray-600">התחל את המסע שלך עם מלאיקו</p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 font-medium">
              נדרש לבחור תוכנית כדי לגשת למערכת הניהול
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {plans?.map((plan) => (
            <Card 
              key={plan.plan} 
              className={`relative transition-all duration-200 hover:shadow-lg cursor-pointer ${
                selectedPlan === plan.plan ? 'ring-2 ring-primary shadow-lg' : ''
              } ${plan.plan === 'premium2' ? 'border-blue-500 shadow-lg' : ''}`}
              onClick={() => handlePlanSelect(plan.plan)}
            >
              {plan.plan === 'premium2' && (
                <Badge className="absolute -top-2 right-4 bg-blue-500">מומלץ</Badge>
              )}
              
              <CardHeader className="text-center">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.plan)}
                </div>
                <CardTitle className="text-xl">{getPlanDisplayName(plan.plan)}</CardTitle>
                <div className="text-2xl font-bold text-primary">
                  {plan.plan === 'free' ? 'חינם' : 'צור קשר'}
                </div>
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

                <Button 
                  className="w-full bg-primary hover:bg-primary-600"
                  disabled={selectPlanMutation.isPending}
                >
                  {selectPlanMutation.isPending && selectedPlan === plan.plan 
                    ? 'בוחר...' 
                    : 'בחר תוכנית זו'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
