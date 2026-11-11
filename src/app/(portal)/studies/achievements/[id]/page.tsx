import { DraftFiles } from "@/shared/ui/DraftFiles";
import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { achievementDetail } from "@/modules/achievements/service";
import { AchievementForm } from "@/modules/achievements/AchievementForm";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { statusLabel } from "@/shared/config/statuses";
export default async function AchievementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const item = await pageData(achievementDetail(student, id));
  return (
    <>
      <PageTitle
        title={item.title}
        description={`${item.category} · ${item.date}`}
        action={
          <Badge tone={item.status === "CONFIRMED" ? "success" : "default"}>
            {item.status === "SUBMITTED"
              ? "На проверке"
              : statusLabel(item.status)}
          </Badge>
        }
      />
      <Card>
        <div className={ui.stack}>
          {item.reviewerComment && (
            <p className={`${ui.alert} ${ui.warning}`}>
              {item.reviewerComment}
            </p>
          )}
          {["DRAFT", "NEEDS_INFO"].includes(item.status) ? (
            <AchievementForm initial={item} />
          ) : (
            <>
              <p>{item.description}</p>
              <p>Организатор: {item.organizer}</p>
              {item.coauthors && <p>Соавторы: {item.coauthors}</p>}
              {item.evidenceUrl && (
                <a
                  className={ui.link}
                  href={item.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть подтверждение →
                </a>
              )}
              <p className={ui.caption}>
                {item.status === "SUBMITTED"
                  ? "Достижение ожидает проверки. Подтверждённый статус назначается только в подготовленных демонстрационных данных."
                  : "Состояние зафиксировано в демонстрационной истории."}
              </p>
            </>
          )}
          <DraftFiles
            files={item.files}
            editable={["DRAFT", "NEEDS_INFO"].includes(item.status)}
          />
          {item.history.length > 0 && (
            <details>
              <summary>История состояний</summary>
              {item.history.map((h) => (
                <p key={h.id}>
                  {statusLabel(h.status)} · {h.text}
                </p>
              ))}
            </details>
          )}
        </div>
      </Card>
    </>
  );
}
