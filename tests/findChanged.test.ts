import { describe, it, expect } from 'vitest';
import { findChanged } from '../src/services/api';

describe('findChanged helper legado', () => {
  it('detecta item novo', () => {
    expect(findChanged([], [{ id: 'a', name: 'Ana', version: 1 }])).toHaveLength(1);
  });

  it('detecta qualquer alteração do objeto atual', () => {
    const oldArr = [{ id: 'a', name: 'Ana', phone: '111', version: 1 }];
    const newArr = [{ id: 'a', name: 'Ana', phone: '222', version: 2 }];
    expect(findChanged(oldArr, newArr)).toHaveLength(1);
  });

  it('considera mudança de version uma alteração neste helper legado', () => {
    const oldArr = [{ id: 'a', name: 'Ana', version: 1 }];
    const newArr = [{ id: 'a', name: 'Ana', version: 2 }];
    expect(findChanged(oldArr, newArr)).toHaveLength(1);
  });

  it('não gera tombstone para remoção física; tombstones pertencem ao syncEngine', () => {
    expect(findChanged([{ id: 'a', name: 'Ana', version: 3 }], [])).toEqual([]);
  });

  it('usa o campo de chave informado para comparar itens existentes', () => {
    const oldArr = [{ month: '2026-01', targetMembers: 100 }];
    const same = [{ month: '2026-01', targetMembers: 100 }];
    expect(findChanged(oldArr, same, 'month')).toEqual([]);
  });
});
