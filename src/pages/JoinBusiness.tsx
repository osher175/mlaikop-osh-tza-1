
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface JoinBusinessFormData {
  businessName: string;
  fullName: string;
  jobTitle: string;
}

export const JoinBusiness: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<JoinBusinessFormData>();

  const onSubmit = async (data: JoinBusinessFormData) => {
    if (!user?.id) {
      toast({
        title: "שגיאה",
        description: "משתמש לא מחובר",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Find business by name (case-insensitive)
      const { data: businesses, error: searchError } = await supabase
        .from('businesses')
        .select('id, name')
        .ilike('name', data.businessName);

      if (searchError) {
        throw searchError;
      }

      if (!businesses || businesses.length === 0) {
        toast({
          title: "עסק לא נמצא",
          description: "לא נמצא עסק עם השם שהוקלד. ודא שהשם נכון.",
          variant: "destructive",
        });
        return;
      }

      const business = businesses[0];

      // Check if user already has a pending/approved request for this business
      const { data: existingRequest } = await supabase
        .from('business_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('business_id', business.id)
        .single();

      if (existingRequest) {
        const statusMessage = existingRequest.status === 'approved' 
          ? 'אתה כבר חבר בעסק זה'
          : existingRequest.status === 'pending'
          ? 'כבר שלחת בקשה לעסק זה. המתן לאישור.'
          : 'הבקשה שלך נדחתה. פנה לבעל העסק.';
        
        toast({
          title: "בקשה קיימת",
          description: statusMessage,
          variant: existingRequest.status === 'approved' ? "default" : "destructive",
        });
        return;
      }

      // Update user profile with full name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.fullName.split(' ')[0] || data.fullName,
          last_name: data.fullName.split(' ').slice(1).join(' ') || '',
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Create join request
      const { error: joinError } = await supabase
        .from('business_users')
        .insert({
          user_id: user.id,
          business_id: business.id,
          role: data.jobTitle,
          status: 'pending',
        });

      if (joinError) {
        throw joinError;
      }

      setIsSuccess(true);
      toast({
        title: "הבקשה נשלחה בהצלחה!",
        description: "הבקשה נשלחה לבעל העסק. לאחר אישור תוכל להתחבר למערכת.",
      });

    } catch (error: any) {
      console.error('Error joining business:', error);
      toast({
        title: "שגיאה בשליחת הבקשה",
        description: error.message || "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <Card className="shadow-xl border-0 text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">הבקשה נשלחה!</h2>
              <p className="text-gray-600 mb-6">
                הבקשה נשלחה לבעל העסק. לאחר אישור תוכל להתחבר למערכת.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                חזור להתחברות
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">הצטרפות לעסק קיים</h1>
          <p className="text-gray-600">מלא את הפרטים כדי לשלוח בקשת הצטרפות</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">פרטי ההצטרפות</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="businessName">שם העסק *</Label>
                <Input
                  id="businessName"
                  placeholder="הכנס שם העסק בדיוק כפי שמופיע במערכת"
                  {...register('businessName', { required: 'שם העסק חובה' })}
                  className="text-right"
                />
                {errors.businessName && <p className="text-sm text-red-600">{errors.businessName.message}</p>}
                <p className="text-xs text-gray-500">השם חייב להתאים בדיוק לשם העסק במערכת</p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">שם מלא *</Label>
                <Input
                  id="fullName"
                  placeholder="הכנס שם פרטי ומשפחה"
                  {...register('fullName', { required: 'שם מלא חובה' })}
                  className="text-right"
                />
                {errors.fullName && <p className="text-sm text-red-600">{errors.fullName.message}</p>}
              </div>

              {/* Job Title */}
              <div className="space-y-2">
                <Label htmlFor="jobTitle">תפקיד / תחום אחריות *</Label>
                <Input
                  id="jobTitle"
                  placeholder="למשל: מנהל מלאי, עובד מכירות, רכש"
                  {...register('jobTitle', { required: 'תפקיד חובה' })}
                  className="text-right"
                />
                {errors.jobTitle && <p className="text-sm text-red-600">{errors.jobTitle.message}</p>}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>שים לב:</strong> לאחר שליחת הבקשה, בעל העסק יקבל הזדקה ויוכל לאשר או לדחות את הבקשה. 
                  תקבל הודעה לאחר קבלת החליטה.
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/onboarding')}
                  className="flex-1"
                  disabled={isLoading}
                >
                  חזור
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-accent hover:bg-accent-600"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      שולח בקשה...
                    </>
                  ) : (
                    <>
                      שלח בקשת הצטרפות
                      <ArrowRight className="mr-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
