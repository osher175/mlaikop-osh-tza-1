
import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ 
  children, 
  requiresSubscription = true 
}) => {
  const { user } = useAuth();
  const { subscription, isSubscriptionActive, isTrialValid, daysLeftInTrial, createTrialSubscription } = useSubscription();
  const navigate = useNavigate();
  const [isCreatingTrial, setIsCreatingTrial] = useState(false);

  useEffect(() => {
    // Create trial subscription for new users
    if (user && !subscription && requiresSubscription) {
      setIsCreatingTrial(true);
      createTrialSubscription().finally(() => {
        setIsCreatingTrial(false);
      });
    }
  }, [user, subscription, requiresSubscription, createTrialSubscription]);

  // Show loading while creating trial
  if (isCreatingTrial) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">מכין את החשבון שלך...</p>
        </div>
      </div>
    );
  }

  // If subscription is not required, show content
  if (!requiresSubscription) {
    return <>{children}</>;
  }

  // If user has active subscription or valid trial, show content
  if (isSubscriptionActive) {
    // Show trial warning if in trial period
    if (subscription?.status === 'trial' && isTrialValid) {
      return (
        <div className="space-y-4">
          <Card className="border-orange-200 bg-orange-50" dir="rtl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-700">
                <Crown className="h-5 w-5" />
                <span className="font-medium">
                  נותרו {daysLeftInTrial} ימים בתקופת הניסיון החינמית
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => navigate('/subscribe')}
              >
                שדרג עכשיו
              </Button>
            </CardContent>
          </Card>
          {children}
        </div>
      );
    }

    return <>{children}</>;
  }

  // Show subscription required message
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full" dir="rtl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-orange-500" />
          </div>
          <CardTitle className="text-xl">נדרש מנוי פעיל</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            {subscription?.status === 'trial' 
              ? 'תקופת הניסיון החינמית שלך הסתיימה'
              : 'כדי לגשת לתוכן זה, יש צורך במנוי פעיל'
            }
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/subscribe')} 
              className="w-full"
            >
              בחר תוכנית מנוי
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              חזור לעמוד הבית
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
