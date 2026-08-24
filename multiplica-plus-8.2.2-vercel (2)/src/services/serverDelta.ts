import { getSyncQueue } from './db';
import type { AppDatabase } from './db';

export type ServerDelta = Partial<Record<
  'people' | 'departments' | 'attendances' | 'goals' | 'pastoralLogs' |
  'weeklyMissions' | 'specialMissions' | 'messageHistory' | 'events' | 'activityLogs',
  any[]
>>;

const bool = (value: any) => value === true || value == 1;
const jsonArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function normalizeServerEntity(entity: string, row: any) {
  const common = {
    ...row,
    version: Number(row?.version || 0),
    deleted: bool(row?.deleted),
  };
  switch (entity) {
    case 'people':
      return {
        ...common,
        passwordChanged: bool(row.passwordChanged),
        loginCount: Number(row.loginCount || 0),
        timeOnlineSeconds: Number(row.timeOnlineSeconds || 0),
        interactionCount: Number(row.interactionCount || 0),
        baptized: row.baptized === null || row.baptized === undefined ? null : bool(row.baptized),
        baptismIntention: Number(row.baptismIntention || 0),
        departments: row.departments == null ? undefined : jsonArray(row.departments),
      };
    case 'departments':
      return { ...common, missionsEnabled: bool(row.missionsEnabled) };
    case 'attendances':
      return { ...common, presentIds: jsonArray(row.presentIds) };
    case 'goals':
      return {
        ...common,
        targetMembers: Number(row.targetMembers || 0),
        targetAttendanceRate: Number(row.targetAttendanceRate || 0),
      };
    case 'weeklyMissions':
      return {
        ...common,
        targetCount: Number(row.targetCount || 0),
        recipientIds: jsonArray(row.recipientIds),
        sentIds: jsonArray(row.sentIds),
        useFirstName: bool(row.useFirstName),
      };
    case 'specialMissions':
      return {
        ...common,
        active: bool(row.active),
        useFirstName: bool(row.useFirstName),
        targetPerMultiplier: Number(row.targetPerMultiplier || 15),
        assignments: row.assignments == null ? undefined : jsonArray(row.assignments),
      };
    case 'messageHistory':
      return {
        ...common,
        receiverId: row.receiverId ?? row.recipientId ?? '',
        sentAt: row.sentAt ?? row.timestamp ?? '',
        weekKey: row.weekKey ?? row.missionId ?? '',
        message: row.message ?? row.notes ?? '',
      };
    default:
      return common;
  }
}

const config: Array<{ entity: keyof ServerDelta; key: keyof AppDatabase; pk: 'id' | 'month' }> = [
  { entity: 'people', key: 'people', pk: 'id' },
  { entity: 'departments', key: 'departments', pk: 'id' },
  { entity: 'attendances', key: 'attendances', pk: 'id' },
  { entity: 'goals', key: 'goals', pk: 'month' },
  { entity: 'pastoralLogs', key: 'pastoralLogs', pk: 'id' },
  { entity: 'weeklyMissions', key: 'weeklyMissions', pk: 'id' },
  { entity: 'specialMissions', key: 'specialMissions', pk: 'id' },
  { entity: 'messageHistory', key: 'messageHistory', pk: 'id' },
  { entity: 'events', key: 'events', pk: 'id' },
  { entity: 'activityLogs', key: 'activityLogs', pk: 'id' },
];

/** Substitui somente os registros que o Supabase marcou como alterados. */
export function applyServerDelta(
  current: AppDatabase,
  changes: ServerDelta = {},
  activityLogCount?: number,
): AppDatabase {
  const next: any = { ...current };
  for (const item of config) {
    const incoming = changes[item.entity];
    if (!Array.isArray(incoming) || incoming.length === 0) continue;
    const existing = Array.isArray((current as any)[item.key]) ? [...(current as any)[item.key]] : [];
    const positions = new Map(existing.map((row: any, index: number) => [String(row[item.pk]), index]));
    for (const raw of incoming) {
      const row = normalizeServerEntity(item.entity, raw);
      const id = String(row[item.pk] || '');
      if (!id) continue;
      const position = positions.get(id);
      if (position === undefined) {
        positions.set(id, existing.length);
        existing.push(row);
      } else {
        existing[position] = row;
      }
    }
    if (item.entity === 'activityLogs') {
      existing.sort((a: any, b: any) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      next[item.key] = existing.slice(0, 200);
    } else {
      next[item.key] = existing;
    }
  }
  if (typeof activityLogCount === 'number') next.activityLogCount = activityLogCount;
  return next as AppDatabase;
}


/**
 * Reaplica na réplica local os patches que ainda aguardam ACK. Isso evita que
 * um pull canônico faça uma edição offline 'sumir' visualmente enquanto ela
 * ainda está segura na Outbox. O Supabase continua sendo a fonte oficial.
 */
export function applyPendingSyncOverlay(database: AppDatabase): AppDatabase {
  const queue = getSyncQueue();
  if (queue.length === 0) return database;
  const next: any = { ...database };
  for (const item of config) {
    const pending = queue.filter(q => q.type === item.entity);
    if (pending.length === 0) continue;
    const rows = Array.isArray(next[item.key]) ? [...next[item.key]] : [];
    const positions = new Map(rows.map((row: any, index: number) => [String(row[item.pk]), index]));
    for (const q of pending) {
      const patch: any = { ...(q.patch || q.data || {}) };
      const id = String(q.itemId || '');
      if (!id) continue;
      const pos = positions.get(id);
      const current: any = pos === undefined ? { [item.pk]: id } : { ...rows[pos] };
      if (item.entity === 'attendances' && ('presentIdsAdd' in patch || 'presentIdsRemove' in patch)) {
        const set = new Set<string>(Array.isArray(current.presentIds) ? current.presentIds : []);
        for (const pid of patch.presentIdsAdd || []) set.add(String(pid));
        for (const pid of patch.presentIdsRemove || []) set.delete(String(pid));
        patch.presentIds = [...set];
        delete patch.presentIdsAdd;
        delete patch.presentIdsRemove;
      }
      const merged = { ...current, ...patch };
      if (q.operation === 'DELETE') merged.deleted = true;
      if (pos === undefined) {
        positions.set(id, rows.length);
        rows.push(merged);
      } else {
        rows[pos] = merged;
      }
    }
    next[item.key] = rows;
  }
  return next as AppDatabase;
}
