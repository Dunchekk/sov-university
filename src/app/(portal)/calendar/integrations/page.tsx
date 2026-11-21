import { pageStudent } from "@/server/access";
import { CalendarConnections } from "@/modules/calendar/CalendarConnections";
import { integrations } from "@/modules/calendar/integrations";
import { dateKey } from "@/shared/lib/time";
import { PageTitle, ActionLink } from "@/shared/ui/primitives";
export default async function IntegrationsPage() {
  const student = await pageStudent();
  return (
    <>
      <PageTitle
        title="Календарь с собой"
        description="Ваше расписание там, где удобно планировать день"
        action={<ActionLink href="/calendar">К календарю</ActionLink>}
      />
      <CalendarConnections
        data={await integrations(student.id)}
        today={dateKey()}
        publicAddress={process.env.APP_URL?.startsWith("https://") ?? false}
      />
    </>
  );
}
