"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import s from "./profile.module.css";

type Details = { contactEmail: string; document: string; address: string };

export function PrivateDetails({ kind }: { kind: "contacts" | "documents" }) {
  const detailsId = useId();
  const [data, setData] = useState<Details | null>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const open = data !== undefined;
  const contacts = kind === "contacts";
  const title = contacts ? "Личный email" : "Документы и адрес";
  const action = open ? "Скрыть" : "Показать";

  async function toggle() {
    if (open) {
      setData(undefined);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      setData(await api<Details | null>("/api/me/private-details"));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.privateRow}>
      <div className={s.privateHeader}>
        <h3>{title}</h3>
        <Button
          type="button"
          small
          disabled={busy}
          aria-expanded={open}
          aria-controls={detailsId}
          aria-label={`${busy ? "Загружаем" : action} ${title.toLowerCase()}`}
          onClick={toggle}
        >
          {open ? (
            <EyeOff size={15} aria-hidden />
          ) : (
            <Eye size={15} aria-hidden />
          )}
          {busy ? "Загружаем…" : action}
        </Button>
      </div>
      <div id={detailsId} className={s.privateBody} hidden={!open}>
        {data === null && <p className={ui.muted}>Сведения не указаны.</p>}
        {data &&
          (contacts ? (
            <p>{data.contactEmail}</p>
          ) : (
            <dl>
              <div>
                <dt>Демонстрационный документ</dt>
                <dd>{data.document}</dd>
              </div>
              <div>
                <dt>Адрес</dt>
                <dd>{data.address}</dd>
              </div>
            </dl>
          ))}
      </div>
      {error && (
        <p role="alert" className={`${ui.error} ${s.privateError}`}>
          Не удалось загрузить сведения. Попробуйте ещё раз.
        </p>
      )}
    </div>
  );
}
