import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AppDatabase } from '../src/services/db';
import { applyServerDelta } from '../src/services/serverDelta';
import { buildEntityPatch } from '../src/services/syncEngine';

const appTsx = readFileSync('src/App.tsx', 'utf8');
const apiTs = readFileSync('src/services/api.ts', 'utf8');

const db = (): AppDatabase => ({
  people: [{
    id: 'p1', name: 'Ana', phone: '111', department: 'Jovens', role: 'Membro',
    startDate: '2026-01-01', status: 'Ativo', createdAt: '2026-01-01', baptized: false, version: 4,
  }],
  departments: [], attendances: [], goals: [], pastoralLogs: [], activityLogs: [],
  weeklyMissions: [], specialMissions: [], messageHistory: [], events: [],
});

describe('sincronização incremental Supabase', () => {
  it('envia somente o campo de batismo editado', () => {
    const before = db().people[0] as any;
    const after = { ...before, baptized: true, version: 5, updatedAt: 'agora' };
    expect(buildEntityPatch('people', before, after)).toEqual({ baptized: true });
  });

  it('representa chamada concorrente como adições e remoções de conjunto', () => {
    expect(buildEntityPatch(
      'attendances',
      { id: 'a1', presentIds: ['p1', 'p2'], version: 1 },
      { id: 'a1', presentIds: ['p2', 'p3'], version: 2 },
    )).toEqual({ presentIdsAdd: ['p3'], presentIdsRemove: ['p1'] });
  });

  it('aplica somente o registro recebido e preserva o restante do cache', () => {
    const current = db();
    current.people.push({ ...current.people[0], id: 'p2', name: 'Bruno', phone: '222' });
    const next = applyServerDelta(current, { people: [{ ...current.people[0], phone: '999', version: 5 }] });
    expect(next.people.find(person => person.id === 'p1')?.phone).toBe('999');
    expect(next.people.find(person => person.id === 'p2')?.phone).toBe('222');
  });

  it('usa RPCs Supabase para push e pull incremental', () => {
    expect(apiTs).toContain("'mp_sync_push'");
    expect(apiTs).toContain("'mp_pull_changes'");
    expect(apiTs).toContain('p_since_revision');
    expect(apiTs).toContain('p_operations');
  });

  it('mantém polling apenas como fallback e usa delta no fluxo normal', () => {
    const pollingStart = appTsx.indexOf('const loadFromServer = async');
    const pollingEnd = appTsx.indexOf('const [newPassword', pollingStart);
    const polling = appTsx.slice(pollingStart, pollingEnd);
    expect(polling).toContain('apiPullChanges(serverRevisionRef.current)');
    expect(polling).toContain('let baseDelay = 30000');
    expect(polling).toContain('if (delta.reset_required)');
  });
});
