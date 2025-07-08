
import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Auth state cleanup utility
const cleanupAuthState = () => {
  console.log('Cleaning up auth state...');
  
  // Remove standard auth tokens
  localStorage.removeItem('supabase.auth.token');
  
  // Remove all Supabase auth keys from localStorage
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
  
  // Remove from sessionStorage if in use
  Object.keys(sessionStorage || {}).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      sessionStorage.removeItem(key);
    }
  });
};

// Session timeout management
const SESSION_TIMEOUT_MINUTES = 30; // 30 minutes of inactivity
const SESSION_WARNING_MINUTES = 5; // Show warning 5 minutes before timeout

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const { toast } = useToast();

  // Session timeout tracking
  useEffect(() => {
    let sessionTimer: NodeJS.Timeout;
    let warningTimer: NodeJS.Timeout;

    const resetTimers = () => {
      if (sessionTimer) clearTimeout(sessionTimer);
      if (warningTimer) clearTimeout(warningTimer);
      setSessionWarning(false);

      if (session) {
        // Set warning timer (25 minutes)
        warningTimer = setTimeout(() => {
          setSessionWarning(true);
          toast({
            title: 'התחברות תפוג בקרוב',
            description: 'ההתחברות שלך תפוג בעוד 5 דקות. המשך לגלוש כדי להישאר מחובר.',
            variant: 'destructive',
          });
        }, (SESSION_TIMEOUT_MINUTES - SESSION_WARNING_MINUTES) * 60 * 1000);

        // Set logout timer (30 minutes)
        sessionTimer = setTimeout(async () => {
          console.log('Session timeout - signing out user');
          await signOut();
          toast({
            title: 'התחברות פגה',
            description: 'נותקת מהמערכת עקב חוסר פעילות.',
            variant: 'destructive',
          });
        }, SESSION_TIMEOUT_MINUTES * 60 * 1000);
      }
    };

    const handleUserActivity = () => {
      if (session) {
        resetTimers();
      }
    };

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    resetTimers();

    return () => {
      if (sessionTimer) clearTimeout(sessionTimer);
      if (warningTimer) clearTimeout(warningTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [session, toast]);

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

  // Check rate limit before attempting login
  const checkRateLimit = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('check_rate_limit', {
        user_email: email,
        user_ip: null, // We'll handle IP on the server side if needed
        max_attempts: 5,
        time_window_minutes: 15
      });

      if (error) {
        console.error('Error checking rate limit:', error);
        return true; // Allow attempt if we can't check
      }

      return data || false;
    } catch (error) {
      console.error('Error in checkRateLimit:', error);
      return true; // Allow attempt if we can't check
    }
  };

  // Log login attempt
  const logLoginAttempt = async (email: string, success: boolean) => {
    try {
      await supabase.rpc('log_login_attempt', {
        user_email: email,
        user_ip: null, // Client-side IP detection is limited
        is_success: success,
        user_agent_string: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging login attempt:', error);
      // Don't throw error as this is just logging
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
    // Check rate limit first
    const isAllowed = await checkRateLimit(email);
    if (!isAllowed) {
      const error = { message: 'יותר מדי ניסיונות התחברות. נסה שוב בעוד 15 דקות.' };
      await logLoginAttempt(email, false);
      toast({
        title: 'חסימת התחברות',
        description: 'יותר מדי ניסיונות התחברות נכשלו. נסה שוב בעוד 15 דקות.',
        variant: 'destructive',
      });
      return { data: null, error };
    }

    // Clean up existing state before signing in
    cleanupAuthState();
    
    try {
      // Attempt global sign out first
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      // Continue even if this fails
      console.log('Previous session cleanup attempt:', err);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Log the attempt
    await logLoginAttempt(email, !error && !!data.user);
    
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
    try {
      console.log('Starting sign out process...');
      
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('Sign out error:', error);
        // Don't throw error, continue with cleanup
      }
      
      console.log('Sign out completed, redirecting...');
      
      // Force page reload to ensure clean state
      window.location.href = '/auth';
      
      return { error: null };
    } catch (error) {
      console.error('Error during sign out:', error);
      
      // Force redirect even if sign out fails
      window.location.href = '/auth';
      
      return { error };
    }
  };

  const extendSession = () => {
    // Called when user acknowledges session warning
    setSessionWarning(false);
    // Activity will be detected and timers will reset automatically
  };

  return {
    user,
    session,
    loading,
    sessionWarning,
    signUp,
    signIn,
    signOut,
    extendSession,
  };
};
