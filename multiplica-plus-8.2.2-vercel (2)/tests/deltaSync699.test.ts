import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AppDatabase } from '../src/services/db';
import { applyServerDelta } from '../src/services/serverDelta';
import { buildEntityPatch } from '../src/services/syncEngine';

const apiPhp = readFileSync('public/api.php', 'utf8');
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

describe('sincronização incremental entre aparelhos v7.0', () => {
  it('envia somente o campo de batismo editado', () => {
    const before = db().people[0] as any;
    const after = { ...before, baptized: true, version: 5, updatedAt: 'agora' };
    expect(buildEntityPatch('people', before, after)).toEqual({ baptized: true });
  });

  it('representa chamada concorrente como adições e remoções de conjunto', () => {
    const patch = buildEntityPatch(
      'attendances',
      { id: 'a1', presentIds: ['p1', 'p2'], version: 1 },
      { id: 'a1', presentIds: ['p2', 'p3'], version: 2 },
    );
    expect(patch).toEqual({ presentIdsAdd: ['p3'], presentIdsRemove: ['p1'] });
  });

  it('aplica somente o registro recebido e preserva o restante do cache', () => {
    const current = db();
    current.people.push({ ...current.people[0], id: 'p2', name: 'Bruno', phone: '222' });
    const next = applyServerDelta(current, { people: [{ ...current.people[0], phone: '999', version: 5 }] });
    expect(next.people.find(person => person.id === 'p1')?.phone).toBe('999');
    expect(next.people.find(person => person.id === 'p2')?.phone).toBe('222');
  });

  it('mantém MySQL como referência com ACK idempotente e índice por revisão', () => {
    expect(apiPhp).toContain("case 'sync_patches':");
    expect(apiPhp).toContain('INSERT IGNORE INTO operation_logs');
    expect(apiPhp).toContain('CREATE TABLE IF NOT EXISTS sync_change_index');
    expect(apiPhp).toContain('function mp_record_delta_changes');
    expect(apiPhp).toContain("case 'pull_changes':");
    expect(apiPhp).toContain('server_revision > ? AND server_revision <= ?');
    expect(apiPhp).toContain("'mp_delta_baseline_revision'");
    expect(apiPhp).toContain("'people' => $changedPeopleIds");
    expect(apiPhp).toContain('revision_gap_without_delta_index');
  });

  it('consulta deltas a cada cinco segundos e não usa snapshot no polling normal', () => {
    const pollingStart = appTsx.indexOf('const loadFromServer = async');
    const pollingEnd = appTsx.indexOf('const [newPassword', pollingStart);
    const polling = appTsx.slice(pollingStart, pollingEnd);
    expect(polling).toContain('apiPullChanges(serverRevisionRef.current)');
    expect(polling).toContain('let baseDelay = 5000');
    expect(polling).toContain('if (delta.reset_required)');
    expect(apiTs).toContain("post('sync_patches'");
    expect(apiTs).toContain("url.searchParams.set('action', 'pull_changes')");
  });
});
