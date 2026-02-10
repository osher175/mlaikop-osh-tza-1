
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useBusinessAccess } from './useBusinessAccess';
import { useToast } from '@/hooks/use-toast';

export const useInventoryLogger = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const { toast } = useToast();

  const logInventoryAction = async (
    productId: string,
    actionType: 'add' | 'remove',
    quantityChanged: number,
    notes?: string,
    financialData?: {
      purchase_unit_ils?: number;
      purchase_total_ils?: number;
      supplier_id?: string;
    }
  ) => {
    if (!user?.id || !businessContext?.business_id) {
      console.error('User or business context not found');
      return;
    }

    try {
      // Log the inventory action
      const { error: logError } = await supabase
        .from('inventory_actions')
        .insert({
          business_id: businessContext.business_id,
          user_id: user.id,
          product_id: productId,
          action_type: actionType,
          quantity_changed: actionType === 'remove' ? -quantityChanged : quantityChanged,
          notes: notes || null,
          timestamp: new Date().toISOString(),
          ...(financialData?.purchase_unit_ils !== undefined && { purchase_unit_ils: financialData.purchase_unit_ils }),
          ...(financialData?.purchase_total_ils !== undefined && { purchase_total_ils: financialData.purchase_total_ils }),
          ...(financialData?.supplier_id && { supplier_id: financialData.supplier_id }),
        });

      if (logError) {
        console.error('Error logging inventory action:', logError);
        throw logError;
      }

      // Check if we need to create a WhatsApp notification
      await checkForWhatsAppNotification(productId, actionType, quantityChanged);

      console.log('Inventory action logged successfully');
    } catch (error) {
      console.error('Error in logInventoryAction:', error);
      toast({
        title: "שגיאה",
        description: "לא ניתן היה לרשום את פעולת המלאי",
        variant: "destructive",
      });
    }
  };

  const checkForWhatsAppNotification = async (
    productId: string,
    actionType: 'add' | 'remove',
    quantityChanged: number
  ) => {
    if (!businessContext?.business_id) return;

    try {
      // Get the current product data
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          suppliers!supplier_id (
            id,
            name,
            sales_agent_name,
            sales_agent_phone
          )
        `)
        .eq('id', productId)
        .single();

      if (productError || !product) {
        console.error('Error fetching product for WhatsApp check:', productError);
        return;
      }

      // Check if product quantity is now 0 and WhatsApp notification is enabled
      if (product.quantity === 0 && 
          product.enable_whatsapp_supplier_notification && 
          product.supplier_id &&
          product.suppliers?.sales_agent_phone) {
        
        // Check if notification already exists for this product in the last 24 hours
        const { data: existingNotification } = await supabase
          .from('whatsapp_notifications_log')
          .select('id')
          .eq('product_id', productId)
          .eq('business_id', businessContext.business_id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingNotification) {
          console.log('WhatsApp notification already exists for this product in the last 24 hours');
          return;
        }

        // Get business phone for recipient
        const { data: businessData } = await supabase
          .from('businesses')
          .select('phone')
          .eq('id', businessContext.business_id)
          .single();

        const recipientPhone = businessData?.phone || '';

        // Create WhatsApp notification
        const agentName = product.suppliers.sales_agent_name || 'הספק';
        const messageText = `היי ${agentName}, אשמח להצעת מחיר עבור ${product.name}`;

        const { error: notificationError } = await supabase
          .from('whatsapp_notifications_log')
          .insert({
            business_id: businessContext.business_id,
            product_id: productId,
            supplier_id: product.supplier_id,
            message_text: messageText,
            sales_agent_phone: product.suppliers.sales_agent_phone,
            recipient_phone: recipientPhone,
            trigger_type: 'stock_zero',
            was_sent: false,
          });

        if (notificationError) {
          console.error('Error creating WhatsApp notification:', notificationError);
        } else {
          console.log('WhatsApp notification created for product:', product.name);
        }
      }
    } catch (error) {
      console.error('Error in checkForWhatsAppNotification:', error);
    }
  };

  return {
    logInventoryAction,
  };
};
