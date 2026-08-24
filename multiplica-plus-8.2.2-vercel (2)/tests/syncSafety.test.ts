import { describe, expect, it } from 'vitest';
import { findChanged } from '../src/services/api';
import { addToSyncQueue, collectSyncChanges, getSyncQueue, mergeAppDatabase, reconcileServerSnapshot } from '../src/services/db';
import type { AppDatabase, Person } from '../src/services/db';
import { DATA_GENERATION } from '../src/services/release';

const emptyDb = (): AppDatabase => ({
  people: [],
  departments: [],
  attendances: [],
  goals: [],
  pastoralLogs: [],
  activityLogs: [],
  weeklyMissions: [],
  specialMissions: [],
  messageHistory: [],
  events: [],
});

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Ana',
  phone: '69999999999',
  department: 'D1',
  role: 'Membro',
  startDate: '2026-01-01',
  status: 'Ativo',
  createdAt: '2026-01-01',
  ...overrides,
});

describe('proteções de sincronização offline', () => {
  it('inclui um membro recém-cadastrado na fila de sincronização', () => {
    const created = person({ id: 'novo-1', name: 'Novo membro', version: 1 });
    const changed = collectSyncChanges([], [created]);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe('novo-1');
  });

  it('mantém na fila a edição offline mais recente do mesmo membro', () => {
    if (!(globalThis as any).localStorage) {
      const values = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, String(value)),
        removeItem: (key: string) => values.delete(key),
      };
    }
    localStorage.removeItem('pm_sync_queue');
    localStorage.setItem('pm_data_generation', DATA_GENERATION);
    addToSyncQueue('people', 'p1', person({ phone: '111', version: 2 }));
    addToSyncQueue('people', 'p1', person({ phone: '222', version: 3 }));

    const queue = getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].data.phone).toBe('222');
    expect(queue[0].data.version).toBe(3);
  });

  it('pull repetido do mesmo contato é idempotente e não infla a versão local', () => {
    const device = emptyDb();
    const cloud = emptyDb();
    const unchanged = person({ phone: '69990001111', version: 8, updatedAt: '2026-08-15T10:00:00Z' });
    device.people = [{ ...unchanged }];
    cloud.people = [{ ...unchanged }];

    const firstPull = mergeAppDatabase(device, device, cloud);
    const secondPull = mergeAppDatabase(firstPull, firstPull, cloud);

    expect(firstPull.people[0].version).toBe(8);
    expect(secondPull.people[0].version).toBe(8);
  });

  it('outro aparelho recebe o telefone mais novo salvo no MySQL', () => {
    const deviceB = emptyDb();
    const cloudBefore = emptyDb();
    deviceB.people = [person({ phone: '69911111111', version: 3, updatedAt: '2026-08-15T10:00:00Z' })];
    cloudBefore.people = [{ ...deviceB.people[0] }];

    // Pollings sem mudança não podem alterar a versão do aparelho B.
    const afterPolling = mergeAppDatabase(deviceB, deviceB, cloudBefore);
    const cloudAfter = emptyDb();
    cloudAfter.people = [person({ phone: '69922222222', version: 4, updatedAt: '2026-08-15T10:01:00Z' })];

    const synchronized = mergeAppDatabase(afterPolling, afterPolling, cloudAfter);
    expect(synchronized.people[0].phone).toBe('69922222222');
    expect(synchronized.people[0].version).toBe(4);
  });

  it('substitui uma versão local legada inflada quando não há alteração offline pendente', () => {
    const staleDevice = emptyDb();
    const cloud = emptyDb();
    staleDevice.people = [person({ phone: '69911111111', version: 99 })];
    cloud.people = [person({ phone: '69922222222', version: 4 })];

    const synchronized = reconcileServerSnapshot(staleDevice, cloud, false);
    expect(synchronized.people[0].phone).toBe('69922222222');
    expect(synchronized.people[0].version).toBe(4);
  });

  it('preserva versão local enquanto existe alteração offline pendente', () => {
    const offlineDevice = emptyDb();
    const cloud = emptyDb();
    offlineDevice.people = [person({ phone: '69933333333', version: 5 })];
    cloud.people = [person({ phone: '69922222222', version: 4 })];

    const protectedLocal = reconcileServerSnapshot(offlineDevice, cloud, true);
    expect(protectedLocal.people[0].phone).toBe('69933333333');
    expect(protectedLocal.people[0].version).toBe(5);
  });

  it('preserva alteração local offline quando a versão local é maior', () => {
    const local = emptyDb();
    const cloud = emptyDb();
    local.people = [person({ name: 'Ana Atualizada', version: 4, updatedAt: '2026-08-14T12:00:00Z' })];
    cloud.people = [person({ name: 'Ana', version: 3, updatedAt: '2026-08-14T11:00:00Z' })];

    const merged = mergeAppDatabase(local, local, cloud);
    expect(merged.people[0].name).toBe('Ana Atualizada');
    expect(findChanged(cloud.people, merged.people)).toHaveLength(1);
  });

  it('aceita dado do servidor quando sua versão é realmente mais nova', () => {
    const local = emptyDb();
    const cloud = emptyDb();
    local.people = [person({ phone: '111', version: 4, updatedAt: '2026-08-14T11:00:00Z' })];
    cloud.people = [person({ phone: '222', version: 5, updatedAt: '2026-08-14T12:00:00Z' })];

    const merged = mergeAppDatabase(local, local, cloud);
    expect(merged.people[0].phone).toBe('222');
    expect(merged.people[0].version).toBe(5);
  });

  it('mantém exclusão lógica para impedir que um registro apagado reapareça', () => {
    const local = emptyDb();
    const cloud = emptyDb();
    local.people = [person({ deleted: true, version: 6 })];
    cloud.people = [person({ deleted: false, version: 7 })];

    const merged = mergeAppDatabase(local, local, cloud);
    expect(merged.people[0].deleted).toBe(1);
  });

  it('não transforma a compactação local de logs em exclusões remotas', () => {
    const oldLogs = [{ id: 'l1', action: 'Acesso', timestamp: '2026-08-14T10:00:00Z' }];
    expect(findChanged(oldLogs, [], 'id', false)).toEqual([]);
  });
});
