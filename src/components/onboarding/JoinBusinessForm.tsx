
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, Users, Search } from 'lucide-react';
import { useBusinessUser } from '@/hooks/useBusinessUser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const joinSchema = z.object({
  fullName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  position: z.string().min(2, 'תפקיד חייב להכיל לפחות 2 תווים'),
});

type JoinFormData = z.infer<typeof joinSchema>;

interface JoinBusinessFormProps {
  onBack: () => void;
}

interface Business {
  id: string;
  name: string;
  business_type: string;
  industry: string;
}

export const JoinBusinessForm: React.FC<JoinBusinessFormProps> = ({ onBack }) => {
  const { joinBusiness } = useBusinessUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
  });

  const searchBusinesses = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, business_type, industry')
        .ilike('name', `%${searchTerm}%`)
        .limit(10);
      
      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error searching businesses:', error);
      toast({
        title: "שגיאה בחיפוש",
        description: "אירעה שגיאה בעת חיפוש עסקים",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: JoinFormData) => {
    if (!selectedBusiness) {
      toast({
        title: "שגיאה",
        description: "יש לבחור עסק להצטרפות",
        variant: "destructive",
      });
      return;
    }

    joinBusiness.mutate({
      businessId: selectedBusiness.id,
      fullName: data.fullName,
      position: data.position,
    }, {
      onSuccess: () => {
        setSubmitted(true);
      },
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
        <Card className="shadow-xl border-0 max-w-md w-full">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-gray-900">בקשה נשלחה</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-6">
              הבקשה שלך להצטרפות לעסק נשלחה בהצלחה.<br />
              אנו ממתינים לאישור מבעל העסק.
            </p>
            <Button 
              onClick={() => window.location.href = '/auth'}
              className="w-full"
            >
              חזור למסך התחברות
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-gray-900">הצטרפות לעסק קיים</CardTitle>
            <p className="text-gray-600 mt-2">
              חפשו את העסק שאליו תרצו להצטרף
            </p>
          </CardHeader>
          <CardContent>
            {!selectedBusiness ? (
              <div className="space-y-6">
                {/* Business Search */}
                <div>
                  <Label htmlFor="search">חיפוש עסק</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="הכנס שם העסק"
                      className="text-right"
                      onKeyPress={(e) => e.key === 'Enter' && searchBusinesses()}
                    />
                    <Button
                      type="button"
                      onClick={searchBusinesses}
                      disabled={isSearching || !searchTerm.trim()}
                      className="px-4"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Search Results */}
                {businesses.length > 0 && (
                  <div className="space-y-2">
                    <Label>תוצאות חיפוש</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {businesses.map((business) => (
                        <Card
                          key={business.id}
                          className="cursor-pointer hover:shadow-md transition-shadow p-4"
                          onClick={() => setSelectedBusiness(business)}
                        >
                          <div>
                            <h3 className="font-semibold text-gray-900">{business.name}</h3>
                            <p className="text-sm text-gray-600">
                              {business.business_type} • {business.industry}
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

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
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Selected Business */}
                <div>
                  <Label>עסק נבחר</Label>
                  <Card className="p-4 bg-accent-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedBusiness.name}</h3>
                        <p className="text-sm text-gray-600">
                          {selectedBusiness.business_type} • {selectedBusiness.industry}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedBusiness(null)}
                      >
                        שנה
                      </Button>
                    </div>
                  </Card>
                </div>

                {/* Join Form */}
                <div>
                  <Label htmlFor="fullName">שם מלא *</Label>
                  <Input
                    id="fullName"
                    {...register('fullName')}
                    className="text-right"
                    placeholder="הכנס שם מלא"
                  />
                  {errors.fullName && <p className="text-sm text-red-600 mt-1">{errors.fullName.message}</p>}
                </div>

                <div>
                  <Label htmlFor="position">תפקיד/משרה *</Label>
                  <Input
                    id="position"
                    {...register('position')}
                    className="text-right"
                    placeholder="למשל: מנהל מלאי, עובד מכירות"
                  />
                  {errors.position && <p className="text-sm text-red-600 mt-1">{errors.position.message}</p>}
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedBusiness(null)}
                    className="flex-1"
                  >
                    <ArrowLeft className="ml-2 h-4 w-4" />
                    חזור
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-accent hover:bg-accent-600"
                  >
                    {isSubmitting ? 'שולח בקשה...' : 'שלח בקשה'}
                    <ArrowRight className="mr-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
