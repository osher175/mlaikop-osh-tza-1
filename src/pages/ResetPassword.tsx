
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const ResetPassword = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isTokenChecked, setIsTokenChecked] = useState(false);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Check for access token and authenticate user
  useEffect(() => {
    const checkAccessToken = async () => {
      try {
        // Check URL hash for access_token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (!accessToken) {
          console.log('No access token found in URL');
          setIsTokenChecked(true);
          return;
        }

        // Set the session using the tokens from URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error('Error setting session:', error);
          toast({
            title: 'שגיאת אימות',
            description: 'הקישור שלך לא תקף או שפג תוקפו. אנא בקש קישור חדש.',
            variant: 'destructive',
          });
        } else if (data.session) {
          console.log('Session set successfully for password reset');
          setIsValidToken(true);
        }
      } catch (error) {
        console.error('Error checking access token:', error);
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בעת אימות הקישור',
          variant: 'destructive',
        });
      } finally {
        setIsTokenChecked(true);
      }
    };

    checkAccessToken();
  }, [toast]);

  // Redirect if no valid token after check is complete
  useEffect(() => {
    if (isTokenChecked && !isValidToken && !user) {
      toast({
        title: 'גישה נדחתה',
        description: 'אנא לחץ על הקישור שנשלח למייל שלך כדי לאפס את הסיסמה',
        variant: 'destructive',
      });
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    }
  }, [isTokenChecked, isValidToken, user, navigate, toast]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.password.trim() || !formData.confirmPassword.trim()) {
      toast({
        title: 'שגיאה',
        description: 'אנא מלא את כל השדות',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמאות אינן תואמות',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'שגיאה',
        description: 'הסיסמה חייבת להכיל לפחות 6 תווים',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) {
        toast({
          title: 'שגיאה בעדכון הסיסמה',
          description: 'לא הצלחנו לעדכן את הסיסמה. אנא נסה שוב.',
          variant: 'destructive',
        });
        console.error('Password update error:', error);
      } else {
        setIsSuccess(true);
        toast({
          title: 'הסיסמה עודכנה בהצלחה!',
          description: 'עכשיו תוכל להתחבר עם הסיסמה החדשה',
        });
        
        // Log successful password reset
        console.log('Password reset completed for user:', user?.email, 'at', new Date().toISOString());
        
        // Redirect to auth page after 3 seconds
        setTimeout(() => {
          navigate('/auth');
        }, 3000);
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

  // Loading state while checking token
  if (!isTokenChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 text-center">
            <CardContent className="pt-8 pb-8">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-medium text-gray-900">בודק את הקישור...</h2>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error state for invalid token
  if (isTokenChecked && !isValidToken && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 text-center">
            <CardContent className="pt-8 pb-8">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">קישור לא תקף</h2>
              <p className="text-gray-600 mb-4">הקישור לאיפוס הסיסמה לא תקף או שפג תוקפו</p>
              <p className="text-sm text-gray-500">מעביר אותך לדף ההתחברות...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">הסיסמה עודכנה בהצלחה!</h2>
              <p className="text-gray-600 mb-4">עכשיו תוכל להתחבר עם הסיסמה החדשה</p>
              <p className="text-sm text-gray-500">מעביר אותך לדף ההתחברות...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main reset password form
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
            <CardTitle className="text-2xl text-gray-900">הגדרת סיסמה חדשה</CardTitle>
            <CardDescription className="text-gray-600">
              אנא הזן את הסיסמה החדשה שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">סיסמה חדשה</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="הזן סיסמה חדשה (לפחות 6 תווים)"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="text-right pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">אישור סיסמה</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="הזן שוב את הסיסמה החדשה"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    className="text-right pl-10"
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

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-600 text-white font-medium py-2.5"
                disabled={isLoading}
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
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  className="text-sm text-gray-500 hover:underline p-0"
                  onClick={() => navigate('/auth')}
                >
                  חזור לדף התחברות
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
