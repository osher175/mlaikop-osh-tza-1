
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  phone?: string;
  sales_agent_name?: string;
  sales_agent_phone?: string;
  business_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface CreateSupplierData {
  name: string;
  contact_email?: string | null;
  phone?: string | null;
  sales_agent_name?: string | null;
  sales_agent_phone?: string | null;
}

export const useSuppliers = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!businessContext?.business_id,
  });

  const createSupplier = useMutation({
    mutationFn: async (supplierData: CreateSupplierData) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }

      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          ...supplierData,
          business_id: businessContext.business_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "ספק נוצר בהצלחה",
        description: "הספק נוסף למערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת הספק",
        variant: "destructive",
      });
    },
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...supplierData }: Partial<Supplier> & { id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplierData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "ספק עודכן בהצלחה",
        description: "פרטי הספק עודכנו במערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בעדכון הספק",
        variant: "destructive",
      });
    },
  });

  const deleteSupplier = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "ספק נמחק בהצלחה",
        description: "הספק הוסר מהמערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה במחיקת הספק",
        variant: "destructive",
      });
    },
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
  };
};
