// Testes do findChanged (detecção de alterações + remoções físicas -> tombstones)
import { describe, it, expect } from 'vitest';
import { findChanged } from '../src/services/api';

describe('findChanged', () => {
  it('detecta item novo', () => {
    const oldArr: any[] = [];
    const newArr = [{ id: 'a', name: 'Ana', version: 1 }];
    const changed = findChanged(oldArr, newArr);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe('a');
  });

  it('detecta item modificado ignorando campos de sync', () => {
    const oldArr = [{ id: 'a', name: 'Ana', phone: '111', version: 1, updatedAt: 't1', updatedBy: 'x' }];
    const newArr = [{ id: 'a', name: 'Ana', phone: '222', version: 2, updatedAt: 't2', updatedBy: 'x' }];
    const changed = findChanged(oldArr, newArr);
    expect(changed).toHaveLength(1);
    expect(changed[0].phone).toBe('222');
  });

  it('não reporta item idêntico (mesmo conteúdo, version/updatedAt diferentes)', () => {
    const oldArr = [{ id: 'a', name: 'Ana', phone: '111', version: 1, updatedAt: 't1', updatedBy: 'x' }];
    const newArr = [{ id: 'a', name: 'Ana', phone: '111', version: 2, updatedAt: 't2', updatedBy: 'x' }];
    const changed = findChanged(oldArr, newArr);
    expect(changed).toHaveLength(0);
  });

  it('gera tombstone (deleted:1, version+1) para item removido fisicamente', () => {
    const oldArr = [{ id: 'a', name: 'Ana', phone: '111', version: 3, updatedAt: 't1', updatedBy: 'x' }];
    const newArr: any[] = [];
    const changed = findChanged(oldArr, newArr);
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe('a');
    expect(changed[0].deleted).toBe(1);
    expect(changed[0].version).toBe(4);
    expect(changed[0].name).toBe('Ana'); // preserva conteúdo p/ o servidor saber o que marcar
  });

  it('NÃO gera tombstone quando item já estava deleted no estado antigo', () => {
    const oldArr = [{ id: 'a', name: 'Ana', deleted: 1, version: 4 }];
    const newArr: any[] = [];
    const changed = findChanged(oldArr, newArr);
    expect(changed).toHaveLength(0);
  });

  it('detectRemovals=false não gera tombstone (logs append-only)', () => {
    const oldArr = [{ id: 'l1', action: 'logou', version: 1 }];
    const newArr: any[] = [];
    const changed = findChanged(oldArr, newArr, 'id', false);
    expect(changed).toHaveLength(0);
  });

  it('usa pkField month para goals', () => {
    const oldArr = [{ month: '2026-01', targetMembers: 100 }];
    const newArr: any[] = [];
    const changed = findChanged(oldArr, newArr, 'month');
    expect(changed).toHaveLength(1);
    expect(changed[0].month).toBe('2026-01');
    expect(changed[0].deleted).toBe(1);
  });
});
