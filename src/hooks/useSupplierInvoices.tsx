
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Define local types
export interface SupplierInvoice {
  id: string;
  business_id: string;
  supplier_id: string;
  invoice_date: string;
  amount: number;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

export const useSupplierInvoices = (businessId?: string) => {
  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['supplier-invoices', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('business_id', businessId)
        .order('invoice_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching supplier invoices:', error);
        throw error;
      }
      
      return data as SupplierInvoice[];
    },
    enabled: !!businessId,
  });

  return {
    invoices,
    isLoading,
    error,
  };
};
