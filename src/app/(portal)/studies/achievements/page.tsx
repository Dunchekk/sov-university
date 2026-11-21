import Link from "next/link";
import { Award, Plus } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import { PageTitle, Card, Badge, Empty, ui } from "@/shared/ui/primitives";
import { statusLabel } from "@/shared/config/statuses";
export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const items = await db.achievement.findMany({
    where: {
      studentId: student.id,
      ...(p.category ? { category: p.category } : {}),
    },
    orderBy: { date: "desc" },
    take: 100,
  });
  return (
    <>
      <PageTitle
        title="Достижения"
        description="Твои проекты, открытия и маленькие большие победы. Портфолио видно только тебе."
        action={
          <Link
            href="/studies/achievements/new"
            className={`${ui.button} ${ui.primary}`}
          >
            <Plus size={16} />
            Добавить достижение
          </Link>
        }
      />
      <form className={ui.filterBar}>
        <label>
          Категория
          <select name="category" defaultValue={p.category ?? ""}>
            <option value="">Все категории</option>
            {[
              "Учёба",
              "Наука",
              "Творчество",
              "Спорт",
              "Общественная деятельность",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button className={ui.button}>Показать</button>
      </form>
      <div className={ui.grid3}>
        {items.map((item) => (
          <Card key={item.id}>
            <div className={ui.stack}>
              <div className={ui.between}>
                <Award size={22} />
                <small className={ui.caption}>{item.category}</small>
              </div>
              <Link href={`/studies/achievements/${item.id}`}>
                <h2>{item.title}</h2>
              </Link>
              <p className={ui.caption}>
                {new Date(`${item.date}T12:00:00Z`).toLocaleDateString("ru-RU")}{" "}
                · {item.organizer}
              </p>
              <Badge
                tone={
                  item.status === "CONFIRMED"
                    ? "success"
                    : item.status === "NEEDS_INFO"
                      ? "warning"
                      : "default"
                }
              >
                {item.status === "SUBMITTED"
                  ? "На проверке"
                  : statusLabel(item.status)}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="Здесь будет твоя история"
          description="Добавьте достижение с подтверждением."
        />
      )}
    </>
  );
}
