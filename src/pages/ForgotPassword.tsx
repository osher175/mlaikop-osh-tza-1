
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const ForgotPassword = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בשליחת המייל. אנא נסה שוב.',
          variant: 'destructive',
        });
      } else {
        setEmailSent(true);
        toast({
          title: 'מייל נשלח בהצלחה!',
          description: 'בדוק את תיבת המייל שלך ולחץ על הקישור לאיפוס הסיסמה',
        });
      }
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בלתי צפויה',
        variant: 'destructive',
      });
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
          <p className="text-gray-600 text-center">מערכת ניהול מלאי חכמה</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">איפוס סיסמה לחשבון</CardTitle>
            <CardDescription className="text-gray-600">
              {emailSent 
                ? 'מייל איפוס סיסמה נשלח לכתובת שלך'
                : 'הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">כתובת אימייל</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="text-right"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-2.5"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    'שלח לי קישור לאיפוס הסיסמה'
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-gray-600">
                  קישור לאיפוס הסיסמה נשלח לכתובת: <strong>{email}</strong>
                </p>
                <p className="text-sm text-gray-500">
                  לא קיבלת את המייל? בדוק בתיקיית הספאם או נסה שוב
                </p>
              </div>
            )}
            
            <div className="mt-6 text-center">
              <Link 
                to="/auth" 
                className="inline-flex items-center text-sm text-primary hover:text-primary-600 transition-colors"
              >
                <ArrowRight className="w-4 h-4 ml-1" />
                חזרה לדף ההתחברות
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
