
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';

export const useInventoryLogger = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();

  const logInventoryAction = async (
    productId: string,
    actionType: 'add' | 'remove' | 'adjust',
    quantityChanged: number,
    notes?: string
  ) => {
    if (!user?.id || !businessContext?.business_id) {
      console.error('Missing user or business context for inventory logging');
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory_actions')
        .insert({
          product_id: productId,
          action_type: actionType,
          quantity_changed: quantityChanged,
          user_id: user.id,
          business_id: businessContext.business_id,
          notes: notes || null,
          timestamp: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging inventory action:', error);
      } else {
        console.log('Inventory action logged:', { productId, actionType, quantityChanged });
      }
    } catch (error) {
      console.error('Failed to log inventory action:', error);
    }
  };

  return { logInventoryAction };
};
