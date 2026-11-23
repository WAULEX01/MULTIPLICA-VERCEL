import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyServerDelta } from '../src/services/serverDelta';

describe('cerca de revisão Supabase entre aparelhos', () => {
  const appTsx = readFileSync('src/App.tsx', 'utf8');
  const apiTs = readFileSync('src/services/api.ts', 'utf8');

  it('sempre envia a revisão conhecida ao pedir delta', () => {
    expect(apiTs).toContain('p_since_revision: Math.max(0, Number(sinceRevision || 0))');
    expect(appTsx).toContain('apiPullChanges(serverRevisionRef.current)');
  });

  it('atualiza estado React e referência interna após delta real', () => {
    expect(appTsx).toContain('setDb(nextDb);');
    expect(appTsx).toContain('dbRef.current = nextDb;');
    expect(appTsx).toContain('serverRevisionRef.current = nextRevision');
  });

  it('delta vazio não reconstrói o banco', () => {
    expect(appTsx).toContain('shouldPersistDatabase = false');
    expect(appTsx).toContain('if (changedEntities.length > 0 || activityLogCountChanged)');
  });

  it('preserva registros não incluídos no delta', () => {
    const current: any = {
      people: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
      departments: [], attendances: [], goals: [], pastoralLogs: [],
      activityLogs: [], weeklyMissions: [], specialMissions: [], messageHistory: [], events: [],
    };
    const next = applyServerDelta(current, { people: [{ id: '1', name: 'A2' }] });
    expect(next.people.find((p: any) => p.id === '1').name).toBe('A2');
    expect(next.people.find((p: any) => p.id === '2').name).toBe('B');
  });
});
