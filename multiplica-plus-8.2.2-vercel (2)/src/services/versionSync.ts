import type { AppDatabase, SyncQueueItem } from './db';
import { APP_VERSION, SCHEMA_VERSION } from './release';

export { APP_VERSION, SCHEMA_VERSION } from './release';

export const shouldRunVersionMigration = (lastMigratedVersion?: string | null) => lastMigratedVersion !== APP_VERSION;

export const SYNC_ENTITIES = [
  'people', 'departments', 'attendances', 'goals', 'pastoralLogs',
  'weeklyMissions', 'specialMissions', 'messageHistory', 'events', 'activityLogs',
] as const;

export interface CacheAnalysisReport {
  scanned: number;
  identical: number;
  serverNewer: number;
  recoverableLocal: number;
  conflicts: number;
  queued: number;
  byType: Record<string, any[]>;
}

const keyOf = (item: any) => String(item?.id ?? item?.month ?? '');
const timeOf = (item: any) => {
  const time = Date.parse(item?.updatedAt || item?.createdAt || '');
  return Number.isFinite(time) ? time : 0;
};
const versionOf = (item: any) => Number(item?.version || 0);
const comparable = (item: any) => {
  if (!item || typeof item !== 'object') return item;
  const { version, updatedAt, updatedBy, ...data } = item;
  return data;
};

/** Analisa todo o cache, mas só envia o que possui prova de alteração local. */
export function analyzeCacheForHostinger(
  localDb: AppDatabase,
  serverDb: AppDatabase,
  queue: SyncQueueItem[],
  lastSyncedAt?: string,
): CacheAnalysisReport {
  const queuedKeys = new Set(queue.map(item => `${item.type}:${item.itemId}`));
  const queuedPayload = new Map(queue.map(item => [`${item.type}:${item.itemId}`, item.data]));
  const lastSyncTime = Date.parse(lastSyncedAt || '') || 0;
  const report: CacheAnalysisReport = { scanned: 0, identical: 0, serverNewer: 0, recoverableLocal: 0, conflicts: 0, queued: queue.length, byType: {} };

  for (const type of SYNC_ENTITIES) {
    const localItems = ((localDb as any)?.[type] || []) as any[];
    const serverItems = ((serverDb as any)?.[type] || []) as any[];
    const serverMap = new Map(serverItems.map(item => [keyOf(item), item]));
    const recoverable = new Map<string, any>();

    for (const localItem of localItems) {
      const key = keyOf(localItem);
      if (!key) continue;
      report.scanned++;
      const serverItem = serverMap.get(key);
      const queueKey = `${type}:${key}`;
      const isQueued = queuedKeys.has(queueKey);
      const payload = queuedPayload.get(queueKey) || localItem;

      if (!serverItem) {
        const isRecentLocal = timeOf(localItem) > lastSyncTime && !!localItem.updatedBy;
        if (isQueued || isRecentLocal) { recoverable.set(key, payload); report.recoverableLocal++; }
        else report.serverNewer++;
        continue;
      }
      if (JSON.stringify(comparable(localItem)) === JSON.stringify(comparable(serverItem))) { report.identical++; continue; }
      if (isQueued) { recoverable.set(key, payload); report.recoverableLocal++; continue; }

      const localTime = timeOf(localItem);
      const serverTime = timeOf(serverItem);
      const localHasProof = localTime > lastSyncTime && !!localItem.updatedBy;
      if (localHasProof && (versionOf(localItem) > versionOf(serverItem) || localTime > serverTime)) {
        recoverable.set(key, localItem);
        report.recoverableLocal++;
      } else if (versionOf(localItem) === versionOf(serverItem) && localTime === serverTime) report.conflicts++;
      else report.serverNewer++;
    }
    report.byType[type] = Array.from(recoverable.values());
  }
  return report;
}

export function persistPreUpdateCheckpoint(db: AppDatabase | null, queue: SyncQueueItem[], fromVersion: string) {
  if (!db) return;
  try {
    localStorage.setItem('pm_pre_update_checkpoint', JSON.stringify({ fromVersion, createdAt: new Date().toISOString(), db, queue }));
  } catch (error) {
    console.warn('[VersionSync] Falha ao guardar checkpoint:', error);
  }
}
