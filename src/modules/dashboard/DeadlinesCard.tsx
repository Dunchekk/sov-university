import Link from "next/link";
import { Card, SectionTitle, ui } from "@/shared/ui/primitives";
import { formatDate, formatTime } from "@/shared/lib/time";
import type { dashboardDeadlines } from "./deadlines";
import s from "./dashboard.module.css";

const week = 7 * 24 * 60 * 60 * 1000;

export function DeadlinesCard({
  deadlines,
  now,
}: {
  deadlines: Awaited<ReturnType<typeof dashboardDeadlines>>;
  now: Date;
}) {
  return (
    <Card className={s.deadlines}>
      <SectionTitle
        title={
          <>
            Дедлайны
            <svg
              className={s.deadlineFlame}
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path
                className={s.flameOutline}
                stroke="#f59e0c"
                d="M10.7 4C14.6 6.2 18.4 11 18.4 15.3C18.4 18.8 15.6 21.2 12 21.2C8.4 21.2 5.6 18.8 5.6 15.4C5.6 13 7 11.3 8.5 9.5C9.7 8 10.5 6.4 10.7 4Z"
              />
              <path
                className={s.flameCore}
                d="M12 14.6C13.1 15.5 14.2 16.9 14.2 18.3C14.2 19.5 13.2 20.1 12 20.1C10.8 20.1 9.8 19.5 9.8 18.3C9.8 16.9 10.9 15.5 12 14.6Z"
              />
            </svg>
          </>
        }
        href="/calendar?types=DEADLINE"
        label="Все сроки"
      />
      {deadlines.length ? (
        <ol className={s.deadlineList}>
          {deadlines.map(({ id, title, dueAt, discipline, href }) => {
            const remaining = dueAt.getTime() - now.getTime();
            const overdue = remaining < 0;
            const tone =
              overdue || remaining >= 3 * week
                ? "neutral"
                : remaining < week
                  ? "urgent"
                  : "soon";
            const schedule = `${formatDate(dueAt, { day: "numeric", month: "short" })} ${formatTime(dueAt)}`;
            const subject = discipline ? ` · ${discipline}` : "";
            return (
              <li key={href + id}>
                <Link
                  className={s.deadline}
                  data-tone={tone}
                  href={href}
                  title={`${schedule}: ${title}${subject}${overdue ? " · Срок прошёл" : ""}`}
                >
                  <time dateTime={dueAt.toISOString()}>{schedule}:</time>
                  <span className={s.deadlineText}>
                    <strong>{title}</strong>
                    {subject}
                  </span>
                  {overdue && <span className={ui.srOnly}>Срок прошёл</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={`${ui.caption} ${s.noDeadlines}`}>Нет дедлайнов</p>
      )}
    </Card>
  );
}
