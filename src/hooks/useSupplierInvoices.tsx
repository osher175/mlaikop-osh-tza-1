
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

// Define local types
interface SupplierInvoice {
  id: string;
  business_id: string;
  supplier_id: string;
  invoice_date: string;
  amount: number;
  file_url?: string;
  created_at: string;
  updated_at: string;
}

interface CreateSupplierInvoiceData {
  supplier_id: string;
  invoice_date: string;
  amount: number;
  file?: File;
}

export const useSupplierInvoices = () => {
  const { user } = useAuth();
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
          suppliers!inner(name)
        `)
        .eq('business_id', businessContext.business_id)
        .order('invoice_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching supplier invoices:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!businessContext?.business_id,
  });

  const createInvoice = useMutation({
    mutationFn: async (invoiceData: CreateSupplierInvoiceData) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }

      let fileUrl = null;
      
      // Upload file if provided
      if (invoiceData.file) {
        const fileExt = invoiceData.file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('supplier-invoices')
          .upload(fileName, invoiceData.file);

        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('supplier-invoices')
          .getPublicUrl(fileName);
        
        fileUrl = publicUrl;
      }

      const { data, error } = await supabase
        .from('supplier_invoices')
        .insert({
          business_id: businessContext.business_id,
          supplier_id: invoiceData.supplier_id,
          invoice_date: invoiceData.invoice_date,
          amount: invoiceData.amount,
          file_url: fileUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast({
        title: "חשבונית נוצרה בהצלחה",
        description: "החשבונית נוספה למערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת החשבונית",
        variant: "destructive",
      });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('supplier_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast({
        title: "חשבונית נמחקה בהצלחה",
        description: "החשבונית הוסרה מהמערכת",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה במחיקת החשבונית",
        variant: "destructive",
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
