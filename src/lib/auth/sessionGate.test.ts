import assert from 'node:assert/strict';
import { acquireAuthLock, authFetch } from './browserLock.ts';
import { handleChunkPreloadError } from './chunkReload.ts';
import { authDestination, reduceAuth, type AuthView } from './sessionGate.ts';

const empty: AuthView = { userId: null, recover: false };
const signedIn: AuthView = { userId: 'user-1', recover: false };

assert.deepEqual(
  reduceAuth(empty, { type: 'restored', userId: 'user-1', failed: false }),
  signedIn,
);
assert.equal(authDestination({ loading: false, userId: 'user-1', recover: false }), 'app');

assert.deepEqual(
  reduceAuth(empty, { type: 'restored', userId: null, failed: false }),
  empty,
);
assert.equal(authDestination({ loading: false, userId: null, recover: false }), 'auth');

assert.deepEqual(
  reduceAuth(empty, { type: 'restored', userId: null, failed: true }),
  { userId: null, recover: true },
);
assert.equal(authDestination({ loading: false, userId: null, recover: true }), 'recover');
assert.equal(authDestination({ loading: true, userId: null, recover: true }), 'wait');

const kept = reduceAuth(signedIn, { type: 'event', event: 'INITIAL_SESSION', userId: null });
assert.deepEqual(kept, signedIn);
assert.equal(authDestination({ loading: false, userId: kept.userId, recover: kept.recover }), 'app');

const stillHeld = reduceAuth(signedIn, { type: 'restored', userId: null, failed: true });
assert.equal(stillHeld.userId, 'user-1');
assert.equal(stillHeld.recover, false);

const signedOut = reduceAuth(signedIn, { type: 'event', event: 'SIGNED_OUT', userId: null });
assert.deepEqual(signedOut, empty);
assert.equal(authDestination({ loading: false, userId: null, recover: false }), 'auth');

const refreshed = reduceAuth(
  { userId: null, recover: true },
  { type: 'event', event: 'TOKEN_REFRESHED', userId: 'user-1' },
);
assert.deepEqual(refreshed, signedIn);

let runs = 0;
const direct = await acquireAuthLock('lock-test', -1, async () => {
  runs += 1;
  return 'ok';
}, null, 20);
assert.equal(direct, 'ok');
assert.equal(runs, 1);

const manager = {
  async request(_name: string, _options: { signal: AbortSignal }, callback: () => Promise<unknown>) {
    assert.equal(this, manager);
    return callback();
  },
};
const acquired = await acquireAuthLock('lock-test', -1, async () => 'held', manager, 20);
assert.equal(acquired, 'held');

let fallbackRuns = 0;
const released = await acquireAuthLock(
  'lock-test',
  -1,
  async () => {
    fallbackRuns += 1;
    return 'continued';
  },
  {
    request: (_name, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  },
  30,
);
assert.equal(released, 'continued');
assert.equal(fallbackRuns, 1);

const storage = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
let reloads = 0;
let fallbacks = 0;
handleChunkPreloadError(memoryStorage, () => { reloads += 1; }, () => { fallbacks += 1; });
assert.equal(reloads, 1);
assert.equal(fallbacks, 0);
handleChunkPreloadError(memoryStorage, () => { reloads += 1; }, () => { fallbacks += 1; });
assert.equal(reloads, 1);
assert.equal(fallbacks, 1);
assert.equal(memoryStorage.getItem('mlaiko-chunk-reload'), null);

const originalFetch = globalThis.fetch;
let fetchAborted = false;
const keepalive = setInterval(() => {}, 50);
globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener('abort', () => {
    fetchAborted = true;
    reject(new DOMException('The operation was aborted.', 'TimeoutError'));
  });
})) as typeof fetch;
try {
  await assert.rejects(() => authFetch('https://example.invalid/auth/v1/token', undefined, 80));
  assert.equal(fetchAborted, true);
} finally {
  clearInterval(keepalive);
  globalThis.fetch = originalFetch;
}

console.log('auth session gate tests passed');
