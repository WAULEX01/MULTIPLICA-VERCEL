import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('cerca de revisão para sincronização entre dois aparelhos', () => {
  const apiPhp = readFileSync('public/api.php', 'utf8');
  const appTsx = readFileSync('src/App.tsx', 'utf8');
  const getDataStart = apiPhp.indexOf("case 'get_data':");
  const getDataEnd = apiPhp.indexOf("case 'get_activity_logs':", getDataStart);
  const getData = apiPhp.slice(getDataStart, getDataEnd);

  it('lê revisão e dados dentro do mesmo snapshot transacional', () => {
    expect(getDataStart).toBeGreaterThan(-1);
    expect(getData).toContain("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    expect(getData).toContain('$pdo->beginTransaction();');
    expect(getData.indexOf('$pdo->beginTransaction();')).toBeLessThan(getData.indexOf('SELECT * FROM people'));
    expect(getData).toContain('"server_revision" => $snapshotRevision');
    expect(getData.match(/SELECT current_rev FROM global_revision/g)).toHaveLength(1);
  });

  it('não deixa um cliente com revisão maior ficar preso em 304', () => {
    expect(getData).toContain('$snapshotRevision === $sinceRevision');
    expect(getData).not.toContain('$currentRevision <= $sinceRevision');

    const shouldReturnNotModified = (serverRevision: number, deviceRevision: number) =>
      serverRevision === deviceRevision;
    expect(shouldReturnNotModified(180, 180)).toBe(true);
    expect(shouldReturnNotModified(179, 180)).toBe(false);
  });

  it('rejeita cache cujo conteúdo não pertence à revisão atual', () => {
    expect(getData).toContain("mp_getdata_v699.json");
    expect(getData).toContain("$cachedPayload['server_revision']");
    expect(getData).toContain('=== $snapshotRevision');
  });

  it('não executa dezenas de ALTER TABLE a cada polling', () => {
    expect(apiPhp).toContain("key_name = 'mp_schema_version'");
    expect(apiPhp).toContain("GET_LOCK('multiplica_plus_schema_v9', 20)");
    expect(apiPhp).toContain("INSERT INTO settings (key_name, value_data) VALUES ('mp_schema_version', ?)");
  });

  it('atualiza também a referência interna após o pull remoto', () => {
    expect(appTsx).toContain('setDb(nextDb);');
    expect(appTsx).toContain('dbRef.current = nextDb;');
  });
});
