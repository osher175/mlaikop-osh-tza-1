
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const SetNewPassword = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  // Password validation states
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    match: false,
  });

  // Check for valid session on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // First check if we have URL parameters for the reset
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (type === 'recovery' && accessToken && refreshToken) {
          // Set the session with the tokens from the URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
            toast({
              title: 'קישור לא תקף',
              description: 'הקישור לאיפוס הסיסמה לא תקף או פג תוקף',
              variant: 'destructive',
            });
            navigate('/reset-password');
            return;
          }

          setIsValidToken(true);
        } else {
          // Check existing session
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            toast({
              title: 'גישה לא מורשית',
              description: 'אנא השתמש בקישור המייל לאיפוס הסיסמה',
              variant: 'destructive',
            });
            navigate('/reset-password');
            return;
          }

          setIsValidToken(true);
        }
      } catch (error) {
        console.error('Session check error:', error);
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בעת בדיקת ההרשאות',
          variant: 'destructive',
        });
        navigate('/reset-password');
      } finally {
        setIsCheckingToken(false);
      }
    };

    checkSession();
  }, [navigate, toast]);

  // Update password validation
  useEffect(() => {
    setPasswordValidation({
      length: newPassword.length >= 6,
      match: newPassword === confirmPassword && newPassword.length > 0,
    });
  }, [newPassword, confirmPassword]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.length) {
      toast({
        title: 'סיסמה לא תקינה',
        description: 'הסיסמה חייבת להכיל לפחות 6 תווים',
        variant: 'destructive',
      });
      return;
    }

    if (!passwordValidation.match) {
      toast({
        title: 'סיסמאות לא תואמות',
        description: 'הסיסמאות שהזנת אינן תואמות',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password - this will invalidate the old password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        toast({
          title: 'שגיאה בעדכון הסיסמה',
          description: 'לא הצלחנו לעדכן את הסיסמה. אנא נסה שוב.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'הסיסמה עודכנה בהצלחה!',
          description: 'הסיסמה שלך עודכנה. מפנה אותך לדף הבית...',
        });

        // Clear the URL hash to remove tokens
        window.history.replaceState({}, document.title, window.location.pathname);

        // Redirect to main page after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בלתי צפויה',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">מאמת הרשאות...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mlaiko-gradient rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mlaiko</h1>
          <p className="text-gray-600 text-center">הגדרת סיסמה חדשה</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">סיסמה חדשה</CardTitle>
            <CardDescription className="text-gray-600">
              הזן סיסמה חדשה חזקה עבור החשבון שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {/* New Password Field */}
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="הכנס סיסמה חדשה (לפחות 6 תווים)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="text-right pl-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אישור סיסמה</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="הכנס שוב את הסיסמה החדשה"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="text-right pl-10"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Password Validation Indicators */}
              {newPassword && (
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">דרישות סיסמה:</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {passwordValidation.length ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm ${passwordValidation.length ? 'text-green-700' : 'text-red-600'}`}>
                        לפחות 6 תווים
                      </span>
                    </div>
                    {confirmPassword && (
                      <div className="flex items-center gap-2">
                        {passwordValidation.match ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-sm ${passwordValidation.match ? 'text-green-700' : 'text-red-600'}`}>
                          הסיסמאות תואמות
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-2.5"
                disabled={isLoading || !passwordValidation.length || !passwordValidation.match}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    מעדכן סיסמה...
                  </>
                ) : (
                  'עדכן סיסמה'
                )}
              </Button>
            </form>
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
