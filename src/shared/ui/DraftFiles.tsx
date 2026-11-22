"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "./primitives";
import { api } from "@/shared/lib/client";
export function DraftFiles({
  files,
  editable,
}: {
  files: { id: string; originalName: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className={ui.stack}>
      {files.map((file) => (
        <div key={file.id} className={ui.between}>
          <a className={ui.link} href={`/api/files/${file.id}`}>
            {file.originalName}
          </a>
          {editable && (
            <Button
              small
              aria-label={`Удалить вложение «${file.originalName}»`}
              onClick={async () => {
                try {
                  await api(`/api/files/${file.id}`, { method: "DELETE" });
                  router.refresh();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Не удалось удалить файл.",
                  );
                }
              }}
            >
              Удалить вложение
            </Button>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
    </div>
  );
}
