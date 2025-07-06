
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface EditSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const EditSupplierDialog: React.FC<EditSupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { businessContext } = useBusinessAccess();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    agent_name: '',
    contact_email: '',
    phone: ''
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        agent_name: supplier.agent_name || '',
        contact_email: supplier.contact_email || '',
        phone: supplier.phone || ''
      });
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplier || !businessContext?.business_id) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את הספק',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'שם הספק הוא שדה חובה',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: formData.name.trim(),
          agent_name: formData.agent_name.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          phone: formData.phone.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', supplier.id)
        .eq('business_id', businessContext.business_id);

      if (error) {
        console.error('Error updating supplier:', error);
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בעדכון הספק',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'הצלחה!',
        description: 'הספק עודכן בהצלחה',
      });

      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        agent_name: '',
        contact_email: '',
        phone: ''
      });

    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בלתי צפויה',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">עריכת ספק</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-supplier-name">שם הספק *</Label>
            <Input
              id="edit-supplier-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="הכנס שם ספק"
              className="text-right"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-agent-name">שם הסוכן</Label>
            <Input
              id="edit-agent-name"
              value={formData.agent_name}
              onChange={(e) => setFormData(prev => ({ ...prev, agent_name: e.target.value }))}
              placeholder="הכנס שם סוכן (אופציונלי)"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-contact-email">כתובת אימייל</Label>
            <Input
              id="edit-contact-email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
              placeholder="הכנס כתובת אימייל (אופציונלי)"
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">מספר טלפון</Label>
            <Input
              id="edit-phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="הכנס מספר טלפון (אופציונלי)"
              className="text-right"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-turquoise hover:bg-turquoise/90"
            >
              {isSubmitting ? 'מעדכן...' : 'עדכן ספק'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
