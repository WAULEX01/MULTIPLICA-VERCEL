// Testes do mergeAppDatabase/mergeArrays (LWW, delete-always-wins, união presentIds)
import { describe, it, expect } from 'vitest';
import { mergeAppDatabase } from '../src/services/db';
import type { AppDatabase } from '../src/services/db';

const emptyDb = (): AppDatabase => ({
  people: [], departments: [], attendances: [], goals: [], pastoralLogs: [],
});

describe('mergeAppDatabase — attendances', () => {
  it('delete-always-wins: registro deleted em qualquer lado vira deleted', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    local.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p1'], deleted: 1, version: 5 }];
    incoming.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p1'], version: 10 }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    expect(merged.attendances[0].deleted).toBe(1);
  });

  it('versão maior vence', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    local.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p1'], version: 2, updatedAt: '2026-01-02T10:00:00Z' }];
    incoming.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p1', 'p2'], version: 3, updatedAt: '2026-01-03T10:00:00Z' }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    expect(merged.attendances[0].presentIds).toEqual(['p1', 'p2']);
  });

  it('mesma versão: UNIÃO de presentIds (nunca perde presença) e version++', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    // Dois dispositivos marcam presença no mesmo evento ao mesmo tempo (versão igual)
    local.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p1', 'p2'], version: 5, updatedAt: '2026-01-02T10:00:00Z' }];
    incoming.attendances = [{ id: 'a1', date: '2026-01-01', type: 'Domingo', department: 'D1', presentIds: ['p3'], version: 5, updatedAt: '2026-01-02T10:00:00Z' }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    const mergedIds = merged.attendances[0].presentIds.slice().sort();
    expect(mergedIds).toEqual(['p1', 'p2', 'p3']);
    expect(merged.attendances[0].version).toBe(6);
  });

  it('registro novo do servidor entra', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    incoming.attendances = [{ id: 'a9', date: '2026-02-01', type: 'EBD', department: 'D2', presentIds: ['p9'], version: 1 }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    expect(merged.attendances).toHaveLength(1);
    expect(merged.attendances[0].id).toBe('a9');
  });
});

describe('mergeAppDatabase — people', () => {
  it('LWW por versão para pessoas', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    local.people = [{ id: 'p1', name: 'Ana', phone: '1', department: 'D1', role: 'Membro', status: 'Ativo', createdAt: '2026-01-01', version: 1, updatedAt: '2026-01-01T00:00:00Z' }];
    incoming.people = [{ id: 'p1', name: 'Ana Silva', phone: '2', department: 'D1', role: 'Membro', status: 'Ativo', createdAt: '2026-01-01', version: 2, updatedAt: '2026-01-02T00:00:00Z' }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    expect(merged.people[0].name).toBe('Ana Silva');
    expect(merged.people[0].phone).toBe('2');
  });

  it('campo vazio de um lado não sobrescreve valor preenchido do outro (mesma versão)', () => {
    const local = emptyDb();
    const incoming = emptyDb();
    local.people = [{ id: 'p1', name: 'Ana', phone: '999', department: 'D1', role: 'Membro', status: 'Ativo', createdAt: '2026-01-01', observations: 'obs importante', version: 1, updatedAt: '2026-01-01T00:00:00Z' }];
    incoming.people = [{ id: 'p1', name: 'Ana', phone: '999', department: 'D1', role: 'Membro', status: 'Ativo', createdAt: '2026-01-01', observations: '', version: 1, updatedAt: '2026-01-02T00:00:00Z' }];
    const merged = mergeAppDatabase(emptyDb(), local, incoming);
    expect(merged.people[0].observations).toBe('obs importante');
  });
});
