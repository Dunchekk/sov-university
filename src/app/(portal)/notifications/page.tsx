import Link from "next/link";
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
import {
  FilterCheckbox,
  FilterForm,
  FilterSelect,
} from "@/shared/ui/FilterForm";
import {
  filterHref,
  filterPage,
  filterValue,
  type FilterParams,
} from "@/shared/lib/filters";
import { ReadNotification } from "@/modules/community/ReadNotification";
import { formatDate } from "@/shared/lib/time";
const path = "/notifications";
const categories = [
  ["SCHEDULE", "Расписание"],
  ["CALENDAR", "Календарь"],
  ["STUDY", "Учёба"],
  ["REQUEST", "Обращения"],
  ["COMMUNITY", "Сообщество"],
] as const;
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const page = filterPage(p.page);
  const category = categories.find(
    ([value]) => value === filterValue(p.category),
  )?.[0];
  const unread = filterValue(p.unread) === "true";
  const paged = (page: number) =>
    filterHref(path, {
      category,
      unread: unread ? "true" : undefined,
      page: page > 1 ? page : undefined,
    });
  const where = {
    studentId: student.id,
    category,
    ...(unread ? { readAt: null } : {}),
  };
  const [items, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.notification.count({ where }),
  ]);
  return (
    <>
      <PageTitle
        title="Уведомления"
        description="Всё, что изменилось и требует твоего внимания."
        action={<ReadNotification />}
      />
      <FilterForm action={path} className={ui.filterBar}>
        <label>
          Категория
          <FilterSelect name="category" value={category ?? ""}>
            <option value="">Все</option>
            {categories.map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </FilterSelect>
        </label>
        <label className={ui.row}>
          <FilterCheckbox name="unread" checked={unread} />
          Только непрочитанные
        </label>
        <button className={ui.button}>Показать</button>
      </FilterForm>
      <Card>
        {items.map((n) => (
          <div key={n.id} className={`${ui.between} ${ui.listItem}`}>
            <div>
              <div className={ui.row}>
                <Link href={n.href}>
                  <h3>{n.title}</h3>
                </Link>
                {!n.readAt && <Badge tone="info">Новое</Badge>}
              </div>
              <p className={ui.muted}>{n.body}</p>
              <small className={ui.caption}>
                {formatDate(n.createdAt, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className={ui.row}>
              <Link className={ui.link} href={n.href}>
                Открыть →
              </Link>
              {!n.readAt && <ReadNotification id={n.id} />}
            </div>
          </div>
        ))}
        {!items.length && (
          <Empty
            title={
              category || unread
                ? "Нет уведомлений по фильтрам"
                : "Уведомлений пока нет"
            }
            action={
              category || unread ? (
                <ActionLink href={path}>Сбросить фильтры</ActionLink>
              ) : undefined
            }
          />
        )}
        <div className={ui.row}>
          {page > 1 && (
            <Link className={ui.button} href={paged(page - 1)}>
              Назад
            </Link>
          )}
          {page < 100 && page * 20 < total && (
            <Link className={ui.button} href={paged(page + 1)}>
              Далее
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}
