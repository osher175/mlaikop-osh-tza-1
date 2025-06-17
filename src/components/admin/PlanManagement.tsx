
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  setupFee: number;
  durationMonths: number;
  storageGB: number;
  aiAccess: boolean;
  maxUsers: number | null;
  features: string[];
}

// Dummy plan data based on the Mlaiko specification
const initialPlans: Plan[] = [
  {
    id: '1',
    name: 'Freemium',
    monthlyPrice: 0,
    setupFee: 0,
    durationMonths: 1,
    storageGB: 1,
    aiAccess: false,
    maxUsers: 1,
    features: ['גישה בסיסית', 'מוצר אחד'],
  },
  {
    id: '2',
    name: 'Premium 1',
    monthlyPrice: 399.90,
    setupFee: 1499,
    durationMonths: 12,
    storageGB: 10,
    aiAccess: false,
    maxUsers: null,
    features: ['גישה מלאה', 'משתמשים ללא הגבלה', 'דוחות מתקדמים'],
  },
  {
    id: '3',
    name: 'Premium 2',
    monthlyPrice: 799.90,
    setupFee: 1499,
    durationMonths: 12,
    storageGB: 25,
    aiAccess: true,
    maxUsers: null,
    features: ['כל התכונות של Premium 1', 'בינה מלאכותית (₪400/חודש)'],
  },
  {
    id: '4',
    name: 'Premium 3',
    monthlyPrice: 1199.90,
    setupFee: 2999,
    durationMonths: 24,
    storageGB: 50,
    aiAccess: true,
    maxUsers: null,
    features: ['כל התכונות', 'בינה מלאכותית מלאה', 'תמיכה מועדפת'],
  },
];

export const PlanManagement: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Plan | null>(null);

  const startEditing = (plan: Plan) => {
    setEditingPlan(plan.id);
    setEditForm({ ...plan });
  };

  const cancelEditing = () => {
    setEditingPlan(null);
    setEditForm(null);
  };

  const savePlan = () => {
    if (editForm) {
      setPlans(plans.map(p => p.id === editForm.id ? editForm : p));
      setEditingPlan(null);
      setEditForm(null);
      console.log('Plan updated:', editForm);
      // TODO: Save to Supabase
    }
  };

  const updateEditForm = (field: keyof Plan, value: any) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-900 font-rubik" dir="rtl">
          ניהול תוכניות מנוי
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
          {plans.map((plan) => (
            <Card key={plan.id} className="border-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-rubik">{plan.name}</CardTitle>
                  {editingPlan === plan.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={savePlan} className="bg-green-600 hover:bg-green-700">
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEditing(plan)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingPlan === plan.id && editForm ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="monthlyPrice" className="font-rubik">מחיר חודשי (₪)</Label>
                        <Input
                          id="monthlyPrice"
                          type="number"
                          value={editForm.monthlyPrice}
                          onChange={(e) => updateEditForm('monthlyPrice', parseFloat(e.target.value))}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="setupFee" className="font-rubik">דמי הקמה (₪)</Label>
                        <Input
                          id="setupFee"
                          type="number"
                          value={editForm.setupFee}
                          onChange={(e) => updateEditForm('setupFee', parseFloat(e.target.value))}
                          className="font-rubik"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="storageGB" className="font-rubik">אחסון (GB)</Label>
                        <Input
                          id="storageGB"
                          type="number"
                          value={editForm.storageGB}
                          onChange={(e) => updateEditForm('storageGB', parseInt(e.target.value))}
                          className="font-rubik"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxUsers" className="font-rubik">מקסימום משתמשים</Label>
                        <Input
                          id="maxUsers"
                          type="number"
                          value={editForm.maxUsers || ''}
                          placeholder="ללא הגבלה"
                          onChange={(e) => updateEditForm('maxUsers', e.target.value ? parseInt(e.target.value) : null)}
                          className="font-rubik"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Label htmlFor="aiAccess" className="font-rubik">גישה לבינה מלאכותית</Label>
                      <Switch
                        id="aiAccess"
                        checked={editForm.aiAccess}
                        onCheckedChange={(checked) => updateEditForm('aiAccess', checked)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 font-rubik">מחיר חודשי:</span>
                        <p className="font-semibold font-rubik">₪{plan.monthlyPrice.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-rubik">דמי הקמה:</span>
                        <p className="font-semibold font-rubik">₪{plan.setupFee.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 font-rubik">אחסון:</span>
                        <p className="font-semibold font-rubik">{plan.storageGB}GB</p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-rubik">משתמשים:</span>
                        <p className="font-semibold font-rubik">
                          {plan.maxUsers ? plan.maxUsers : 'ללא הגבלה'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-rubik">בינה מלאכותית:</span>
                      <Badge variant={plan.aiAccess ? 'default' : 'secondary'} className="font-rubik">
                        {plan.aiAccess ? 'כן' : 'לא'}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-gray-600 font-rubik">תכונות:</span>
                      <ul className="list-disc list-inside mt-1 text-sm font-rubik">
                        {plan.features.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
