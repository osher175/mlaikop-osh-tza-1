import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });

    return { error };
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
