
import React, { useState } from 'react';
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

const availablePlans = [
  { id: 'freemium', name: 'Freemium', price: 0 },
  { id: 'premium1', name: 'Premium 1', price: 399.90 },
  { id: 'premium2', name: 'Premium 2', price: 799.90 },
  { id: 'premium3', name: 'Premium 3', price: 1199.90 },
];

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

  const handleSave = () => {
    onSave(selectedPlan, selectedExpiryDate);
  };

  const getPlanBadgeColor = (planId: string) => {
    switch (planId) {
      case 'freemium':
        return 'bg-gray-500';
      case 'premium1':
        return 'bg-amber-500';
      case 'premium2':
        return 'bg-blue-500';
      case 'premium3':
        return 'bg-purple-500';
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
              {availablePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id} className="font-rubik">
                  {plan.name} - ₪{plan.price}/חודש
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
              המנוי ישונה מ-{currentPlan} ל-{availablePlans.find(p => p.id === selectedPlan)?.name}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            className="flex-1 bg-green-600 hover:bg-green-700 font-rubik"
          >
            <Save className="w-4 h-4 ml-2" />
            שמור שינויים
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
