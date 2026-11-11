import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { db } from '@/server/db';
import { invariant, notFound } from '@/server/errors';
import type { StudentContext } from '@/server/access';
import { z } from 'zod';
import { readLimited } from '@/server/body';
const inputSchema = z.object({ purpose: z.enum(['REQUEST_ATTACHMENT','PROJECT_UPLOAD','ACHIEVEMENT_EVIDENCE']), resourceId: z.string().min(1).max(150) });
export const storageRoot = () => resolve(process.env.STORAGE_DIR ?? '.data/files');
export function validatePdf(name: string, mime: string, data: Buffer) {
  invariant(/\.pdf$/i.test(name) && mime === 'application/pdf' && data.subarray(0,5).toString() === '%PDF-' && data.subarray(-1024).includes(Buffer.from('%%EOF')), 422, 'FILE_TYPE', 'Нужен корректный PDF-файл.');
  invariant(data.length > 0 && data.length <= 10 * 1024 * 1024, 413, 'TOO_LARGE', 'Максимальный размер PDF — 10 MiB.');
}
export async function uploadFile(request: Request, student: StudentContext) {
  const bytes = await readLimited(request, 10 * 1024 * 1024 + 65536);
  const form = await new Response(new Uint8Array(bytes), { headers: { 'Content-Type': request.headers.get('content-type') ?? '' } }).formData();
  const input = inputSchema.parse({ purpose: form.get('purpose'), resourceId: form.get('resourceId') });
  const file = form.get('file'); invariant(file instanceof File, 422, 'FILE', 'Выберите PDF-файл.');
  const data = Buffer.from(await file.arrayBuffer()); validatePdf(file.name,file.type,data);
  const key = randomUUID(); await mkdir(storageRoot(), { recursive: true }); await writeFile(join(storageRoot(),key), data, { flag: 'wx', mode: 0o600 });
  try {
    return await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${student.id}`},0))`;
      const used = await tx.fileObject.aggregate({ where: { studentId: student.id }, _sum: { size: true } });
      invariant((used._sum.size ?? 0) + data.length <= 50 * 1024 * 1024, 413, 'QUOTA', 'Лимит хранилища — 50 MiB.');
      const parent: { requestId?: string; projectId?: string; achievementId?: string } = {};
      if (input.purpose === 'REQUEST_ATTACHMENT') {
        const item = await tx.studentRequest.findFirst({ where: { id: input.resourceId, studentId: student.id, status: { in: ['DRAFT','NEEDS_INFO'] } }, include: { _count: { select: { files: true } } } });
        if (!item) throw notFound(); invariant(item._count.files < 3, 422, 'FILE_COUNT', 'В обращении допускается до трёх файлов.'); parent.requestId = item.id;
      } else if (input.purpose === 'PROJECT_UPLOAD') {
        const item = await tx.studentProject.findFirst({ where: { id: input.resourceId, studentId: student.id, status: { in: ['OPEN','REVISION','SUBMITTED'] } } });
        if (!item) throw notFound(); parent.projectId = item.id;
      } else {
        const item = await tx.achievement.findFirst({ where: { id: input.resourceId, studentId: student.id, status: { in: ['DRAFT','NEEDS_INFO'] } } });
        if (!item) throw notFound(); parent.achievementId = item.id;
      }
      return tx.fileObject.create({ data: { studentId: student.id, purpose: input.purpose, ...parent, originalName: file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,160), storageKey: key, size: data.length, checksum: createHash('sha256').update(data).digest('hex') }, select: { id:true, originalName:true, size:true } });
    });
  } catch (error) { await unlink(join(storageRoot(),key)).catch(() => {}); throw error; }
}
export async function downloadFile(student: StudentContext, id: string) {
  const file = await db.fileObject.findFirst({ where: { id, OR: [{ studentId: student.id }, { studentId: null, course: { enrollments: { some: { studentId: student.id } } } }] }, include: { request: { select: { status:true, resultExpiresAt:true } } } });
  if (!file) throw notFound();
  if (file.purpose === 'REQUEST_RESULT') invariant(file.request?.status === 'READY' && (!file.request.resultExpiresAt || file.request.resultExpiresAt > new Date()), 410, 'EXPIRED', 'Документ больше недоступен. Обратитесь в учебный офис.');
  invariant(/^[a-zA-Z0-9-]+$/.test(file.storageKey), 404, 'FILE', 'Файл недоступен.');
  let data: Buffer; try { data = await readFile(join(storageRoot(),file.storageKey)); } catch { throw notFound(); }
  return new Response(new Uint8Array(data), { headers: { 'Content-Type':'application/pdf', 'Content-Disposition':`attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`, 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'; sandbox" } });
}
