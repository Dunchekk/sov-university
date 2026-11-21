import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Card, Badge, Empty, ui } from "@/shared/ui/primitives";
import { ReadNotification } from "@/modules/community/ReadNotification";
import { formatDate } from "@/shared/lib/time";
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; unread?: string; page?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const page = Math.max(1, Math.min(100, Number(p.page) || 1));
  const where = {
    studentId: student.id,
    ...(p.category ? { category: p.category } : {}),
    ...(p.unread === "true" ? { readAt: null } : {}),
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
      <form className={ui.filterBar}>
        <label>
          Категория
          <select name="category" defaultValue={p.category ?? ""}>
            <option value="">Все</option>
            {[
              ["SCHEDULE", "Расписание"],
              ["STUDY", "Учёба"],
              ["REQUEST", "Обращения"],
              ["COMMUNITY", "Сообщество"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.row}>
          <input
            type="checkbox"
            name="unread"
            value="true"
            defaultChecked={p.unread === "true"}
          />
          Только непрочитанные
        </label>
        <button className={ui.button}>Показать</button>
      </form>
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
            title="Всё прочитано"
            description="Новые события появятся здесь."
          />
        )}
        <div className={ui.row}>
          {page > 1 && (
            <Link
              className={ui.button}
              href={`/notifications?page=${page - 1}`}
            >
              Назад
            </Link>
          )}
          {page * 20 < total && (
            <Link
              className={ui.button}
              href={`/notifications?page=${page + 1}`}
            >
              Далее
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}
