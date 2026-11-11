import { z } from "zod";
import { db } from "@/server/db";
import { invariant, notFound } from "@/server/errors";
import { idempotent } from "@/server/idempotency";
import type { StudentContext } from "@/server/access";
import { notify } from "@/modules/notifications";
export const submissionSchema = z
  .object({
    fileId: z.string().min(1).max(100),
    comment: z.string().max(2000),
    key: z.string().min(8).max(128),
    version: z.number().int().min(0),
  })
  .strict();
export async function projectDetail(student: StudentContext, id: string) {
  const project = await db.studentProject.findFirst({
    where: { id, studentId: student.id },
    include: {
      supervisor: true,
      milestones: { orderBy: { dueAt: "asc" } },
      submissions: {
        orderBy: { version: "desc" },
        include: {
          file: { select: { id: true, originalName: true, size: true } },
        },
      },
      files: {
        where: {
          OR: [
            { purpose: "PROJECT_TEMPLATE" },
            { purpose: "PROJECT_UPLOAD", submission: null },
          ],
        },
        select: { id: true, originalName: true, purpose: true },
      },
    },
  });
  if (!project) throw notFound();
  return project;
}
export async function submitProject(
  student: StudentContext,
  id: string,
  input: z.infer<typeof submissionSchema>,
) {
  return idempotent(
    student.id,
    `project:${id}:submit`,
    input.key,
    input,
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${student.id}`},0))`;
      const project = await tx.studentProject.findFirst({
        where: { id, studentId: student.id },
        include: { submissions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (!project) throw notFound();
      invariant(
        ["OPEN", "REVISION"].includes(project.status),
        409,
        "STATUS",
        "Сейчас работа не открыта для отправки.",
      );
      invariant(
        project.version === input.version,
        409,
        "CONFLICT",
        "Работа изменилась. Обновите страницу.",
      );
      const late = project.dueAt < new Date();
      invariant(
        !late || project.allowLate,
        422,
        "DEADLINE",
        "Срок сдачи прошёл. Поздняя отправка не разрешена.",
      );
      const file = await tx.fileObject.findFirst({
        where: {
          id: input.fileId,
          studentId: student.id,
          projectId: id,
          purpose: "PROJECT_UPLOAD",
          submission: null,
        },
      });
      if (!file) throw notFound();
      const version = (project.submissions[0]?.version ?? 0) + 1;
      const submission = await tx.submission.create({
        data: {
          projectId: id,
          version,
          fileId: file.id,
          comment: input.comment,
          late,
        },
      });
      const changed = await tx.studentProject.updateMany({
        where: {
          id,
          studentId: student.id,
          version: input.version,
          status: { in: ["OPEN", "REVISION"] },
        },
        data: { status: "SUBMITTED", version: { increment: 1 } },
      });
      invariant(changed.count === 1, 409, "CONFLICT", "Работа изменилась.");
      await notify(
        tx,
        student.id,
        "STUDY",
        "Версия отчёта отправлена",
        `Версия ${version} ожидает проверки.`,
        `/studies/projects/${id}`,
        `submission:${submission.id}`,
      );
      return { id: submission.id, version, status: "SUBMITTED" };
    },
  );
}
