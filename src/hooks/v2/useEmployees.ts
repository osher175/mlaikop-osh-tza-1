import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';
import { EMPLOYEES_DIRECTORY_READY, LEGACY_SALE_ATTRIBUTION_READY } from '@/lib/v2/employeeAttribution';
import { hebrewEmployeeError } from '@/lib/v2/saleErrors';

export interface EmployeeRecord {
  id: string;
  display_name: string;
  is_active: boolean;
}

const EMPLOYEE_ROSTER_READY = EMPLOYEES_DIRECTORY_READY || LEGACY_SALE_ATTRIBUTION_READY;

/**
 * Active and inactive employees of the signed-in business.
 * Sale screens pass false until their own sales flag is on, so the
 * directory release does not query employees from a sale dialog.
 */
export function useEmployees(active = true) {
  const rosterOpen = active && EMPLOYEE_ROSTER_READY;
  const { activeBusinessId, isLoading: businessLoading } = useActiveBusiness();
  const query = useQuery({
    queryKey: ['v2-employees', activeBusinessId],
    enabled: rosterOpen && !!activeBusinessId,
    queryFn: async (): Promise<EmployeeRecord[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, display_name, is_active')
        .eq('business_id', activeBusinessId!)
        .order('display_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return {
    /** Reads are open when this caller is active and a roster gate is on. */
    ready: rosterOpen,
    /** Writes follow the directory flag alone, not quick-sale persistence. */
    canManage: EMPLOYEES_DIRECTORY_READY,
    employees: query.data ?? [],
    isLoading: rosterOpen && (businessLoading || query.isLoading),
    isError: rosterOpen && query.isError,
    error: query.error,
    refetch: () => { void query.refetch(); },
  };
}

const cleanName = (displayName: string) => {
  const name = displayName.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error('שם העובד צריך להכיל בין תו אחד ל-120 תווים.');
  }
  return name;
};

/** Owner-only writes. Refuses to run while the activation gate is closed. */
export async function saveEmployee(businessId: string, displayName: string, existingId?: string) {
  if (!EMPLOYEES_DIRECTORY_READY) throw new Error('ניהול העובדים כבוי עד להפעלה המבוקרת.');
  const name = cleanName(displayName);
  const result = existingId
    ? await supabase.from('employees').update({ display_name: name }).eq('id', existingId).eq('business_id', businessId).select('id')
    : await supabase.from('employees').insert({ business_id: businessId, display_name: name, is_active: true }).select('id');
  if (result.error) throw new Error(hebrewEmployeeError(result.error));
  if (!result.data || result.data.length === 0) {
    throw new Error('רק בעל העסק יכול להוסיף או לערוך עובדים.');
  }
}

export async function setEmployeeActive(businessId: string, employeeId: string, isActive: boolean) {
  if (!EMPLOYEES_DIRECTORY_READY) throw new Error('ניהול העובדים כבוי עד להפעלה המבוקרת.');
  const { data, error } = await supabase
    .from('employees')
    .update({ is_active: isActive })
    .eq('id', employeeId)
    .eq('business_id', businessId)
    .select('id');
  if (error) throw new Error(hebrewEmployeeError(error));
  if (!data || data.length === 0) throw new Error('רק בעל העסק יכול להוסיף או לערוך עובדים.');
}
