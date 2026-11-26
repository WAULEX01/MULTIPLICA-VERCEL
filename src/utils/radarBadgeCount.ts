import { personInDepartment } from '../services/db';
import type { AppDatabase, AttendanceRecord, UserSession } from '../services/db';

/**
 * O badge do Radar precisa somente da chamada mais recente de cada
 * departamento: se o membro está ausente nela, já existe pelo menos uma falta.
 * Mantém as regras usadas anteriormente no App (status, início e permissão),
 * mas deixa de filtrar e ordenar todas as chamadas para cada pessoa.
 */
export function calculateRadarBadgeCount(
  db: AppDatabase | null,
  session: UserSession | null,
): number {
  if (!db || !session) return 0;

  const restricted = session.role === 'Líder' || session.role === 'Multiplicador';
  const departmentFilter = restricted ? session.department : undefined;
  const latestByDepartment = new Map<string, AttendanceRecord>();

  for (const attendance of db.attendances) {
    const previous = latestByDepartment.get(attendance.department);
    if (
      !previous ||
      new Date(attendance.date).getTime() > new Date(previous.date).getTime()
    ) {
      latestByDepartment.set(attendance.department, attendance);
    }
  }

  let absentCount = 0;
  for (const person of db.people) {
    if (person.status !== 'Ativo' || person.deleted) continue;
    if (departmentFilter && !personInDepartment(person, departmentFilter)) continue;

    const latest = latestByDepartment.get(person.department);
    if (!latest) continue;
    if (latest.date < (person.startDate || '2026-01-01')) continue;
    if (latest.presentIds.includes(person.id)) continue;

    absentCount += 1;
  }
  return absentCount;
}
