import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
import { useBusiness } from '@/hooks/useBusiness';
import { useBusinessUser } from '@/hooks/useBusinessUser';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const businessSchema = z.object({
  name: z.string().min(2, 'שם העסק חייב להכיל לפחות 2 תווים'),
  business_type: z.string().min(1, 'בחרו סוג עסק'),
  industry: z.string().min(1, 'בחרו תחום'),
  address: z.string().min(5, 'כתובת חייבת להכיל לפחות 5 תווים'),
  phone: z.string().min(9, 'מספר טלפון חייב להכיל לפחות 9 ספרות'),
  official_email: z.string().email('כתובת אימייל לא תקינה'),
  avg_monthly_revenue: z.string().min(1, 'בחרו טווח הכנסה'),
  employee_count: z.string().min(1, 'בחרו מספר עובדים'),
});

type BusinessFormData = z.infer<typeof businessSchema>;

interface CreateBusinessFormProps {
  onBack: () => void;
}

// Helper function to convert revenue range to numeric value
const getRevenueValue = (range: string): number => {
  switch (range) {
    case '0-10000': return 5000;
    case '10000-50000': return 30000;
    case '50000-100000': return 75000;
    case '100000-500000': return 300000;
    case '500000+': return 750000;
    default: return 0;
  }
};

// Helper function to convert employee count to numeric value
const getEmployeeValue = (range: string): number => {
  switch (range) {
    case '1': return 1;
    case '2-5': return 3;
    case '6-10': return 8;
    case '11-50': return 25;
    case '50+': return 75;
    default: return 1;
  }
};

export const CreateBusinessForm: React.FC<CreateBusinessFormProps> = ({ onBack }) => {
  const { user } = useAuth();
  const { createBusiness } = useBusiness();
  const { createBusinessUser } = useBusinessUser();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
  });

  const onSubmit = async (data: BusinessFormData) => {
    if (!user?.id) return;

    // Transform the form data to match database expectations
    const businessData = {
      name: data.name,
      business_type: data.business_type,
      industry: data.industry,
      address: data.address,
      phone: data.phone,
      official_email: data.official_email,
      avg_monthly_revenue: getRevenueValue(data.avg_monthly_revenue),
      employee_count: getEmployeeValue(data.employee_count),
    };

    createBusiness.mutate(businessData, {
      onSuccess: async (business) => {
        // Add user as business owner
        createBusinessUser.mutate(business.id, {
          onSuccess: () => {
            toast({
              title: "העסק נוצר בהצלחה!",
              description: "ברוכים הבאים למערכת Mlaiko",
            });
            // Redirect to dashboard
            window.location.href = '/';
          },
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 mlaiko-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-gray-900">צרו עסק חדש</CardTitle>
            <p className="text-primary font-medium mt-2">
              מלאו את כל השדות על מנת ליצור פרופיל עסקי ברמה הטובה ביותר
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">שם העסק *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    className="text-right"
                    placeholder="הכנס שם העסק"
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <Label htmlFor="business_type">סוג העסק *</Label>
                  <Select onValueChange={(value) => setValue('business_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר סוג עסק" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">קמעונאות</SelectItem>
                      <SelectItem value="wholesale">סיטונאות</SelectItem>
                      <SelectItem value="manufacturing">ייצור</SelectItem>
                      <SelectItem value="services">שירותים</SelectItem>
                      <SelectItem value="restaurant">מסעדה/בית קפה</SelectItem>
                      <SelectItem value="pharmacy">בית מרקחת</SelectItem>
                      <SelectItem value="garage">מוסך</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.business_type && <p className="text-sm text-red-600 mt-1">{errors.business_type.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="industry">תחום *</Label>
                  <Select onValueChange={(value) => setValue('industry', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר תחום" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technology">טכנולוגיה</SelectItem>
                      <SelectItem value="fashion">אופנה</SelectItem>
                      <SelectItem value="food">מזון ומשקאות</SelectItem>
                      <SelectItem value="automotive">רכב</SelectItem>
                      <SelectItem value="health">בריאות</SelectItem>
                      <SelectItem value="electronics">אלקטרוניקה</SelectItem>
                      <SelectItem value="construction">בנייה</SelectItem>
                      <SelectItem value="education">חינוך</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.industry && <p className="text-sm text-red-600 mt-1">{errors.industry.message}</p>}
                </div>

                <div>
                  <Label htmlFor="phone">טלפון *</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    className="text-right"
                    placeholder="050-1234567"
                  />
                  {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="address">כתובת *</Label>
                <Input
                  id="address"
                  {...register('address')}
                  className="text-right"
                  placeholder="רחוב, מספר, עיר"
                />
                {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address.message}</p>}
              </div>

              <div>
                <Label htmlFor="official_email">אימייל רשמי *</Label>
                <Input
                  id="official_email"
                  type="email"
                  {...register('official_email')}
                  className="text-right"
                  placeholder="business@example.com"
                />
                {errors.official_email && <p className="text-sm text-red-600 mt-1">{errors.official_email.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="avg_monthly_revenue">הכנסה חודשית ממוצעת *</Label>
                  <Select onValueChange={(value) => setValue('avg_monthly_revenue', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר טווח" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-10000">עד 10,000 ₪</SelectItem>
                      <SelectItem value="10000-50000">10,000 - 50,000 ₪</SelectItem>
                      <SelectItem value="50000-100000">50,000 - 100,000 ₪</SelectItem>
                      <SelectItem value="100000-500000">100,000 - 500,000 ₪</SelectItem>
                      <SelectItem value="500000+">מעל 500,000 ₪</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.avg_monthly_revenue && <p className="text-sm text-red-600 mt-1">{errors.avg_monthly_revenue.message}</p>}
                </div>

                <div>
                  <Label htmlFor="employee_count">מספר עובדים *</Label>
                  <Select onValueChange={(value) => setValue('employee_count', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מספר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 עובד</SelectItem>
                      <SelectItem value="2-5">2-5 עובדים</SelectItem>
                      <SelectItem value="6-10">6-10 עובדים</SelectItem>
                      <SelectItem value="11-50">11-50 עובדים</SelectItem>
                      <SelectItem value="50+">מעל 50 עובדים</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.employee_count && <p className="text-sm text-red-600 mt-1">{errors.employee_count.message}</p>}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="flex-1"
                >
                  <ArrowLeft className="ml-2 h-4 w-4" />
                  חזור
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary hover:bg-primary-600"
                >
                  {isSubmitting ? 'יוצר עסק...' : 'צור עסק'}
                  <ArrowRight className="mr-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
