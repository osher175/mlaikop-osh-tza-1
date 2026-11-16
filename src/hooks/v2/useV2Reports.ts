import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { previousRange, rangeToUtc, type DayRange } from '@/lib/v2/dashboardMetrics';
import {
  presentLiveOverview, reportsAggregateBounds, revenueChangePct, type LiveAggregate, type PresentedOverview,
} from '@/lib/v2/reportMetrics';

const EMPTY: PresentedOverview = {
  revenueGross: null,
  grossProfit: null,
  marginPct: null,
  inventoryValue: null,
  verifiedDiscount: null,
  unitsReceived: null,
};

async function loadLive(businessId: string, range: DayRange): Promise<LiveAggregate> {
  const bounds = reportsAggregateBounds(rangeToUtc(range).start, rangeToUtc(range).endExclusive);
  const { data, error } = await supabase.rpc('reports_aggregate', {
    business_id: businessId,
    date_from: bounds.date_from,
    date_to: bounds.date_to,
  });
  if (error) throw error;
  return (data ?? {}) as LiveAggregate;
}

/**
 * Date-only revenue comes from the complete live aggregate.
 * Profit, discounts, stock value and aging are not taken from that payload.
 * A product, brand or supplier filter hides the unfiltered revenue.
 */
export function useV2Reports(range: DayRange, extraFilter: boolean, enabled: boolean) {
  const { activeBusinessId } = useActiveBusiness();
  const prior = previousRange(range);
  const current = useQuery({
    queryKey: ['v2-reports-live', activeBusinessId, range.from, range.to],
    enabled: enabled && !!activeBusinessId,
    queryFn: () => loadLive(activeBusinessId!, range),
    staleTime: 15_000,
  });
  const previous = useQuery({
    queryKey: ['v2-reports-live-prev', activeBusinessId, prior.from, prior.to],
    enabled: enabled && !!activeBusinessId && !extraFilter,
    queryFn: () => loadLive(activeBusinessId!, prior),
    staleTime: 15_000,
  });
  const overview = presentLiveOverview(current.data ?? null, extraFilter || !current.data);
  const previousRevenue = extraFilter ? null : presentLiveOverview(previous.data ?? null, !previous.data).revenueGross;
  return {
    overview: current.data || current.isError ? overview : EMPTY,
    revenueChangePct: revenueChangePct(overview.revenueGross, previousRevenue),
    timeline: extraFilter || !current.data ? [] : (current.data.timeline_breakdown ?? []),
    isLoading: current.isLoading,
    isError: current.isError,
    updatedAt: current.dataUpdatedAt,
    refetch: () => { void current.refetch(); void previous.refetch(); },
  };
}
