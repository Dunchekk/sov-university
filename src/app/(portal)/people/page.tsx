import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  PageTitle,
  Card,
  Tabs,
  Avatar,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import { CopyButton } from "@/shared/ui/CopyButton";
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const tab = p.tab ?? "teachers";
  const q = (p.q ?? "").slice(0, 80),
    page = Math.max(1, Math.min(100, Number(p.page) || 1));
  const contains = { contains: q, mode: "insensitive" as const };
  const [teachers, group, departments, total] = await Promise.all([
    tab === "teachers"
      ? db.person.findMany({
          where: {
            ...(q
              ? {}
              : {
                  courses: {
                    some: { enrollments: { some: { studentId: student.id } } },
                  },
                }),
            OR: [
              { name: contains },
              { department: contains },
              { courses: { some: { name: contains } } },
            ],
          },
          include: {
            courses: {
              select: {
                id: true,
                name: true,
                enrollments: {
                  where: { studentId: student.id },
                  select: { id: true },
                },
              },
            },
          },
          take: 20,
        })
      : [],
    tab === "group"
      ? db.rosterPerson.findMany({
          where: { groupId: student.groupId, name: contains },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          skip: (page - 1) * 20,
          take: 20,
        })
      : [],
    tab === "departments"
      ? db.department.findMany({
          where: { OR: [{ name: contains }, { description: contains }] },
          take: 30,
        })
      : [],
    tab === "group"
      ? db.rosterPerson.count({
          where: { groupId: student.groupId, name: contains },
        })
      : 0,
  ]);
  return (
    <>
      <PageTitle
        title="Люди"
        description="Найти своего преподавателя, одногруппника или нужный отдел."
      />
      <Tabs
        active={tab}
        items={[
          ["teachers", "Мои преподаватели"],
          ["group", `Моя группа · ${student.group.name}`],
          ["departments", "Подразделения"],
        ].map(([id, label]) => ({ id, label, href: `/people?tab=${id}` }))}
      />
      <form className={ui.filterBar}>
        <input type="hidden" name="tab" value={tab} />
        <label>
          Поиск
          <input
            name="q"
            defaultValue={q}
            placeholder="Имя, дисциплина или подразделение"
          />
        </label>
        <button className={ui.button}>Найти</button>
      </form>
      <div className={ui.grid2}>
        {teachers.map((t) => (
          <Card key={t.id}>
            <div className={ui.stack}>
              <div className={ui.row}>
                <Avatar name={t.name} />
                <div>
                  <h2>{t.name}</h2>
                  <p className={ui.caption}>{t.department}</p>
                </div>
              </div>
              <p className={ui.muted}>
                {t.courses.map((c) => c.name).join(" · ")}
              </p>
              <p className={ui.caption}>{t.consultation}</p>
              <div className={ui.row}>
                <span>{t.email}</span>
                <CopyButton value={t.email} />
              </div>
              <Link
                className={ui.link}
                href={`/calendar?schedules=lecturer:${t.id}`}
              >
                Посмотреть опубликованное расписание →
              </Link>
            </div>
          </Card>
        ))}
        {group.map((p) => (
          <Card key={p.id}>
            <div className={ui.row}>
              <Avatar name={p.name} />
              <div>
                <h3>{p.name}</h3>
                <p className={ui.caption}>Студент · {student.group.name}</p>
              </div>
            </div>
          </Card>
        ))}
        {departments.map((d) => (
          <Card key={d.id}>
            <div className={ui.stack}>
              <h2>{d.name}</h2>
              <p>{d.description}</p>
              <p className={ui.caption}>
                {d.location}
                <br />
                {d.hours}
              </p>
              <div className={ui.row}>
                {d.email}
                <CopyButton value={d.email} />
              </div>
              <Link
                className={ui.button}
                href={`/services/general?subject=${encodeURIComponent(`Вопрос: ${d.name}`)}`}
              >
                Написать обращение
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {tab === "group" && (
        <Card>
          <h3>
            {student.group.program.name} · {student.group.year} курс
          </h3>
          <p className={ui.caption}>
            Куратор: Анна Воронцова. Староста: Арина Фомина (ДП-21), Лидия
            Данилова (ПИ-22). Личные контакты студентов не публикуются.
          </p>
          <div className={ui.row}>
            {page > 1 && (
              <Link
                className={ui.button}
                href={`/people?tab=group&page=${page - 1}&q=${encodeURIComponent(q)}`}
              >
                Назад
              </Link>
            )}
            {page * 20 < total && (
              <Link
                className={ui.button}
                href={`/people?tab=group&page=${page + 1}&q=${encodeURIComponent(q)}`}
              >
                Далее
              </Link>
            )}
          </div>
        </Card>
      )}
      {!teachers.length && !group.length && !departments.length && (
        <Empty
          title="Никого не нашли"
          description="Попробуйте другое имя или название."
        />
      )}
    </>
  );
}
