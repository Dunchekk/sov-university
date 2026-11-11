"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { Dialog } from "@/shared/ui/Dialog";
import { FileUpload } from "@/shared/ui/FileUpload";
import { api, ApiError, operationKey } from "@/shared/lib/client";
import { defaultFields, fieldsSchema, type FormField } from "./forms";
type Option = { value: string; label: string };
export function RequestForm({
  slug,
  title,
  student,
  definitions,
  options = {},
  initial,
  draft,
  files = [],
}: {
  slug: string;
  title: string;
  student: { name: string; program: string; group: string };
  definitions: FormField[];
  options?: Record<string, Option[]>;
  initial?: Record<string, unknown>;
  draft?: { id: string; version: number };
  files?: { id: string; originalName: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>({
      ...defaultFields(slug),
      ...initial,
    }),
    [identity, setIdentity] = useState(draft),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [savedValues, setSavedValues] = useState<Record<string, unknown>>({}),
    [notice, setNotice] = useState(""),
    [attachments, setAttachments] = useState(files);
  const createKey = useRef(""),
    submitKey = useRef("");
  const form = useRef<HTMLFormElement>(null);
  const set = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setNotice("");
    submitKey.current = "";
  };
  const report = (e: unknown) => {
    setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    if (e instanceof ApiError) setErrors(e.fields);
  };
  const save = async () => {
    const clean = fieldsSchema(slug, true).parse(values);
    let result: { id: string; version: number };
    if (identity)
      result = await api(`/api/requests/${identity.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields: clean, version: identity.version }),
      });
    else {
      createKey.current ||= operationKey();
      result = await api("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          serviceSlug: slug,
          fields: clean,
          key: createKey.current,
        }),
      });
    }
    setIdentity(result);
    setSavedValues(clean);
    return result;
  };
  const validate = () => {
    const checked = fieldsSchema(slug).safeParse(values);
    if (!checked.success) {
      const fields = checked.error.flatten().fieldErrors as Record<
        string,
        string[]
      >;
      setErrors(fields);
      setError("Проверьте выделенные поля.");
      form.current
        ?.querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)
        ?.focus();
      return false;
    }
    setErrors({});
    setError("");
    return true;
  };
  return (
    <>
      <form
        ref={form}
        className={ui.form}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!validate()) return;
          setBusy(true);
          try {
            await save();
            setPreview(true);
          } catch (e) {
            report(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className={ui.fieldset}>
          <div className={ui.alert}>
            <div>
              <h3>{student.name}</h3>
              <p className={ui.caption}>
                {student.program} · {student.group}
              </p>
              <small>Учебные данные заполняются автоматически.</small>
            </div>
          </div>
          {definitions
            .filter((f) => !f.when || values[f.when.key] === f.when.value)
            .map((f) => {
              const opts = options[f.key] ?? f.options ?? [];
              const controlProps = {
                name: f.key,
                id: `field-${f.key}`,
                "aria-invalid": !!errors[f.key],
                "aria-describedby": errors[f.key]
                  ? `error-${f.key}`
                  : undefined,
              };
              return (
                <div key={f.key}>
                  <label htmlFor={`field-${f.key}`}>{f.label}</label>
                  {f.type === "textarea" ? (
                    <textarea
                      {...controlProps}
                      value={String(values[f.key] ?? "")}
                      maxLength={2000}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <select
                      {...controlProps}
                      value={String(values[f.key] ?? "")}
                      onChange={(e) => set(f.key, e.target.value)}
                    >
                      {!f.options && <option value="">Выберите…</option>}
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <input
                      {...controlProps}
                      type="checkbox"
                      checked={!!values[f.key]}
                      onChange={(e) => set(f.key, e.target.checked)}
                    />
                  ) : f.type === "achievements" ? (
                    <div className={ui.stack}>
                      {opts.length ? (
                        opts.map((o) => (
                          <label key={o.value} className={ui.row}>
                            <input
                              name={f.key}
                              type="checkbox"
                              value={o.value}
                              checked={(
                                (values[f.key] as string[]) ?? []
                              ).includes(o.value)}
                              onChange={(e) =>
                                set(
                                  f.key,
                                  e.target.checked
                                    ? [
                                        ...((values[f.key] as string[]) ?? []),
                                        o.value,
                                      ]
                                    : (
                                        (values[f.key] as string[]) ?? []
                                      ).filter((v) => v !== o.value),
                                )
                              }
                            />
                            {o.label}
                          </label>
                        ))
                      ) : (
                        <p className={ui.caption}>
                          Подтверждённых достижений пока нет.
                        </p>
                      )}
                    </div>
                  ) : (
                    <input
                      {...controlProps}
                      type={f.type}
                      min={f.type === "number" ? 1 : undefined}
                      max={f.type === "number" ? 10 : undefined}
                      maxLength={200}
                      value={String(values[f.key] ?? "")}
                      onChange={(e) =>
                        set(
                          f.key,
                          f.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                        )
                      }
                    />
                  )}
                  {errors[f.key] && (
                    <p id={`error-${f.key}`} className={ui.fieldError}>
                      {errors[f.key].join(" ")}
                    </p>
                  )}
                </div>
              );
            })}
          {identity && (
            <div className={ui.stack}>
              <FileUpload
                resourceId={identity.id}
                purpose="REQUEST_ATTACHMENT"
                onUploaded={(file) => setAttachments((v) => [...v, file])}
              />
              {attachments.map((file) => (
                <div className={ui.between} key={file.id}>
                  <a className={ui.link} href={`/api/files/${file.id}`}>
                    {file.originalName}
                  </a>
                  <Button
                    type="button"
                    small
                    onClick={async () => {
                      try {
                        await api(`/api/files/${file.id}`, {
                          method: "DELETE",
                        });
                        setAttachments((v) =>
                          v.filter((f) => f.id !== file.id),
                        );
                      } catch (e) {
                        report(e);
                      }
                    }}
                  >
                    Удалить вложение
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!identity && (
            <p className={ui.caption}>
              Чтобы приложить PDF, сначала сохраните черновик.
            </p>
          )}
          {error && (
            <p role="alert" className={`${ui.alert} ${ui.error}`}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className={ui.success}>
              {notice}
            </p>
          )}
          <div className={ui.row}>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await save();
                  setNotice("Черновик сохранён на сервере.");
                  window.history.replaceState(
                    null,
                    "",
                    `/services/${slug}?draft=${result.id}`,
                  );
                } catch (e) {
                  report(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Сохранить черновик
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Сохраняем…" : "Проверить и отправить"}
            </Button>
          </div>
        </fieldset>
      </form>
      <Dialog
        open={preview}
        onClose={() => setPreview(false)}
        title="Проверьте обращение"
      >
        <div className={ui.stack}>
          <h3>{title}</h3>
          <p>
            {student.name} · {student.group}
          </p>
          {definitions
            .filter((f) => !f.when || savedValues[f.when.key] === f.when.value)
            .map((f) => (
              <div key={f.key}>
                <small className={ui.muted}>{f.label}</small>
                <p>
                  {Array.isArray(savedValues[f.key])
                    ? (savedValues[f.key] as string[])
                        .map(
                          (id) =>
                            options[f.key]?.find((o) => o.value === id)
                              ?.label ?? id,
                        )
                        .join(", ")
                    : typeof savedValues[f.key] === "boolean"
                      ? savedValues[f.key]
                        ? "Подтверждено"
                        : "Нет"
                      : ((options[f.key] ?? f.options)?.find(
                          (o) => o.value === savedValues[f.key],
                        )?.label ?? String(savedValues[f.key] ?? "—"))}
                </p>
              </div>
            ))}
          <p className={ui.caption}>
            После отправки обращение будет принято в демонстрационную систему.
            Решение не принимается автоматически.
          </p>
          {error && (
            <p role="alert" className={ui.error}>
              {error}
            </p>
          )}
          <Button
            variant="primary"
            disabled={busy}
            onClick={async () => {
              if (!identity) return;
              setBusy(true);
              try {
                submitKey.current ||= operationKey();
                await api(`/api/requests/${identity.id}`, {
                  method: "POST",
                  body: JSON.stringify({
                    action: "submit",
                    version: identity.version,
                    key: submitKey.current,
                  }),
                });
                router.push(`/requests/${identity.id}`);
                router.refresh();
              } catch (e) {
                report(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Отправляем…" : "Отправить обращение"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
