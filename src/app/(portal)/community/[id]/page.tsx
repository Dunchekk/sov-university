import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { communityEvent } from "@/modules/community/service";
import { EventActions } from "@/modules/community/EventActions";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate, formatTime } from "@/shared/lib/time";
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const event = await pageData(communityEvent(student, id));
  return (
    <>
      <PageTitle
        title={event.title}
        description={`${formatDate(event.startsAt)} · ${formatTime(event.startsAt)}–${formatTime(event.endsAt)}`}
        action={<Badge tone="success">{event.category}</Badge>}
      />
      <Card>
        <div className={ui.stack}>
          <h2>{event.location}</h2>
          <p>{event.description}</p>
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
    </>
  );
}
