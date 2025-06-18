
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Save, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  plan: string;
  storage_limit: number;
  ai_credit: number;
  user_limit: number;
  support_level: string;
  created_at?: string;
  updated_at?: string;
}

interface NewPlan extends SubscriptionPlan {
  title: string;
  description: string;
  price_monthly: number;
  price_one_time: number;
  is_active: boolean;
}

export const SubscriptionPlanEditor: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editForm, setEditForm] = useState<Partial<NewPlan> | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans_new')
        .select('*')
        .order('created_at');
      
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async (planData: Partial<NewPlan>) => {
      if (editingPlan && editingPlan !== 'new') {
        // Update existing plan
        const { error } = await supabase
          .from('subscription_plans_new')
          .update(planData)
          .eq('plan', editingPlan);
        
        if (error) throw error;
      } else {
        // Create new plan
        const { error } = await supabase
          .from('subscription_plans_new')
          .insert([planData]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans-admin'] });
      setEditingPlan(null);
      setIsCreatingNew(false);
      setEditForm(null);
      toast({
        title: "תוכנית נשמרה בהצלחה",
        description: "השינויים נשמרו במערכת",
      });
    },
    onError: (error) => {
      console.error('Error saving plan:', error);
      toast({
        title: "שגיאה בשמירת התוכנית",
        description: "נא לנסות שוב",
        variant: "destructive",
      });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('subscription_plans_new')
        .delete()
        .eq('plan', planId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans-admin'] });
      toast({
        title: "תוכנית נמחקה",
        description: "התוכנית הוסרה מהמערכת",
      });
    },
    onError: (error) => {
      console.error('Error deleting plan:', error);
      toast({
        title: "שגיאה במחיקת התוכנית",
        description: "לא ניתן למחוק תוכנית עם מנויים פעילים",
        variant: "destructive",
      });
    },
  });

  const startEditing = (plan: SubscriptionPlan) => {
    setEditingPlan(plan.plan);
    setEditForm({
      ...plan,
      title: plan.plan,
      description: `תוכנית ${plan.plan}`,
      price_monthly: 0,
      price_one_time: 0,
      is_active: true,
    });
  };

  const startCreatingNew = () => {
    setIsCreatingNew(true);
    setEditingPlan('new');
    setEditForm({
      plan: '',
      title: '',
      description: '',
      storage_limit: 1,
      ai_credit: 0,
      user_limit: 1,
      support_level: 'basic',
      price_monthly: 0,
      price_one_time: 0,
      is_active: true,
    });
  };

  const cancelEditing = () => {
    setEditingPlan(null);
    setIsCreatingNew(false);
    setEditForm(null);
  };

  const savePlan = () => {
    if (editForm && editForm.plan && editForm.title) {
      // Validate required fields
      if (!editForm.storage_limit || !editForm.user_limit) {
        toast({
          title: "שגיאה בנתונים",
          description: "נא למלא את כל השדות הנדרשים",
          variant: "destructive",
        });
        return;
      }

      savePlanMutation.mutate(editForm);
    }
  };

  const deletePlan = (planId: string) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק תוכנית זו?')) {
      deletePlanMutation.mutate(planId);
    }
  };

  const updateEditForm = (field: keyof NewPlan, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center font-rubik" dir="rtl">
          טוען תוכניות מנוי...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold text-gray-900 font-rubik" dir="rtl">
            ניהול תוכניות מנוי
          </CardTitle>
          <Button
            onClick={startCreatingNew}
            className="bg-turquoise hover:bg-turquoise/90 font-rubik"
            disabled={isCreatingNew}
          >
            <Plus className="w-4 h-4 ml-2" />
            הוסף תוכנית חדשה
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
          {plans?.map((plan) => (
            <Card key={plan.plan} className="border-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-rubik">{plan.plan}</CardTitle>
                  {editingPlan === plan.plan ? (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={savePlan} 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={savePlanMutation.isPending}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditing(plan)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => deletePlan(plan.plan)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPlan === plan.plan && editForm ? (
                  <>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="title" className="font-rubik">כותרת התוכנית</Label>
                        <Input
                          id="title"
                          value={editForm.title || ''}
                          onChange={(e) => updateEditForm('title', e.target.value)}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description" className="font-rubik">תיאור</Label>
                        <Textarea
                          id="description"
                          value={editForm.description || ''}
                          onChange={(e) => updateEditForm('description', e.target.value)}
                          className="font-rubik"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="price_monthly" className="font-rubik">מחיר חודשי (₪)</Label>
                        <Input
                          id="price_monthly"
                          type="number"
                          value={editForm.price_monthly || 0}
                          onChange={(e) => updateEditForm('price_monthly', parseFloat(e.target.value) || 0)}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="price_one_time" className="font-rubik">תשלום חד פעמי (₪)</Label>
                        <Input
                          id="price_one_time"
                          type="number"
                          value={editForm.price_one_time || 0}
                          onChange={(e) => updateEditForm('price_one_time', parseFloat(e.target.value) || 0)}
                          className="font-rubik"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="storage_limit" className="font-rubik">מגבלת אחסון (GB)</Label>
                        <Input
                          id="storage_limit"
                          type="number"
                          value={editForm.storage_limit || 1}
                          onChange={(e) => updateEditForm('storage_limit', parseInt(e.target.value) || 1)}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="user_limit" className="font-rubik">מגבלת משתמשים</Label>
                        <Input
                          id="user_limit"
                          type="number"
                          value={editForm.user_limit || 1}
                          onChange={(e) => updateEditForm('user_limit', parseInt(e.target.value) || 1)}
                          className="font-rubik"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ai_credit" className="font-rubik">קרדיט AI</Label>
                        <Input
                          id="ai_credit"
                          type="number"
                          value={editForm.ai_credit || 0}
                          onChange={(e) => updateEditForm('ai_credit', parseInt(e.target.value) || 0)}
                          className="font-rubik"
                        />
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Label htmlFor="is_active" className="font-rubik">תוכנית פעילה</Label>
                        <Switch
                          id="is_active"
                          checked={editForm.is_active || false}
                          onCheckedChange={(checked) => updateEditForm('is_active', checked)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 font-rubik">אחסון:</span>
                        <p className="font-semibold font-rubik">{plan.storage_limit}GB</p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-rubik">משתמשים:</span>
                        <p className="font-semibold font-rubik">
                          {plan.user_limit === -1 ? 'לא מוגבל' : plan.user_limit}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 font-rubik">קרדיט AI:</span>
                        <p className="font-semibold font-rubik">
                          {plan.ai_credit === -1 ? 'לא מוגבל' : plan.ai_credit}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-rubik">תמיכה:</span>
                        <Badge variant="outline" className="font-rubik">{plan.support_level}</Badge>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}

          {/* New Plan Form */}
          {isCreatingNew && editForm && (
            <Card className="border-2 border-turquoise">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-rubik">תוכנית חדשה</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={savePlan} 
                      className="bg-green-600 hover:bg-green-700"
                      disabled={savePlanMutation.isPending}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="new_plan" className="font-rubik">מזהה תוכנית *</Label>
                    <Input
                      id="new_plan"
                      value={editForm.plan || ''}
                      onChange={(e) => updateEditForm('plan', e.target.value)}
                      className="font-rubik"
                      placeholder="למשל: premium_plus"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_title" className="font-rubik">כותרת התוכנית *</Label>
                    <Input
                      id="new_title"
                      value={editForm.title || ''}
                      onChange={(e) => updateEditForm('title', e.target.value)}
                      className="font-rubik"
                      placeholder="למשל: פרימיום פלוס"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new_storage" className="font-rubik">אחסון (GB) *</Label>
                    <Input
                      id="new_storage"
                      type="number"
                      value={editForm.storage_limit || 1}
                      onChange={(e) => updateEditForm('storage_limit', parseInt(e.target.value) || 1)}
                      className="font-rubik"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_users" className="font-rubik">מגבלת משתמשים *</Label>
                    <Input
                      id="new_users"
                      type="number"
                      value={editForm.user_limit || 1}
                      onChange={(e) => updateEditForm('user_limit', parseInt(e.target.value) || 1)}
                      className="font-rubik"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
