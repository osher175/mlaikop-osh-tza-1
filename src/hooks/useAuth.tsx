// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { reduceAuth, type AuthAction } from '@/lib/auth/sessionGate';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any }>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const recoverRef = useRef(false);
  const navigate = useNavigate();
  const user = session?.user ?? null;

  const applyAuth = (action: AuthAction, nextSession?: Session | null) => {
    const view = reduceAuth(
      { userId: sessionRef.current?.user?.id ?? null, recover: recoverRef.current },
      action,
    );
    recoverRef.current = view.recover;
    const resolved = view.userId
      ? (nextSession?.user?.id === view.userId ? nextSession : sessionRef.current)
      : null;
    sessionRef.current = resolved;
    setSession(resolved);
    setAuthError(view.recover);
    const ignoredEmptyEvent = action.type === 'event' && action.event !== 'SIGNED_OUT' && !action.userId;
    if (!ignoredEmptyEvent) setLoading(false);
  };

  useEffect(() => {
    const watchdog = window.setTimeout(() => {
      if (sessionRef.current) return;
      recoverRef.current = true;
      setAuthError(true);
      setLoading(false);
    }, 12000);

    supabase.auth.getSession().then(({ data: { session: restored }, error }) => {
      window.clearTimeout(watchdog);
      if (error) console.error('Session restore failed', error.message);
      applyAuth(
        { type: 'restored', userId: restored?.user?.id ?? null, failed: Boolean(error) },
        restored,
      );
    }).catch((error: unknown) => {
      window.clearTimeout(watchdog);
      console.error('Session restore threw', error instanceof Error ? error.message : 'unknown');
      applyAuth({ type: 'restored', userId: null, failed: true }, null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, nextSession) => {
        console.log('Auth state changed:', event);
        applyAuth(
          { type: 'event', event, userId: nextSession?.user?.id ?? null },
          nextSession,
        );

        // Create trial subscription for new users when they sign in (after signup they're automatically signed in)
        if (event === 'SIGNED_IN' && nextSession?.user) {
          const signedInUserId = nextSession.user.id;
          console.log('User signed in, checking if trial subscription needed');
          // Use setTimeout to avoid blocking the auth flow
          setTimeout(() => {
            createTrialSubscription(signedInUserId);
          }, 1000);
        }
      }
    );

    return () => {
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const createTrialSubscription = async (userId: string) => {
    try {
      console.log('Ensuring trial subscription via RPC for user:', userId);
      const { error } = await supabase.rpc('ensure_trial_subscription');
      if (error) {
        console.error('Error in ensure_trial_subscription RPC:', error);
      } else {
        console.log('Trial subscription ensured (server-side)');
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

  const signUp = async (email: string, password: string, username?: string) => {
    const trimmed = username?.trim();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: trimmed ? { username: trimmed, display_name: trimmed } : {},
      },
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    authError,
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