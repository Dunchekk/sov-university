import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { Settings } from "@/modules/students/Settings";
import { PageTitle } from "@/shared/ui/primitives";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const student = await pageStudent();
  const schedules = await db.savedSchedule.findMany({
    where: { studentId: student.id },
  });
  return (
    <>
      <PageTitle
        title="Настройки"
        description="Пусть кабинет работает так, как удобно тебе."
      />
      <Settings
        initial={{
          theme: student.preference?.theme ?? "system",
          calendarView: student.preference?.calendarView ?? "week",
          notifications: (student.preference?.notifications as Record<
            string,
            boolean
          >) ?? { SCHEDULE: true, STUDY: true, REQUEST: true, COMMUNITY: true },
        }}
        schedules={schedules}
      />
    </>
  );
}
