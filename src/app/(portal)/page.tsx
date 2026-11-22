import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, Plus, Wallet } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { calendarEvents } from "@/modules/calendar/service";
import { HomeCalendar } from "@/modules/calendar/HomeCalendar";
import { NextClass } from "@/modules/calendar/NextClass";
import { DeadlinesCard } from "@/modules/dashboard/DeadlinesCard";
import { dashboardDeadlines } from "@/modules/dashboard/deadlines";
import { CommunityStrip } from "@/modules/dashboard/CommunityStrip";
import { communityHighlights } from "@/modules/community/service";
import {
  Card,
  PageTitle,
  SectionTitle,
  Badge,
  ui,
} from "@/shared/ui/primitives";
import { dateKey, addDays, formatDate, money } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";
import s from "@/modules/dashboard/dashboard.module.css";

export const metadata = { title: "Главная" };

export default async function Home() {
  const student = await pageStudent();
  const isBudgetStudent = student.funding === "Бюджет";
  const today = dateKey();
  const now = new Date();
  const [events, deadlines, requests, payment] = await Promise.all([
    calendarEvents(student, {
      from: addDays(today, -3),
      to: addDays(today, 21),
    }),
    dashboardDeadlines(student.id, now),
    db.studentRequest.findMany({
      where: {
        studentId: student.id,
        status: { in: ["SUBMITTED", "IN_REVIEW", "NEEDS_INFO", "READY"] },
      },
      include: { service: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    isBudgetStudent
      ? db.payment.findFirst({
          where: { studentId: student.id, status: "EXPECTED" },
          orderBy: { date: "asc" },
        })
      : null,
  ]);
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString();
  const nextClassEvents = events.filter(
    (event) =>
      event.type === "LESSON" && event.startsAt && event.startsAt < nextWeek,
  );
  const lecturerIds = [
    ...new Set(
      nextClassEvents.flatMap(({ lecturerId }) =>
        lecturerId ? [lecturerId] : [],
      ),
    ),
  ];
  const lecturerProfiles = lecturerIds.length
    ? await db.lecturerProfile.findMany({
        where: { personId: { in: lecturerIds } },
        select: { personId: true, avatar: true },
      })
    : [];
  const lecturerAvatars = Object.fromEntries(
    lecturerProfiles.map(({ personId, avatar }) => [personId, avatar]),
  );
  const change = events.find((e) => e.changes?.length);
  return (
    <div className={s.dashboard}>
      <PageTitle
        title="Сегодня"
        description={`${formatDate(now, { weekday: "long", day: "numeric", month: "long" })} · Хорошего дня, ${student.name.split(" ")[0]}`}
        action={
          <Link href="/services" className={ui.button}>
            <Plus size={16} />
            Заказать справку
          </Link>
        }
      />
      <div className={ui.stack}>
        <div className={s.topRow}>
          <Card className={s.top}>
            <HomeCalendar events={events} date={today} />
            <NextClass
              events={nextClassEvents}
              lecturerAvatars={lecturerAvatars}
              now={now.toISOString()}
            />
          </Card>
          <DeadlinesCard deadlines={deadlines} now={now} />
        </div>
        <div className={s.attentionRow}>
          <div className={ui.stack}>
            <Card>
              <SectionTitle
                title="Мои обращения"
                href="/services?tab=requests"
                label="Вся история"
              />
              {requests.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className={`${ui.between} ${ui.listLink}`}
                >
                  <div>
                    <h3>{r.service.title}</h3>
                    <small className={ui.muted}>
                      № {String(r.number).padStart(5, "0")} ·{" "}
                      {r.status === "NEEDS_INFO"
                        ? "Нужно ответить на уточнение"
                        : r.status === "READY"
                          ? "Документ доступен для скачивания"
                          : "Ожидайте рассмотрения"}
                    </small>
                  </div>
                  <Badge
                    tone={
                      r.status === "NEEDS_INFO"
                        ? "warning"
                        : r.status === "READY"
                          ? "success"
                          : "default"
                    }
                  >
                    {statusLabel(r.status)}
                  </Badge>
                </Link>
              ))}
            </Card>
          </div>
          <div className={ui.stack}>
            <section
              className={`${ui.card} ${s.attentionSection}`}
              aria-labelledby="attention-title"
            >
              <h2 id="attention-title">Требует внимания</h2>
              <Link
                href="/studies/results?status=attention"
                className={s.attention}
              >
                <AlertCircle size={16} className={s.attentionIcon} />
                <div>
                  <h3>Держи результат под контролем</h3>
                  <p className={ui.caption}>
                    Посещаемость и обязательные работы могут влиять на допуск.
                  </p>
                </div>
              </Link>
              {change && (
                <Link
                  href={`/calendar?date=${dateKey(change.startsAt!)}&event=${change.id}`}
                  className={s.attention}
                >
                  <AlertCircle size={16} className={s.attentionIcon} />
                  <div>
                    <h3>Изменение расписания</h3>
                    <p className={ui.caption}>
                      {change.changes![0].before} → {change.changes![0].after}
                    </p>
                  </div>
                </Link>
              )}
              <div className={s.attention}>
                <AlertCircle size={16} className={s.attentionIcon} />
                <div>
                  <h3>Оценить своих преподавателей</h3>
                  <p className={ui.caption}>
                    Заполни анкету СОП до начала сессии.
                  </p>
                </div>
              </div>
            </section>
            {isBudgetStudent && (
              <Link
                href={payment ? "/finance" : "/finance?tab=scholarships"}
                className={`${ui.card} ${s.finance}`}
              >
                <div className={ui.row}>
                  <Wallet size={18} aria-hidden />
                  <span>
                    {payment ? "Следующая стипендия" : "Стипендия"}
                    <br />
                    <small className={ui.muted}>
                      {payment
                        ? `${formatDate(payment.date)} · ожидается`
                        : "Нет назначений"}
                    </small>
                  </span>
                </div>
                {payment && <strong>{money(payment.amountKopecks)}</strong>}
              </Link>
            )}
          </div>
        </div>
        <Suspense fallback={null}>
          <DashboardCommunity groupId={student.groupId} now={now} />
        </Suspense>
      </div>
    </div>
  );
}

async function DashboardCommunity({
  groupId,
  now,
}: {
  groupId: string;
  now: Date;
}) {
  const items = await communityHighlights(groupId, now);
  return <CommunityStrip items={items} />;
}
