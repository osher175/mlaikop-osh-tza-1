
import { supabase } from '@/integrations/supabase/client';

export const setupAdminUser = async (email: string) => {
  try {
    // First, find the user by email in the profiles table
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id)
      .single();

    if (profileError) {
      console.error('User not found:', profileError);
      return { success: false, error: 'User not found' };
    }

    const userId = profiles.id;

    // Update or insert the user role to admin
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'admin'
      });

    if (roleError) {
      console.error('Error setting admin role:', roleError);
      return { success: false, error: roleError.message };
    }

    console.log(`Successfully set admin role for user: ${email}`);
    return { success: true };

  } catch (error) {
    console.error('Error in setupAdminUser:', error);
    return { success: false, error: 'Failed to set admin role' };
  }
};
