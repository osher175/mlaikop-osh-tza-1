
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  supplier,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    phone: '',
    agent_name: '',
    sales_agent_phone: '',
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contact_email: supplier.contact_email || '',
        phone: supplier.phone || '',
        agent_name: supplier.agent_name || '',
        sales_agent_phone: supplier.sales_agent_phone || '',
      });
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !supplier) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם ספק",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: formData.name,
          contact_email: formData.contact_email || null,
          phone: formData.phone || null,
          agent_name: formData.agent_name || null,
          sales_agent_phone: formData.sales_agent_phone || null,
        })
        .eq('id', supplier.id);

      if (error) throw error;

      toast({
        title: "ספק עודכן בהצלחה",
        description: `הספק "${formData.name}" עודכן במערכת`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: "שגיאה בעדכון הספק",
        description: "אנא נסה שוב",
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
          <DialogTitle>עריכת ספק</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="supplier_name" className="text-sm font-medium">שם הספק *</Label>
            <Input
              id="supplier_name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="mt-1"
              placeholder="הזן שם הספק"
            />
          </div>

          <div>
            <Label htmlFor="contact_email" className="text-sm font-medium">אימייל</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="mt-1"
              placeholder="supplier@example.com"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium">טלפון</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-1"
              placeholder="05X-XXXXXXX"
            />
          </div>

          <div>
            <Label htmlFor="agent_name" className="text-sm font-medium">שם נציג מכירות</Label>
            <Input
              id="agent_name"
              value={formData.agent_name}
              onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
              className="mt-1"
              placeholder="שם הנציג"
            />
          </div>

          <div>
            <Label htmlFor="sales_agent_phone" className="text-sm font-medium">טלפון נציג מכירות</Label>
            <Input
              id="sales_agent_phone"
              type="tel"
              value={formData.sales_agent_phone}
              onChange={(e) => setFormData({ ...formData, sales_agent_phone: e.target.value })}
              className="mt-1"
              placeholder="05X-XXXXXXX"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'שומר...' : 'עדכן ספק'}
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
