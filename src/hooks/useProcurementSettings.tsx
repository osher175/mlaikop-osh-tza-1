import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from '@/hooks/useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export interface ProcurementSettingsData {
  business_id: string;
  approval_required: boolean;
  max_auto_order_amount: number | null;
  scoring_weights: {
    price: number;
    delivery: number;
    supplier_priority: number;
    reliability: number;
  };
  default_urgency: 'low' | 'normal' | 'high';
  created_at: string;
  updated_at: string;
}

const DEFAULT_WEIGHTS = { price: 0.4, delivery: 0.3, supplier_priority: 0.2, reliability: 0.1 };

export const useProcurementSettings = () => {
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const businessId = businessContext?.business_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['procurement-settings', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('procurement_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Auto-create default settings
        const { data: newSettings, error: insertError } = await supabase
          .from('procurement_settings')
          .insert({ business_id: businessId })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to create default procurement settings:', insertError);
          return null;
        }
        return { ...newSettings, scoring_weights: DEFAULT_WEIGHTS } as ProcurementSettingsData;
      }

      return {
        ...data,
        scoring_weights: (data.scoring_weights as any) || DEFAULT_WEIGHTS,
      } as ProcurementSettingsData;
    },
    enabled: !!businessId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<ProcurementSettingsData>) => {
      if (!businessId) throw new Error('No business context');
      const { error } = await supabase
        .from('procurement_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('business_id', businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement-settings'] });
      toast({ title: 'הגדרות רכש עודכנו בהצלחה' });
    },
    onError: (error: Error) => {
      toast({ title: 'שגיאה בעדכון הגדרות', description: error.message, variant: 'destructive' });
    },
  });

  return { settings, isLoading, updateSettings };
};
