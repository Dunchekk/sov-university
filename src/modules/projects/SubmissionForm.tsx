"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/shared/ui/FileUpload";
import { Button, ui } from "@/shared/ui/primitives";
import { api, operationKey } from "@/shared/lib/client";
export function SubmissionForm({
  id,
  version,
  uploads,
}: {
  id: string;
  version: number;
  uploads: { id: string; originalName: string }[];
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(uploads),
    [fileId, setFileId] = useState(uploads[0]?.id ?? ""),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef("");
  return (
    <form
      className={ui.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          key.current ||= operationKey();
          await api(`/api/projects/${id}/submit`, {
            method: "POST",
            body: JSON.stringify({
              fileId,
              comment,
              version,
              key: key.current,
            }),
          });
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Не удалось отправить.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileUpload
        purpose="PROJECT_UPLOAD"
        resourceId={id}
        onUploaded={(file) => {
          setFileId(file.id);
          setAvailable((v) => [...v, file]);
          key.current = "";
        }}
      />
      {available.length > 0 && (
        <div className={ui.stack}>
          <label>
            Загруженный отчёт
            <select
              value={fileId}
              onChange={(e) => {
                setFileId(e.target.value);
                key.current = "";
              }}
            >
              {available.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.originalName}
                </option>
              ))}
            </select>
          </label>
          {available.map((f) => (
            <div className={ui.between} key={f.id}>
              <a className={ui.link} href={`/api/files/${f.id}`}>
                {f.originalName}
              </a>
              <Button
                type="button"
                small
                onClick={async () => {
                  try {
                    await api(`/api/files/${f.id}`, { method: "DELETE" });
                    setAvailable((v) => v.filter((i) => i.id !== f.id));
                    if (fileId === f.id)
                      setFileId(available.find((i) => i.id !== f.id)?.id ?? "");
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Не удалось удалить.",
                    );
                  }
                }}
              >
                Удалить неотправленный файл
              </Button>
            </div>
          ))}
        </div>
      )}
      <label>
        Комментарий к версии
        <textarea
          value={comment}
          maxLength={2000}
          onChange={(e) => {
            setComment(e.target.value);
            key.current = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <Button variant="primary" disabled={!fileId || busy}>
        {busy ? "Отправляем…" : "Отправить версию отчёта"}
      </Button>
      <p className={ui.caption}>
        Версия сохраняется в демонстрационную систему. Проверка, оценка и
        процент оригинальности не генерируются.
      </p>
    </form>
  );
}
