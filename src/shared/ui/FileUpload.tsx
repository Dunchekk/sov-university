"use client";
import { useState, useRef } from "react";
import { Upload, FileText } from "lucide-react";
import { api } from "@/shared/lib/client";
import { ui } from "./primitives";
export function FileUpload({
  purpose,
  resourceId,
  onUploaded,
}: {
  purpose: "REQUEST_ATTACHMENT" | "PROJECT_UPLOAD" | "ACHIEVEMENT_EVIDENCE";
  resourceId: string;
  onUploaded: (file: { id: string; originalName: string }) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={ui.stack}>
      <label>
        <span className={ui.row}>
          <Upload size={17} />
          Прикрепить PDF
        </span>
        <input
          ref={input}
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            if (file.size > 10 * 1024 * 1024) {
              setError("Максимальный размер PDF — 10 MiB.");
              return;
            }
            setBusy(true);
            const data = new FormData();
            data.set("file", file);
            data.set("purpose", purpose);
            data.set("resourceId", resourceId);
            try {
              const result = await api<{ id: string; originalName: string }>(
                "/api/files",
                { method: "POST", body: data },
              );
              setName(result.originalName);
              onUploaded(result);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Не удалось загрузить файл.",
              );
            } finally {
              setBusy(false);
              if (input.current) input.current.value = "";
            }
          }}
        />
      </label>
      <small className={ui.caption}>
        {busy
          ? "Загружаем…"
          : "PDF до 10 MiB. Общий лимит — 50 MiB. Только демонстрационные документы."}
      </small>
      {name && (
        <p className={ui.row}>
          <FileText size={16} />
          {name} · загружен
        </p>
      )}
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
    </div>
  );
}
