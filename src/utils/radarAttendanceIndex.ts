import { isSameDepartment } from '../services/db';
import type { AttendanceRecord } from '../services/db';

type WeekDate = { week: string; latestDate: string };

const sundayOf = (dateStr: string): string => {
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const day = new Date(parts[0], parts[1] - 1, parts[2]);
  day.setDate(day.getDate() - day.getDay());
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
};

const setNewest = (map: Map<string, string>, key: string, date: string) => {
  const previous = map.get(key);
  if (!previous || date > previous) map.set(key, date);
};

/**
 * Indexes attendance once per database revision instead of repeatedly scanning
 * the complete attendance history for every member, every Radar keystroke.
 *
 * These rules deliberately mirror calculateConsecutiveAbsences:
 * - only non-deleted calls with at least one person present establish a week;
 * - eligible calls must be between member startDate and today;
 * - presence in ANY department during the same Sunday-based week stops absence;
 * - a week is eligible if at least one call was registered after startDate.
 */
export function createRadarAttendanceIndex(
  attendances: AttendanceRecord[],
  today: string,
) {
  const datedWeeks: Array<{ date: string; week: string; department: string }> = [];
  const allWeeks = new Map<string, string>();
  const presentWeeksByPerson = new Map<string, Map<string, string>>();
  const latestPresenceByDepartment = new Map<string, Map<string, string>>();
  const latestAttendanceByDepartment = new Map<string, AttendanceRecord>();

  for (const attendance of attendances) {
    if (attendance.deleted) continue;

    const lastAttendance = latestAttendanceByDepartment.get(attendance.department);
    if (!lastAttendance || attendance.date > lastAttendance.date) {
      latestAttendanceByDepartment.set(attendance.department, attendance);
    }

    const presentIds = attendance.presentIds || [];
    if (presentIds.length > 0) {
      let deptPresence = latestPresenceByDepartment.get(attendance.department);
      if (!deptPresence) {
        deptPresence = new Map<string, string>();
        latestPresenceByDepartment.set(attendance.department, deptPresence);
      }
      for (const personId of presentIds) {
        setNewest(deptPresence, personId, attendance.date);
      }
    }

    if (attendance.date > today || presentIds.length === 0) continue;

    const week = sundayOf(attendance.date);
    datedWeeks.push({ date: attendance.date, week, department: attendance.department });
    setNewest(allWeeks, week, attendance.date);

    for (const personId of presentIds) {
      let weeks = presentWeeksByPerson.get(personId);
      if (!weeks) {
        weeks = new Map<string, string>();
        presentWeeksByPerson.set(personId, weeks);
      }
      setNewest(weeks, week, attendance.date);
    }
  }

  const eligibleWeeksCache = new Map<string, WeekDate[]>();

  const getWeeksForDepartment = (department: string): WeekDate[] => {
    const cached = eligibleWeeksCache.get(department);
    if (cached) return cached;

    const dateByWeek = new Map<string, string>();
    if (!department || department === 'Todos') {
      allWeeks.forEach((date, week) => dateByWeek.set(week, date));
    } else {
      for (const item of datedWeeks) {
        if (isSameDepartment(item.department, department)) {
          setNewest(dateByWeek, item.week, item.date);
        }
      }
    }

    const ordered = Array.from(dateByWeek, ([week, latestDate]) => ({ week, latestDate }))
      .sort((a, b) => b.week.localeCompare(a.week));
    eligibleWeeksCache.set(department, ordered);
    return ordered;
  };

  return {
    calculateAbsences(personId: string, department: string, startDate: string): number {
      const weeks = getWeeksForDepartment(department);
      const presentWeeks = presentWeeksByPerson.get(personId);
      let consecutive = 0;

      for (const { week, latestDate } of weeks) {
        if (latestDate < startDate) continue;
        const lastPresenceDate = presentWeeks?.get(week);
        if (lastPresenceDate && lastPresenceDate >= startDate) break;
        consecutive += 1;
      }
      return consecutive;
    },

    lastPresence(personId: string, department: string): string {
      const date = latestPresenceByDepartment.get(department)?.get(personId);
      if (!date) return 'Nenhuma chamada';
      const parts = date.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    },

    lastAttendance(department: string): AttendanceRecord | undefined {
      return latestAttendanceByDepartment.get(department);
    },
  };
}

// Reutiliza o mesmo índice quando o usuário sai do Radar e retorna.
// WeakMap libera os dados antigos quando não houver mais referências ao
// array de chamadas; a data local invalida o cache na virada do dia.
// Qualquer novo snapshot com outro array cria um índice atualizado.
type CachedRadarIndex = ReturnType<typeof createRadarAttendanceIndex>;
const radarIndexCache = new WeakMap<
  AttendanceRecord[],
  { date: string; value: CachedRadarIndex }
>();

export function getCachedRadarAttendanceIndex(
  attendances: AttendanceRecord[],
  today: string,
): CachedRadarIndex {
  const cached = radarIndexCache.get(attendances);
  if (cached?.date === today) return cached.value;
  const value = createRadarAttendanceIndex(attendances, today);
  radarIndexCache.set(attendances, { date: today, value });
  return value;
}
