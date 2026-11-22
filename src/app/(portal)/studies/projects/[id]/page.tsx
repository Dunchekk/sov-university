import { cache } from "react";
import { DraftFiles } from "@/shared/ui/DraftFiles";
import { LecturerLink } from "@/shared/ui/LecturerLink";
import { Check, Clock3, FileText } from "lucide-react";
import { pageStudent } from "@/server/access";
import { pageData } from "@/server/page-data";
import { projectDetail } from "@/modules/projects/service";
import { SubmissionForm } from "@/modules/projects/SubmissionForm";
import { PageTitle, Card, Badge, ui } from "@/shared/ui/primitives";
import { formatDate } from "@/shared/lib/time";
import { statusLabel } from "@/shared/config/statuses";

const loadItem = cache(async (id: string) =>
  pageData(projectDetail(await pageStudent(), id)),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return { title: (await loadItem((await params).id)).title };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadItem(id);
  const open = ["OPEN", "REVISION"].includes(p.status);
  const late = p.dueAt < new Date();
  return (
    <>
      <PageTitle
        title={p.title}
        breadcrumb={{ path: `/studies/projects/${encodeURIComponent(id)}` }}
        description={`${p.kind} · ${p.semester} семестр · ${formatDate(p.startsAt)}–${formatDate(p.dueAt)}`}
        action={
          <Badge tone={p.status === "REVISION" ? "warning" : "info"}>
            {p.status === "SUBMITTED"
              ? "Ожидает проверки"
              : statusLabel(p.status)}
          </Badge>
        }
      />
      <div className={ui.grid2}>
        <div className={ui.stack}>
          <Card>
            <h2>О работе</h2>
            <p>{p.description}</p>
            <hr />
            <h3>
              Руководитель: <LecturerLink {...p.supervisor} />
            </h3>
            <p className={ui.caption}>{p.supervisor.email}</p>
            {p.organization && <p>{p.organization}</p>}
            <hr />
            <h3>Требования и критерии</h3>
            <p className={ui.muted}>{p.requirements}</p>
            {p.files
              .filter((f) => f.purpose === "PROJECT_TEMPLATE")
              .map((f) => (
                <a
                  key={f.id}
                  href={`/api/files/${f.id}`}
                  className={`${ui.row} ${ui.listItem}`}
                >
                  <FileText size={18} />
                  {f.originalName}
                </a>
              ))}
            {p.feedback && (
              <p className={`${ui.alert} ${ui.warning}`}>{p.feedback}</p>
            )}
            {p.result && <p>Итоговый результат: {p.result}</p>}
          </Card>
          <Card>
            <h2>Отправка версии</h2>
            {late && (
              <p className={ui.alert}>
                {p.allowLate
                  ? "Поздняя отправка разрешена, версия будет отмечена «После срока»."
                  : "Срок прошёл. Поздняя отправка не разрешена."}
              </p>
            )}
            {open && (!late || p.allowLate) ? (
              <SubmissionForm
                id={id}
                version={p.version}
                uploads={p.files.filter((f) => f.purpose === "PROJECT_UPLOAD")}
              />
            ) : (
              <p className={ui.muted}>
                {p.status === "SUBMITTED"
                  ? "Версия отправлена. Дождитесь рассмотрения или запроса доработки."
                  : p.status === "FUTURE"
                    ? "Сдача откроется на соответствующем этапе."
                    : "Сдача сейчас недоступна. Свяжитесь с руководителем."}
              </p>
            )}
          </Card>
        </div>
        <div className={ui.stack}>
          <Card>
            <h2>Этапы работы</h2>
            {p.milestones.map((m) => (
              <div key={m.id} className={`${ui.row} ${ui.listItem}`}>
                {m.completed ? (
                  <Check size={18} className={ui.success} />
                ) : (
                  <Clock3 size={18} />
                )}
                <div>
                  <h3>{m.title}</h3>
                  <small className={ui.caption}>
                    {formatDate(m.dueAt)} ·{" "}
                    {m.completed ? "Выполнено" : "Впереди"}
                  </small>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <h2>История версий</h2>
            {!open && p.files.some((f) => f.purpose === "PROJECT_UPLOAD") && (
              <div className={ui.stack}>
                <h3>Неотправленные файлы</h3>
                <DraftFiles
                  files={p.files.filter((f) => f.purpose === "PROJECT_UPLOAD")}
                  editable
                />
              </div>
            )}
            {p.submissions.length ? (
              p.submissions.map((v) => (
                <div key={v.id} className={`${ui.stack} ${ui.listItem}`}>
                  <div className={ui.between}>
                    <strong>Версия {v.version}</strong>
                    <Badge
                      tone={v.status === "REVISION" ? "warning" : "default"}
                    >
                      {v.status === "SUBMITTED"
                        ? "Ожидает проверки"
                        : statusLabel(v.status)}
                    </Badge>
                  </div>
                  <small className={ui.caption}>
                    {formatDate(v.createdAt)}
                    {v.late ? " · После срока" : ""}
                  </small>
                  <a className={ui.link} href={`/api/files/${v.file.id}`}>
                    {v.file.originalName}
                  </a>
                  <p>{v.comment}</p>
                  {v.feedback && <p className={ui.alert}>{v.feedback}</p>}
                </div>
              ))
            ) : (
              <p className={ui.muted}>
                Версий пока нет. Первая отправка появится здесь.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
