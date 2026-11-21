import "dotenv/config";
import { db } from "../src/server/db";
import { seedLecturers } from "./seed-lecturers";

try {
  if (!(await db.seedRun.findUnique({ where: { id: "v1" } }))) {
    throw new Error(
      "Загрузите демонстрационные данные перед выпуском справочника.",
    );
  }
  const { peopleAdded, profilesAdded } = await seedLecturers();
  console.log(
    `Добавлено преподавателей: ${peopleAdded}. Заполнено профилей: ${profilesAdded}.`,
  );
} finally {
  await db.$disconnect();
}
