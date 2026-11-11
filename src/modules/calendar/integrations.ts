import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import type { StudentContext } from "@/server/access";
import { invariant, notFound } from "@/server/errors";
import { notify } from "@/modules/notifications";
import { addDays, dateKey } from "@/shared/lib/time";
import {
  parseImport,
  type ImportOptions,
  type ImportedOccurrence,
  exportICS,
  icsHeaders,
} from "./ics";
import { calendarEvents } from "./service";
import { eventTypes } from "./types";

export async function integrations(studentId: string) {
  const [sources, feeds] = await Promise.all([
    db.importSource.findMany({
      where: { studentId, deletedAt: null },
      include: { _count: { select: { events: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.calendarFeed.findMany({
      where: { studentId, revokedAt: null },
      select: { id: true, name: true, layers: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { sources, feeds };
}
export async function previewImport(
  student: StudentContext,
  original: string,
  options: ImportOptions,
) {
  if (
    options.sourceId &&
    !(await db.importSource.findFirst({
      where: { id: options.sourceId, studentId: student.id, deletedAt: null },
    }))
  )
    throw notFound();
  const parsed = await parseImport(original, options);
  const existing = options.sourceId
    ? await db.importedEvent.findMany({
        where: { sourceId: options.sourceId },
        select: { uid: true, recurrenceKey: true, contentHash: true },
      })
    : [];
  const byKey = new Map(
    existing.map((e) => [`${e.uid}\0${e.recurrenceKey}`, e.contentHash]),
  );
  const counts = { added: 0, updated: 0, unchanged: 0 };
  for (const event of parsed.events) {
    const old = byKey.get(`${event.uid}\0${event.recurrenceKey}`);
    counts[
      !old ? "added" : old === event.contentHash ? "unchanged" : "updated"
    ]++;
  }
  await db.importPreview.updateMany({
    where: { expiresAt: { lt: new Date() }, original: { not: null } },
    data: { original: null },
  });
  const preview = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`import-preview:${student.id}`}, 0))`;
    const older = await tx.importPreview.findMany({
      where: { studentId: student.id, original: { not: null } },
      orderBy: { createdAt: "desc" },
      skip: 2,
      select: { id: true },
    });
    await tx.importPreview.updateMany({
      where: { id: { in: older.map((x) => x.id) } },
      data: { original: null },
    });
    return tx.importPreview.create({
      data: {
        studentId: student.id,
        original,
        ...options,
        expiresAt: new Date(Date.now() + 15 * 60000),
      },
    });
  });
  return {
    id: preview.id,
    expiresAt: preview.expiresAt.toISOString(),
    name: options.name,
    from: options.from,
    to: options.to,
    ...counts,
    baseEvents: parsed.baseEvents,
    total: parsed.events.length,
    duplicates: parsed.duplicates,
    warnings: parsed.warnings,
    sample: parsed.events.slice(0, 12).map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      startDate: e.startDate,
      cancelled: e.cancelled,
    })),
  };
}
type CommitResult = {
  sourceId: string;
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
};
function previousCommit(value: unknown, replace: boolean) {
  const prior = value as { replace: boolean; result: CommitResult };
  invariant(
    prior.replace === replace,
    409,
    "IMPORT_REPLAY",
    "Этот предпросмотр уже подтверждён с другими настройками.",
  );
  return prior.result;
}
const occurrenceData = (event: ImportedOccurrence) => ({
  ...event,
  startsAt: event.startsAt ? new Date(event.startsAt) : null,
  endsAt: event.endsAt ? new Date(event.endsAt) : null,
});
export async function commitImport(
  student: StudentContext,
  id: string,
  replace: boolean,
) {
  const preview = await db.importPreview.findFirst({
    where: { id, studentId: student.id },
  });
  if (!preview) throw notFound();
  if (preview.committed) return previousCommit(preview.committed, replace);
  invariant(
    preview.original && preview.expiresAt > new Date(),
    410,
    "PREVIEW_EXPIRED",
    "Предпросмотр истёк. Загрузите файл ещё раз.",
  );
  const parsed = await parseImport(preview.original, {
    name: preview.name,
    sourceId: preview.sourceId ?? undefined,
    timezone: preview.timezone,
    from: preview.from,
    to: preview.to,
  });
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`imports:${student.id}`}, 0))`;
      const current = await tx.importPreview.findUniqueOrThrow({
        where: { id },
      });
      if (current.committed) return previousCommit(current.committed, replace);
      invariant(
        current.original && current.expiresAt > new Date(),
        410,
        "PREVIEW_EXPIRED",
        "Предпросмотр истёк. Загрузите файл ещё раз.",
      );
      let sourceId = current.sourceId;
      if (sourceId) {
        if (
          !(await tx.importSource.findFirst({
            where: { id: sourceId, studentId: student.id, deletedAt: null },
          }))
        )
          throw notFound();
        await tx.importSource.update({
          where: { id: sourceId },
          data: { name: current.name },
        });
      } else {
        invariant(
          (await tx.importSource.count({
            where: { studentId: student.id, deletedAt: null },
          })) < 10,
          422,
          "SOURCE_LIMIT",
          "Можно хранить до 10 импортированных слоёв. Удалите ненужный слой.",
        );
        sourceId = (
          await tx.importSource.create({
            data: { studentId: student.id, name: current.name },
          })
        ).id;
      }
      const existing = await tx.importedEvent.findMany({ where: { sourceId } });
      const byKey = new Map(
        existing.map((e) => [`${e.uid}\0${e.recurrenceKey}`, e]),
      );
      const result: CommitResult = {
        sourceId,
        added: 0,
        updated: 0,
        unchanged: 0,
        removed: 0,
      };
      const added = [];
      for (const event of parsed.events) {
        const key = `${event.uid}\0${event.recurrenceKey}`;
        const prior = byKey.get(key);
        byKey.delete(key);
        if (!prior) {
          added.push({ sourceId, ...occurrenceData(event) });
          result.added++;
        } else if (prior.contentHash === event.contentHash) result.unchanged++;
        else {
          await tx.importedEvent.update({
            where: { id: prior.id },
            data: { ...occurrenceData(event), sequence: { increment: 1 } },
          });
          result.updated++;
        }
      }
      await tx.importedEvent.createMany({ data: added });
      if (replace) {
        // Retain cancelled tombstones for existing subscribers, including events
        // outside this import window. Replacement is an explicit whole-layer action.
        result.removed = (
          await tx.importedEvent.updateMany({
            where: {
              id: {
                in: [...byKey.values()]
                  .filter((e) => !e.cancelled)
                  .map((e) => e.id),
              },
            },
            data: {
              cancelled: true,
              contentHash: "removed",
              sequence: { increment: 1 },
            },
          })
        ).count;
      }
      await tx.importPreview.update({
        where: { id },
        data: { original: null, committed: { replace, result } },
      });
      await notify(
        tx,
        student.id,
        "CALENDAR",
        "Календарь импортирован",
        `Добавлено ${result.added}, обновлено ${result.updated}.`,
        "/calendar",
        `import:${id}`,
      );
      return result;
    },
    { timeout: 60000 },
  );
}
export async function removeSource(studentId: string, id: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`imports:${studentId}`}, 0))`;
    const source = await tx.importSource.findFirst({
      where: { id, studentId, deletedAt: null },
    });
    if (!source) throw notFound();
    await tx.importSource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await tx.importedEvent.updateMany({
      where: { sourceId: id, cancelled: false },
      data: { cancelled: true, sequence: { increment: 1 } },
    });
    await tx.importPreview.updateMany({
      where: { sourceId: id, studentId },
      data: { original: null },
    });
    return { ok: true };
  });
}
export const feedInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    layers: z.array(z.enum(eventTypes)).min(1).max(5),
  })
  .strict();
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createFeed(
  studentId: string,
  input: z.infer<typeof feedInput>,
) {
  const token = randomBytes(32).toString("base64url");
  const feed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`feeds:${studentId}`}, 0))`;
    invariant(
      (await tx.calendarFeed.count({ where: { studentId, revokedAt: null } })) <
        10,
      422,
      "FEED_LIMIT",
      "Можно создать до 10 активных ссылок. Отзовите ненужную.",
    );
    return tx.calendarFeed.create({
      data: { studentId, tokenHash: tokenHash(token), ...input },
      select: { id: true },
    });
  });
  return {
    id: feed.id,
    url: `${process.env.APP_URL}/api/calendar/feeds/${token}/calendar.ics`,
  };
}
export async function revokeFeed(studentId: string, id: string) {
  const result = await db.calendarFeed.updateMany({
    where: { id, studentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw notFound();
  return { ok: true };
}
export async function readFeed(request: Request, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw notFound();
  const feed = await db.calendarFeed.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { student: { select: { id: true, groupId: true } } },
  });
  if (!feed || feed.revokedAt) throw notFound();
  const body = exportICS(
    await calendarEvents(
      feed.student,
      {
        from: addDays(dateKey(), -30),
        to: addDays(dateKey(), 181),
        types: feed.layers as (typeof eventTypes)[number][],
      },
      { includeDeleted: true },
    ),
  );
  const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
  // Authentication and revocation must precede the conditional response.
  if (request.headers.get("if-none-match") === etag)
    return new Response(null, {
      status: 304,
      headers: { ...icsHeaders, ETag: etag },
    });
  return new Response(body, { headers: { ...icsHeaders, ETag: etag } });
}
