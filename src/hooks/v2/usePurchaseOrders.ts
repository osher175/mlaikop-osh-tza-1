import { useQuery } from '@tanstack/react-query';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { ordersWritable, purchaseOrdersQueryKey } from '@/lib/v2/purchaseOrder';
import { listPurchaseOrders } from '@/lib/v2/purchaseOrderWrite';

/** Does not query purchase_orders while the ledger flag is off. */
export function usePurchaseOrders() {
  const { activeBusinessId } = useActiveBusiness();
  const available = ordersWritable();
  const query = useQuery({
    queryKey: purchaseOrdersQueryKey(activeBusinessId),
    enabled: available && !!activeBusinessId,
    queryFn: () => listPurchaseOrders(activeBusinessId!),
  });
  return {
    available,
    orders: query.data ?? [],
    isLoading: available && query.isLoading,
    isError: available && query.isError,
    reload: () => query.refetch(),
  };
}
