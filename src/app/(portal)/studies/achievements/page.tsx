import Link from "next/link";
import { Award, Plus } from "lucide-react";
import { pageStudent } from "@/server/access";
import { db } from "@/server/db";
import {
  PageTitle,
  Card,
  Badge,
  Empty,
  ActionLink,
  ui,
} from "@/shared/ui/primitives";
import { FilterForm, FilterSelect } from "@/shared/ui/FilterForm";
import { filterValue, type FilterParams } from "@/shared/lib/filters";
import { statusLabel } from "@/shared/config/statuses";
import { achievementCategories } from "@/modules/achievements/categories";

export const metadata = { title: "Достижения" };

const path = "/studies/achievements";
export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const student = await pageStudent();
  const p = await searchParams;
  const category = achievementCategories.find(
    (value) => value === filterValue(p.category),
  );
  const items = await db.achievement.findMany({
    where: {
      studentId: student.id,
      category,
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
      <FilterForm
        action={path}
        className={ui.filterBar}
        aria-label="Фильтры достижений"
      >
        <label>
          Категория
          <FilterSelect name="category" value={category ?? ""}>
            <option value="">Все категории</option>
            {achievementCategories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </FilterSelect>
        </label>
        <button className={ui.button}>Показать</button>
      </FilterForm>
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
          title={
            category
              ? "Нет достижений в этой категории"
              : "Здесь будет твоя история"
          }
          description={
            category ? undefined : "Добавьте достижение с подтверждением."
          }
          action={
            category ? (
              <ActionLink href={path}>Все категории</ActionLink>
            ) : undefined
          }
        />
      )}
    </>
  );
}
