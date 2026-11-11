import { z } from 'zod';
import { type Clock, systemClock } from '@/shared/lib/time';
export const schemeSchema = z.object({ version: z.number().int().positive(), type: z.enum(['POINTS', 'PASS']), admissionPoints: z.number().min(0), passPoints: z.number().min(0), attendanceThreshold: z.number().int().min(0).max(100), attendancePenalty: z.number().int().min(0).max(1), excludeExcused: z.boolean(), thresholds: z.array(z.object({ points: z.number(), grade: z.number().int().min(1).max(10) })) });
export type Scheme = z.infer<typeof schemeSchema>;
export type AttendanceRow = { status: string; lesson: { startsAt: Date; endsAt: Date; cancelled: boolean } };
export function attendanceStats(rows: AttendanceRow[], scheme: Pick<Scheme,'attendanceThreshold'|'excludeExcused'>, remaining: number, clock: Clock = systemClock) {
  let present = 0, absent = 0, excused = 0, unrecorded = 0;
  for (const row of rows) {
    if (row.lesson.cancelled || row.lesson.endsAt > clock.now()) continue;
    if (row.status === 'PRESENT') present++;
    else if (row.status === 'ABSENT') absent++;
    else if (row.status === 'EXCUSED') excused++;
    else unrecorded++;
  }
  const total = present + absent + (scheme.excludeExcused ? 0 : excused);
  const threshold = scheme.attendanceThreshold;
  const meets = total === 0 ? null : present * 100 >= threshold * total;
  let needed: number | null = total === 0 ? null : 0;
  if (total && !meets) needed = threshold === 100 ? null : Math.max(0, Math.ceil((threshold * total - 100 * present) / (100 - threshold)));
  return { present, absent, excused, unrecorded, total, percentage: total ? present / total * 100 : null, meets, needed, remaining, reachable: total === 0 ? null : needed !== null && needed <= remaining };
}
export type AssessmentRow = { id: string; title: string; maxPoints: number; mandatory: boolean; dueAt: Date; results: { points: number | null; status: string }[] };
export function gradeSummary(assessments: AssessmentRow[], scheme: Scheme, attendance: ReturnType<typeof attendanceStats>, clock: Clock = systemClock) {
  let points = 0, maximum = 0, remaining = 0;
  const missing: string[] = [];
  for (const item of assessments) {
    maximum += item.maxPoints;
    const result = item.results[0];
    if (result?.status === 'PUBLISHED' && result.points !== null) points += Math.max(0, Math.min(item.maxPoints, result.points));
    if (item.mandatory && !['PUBLISHED','SUBMITTED'].includes(result?.status ?? '')) missing.push(item.title);
    if ((!result || ['UPCOMING','SUBMITTED'].includes(result.status)) && (item.dueAt >= clock.now() || result?.status === 'SUBMITTED')) remaining += item.maxPoints;
  }
  const baseGrade = [...scheme.thresholds].sort((a,b) => a.points-b.points).filter(t => points >= t.points).at(-1)?.grade ?? 1;
  const penalty = attendance.meets === false ? scheme.attendancePenalty : 0;
  const projectedGrade = Math.max(1, Math.min(10, baseGrade - penalty));
  return { points, maximum, remaining, missing, admitted: points >= scheme.admissionPoints && missing.length === 0, shortfall: Math.max(0, scheme.admissionPoints-points), baseGrade, penalty, projectedGrade, canReachPass: points + remaining >= scheme.passPoints, passed: points >= scheme.passPoints && missing.length === 0 };
}
