
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

export const ResetPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (cooldown > 0) {
      interval = setInterval(() => {
        setCooldown(cooldown - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldown]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן כתובת אימייל',
        variant: 'destructive',
      });
      return;
    }

    if (cooldown > 0) {
      toast({
        title: 'המתן',
        description: `אנא המתן ${cooldown} שניות לפני שליחה נוספת`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/set-new-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          toast({
            title: 'יותר מדי ניסיונות',
            description: 'אנא המתן מספר דקות לפני ניסיון נוסף',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'שגיאה בשליחת הקישור',
            description: 'לא הצלחנו לשלוח את הקישור. ודא שכתובת המייל שהזנת רשומה במערכת.',
            variant: 'destructive',
          });
        }
      } else {
        setEmailSent(true);
        setCooldown(60); // 60 seconds cooldown
        toast({
          title: 'קישור נשלח בהצלחה!',
          description: 'קישור לאיפוס הסיסמה נשלח למייל שלך. אנא בדוק את תיבת הדואר.',
        });
        
        console.log('Password reset sent to:', email, 'at', new Date().toISOString());
      }
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בלתי צפויה',
        variant: 'destructive',
      });
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mlaiko-gradient rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mlaiko</h1>
          <p className="text-gray-600 text-center">איפוס סיסמה</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">
              {emailSent ? 'אימייל נשלח!' : 'שכחת סיסמה?'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {emailSent 
                ? 'בדוק את תיבת המייל שלך ולחץ על הקישור'
                : 'הזן את כתובת המייל שלך ונשלח לך קישור לאיפוס הסיסמה'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">כתובת אימייל</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-right"
                    disabled={isLoading}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-2.5"
                  disabled={isLoading || cooldown > 0}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      שולח...
                    </>
                  ) : cooldown > 0 ? (
                    `המתן ${cooldown} שניות`
                  ) : (
                    <>
                      שלח קישור לאיפוס הסיסמה
                      <ArrowRight className="mr-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-800 font-medium mb-2">
                    קישור לאיפוס סיסמה נשלח למייל שלך
                  </p>
                  <p className="text-green-600 text-sm">
                    בדוק את תיבת הדואר שלך (כולל תיקיית הספאם) ולחץ על הקישור כדי להגדיר סיסמה חדשה
                  </p>
                </div>
                
                <Button 
                  onClick={() => setEmailSent(false)}
                  variant="outline"
                  className="w-full"
                  disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `שלח שוב (${cooldown}s)` : 'שלח שוב'}
                </Button>
              </div>
            )}
            
            {/* Back to Login Link */}
            <div className="text-center mt-6">
              <Link to="/auth" className="inline-flex items-center text-primary hover:text-primary-600 text-sm font-medium transition-colors">
                <ArrowLeft className="ml-1 h-4 w-4" />
                חזרה להתחברות
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>פלטפורמת Mlaiko - ניהול מלאי מתקדם</p>
        </div>
      </div>
    </div>
  );
};
