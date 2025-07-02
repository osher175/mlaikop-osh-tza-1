import { supabase } from '@/integrations/supabase/client';

export async function fixMissingBusinessIds() {
  const { data, error } = await supabase.rpc("fill_business_ids");
  if (error) {
    console.error("Error fixing business IDs:", error);
    return;
  }
  console.log("Updated rows:", data);
} 