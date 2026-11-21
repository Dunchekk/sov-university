import "dotenv/config";
import { db } from "../src/server/db";
import { seedCompletedCourses } from "./seed-completed-courses";
import { seedAcademicEdition } from "./seed-academic-edition";

try {
  await seedCompletedCourses();
  await seedAcademicEdition();
  console.log(
    "Загружены демонстрационные дисциплины, работы и обезличенные выборки рейтинга.",
  );
} finally {
  await db.$disconnect();
}
