import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('protocolo de release Supabase atual', () => {
  const releaseTs = readFileSync('src/services/release.ts', 'utf8');
  const apiTs = readFileSync('src/services/api.ts', 'utf8');
  const appTsx = readFileSync('src/App.tsx', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');
  const html = readFileSync('index.html', 'utf8');

  it('identifica versão e geração Supabase atuais', () => {
    expect(releaseTs).toContain("APP_VERSION = 'v8.2.7'");
    expect(releaseTs).toContain("DATA_GENERATION = 'supabase-master-v800-20260822'");
    expect(releaseTs).toContain('SCHEMA_VERSION = 11');
  });

  it('usa RPCs autenticadas por token da sessão do Multiplica', () => {
    expect(apiTs).toContain('assertSessionToken()');
    expect(apiTs).toContain("'mp_get_snapshot'");
    expect(apiTs).toContain("'mp_pull_changes'");
    expect(apiTs).toContain("'mp_sync_push'");
  });

  it('não reenvia snapshot local como fonte de verdade', () => {
    expect(appTsx).toContain('prepareCurrentDataGeneration();');
    expect(apiTs).toContain("mode: 'supabase-canonical'");
    expect(appTsx).toContain('Nenhum dado antigo será enviado');
  });

  it('preserva Outbox antes de remover operações por ACK', () => {
    expect(appTsx).toContain('enqueueDatabaseChanges(oldDB, dbToSave)');
    expect(appTsx).toContain('acknowledgeSyncQueue(acknowledgedItems)');
  });

  it('mantém service worker atualizado e fallback offline do app shell', () => {
    expect(sw).toContain("const CACHE_NAME = 'multiplica-plus-v8.2.7-update-v1'");
    expect(sw).toContain("caches.match('/index.html')");
    expect(html).toContain("register('/sw.js?v=827-update')");
  });
});
