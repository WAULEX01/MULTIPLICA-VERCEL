import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGetVersionInfo } from '../src/services/api';
import { APP_VERSION, DATA_GENERATION, SCHEMA_VERSION } from '../src/services/release';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('detecção de versão publicada', () => {
  it('consulta o manifesto sem usar cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appVersion: 'v8.2.8',
        dataGeneration: DATA_GENERATION,
        schemaVersion: SCHEMA_VERSION,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGetVersionInfo()).resolves.toEqual({
      appVersion: 'v8.2.8',
      dataGeneration: DATA_GENERATION,
      schemaVersion: SCHEMA_VERSION,
    });
    expect(fetchMock).toHaveBeenCalledWith('/version.json', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  });

  it('mantém a versão atual quando o manifesto estiver temporariamente indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(apiGetVersionInfo()).resolves.toEqual({
      appVersion: APP_VERSION,
      dataGeneration: DATA_GENERATION,
      schemaVersion: SCHEMA_VERSION,
    });
  });
});
