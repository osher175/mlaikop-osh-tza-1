import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/types/supabase";
type SubscriptionRow = Database["public"]["Tables"]["user_subscriptions_new"]["Row"];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  // Add other profile fields here
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Create trial subscription for new users when they sign in (after signup they're automatically signed in)
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in, checking if trial subscription needed');
          // Use setTimeout to avoid blocking the auth flow
          setTimeout(() => {
            createTrialSubscription(session.user.id);
          }, 1000);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const createTrialSubscription = async (userId: string) => {
    try {
      console.log('Creating trial subscription for user:', userId);
      
      // First, get the first available plan
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .limit(1);

      if (planError) {
        console.error('Error fetching plans:', planError);
        return;
      }

      if (!plans || plans.length === 0) {
        console.error('No subscription plans available');
        return;
      }

      const defaultPlanId = plans[0].id;
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Check if user already has a subscription
      const { data: existingSubscription } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingSubscription) {
        console.log('User already has a subscription, skipping trial creation');
        return;
      }

      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: defaultPlanId,
          status: 'active', // Use 'active' instead of 'trial' to avoid constraint issues
          started_at: now.toISOString(),
          expires_at: trialEnd.toISOString(),
          trial_started_at: now.toISOString(),
          trial_ends_at: trialEnd.toISOString()
        });

      if (subscriptionError) {
        console.error('Error creating trial subscription:', subscriptionError);
      } else {
        console.log('Trial subscription created successfully');
      }
    } catch (error) {
      console.error('Error in createTrialSubscription:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

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

  // Fallback: Create trial subscription if missing
  const createTrialIfMissing = async (userId: string) => {
    try {
      const { data: existing, error: checkError } = await supabase
        .from<SubscriptionRow>("user_subscriptions_new")
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (checkError) {
        console.error('Error checking for existing subscription:', checkError);
        return;
      }
      if (existing) {
        return;
      }
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { error: insertError } = await supabase
        .from<SubscriptionRow>("user_subscriptions_new")
        .insert({
          user_id: userId,
          plan: 'free_trial',
          status: 'active',
          type: 'trial',
          started_at: now.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
        });
      if (insertError) {
        console.error('Error creating trial subscription:', insertError);
      } else {
        console.log('Trial subscription created for user', userId);
      }
    } catch (err) {
      console.error('Error in createTrialIfMissing:', err);
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
      // Fallback: Create trial if missing
      await createTrialIfMissing(data.user.id);
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
