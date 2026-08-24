import { beforeEach, describe, expect, it } from 'vitest';
import { addToSyncQueue, getSyncQueue, initializeDB, saveDB } from '../src/services/db';
import {
  APP_VERSION,
  DATA_GENERATION,
  activateCurrentDataGeneration,
  isCurrentDataGenerationActive,
  prepareCurrentDataGeneration,
} from '../src/services/release';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  (globalThis as any).localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
  };
});

const canonicalDb = () => ({
  people: [], departments: [], attendances: [], goals: [], pastoralLogs: [],
  activityLogs: [], weeklyMissions: [], specialMissions: [], messageHistory: [], events: [],
});

describe('nova geração de dados da v6.9.8', () => {
  it('descarta banco e filas antigas, mas preserva a sessão do usuário', () => {
    localStorage.setItem('multiplica_plus_db', JSON.stringify({ people: [{ id: 'local-antigo' }] }));
    localStorage.setItem('pm_sync_queue', JSON.stringify([{ itemId: 'local-antigo' }]));
    localStorage.setItem('pm_pending_sync', 'true');
    localStorage.setItem('pm_server_revision', '17910');
    localStorage.setItem('multiplica_plus_session', JSON.stringify({ personId: 'pastor' }));

    const result = prepareCurrentDataGeneration();

    expect(result).toEqual({ active: false, reset: true });
    expect(localStorage.getItem('multiplica_plus_db')).toBeNull();
    expect(localStorage.getItem('pm_sync_queue')).toBeNull();
    expect(localStorage.getItem('pm_pending_sync')).toBeNull();
    expect(localStorage.getItem('pm_server_revision')).toBeNull();
    expect(localStorage.getItem('multiplica_plus_session')).not.toBeNull();
  });

  it('não semeia nem abre dados locais antes do primeiro snapshot MySQL', () => {
    prepareCurrentDataGeneration();
    const db = initializeDB();
    expect(db.people).toEqual([]);
    expect(db.attendances).toEqual([]);
    expect(isCurrentDataGenerationActive()).toBe(false);
  });

  it('ativa a geração somente após salvar o snapshot oficial', () => {
    prepareCurrentDataGeneration();
    saveDB(canonicalDb() as any);
    activateCurrentDataGeneration(17910);

    expect(isCurrentDataGenerationActive()).toBe(true);
    expect(localStorage.getItem('pm_data_generation')).toBe(DATA_GENERATION);
    expect(localStorage.getItem('pm_last_migrated_version')).toBe(APP_VERSION);
    expect(localStorage.getItem('pm_server_revision')).toBe('17910');
  });

  it('fila nova identifica geração e versão e mantém somente a edição mais recente', () => {
    activateCurrentDataGeneration(17910);
    addToSyncQueue('people', 'p1', { id: 'p1', phone: '111', version: 1 });
    addToSyncQueue('people', 'p1', { id: 'p1', phone: '222', version: 2 });

    const queue = getSyncQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].data.phone).toBe('222');
    expect(queue[0].generation).toBe(DATA_GENERATION);
    expect(queue[0].clientVersion).toBe(APP_VERSION);
    expect(queue[0].deviceId).toBeTruthy();
  });

  it('ignora silenciosamente qualquer item de uma geração anterior', () => {
    activateCurrentDataGeneration(17910);
    localStorage.setItem('pm_sync_queue', JSON.stringify([{
      id: 'legacy', type: 'people', itemId: 'antigo', data: { id: 'antigo' },
      timestamp: new Date().toISOString(), generation: 'v697', clientVersion: 'v6.9.7-r4',
    }]));
    expect(getSyncQueue()).toEqual([]);
  });
});
