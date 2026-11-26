import { describe, expect, it } from 'vitest';
import { calculateRadarBadgeCount } from '../src/utils/radarBadgeCount';
import { personInDepartment } from '../src/services/db';
import type { AppDatabase, AttendanceRecord, Person, UserSession } from '../src/services/db';

const person = (id: string, department: string, startDate = '2026-01-01'): Person => ({
  id,
  name: 'Pessoa ' + id,
  department,
  departments: [{ department, role: 'Membro' }],
  phone: '',
  role: 'Membro',
  status: 'Ativo',
  startDate,
  createdAt: '2026-01-01',
});

const attendance = (id: string, department: string, date: string, presentIds: string[]): AttendanceRecord => ({
  id, department, date, presentIds, type: 'Domingo',
});

const dbWith = (people: Person[], attendances: AttendanceRecord[]): AppDatabase => ({
  people, attendances, departments: [], goals: [], pastoralLogs: [],
});

const pastor: UserSession = { code: 'pastor-test', role: 'Pastor', name: 'Pastor teste' };

// Implementação original: usada para conferir que a otimização preserva
// os resultados de alertas para situações reais de chamadas/departamentos.
const originalRadarCount = (db: AppDatabase, session: UserSession): number => {
  const restricted = session.role === 'Líder' || session.role === 'Multiplicador';
  const deptFilter = restricted ? session.department : undefined;
  return db.people.filter((p) => {
    if (p.status !== 'Ativo' || p.deleted || (deptFilter && !personInDepartment(p, deptFilter))) return false;
    const ordered = db.attendances
      .filter((a) => a.department === p.department)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let count = 0;
    for (const rec of ordered) {
      if (rec.date < (p.startDate || '2026-01-01')) break;
      if (rec.presentIds.includes(p.id)) break;
      count += 1;
    }
    return count >= 1;
  }).length;
};

describe('radar badge: navegação mobile', () => {
  it('returns zero without authenticated session or loaded database', () => {
    const db = dbWith([person('a', 'JK')], [attendance('1', 'JK', '2026-11-01', [])]);
    expect(calculateRadarBadgeCount(null, pastor)).toBe(0);
    expect(calculateRadarBadgeCount(db, null)).toBe(0);
  });

  it('matches the original calculation with recent/old attendance and deleted/inactive people', () => {
    const active = person('a', 'JK');
    const present = person('b', 'JK');
    const recent = person('c', 'JK', '2026-11-15');
    const deleted = { ...person('d', 'JK'), deleted: true };
    const inactive = { ...person('e', 'JK'), status: 'Inativo' as const };
    const db = dbWith(
      [active, present, recent, deleted, inactive],
      [
        attendance('old', 'JK', '2026-11-10', ['a', 'b', 'c']),
        attendance('new', 'JK', '2026-11-22', ['b']),
        attendance('older', 'JK', '2026-10-01', []),
      ],
    );
    expect(calculateRadarBadgeCount(db, pastor)).toBe(2);
    expect(calculateRadarBadgeCount(db, pastor)).toBe(originalRadarCount(db, pastor));
  });

  it('preserves department restrictions and primary-department attendance behavior', () => {
    const a = person('a', 'Gideões');
    const b = person('b', 'Integração');
    b.departments = [
      { department: 'Integração', role: 'Membro' },
      { department: 'Gideões', role: 'Membro' },
    ];
    const db = dbWith(
      [a, b],
      [attendance('g', 'Gideões', '2026-11-22', []),
       attendance('i', 'Integração', '2026-11-22', [])],
    );
    const leader: UserSession = { code: 'l', role: 'Líder', name: 'Teste', department: 'Gideões' };
    expect(calculateRadarBadgeCount(db, leader)).toBe(2);
    expect(calculateRadarBadgeCount(db, leader)).toBe(originalRadarCount(db, leader));
  });

  it('does not report absence before the person start date', () => {
    const db = dbWith([person('new', 'JK', '2026-11-24')], [attendance('old', 'JK', '2026-11-20', [])]);
    expect(calculateRadarBadgeCount(db, pastor)).toBe(0);
  });

  it('handles 400 people using identical results to the existing badge logic', () => {
    const people = Array.from({ length: 400 }, (_, i) => person(String(i), i % 2 ? 'JK' : 'Centro'));
    const attendances = Array.from({ length: 80 }, (_, i) =>
      attendance(String(i), i % 2 ? 'JK' : 'Centro', `2026-${String(1 + Math.floor(i / 7)).padStart(2, '0')}-${String(1 + (i % 7)).padStart(2, '0')}`,
        i % 3 === 0 ? ['1', '2', '3'] : []),
    );
    const db = dbWith(people, attendances);
    expect(calculateRadarBadgeCount(db, pastor)).toBe(originalRadarCount(db, pastor));
  });
});
