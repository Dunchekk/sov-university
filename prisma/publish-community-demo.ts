import "dotenv/config";
import { db } from "../src/server/db";
import { dateKey } from "../src/shared/lib/time";
import { seedCommunity } from "./seed-community";

try {
  if (!(await db.seedRun.findUnique({ where: { id: "v1" } }))) {
    throw new Error(
      "Загрузите демонстрационные данные перед выпуском публикаций.",
    );
  }
  const { eventsAdded, newsAdded, textsUpdated } = await seedCommunity(
    process.env.DEMO_BASE_DATE || dateKey(),
  );
  console.log(
    `Добавлено событий: ${eventsAdded}. Добавлено новостей: ${newsAdded}. Обновлено текстов: ${textsUpdated}.`,
  );
} finally {
  await db.$disconnect();
}
