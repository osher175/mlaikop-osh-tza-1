import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Save, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price: number;
  storage_gb: number;
  max_users: number;
  ai_access: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PlanFormData {
  name: string;
  monthly_price: number;
  storage_gb: number;
  max_users: number;
  ai_access: boolean;
}

export const SubscriptionPlanEditor: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editForm, setEditForm] = useState<PlanFormData | null>(null);

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['subscription-plans-admin'],
    queryFn: async () => {
      console.log('Fetching subscription plans...');
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price');
      
      if (error) {
        console.error('Error fetching plans:', error);
        throw error;
      }
      
      console.log('Plans fetched successfully:', data);
      return data as SubscriptionPlan[];
    },
  });

  const savePlanMutation = useMutation({
    mutationFn: async (planData: PlanFormData) => {
      console.log('Saving plan data:', planData);
      
      if (editingPlan && editingPlan !== 'new') {
        // Update existing plan
        console.log('Updating existing plan:', editingPlan);
        const { error } = await supabase
          .from('subscription_plans')
          .update({
            monthly_price: planData.monthly_price,
            storage_gb: planData.storage_gb,
            max_users: planData.max_users,
            ai_access: planData.ai_access
          })
          .eq('id', editingPlan);
        
        if (error) {
          console.error('Error updating plan:', error);
          throw error;
        }
      } else {
        // Create new plan
        console.log('Creating new plan:', planData);
        const { error } = await supabase
          .from('subscription_plans')
          .insert([{
            name: planData.name,
            monthly_price: planData.monthly_price,
            storage_gb: planData.storage_gb,
            max_users: planData.max_users,
            ai_access: planData.ai_access,
            duration_months: 1,
            role: 'pro_starter_user'
          }]);
        
        if (error) {
          console.error('Error creating plan:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      console.log('Plan saved successfully');
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
      console.log('Deleting plan:', planId);
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);
      
      if (error) {
        console.error('Error deleting plan:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Plan deleted successfully');
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
    setEditingPlan(plan.id);
    setEditForm({
      name: plan.name,
      monthly_price: plan.monthly_price,
      storage_gb: plan.storage_gb,
      max_users: plan.max_users,
      ai_access: plan.ai_access,
    });
  };

  const startCreatingNew = () => {
    setIsCreatingNew(true);
    setEditingPlan('new');
    setEditForm({
      name: '',
      monthly_price: 299,
      storage_gb: 10,
      max_users: 3,
      ai_access: false,
    });
  };

  const cancelEditing = () => {
    setEditingPlan(null);
    setIsCreatingNew(false);
    setEditForm(null);
  };

  const savePlan = () => {
    if (editForm && editForm.name) {
      // Validate required fields
      if (!editForm.monthly_price || !editForm.storage_gb || !editForm.max_users) {
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

  const updateEditForm = (field: keyof PlanFormData, value: any) => {
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

  if (error) {
    console.error('Subscription plans error:', error);
    return (
      <Card>
        <CardContent className="p-6 text-center font-rubik" dir="rtl">
          <p className="text-red-500">שגיאה בטעינת תוכניות המנוי</p>
          <p className="text-sm text-gray-600">בדוק את הקונסול לפרטים נוספים</p>
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
            <Card key={plan.id} className="border-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-rubik">{plan.name}</CardTitle>
                  {editingPlan === plan.id ? (
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
                        onClick={() => deletePlan(plan.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPlan === plan.id && editForm ? (
                  <>
                    <div>
                      <Label htmlFor="monthly_price" className="font-rubik">מחיר חודשי (₪)</Label>
                      <Input
                        id="monthly_price"
                        type="number"
                        value={editForm.monthly_price}
                        onChange={(e) => updateEditForm('monthly_price', parseInt(e.target.value) || 299)}
                        className="font-rubik"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="storage_gb" className="font-rubik">אחסון (GB)</Label>
                        <Input
                          id="storage_gb"
                          type="number"
                          value={editForm.storage_gb}
                          onChange={(e) => updateEditForm('storage_gb', parseInt(e.target.value) || 10)}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="max_users" className="font-rubik">מגבלת משתמשים</Label>
                        <Input
                          id="max_users"
                          type="number"
                          value={editForm.max_users}
                          onChange={(e) => updateEditForm('max_users', parseInt(e.target.value) || 3)}
                          className="font-rubik"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="font-rubik">גישה ל-AI</Label>
                      <Button 
                        type="button"
                        variant={editForm.ai_access ? "default" : "outline"}
                        onClick={() => updateEditForm('ai_access', !editForm.ai_access)}
                        className="w-full mt-1"
                      >
                        {editForm.ai_access ? 'כלול' : 'לא כלול'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-primary">
                      ₪{plan.monthly_price}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 font-rubik">אחסון:</span>
                        <p className="font-semibold font-rubik">{plan.storage_gb}GB</p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-rubik">משתמשים:</span>
                        <p className="font-semibold font-rubik">
                          {plan.max_users === -1 ? 'לא מוגבל' : plan.max_users}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600 font-rubik">AI גישה:</span>
                      <Badge variant={plan.ai_access ? "default" : "outline"} className="mr-2 font-rubik">
                        {plan.ai_access ? 'כלול' : 'לא כלול'}
                      </Badge>
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
                <div>
                  <Label htmlFor="new_name" className="font-rubik">שם התוכנית *</Label>
                  <Input
                    id="new_name"
                    value={editForm.name}
                    onChange={(e) => updateEditForm('name', e.target.value)}
                    className="font-rubik"
                    placeholder="למשל: Premium Plus"
                  />
                </div>

                <div>
                  <Label htmlFor="new_monthly_price" className="font-rubik">מחיר חודשי (₪) *</Label>
                  <Input
                    id="new_monthly_price"
                    type="number"
                    value={editForm.monthly_price}
                    onChange={(e) => updateEditForm('monthly_price', parseInt(e.target.value) || 299)}
                    className="font-rubik"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new_storage" className="font-rubik">אחסון (GB) *</Label>
                    <Input
                      id="new_storage"
                      type="number"
                      value={editForm.storage_gb}
                      onChange={(e) => updateEditForm('storage_gb', parseInt(e.target.value) || 10)}
                      className="font-rubik"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_users" className="font-rubik">מגבלת משתמשים *</Label>
                    <Input
                      id="new_users"
                      type="number"
                      value={editForm.max_users}
                      onChange={(e) => updateEditForm('max_users', parseInt(e.target.value) || 3)}
                      className="font-rubik"
                    />
                  </div>
                </div>

                <div>
                  <Label className="font-rubik">גישה ל-AI</Label>
                  <Button 
                    type="button"
                    variant={editForm.ai_access ? "default" : "outline"}
                    onClick={() => updateEditForm('ai_access', !editForm.ai_access)}
                    className="w-full mt-1"
                  >
                    {editForm.ai_access ? 'כלול' : 'לא כלול'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </Card>
  );
};