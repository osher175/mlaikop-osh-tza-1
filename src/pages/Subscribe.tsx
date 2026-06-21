// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md

import React, { Suspense, useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatCurrency';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Loading component for better UX
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
      <p className="text-gray-600">טוען תוכניות מנוי...</p>
    </div>
  </div>
);

export const Subscribe: React.FC = () => {
  const { user } = useAuth();
  const { plans, subscription, daysLeftInTrial, isTrialValid } = useSubscription();
  const { activeBusinessId } = useActiveBusiness();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  
  const isExpired = searchParams.get('expired') === 'true';
  const userIdFromUrl = searchParams.get('userId');
  const emailFromUrl = searchParams.get('email');

  // Log page access for monitoring
  useEffect(() => {
    console.log('Subscribe page accessed:', {
      userId: user?.id || userIdFromUrl,
      email: user?.email || emailFromUrl,
      isExpired,
      subscriptionStatus: subscription?.status,
      trialValid: isTrialValid,
      daysLeft: daysLeftInTrial,
      timestamp: new Date().toISOString(),
      referrer: document.referrer
    });

    // Simulate loading delay reduction
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [user, userIdFromUrl, emailFromUrl, isExpired, subscription, isTrialValid, daysLeftInTrial]);

  const handleSelectPlan = async (planId: string, isSelectable: boolean) => {
    if (!isSelectable || pendingPlanId) return;

    if (!user) {
      toast.error('יש להתחבר כדי לבחור מסלול');
      return;
    }
    if (!activeBusinessId) {
      toast.error('לא נמצא עסק פעיל למשתמש');
      return;
    }

    setPendingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke('grow-start-checkout', {
        body: { business_id: activeBusinessId, plan_id: planId },
      });

      if (error) {
        const msg = (error as any)?.message || '';
        if (/phone/i.test(msg)) toast.error('חסר מספר טלפון בפרופיל');
        else if (/email/i.test(msg)) toast.error('חסרה כתובת אימייל בפרופיל');
        else if (/business/i.test(msg)) toast.error('בעיה בזיהוי העסק');
        else if (/plan/i.test(msg)) toast.error('המסלול לא נמצא');
        else if (/unauth|forbidden|401|403/i.test(msg)) toast.error('אין הרשאה לבצע פעולה זו');
        else if (/checkout_link_failed|502/i.test(msg)) toast.error('שגיאה ביצירת קישור התשלום, נסה שוב');
        else toast.error('שגיאה ביצירת בקשת התשלום');
        console.error('grow-start-checkout error:', error);
        return;
      }

      const checkoutUrl = (data as any)?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      toast.error('לא התקבל קישור תשלום, נסה שוב בעוד רגע');
      console.error('grow-start-checkout returned without checkout_url:', data);
    } catch (e) {
      console.error('Unexpected error creating subscription:', e);
      toast.error('שגיאה לא צפויה ביצירת התשלום');
    } finally {
      setPendingPlanId(null);
    }
  };

  const getPlanIcon = (planName: string) => {
    switch (planName.toLowerCase()) {
      case 'basic':
        return <Crown className="w-6 h-6 text-blue-500" />;
      case 'pro':
        return <Star className="w-6 h-6 text-purple-500" />;
      default:
        return <Zap className="w-6 h-6 text-gray-500" />;
    }
  };

  const formatPrice = (price: number) => {
    return formatCurrency(price);
  };

  const currentUser = user || { id: userIdFromUrl, email: emailFromUrl };

  if (isLoading || !plans) {
    return (
      <MainLayout>
        <LoadingSpinner />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
        {/* Header with user info */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            בחר את התוכנית המתאימה לך
          </h1>
          <p className="text-lg text-gray-600">
            התחל עם ניסיון חינם של 30 יום, ללא התחייבות
          </p>
          {currentUser?.email && (
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
              <p>משתמש מחובר: <strong>{currentUser.email}</strong></p>
              {currentUser.id && <p className="text-xs mt-1">מזהה: {currentUser.id}</p>}
            </div>
          )}
        </div>

        {/* Trial Status */}
        {subscription?.status === 'trial' && (
          <Card className={`border-2 ${isExpired ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
            <CardContent className="p-6 text-center">
              {isExpired ? (
                <div className="text-red-700">
                  <h3 className="text-lg font-semibold mb-2">⚠️ תקופת הניסיון הסתיימה</h3>
                  <p>כדי להמשיך להשתמש במערכת, יש לבחור תוכנית מנוי</p>
                  {subscription.trial_ends_at && (
                    <p className="text-sm mt-2">
                      תקופת הניסיון הסתיימה ב: {new Date(subscription.trial_ends_at).toLocaleDateString('he-IL')}
                    </p>
                  )}
                </div>
              ) : isTrialValid ? (
                <div className={`${daysLeftInTrial <= 3 ? 'text-red-700' : 'text-orange-700'}`}>
                  <h3 className="text-lg font-semibold mb-2">
                    {daysLeftInTrial <= 3 ? '🚨 תקופת ניסיון מסתיימת בקרוב!' : 'תקופת ניסיון פעילה'}
                  </h3>
                  <p>נותרו לך {daysLeftInTrial} ימים בתקופת הניסיון החינמית</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <Suspense fallback={<LoadingSpinner />}>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan: any) => {
              const isSelectable = plan.is_selectable !== false;
              return (
              <Card
                key={plan.id}
                className={`relative border-2 transition-all hover:shadow-lg ${
                  !isSelectable ? 'opacity-70 border-gray-200' : (plan.name === 'Pro' || plan.name === 'Advanced' ? 'border-purple-200 shadow-md' : 'border-gray-200')
                }`}
              >
                {!isSelectable && (
                  <Badge className="absolute -top-3 right-4 bg-gray-500 text-white">
                    בקרוב
                  </Badge>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-3">
                    {getPlanIcon(plan.name)}
                  </div>
                  <CardTitle className="text-2xl font-bold">
                    {plan.name}
                  </CardTitle>
                  <div className="space-y-1">
                    <div className="text-3xl font-bold text-primary">
                      {formatPrice(plan.monthly_price)}
                    </div>
                    <div className="text-sm text-gray-500">לחודש</div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Features */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900">כלול בתוכנית:</h4>
                    <ul className="space-y-2">
                      {plan.features?.map((feature: string, index: number) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>
                            {feature === 'inventory_management' && 'ניהול מלאי מתקדם'}
                            {feature === 'reports' && 'דוחות ואנליטיקה'}
                            {feature === 'charts' && 'גרפים ותצוגות חזותיות'}
                            {feature === 'ai_automations' && 'אוטומציות AI'}
                            {feature === 'accountant_export' && 'ייצוא לרואה חשבון'}
                            {typeof feature === 'string' && !['inventory_management', 'reports', 'charts', 'ai_automations', 'accountant_export'].includes(feature) && feature}
                          </span>
                        </li>
                      ))}
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{plan.storage_gb}GB אחסון</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>
                          {plan.max_users === -1 ? 'משתמשים ללא הגבלה' : `עד ${plan.max_users} משתמשים`}
                        </span>
                      </li>
                      {plan.ai_access && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span>גישה לכלי AI מתקדמים</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => handleSelectPlan(plan.id, isSelectable)}
                    disabled={!isSelectable || pendingPlanId !== null}
                    className={`w-full py-3 ${
                      !isSelectable
                        ? 'bg-gray-300 hover:bg-gray-300 cursor-not-allowed'
                        : (plan.name === 'Pro' || plan.name === 'Advanced'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-primary hover:bg-primary-600')
                    }`}
                    size="lg"
                  >
                    {pendingPlanId === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        יוצר עבורך קישור תשלום מאובטח...
                      </span>
                    ) : isSelectable ? 'בחר תוכנית זו' : 'בקרוב'}
                  </Button>

                  {/* Setup Fee Notice */}
                  {plan.setup_fee && plan.setup_fee > 0 && (
                    <p className="text-xs text-gray-500 text-center">
                      + {formatPrice(plan.setup_fee)} דמי הקמה חד פעמיים
                    </p>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        </Suspense>

        {/* Trial Info */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              🎉 התחל עם ניסיון חינם של 30 יום
            </h3>
            <p className="text-blue-700">
              כל התוכניות כוללות ניסיון חינם מלא ללא התחייבות. 
              תוכל לבטל בכל עת במהלך תקופת הניסיון.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};