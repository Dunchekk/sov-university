import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  PageTitle,
  Card,
  Badge,
  Empty,
  ActionLink,
  ui,
} from "@/shared/ui/primitives";
import { FilterForm, FilterSelect } from "@/shared/ui/FilterForm";
import { filterValue, type FilterParams } from "@/shared/lib/filters";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
const path = "/studies/projects";
const kinds = ["Практика", "Курсовая", "ВКР", "Учебный проект"];
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const kind = kinds.find((value) => value === filterValue(p.kind));
  const requestedSemester = Number(filterValue(p.semester));
  const semester =
    Number.isInteger(requestedSemester) &&
    requestedSemester > 0 &&
    requestedSemester <= 2147483647
      ? requestedSemester
      : undefined;
  const [projects, availablePeriods] = await Promise.all([
    db.studentProject.findMany({
      where: {
        studentId: student.id,
        kind,
        semester,
      },
      include: {
        supervisor: { select: { name: true } },
        milestones: {
          where: { completed: false },
          orderBy: { dueAt: "asc" },
          take: 1,
        },
      },
      orderBy: { dueAt: "asc" },
    }),
    db.studentProject.groupBy({
      by: ["semester"],
      where: { studentId: student.id },
      orderBy: { semester: "asc" },
    }),
  ]);
  const semesters = availablePeriods.map((period) => period.semester);
  if (semester !== undefined && !semesters.includes(semester))
    semesters.push(semester);
  return (
    <>
      <PageTitle
        title="Практика и проекты"
        description="От первой идеи до защиты — каждый этап на своём месте."
      />
      <FilterForm action={path} className={ui.filterBar}>
        <label>
          Тип работы
          <FilterSelect name="kind" value={kind ?? ""}>
            <option value="">Все работы</option>
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </FilterSelect>
        </label>
        <label>
          Семестр
          <FilterSelect
            name="semester"
            value={semester === undefined ? "" : String(semester)}
          >
            <option value="">Все периоды</option>
            {semesters.map((period) => (
              <option key={period} value={period}>
                {period} семестр
              </option>
            ))}
          </FilterSelect>
        </label>
        <button className={ui.button}>Показать</button>
      </FilterForm>
      <div className={ui.grid2}>
        {projects.map((p) => (
          <Card key={p.id}>
            <div className={ui.stack}>
              <div className={ui.between}>
                <Badge>{p.kind}</Badge>
                <FolderOpen size={20} />
              </div>
              <Link className={ui.between} href={`/studies/projects/${p.id}`}>
                <h2>{p.title}</h2>
                <ArrowUpRight size={18} />
              </Link>
              <p className={ui.muted}>Руководитель: {p.supervisor.name}</p>
              <div className={ui.between}>
                <Badge tone={p.status === "REVISION" ? "warning" : "default"}>
                  {p.status === "SUBMITTED"
                    ? "Ожидает проверки"
                    : statusLabel(p.status)}
                </Badge>
                <small className={ui.caption}>{formatDate(p.dueAt)}</small>
              </div>
              <p className={ui.caption}>
                Далее: {p.milestones[0]?.title ?? "Все этапы пройдены"}
              </p>
            </div>
          </Card>
        ))}
      </div>
      {!projects.length && (
        <Empty
          title={kind || semester ? "Работ по фильтру нет" : "Работ пока нет"}
          action={
            kind || semester ? (
              <ActionLink href={path}>Сбросить фильтры</ActionLink>
            ) : undefined
          }
        />
      )}
    </>
  );
}
