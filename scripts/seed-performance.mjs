import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import pg from "pg";

const count = Number(process.argv[2] ?? 3000);
if (!Number.isInteger(count) || count < 1 || count > 10000)
  throw new Error("Enter a student count between 1 and 10000.");

const { DATABASE_URL } = parse(await readFile(".env.test"));
const target = new URL(DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  target.pathname !== "/ryadom_test" ||
  target.username !== "ryadom_perf"
)
  throw new Error(
    "Use a dedicated local ryadom_test database owned by ryadom_perf.",
  );

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  const seed = await db.query(
    `SELECT id FROM "Student" WHERE id = 'student-a'`,
  );
  if (seed.rowCount !== 1) throw new Error("Load the demo fixtures first.");

  await db.query(
    `
    INSERT INTO "User" (id, name, email, "updatedAt")
    SELECT 'perf-user-' || n, 'Student ' || n, 'perf-' || n || '@example.invalid', now()
    FROM generate_series(1, $1::int) AS n
    ON CONFLICT (id) DO NOTHING
  `,
    [count],
  );
  await db.query(
    `
    INSERT INTO "Student" (id, "userId", "groupId", funding, "currentSemester", "updatedAt")
    SELECT 'perf-student-' || n, 'perf-user-' || n, s."groupId", s.funding, s."currentSemester", now()
    FROM "Student" s CROSS JOIN generate_series(1, $1::int) AS n
    WHERE s.id = 'student-a'
    ON CONFLICT (id) DO NOTHING
  `,
    [count],
  );
  await db.query(
    `
    INSERT INTO "Enrollment" (
      id, "studentId", "courseId", status, "officialGrade",
      "officialSchemeVersion", "officialAdjustment", "publishedAt"
    )
    SELECT 'perf-enrollment-' || n || '-' || e.id, 'perf-student-' || n,
      e."courseId", e.status, e."officialGrade",
      e."officialSchemeVersion", e."officialAdjustment", e."publishedAt"
    FROM "Enrollment" e CROSS JOIN generate_series(1, $1::int) AS n
    WHERE e."studentId" = 'student-a'
    ON CONFLICT (id) DO NOTHING
  `,
    [count],
  );
  await db.query(
    `
    INSERT INTO "Result" (
      id, "courseId", "enrollmentId", "assessmentId", points, status, "publishedAt"
    )
    SELECT 'perf-result-' || n || '-' || r.id, r."courseId",
      'perf-enrollment-' || n || '-' || e.id,
      r."assessmentId", r.points, r.status, r."publishedAt"
    FROM "Result" r JOIN "Enrollment" e ON e.id = r."enrollmentId"
    CROSS JOIN generate_series(1, $1::int) AS n
    WHERE e."studentId" = 'student-a'
    ON CONFLICT (id) DO NOTHING
  `,
    [count],
  );
  await db.query(
    `
    INSERT INTO "Attendance" (id, "courseId", "enrollmentId", "lessonId", status)
    SELECT 'perf-attendance-' || n || '-' || a.id, a."courseId",
      'perf-enrollment-' || n || '-' || e.id, a."lessonId", a.status
    FROM "Attendance" a JOIN "Enrollment" e ON e.id = a."enrollmentId"
    CROSS JOIN generate_series(1, $1::int) AS n
    WHERE e."studentId" = 'student-a'
    ON CONFLICT (id) DO NOTHING
  `,
    [count],
  );
  await db.query("COMMIT");
  await db.query('ANALYZE "Student", "Enrollment", "Result", "Attendance"');
  const {
    rows: [totals],
  } = await db.query(`
    SELECT
      (SELECT count(*)::int FROM "Student") AS students,
      (SELECT count(*)::int FROM "Enrollment") AS enrollments,
      (SELECT count(*)::int FROM "Result") AS results,
      (SELECT count(*)::int FROM "Attendance") AS attendance
  `);
  console.log(JSON.stringify(totals));
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}
