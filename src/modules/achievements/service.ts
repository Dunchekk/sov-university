import { z } from "zod";
import { db } from "@/server/db";
import { safeUrl } from "@/server/http";
import { invariant, notFound } from "@/server/errors";
import type { StudentContext } from "@/server/access";
import { idempotent } from "@/server/idempotency";
import { notify } from "@/modules/notifications";
export const achievementFields = z
  .object({
    title: z.string().trim().min(1).max(180),
    category: z.enum([
      "Учёба",
      "Наука",
      "Творчество",
      "Спорт",
      "Общественная деятельность",
    ]),
    date: z.iso.date(),
    description: z.string().max(2000),
    organizer: z.string().max(200),
    coauthors: z.string().max(500).default(""),
    evidenceUrl: z.union([safeUrl, z.literal("")]).optional(),
  })
  .strict();
export const achievementCreate = achievementFields.extend({
  key: z.string().min(8).max(128),
});
export const achievementUpdate = achievementFields.extend({
  version: z.number().int().min(0),
});
export const achievementAction = z
  .object({
    action: z.enum(["submit", "respond"]),
    version: z.number().int().min(0),
    key: z.string().min(8).max(128),
  })
  .strict();
export async function achievementDetail(student: StudentContext, id: string) {
  const item = await db.achievement.findFirst({
    where: { id, studentId: student.id },
    include: {
      files: { select: { id: true, originalName: true, size: true } },
      history: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  if (!item) throw notFound();
  return item;
}
export async function createAchievement(
  student: StudentContext,
  input: z.infer<typeof achievementCreate>,
) {
  const { key, ...fields } = input;
  return idempotent(
    student.id,
    "achievement:create",
    key,
    fields,
    async (tx) => {
      const item = await tx.achievement.create({
        data: {
          ...fields,
          evidenceUrl: fields.evidenceUrl || null,
          studentId: student.id,
          history: { create: { status: "DRAFT", text: "Черновик создан." } },
        },
      });
      return { id: item.id, version: item.version };
    },
  );
}
export async function updateAchievement(
  student: StudentContext,
  id: string,
  input: z.infer<typeof achievementUpdate>,
) {
  const { version, ...fields } = input;
  const changed = await db.achievement.updateMany({
    where: {
      id,
      studentId: student.id,
      status: { in: ["DRAFT", "NEEDS_INFO"] },
      version,
    },
    data: {
      ...fields,
      evidenceUrl: fields.evidenceUrl || null,
      version: { increment: 1 },
    },
  });
  invariant(
    changed.count === 1,
    409,
    "CONFLICT",
    "Достижение изменилось или уже отправлено.",
  );
  return { id, version: version + 1 };
}
export async function submitAchievement(
  student: StudentContext,
  id: string,
  input: z.infer<typeof achievementAction>,
) {
  return idempotent(
    student.id,
    `achievement:${id}:${input.action}`,
    input.key,
    input,
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${student.id}`},0))`;
      const item = await tx.achievement.findFirst({
        where: { id, studentId: student.id },
        include: { files: { select: { id: true } } },
      });
      if (!item) throw notFound();
      invariant(
        item.status === (input.action === "respond" ? "NEEDS_INFO" : "DRAFT"),
        409,
        "STATUS",
        "Это действие сейчас недоступно.",
      );
      invariant(
        item.evidenceUrl || item.files.length > 0,
        422,
        "EVIDENCE",
        "Добавьте подтверждающий PDF или HTTPS-ссылку.",
      );
      invariant(
        item.organizer.trim() && item.description.trim(),
        422,
        "FIELDS",
        "Укажите организатора и описание.",
      );
      const changed = await tx.achievement.updateMany({
        where: {
          id,
          studentId: student.id,
          version: input.version,
          status: item.status,
        },
        data: { status: "SUBMITTED", version: { increment: 1 } },
      });
      invariant(
        changed.count === 1,
        409,
        "CONFLICT",
        "Достижение изменилось. Обновите страницу.",
      );
      await tx.achievementHistory.create({
        data: {
          achievementId: id,
          status: "SUBMITTED",
          text:
            input.action === "respond"
              ? "Уточнение отправлено на проверку."
              : "Достижение отправлено на проверку.",
        },
      });
      await notify(
        tx,
        student.id,
        "STUDY",
        "Достижение отправлено",
        "Ожидайте проверки подтверждения.",
        `/studies/achievements/${id}`,
        `achievement:${id}:${input.version + 1}`,
      );
      return { id, status: "SUBMITTED", version: input.version + 1 };
    },
  );
}
