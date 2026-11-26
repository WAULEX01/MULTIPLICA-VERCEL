import { describe, expect, it } from 'vitest';
import { calculateConsecutiveAbsences } from '../src/services/db';
import type { AttendanceRecord } from '../src/services/db';
import { createRadarAttendanceIndex, getCachedRadarAttendanceIndex } from '../src/utils/radarAttendanceIndex';
import { getLocalDateISO } from '../src/utils/localDate';

const att = (id: string, department: string, date: string, presentIds: string[], deleted = false): AttendanceRecord =>
  ({ id, department, date, presentIds, type: 'Domingo', deleted });

describe('radar indexed attendance: same pastoral absence rules', () => {
  const today = getLocalDateISO();

  it('counts absence by Sunday weeks and stops if present in another department', () => {
    const rows = [
      att('1', 'Gideões', '2026-09-06', ['other']),
      att('2', 'Gideões', '2026-09-13', ['other']),
      att('3', 'Integração', '2026-09-13', ['member']),
      att('4', 'Gideões', '2026-09-20', ['other']),
      att('5', 'Gideões', '2026-09-27', ['other']),
    ];
    const idx = createRadarAttendanceIndex(rows, today);
    expect(idx.calculateAbsences('member', 'Gideões', '2026-09-01')).toBe(2);
    expect(idx.calculateAbsences('member', 'Gideões', '2026-09-01'))
      .toBe(calculateConsecutiveAbsences('member', 'Gideões', '2026-09-01', rows));
  });

  it('matches the original when calls are deleted, empty, future, or before the start date', () => {
    const rows = [
      att('1', 'JK', '2026-08-02', []),
      att('2', 'JK', '2026-08-09', ['other'], true),
      att('3', 'JK', '2026-08-16', ['other']),
      att('4', 'JK', '2026-08-23', ['other']),
      att('5', 'JK', '2026-08-23', ['member']),
      att('6', 'JK', '2026-08-30', ['other']),
      att('7', 'JK', '2099-01-01', ['other']),
    ];
    const idx = createRadarAttendanceIndex(rows, today);
    for (const startDate of ['2026-01-01', '2026-08-20', '2026-08-25', '2099-01-01']) {
      expect(idx.calculateAbsences('member', 'JK', startDate))
        .toBe(calculateConsecutiveAbsences('member', 'JK', startDate, rows));
    }
  });

  it('matches department aliases (Gideões/Homens, Huperetes/Obreiros, Integração/Discipulado)', () => {
    const rows = [
      att('a', 'Grupo de Homens', '2026-07-05', ['other']),
      att('b', 'Obreiros', '2026-07-12', ['other']),
      att('c', 'Discipulado', '2026-07-19', ['other']),
      att('d', 'Gideões', '2026-07-26', ['other']),
    ];
    const idx = createRadarAttendanceIndex(rows, today);
    for (const department of ['Gideões', 'Huperetes', 'Integração', 'Todos', '']) {
      for (const member of ['other', 'missing']) {
        expect(idx.calculateAbsences(member, department, '2026-07-01'))
          .toBe(calculateConsecutiveAbsences(member, department, '2026-07-01', rows));
      }
    }
  });

  it('uses the latest exact-department attendance for the service widget', () => {
    const rows = [
      att('a', 'JK', '2026-08-02', ['member']),
      att('b', 'JK', '2026-08-09', ['other']),
      att('c', 'JK', '2026-08-16', [], true),
      att('d', 'Centro', '2026-08-23', ['member']),
    ];
    const idx = createRadarAttendanceIndex(rows, today);
    expect(idx.lastAttendance('JK')?.id).toBe('b');
    expect(idx.lastAttendance('Centro')?.id).toBe('d');
    expect(idx.lastPresence('member', 'JK')).toBe('02/08/2026');
    expect(idx.lastPresence('member', 'Centro')).toBe('23/08/2026');
    expect(idx.lastPresence('missing', 'JK')).toBe('Nenhuma chamada');
  });

  it('matches the established calculation across hundreds of member/attendance combinations', () => {
    const departments = ['Gideões', 'Grupo de Homens', 'Huperetes', 'Obreiros', 'Integração', 'Discipulado', 'JK'];
    const rows: AttendanceRecord[] = [];
    for (let week = 0; week < 15; week += 1) {
      const date = new Date(2026, 5, 7 + week * 7);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      for (let dept = 0; dept < departments.length; dept += 1) {
        const present = Array.from({ length: 48 }, (_, n) => String(n))
          .filter(n => (Number(n) * 7 + week * 13 + dept * 5) % 5 !== 0);
        rows.push(att(`${week}-${dept}`, departments[dept], dateStr, present, (week + dept) % 17 === 0));
      }
    }
    const idx = createRadarAttendanceIndex(rows, today);
    for (const department of [...departments, 'Todos', '']) {
      for (let i = 0; i < 48; i += 1) {
        const member = String(i);
        const startDate = i % 3 === 0 ? '2026-07-01' : '2026-06-01';
        expect(idx.calculateAbsences(member, department, startDate))
          .toBe(calculateConsecutiveAbsences(member, department, startDate, rows));
      }
    }
  });
});


describe('radar cache across mobile navigation', () => {
  it('reuses the index after screen remount without changing attendance results', () => {
    const date = getLocalDateISO();
    const rows = [att('1', 'JK', '2026-10-04', ['other']), att('2', 'JK', '2026-10-11', ['member'])];
    const first = getCachedRadarAttendanceIndex(rows, date);
    const returnToScreen = getCachedRadarAttendanceIndex(rows, date);
    expect(returnToScreen).toBe(first);
    expect(first.calculateAbsences('other', 'JK', '2026-01-01'))
      .toBe(calculateConsecutiveAbsences('other', 'JK', '2026-01-01', rows));
  });

  it('invalidates on a changed snapshot or local date', () => {
    const today = getLocalDateISO();
    const rows = [att('1', 'JK', '2026-10-04', ['other'])];
    const baseline = getCachedRadarAttendanceIndex(rows, today);
    const changedRows = [...rows, att('2', 'JK', '2026-10-11', ['other'])];
    const updated = getCachedRadarAttendanceIndex(changedRows, today);
    const tomorrow = getCachedRadarAttendanceIndex(changedRows, '2026-12-01');
    expect(updated).not.toBe(baseline);
    expect(tomorrow).not.toBe(updated);
    expect(getCachedRadarAttendanceIndex(changedRows, '2026-12-01')).toBe(tomorrow);
  });
});
