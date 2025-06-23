
import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Current session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserActiveStatus = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking user status:', error);
        return true; // Default to active if can't check
      }

      return profile?.is_active !== false;
    } catch (error) {
      console.error('Error in checkUserActiveStatus:', error);
      return true; // Default to active if can't check
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (data.user && !error) {
      console.log('User signed in, checking active status:', data.user.email);
      
      // Check if user is active
      const isActive = await checkUserActiveStatus(data.user.id);
      
      if (!isActive) {
        // User is disabled, sign them out immediately
        console.log('User account is disabled, signing out:', data.user.email);
        await supabase.auth.signOut();
        
        toast({
          title: 'החשבון מושבת',
          description: 'החשבון שלך הושבת. פנה למנהל המערכת.',
          variant: 'destructive',
        });
        
        return { data: null, error: { message: 'החשבון שלך הושבת. פנה למנהל המערכת.' } };
      }
      
      console.log('User signed in successfully:', data.user.email);
      window.location.href = '/';
    }
    
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      window.location.href = '/auth';
    }
    return { error };
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
