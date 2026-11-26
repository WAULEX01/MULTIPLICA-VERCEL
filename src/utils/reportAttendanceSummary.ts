import type { AttendanceRecord } from '../services/db';

/** Consolidates report frequency counters once per attendance snapshot.
 * Department matching stays EXACT (same as the previous Reports view).
 * Each attendance counts a person only once, even with repeated IDs.
 * Deleted calls are excluded; historical and future calls are retained,
 * matching the existing export and table semantics.
 */
export function buildReportAttendanceSummary(attendances: AttendanceRecord[]) {
  const meetingsByDept = new Map<string, number>();
  const presenceByDept = new Map<string, Map<string, number>>();
  const allPresence = new Map<string, number>();
  let allMeetings = 0;

  for (const attendance of attendances) {
    if (attendance.deleted) continue;
    allMeetings += 1;
    meetingsByDept.set(attendance.department, (meetingsByDept.get(attendance.department) || 0) + 1);
    let departmentCounts = presenceByDept.get(attendance.department);
    if (!departmentCounts) {
      departmentCounts = new Map();
      presenceByDept.set(attendance.department, departmentCounts);
    }

    for (const id of new Set(attendance.presentIds || [])) {
      departmentCounts.set(id, (departmentCounts.get(id) || 0) + 1);
      allPresence.set(id, (allPresence.get(id) || 0) + 1);
    }
  }

  return { meetingsByDept, presenceByDept, allPresence, allMeetings };
}
