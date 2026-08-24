import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('protocolo delta sync da v7.0', () => {
  const releaseTs = readFileSync('src/services/release.ts', 'utf8');
  const apiTs = readFileSync('src/services/api.ts', 'utf8');
  const appTsx = readFileSync('src/App.tsx', 'utf8');
  const apiPhp = readFileSync('public/api.php', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');
  const html = readFileSync('index.html', 'utf8');

  it('identifica versão e geração em todas as comunicações', () => {
    expect(releaseTs).toContain("APP_VERSION = 'v7.0'");
    expect(releaseTs).toContain("DATA_GENERATION = 'hostinger-master-v700-20260817'");
    expect(apiTs).toContain("'X-Client-Version': CLIENT_VERSION");
    expect(apiTs).toContain("'X-Data-Generation': DATA_GENERATION");
    expect(apiTs).toContain("'X-Device-Id': getOrCreateDeviceId()");
    expect(apiTs).toContain("url.searchParams.set('data_generation', DATA_GENERATION)");
  });

  it('bloqueia gravações de clientes antigos no PHP', () => {
    expect(apiPhp).toContain("'CLIENT_GENERATION_MISMATCH'");
    expect(apiPhp).toContain('$mpProtectedWriteActions');
    expect(apiPhp).toContain('$mpClientVersion !== MP_APP_VERSION');
    expect(apiPhp).toContain('$mpDataGeneration !== MP_DATA_GENERATION');
    expect(apiPhp).toContain("'sync_people_delta'");
    expect(apiPhp).toContain("'sync_attendances_delta'");
  });

  it('clientes antigos sempre recebem a versão completa em vez de 304', () => {
    expect(apiPhp).toContain('$clientVersion === MP_APP_VERSION');
    expect(apiPhp).toContain('"dataGeneration" => MP_DATA_GENERATION');
    expect(apiPhp).toContain("'dataGeneration' => MP_DATA_GENERATION");
  });

  it('não analisa nem reenvia o cache antigo no primeiro acesso', () => {
    expect(appTsx).toContain('prepareCurrentDataGeneration();');
    expect(appTsx).toContain("mode: 'initial-hostinger-snapshot-then-delta'");
    expect(appTsx).not.toContain('analyzeCacheForHostinger(');
    expect(appTsx).not.toContain('Recuperando pendências com a Hostinger');
  });

  it('bloqueia as telas até o primeiro snapshot oficial e não oferece cache antigo', () => {
    expect(appTsx).toContain('if (!versionSyncReady)');
    expect(appTsx).toContain('useState<boolean>(() => isCurrentDataGenerationActive())');
    expect(appTsx).toContain('Nenhum dado antigo será enviado');
    expect(appTsx).not.toContain('Usar cache temporariamente');
    expect(appTsx).toContain('confirmedCloud.dataGeneration !== DATA_GENERATION');
  });

  it('usa cache e service worker exclusivos da v7.0', () => {
    expect(sw).toContain('multiplica-plus-v7.0-delta-index-fence');
    expect(sw).toContain("event.data.type === 'SKIP_WAITING'");
    expect(html).toContain("register('/sw.js?v=700-delta-index-fence')");
    expect(html).toContain('reloadingForUpdate');
  });

  it('não bloqueia novamente um aparelho cuja geração já foi confirmada', () => {
    const readyInitializers = appTsx.match(/useState<boolean>\(\(\) => isCurrentDataGenerationActive\(\)\)/g) || [];
    expect(readyInitializers).toHaveLength(2);
    expect(appTsx).toContain('pull e a fila pendente são processados em segundo plano');
  });

  it('usa Outbox persistente antes de tentar enviar qualquer edição explícita', () => {
    expect(appTsx).toContain('const queuedCount = shouldQueue ? enqueueDatabaseChanges(oldDB, dbToSave) : 0');
    expect(appTsx).toContain('await runPendingPushRef.current()');
    expect(appTsx).toContain('acknowledgeSyncQueue(acknowledgedItems)');
  });

  it('permite download do snapshot em conexão lenta sem reconciliação pesada', () => {
    expect(apiTs).toContain('setTimeout(() => controller.abort(), 120000)');
    expect(appTsx).toContain('const confirmedCloud = await apiGetData()');
    expect(appTsx).toContain('activateCurrentDataGeneration');
  });
});
