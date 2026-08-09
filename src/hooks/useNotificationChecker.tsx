import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useAuth } from './useAuth';

/**
 * Performance note (Phase A1):
 * This hook used to re-fetch the FULL products table every 60s from every
 * authenticated page (the dropdown lives in the header), which was the single
 * most expensive DB workload in the system.
 *
 * Changes:
 *  - the products scan now runs on mount and every 15 minutes, foreground only
 *  - it only runs when the business actually has low-stock / expiration
 *    notifications enabled
 *  - the "does a notification already exist" check is now ONE batched query
 *    instead of two round-trips per product (N+1 removal)
 *
 * Behaviour is unchanged: the same notifications are created, with the same
 * 24h de-duplication window. Stock-driven notifications are additionally
 * created server-side by the existing `check_product_notifications` trigger,
 * so a lower client poll frequency does not lose events.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes (was 60 seconds)
const DAY_MS = 24 * 60 * 60 * 1000;

export const useNotificationChecker = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  // Get notification settings first — the expensive product scan depends on it
  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        return null;
      }

      return data;
    },
    enabled: !!businessId,
  });

  const checksEnabled =
    !!businessId &&
    !!notificationSettings &&
    (notificationSettings.low_stock_enabled || notificationSettings.expiration_enabled);

  // Get notification settings first — they drive the DB-side candidate query
first — the expensive product scan depends on it
  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching notification settings:', error);
        return null;
      }

      return data;
    },
    enabled: !!businessId,
  });

  const checksEnabled =
    !!businessId &&
    !!notificationSettings &&
    (notificationSettings.low_stock_enabled || notificationSettings.expiration_enabled);

  // Check for products that need notifications
  const { data: productsNeedingNotifications } = useQuery({
    queryKey: ['products-needing-notifications', businessId],
    queryFn: async () => {
      if (!businessId) return [];

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
        .eq('business_id', businessId);

      if (error) {
        console.error('Error fetching products for notifications:', error);
        return [];
      }

      return data || [];
    },
    enabled: checksEnabled,
    staleTime: CHECK_INTERVAL_MS,
    gcTime: CHECK_INTERVAL_MS,
    refetchInterval: CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Guard so the same dataset is never processed twice (e.g. re-renders)
  const lastProcessedRef = useRef<string | null>(null);

  // Auto-create notifications for products that need them
  useEffect(() => {
    if (!productsNeedingNotifications || !notificationSettings || !user?.id || !businessId) {
      return;
    }

    const runToken = `${businessId}:${productsNeedingNotifications.length}:${
      productsNeedingNotifications.map((p) => `${p.id}:${p.quantity}:${p.expiration_date ?? ''}`).join('|')
    }`;
    if (lastProcessedRef.current === runToken) return;
    lastProcessedRef.current = runToken;

    const checkAndCreateNotifications = async () => {
      const now = Date.now();
      const today = new Date();
      const warningDate = new Date();
      warningDate.setDate(today.getDate() + (notificationSettings.expiration_days_warning ?? 0));

      // 1. Determine candidates locally (no DB calls)
      const lowStockCandidates: typeof productsNeedingNotifications = [];
      const expirationCandidates: typeof productsNeedingNotifications = [];

      for (const product of productsNeedingNotifications) {
        if (notificationSettings.low_stock_enabled) {
          const threshold =
            product.product_thresholds?.[0]?.low_stock_threshold ??
            notificationSettings.low_stock_threshold;
          if (product.quantity <= threshold) lowStockCandidates.push(product);
        }

        if (notificationSettings.expiration_enabled && product.expiration_date) {
          if (new Date(product.expiration_date) <= warningDate) expirationCandidates.push(product);
        }
      }

      const candidateIds = Array.from(
        new Set([...lowStockCandidates, ...expirationCandidates].map((p) => p.id))
      );
      if (candidateIds.length === 0) return;

      // 2. ONE batched lookup of existing notifications in the last 24h
      //    (previously: two round-trips per product)
      const since = new Date(now - DAY_MS).toISOString();
      const existingKeys = new Set<string>();

      // Chunked to stay within URL length limits on `.in()` filters
      for (let i = 0; i < candidateIds.length; i += 40) {
        const chunk = candidateIds.slice(i, i + 40);
        const { data, error } = await supabase
          .from('notifications')
          .select('product_id, type')
          .eq('business_id', businessId)
          .in('product_id', chunk)
          .in('type', ['low_stock', 'expired'])
          .gte('created_at', since);

        if (error) {
          console.error('Error checking existing notifications:', error);
          return;
        }
        (data || []).forEach((n) => existingKeys.add(`${n.product_id}:${n.type}`));
      }

      // 3. Build the rows that still need to be created
      const rows: Array<{
        business_id: string;
        user_id: string;
        type: string;
        title: string;
        message: string;
        product_id: string;
      }> = [];

      for (const product of lowStockCandidates) {
        if (existingKeys.has(`${product.id}:low_stock`)) continue;
        rows.push({
          business_id: businessId,
          user_id: user.id,
          type: 'low_stock',
          title: 'מלאי נמוך',
          message: `המלאי של ${product.name} נמוך מהסף שהוגדר (${product.quantity} יחידות)`,
          product_id: product.id,
        });
      }

      for (const product of expirationCandidates) {
        if (existingKeys.has(`${product.id}:expired`)) continue;
        const expirationDate = new Date(product.expiration_date as string);
        const isExpired = expirationDate < today;
        rows.push({
          business_id: businessId,
          user_id: user.id,
          type: 'expired',
          title: isExpired ? 'מוצר פג תוקף' : 'מוצר קרוב לפגות תוקף',
          message: isExpired
            ? `${product.name} פג תוקף בתאריך ${expirationDate.toLocaleDateString('he-IL')}`
            : `${product.name} יפוג תוקף בתאריך ${expirationDate.toLocaleDateString('he-IL')}`,
          product_id: product.id,
        });
      }

      if (rows.length === 0) return;

      // 4. Batched inserts (previously: one insert per product)
      for (let i = 0; i < rows.length; i += 40) {
        const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 40));
        if (error) console.error('Error creating notifications:', error);
      }
    };

    checkAndCreateNotifications();
  }, [productsNeedingNotifications, notificationSettings, user?.id, businessId]);

  return {
    productsNeedingNotifications,
    notificationSettings,
  };
};
