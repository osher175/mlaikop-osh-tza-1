
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string; // For compatibility with some components
  contact_email: string; // For compatibility with API/database
  agent_name: string; // Added for compatibility with Suppliers.tsx
  business_id: string;
  sales_agent_name?: string;
  sales_agent_phone?: string;
  created_at?: string;
  updated_at?: string;
};

export const useSuppliers = () => {
  const { businessContext } = useBusinessAccess();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      
      // Map the database fields to our expected Supplier type
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone || '',
        email: item.contact_email || '', // Map contact_email to email
        contact_email: item.contact_email || '',
        agent_name: item.agent_name || item.sales_agent_name || '',
        business_id: item.business_id,
        sales_agent_name: item.sales_agent_name || '',
        sales_agent_phone: item.sales_agent_phone || '',
        created_at: item.created_at,
        updated_at: item.updated_at
      })) as Supplier[];
    },
    enabled: !!businessContext?.business_id,
  });

  // Add mutation for creating suppliers
  const createSupplier = useMutation({
    mutationFn: async (newSupplier: Partial<Supplier>) => {
      if (!businessContext?.business_id) {
        throw new Error("No business context available");
      }
      
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          ...newSupplier,
          business_id: businessContext.business_id
        })
        .select('*')
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "הספק נוסף בהצלחה",
        description: "הספק החדש נוסף למערכת",
      });
    },
    onError: (error) => {
      console.error('Error creating supplier:', error);
      toast({
        title: "שגיאה בהוספת ספק",
        description: "אירעה שגיאה בעת הוספת הספק החדש",
        variant: "destructive",
      });
    }
  });

  // Add mutation for updating suppliers
  const updateSupplier = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Supplier>) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "הספק עודכן בהצלחה",
        description: "פרטי הספק עודכנו במערכת",
      });
    },
    onError: (error) => {
      console.error('Error updating supplier:', error);
      toast({
        title: "שגיאה בעדכון ספק",
        description: "אירעה שגיאה בעת עדכון פרטי הספק",
        variant: "destructive",
      });
    }
  });

  // Add mutation for deleting suppliers
  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "הספק נמחק בהצלחה",
        description: "הספק הוסר מהמערכת",
      });
    },
    onError: (error) => {
      console.error('Error deleting supplier:', error);
      toast({
        title: "שגיאה במחיקת ספק",
        description: "אירעה שגיאה בעת מחיקת הספק",
        variant: "destructive",
      });
    }
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier
  };
};
