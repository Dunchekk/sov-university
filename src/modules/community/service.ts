import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import type { StudentContext } from "@/server/access";
import { formatDate } from "@/shared/lib/time";
import { z } from "zod";
export const saveEventSchema = z
  .object({ saved: z.boolean().optional(), inCalendar: z.boolean().optional() })
  .strict();

export function communityAudience(groupId: string) {
  return { OR: [{ groupId: null }, { groupId }] };
}

type CommunityHighlight = {
  href: string;
  title: string;
  cover: string | null;
  city: string;
  category: string;
  kind: "Событие" | "Новость";
  date: Date;
};

export async function communityHighlights(groupId: string, now: Date) {
  const audience = communityAudience(groupId);
  const fields = {
    id: true,
    title: true,
    cover: true,
    city: true,
    category: true,
  } as const;
  const [events, news] = await Promise.all([
    db.communityEvent.findMany({
      where: { ...audience, startsAt: { gt: now } },
      select: { ...fields, startsAt: true },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 4,
    }),
    db.newsPost.findMany({
      where: { ...audience, publishedAt: { lte: now } },
      select: { ...fields, publishedAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 4,
    }),
  ]);
  const highlights: CommunityHighlight[] = [];
  for (let index = 0; index < Math.max(events.length, news.length); index++) {
    const event = events[index];
    const post = news[index];
    if (event) {
      const { id, startsAt, ...item } = event;
      highlights.push({
        ...item,
        href: `/community/${id}`,
        kind: "Событие",
        date: startsAt,
      });
    }
    if (post) {
      const { id, publishedAt, ...item } = post;
      highlights.push({
        ...item,
        href: `/community/news/${id}`,
        kind: "Новость",
        date: publishedAt,
      });
    }
  }
  return highlights.map(({ date, ...item }) => ({
    ...item,
    date: date.toISOString(),
    dateLabel: formatDate(date),
  }));
}

export async function communityEvent(student: StudentContext, id: string) {
  const event = await db.communityEvent.findFirst({
    where: { id, ...communityAudience(student.groupId) },
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
