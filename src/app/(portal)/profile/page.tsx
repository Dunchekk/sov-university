import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, Mail, Pencil, Settings } from "lucide-react";
import { pageStudent, type StudentContext } from "@/server/access";
import { db } from "@/server/db";
import { CopyButton } from "@/shared/ui/CopyButton";
import { Avatar, Tabs, ui } from "@/shared/ui/primitives";
import { PrivateDetails } from "@/modules/students/PrivateDetails";
import { ProfileAchievements } from "@/modules/students/ProfileAchievements";
import { ProfileDocuments } from "@/modules/students/ProfileDocuments";
import { ProfileAvatarActions } from "@/modules/students/ProfileAvatarActions";
import { profileAchievements } from "@/modules/students/achievements";
import { avatarEndpoint, profileAvatarSrc } from "@/modules/students/avatar";
import { dateKey, formatDate } from "@/shared/lib/time";
import { brand } from "@/shared/config/brand";
import s from "@/modules/students/profile.module.css";

export const metadata = { title: "Мой профиль" };

const tabs = [
  { id: "overview", label: "Основное", href: "/profile" },
  { id: "documents", label: "Документы", href: "/profile?tab=documents" },
  { id: "history", label: "Учебная история", href: "/profile?tab=history" },
];

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [student, { tab }] = await Promise.all([pageStudent(), searchParams]);
  const active = tabs.find(({ id }) => id === tab)?.id ?? "overview";
  const photo = profileAvatarSrc(student.image);
  const achievements = profileAchievements(student.id);

  return (
    <div className={s.profile}>
      <div className={s.layout}>
        <div className={s.rail}>
          <ProfileAvatarActions
            hasPhoto={!!photo}
            portrait={
              photo ? (
                <Image
                  src={photo}
                  alt=""
                  fill
                  unoptimized={photo.startsWith(avatarEndpoint)}
                  sizes="(max-width: 680px) 72px, 232px"
                  loading="eager"
                />
              ) : (
                <Avatar name={student.name} />
              )
            }
          >
            <Link
              href="/services/enrollment"
              className={`${ui.button} ${ui.primary}`}
            >
              <FileText size={16} aria-hidden /> Справка об обучении
            </Link>
            <Link
              href="/settings"
              className={
                achievements.length > 0
                  ? `${ui.button} ${s.settingsWithAchievements}`
                  : ui.button
              }
            >
              <Settings size={16} aria-hidden /> Настройки
            </Link>
          </ProfileAvatarActions>
        </div>

        <div className={s.main}>
          <header className={s.identity}>
            <h1>{student.name}</h1>
            <p className={ui.muted}>Студент · {brand.university}</p>
          </header>
          <div className={s.content}>
            <Tabs active={active} items={tabs} />
            {active === "documents" ? (
              <ProfileDocuments studentId={student.id} />
            ) : active === "history" ? (
              <StudyHistory studentId={student.id} />
            ) : (
              <Overview student={student} />
            )}
          </div>
        </div>
        {achievements.length > 0 && (
          <div className={s.achievements}>
            <ProfileAchievements achievements={achievements} />
          </div>
        )}
      </div>
    </div>
  );
}

async function Overview({ student }: { student: StudentContext }) {
  const { program, name: group, year, curatorId } = student.group;
  const curator = curatorId
    ? await db.person.findUnique({
        where: { id: curatorId },
        select: { id: true, name: true },
      })
    : null;

  return (
    <div className={ui.stack}>
      <section className={s.panel} aria-labelledby="profile-education">
        <h2 id="profile-education">Обучение</h2>
        <dl className={s.educationDetails}>
          <div>
            <dt>Программа</dt>
            <dd>{program.name}</dd>
          </div>
          <div>
            <dt>Факультет</dt>
            <dd>{program.faculty}</dd>
          </div>
          <div>
            <dt>Курс и группа</dt>
            <dd>
              {year} курс · {group}
            </dd>
          </div>
          <div>
            <dt>Форма обучения</dt>
            <dd>{student.studyMode}</dd>
          </div>
          <div>
            <dt>Финансирование</dt>
            <dd>{student.funding}</dd>
          </div>
        </dl>
        <div className={s.panelFooter}>
          <Link
            href="/services/general?category=PROFILE&subject=Ошибка%20в%20учебных%20данных"
            className={s.textLink}
          >
            <Pencil size={15} aria-hidden /> Сообщить об ошибке
          </Link>
        </div>
      </section>

      <section className={s.panel} aria-labelledby="profile-contacts">
        <h2 id="profile-contacts">Контакты</h2>
        <dl className={s.contactDetails}>
          <div>
            <dt>Учебный email</dt>
            <dd className={ui.row}>
              <a className={s.textLink} href={`mailto:${student.email}`}>
                <Mail size={15} aria-hidden /> {student.email}
              </a>
              <CopyButton value={student.email} />
            </dd>
          </div>
          {curator && (
            <div>
              <dt>Куратор</dt>
              <dd>
                <Link
                  className={s.textLink}
                  href={`/people/${encodeURIComponent(curator.id)}`}
                >
                  {curator.name} <ArrowUpRight size={15} aria-hidden />
                </Link>
              </dd>
            </div>
          )}
        </dl>
        <PrivateDetails kind="contacts" />
        <div className={s.panelFooter}>
          <Link href="/people?tab=departments" className={s.textLink}>
            Учебный офис <ArrowUpRight size={15} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

async function StudyHistory({ studentId }: { studentId: string }) {
  const orders = await db.studentOrder.findMany({
    where: { studentId },
    orderBy: [{ date: "desc" }, { id: "asc" }],
    select: { id: true, date: true, title: true, description: true },
    take: 30,
  });

  return (
    <section className={s.panel} aria-labelledby="profile-history">
      <h2 id="profile-history">Учебные приказы</h2>
      {orders.length ? (
        <>
          <ul className={s.orders}>
            {orders.map((order) => (
              <li key={order.id}>
                <details id={`order-${order.id}`} className={s.order}>
                  <summary>
                    <span>{order.title}</span>
                    <time dateTime={dateKey(order.date)}>
                      {formatDate(order.date, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </summary>
                  <p className={ui.muted}>{order.description}</p>
                </details>
              </li>
            ))}
          </ul>
          <div className={s.panelFooter}>
            <Link href="/services/order" className={s.textLink}>
              Заказать выписку из приказа <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>
        </>
      ) : (
        <p className={`${ui.muted} ${s.empty}`}>Учебных приказов пока нет.</p>
      )}
    </section>
  );
}
