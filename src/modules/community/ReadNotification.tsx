"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
export function ReadNotification({ id }: { id?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <Button
        small
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/notifications", {
              method: "POST",
              body: JSON.stringify(id ? { id } : { all: true }),
            });
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
      {error && (
        <small role="alert" className={ui.error}>
          {error}
        </small>
      )}
    </div>
  );
}
