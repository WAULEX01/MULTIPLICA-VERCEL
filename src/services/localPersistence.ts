const CACHE_DB_NAME = 'multiplica_plus_cache';
const CACHE_DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'app_database';
const IDB_READY_KEY = 'pm_idb_cache_ready';

let openPromise: Promise<IDBDatabase> | null = null;
let pendingSnapshot: unknown | null = null;
let pendingFallback: (() => void) | null = null;
let pendingResolvers: Array<() => void> = [];
let flushTimer: number | null = null;
let idbFailed = false;

function openCacheDatabase(): Promise<IDBDatabase> {
  if (openPromise) return openPromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('INDEXEDDB_UNAVAILABLE'));
      return;
    }
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('INDEXEDDB_OPEN_FAILED'));
    request.onblocked = () => reject(new Error('INDEXEDDB_BLOCKED'));
  });

  const guarded: Promise<IDBDatabase> = opening.catch((error): never => {
    openPromise = null;
    idbFailed = true;
    throw error;
  });
  openPromise = guarded;
  return guarded;
}

export async function readIndexedDbSnapshot<T>(): Promise<T | null> {
  try {
    const db = await openCacheDatabase();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      request.onsuccess = () => resolve((request.result as T | undefined) || null);
      request.onerror = () => reject(request.error || new Error('INDEXEDDB_READ_FAILED'));
    });
  } catch {
    return null;
  }
}

async function writeIndexedDbSnapshot(snapshot: unknown): Promise<void> {
  const db = await openCacheDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('INDEXEDDB_WRITE_FAILED'));
    tx.onabort = () => reject(tx.error || new Error('INDEXEDDB_WRITE_ABORTED'));
  });
  try { localStorage.setItem(IDB_READY_KEY, 'true'); } catch {}
}

export function isIndexedDbCacheReady(): boolean {
  try { return localStorage.getItem(IDB_READY_KEY) === 'true'; } catch { return false; }
}

export function scheduleIndexedDbSnapshot(
  snapshot: unknown,
  fallbackToLocalStorage: () => void,
): Promise<void> {
  if (idbFailed || typeof indexedDB === 'undefined') {
    fallbackToLocalStorage();
    return Promise.resolve();
  }

  pendingSnapshot = snapshot;
  pendingFallback = fallbackToLocalStorage;

  return new Promise<void>((resolve) => {
    pendingResolvers.push(resolve);
    if (flushTimer !== null) return;

    flushTimer = window.setTimeout(async () => {
      flushTimer = null;
      const latest = pendingSnapshot;
      const latestFallback = pendingFallback;
      const resolvers = pendingResolvers;

      pendingSnapshot = null;
      pendingFallback = null;
      pendingResolvers = [];

      if (latest == null) {
        resolvers.forEach(done => done());
        return;
      }

      try {
        await writeIndexedDbSnapshot(latest);
      } catch (error) {
        console.warn('[Cache] IndexedDB indisponível; usando fallback localStorage.', error);
        latestFallback?.();
      } finally {
        resolvers.forEach(done => done());
      }
    }, 180);
  });
}
