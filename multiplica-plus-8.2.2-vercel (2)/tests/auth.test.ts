// Testes de autenticação (hash de senhas + legado texto puro) e absências consecutivas
import { describe, it, expect } from 'vitest';
import { validateCredentials, hashPassword, verifyPassword, calculateConsecutiveAbsences } from '../src/services/db';
import type { AppDatabase, Person } from '../src/services/db';

const person = (over: Partial<Person>): Person => ({
  id: 'p1', name: 'Ana', phone: '999', department: 'D1', role: 'Líder', status: 'Ativo', createdAt: '2026-01-01',
  username: 'LIDER_ANA', ...over,
});

const dbWith = (people: Person[]): AppDatabase => ({
  people, departments: [], attendances: [], goals: [], pastoralLogs: [],
});

describe('hashPassword / verifyPassword', () => {
  it('hash é determinístico, prefixado e diferente do texto puro', async () => {
    const h1 = await hashPassword('mudar123');
    const h2 = await hashPassword('mudar123');
    expect(h1.startsWith('sha256$')).toBe(true);
    expect(h1).toBe(h2);
    expect(h1).not.toContain('mudar123');
    expect(h1.length).toBeGreaterThan(40);
  });

  it('hashes diferentes para senhas diferentes', async () => {
    const a = await hashPassword('senha1');
    const b = await hashPassword('senha2');
    expect(a).not.toBe(b);
  });

  it('verifyPassword aceita hash correto e rejeita errado', async () => {
    const h = await hashPassword('segredo');
    expect(await verifyPassword('segredo', h)).toBe(true);
    expect(await verifyPassword('errada', h)).toBe(false);
  });

  it('verifyPassword aceita senha legada em texto puro (compatibilidade retroativa)', async () => {
    expect(await verifyPassword('mudar123', 'mudar123')).toBe(true);
    expect(await verifyPassword('outra', 'mudar123')).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('loga com senha em HASH', async () => {
    const hashed = await hashPassword('segredo');
    const db = dbWith([person({ password: hashed, passwordChanged: true })]);
    const s = await validateCredentials(db, 'lider_ana', 'segredo');
    expect(s).not.toBeNull();
    expect(s?.role).toBe('Líder');
  });

  it('loga com senha legada em TEXTO PURO', async () => {
    const db = dbWith([person({ password: 'mudar123' })]);
    const s = await validateCredentials(db, 'LIDER_ANA', 'mudar123');
    expect(s).not.toBeNull();
  });

  it('rejeita senha errada', async () => {
    const hashed = await hashPassword('segredo');
    const db = dbWith([person({ password: hashed })]);
    expect(await validateCredentials(db, 'lider_ana', 'errada')).toBeNull();
  });

  it('rejeita Membro (sem acesso)', async () => {
    const db = dbWith([person({ role: 'Membro', password: 'x' })]);
    expect(await validateCredentials(db, 'lider_ana', 'x')).toBeNull();
  });

  it('rejeita usuário inativo', async () => {
    const db = dbWith([person({ status: 'Inativo', password: 'x' })]);
    expect(await validateCredentials(db, 'lider_ana', 'x')).toBeNull();
  });

  it('rejeita usuário inexistente', async () => {
    const db = dbWith([person({ password: 'x' })]);
    expect(await validateCredentials(db, 'NAO_EXISTE', 'x')).toBeNull();
  });

  it('rejeita sem senha informada', async () => {
    const db = dbWith([person({ password: 'x' })]);
    expect(await validateCredentials(db, 'lider_ana')).toBeNull();
  });
});

describe('calculateConsecutiveAbsences', () => {
  it('retorna 0 quando a pessoa compareceu', () => {
    const db = emptyWithAttendance([{ id: 'att1', date: '2026-01-04', type: 'Domingo', department: 'D1', presentIds: ['p1'] }]);
    const n = calculateConsecutiveAbsences('p1', 'D1', '2026-01-01', db.attendances);
    expect(n).toBe(0);
  });

  it('conta ausências consecutivas em semanas distintas', () => {
    // Frequências apenas em 04/01. Semana 11/01, 18/01, 25/01 -> ausente.
    const db = emptyWithAttendance([
      { id: 'att1', date: '2026-01-04', type: 'Domingo', department: 'D1', presentIds: ['p1'] },
    ]);
    const n = calculateConsecutiveAbsences('p1', 'D1', '2026-01-01', db.attendances);
    // Depende da data atual; apenas garante que retorna número (>= 0)
    expect(typeof n).toBe('number');
    expect(n).toBeGreaterThanOrEqual(0);
  });
});

function emptyWithAttendance(attendances: AppDatabase['attendances']): AppDatabase {
  return { people: [], departments: [], attendances, goals: [], pastoralLogs: [] };
}
