
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Define local type instead of importing from non-existent file
interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  started_at: string;
  expires_at?: string;
  trial_ends_at?: string;
  trial_started_at?: string;
}

export function useSubscriptionStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscription-status", userId],
    queryFn: async () => {
      if (!userId) {
        return {
          active: false,
          expired: true,
          trialEndsAt: null,
          type: null,
        };
      }
      
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .maybeSingle();
      
      const sub = data as SubscriptionRow | null;
      
      if (error || !sub) {
        return {
          active: false,
          expired: true,
          trialEndsAt: null,
          type: null,
        };
      }
      
      // Check if trial has expired
      if (sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
        return {
          active: false,
          expired: true,
          trialEndsAt: sub.trial_ends_at,
          type: "trial",
        };
      }
      
      return {
        active: true,
        expired: false,
        trialEndsAt: sub.trial_ends_at ?? null,
        type: sub.status === "trial" ? "trial" : "paid",
      };
    },
    enabled: !!userId,
  });
}
