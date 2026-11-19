const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const DEFAULT_AUTH_FETCH_TIMEOUT_MS = 12000;

type LockRequest = (
  name: string,
  options: { mode: 'exclusive'; signal: AbortSignal },
  callback: () => Promise<unknown>,
) => Promise<unknown>;

/**
 * Chrome on Android can keep a Web Lock after a standalone window is frozen.
 * Auth initialization uses that lock with no timeout, so session restore never
 * finishes. Wait briefly, then continue without the browser lock.
 */
export async function acquireAuthLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
  locks?: { request: LockRequest } | null,
  timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
): Promise<R> {
  if (!locks?.request) return await fn();

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await locks.request(name, { mode: 'exclusive', signal: controller.signal }, async () => {
      clearTimeout(timer);
      return await fn();
    }) as R;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : '';
    if (timedOut || errorName === 'AbortError' || errorName === 'TimeoutError') {
      console.warn('Auth browser lock was not released in time; continuing session recovery');
      return await fn();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_AUTH_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.includes('/auth/v1/')) return fetch(input, init);
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

export function authLock<R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const locks = typeof navigator === 'undefined' ? null : navigator.locks;
  return acquireAuthLock(name, acquireTimeout, fn, locks);
}
