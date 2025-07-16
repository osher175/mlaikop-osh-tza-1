
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const Subscribe: React.FC = () => {
  const { plans, subscription, daysLeftInTrial, isTrialValid } = useSubscription();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';

  const handleSelectPlan = async (planId: string) => {
    // This will be implemented when we add payment processing
    console.log('Selected plan:', planId);
    // For now, just show an alert
    alert('תכונת התשלום תתווסף בקרוב. אנא צרו קשר לרכישת מנוי.');
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
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            בחר את התוכנית המתאימה לך
          </h1>
          <p className="text-lg text-gray-600">
            התחל עם ניסיון חינם של 30 יום, ללא התחייבות
          </p>
        </div>

        {/* Trial Status */}
        {subscription?.status === 'trial' && (
          <Card className={`border-2 ${isExpired ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
            <CardContent className="p-6 text-center">
              {isExpired ? (
                <div className="text-red-700">
                  <h3 className="text-lg font-semibold mb-2">תקופת הניסיון הסתיימה</h3>
                  <p>כדי להמשיך להשתמש במערכת, יש לבחור תוכנית מנוי</p>
                </div>
              ) : isTrialValid ? (
                <div className="text-orange-700">
                  <h3 className="text-lg font-semibold mb-2">תקופת ניסיון פעילה</h3>
                  <p>נותרו לך {daysLeftInTrial} ימים בתקופת הניסיון החינמית</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative border-2 transition-all hover:shadow-lg ${
                plan.name === 'Pro' ? 'border-purple-200 shadow-md' : 'border-gray-200'
              }`}
            >
              {plan.name === 'Pro' && (
                <Badge className="absolute -top-3 right-4 bg-purple-500 text-white">
                  מומלץ
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
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>
                          {feature === 'inventory_management' && 'ניהול מלאי מתקדם'}
                          {feature === 'reports' && 'דוחות ואנליטיקה'}
                          {feature === 'charts' && 'גרפים ותצוגות חזותיות'}
                          {feature === 'ai_automations' && 'אוטומציות AI'}
                          {feature === 'accountant_export' && 'ייצוא לרואה חשבון'}
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
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-3 ${
                    plan.name === 'Pro' 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-primary hover:bg-primary-600'
                  }`}
                  size="lg"
                >
                  בחר תוכנית זו
                </Button>

                {/* Setup Fee Notice */}
                {plan.setup_fee > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    + {formatPrice(plan.setup_fee)} דמי הקמה חד פעמיים
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

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
