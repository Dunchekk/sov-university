"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { FileUpload } from "@/shared/ui/FileUpload";
import { api, ApiError, operationKey } from "@/shared/lib/client";
import { dateKey } from "@/shared/lib/time";
import { achievementCategories } from "./categories";
export function AchievementForm({
  initial,
}: {
  initial?: {
    id: string;
    version: number;
    status: string;
    title: string;
    category: string;
    date: string;
    description: string;
    organizer: string;
    coauthors: string;
    evidenceUrl: string | null;
  };
}) {
  const router = useRouter();
  const [identity, setIdentity] = useState(
      initial ? { id: initial.id, version: initial.version } : undefined,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState<{
      id: string;
      action: string;
      version: number;
      key: string;
    } | null>(null);
  const createKey = useRef(""),
    submitKey = useRef("");
  const save = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const fields = Object.fromEntries(
      [
        "title",
        "category",
        "date",
        "description",
        "organizer",
        "coauthors",
        "evidenceUrl",
      ].map((k) => [k, String(data.get(k) ?? "")]),
    );
    let result: { id: string; version: number };
    if (identity)
      result = await api(`/api/achievements/${identity.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...fields, version: identity.version }),
      });
    else {
      createKey.current ||= operationKey();
      result = await api("/api/achievements", {
        method: "POST",
        body: JSON.stringify({ ...fields, key: createKey.current }),
      });
    }
    setIdentity(result);
    return result;
  };
  return (
    <form
      className={ui.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const submitter = (e.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement;
        setBusy(true);
        setError("");
        try {
          if (submitter?.value === "submit") {
            let attempt = pending;
            if (!attempt) {
              const item = await save(form);
              submitKey.current ||= operationKey();
              attempt = {
                id: item.id,
                action: initial?.status === "NEEDS_INFO" ? "respond" : "submit",
                version: item.version,
                key: submitKey.current,
              };
              setPending(attempt);
            }
            const { id, ...payload } = attempt;
            await api(`/api/achievements/${id}`, {
              method: "POST",
              body: JSON.stringify(payload),
            });
            setPending(null);
            router.push(`/studies/achievements/${id}`);
            router.refresh();
          } else {
            const item = await save(form);
            setNotice("Черновик сохранён.");
            router.replace(`/studies/achievements/${item.id}`, {
              scroll: false,
            });
          }
        } catch (e) {
          if (e instanceof ApiError) {
            setPending(null);
            submitKey.current = "";
          }
          setError(
            e instanceof Error
              ? e.message
              : "Не удалось сохранить. Повторите отправку.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy || !!pending} className={ui.fieldset}>
        <label>
          Название
          <input
            name="title"
            required
            maxLength={180}
            defaultValue={initial?.title}
          />
        </label>
        <div className={ui.grid2}>
          <label>
            Категория
            <select name="category" defaultValue={initial?.category ?? "Учёба"}>
              {achievementCategories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Дата
            <input
              name="date"
              type="date"
              required
              defaultValue={initial?.date ?? dateKey()}
            />
          </label>
        </div>
        <label>
          Описание
          <textarea
            name="description"
            maxLength={2000}
            defaultValue={initial?.description}
          />
        </label>
        <label>
          Организатор
          <input
            name="organizer"
            maxLength={200}
            defaultValue={initial?.organizer}
          />
        </label>
        <label>
          Соавторы, необязательно
          <input
            name="coauthors"
            maxLength={500}
            defaultValue={initial?.coauthors}
          />
        </label>
        <label>
          Подтверждающая HTTPS-ссылка
          <input
            type="url"
            name="evidenceUrl"
            defaultValue={initial?.evidenceUrl ?? ""}
            placeholder="https://"
          />
        </label>
        {identity ? (
          <FileUpload
            purpose="ACHIEVEMENT_EVIDENCE"
            resourceId={identity.id}
            onUploaded={() => {
              setNotice("Подтверждение загружено.");
              router.refresh();
            }}
          />
        ) : (
          <p className={ui.caption}>
            Сохраните черновик, чтобы приложить PDF вместо ссылки.
          </p>
        )}
      </fieldset>
      {pending && (
        <p className={ui.alert}>
          Отправка не подтверждена. Повторите её с теми же данными.
        </p>
      )}
      {notice && (
        <p role="status" className={ui.success}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <div className={ui.row}>
        <Button name="intent" value="draft" disabled={busy || !!pending}>
          Сохранить черновик
        </Button>
        <Button name="intent" value="submit" variant="primary" disabled={busy}>
          {busy
            ? "Сохраняем…"
            : initial?.status === "NEEDS_INFO"
              ? "Отправить уточнение"
              : "Отправить на проверку"}
        </Button>
      </div>
    </form>
  );
}
