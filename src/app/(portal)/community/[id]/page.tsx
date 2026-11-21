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

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const event = await pageData(communityEvent(student, id));
  return (
    <article className={s.detail}>
      <Link href="/community?tab=events" className={s.back}>
        <ArrowLeft size={16} aria-hidden /> К событиям
      </Link>
      <PageTitle
        title={event.title}
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
            id={id}
            saved={event.savedBy[0]?.saved ?? false}
            inCalendar={event.savedBy[0]?.inCalendar ?? false}
          />
        </div>
      </Card>
    </article>
  );
}
