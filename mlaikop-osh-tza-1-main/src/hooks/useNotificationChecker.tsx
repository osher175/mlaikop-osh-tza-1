
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useAuth } from './useAuth';

export const useNotificationChecker = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();

  // Check for products that need notifications
  const { data: productsNeedingNotifications } = useQuery({
    queryKey: ['products-needing-notifications', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          quantity,
          expiration_date,
          business_id,
          product_thresholds (
            low_stock_threshold
          )
        `)
        .eq('business_id', businessContext.business_id);
      
      if (error) {
        console.error('Error fetching products for notifications:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!businessContext?.business_id,
    refetchInterval: 60000, // Check every minute
  });

  // Get notification settings
  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings', businessContext?.business_id],
    queryFn: async () => {
      if (!businessContext?.business_id) return null;
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', businessContext.business_id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!businessContext?.business_id,
  });

  // Auto-create notifications for products that need them
  useEffect(() => {
    if (!productsNeedingNotifications || !notificationSettings || !user?.id || !businessContext?.business_id) {
      return;
    }

    const checkAndCreateNotifications = async () => {
      for (const product of productsNeedingNotifications) {
        try {
          // Check for low stock
          if (notificationSettings.low_stock_enabled) {
            const threshold = product.product_thresholds?.[0]?.low_stock_threshold ?? notificationSettings.low_stock_threshold;
            
            if (product.quantity <= threshold) {
              // Check if notification already exists in last 24 hours
              const { data: existingNotification } = await supabase
                .from('notifications')
                .select('id')
                .eq('product_id', product.id)
                .eq('type', 'low_stock')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .maybeSingle();

              if (!existingNotification) {
                await supabase
                  .from('notifications')
                  .insert({
                    business_id: businessContext.business_id,
                    user_id: user.id,
                    type: 'low_stock',
                    title: 'מלאי נמוך',
                    message: `המלאי של ${product.name} נמוך מהסף שהוגדר (${product.quantity} יחידות)`,
                    product_id: product.id,
                  });
              }
            }
          }

          // Check for expiration
          if (notificationSettings.expiration_enabled && product.expiration_date) {
            const expirationDate = new Date(product.expiration_date);
            const today = new Date();
            const warningDate = new Date();
            warningDate.setDate(today.getDate() + notificationSettings.expiration_days_warning);

            if (expirationDate <= warningDate) {
              // Check if notification already exists in last 24 hours
              const { data: existingNotification } = await supabase
                .from('notifications')
                .select('id')
                .eq('product_id', product.id)
                .eq('type', 'expired')
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .maybeSingle();

              if (!existingNotification) {
                const isExpired = expirationDate < today;
                await supabase
                  .from('notifications')
                  .insert({
                    business_id: businessContext.business_id,
                    user_id: user.id,
                    type: 'expired',
                    title: isExpired ? 'מוצר פג תוקף' : 'מוצר קרוב לפגות תוקף',
                    message: isExpired 
                      ? `${product.name} פג תוקף בתאריך ${expirationDate.toLocaleDateString('he-IL')}`
                      : `${product.name} יפוג תוקף בתאריך ${expirationDate.toLocaleDateString('he-IL')}`,
                    product_id: product.id,
                  });
              }
            }
          }
        } catch (error) {
          console.error('Error creating notification for product:', product.name, error);
        }
      }
    };

    checkAndCreateNotifications();
  }, [productsNeedingNotifications, notificationSettings, user?.id, businessContext?.business_id]);

  return {
    productsNeedingNotifications,
    notificationSettings,
  };
};
