import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { pageStudent } from "@/server/access";
import { Avatar, Card, PageTitle, ui } from "@/shared/ui/primitives";
import { CopyButton } from "@/shared/ui/CopyButton";

export default async function LecturerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageStudent();
  const { id } = await params;
  const lecturer = await db.person.findUnique({
    where: { id },
    include: {
      courses: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!lecturer) notFound();

  return (
    <>
      <PageTitle
        title={lecturer.name}
        description={lecturer.department}
        action={
          <Link href="/people?tab=teachers" className={ui.button}>
            Все преподаватели
          </Link>
        }
      />
      <Card>
        <div className={ui.stack}>
          <div className={ui.row}>
            <Avatar name={lecturer.name} />
            <h2>Контакты и консультации</h2>
          </div>
          <div className={ui.row}>
            <span>{lecturer.email}</span>
            <CopyButton value={lecturer.email} />
          </div>
          <p className={ui.muted}>{lecturer.consultation}</p>
          {lecturer.courses.length > 0 && (
            <p>{lecturer.courses.map((course) => course.name).join(" · ")}</p>
          )}
          <Link
            className={ui.link}
            href={`/calendar?schedules=lecturer:${encodeURIComponent(id)}`}
          >
            Посмотреть опубликованное расписание →
          </Link>
        </div>
      </Card>
    </>
  );
}
