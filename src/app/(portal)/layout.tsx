import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { Shell } from "@/shared/ui/shell/Shell";
import { profileAvatarSrc } from "@/modules/students/avatar";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const student = await pageStudent();
  const unread = await db.notification.count({
    where: { studentId: student.id, readAt: null },
  });
  return (
    <Shell
      name={student.name}
      avatar={profileAvatarSrc(student.image)}
      group={student.group.name}
      unread={unread}
      collapsed={student.preference?.sidebarCollapsed ?? false}
    >
      {children}
    </Shell>
  );
}
