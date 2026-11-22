"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { api } from "@/shared/lib/client";
import { Button, ui } from "@/shared/ui/primitives";
import { avatarEndpoint, avatarFormats, avatarMaxBytes } from "./avatar";
import s from "./profile.module.css";

export function ProfileAvatarActions({
  hasPhoto,
  portrait,
  children,
}: {
  hasPhoto: boolean;
  portrait: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<"POST" | "DELETE" | null>(null);
  const [error, setError] = useState("");
  const [refreshing, startTransition] = useTransition();
  const busy = saving !== null || refreshing;

  async function saveAvatar(method: "POST" | "DELETE", body?: FormData) {
    setError("");
    setSaving(method);
    try {
      await api(avatarEndpoint, { method, body });
      startTransition(() => router.refresh());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : method === "DELETE"
            ? "Не удалось удалить фото."
            : "Не удалось загрузить фото.",
      );
    } finally {
      setSaving(null);
    }
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > avatarMaxBytes) {
      setError("Максимальный размер фото — 5 МБ.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    void saveAvatar("POST", body);
  }

  return (
    <>
      <div className={s.portrait}>
        {portrait}
        {hasPhoto && (
          <Button
            type="button"
            className={s.removeAvatar}
            small
            aria-label="Удалить фото"
            title="Удалить фото"
            disabled={busy}
            onClick={() => void saveAvatar("DELETE")}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        )}
      </div>
      <nav className={s.actions} aria-label="Действия профиля">
        <div className={s.avatarControl}>
          <input
            ref={input}
            type="file"
            aria-label="Файл аватарки"
            accept={Object.keys(avatarFormats).join(",")}
            onChange={upload}
            disabled={busy}
            hidden
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Camera size={16} aria-hidden />
            {saving === "POST"
              ? "Сохраняем фото…"
              : hasPhoto
                ? "Изменить фото"
                : "Загрузить фото"}
          </Button>
          {error && (
            <p role="alert" className={`${ui.caption} ${ui.error}`}>
              {error}
            </p>
          )}
        </div>
        {children}
      </nav>
    </>
  );
}
