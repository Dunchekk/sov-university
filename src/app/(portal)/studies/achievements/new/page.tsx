import { pageStudent } from "@/server/access";
import { AchievementForm } from "@/modules/achievements/AchievementForm";
import { PageTitle, Card } from "@/shared/ui/primitives";
export default async function NewAchievement() {
  await pageStudent();
  return (
    <>
      <PageTitle
        title="Новое достижение"
        description="Расскажи о результате и приложи демонстрационное подтверждение."
      />
      <Card>
        <AchievementForm />
      </Card>
    </>
  );
}
