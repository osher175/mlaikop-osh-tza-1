
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Building2, Loader2 } from 'lucide-react';

export const OnboardingDecision: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  
  // Business creation form state
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessType, setBusinessType] = useState('');

  // Fetch business categories
  const { data: businessCategories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['business-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'שגיאה',
        description: 'יש להתחבר קודם',
        variant: 'destructive',
      });
      return;
    }

    if (!businessName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם עסק',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Check if business name is available
      const { data: isAvailable } = await supabase.rpc('is_business_name_available', {
        business_name: businessName.trim()
      });

      if (!isAvailable) {
        toast({
          title: 'שגיאה',
          description: 'שם העסק כבר קיים במערכת',
          variant: 'destructive',
        });
        setIsCreating(false);
        return;
      }

      // Create the business
      const { data: newBusiness, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: businessName.trim(),
          owner_id: user.id,
          business_category_id: businessCategory || null,
          industry: industry || null,
          business_type: businessType || null,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Set user role to OWNER for the new business
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: 'OWNER',
          business_id: newBusiness.id,
        });

      if (roleError) {
        console.error('Error setting user role:', roleError);
        // Don't throw here as business was created successfully
      }

      // Create default notification settings
      const { error: notificationError } = await supabase
        .from('notification_settings')
        .insert({
          business_id: newBusiness.id,
          low_stock_enabled: true,
          low_stock_threshold: 5,
          expiration_enabled: true,
          expiration_days_warning: 7,
          plan_limit_enabled: true,
        });

      if (notificationError) {
        console.error('Error creating notification settings:', notificationError);
        // Don't throw here as business was created successfully
      }

      toast({
        title: 'הצלחה!',
        description: 'העסק נוצר בהצלחה',
      });

      // Redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Error creating business:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה ביצירת העסק',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (categoriesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-xl font-bold">יצירת עסק חדש</CardTitle>
            <CardDescription>
              בואו ניצור עסק חדש עבורך במערכת
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBusiness} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">שם העסק *</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="הזן שם עסק"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessCategory">קטגוריית עסק</Label>
                <Select value={businessCategory} onValueChange={setBusinessCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר קטגורית עסק" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessCategories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">תחום</Label>
                <Input
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="למשל: מזון, אופנה, טכנולוgiה"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">סוג עסק</Label>
                <Select value={businessType} onValueChange={setBusinessType}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג עסק" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">קמעונאות</SelectItem>
                    <SelectItem value="wholesale">סיטונאות</SelectItem>
                    <SelectItem value="service">שירותים</SelectItem>
                    <SelectItem value="manufacturing">ייצור</SelectItem>
                    <SelectItem value="restaurant">מסעדנות</SelectItem>
                    <SelectItem value="other">אחר</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    יוצר עסק...
                  </>
                ) : (
                  'צור עסק חדש'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
