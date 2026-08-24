import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiPushChanges } from '../src/services/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiPushChanges — roteamento da fila de retry', () => {
  it('retorna o tipo people quando somente o contato falha no servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), 'https://multiplicaplus.test');
      const action = url.searchParams.get('action');
      if (action === 'sync_people_delta') {
        return { ok: false, status: 503, json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) } as Response;
    }));

    const oldDb = {
      people: [{ id: 'p1', name: 'Ana', phone: '111' }],
      departments: [{ id: 'd1', name: 'Departamento A' }]
    };
    const newDb = {
      people: [{ id: 'p1', name: 'Ana', phone: '222' }],
      departments: [{ id: 'd1', name: 'Departamento B' }]
    };

    await expect(apiPushChanges(oldDb, newDb)).resolves.toEqual(['people']);
  });
});
