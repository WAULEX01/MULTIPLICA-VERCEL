import { beforeEach, describe, expect, it } from 'vitest';
import type { AppDatabase, Person } from '../src/services/db';
import { acknowledgeSyncQueue, addToSyncQueue, getSyncQueue, markSyncQueueInFlight } from '../src/services/db';
import { activateCurrentDataGeneration } from '../src/services/release';
import { collectDatabaseChanges, enqueueDatabaseChanges } from '../src/services/syncEngine';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  activateCurrentDataGeneration(17911);
});

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1', name: 'Pessoa teste', phone: '69999999999', department: 'Jovens',
  departments: [{ department: 'Jovens', role: 'Membro' }], role: 'Membro',
  startDate: '2026-01-01', status: 'Ativo', createdAt: '2026-01-01',
  baptized: false, baptismIntention: 0, version: 4,
  ...overrides,
});

const database = (p: Person): AppDatabase => ({
  people: [p], departments: [], attendances: [], goals: [], pastoralLogs: [],
  activityLogs: [], weeklyMissions: [], specialMissions: [], messageHistory: [], events: [],
});

describe('SyncEngine por patches da v7.0', () => {
  it('coloca uma edição de batismo na Outbox antes da rede', () => {
    const before = database(person());
    const after = database(person({ baptized: true, baptismIntention: 0, version: 5 }));

    expect(collectDatabaseChanges(before, after).people).toHaveLength(1);
    expect(enqueueDatabaseChanges(before, after)).toBe(1);
    expect(getSyncQueue()).toHaveLength(1);
    expect(getSyncQueue()[0].data.baptized).toBe(true);
    expect(getSyncQueue()[0].patch).toEqual({ baptized: true });
  });

  it('preserva uma edição mais nova feita enquanto o envio anterior aguardava ACK', () => {
    addToSyncQueue('people', 'p1', person({ baptized: false, version: 5 }));
    const sentSnapshot = getSyncQueue();
    sentSnapshot[0].timestamp = 'ack-da-edicao-anterior';
    addToSyncQueue('people', 'p1', person({ baptized: true, version: 6 }));

    acknowledgeSyncQueue(sentSnapshot);

    expect(getSyncQueue()).toHaveLength(1);
    expect(getSyncQueue()[0].data.baptized).toBe(true);
    expect(getSyncQueue()[0].data.version).toBe(6);
  });

  it('remove a operação somente quando o ACK corresponde à edição atual', () => {
    addToSyncQueue('people', 'p1', person({ baptized: true, version: 5 }));
    acknowledgeSyncQueue(getSyncQueue());
    expect(getSyncQueue()).toEqual([]);
  });

  it('cria outro UUID quando o usuário edita durante um envio em andamento', () => {
    addToSyncQueue('people', 'p1', person({ baptized: false, version: 5 }), { patch: { baptized: false } });
    const sending = getSyncQueue();
    markSyncQueueInFlight(sending, true);
    addToSyncQueue('people', 'p1', person({ baptized: true, version: 6 }), { patch: { baptized: true } });

    const queue = getSyncQueue();
    expect(queue).toHaveLength(2);
    expect(new Set(queue.map(item => item.id)).size).toBe(2);
    expect(queue.find(item => !item.inFlight)?.patch).toEqual({ baptized: true });
  });
});
