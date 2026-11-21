import Link from "next/link";
import { Suspense } from "react";
import { Bookmark, CalendarDays, MapPin } from "lucide-react";
import { z } from "zod";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Empty, ui } from "@/shared/ui/primitives";
import {
  addDays,
  dateKey,
  dayStart,
  formatDate,
  formatTime,
} from "@/shared/lib/time";
import {
  communityCategories,
  communityCities,
} from "@/modules/community/catalog";
import { Cover } from "@/modules/community/Cover";
import { communityAudience } from "@/modules/community/service";
import { DateRail } from "@/modules/community/DateRail";
import { FeedSelect } from "@/modules/community/FeedSelect";
import {
  FeedLink,
  FeedNavigation,
  FeedResults,
  FeedSkeleton,
} from "@/modules/community/FeedNavigation";
import s from "@/modules/community/community.module.css";

const sections = [
  ["all", "Все"],
  ["events", "События"],
  ["news", "Новости"],
] as const;

const filtersSchema = z.object({
  tab: z.enum(["all", "events", "news", "saved"]).catch("all"),
  city: z.enum(communityCities).optional().catch(undefined),
  category: z.enum(communityCategories).optional().catch(undefined),
  date: z.iso.date().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
});
type Filters = z.infer<typeof filtersSchema>;

function communityHref(filters: Filters) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "tab" && value === "all")) query.set(key, value);
  }
  const search = query.toString();
  return search ? `/community?${search}` : "/community";
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const student = await pageStudent();
  const filters = filtersSchema.parse(await searchParams);
  const { tab, city, category, date, from } = filters;
  const now = new Date();
  const today = dateKey(now);
  const focusDate = date ?? from ?? today;
  const days = Array.from({ length: 36 }, (_, index) => {
    const key = addDays(focusDate, index - 12);
    const instant = dayStart(key);
    const weekday = formatDate(instant, { weekday: "short" });
    return {
      date: key,
      href: communityHref({
        ...filters,
        date: key === date ? undefined : key,
        from: undefined,
      }),
      label: formatDate(instant, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      weekday,
      weekend: weekday === "сб" || weekday === "вс",
      month:
        index === 0 || key === focusDate || key.endsWith("-01")
          ? formatDate(instant, { month: "long" })
          : undefined,
    };
  });
  const campus = communityCities.findIndex((item) => item === city);

  return (
    <FeedNavigation>
      <div className={s.page}>
        <PageTitle title="События" />
        <nav className={s.sections} aria-label="Виды публикаций">
          {sections.map(([id, label]) => (
            <FeedLink
              key={id}
              href={communityHref({ ...filters, tab: id })}
              aria-current={tab === id ? "page" : undefined}
            >
              {label}
            </FeedLink>
          ))}
        </nav>

        <div className={s.campus} data-campus={campus}>
          <h2>{city ?? "Все города"}</h2>
        </div>

        <DateRail days={days} focusDate={focusDate} selected={date} />

        <div className={s.filters}>
          <FeedSelect
            label="Город"
            choices={[undefined, ...communityCities].map((value) => ({
              label: value ?? "Все города",
              href: communityHref({ ...filters, city: value }),
              selected: value === city,
            }))}
          />
          <FeedSelect
            label="Категория"
            choices={[undefined, ...communityCategories].map((value) => ({
              label: value ?? "Все категории",
              href: communityHref({ ...filters, category: value }),
              selected: value === category,
            }))}
          />
          {(date || from) && (
            <FeedLink
              className={ui.button}
              href={communityHref({
                ...filters,
                date: undefined,
                from: undefined,
              })}
            >
              Все даты
            </FeedLink>
          )}
          <FeedLink
            className={`${ui.button} ${s.saved}`}
            href={communityHref({
              ...filters,
              tab: tab === "saved" ? "all" : "saved",
            })}
            aria-current={tab === "saved" ? "page" : undefined}
          >
            <Bookmark size={15} aria-hidden /> Сохранённые
          </FeedLink>
        </div>

        <FeedResults>
          <Suspense key={communityHref(filters)} fallback={<FeedSkeleton />}>
            <CommunityFeed filters={filters} student={student} now={now} />
          </Suspense>
        </FeedResults>
      </div>
    </FeedNavigation>
  );
}

async function CommunityFeed({
  filters,
  student,
  now,
}: {
  filters: Filters;
  student: { id: string; groupId: string };
  now: Date;
}) {
  const { tab, city, category, date, from } = filters;
  const dayRange = date
    ? { gte: dayStart(date), lt: dayStart(addDays(date, 1)) }
    : undefined;
  const audience = {
    ...communityAudience(student.groupId),
    city,
    category,
  };
  const [events, news] = await Promise.all([
    tab !== "news"
      ? db.communityEvent.findMany({
          where: {
            ...audience,
            ...(tab === "saved"
              ? { savedBy: { some: { studentId: student.id, saved: true } } }
              : {}),
            startsAt:
              dayRange ??
              (tab !== "saved" || from
                ? { gte: dayStart(from ?? dateKey(now)) }
                : undefined),
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          take: 100,
        })
      : [],
    tab === "all" || tab === "news"
      ? db.newsPost.findMany({
          where: {
            ...audience,
            publishedAt: {
              lte: now,
              ...(dayRange ?? (from ? { gte: dayStart(from) } : {})),
            },
          },
          orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
          take: 100,
        })
      : [],
  ]);
  const posts = [
    ...events.map((event) => ({
      ...event,
      date: event.startsAt,
      summary: event.description.split("\n\n")[0],
      href: `/community/${event.id}`,
      kind: "Событие",
      time: formatTime(event.startsAt),
    })),
    ...news.map((post) => ({
      ...post,
      date: post.publishedAt,
      summary: post.body.split("\n\n")[0],
      href: `/community/news/${post.id}`,
      kind: "Новость",
      time: null,
    })),
  ];
  return posts.length ? (
    <ul className={s.feed} aria-label="Публикации">
      {posts.map((post) => (
        <li key={post.href}>
          <Link className={s.post} href={post.href}>
            <div className={s.postMedia}>
              {post.cover && (
                <Cover
                  src={post.cover}
                  sizes="(max-width: 650px) 100vw, (max-width: 1140px) 50vw, 340px"
                />
              )}
              <div className={s.postBadges}>
                <time dateTime={post.date.toISOString()}>
                  <CalendarDays size={13} aria-hidden />
                  {formatDate(post.date)}
                  {post.time && ` · ${post.time}`}
                </time>
                <span>
                  <MapPin size={13} aria-hidden />
                  {post.city}
                </span>
              </div>
            </div>
            <div className={s.postCopy}>
              <p className={s.postType}>
                {post.kind} · {post.category}
              </p>
              <h2>{post.title}</h2>
              <p className={s.summary}>{post.summary}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <Empty
      title={
        tab === "saved"
          ? "Нет сохранённых событий по этим фильтрам"
          : "Публикаций по этим фильтрам нет"
      }
      description={
        tab === "saved"
          ? "Сохраняйте события на их страницах."
          : "Выберите другой город, категорию или дату."
      }
      action={
        <FeedLink className={ui.button} href={communityHref({ tab })}>
          Сбросить фильтры
        </FeedLink>
      }
    />
  );
}
