
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface DeleteSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

export const DeleteSupplierDialog: React.FC<DeleteSupplierDialogProps> = ({
  open,
  onOpenChange,
  supplier,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!supplier) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplier.id);

      if (error) throw error;

      toast({
        title: "ספק נמחק בהצלחה",
        description: `הספק "${supplier.name}" נמחק מהמערכת`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: "שגיאה במחיקת הספק",
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
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            מחיקת ספק
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-gray-700">
            האם אתה בטוח שברצונך למחוק את הספק{' '}
            <span className="font-semibold">"{supplier?.name}"</span>?
          </p>
          <p className="text-sm text-gray-500">
            פעולה זו אינה ניתנת לביטול. כל המוצרים המקושרים לספק זה יישארו ללא ספק.
          </p>
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'מוחק...' : 'מחק ספק'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
