import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentContext } from "@/server/access";
import { readLimited } from "@/server/body";
import { db } from "@/server/db";
import { invariant, notFound } from "@/server/errors";
import { storageRoot, studentStorageLimit } from "@/modules/files/service";
import {
  avatarFormats,
  avatarMaxBytes,
  avatarPurpose,
  profileAvatarSrc,
  uploadedAvatarSrc,
} from "./avatar";

const invalidImage = "Выберите корректное фото в формате JPG, PNG или WebP.";

async function avatarBytes(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  invariant(
    contentType.startsWith("multipart/form-data;"),
    415,
    "CONTENT_TYPE",
    invalidImage,
  );
  const bytes = await readLimited(request, avatarMaxBytes + 65536);
  const form = await new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": contentType },
  })
    .formData()
    .catch(() => null);
  const file = form?.get("file");
  invariant(file instanceof File && file.size > 0, 422, "FILE", invalidImage);
  invariant(
    file.size <= avatarMaxBytes,
    413,
    "TOO_LARGE",
    "Максимальный размер фото — 5 МБ.",
  );
  invariant(
    Object.hasOwn(avatarFormats, file.type),
    422,
    "FILE_TYPE",
    invalidImage,
  );

  const image = sharp(Buffer.from(await file.arrayBuffer()), {
    limitInputPixels: 24_000_000,
  });
  const metadata = await image.metadata().catch(() => null);
  invariant(
    metadata?.format ===
      avatarFormats[file.type as keyof typeof avatarFormats] &&
      (metadata.pages ?? 1) === 1,
    422,
    "FILE_TYPE",
    invalidImage,
  );
  const normalized = await image
    .autoOrient()
    .resize(512, 512, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
    .catch(() => null);
  invariant(normalized, 422, "FILE_TYPE", invalidImage);
  return normalized;
}

async function clearAvatarRows(
  tx: Prisma.TransactionClient,
  studentId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`files:${studentId}`},0))`;
  const where = { studentId, purpose: avatarPurpose };
  const files = await tx.fileObject.findMany({
    where,
    select: { storageKey: true },
  });
  await tx.fileObject.deleteMany({ where });
  return files.map(({ storageKey }) => storageKey);
}

async function unlinkAvatars(storageKeys: string[]) {
  await Promise.all(
    storageKeys.map((key) =>
      unlink(join(/* turbopackIgnore: true */ storageRoot(), key)).catch(
        () => {},
      ),
    ),
  );
}

export async function uploadAvatar(request: Request, student: StudentContext) {
  const data = await avatarBytes(request);
  const id = randomUUID();
  const image = uploadedAvatarSrc(id);
  const filename = join(/* turbopackIgnore: true */ storageRoot(), id);
  await mkdir(storageRoot(), { recursive: true });
  await writeFile(filename, data, { flag: "wx", mode: 0o600 });

  const previous = await db
    .$transaction(async (tx) => {
      const files = await clearAvatarRows(tx, student.id);
      const used = await tx.fileObject.aggregate({
        where: { studentId: student.id },
        _sum: { size: true },
      });
      invariant(
        (used._sum.size ?? 0) + data.length <= studentStorageLimit,
        413,
        "QUOTA",
        "Лимит хранилища — 50 MiB.",
      );
      await tx.fileObject.create({
        data: {
          id,
          studentId: student.id,
          purpose: avatarPurpose,
          originalName: "avatar.webp",
          storageKey: id,
          mime: "image/webp",
          size: data.length,
          checksum: createHash("sha256").update(data).digest("hex"),
        },
      });
      await tx.user.update({ where: { id: student.userId }, data: { image } });
      return files;
    })
    .catch(async (error: unknown) => {
      await unlink(filename).catch(() => {});
      throw error;
    });

  await unlinkAvatars(previous);
  return { image };
}

export async function removeAvatar(student: StudentContext) {
  const previous = await db.$transaction(async (tx) => {
    const files = await clearAvatarRows(tx, student.id);
    await tx.user.update({
      where: { id: student.userId },
      data: { image: null },
    });
    return files;
  });
  await unlinkAvatars(previous);
  return { image: null };
}

export async function readAvatar(request: Request, student: StudentContext) {
  const id = new URL(request.url).searchParams.get("v");
  if (!id || profileAvatarSrc(student.image) !== uploadedAvatarSrc(id))
    throw notFound();
  const file = await db.fileObject.findFirst({
    where: {
      id,
      studentId: student.id,
      purpose: avatarPurpose,
      mime: "image/webp",
      storageKey: id,
    },
    select: { storageKey: true },
  });
  if (!file) throw notFound();
  const data = await readFile(
    /* turbopackIgnore: true */ join(
      /* turbopackIgnore: true */ storageRoot(),
      file.storageKey,
    ),
  ).catch(() => null);
  if (!data) throw notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
