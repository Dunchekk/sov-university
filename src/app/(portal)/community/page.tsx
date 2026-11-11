import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  PageTitle,
  Card,
  Tabs,
  Badge,
  Empty,
  ui,
} from "@/shared/ui/primitives";
import { formatDate, formatTime } from "@/shared/lib/time";
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; from?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const tab = p.tab ?? "events";
  const audience = { OR: [{ groupId: null }, { groupId: student.groupId }] };
  const parsedDate = p.from ? new Date(`${p.from}T00:00:00+03:00`) : new Date();
  const from = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const [events, news] = await Promise.all([
    tab !== "news"
      ? db.communityEvent.findMany({
          where: {
            ...audience,
            ...(tab === "saved"
              ? { savedBy: { some: { studentId: student.id, saved: true } } }
              : { startsAt: { gte: from } }),
            ...(p.category ? { category: p.category } : {}),
          },
          orderBy: { startsAt: "asc" },
          take: 100,
        })
      : [],
    tab === "news"
      ? db.newsPost.findMany({
          where: { ...audience, publishedAt: { lte: new Date() } },
          orderBy: { publishedAt: "desc" },
          take: 30,
        })
      : [],
  ]);
  return (
    <>
      <PageTitle
        title="События и новости"
        description="Университет — больше, чем занятия."
      />
      <Tabs
        active={tab}
        items={[
          ["events", "Ближайшие события"],
          ["news", "Новости"],
          ["saved", "Сохранённые"],
        ].map(([id, label]) => ({ id, label, href: `/community?tab=${id}` }))}
      />
      {tab !== "news" && (
        <form className={ui.row}>
          <input type="hidden" name="tab" value={tab} />
          <label>
            Категория
            <select name="category" defaultValue={p.category ?? ""}>
              <option value="">Все</option>
              {[
                "Творчество",
                "Наука",
                "Волонтёрство",
                "Карьера",
                "Культура",
                "Спорт",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Начиная с даты
            <input name="from" type="date" defaultValue={p.from} />
          </label>
          <button className={ui.button}>Показать</button>
        </form>
      )}
      <div className={ui.grid3}>
        {events.map((e) => (
          <Card key={e.id}>
            <div className={ui.stack}>
              <div className={ui.between}>
                <Badge tone="success">{e.category}</Badge>
                <small className={ui.caption}>{formatDate(e.startsAt)}</small>
              </div>
              <Link href={`/community/${e.id}`}>
                <h2>{e.title}</h2>
              </Link>
              <p className={ui.muted}>
                {e.location} · {formatTime(e.startsAt)}
              </p>
              <Link className={ui.link} href={`/community/${e.id}`}>
                Подробнее →
              </Link>
            </div>
          </Card>
        ))}
        {news.map((n) => (
          <Card key={n.id}>
            <div className={ui.stack}>
              <small className={ui.caption}>
                {formatDate(n.publishedAt)} · {n.author}
              </small>
              <Link href={`/community/news/${n.id}`}>
                <h2>{n.title}</h2>
              </Link>
              <p className={ui.muted}>{n.body.slice(0, 110)}…</p>
              <Link className={ui.link} href={`/community/news/${n.id}`}>
                Читать →
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {!events.length && !news.length && (
        <Empty
          title={
            tab === "saved"
              ? "Пока ничего не сохранено"
              : "Публикаций по фильтру нет"
          }
          description="Сохраняйте интересные события, чтобы вернуться к ним позже."
        />
      )}
    </>
  );
}
