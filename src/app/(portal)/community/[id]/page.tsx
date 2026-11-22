import { cache } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { communityEvent } from "@/modules/community/service";
import { EventActions } from "@/modules/community/EventActions";
import { Cover } from "@/modules/community/Cover";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate, formatTime } from "@/shared/lib/time";
import s from "@/modules/community/community.module.css";

const loadItem = cache(async (id: string) =>
  pageData(communityEvent(await pageStudent(), id)),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: (await loadItem((await params).id)).title };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await loadItem(id);
  return (
    <article className={s.detail}>
      <Link href="/community?tab=events" className={s.back}>
        <ArrowLeft size={16} aria-hidden /> К событиям
      </Link>
      <PageTitle
        title={event.title}
        breadcrumb={{ path: `/community/${encodeURIComponent(id)}` }}
        description={`${event.city} · ${formatDate(event.startsAt)} · ${formatTime(event.startsAt)}–${formatTime(event.endsAt)}`}
        action={<Badge tone="success">{event.category}</Badge>}
      />
      {event.cover && (
        <div className={s.detailMedia}>
          <Cover src={event.cover} sizes="(max-width: 820px) 100vw, 820px" />
        </div>
      )}
      <Card>
        <div className={ui.stack}>
          <h2>{event.location}</h2>
          <div className={s.prose}>
            {event.description.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <p className={ui.muted}>Организатор: {event.organizer}</p>
          {event.registrationDeadline && (
            <p>
              Заявленный срок регистрации:{" "}
              {formatDate(event.registrationDeadline)}. Условия уточняйте у
              организатора.
            </p>
          )}
          <EventActions
            key={id}
            id={id}
            initialSelection={
              event.savedBy[0] ?? { saved: false, inCalendar: false }
            }
          />
        </div>
      </Card>
    </article>
  );
}
