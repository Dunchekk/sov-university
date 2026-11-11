import Link from "next/link";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PrivateDetails } from "@/modules/students/PrivateDetails";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate, dateKey } from "@/shared/lib/time";
import { brand } from "@/shared/config/brand";
import s from "@/modules/students/profile.module.css";
export default async function ProfilePage() {
  const student = await pageStudent();
  const [orders, achievements, confirmed] = await Promise.all([
    db.studentOrder.findMany({
      where: { studentId: student.id },
      orderBy: { date: "desc" },
      take: 30,
    }),
    db.achievement.findMany({
      where: { studentId: student.id, status: "CONFIRMED" },
      select: { id: true, title: true },
      take: 3,
    }),
    db.achievement.count({
      where: { studentId: student.id, status: "CONFIRMED" },
    }),
  ]);
  return (
    <>
      <PageTitle
        title="Мой профиль"
        description="Учебные сведения и твоя история в университете."
        action={
          <Link
            href="/services/general?category=PROFILE&subject=Ошибка%20в%20учебных%20данных"
            className={ui.button}
          >
            Сообщить об ошибке
          </Link>
        }
      />
      <div className={s.grid}>
        <div className={ui.stack}>
          <Card className={s.identity}>
            <div className={s.portrait}>
              {student.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <h2>{student.name}</h2>
            <p className={ui.muted}>
              {student.group.name} · {student.group.year} курс
            </p>
            <Badge tone="success">Студент</Badge>
            <div className={s.stat}>
              <p className={ui.caption}>{brand.university}</p>
            </div>
            <div className={s.stat}>
              <strong>{confirmed}</strong>
              <p className={ui.caption}>подтверждённых достижений</p>
            </div>
          </Card>
          <Card>
            <h2>
              {formatDate(new Date(), { month: "long", year: "numeric" })}
            </h2>
            <p className={ui.largeNumber}>
              {formatDate(new Date(), { day: "numeric" })}
            </p>
            <p className={ui.caption}>
              {formatDate(new Date(), { weekday: "long" })}
            </p>
            <Link className={ui.link} href={`/calendar?date=${dateKey()}`}>
              Открыть мой календарь →
            </Link>
          </Card>
        </div>
        <div className={ui.stack}>
          <Card>
            <h2>Образование</h2>
            <div className={s.details}>
              {[
                ["Программа", student.group.program.name],
                ["Факультет", student.group.program.faculty],
                [
                  "Курс и группа",
                  `${student.group.year} курс · ${student.group.name}`,
                ],
                ["Форма обучения", student.studyMode],
                ["Финансирование", student.funding],
                ["Учебный email", student.email],
              ].map(([label, value]) => (
                <div key={label} className={s.stat}>
                  <small className={ui.caption}>{label}</small>
                  <p>{value}</p>
                </div>
              ))}
            </div>
            <Link className={ui.link} href="/people?tab=departments">
              Контакты учебного офиса и куратора →
            </Link>
          </Card>
          <Card>
            <PrivateDetails kind="contacts" />
          </Card>
          <Card>
            <PrivateDetails kind="documents" />
          </Card>
          <Card>
            <h2>Учебная история</h2>
            {orders.map((o) => (
              <details key={o.id} className={ui.listItem}>
                <summary>
                  {o.title} · {formatDate(o.date)}
                </summary>
                <p className={ui.muted}>{o.description}</p>
                <Link href="/services/order" className={ui.link}>
                  Заказать выписку
                </Link>
              </details>
            ))}
          </Card>
          <Card>
            <h2>Достижения</h2>
            {achievements.map((a) => (
              <Link
                key={a.id}
                href={`/studies/achievements/${a.id}`}
                className={`${ui.link} ${ui.listItem}`}
              >
                {a.title} →
              </Link>
            ))}
            <div className={ui.row}>
              <Link className={ui.button} href="/studies/achievements">
                Портфолио
              </Link>
              <Link className={ui.button} href="/finance">
                Финансы
              </Link>
              <Link className={ui.button} href="/services?tab=requests">
                Обращения
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
