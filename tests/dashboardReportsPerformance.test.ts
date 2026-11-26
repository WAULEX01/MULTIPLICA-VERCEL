import { describe, expect, it } from 'vitest';
import type { AppDatabase, AttendanceRecord, Person } from '../src/services/db';
import { getStats } from '../src/services/db';
import { getCachedRadarAttendanceIndex } from '../src/utils/radarAttendanceIndex';
import { buildReportAttendanceSummary } from '../src/utils/reportAttendanceSummary';
import { getLocalDateISO } from '../src/utils/localDate';

const call = (id: string, department: string, date: string, presentIds: string[], deleted = false): AttendanceRecord =>
  ({ id, department, date, presentIds, type: 'Domingo', deleted });

describe('mobile report summaries preserve the original counts', () => {
  const records = [
    call('1', 'JK', '2026-10-04', ['a', 'a', 'b']),
    call('2', 'JK', '2026-10-11', ['b']),
    call('3', 'Gideões', '2026-10-11', ['a']),
    call('4', 'JK', '2026-10-18', ['a'], true),
    call('5', 'Gideões', '2026-10-18', []),
    call('6', '', '2026-10-25', ['a']),
  ];
  it('matches the old filter + includes behavior per department and globally', () => {
    const summary = buildReportAttendanceSummary(records);
    for (const dept of ['', 'JK', 'Gideões', 'Grupo de Homens', 'Todos']) {
      for (const personId of ['a', 'b', 'missing']) {
        const eligible = records.filter(r => !r.deleted && (!dept || r.department === dept));
        const expectedCount = eligible.filter(r => r.presentIds.includes(personId)).length;
        const actualCount = dept
          ? (summary.presenceByDept.get(dept)?.get(personId) || 0)
          : (summary.allPresence.get(personId) || 0);
        expect(actualCount).toBe(expectedCount);
        const totalMeetings = dept ? summary.meetingsByDept.get(dept) || 0 : summary.allMeetings;
        expect(totalMeetings).toBe(eligible.length);
      }
    }
  });

  it('keeps the total counts unchanged for many records and people', () => {
    const departments = ['JK', 'Gideões', 'Integração', 'Huperetes'];
    const records: AttendanceRecord[] = [];
    for (let i = 0; i < 200; i++) {
      records.push(call(String(i), departments[i % departments.length], '2026-10-11',
        Array.from({ length: 60 }, (_, n) => String(n)).filter(n => (Number(n) + i) % 4 === 0), i % 19 === 0));
    }
    const summary = buildReportAttendanceSummary(records);
    for (const dept of ['', ...departments]) {
      for (let person = 0; person < 60; person++) {
        const eligible = records.filter(r => !r.deleted && (!dept || r.department === dept));
        const count = eligible.filter(r => r.presentIds.includes(String(person))).length;
        const indexed = dept
          ? (summary.presenceByDept.get(dept)?.get(String(person)) || 0)
          : (summary.allPresence.get(String(person)) || 0);
        expect(indexed).toBe(count);
      }
    }
  });
});

describe('dashboard indexed radar statistics', () => {
  it('returns the same dashboard numbers and alert counts as the original algorithm', () => {
    const departments = ['JK', 'Gideões', 'Integração'];
    const people: Person[] = Array.from({ length: 40 }, (_, n) => ({
      id: String(n), name: 'Pessoa ' + n, phone: '', department: departments[n % 3],
      role: 'Membro' as const, startDate: n % 4 === 0 ? '2026-10-01' : '2026-01-01',
      status: n % 11 === 0 ? 'Arquivado' as const : 'Ativo' as const,
      createdAt: '2026-01-01', deleted: n % 31 === 0,
    }));
    const attendances: AttendanceRecord[] = [];
    for (let week = 0; week < 8; week++) {
      const date = new Date(2026, 9, 4 + week * 7);
      const dateISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      departments.forEach((dept, i) => {
        attendances.push(call(`${i}-${week}`, dept, dateISO,
          people.filter((_, n) => (n + week + i) % 5 === 0).map(p => p.id)));
      });
    }
    const db: AppDatabase = {
      people, attendances, departments: departments.map((name, i) => ({ id: String(i), name, description: '' })),
      goals: [], pastoralLogs: [],
    };
    const index = getCachedRadarAttendanceIndex(db.attendances, getLocalDateISO());
    for (const dept of [undefined, ...departments, 'Grupo de Homens']) {
      expect(getStats(db, dept, index.calculateAbsences)).toEqual(getStats(db, dept));
    }
  });
});
