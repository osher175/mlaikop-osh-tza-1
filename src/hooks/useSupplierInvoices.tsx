
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type SupplierInvoice = Database['public']['Tables']['supplier_invoices']['Row'];
type SupplierInvoiceInsert = Database['public']['Tables']['supplier_invoices']['Insert'];

interface SupplierInvoiceWithSupplier extends SupplierInvoice {
  supplier: {
    name: string;
  } | null;
}

export const useSupplierInvoices = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['supplier-invoices', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('business_id', businessContext.business_id)
        .order('invoice_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching supplier invoices:', error);
        throw error;
      }
      
      return data as SupplierInvoiceWithSupplier[];
    },
    enabled: !!businessContext?.business_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${businessContext?.business_id}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('supplier-invoices')
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('supplier-invoices')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const createInvoice = useMutation({
    mutationFn: async (data: { 
      supplier_id: string; 
      invoice_date: string; 
      amount: number; 
      file?: File;
    }) => {
      if (!businessContext?.business_id) {
        throw new Error('Business context not found');
      }

      let file_url = null;
      if (data.file) {
        file_url = await uploadFile(data.file);
      }

      const insertData: SupplierInvoiceInsert = {
        business_id: businessContext.business_id,
        supplier_id: data.supplier_id,
        invoice_date: data.invoice_date,
        amount: data.amount,
        file_url,
      };

      const { data: invoice, error } = await supabase
        .from('supplier_invoices')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating supplier invoice:', error);
        throw error;
      }

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast({
        title: 'הצלחה!',
        description: 'החשבונית נוספה בהצלחה',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהוספת החשבונית',
        variant: 'destructive',
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', invoiceId)
        .eq('business_id', businessContext?.business_id);

      if (error) {
        console.error('Error deleting supplier invoice:', error);
        throw error;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast({
        title: 'הצלחה!',
        description: 'החשבונית נמחקה בהצלחה',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת החשבונית',
        variant: 'destructive',
      });
    },
  });

  return {
    invoices,
    isLoading,
    error,
    createInvoice,
    deleteInvoice,
  };
};
