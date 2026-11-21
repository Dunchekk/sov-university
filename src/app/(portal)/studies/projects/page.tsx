import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Card, Badge, Empty, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; semester?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const projects = await db.studentProject.findMany({
    where: {
      studentId: student.id,
      ...(p.kind ? { kind: p.kind } : {}),
      ...(p.semester ? { semester: Number(p.semester) || 3 } : {}),
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
  });
  return (
    <>
      <PageTitle
        title="Практика и проекты"
        description="От первой идеи до защиты — каждый этап на своём месте."
      />
      <form className={ui.filterBar}>
        <label>
          Тип работы
          <select name="kind" defaultValue={p.kind ?? ""}>
            <option value="">Все работы</option>
            {["Практика", "Курсовая", "ВКР", "Учебный проект"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Семестр
          <select name="semester" defaultValue={p.semester ?? ""}>
            <option value="">Все периоды</option>
            <option value="3">3 семестр</option>
            <option value="8">8 семестр</option>
          </select>
        </label>
        <button className={ui.button}>Показать</button>
      </form>
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
      {!projects.length && <Empty title="Работ по фильтру нет" />}
    </>
  );
}
