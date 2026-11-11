import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Card, Badge, Tabs, ui } from "@/shared/ui/primitives";
export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const semester = Math.min(
    8,
    Math.max(1, Number(p.semester) || student.currentSemester),
  );
  const [items, enrollments] = await Promise.all([
    db.curriculumItem.findMany({
      where: { programId: student.group.programId },
      orderBy: [{ semester: "asc" }, { id: "asc" }],
    }),
    db.enrollment.findMany({
      where: { studentId: student.id },
      select: { courseId: true, status: true, officialGrade: true },
    }),
  ]);
  const done = new Set(
    enrollments
      .filter((e) => e.status === "COMPLETED" && e.officialGrade)
      .map((e) => e.courseId),
  );
  const credited = items
    .filter((i) => i.courseId && done.has(i.courseId))
    .reduce((sum, i) => sum + i.credits, 0);
  return (
    <>
      <PageTitle
        title="Учебный план"
        description={`${student.group.program.name} · бакалавриат`}
      />
      <Card>
        <div className={ui.between}>
          <div>
            <span className={ui.eyebrow}>
              Освоено по опубликованным результатам
            </span>
            <p className={ui.largeNumber}>
              {credited}
              <span className={ui.muted}>
                {" "}
                / {student.group.program.credits} кредитов
              </span>
            </p>
          </div>
          <Badge>Сейчас {student.currentSemester} семестр</Badge>
        </div>
        <progress
          className={ui.progress}
          value={credited}
          max={student.group.program.credits}
          aria-label="Освоенные кредиты"
        />
        <p className={ui.caption}>
          Кредиты начисляются только за закрытую аттестацию. В демонстрационной
          истории представлены отдельные завершённые дисциплины.
        </p>
      </Card>
      <Tabs
        active={String(semester)}
        items={Array.from({ length: 8 }, (_, i) => ({
          id: String(i + 1),
          label: `${i + 1} семестр`,
          href: `/studies/curriculum?semester=${i + 1}`,
        }))}
      />
      <Card>
        <div className={ui.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Дисциплина / работа</th>
                <th>Часть программы</th>
                <th>Кредиты / часы</th>
                <th>Контроль</th>
                <th>Прогресс</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((i) => i.semester === semester)
                .map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.courseId &&
                      enrollments.some((e) => e.courseId === i.courseId) ? (
                        <Link
                          className={ui.link}
                          href={`/studies/courses/${i.courseId}`}
                        >
                          {i.title}
                        </Link>
                      ) : (
                        <details>
                          <summary>{i.title}</summary>
                          <p className={ui.caption}>{i.description}</p>
                          <Link
                            className={ui.link}
                            href="/people?tab=departments"
                          >
                            Ответственное подразделение
                          </Link>
                        </details>
                      )}
                    </td>
                    <td>{i.category}</td>
                    <td>
                      {i.credits} / {i.hours}
                    </td>
                    <td>{i.assessmentType}</td>
                    <td>
                      <Badge
                        tone={
                          i.courseId && done.has(i.courseId)
                            ? "success"
                            : "default"
                        }
                      >
                        {i.courseId && done.has(i.courseId)
                          ? "Освоено"
                          : semester === student.currentSemester
                            ? "В процессе"
                            : semester > student.currentSemester
                              ? "Впереди"
                              : "Нет опубликованного результата"}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
