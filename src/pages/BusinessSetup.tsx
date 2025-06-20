
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export const BusinessSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    avg_monthly_revenue: '',
    official_email: user?.email || '',
    employee_count: 1,
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateBusinessName = async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    
    const { data, error } = await supabase.rpc('is_business_name_available', {
      business_name: name.trim()
    });
    
    if (error) {
      console.error('Error checking business name:', error);
      return false;
    }
    
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "שגיאה",
        description: "שם העסק הוא שדה חובה",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check business name availability
      const isAvailable = await validateBusinessName(formData.name);
      if (!isAvailable) {
        toast({
          title: "שגיאה",
          description: "שם העסק כבר קיים במערכת. אנא בחר שם אחר.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Create business
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: formData.name.trim(),
          industry: formData.industry || null,
          address: formData.address || null,
          avg_monthly_revenue: formData.avg_monthly_revenue ? parseFloat(formData.avg_monthly_revenue) : null,
          official_email: formData.official_email || user?.email || null,
          employee_count: formData.employee_count,
          owner_id: user?.id!,
        })
        .select()
        .single();

      if (businessError) {
        console.error('Error creating business:', businessError);
        toast({
          title: "שגיאה",
          description: businessError.message?.includes('unique') 
            ? "שם העסק כבר קיים במערכת" 
            : "שגיאה ביצירת העסק",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Update user profile with owned_business_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ owned_business_id: business.id })
        .eq('id', user?.id!);

      if (profileError) {
        console.error('Error linking business to profile:', profileError);
      }

      toast({
        title: "הצלחה!",
        description: "העסק נוצר בהצלחה",
      });

      // Redirect to plan selection
      navigate('/choose-plan');

    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בלתי צפויה",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">הגדרת פרופיל העסק</CardTitle>
          <p className="text-gray-600">בואו נכיר את העסק שלך</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="business-name">שם העסק *</Label>
              <Input
                id="business-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="הכנס את שם העסק"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">תחום העסק</Label>
              <Input
                id="industry"
                type="text"
                value={formData.industry}
                onChange={(e) => handleInputChange('industry', e.target.value)}
                placeholder="לדוגמה: מכונות, אופנה, מזון"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">כתובת</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="כתובת העסק המלאה"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">הכנסה חודשית ממוצעת (₪)</Label>
                <Input
                  id="revenue"
                  type="number"
                  step="0.01"
                  value={formData.avg_monthly_revenue}
                  onChange={(e) => handleInputChange('avg_monthly_revenue', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employees">מספר עובדים</Label>
                <Input
                  id="employees"
                  type="number"
                  min="1"
                  value={formData.employee_count}
                  onChange={(e) => handleInputChange('employee_count', parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">אימייל רשמי</Label>
              <Input
                id="email"
                type="email"
                value={formData.official_email}
                onChange={(e) => handleInputChange('official_email', e.target.value)}
                placeholder={user?.email || "אימייל העסק"}
              />
              <p className="text-sm text-gray-500">
                אם תשאיר ריק, נשתמש באימייל שלך
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'יוצר עסק...' : 'המשך לבחירת תוכנית'}
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
