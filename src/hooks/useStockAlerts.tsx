
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export const useStockAlerts = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stockAlerts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['stock-alerts', businessContext?.business_id],
    queryFn: async () => {
      if (!user?.id || !businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('stock_alerts')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching stock alerts:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!user?.id && !!businessContext?.business_id,
  });

  const createStockAlert = useMutation({
    mutationFn: async (alertData: {
      product_id: string;
      product_name: string;
      supplier_name?: string;
      supplier_phone?: string;
      quantity_at_trigger: number;
      alert_type: 'out_of_stock' | 'low_stock' | 'expiration_soon';
    }) => {
      if (!user?.id || !businessContext?.business_id) {
        throw new Error('User or business not found');
      }

      const { data, error } = await supabase.functions.invoke('log-stock-alert', {
        body: {
          ...alertData,
          business_id: businessContext.business_id,
        },
      });

      if (error) {
        console.error('Error creating stock alert:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      toast({
        title: "התראה נוצרה",
        description: "התראת מלאי נוצרה בהצלחה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת התראת מלאי",
        variant: "destructive",
      });
      console.error('Error creating stock alert:', error);
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('stock_alerts')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString() 
        })
        .eq('id', alertId)
        .select()
        .single();
      
      if (error) {
        console.error('Error resolving alert:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      toast({
        title: "התראה טופלה",
        description: "ההתראה סומנה כטופלה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בטיפול בהתראה",
        variant: "destructive",
      });
      console.error('Error resolving alert:', error);
    },
  });

  return {
    stockAlerts,
    isLoading,
    error,
    refetch,
    createStockAlert,
    resolveAlert,
  };
};
