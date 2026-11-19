const CHUNK_RELOAD_KEY = 'mlaiko-chunk-reload';

export function handleChunkPreloadError(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  reload: () => void,
  showFallback: () => void,
) {
  if (storage.getItem(CHUNK_RELOAD_KEY) === '1') {
    storage.removeItem(CHUNK_RELOAD_KEY);
    showFallback();
    return;
  }
  storage.setItem(CHUNK_RELOAD_KEY, '1');
  reload();
}

export function scheduleChunkReloadReset(
  storage: Pick<Storage, 'removeItem'>,
  delayMs = 10000,
) {
  setTimeout(() => storage.removeItem(CHUNK_RELOAD_KEY), delayMs);
}
