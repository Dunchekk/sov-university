import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { Badge, PageTitle, Card, ui } from "@/shared/ui/primitives";
import { Cover } from "@/modules/community/Cover";
import { communityAudience } from "@/modules/community/service";
import { formatDate } from "@/shared/lib/time";
import s from "@/modules/community/community.module.css";

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
      ...communityAudience(student.groupId),
      publishedAt: { lte: new Date() },
    },
  });
  if (!news) notFound();
  return (
    <article className={s.detail}>
      <Link href="/community?tab=news" className={s.back}>
        <ArrowLeft size={16} aria-hidden /> К новостям
      </Link>
      <PageTitle
        title={news.title}
        description={`${news.city} · ${formatDate(news.publishedAt)} · ${news.author}`}
        action={<Badge>{news.category}</Badge>}
      />
      {news.cover && (
        <div className={s.detailMedia}>
          <Cover src={news.cover} sizes="(max-width: 820px) 100vw, 820px" />
        </div>
      )}
      <Card className={ui.stack}>
        <div className={s.prose}>
          {news.body.split("\n\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <p className={ui.caption}>
          Аудитория:{" "}
          {news.groupId ? student.group.name : "Все студенты университета"}
        </p>
      </Card>
    </article>
  );
}
