import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import type { StudentContext } from "@/server/access";
import { z } from "zod";
export const saveEventSchema = z
  .object({ saved: z.boolean().optional(), inCalendar: z.boolean().optional() })
  .strict();
export async function communityEvent(student: StudentContext, id: string) {
  const event = await db.communityEvent.findFirst({
    where: { id, OR: [{ groupId: null }, { groupId: student.groupId }] },
    include: {
      savedBy: {
        where: { studentId: student.id },
        select: { saved: true, inCalendar: true },
      },
    },
  });
  if (!event) throw notFound();
  return event;
}
export async function saveEvent(
  student: StudentContext,
  id: string,
  input: z.infer<typeof saveEventSchema>,
) {
  await communityEvent(student, id);
  return db.savedEvent.upsert({
    where: { studentId_eventId: { studentId: student.id, eventId: id } },
    create: { studentId: student.id, eventId: id, saved: false, ...input },
    update: input,
    select: { saved: true, inCalendar: true },
  });
}
