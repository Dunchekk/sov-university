import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { db } from "@/server/db";
import { pageStudent } from "@/server/access";
import { Badge, Card, ui } from "@/shared/ui/primitives";
import { CopyButton } from "@/shared/ui/CopyButton";
import { BreadcrumbTitle } from "@/shared/ui/shell/BreadcrumbTitle";
import { LecturerPortrait } from "../LecturerPortrait";
import s from "../people.module.css";

const loadLecturer = cache(async (id: string) => {
  const student = await pageStudent();
  const lecturer = await db.person.findUnique({
    where: { id },
    include: {
      profile: true,
      courses: {
        select: {
          id: true,
          name: true,
          enrollments: {
            where: { studentId: student.id },
            select: { id: true },
          },
        },
        orderBy: { name: "asc" },
      },
      lessons: { take: 1, select: { id: true } },
    },
  });
  if (!lecturer) notFound();
  return lecturer;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: (await loadLecturer((await params).id)).name };
}

export default async function LecturerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lecturer = await loadLecturer(id);
  const { profile, courses } = lecturer;
  const topics = (profile?.topics.split("\n") ?? []).filter(
    (topic) => !courses.some((course) => course.name === topic),
  );

  return (
    <article>
      <BreadcrumbTitle
        path={`/people/${encodeURIComponent(id)}`}
        title={lecturer.name}
        parentHref="/people?tab=all"
      />
      <Link href="/people?tab=all" className={s.back}>
        <ArrowLeft size={16} aria-hidden /> Все преподаватели
      </Link>
      <header className={s.profileHeader}>
        <LecturerPortrait name={lecturer.name} src={profile?.avatar} large />
        <div className={s.identity}>
          <h1 className={s.profileName}>{lecturer.name}</h1>
          <p className={s.profileRole}>
            {profile?.position ?? "Преподаватель"} · {lecturer.department}
          </p>
          {profile && (
            <p className={s.since}>В университете с {profile.since} года</p>
          )}
        </div>
      </header>
      <div className={s.profileLayout}>
        <div className={s.profileMain}>
          {profile && (
            <>
              <section className={s.profileSection}>
                <h2>О преподавателе</h2>
                {profile.biography.split("\n\n").map((paragraph) => (
                  <p className={s.bio} key={paragraph}>
                    {paragraph}
                  </p>
                ))}
              </section>
              <section className={s.profileSection}>
                <h2>Научные интересы</h2>
                <div className={s.tags}>
                  {profile.interests.map((interest) => (
                    <Badge key={interest}>{interest}</Badge>
                  ))}
                </div>
              </section>
              <section className={s.profileSection}>
                <h2>Образование</h2>
                <ul className={s.bullets}>
                  {profile.education.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
          {courses.length > 0 && (
            <section className={s.profileSection}>
              <h2>Учебные курсы</h2>
              <ul className={s.bullets}>
                {courses.map((course) => (
                  <li key={course.id}>
                    {course.enrollments.length ? (
                      <Link
                        className={ui.link}
                        href={`/studies/courses/${encodeURIComponent(course.id)}`}
                      >
                        {course.name}
                      </Link>
                    ) : (
                      course.name
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {topics.length > 0 && (
            <section className={s.profileSection}>
              <h2>Темы преподавания</h2>
              <ul className={s.bullets}>
                {topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside aria-label="Контакты и консультации">
          <Card className={ui.stack}>
            <h2>Контакты и консультации</h2>
            <dl className={s.details}>
              <div>
                <dt>Электронная почта</dt>
                <dd className={s.email}>
                  <a className={ui.link} href={`mailto:${lecturer.email}`}>
                    {lecturer.email}
                  </a>
                  <CopyButton value={lecturer.email} />
                </dd>
              </div>
              {profile && (
                <>
                  <div>
                    <dt>Внутренний телефон</dt>
                    <dd>{profile.phoneExtension}</dd>
                  </div>
                  <div>
                    <dt>Кабинет</dt>
                    <dd>{profile.office}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Консультации</dt>
                <dd>{lecturer.consultation}</dd>
              </div>
              {profile && (
                <div>
                  <dt>Языки</dt>
                  <dd>{profile.languages.join(", ")}</dd>
                </div>
              )}
            </dl>
            {lecturer.lessons.length > 0 && (
              <Link
                className={ui.link}
                href={`/calendar?schedules=lecturer:${encodeURIComponent(id)}`}
              >
                Опубликованное расписание <ArrowUpRight size={15} aria-hidden />
              </Link>
            )}
          </Card>
        </aside>
      </div>
    </article>
  );
}
