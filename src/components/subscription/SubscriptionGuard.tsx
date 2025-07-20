
import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Crown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
  const [searchParams] = useSearchParams();
  const [isCreatingTrial, setIsCreatingTrial] = useState(false);

  // Log subscription access for monitoring
  useEffect(() => {
    if (user && requiresSubscription) {
      console.log('SubscriptionGuard accessed:', {
        userId: user.id,
        email: user.email,
        subscriptionStatus: subscription?.status,
        trialValid: isTrialValid,
        daysLeft: daysLeftInTrial,
        timestamp: new Date().toISOString()
      });
    }
  }, [user, subscription, isTrialValid, daysLeftInTrial, requiresSubscription]);

  useEffect(() => {
    // Create trial subscription for new users
    if (user && !subscription && requiresSubscription) {
      console.log('Creating trial subscription for new user:', user.email);
      setIsCreatingTrial(true);
      createTrialSubscription().finally(() => {
        setIsCreatingTrial(false);
      });
    }
  }, [user, subscription, requiresSubscription, createTrialSubscription]);

  // Check if trial has expired and redirect accordingly
  useEffect(() => {
    if (user && subscription && subscription.status === 'trial' && !isTrialValid && requiresSubscription) {
      console.log('Trial expired for user:', user.email, 'Redirecting to subscribe page');
      navigate('/subscribe?expired=true&userId=' + user.id + '&email=' + encodeURIComponent(user.email));
    }
  }, [user, subscription, isTrialValid, requiresSubscription, navigate]);

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
  if (isSubscriptionActive && isTrialValid) {
    // Show trial warning if in trial period with days remaining info
    if (subscription?.status === 'trial' && daysLeftInTrial > 0) {
      return (
        <div className="space-y-4">
          <Card className={`border-2 ${daysLeftInTrial <= 3 ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`} dir="rtl">
            <CardContent className="p-4">
              <div className={`flex items-center gap-2 ${daysLeftInTrial <= 3 ? 'text-red-700' : 'text-orange-700'}`}>
                <Crown className="h-5 w-5" />
                <span className="font-medium">
                  {daysLeftInTrial <= 3 
                    ? `⚠️ תקופת הניסיון מסתיימת בעוד ${daysLeftInTrial} ימים בלבד!`
                    : `נותרו ${daysLeftInTrial} ימים בתקופת הניסיון החינמית`
                  }
                </span>
              </div>
              <Button 
                variant={daysLeftInTrial <= 3 ? "destructive" : "outline"}
                size="sm" 
                className="mt-2"
                onClick={() => navigate(`/subscribe?userId=${user?.id}&email=${encodeURIComponent(user?.email || '')}`)}
              >
                {daysLeftInTrial <= 3 ? 'שדרג עכשיו!' : 'שדרג עכשיו'}
              </Button>
            </CardContent>
          </Card>
          {children}
        </div>
      );
    }

    return <>{children}</>;
  }

  // Show subscription required message with user info
  const isExpired = searchParams.get('expired') === 'true';
  
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full" dir="rtl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className={`h-12 w-12 ${isExpired ? 'text-red-500' : 'text-orange-500'}`} />
          </div>
          <CardTitle className="text-xl">
            {isExpired ? 'תקופת הניסיון הסתיימה' : 'נדרש מנוי פעיל'}
          </CardTitle>
          {user && (
            <div className="text-sm text-gray-600 mt-2">
              <p>משתמש: {user.email}</p>
              {daysLeftInTrial === 0 && subscription?.trial_ends_at && (
                <p>תקופת הניסיון הסתיימה ב: {new Date(subscription.trial_ends_at).toLocaleDateString('he-IL')}</p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            {isExpired 
              ? 'תקופת הניסיון החינמית שלך הסתיימה. כדי להמשיך להשתמש במערכת, יש לבחור תוכנית מנוי.'
              : 'כדי לגשת לתוכן זה, יש צורך במנוי פעיל'
            }
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => navigate(`/subscribe?userId=${user?.id}&email=${encodeURIComponent(user?.email || '')}&expired=${isExpired}`)} 
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
