export interface AuthView {
  userId: string | null;
  recover: boolean;
}

export type AuthAction =
  | { type: 'restored'; userId: string | null; failed: boolean }
  | { type: 'event'; event: string; userId: string | null };

/**
 * A null session is a sign-out only for SIGNED_OUT.
 * A failed restore keeps the current user and asks for a retry when nobody is signed in.
 */
export function reduceAuth(view: AuthView, action: AuthAction): AuthView {
  if (action.type === 'event' && action.event === 'SIGNED_OUT') {
    return { userId: null, recover: false };
  }
  if (action.type === 'event') {
    if (action.userId) return { userId: action.userId, recover: false };
    return view;
  }
  if (action.failed) {
    return { userId: view.userId, recover: view.userId ? false : true };
  }
  return { userId: action.userId, recover: false };
}

export type AuthDestination = 'wait' | 'recover' | 'auth' | 'app';

export function authDestination(input: {
  loading: boolean;
  userId: string | null;
  recover: boolean;
}): AuthDestination {
  if (input.loading) return 'wait';
  if (input.recover && !input.userId) return 'recover';
  if (!input.userId) return 'auth';
  return 'app';
}
