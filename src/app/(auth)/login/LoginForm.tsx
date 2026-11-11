"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import s from "./login.module.css";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={s.form}
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
      <div>
        <h1>С возвращением</h1>
        <p className={ui.muted}>Войдите в свой студенческий кабинет</p>
      </div>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="student@example.org"
        />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
        />
      </label>
      {error && (
        <p className={`${ui.alert} ${ui.error}`} role="alert">
          {error === "Invalid email or password"
            ? "Неверный email или пароль."
            : error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={busy}>
        {busy ? "Входим…" : "Войти в кабинет"}
      </Button>
      <p className={s.note}>
        Регистрация закрыта. Для входа используйте выданный демонстрационный
        аккаунт.
      </p>
    </form>
  );
}
