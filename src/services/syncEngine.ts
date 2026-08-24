import type { AppDatabase } from './db';
import { addToSyncQueue, collectSyncChanges } from './db';

export type SyncEntityChanges = Record<string, unknown[]>;

export interface DatabasePatchOperation {
  type: string;
  itemId: string;
  data: Record<string, any>;
  patch: Record<string, any>;
  baseVersion: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
}

const SYNC_ONLY_FIELDS = new Set(['version', 'updatedAt', 'updatedBy']);

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function buildEntityPatch(
  type: string,
  oldItem: Record<string, any> | undefined,
  newItem: Record<string, any>,
): Record<string, any> {
  if (!oldItem) {
    // Chamada nova também precisa nascer como operação de conjunto. Se dois
    // aparelhos criarem a mesma chamada ao mesmo tempo, ambos enviam ADDs e o
    // Supabase faz união; ninguém substitui a lista inteira do outro.
    if (type === 'attendances') {
      const { presentIds = [], ...rest } = newItem;
      return {
        ...Object.fromEntries(Object.entries(rest).filter(([key]) => !SYNC_ONLY_FIELDS.has(key))),
        presentIdsAdd: Array.isArray(presentIds) ? presentIds : [],
      };
    }
    return Object.fromEntries(Object.entries(newItem).filter(([key]) => !SYNC_ONLY_FIELDS.has(key)));
  }

  const patch: Record<string, any> = {};
  for (const [key, value] of Object.entries(newItem)) {
    if (SYNC_ONLY_FIELDS.has(key) || sameValue(value, oldItem[key])) continue;
    if (type === 'attendances' && key === 'presentIds') {
      const before = new Set<string>(Array.isArray(oldItem.presentIds) ? oldItem.presentIds : []);
      const after = new Set<string>(Array.isArray(value) ? value : []);
      patch.presentIdsAdd = [...after].filter(id => !before.has(id));
      patch.presentIdsRemove = [...before].filter(id => !after.has(id));
      continue;
    }
    patch[key] = value;
  }
  return patch;
}

const databaseEntityConfig: Array<{ type: string; key: keyof AppDatabase; pk: 'id' | 'month' }> = [
  { type: 'people', key: 'people', pk: 'id' },
  { type: 'attendances', key: 'attendances', pk: 'id' },
  { type: 'departments', key: 'departments', pk: 'id' },
  { type: 'goals', key: 'goals', pk: 'month' },
  { type: 'pastoralLogs', key: 'pastoralLogs', pk: 'id' },
  { type: 'weeklyMissions', key: 'weeklyMissions', pk: 'id' },
  { type: 'specialMissions', key: 'specialMissions', pk: 'id' },
  { type: 'messageHistory', key: 'messageHistory', pk: 'id' },
  { type: 'events', key: 'events', pk: 'id' },
  { type: 'activityLogs', key: 'activityLogs', pk: 'id' },
];

export function collectDatabasePatchOperations(
  oldDB: AppDatabase | null,
  newDB: AppDatabase,
): DatabasePatchOperation[] {
  const operations: DatabasePatchOperation[] = [];
  for (const config of databaseEntityConfig) {
    const oldItems = ((oldDB?.[config.key] || []) as Record<string, any>[]);
    const newItems = ((newDB[config.key] || []) as Record<string, any>[]);
    const oldMap = new Map(oldItems.map(item => [String(item[config.pk]), item]));
    const newMap = new Map(newItems.map(item => [String(item[config.pk]), item]));

    for (const item of newItems) {
      const itemId = String(item[config.pk] || '');
      if (!itemId) continue;
      const previous = oldMap.get(itemId);
      const patch = buildEntityPatch(config.type, previous, item);
      if (Object.keys(patch).length === 0) continue;
      operations.push({
        type: config.type,
        itemId,
        data: item,
        patch,
        baseVersion: Number(previous?.version || 0),
        operation: !previous ? 'CREATE' : item.deleted ? 'DELETE' : 'UPDATE',
      });
    }

    // Remoção física no estado React vira tombstone; nunca apagamos o registro
    // silenciosamente do banco oficial.
    for (const oldItem of oldItems) {
      const itemId = String(oldItem[config.pk] || '');
      if (!itemId || newMap.has(itemId) || oldItem.deleted) continue;
      const tombstone = {
        ...oldItem,
        deleted: true,
        version: Number(oldItem.version || 0) + 1,
      };
      operations.push({
        type: config.type,
        itemId,
        data: tombstone,
        patch: { deleted: true },
        baseVersion: Number(oldItem.version || 0),
        operation: 'DELETE',
      });
    }
  }
  return operations;
}

/**
 * Calcula somente as entidades alteradas. O resultado é usado pela Outbox
 * persistente antes de qualquer tentativa de rede.
 */
export function collectDatabaseChanges(oldDB: AppDatabase | null, newDB: AppDatabase): SyncEntityChanges {
  return {
    people: collectSyncChanges(oldDB?.people, newDB.people),
    attendances: collectSyncChanges(oldDB?.attendances, newDB.attendances),
    departments: collectSyncChanges(oldDB?.departments, newDB.departments),
    goals: collectSyncChanges(oldDB?.goals, newDB.goals, 'month'),
    pastoralLogs: collectSyncChanges(oldDB?.pastoralLogs, newDB.pastoralLogs),
    weeklyMissions: collectSyncChanges(oldDB?.weeklyMissions, newDB.weeklyMissions),
    specialMissions: collectSyncChanges(oldDB?.specialMissions, newDB.specialMissions),
    messageHistory: collectSyncChanges(oldDB?.messageHistory, newDB.messageHistory),
    events: collectSyncChanges(oldDB?.events, newDB.events),
    activityLogs: collectSyncChanges(oldDB?.activityLogs, newDB.activityLogs),
  };
}

/**
 * Outbox/queue-first: uma edição só deixa de ser pendente depois do ACK do
 * Supabase. Fechar o PWA, perder a conexão ou receber timeout não elimina o dado.
 */
export function enqueueDatabaseChanges(oldDB: AppDatabase | null, newDB: AppDatabase): number {
  const operations = collectDatabasePatchOperations(oldDB, newDB);

  // Disjuntor de segurança: a interface normal edita uma pessoa/departamento
  // por vez. Se uma rotina acidental tentar regravar muitos cadastros em um
  // único ciclo, NÃO envia ao Supabase. Criações em lote continuam permitidas.
  const peopleUpdates = operations.filter(op => op.type === 'people' && op.operation !== 'CREATE');
  const departmentMutations = operations.filter(op => op.type === 'departments');
  if (peopleUpdates.length > 10) {
    console.error(`[Sync Safety] Bloqueado lote anormal de ${peopleUpdates.length} alterações em pessoas.`);
    return 0;
  }
  if (departmentMutations.length > 5) {
    console.error(`[Sync Safety] Bloqueado lote anormal de ${departmentMutations.length} alterações em departamentos.`);
    return 0;
  }

  operations.forEach(operation => {
    addToSyncQueue(operation.type, operation.itemId, operation.data, {
      patch: operation.patch,
      baseVersion: operation.baseVersion,
      operation: operation.operation,
    });
  });
  return operations.length;
}
