import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  PageTitle,
  Card,
  Tabs,
  Avatar,
  Empty,
  ActionLink,
  ui,
} from "@/shared/ui/primitives";
import { CopyButton } from "@/shared/ui/CopyButton";
import { FilterForm, FilterText } from "@/shared/ui/FilterForm";
import {
  containsText,
  filterHref,
  filterPage,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
const path = "/people";
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const requestedTab = filterValue(p.tab);
  const tab =
    requestedTab === "group" || requestedTab === "departments"
      ? requestedTab
      : "teachers";
  const q = filterValue(p.q).trim().slice(0, 80);
  const page = filterPage(p.page);
  const pageHref = (page: number) =>
    filterHref(path, { tab, q, page: page > 1 ? page : undefined });
  const contains = containsText(q);
  const [teachers, group, departments, total] = await Promise.all([
    tab === "teachers"
      ? db.person.findMany({
          where: {
            courses: {
              some: { enrollments: { some: { studentId: student.id } } },
            },
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
        ].map(([id, label]) => ({
          id,
          label,
          href: filterHref(path, { tab: id, q }),
        }))}
      />
      <FilterForm action={path} className={ui.filterBar}>
        <input type="hidden" name="tab" value={tab} />
        <label>
          Поиск
          <FilterText
            name="q"
            value={q}
            maxLength={80}
            placeholder="Имя, дисциплина или подразделение"
          />
        </label>
        <button className={ui.button}>Найти</button>
      </FilterForm>
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
              <Link className={ui.button} href={pageHref(page - 1)}>
                Назад
              </Link>
            )}
            {page < 100 && page * 20 < total && (
              <Link className={ui.button} href={pageHref(page + 1)}>
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
          action={
            q ? (
              <ActionLink href={filterHref(path, { tab })}>
                Сбросить поиск
              </ActionLink>
            ) : undefined
          }
        />
      )}
    </>
  );
}
