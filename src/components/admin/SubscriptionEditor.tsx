import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface SubscriptionEditorProps {
  userId: string;
  currentPlan: string;
  expiryDate?: Date;
  onSave: (planId: string, expiryDate: Date) => void;
  onCancel: () => void;
}

export const SubscriptionEditor: React.FC<SubscriptionEditorProps> = ({
  userId,
  currentPlan,
  expiryDate,
  onSave,
  onCancel,
}) => {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [selectedExpiryDate, setSelectedExpiryDate] = useState<Date>(expiryDate || new Date());
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: availablePlans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ plan, expiryDate }: { plan: string; expiryDate: Date }) => {
      // First, mark current subscription as expired
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('status', 'active');

      if (updateError) throw updateError;

      // Create new subscription
      const { error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan,
          status: 'active',
          expires_at: expiryDate.toISOString(),
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      onSave(selectedPlan, selectedExpiryDate);
    },
  });

  const handleSave = () => {
    updateSubscriptionMutation.mutate({
      plan: selectedPlan,
      expiryDate: selectedExpiryDate
    });
  };

  const getPlanBadgeColor = (planId: string) => {
    switch (planId) {
      case 'Basic':
        return 'bg-amber-500';
      case 'Pro':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="border-2 border-mango/20">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 font-rubik" dir="rtl">
          עריכת מנוי משתמש
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" dir="rtl">
        <div>
          <Label className="font-rubik">תוכנית נוכחית</Label>
          <div className="mt-1">
            <Badge className={`${getPlanBadgeColor(currentPlan)} text-white font-rubik`}>
              {currentPlan}
            </Badge>
          </div>
        </div>

        <div>
          <Label htmlFor="plan-select" className="font-rubik">תוכנית חדשה</Label>
          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
            <SelectTrigger className="font-rubik">
              <SelectValue placeholder="בחר תוכנית" />
            </SelectTrigger>
            <SelectContent>
              {availablePlans?.map((plan) => (
                <SelectItem key={plan.id} value={plan.name} className="font-rubik">
                  {plan.name} - {plan.storage_gb}GB, {plan.max_users === -1 ? 'ללא הגבלה' : plan.max_users} משתמשים
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="font-rubik">תאריך פגיעת תוקף</Label>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-right font-rubik"
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {selectedExpiryDate ? (
                  format(selectedExpiryDate, 'PPP', { locale: he })
                ) : (
                  <span>בחר תאריך</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedExpiryDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedExpiryDate(date);
                    setIsOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {selectedPlan !== currentPlan && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-rubik">
              המנוי ישונה מ-{currentPlan} ל-{selectedPlan}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            disabled={updateSubscriptionMutation.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 font-rubik"
          >
            <Save className="w-4 h-4 ml-2" />
            {updateSubscriptionMutation.isPending ? 'שומר...' : 'שמור שינויים'}
          </Button>
          <Button 
            onClick={onCancel}
            variant="outline"
            className="flex-1 font-rubik"
          >
            <X className="w-4 h-4 ml-2" />
            בטל
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};