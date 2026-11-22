"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import s from "./login.module.css";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  return (
    <form
      className={`${ui.card} ${s.form}`}
      aria-labelledby={titleId}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          await api("/api/auth/sign-in/email", {
            method: "POST",
            body: JSON.stringify({
              email: data.get("email"),
              password: data.get("password"),
            }),
          });
          router.push("/");
          router.refresh();
        } catch (error) {
          setError(
            error instanceof Error ? error.message : "Не удалось войти.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className={s.formTitle} id={titleId}>
        Личный кабинет студента
      </h2>
      <label className={s.field}>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder=" "
        />
        <span className={s.fieldLabel}>Логин</span>
      </label>
      <label className={s.field}>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder=" "
        />
        <span className={s.fieldLabel}>Пароль</span>
      </label>
      {error && (
        <p className={`${ui.alert} ${ui.error}`} role="alert">
          {error === "Invalid email or password"
            ? "Неверный логин или пароль."
            : error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Входим…" : "Войти в кабинет"}
      </Button>
      <p className={s.note}>
        Для входа используйте выданную демонстрационную учётную запись.
      </p>
    </form>
  );
}
