"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
export function PrivateDetails({ kind }: { kind: "contacts" | "documents" }) {
  const [data, setData] = useState<{
      contactEmail: string;
      document: string;
      address: string;
    } | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className={ui.stack}>
      <div className={ui.between}>
        <h2>
          {kind === "contacts" ? "Личные контакты" : "Документы и сведения"}
        </h2>
        <Button
          small
          disabled={busy}
          onClick={async () => {
            if (open) {
              setOpen(false);
              setData(null);
              return;
            }
            setBusy(true);
            try {
              setData(await api("/api/me/private-details"));
              setOpen(true);
              setError("");
            } catch {
              setError("Не удалось загрузить сведения.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {open ? <EyeOff size={15} /> : <Eye size={15} />}{" "}
          {busy ? "Загружаем…" : open ? "Скрыть" : "Показать"}
        </Button>
      </div>
      {open && data ? (
        <div>
          {kind === "contacts" ? (
            <>
              <small className={ui.caption}>Личный email</small>
              <p>{data.contactEmail}</p>
            </>
          ) : (
            <>
              <small className={ui.caption}>Демонстрационный документ</small>
              <p>{data.document}</p>
              <p className={ui.muted}>{data.address}</p>
            </>
          )}
        </div>
      ) : (
        <p className={ui.caption}>
          Сведения скрыты. Они загружаются только после нажатия «Показать» и
          доступны только вам.
        </p>
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
