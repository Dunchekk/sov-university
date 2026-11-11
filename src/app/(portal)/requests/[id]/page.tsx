import Link from "next/link";
import { FileText, Check, Clock3 } from "lucide-react";
import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { requestDetail } from "@/modules/requests/service";
import { RequestActions } from "@/modules/requests/RequestActions";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { statusLabel } from "@/shared/config/statuses";
import { formatDate } from "@/shared/lib/time";
export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const student = await pageStudent();
  const { id } = await params;
  const item = await pageData(requestDetail(student, id));
  const snapshot = item.serviceSnapshot as Record<string, unknown> | null;
  const title = String(snapshot?.title ?? item.service.title);
  const next = (
    {
      DRAFT: "Заполните и отправьте черновик.",
      SUBMITTED: "Обращение принято. Ожидайте рассмотрения.",
      IN_REVIEW: "Ваши сведения рассматриваются. Ответ появится здесь.",
      NEEDS_INFO: "Ответьте на запрос уточнения ниже.",
      READY: "Результат готов. Скачайте демонстрационный документ.",
      REJECTED: "Прочитайте причину в истории. Можно создать новое обращение.",
      CANCELLED: "Вы отозвали обращение. Рассмотрение прекращено.",
      ARCHIVED: "Обращение завершено и сохранено в истории.",
    } as Record<string, string>
  )[item.status];
  const resultAvailable =
    item.status === "READY" &&
    (!item.resultExpiresAt || item.resultExpiresAt > new Date());
  return (
    <>
      <PageTitle
        title={title}
        description={`Обращение № ${String(item.number).padStart(5, "0")} · ${formatDate(item.createdAt)}`}
        action={
          <Badge
            tone={
              item.status === "READY"
                ? "success"
                : item.status === "NEEDS_INFO"
                  ? "warning"
                  : "info"
            }
          >
            {statusLabel(item.status)}
          </Badge>
        }
      />
      <div className={ui.grid2}>
        <div className={ui.stack}>
          <Card>
            <h2>Следующий шаг</h2>
            <p>{next}</p>
            {item.dueAt && (
              <p className={ui.caption}>
                Ориентировочный срок: {formatDate(item.dueAt)} · только будни,
                праздники не учтены
              </p>
            )}
            <p className={ui.caption}>
              {String(snapshot?.department ?? item.service.department)}
            </p>
            {item.status === "DRAFT" && (
              <Link
                className={ui.link}
                href={`/services/${item.serviceSlug}?draft=${id}`}
              >
                Продолжить заполнение →
              </Link>
            )}
            <hr />
            {item.files.map((file) => (
              <div className={ui.listItem} key={file.id}>
                {file.purpose !== "REQUEST_RESULT" || resultAvailable ? (
                  <a className={ui.row} href={`/api/files/${file.id}`}>
                    <FileText size={19} />
                    {file.originalName}
                    <small className={ui.muted}>PDF</small>
                  </a>
                ) : (
                  <p className={ui.muted}>
                    Срок доступности результата истёк. Обратитесь в учебный
                    офис.
                  </p>
                )}
              </div>
            ))}
            {item.status === "READY" &&
              !item.files.some((f) => f.purpose === "REQUEST_RESULT") && (
                <p className={ui.alert}>
                  Результат не прикреплён. Уточните способ получения в учебном
                  офисе.
                </p>
              )}
            <RequestActions
              id={id}
              slug={item.serviceSlug}
              status={item.status}
              version={item.version}
              cancellable={Boolean(
                snapshot?.cancellable ?? item.service.cancellable,
              )}
            />
          </Card>
          <Card>
            <h2>Комментарии</h2>
            {item.comments.length ? (
              item.comments.map((c) => (
                <div key={c.id} className={ui.listItem}>
                  <div className={ui.between}>
                    <strong>{c.authorName}</strong>
                    <small className={ui.muted}>
                      {formatDate(c.createdAt)}
                    </small>
                  </div>
                  <small className={ui.caption}>
                    {c.authorRole === "STAFF" ? "Учебный офис" : "Студент"}
                  </small>
                  <p>{c.text}</p>
                </div>
              ))
            ) : (
              <p className={ui.muted}>
                Комментариев пока нет. Автоматический ответ не создаётся.
              </p>
            )}
          </Card>
        </div>
        <div className={ui.stack}>
          <Card>
            <h2>История обращения</h2>
            {item.history.map((h, i) => (
              <div key={h.id} className={`${ui.row} ${ui.listItem}`}>
                {i === item.history.length - 1 ? (
                  <Clock3 size={17} />
                ) : (
                  <Check size={17} />
                )}
                <div>
                  <h3>{statusLabel(h.status)}</h3>
                  <p className={ui.muted}>{h.text}</p>
                  <small className={ui.caption}>
                    {formatDate(h.createdAt, {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <h2>Поданные сведения</h2>
            {Object.entries(item.fields as Record<string, unknown>).map(
              ([key, value]) => (
                <div key={key} className={ui.listItem}>
                  <small className={ui.caption}>
                    {(
                      {
                        recipient: "Получатель",
                        format: "Формат",
                        language: "Язык",
                        copies: "Экземпляры",
                        period: "Период",
                        subject: "Тема",
                        description: "Описание",
                        category: "Категория",
                        purpose: "Назначение",
                        contractId: "Договор",
                        campaignId: "Кампания",
                        achievementIds: "Достижения",
                      } as Record<string, string>
                    )[key] ?? key}
                  </small>
                  <p>
                    {Array.isArray(value)
                      ? item.achievements
                          .map((a) => a.achievement.title)
                          .join(", ") || "Не выбрано"
                      : ((
                          {
                            electronic: "Электронный PDF",
                            paper: "Бумажный документ",
                            ru: "Русский",
                            en: "Английский",
                            current: "Текущий семестр",
                            all: "Весь период",
                          } as Record<string, string>
                        )[String(value)] ?? String(value))}
                  </p>
                </div>
              ),
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
