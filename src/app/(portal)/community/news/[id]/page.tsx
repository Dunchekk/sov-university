import { notFound } from "next/navigation";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Card, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
export default async function NewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const news = await db.newsPost.findFirst({
    where: {
      id,
      OR: [{ groupId: null }, { groupId: student.groupId }],
      publishedAt: { lte: new Date() },
    },
  });
  if (!news) notFound();
  return (
    <>
      <PageTitle
        title={news.title}
        description={`${formatDate(news.publishedAt)} · ${news.author}`}
      />
      <Card>
        <p>{news.body}</p>
        <p className={ui.caption}>
          Аудитория:{" "}
          {news.groupId ? student.group.name : "Все студенты университета"}
        </p>
      </Card>
    </>
  );
}
