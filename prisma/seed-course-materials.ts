import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../src/server/db";
import { courseMaterialTypes } from "../src/modules/courses/materials";

const examples = [
  {
    courseId: "course-0",
    source: "prototype",
    title: "Проверка прототипа интерфейса",
  },
  {
    courseId: "course-archive-gen-104",
    source: "survey",
    title: "Анализ данных опроса",
  },
] as const;

export async function seedCourseMaterials() {
  const courses = await db.course.findMany({
    where: { id: { in: examples.map(({ courseId }) => courseId) } },
    select: { id: true },
  });
  const available = new Set(courses.map(({ id }) => id));
  const storage = process.env.STORAGE_DIR ?? ".data/files";
  await mkdir(storage, { recursive: true });
  for (const example of examples) {
    if (!available.has(example.courseId)) continue;
    for (const type of courseMaterialTypes) {
      const bytes = await readFile(
        new URL(
          `./course-materials/${example.source}.${type.extension}`,
          import.meta.url,
        ),
      );
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const id = `demo-${example.courseId}-${type.extension}`;
      const storageKey = `${id}-${checksum}`;
      const target = join(storage, storageKey);
      const temporary = join(storage, randomUUID());
      try {
        await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
        await rename(temporary, target);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      const contents = { storageKey, checksum, size: bytes.length };
      await db.fileObject.upsert({
        where: { id },
        update: contents,
        create: {
          id,
          courseId: example.courseId,
          originalName: `${example.title} (демо).${type.extension}`,
          mime: type.mime,
          purpose: type.purpose,
          ...contents,
        },
      });
    }
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  seedCourseMaterials()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
