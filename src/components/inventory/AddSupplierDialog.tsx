
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBusiness } from '@/hooks/useBusiness';
import { useQueryClient } from '@tanstack/react-query';

interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddSupplierDialog: React.FC<AddSupplierDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    phone: '',
  });
  
  const { user } = useAuth();
  const { business } = useBusiness();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (!user?.id || !business?.id) {
      toast({
        title: "שגיאה",
        description: "לא ניתן להוסיף ספק ללא זיהוי משתמש או עסק",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .insert({
          name: formData.name.trim(),
          contact_email: formData.contact_email.trim() || null,
          phone: formData.phone.trim() || null,
          business_id: business.id,
        });

      if (error) throw error;

      // Invalidate suppliers query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      
      toast({
        title: "ספק נוצר בהצלחה",
        description: `הספק "${formData.name.trim()}" נוסף למערכת`,
      });
      
      setFormData({ name: '', contact_email: '', phone: '' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: "שגיאה",
        description: "שגיאה ביצירת הספק",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת ספק חדש</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="supplierName">שם הספק *</Label>
            <Input
              id="supplierName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="הכנס שם ספק..."
              required
            />
          </div>

          <div>
            <Label htmlFor="contactEmail">כתובת אימייל</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="example@email.com"
            />
          </div>

          <div>
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="050-1234567"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'שומר...' : 'הוסף ספק'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
