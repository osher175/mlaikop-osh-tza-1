
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price: number;
  duration_months: number;
  features: string[];
  ai_access: boolean;
  storage_gb: number;
  max_users: number;
  setup_fee: number;
  role: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id?: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_started_at?: string;
  trial_ends_at?: string;
  subscription_started_at?: string;
  next_billing_date?: string;
  canceled_at?: string;
  payment_link_id?: string;
  receipt_url?: string;
  started_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export const useSubscription = () => {
  const { user } = useAuth();

  const { data: subscription, isLoading: subscriptionLoading, refetch: refetchSubscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data as UserSubscription | null;
    },
    enabled: !!user?.id,
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (error) {
        console.error('Error fetching plans:', error);
        return [];
      }

      return data as SubscriptionPlan[];
    },
  });

  const isTrialValid = () => {
    if (!subscription || subscription.status !== 'trial') return false;
    if (!subscription.trial_ends_at) return false;
    
    const now = new Date();
    const trialEnd = new Date(subscription.trial_ends_at);
    return trialEnd > now;
  };

  const isSubscriptionActive = () => {
    if (!subscription) return false;
    return subscription.status === 'active' || isTrialValid();
  };

  const getDaysLeftInTrial = () => {
    if (!subscription || subscription.status !== 'trial' || !subscription.trial_ends_at) return 0;
    
    const now = new Date();
    const trialEnd = new Date(subscription.trial_ends_at);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const createTrialSubscription = async () => {
    if (!user?.id) return false;

    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Get the first available plan to use as default
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('id')
        .limit(1);

      const defaultPlanId = plans?.[0]?.id;

      if (!defaultPlanId) {
        console.error('No subscription plans available');
        return false;
      }

      const { error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: defaultPlanId,
          status: 'trial',
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnd.toISOString()
        });

      if (error) {
        console.error('Error creating trial subscription:', error);
        return false;
      }

      await refetchSubscription();
      return true;
    } catch (error) {
      console.error('Error creating trial subscription:', error);
      return false;
    }
  };

  return {
    subscription,
    plans,
    isLoading: subscriptionLoading || plansLoading,
    isTrialValid: isTrialValid(),
    isSubscriptionActive: isSubscriptionActive(),
    daysLeftInTrial: getDaysLeftInTrial(),
    createTrialSubscription,
    refetchSubscription,
  };
};
