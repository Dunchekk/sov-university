"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
export function ReadNotification({
  id,
  title,
}: {
  id?: string;
  title?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <div>
      <Button
        small
        aria-label={title ? `Прочитать уведомление «${title}»` : undefined}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setMessage("");
          try {
            await api("/api/notifications", {
              method: "POST",
              body: JSON.stringify(id ? { id } : { all: true }),
            });
            setMessage(
              id ? "Уведомление прочитано." : "Все уведомления прочитаны.",
            );
            router.refresh();
          } catch {
            setError("Не удалось сохранить.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {id ? "Прочитать" : "Прочитать все"}
      </Button>
      <span role="status" className={ui.srOnly}>
        {message}
      </span>
      {error && (
        <small role="alert" className={ui.error}>
          {error}
        </small>
      )}
    </div>
  );
}
