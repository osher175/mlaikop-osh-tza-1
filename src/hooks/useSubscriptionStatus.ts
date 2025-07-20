import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types/supabase";

type SubscriptionRow = Database["public"]["Tables"]["user_subscriptions_new"]["Row"];

export function useSubscriptionStatus(userId: string | undefined) {
  return useQuery([
    "subscription-status",
    userId,
  ], async () => {
    if (!userId) {
      return {
        active: false,
        expired: true,
        trialEndsAt: null,
        type: null,
      };
    }
    const { data, error } = await supabase
      .from("user_subscriptions_new")
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
    if (sub.type === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at) < new Date()) {
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
      type: (sub.type as "trial" | "paid") ?? null,
    };
  }, {
    enabled: !!userId,
  });
} 