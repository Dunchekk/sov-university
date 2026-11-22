"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { Dialog } from "@/shared/ui/Dialog";
import { FileUpload } from "@/shared/ui/FileUpload";
import { api, operationKey } from "@/shared/lib/client";
export function RequestActions({
  id,
  slug,
  status,
  version,
  cancellable,
}: {
  id: string;
  slug: string;
  status: string;
  version: number;
  cancellable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [text, setText] = useState("");
  const key = useRef("");
  const action = async (name: string) => {
    setBusy(true);
    setError("");
    try {
      key.current ||= operationKey();
      const result = await api<{ id: string }>(`/api/requests/${id}`, {
        method: "POST",
        body: JSON.stringify({
          action: name,
          version,
          key: key.current,
          ...(["respond", "comment"].includes(name) ? { text } : {}),
        }),
      });
      key.current = "";
      if (name === "clone") router.push(`/services/${slug}?draft=${result.id}`);
      else if (name === "delete") router.push("/services?tab=requests");
      else {
        setText("");
        setConfirm(false);
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.stack}>
      <div className={ui.row}>
        {status === "SUBMITTED" && cancellable && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Отозвать обращение
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => setConfirm(true)}
          >
            Удалить черновик
          </Button>
        )}
        <Button disabled={busy} onClick={() => action("clone")}>
          Создать на основе этого
        </Button>
      </div>
      {["NEEDS_INFO", "SUBMITTED", "IN_REVIEW", "READY"].includes(status) && (
        <form
          className={ui.form}
          aria-label={
            status === "NEEDS_INFO"
              ? "Ответ на запрос уточнения"
              : "Комментарий к обращению"
          }
          onSubmit={(e) => {
            e.preventDefault();
            void action(status === "NEEDS_INFO" ? "respond" : "comment");
          }}
        >
          <label>
            {status === "NEEDS_INFO"
              ? "Ответ на запрос уточнения"
              : "Комментарий"}
            <textarea
              required
              minLength={3}
              maxLength={2000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                key.current = "";
              }}
            />
          </label>
          {status === "NEEDS_INFO" && (
            <FileUpload
              purpose="REQUEST_ATTACHMENT"
              resourceId={id}
              onUploaded={() => router.refresh()}
            />
          )}
          <Button variant="primary" disabled={busy}>
            {busy
              ? "Отправляем…"
              : status === "NEEDS_INFO"
                ? "Отправить уточнение"
                : "Добавить комментарий"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={status === "DRAFT" ? "Удалить черновик?" : "Отозвать обращение?"}
      >
        <p>
          {status === "DRAFT"
            ? "Черновик будет удалён. Сначала удалите его вложения в форме."
            : "Рассмотрение прекратится. При необходимости можно создать новое обращение."}
        </p>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => action(status === "DRAFT" ? "delete" : "cancel")}
        >
          Подтвердить
        </Button>
      </Dialog>
    </div>
  );
}
