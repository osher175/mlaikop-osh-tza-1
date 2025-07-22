
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  agent_name: string;
  contact_email: string;
  sales_agent_name: string;
  sales_agent_phone: string;
  business_id: string;
  created_at: string;
  updated_at: string;
};

export const useSuppliers = () => {
  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      
      return data as Supplier[];
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (newSupplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: newSupplier.name, // Making name required
          phone: newSupplier.phone || '',
          email: newSupplier.email || '',
          agent_name: newSupplier.agent_name || '',
          contact_email: newSupplier.contact_email || '',
          sales_agent_name: newSupplier.sales_agent_name || '',
          sales_agent_phone: newSupplier.sales_agent_phone || '',
          business_id: newSupplier.business_id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier:', error);
        throw error;
      }

      return data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async (updatedSupplier: Supplier) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          name: updatedSupplier.name,
          phone: updatedSupplier.phone || '',
          email: updatedSupplier.email || '',
          agent_name: updatedSupplier.agent_name || '',
          contact_email: updatedSupplier.contact_email || '',
          sales_agent_name: updatedSupplier.sales_agent_name || '',
          sales_agent_phone: updatedSupplier.sales_agent_phone || ''
        })
        .eq('id', updatedSupplier.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating supplier:', error);
        throw error;
      }

      return data as Supplier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting supplier:', error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });

  return {
    suppliers,
    isLoading,
    error,
    createSupplier: createSupplierMutation.mutate,
    updateSupplier: updateSupplierMutation.mutate,
    deleteSupplier: deleteSupplierMutation.mutate
  };
};
