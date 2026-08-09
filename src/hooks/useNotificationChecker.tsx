import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessAccess } from './useBusinessAccess';
import { useAuth } from './useAuth';

/**
 * Performance note (Phase A1 + A5.1):
 * This hook used to re-fetch the FULL products table every 60s from every
 * authenticated page (the dropdown lives in the header), which was the single
 * most expensive DB workload in the system.
 *
 * Changes:
 *  - Phase A1: the scan runs on mount and every 15 minutes, foreground only,
 *    only when notifications are enabled, and the "does a notification already
 *    exist" check is ONE batched query instead of two round-trips per product.
 *  - Phase A5.1: the browser no longer reads the product table at all. The
 *    `products_needing_notifications` RPC returns ONLY the products that can
 *    actually trigger an alert (effective per-product low-stock threshold, or
 *    expiry within the configured warning window), capped server-side.
 *
 * Behaviour is unchanged: the same notifications are created, with the same
 * thresholds, types and 24h de-duplication window. Stock-driven notifications
 * are additionally created server-side by the existing
 * `check_product_notifications` trigger.
 */

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DAY_MS = 24 * 60 * 60 * 1000;
const CANDIDATE_LIMIT = 200;

interface NotificationCandidate {
  id: string;
  name: string;
  quantity: number;
  expiration_date: string | null;
  business_id: string;
  low_stock_threshold: number;
  needs_low_stock: boolean;
  needs_expiration: boolean;
}

export const useNotificationChecker = () => {
  const { user } = useAuth();
  const { businessContext } = useBusinessAccess();
  const businessId = businessContext?.business_id;

  // Notification settings drive the DB-side candidate query
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

  // Bounded, DB-side candidate set — never the full catalog
  const { data: productsNeedingNotifications } = useQuery({
    queryKey: [
      'products-needing-notifications',
      businessId,
      notificationSettings?.low_stock_enabled,
      notificationSettings?.low_stock_threshold,
      notificationSettings?.expiration_enabled,
      notificationSettings?.expiration_days_warning,
    ],
    queryFn: async (): Promise<NotificationCandidate[]> => {
      if (!businessId || !notificationSettings) return [];

      const { data, error } = await supabase.rpc('products_needing_notifications', {
        p_business_id: businessId,
        p_low_stock_enabled: !!notificationSettings.low_stock_enabled,
        p_default_low_threshold: notificationSettings.low_stock_threshold ?? 5,
        p_expiration_enabled: !!notificationSettings.expiration_enabled,
        p_expiration_days: notificationSettings.expiration_days_warning ?? 0,
        p_limit: CANDIDATE_LIMIT,
      });

      if (error) {
        console.error('Error fetching products for notifications:', error);
        return [];
      }

      return (data || []) as NotificationCandidate[];
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

  useEffect(() => {
    if (!productsNeedingNotifications || !notificationSettings || !user?.id || !businessId) {
      return;
    }

    const runToken = `${businessId}:${productsNeedingNotifications.length}:${productsNeedingNotifications
      .map((p) => `${p.id}:${p.quantity}:${p.expiration_date ?? ''}`)
      .join('|')}`;
    if (lastProcessedRef.current === runToken) return;
    lastProcessedRef.current = runToken;

    const checkAndCreateNotifications = async () => {
      const now = Date.now();
      const today = new Date();

      // Candidate classification already happened in the database
      const lowStockCandidates = productsNeedingNotifications.filter((p) => p.needs_low_stock);
      const expirationCandidates = productsNeedingNotifications.filter(
        (p) => p.needs_expiration && p.expiration_date
      );

      const candidateIds = Array.from(
        new Set([...lowStockCandidates, ...expirationCandidates].map((p) => p.id))
      );
      if (candidateIds.length === 0) return;

      // ONE batched lookup of existing notifications in the last 24h
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
