import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('apiPushChanges — roteamento Supabase atual', () => {
  const api = readFileSync('src/services/api.ts', 'utf8');

  it('converte alterações em operações para mp_sync_push', () => {
    expect(api).toContain("return rpc<any>('mp_sync_push'");
    expect(api).toContain('operation_id: item.id');
    expect(api).toContain('base_version: Number(item.baseVersion || 0)');
    expect(api).toContain('patch: item.patch || item.data || {}');
  });

  it('mantém roteamento por entidade para o helper legado sem endpoints PHP', () => {
    expect(api).toContain("['people','people','id']");
    expect(api).toContain("['attendances','attendances','id']");
    expect(api).toContain("export async function apiSavePeople");
    expect(api).not.toContain("sync_people_delta");
  });
});
