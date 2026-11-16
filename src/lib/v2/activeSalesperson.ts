import { supabase } from '@/integrations/supabase/client';

/**
 * Confirms the chosen employee is active in this business.
 * Does not substitute the signed-in user. A missing or inactive id is rejected.
 */
export async function requireActiveSalesperson(businessId: string, employeeId: string): Promise<void> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, is_active')
    .eq('business_id', businessId)
    .eq('id', employeeId)
    .limit(1);
  if (error) throw new Error('לא הצלחנו לאמת את איש המכירות. העסקה לא נשמרה.');
  if (!data?.[0]?.is_active) throw new Error('המוכר שנבחר אינו פעיל בעסק. יש לבחור איש מכירות פעיל.');
}
