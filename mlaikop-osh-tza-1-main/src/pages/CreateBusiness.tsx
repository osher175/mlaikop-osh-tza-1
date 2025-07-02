
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BusinessFormData {
  name: string;
  business_type: string;
  employee_count: number;
  avg_monthly_revenue: number;
  phone: string;
  address: string;
  official_email: string;
}

export const CreateBusiness: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<BusinessFormData>();

  const onSubmit = async (data: BusinessFormData) => {
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
      // Create business
      const businessInsertData = {
        name: data.name,
        business_type: data.business_type,
        employee_count: data.employee_count,
        avg_monthly_revenue: data.avg_monthly_revenue,
        phone: data.phone,
        address: data.address,
        official_email: data.official_email,
        owner_id: user.id,
      };

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert(businessInsertData)
        .select()
        .single();

      if (businessError) {
        console.error('Business creation error:', businessError);
        
        if (businessError.message.includes('unique') || businessError.message.includes('duplicate')) {
          toast({
            title: "שם העסק תפוס",
            description: "העסק עם השם הזה כבר קיים במערכת. בחר שם אחר.",
            variant: "destructive",
          });
          return;
        }
        throw businessError;
      }

      // Create business_users entry for owner
      const { error: linkError } = await supabase
        .from('business_users')
        .insert({
          user_id: user.id,
          business_id: business.id,
          role: 'OWNER',
          status: 'approved',
        });

      if (linkError) {
        console.error('Error linking user to business:', linkError);
        // Continue anyway since business was created
      }

      toast({
        title: "העסק נוצר בהצלחה!",
        description: `העסק "${data.name}" נוצר ואתה מוגדר כבעלים`,
      });

      // Redirect to dashboard
      navigate('/dashboard');

    } catch (error: any) {
      console.error('Unexpected error creating business:', error);
      toast({
        title: "שגיאה ביצירת העסק",
        description: error.message || "אנא נסה שוב",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">יצירת עסק חדש</h1>
          <p className="text-gray-600">מלא את כל השדות על מנת ליצור פרופיל עסקי ברמה הטובה ביותר</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle className="text-xl text-gray-900">פרטי העסק</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Business Name */}
              <div className="space-y-2">
                <Label htmlFor="name">שם העסק *</Label>
                <Input
                  id="name"
                  placeholder="הכנס שם העסק"
                  {...register('name', { required: 'שם העסק חובה' })}
                  className="text-right"
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
              </div>

              {/* Business Type */}
              <div className="space-y-2">
                <Label htmlFor="business_type">תחום העסק *</Label>
                <Select onValueChange={(value) => setValue('business_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תחום עסק" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">קמעונאות</SelectItem>
                    <SelectItem value="wholesale">סיטונאות</SelectItem>
                    <SelectItem value="manufacturing">ייצור</SelectItem>
                    <SelectItem value="automotive">רכב ותחבורה</SelectItem>
                    <SelectItem value="food_beverage">מזון ומשקאות</SelectItem>
                    <SelectItem value="fashion">אופנה וביגוד</SelectItem>
                    <SelectItem value="electronics">אלקטרוניקה</SelectItem>
                    <SelectItem value="construction">בנייה וקבלנות</SelectItem>
                    <SelectItem value="healthcare">בריאות ורפואה</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
                {errors.business_type && <p className="text-sm text-red-600">תחום העסק חובה</p>}
              </div>

              {/* Employee Count */}
              <div className="space-y-2">
                <Label htmlFor="employee_count">מספר עובדים *</Label>
                <Select onValueChange={(value) => setValue('employee_count', parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר מספר עובדים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2-5</SelectItem>
                    <SelectItem value="6">6-10</SelectItem>
                    <SelectItem value="11">11-20</SelectItem>
                    <SelectItem value="21">21-50</SelectItem>
                    <SelectItem value="51">51-100</SelectItem>
                    <SelectItem value="100">100+</SelectItem>
                  </SelectContent>
                </Select>
                {errors.employee_count && <p className="text-sm text-red-600">מספר עובדים חובה</p>}
              </div>

              {/* Average Monthly Revenue */}
              <div className="space-y-2">
                <Label htmlFor="avg_monthly_revenue">הכנסה חודשית ממוצעת (₪) *</Label>
                <Input
                  id="avg_monthly_revenue"
                  type="number"
                  placeholder="0"
                  {...register('avg_monthly_revenue', { 
                    required: 'הכנסה חודשית חובה',
                    min: { value: 0, message: 'הכנסה חייבת להיות חיובית' }
                  })}
                  className="text-right"
                />
                {errors.avg_monthly_revenue && <p className="text-sm text-red-600">{errors.avg_monthly_revenue.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">טלפון *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="050-123-4567"
                  {...register('phone', { required: 'מספר טלפון חובה' })}
                  className="text-right"
                />
                {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">כתובת *</Label>
                <Textarea
                  id="address"
                  placeholder="רחוב, מספר, עיר"
                  {...register('address', { required: 'כתובת חובה' })}
                  className="text-right"
                />
                {errors.address && <p className="text-sm text-red-600">{errors.address.message}</p>}
              </div>

              {/* Official Email */}
              <div className="space-y-2">
                <Label htmlFor="official_email">אימייל עסקי *</Label>
                <Input
                  id="official_email"
                  type="email"
                  placeholder="info@company.com"
                  {...register('official_email', { 
                    required: 'אימייל עסקי חובה',
                    pattern: {
                      value: /\S+@\S+\.\S+/,
                      message: 'כתובת אימייל לא תקינה'
                    }
                  })}
                  className="text-right"
                />
                {errors.official_email && <p className="text-sm text-red-600">{errors.official_email.message}</p>}
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
                  className="flex-1 bg-primary hover:bg-primary-600"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      יוצר עסק...
                    </>
                  ) : (
                    <>
                      יצירת העסק
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
