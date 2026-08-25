export const APP_VERSION = 'v8.2.3';
export const SCHEMA_VERSION = 11;
export const DATA_GENERATION = 'supabase-master-v800-20260822';

export const DATA_GENERATION_KEY = 'pm_data_generation';
export const PENDING_GENERATION_KEY = 'pm_pending_data_generation';
export const DEVICE_ID_KEY = 'pm_device_id';

/**
 * Compara duas versões semânticas (ex.: 'v7.0' vs 'v6.9.10') e retorna true
 * apenas quando a versão candidata é MAIS NOVA que a atual. Evita que um
 * cliente com versão mais recente tente "instalar" uma versão antiga do
 * servidor (loop de downgrade durante a transição de deploy).
 */
export function isVersionNewer(candidate: string, current: string): boolean {
  const parse = (v: string) => (v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(candidate);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

const LEGACY_LOCAL_KEYS = [
  'multiplica_plus_db',
  'pm_sync_queue',
  'pm_people_sync_queue',
  'pm_pending_sync',
  'pm_server_revision',
  'pm_last_synced_at',
  'pm_last_migrated_version',
  'pm_schema_version',
  'pm_version_migration_report',
  'pm_pre_update_checkpoint',
  'pm_update_target_version',
] as const;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const browserStorage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * A geração v7.0 (hostinger-master-v700-20260817) é a geração canônica
 * atual. Qualquer cache ou fila de gerações anteriores é descartado antes do
 * React inicializar, sem tocar na sessão do usuário. O marcador definitivo só
 * é gravado depois do snapshot Supabase ser validado e salvo.
 */
export function prepareCurrentDataGeneration(storage: StorageLike | null = browserStorage()) {
  if (!storage) return { active: false, reset: false };
  const active = storage.getItem(DATA_GENERATION_KEY) === DATA_GENERATION;
  if (active) return { active: true, reset: false };

  for (const key of LEGACY_LOCAL_KEYS) storage.removeItem(key);
  storage.setItem(PENDING_GENERATION_KEY, DATA_GENERATION);
  storage.setItem('pm_generation_reset_at', new Date().toISOString());
  return { active: false, reset: true };
}

export function isCurrentDataGenerationActive(storage: StorageLike | null = browserStorage()) {
  return !!storage && storage.getItem(DATA_GENERATION_KEY) === DATA_GENERATION;
}

export function getOrCreateDeviceId(storage: StorageLike | null = browserStorage()) {
  if (!storage) return 'device-unavailable';
  const current = storage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  storage.setItem(DEVICE_ID_KEY, randomId);
  return randomId;
}

export function activateCurrentDataGeneration(
  serverRevision: number,
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return;
  storage.setItem(DATA_GENERATION_KEY, DATA_GENERATION);
  storage.removeItem(PENDING_GENERATION_KEY);
  storage.setItem('pm_last_migrated_version', APP_VERSION);
  storage.setItem('pm_schema_version', String(SCHEMA_VERSION));
  storage.setItem('pm_generation_activated_at', new Date().toISOString());
  storage.setItem('pm_server_revision', String(Math.max(0, serverRevision || 0)));
}
