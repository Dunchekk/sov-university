import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, trustedOrigins } from "./auth";
import { db } from "./db";
import { AppError, invariant, notFound } from "./errors";
export async function requireStudent(requestHeaders?: Headers) {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!session)
    throw new AppError(401, "UNAUTHENTICATED", "Войдите в личный кабинет.");
  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { group: { include: { program: true } }, preference: true },
  });
  if (!student) throw notFound();
  return { ...student, name: session.user.name, email: session.user.email };
}
export type StudentContext = Awaited<ReturnType<typeof requireStudent>>;
export async function pageStudent() {
  try {
    return await requireStudent();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/login");
    throw e;
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  invariant(
    origin && trustedOrigins.includes(origin),
    403,
    "ORIGIN",
    "Недопустимый источник запроса.",
  );
  invariant(
    request.headers.get("sec-fetch-site") !== "cross-site",
    403,
    "ORIGIN",
    "Недопустимый источник запроса.",
  );
}
export async function requireEnrollment(
  student: StudentContext,
  courseId: string,
) {
  const enrollment = await db.enrollment.findUnique({
    where: { studentId_courseId: { studentId: student.id, courseId } },
    include: { course: { include: { lecturer: true } } },
  });
  if (!enrollment) throw notFound();
  return enrollment;
}
