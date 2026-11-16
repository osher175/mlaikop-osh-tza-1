import { useSyncExternalStore } from 'react';
import { getSaleDraft, subscribeSaleDraft, type SaleDraft } from '@/lib/v2/saleDraft';

export function useSaleDraft(businessId: string | null): SaleDraft | null {
  return useSyncExternalStore(
    subscribeSaleDraft,
    () => getSaleDraft(businessId),
    () => null,
  );
}
