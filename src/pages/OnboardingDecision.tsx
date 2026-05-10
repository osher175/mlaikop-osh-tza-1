import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, MapPin, Settings as SettingsIcon, ChevronRight } from 'lucide-react';

type Step = 1 | 2 | 3;

export const OnboardingDecision: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  // Step 2
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');

  // If business already exists, jump ahead
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id, name, business_type, business_category_id, address, phone, business_email, onboarding_completed')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (data) {
        setBusinessId(data.id);
        setBusinessName(data.name ?? '');
        setBusinessType(data.business_type ?? '');
        setBusinessCategory(data.business_category_id ?? '');
        setAddress(data.address ?? '');
        setPhone(data.phone ?? '');
        setBusinessEmail(data.business_email ?? '');
        if (!data.onboarding_completed) setStep(2);
      }
    })();
  }, [user?.id]);

  const { data: businessCategories } = useQuery({
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

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!businessName.trim()) {
      toast({ title: 'שגיאה', description: 'יש להזין שם עסק', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      let bId = businessId;
      if (!bId) {
        // Use the atomic RPC that creates business + memberships + roles
        const { data: newId, error: rpcErr } = await supabase.rpc('create_business_for_new_user', {
          p_business_name: businessName.trim(),
          p_phone: null,
        });
        if (rpcErr) throw rpcErr;
        bId = newId as string;
      }
      // Update structured fields
      const { error: updErr } = await supabase
        .from('businesses')
        .update({
          name: businessName.trim(),
          business_type: businessType || null,
          business_category_id: businessCategory || null,
        })
        .eq('id', bId!);
      if (updErr) throw updErr;

      setBusinessId(bId!);
      setStep(2);
    } catch (err: any) {
      console.error('Onboarding step 1 error:', err);
      toast({ title: 'שגיאה', description: err.message ?? 'אירעה שגיאה ביצירת העסק', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          address: address || null,
          phone: phone || null,
          business_email: businessEmail || null,
        })
        .eq('id', businessId);
      if (error) throw error;
      setStep(3);
    } catch (err: any) {
      toast({ title: 'שגיאה', description: err.message ?? 'אירעה שגיאה', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitStep3 = async () => {
    if (!businessId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.rpc('complete_business_onboarding', {
        p_business_id: businessId,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['business-onboarding-status'] });
      await queryClient.invalidateQueries({ queryKey: ['business-access'] });
      await queryClient.invalidateQueries({ queryKey: ['business'] });
      toast({ title: 'מעולה!', description: 'העסק הוקם בהצלחה' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ title: 'שגיאה', description: err.message ?? 'אירעה שגיאה', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              {step === 1 && <Building2 className="w-6 h-6 text-white" />}
              {step === 2 && <MapPin className="w-6 h-6 text-white" />}
              {step === 3 && <SettingsIcon className="w-6 h-6 text-white" />}
            </div>
            <CardTitle className="text-xl font-bold">
              {step === 1 && 'יצירת העסק שלך'}
              {step === 2 && 'פרטי קשר עסקיים'}
              {step === 3 && 'הגדרות ראשוניות'}
            </CardTitle>
            <CardDescription>
              שלב {step} מתוך 3
            </CardDescription>

            <div className="flex gap-1 mt-3 justify-center">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-12 rounded-full ${s <= step ? 'bg-primary' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {step === 1 && (
              <form onSubmit={submitStep1} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">שם העסק *</Label>
                  <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>תחום עסק</Label>
                  <Select value={businessCategory || '__none__'} onValueChange={(v) => setBusinessCategory(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר תחום" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">לא לציין כעת</SelectItem>
                      {businessCategories?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>סוג עסק</Label>
                  <Select value={businessType || '__none__'} onValueChange={(v) => setBusinessType(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">לא לציין כעת</SelectItem>
                      <SelectItem value="retail">קמעונאות</SelectItem>
                      <SelectItem value="wholesale">סיטונאות</SelectItem>
                      <SelectItem value="service">שירותים</SelectItem>
                      <SelectItem value="manufacturing">ייצור</SelectItem>
                      <SelectItem value="restaurant">מסעדנות</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ChevronRight className="w-4 h-4 ml-2" />}
                  המשך
                </Button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={submitStep2} className="space-y-4">
                <div className="space-y-2">
                  <Label>כתובת</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רחוב, עיר" />
                </div>
                <div className="space-y-2">
                  <Label>טלפון</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
                </div>
                <div className="space-y-2">
                  <Label>אימייל עסקי</Label>
                  <Input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="contact@business.com" />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1" disabled={isSubmitting}>
                    דלג
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'המשך'}
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 text-right">
                  הגדרות ברירת מחדל יוקמו עבורך:
                </p>
                <ul className="text-sm text-gray-700 space-y-1 list-disc pr-5">
                  <li>התראות מלאי נמוך (סף: 5 יחידות)</li>
                  <li>התראות תוקף (7 ימים מראש)</li>
                  <li>התראות חריגה ממכסת מנוי</li>
                </ul>
                <p className="text-xs text-gray-500 text-right">
                  תוכל לשנות הגדרות אלה בכל עת מתוך הגדרות העסק.
                </p>
                <Button onClick={submitStep3} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  סיום והפעלת המערכת
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
