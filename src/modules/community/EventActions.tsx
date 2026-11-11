"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CalendarPlus, Check } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
export function EventActions({
  id,
  saved,
  inCalendar,
}: {
  id: string;
  saved: boolean;
  inCalendar: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = async (data: Record<string, boolean>) => {
    setBusy(true);
    try {
      await api(`/api/community/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setError("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.stack}>
      <div className={ui.row}>
        <Button disabled={busy} onClick={() => update({ saved: !saved })}>
          <Bookmark size={16} />
          {saved ? "Убрать из сохранённых" : "Сохранить событие"}
        </Button>
        <Button
          disabled={busy}
          variant={inCalendar ? "default" : "primary"}
          onClick={() => update({ inCalendar: !inCalendar })}
        >
          {inCalendar ? <Check size={16} /> : <CalendarPlus size={16} />}{" "}
          {inCalendar
            ? "В моём календаре · убрать"
            : "Добавить в мой календарь"}
        </Button>
      </div>
      <p className={ui.caption}>
        Сохранение и добавление в календарь не являются регистрацией или
        подтверждением участия.
      </p>
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
