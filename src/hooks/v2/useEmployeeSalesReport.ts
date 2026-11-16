import { useQuery } from '@tanstack/react-query';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import type { DayRange } from '@/lib/v2/dashboardMetrics';
import { loadEmployeeSalesReport } from '@/lib/v2/employeeSalesReport';
import { V2_REPORTS_SQL_READY } from '@/lib/v2/reportFlags';

/** The authorized report. The query stays disabled while V2_REPORTS_SQL_READY is false. */
export function useEmployeeSalesReport(range: DayRange, enabled: boolean) {
  const { activeBusinessId } = useActiveBusiness();
  return useQuery({
    queryKey: ['employee-sales-report', activeBusinessId, range.from, range.to],
    enabled: V2_REPORTS_SQL_READY && enabled && !!activeBusinessId,
    queryFn: () => loadEmployeeSalesReport(activeBusinessId!, range),
    staleTime: 0,
  });
}
