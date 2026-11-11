"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import { Button, Card, ui } from "@/shared/ui/primitives";
import { api } from "@/shared/lib/client";
import { brand } from "@/shared/config/brand";
export function Settings({
  initial,
  schedules,
}: {
  initial: {
    theme: string;
    calendarView: string;
    notifications: Record<string, boolean>;
  };
  schedules: { id: string; kind: string; targetId: string; label: string }[];
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(initial.theme),
    [view, setView] = useState(initial.calendarView),
    [notifications, setNotifications] = useState(initial.notifications),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme:dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const save = async (values: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/me/preferences", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setMessage("Настройки сохранены.");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={ui.stack}>
      <Card>
        <div className={ui.stack}>
          <h2>Внешний вид</h2>
          <p className={ui.muted}>
            Выберите комфортную тему. Настройка сохраняется в вашем аккаунте.
          </p>
          <div className={ui.row}>
            {[
              ["light", "Светлая", Sun],
              ["dark", "Тёмная", Moon],
              ["system", "Как в системе", Monitor],
            ].map(([id, label, Icon]) => {
              const Symbol = Icon as typeof Sun;
              return (
                <Button
                  key={id as string}
                  variant={theme === id ? "primary" : "default"}
                  aria-pressed={theme === id}
                  disabled={busy}
                  onClick={async () => {
                    if (await save({ theme: id })) setTheme(id as string);
                  }}
                >
                  <Symbol size={17} />
                  {label as string}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>
      <Card>
        <div className={ui.stack}>
          <h2>Календарь</h2>
          <label>
            Начальный вид
            <select
              value={view}
              disabled={busy}
              onChange={async (e) => {
                const next = e.target.value;
                if (await save({ calendarView: next })) setView(next);
              }}
            >
              <option value="day">День</option>
              <option value="week">Неделя</option>
              <option value="month">Месяц</option>
            </select>
          </label>
          <h3>Избранные расписания</h3>
          {schedules.length ? (
            schedules.map((s) => (
              <div key={s.id} className={ui.between}>
                <Link
                  href={`/calendar?schedules=${s.kind}:${s.targetId}`}
                  className={ui.link}
                >
                  {s.label}
                </Link>
                <Button
                  small
                  onClick={async () => {
                    try {
                      await api("/api/schedules/saved", {
                        method: "DELETE",
                        body: JSON.stringify({
                          kind: s.kind,
                          targetId: s.targetId,
                        }),
                      });
                      router.refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Не удалось убрать расписание.",
                      );
                    }
                  }}
                >
                  Убрать
                </Button>
              </div>
            ))
          ) : (
            <p className={ui.muted}>
              Добавляйте расписания из сравнения в календаре.
            </p>
          )}
          <Link className={ui.link} href="/calendar/integrations">
            Управление календарными подписками →
          </Link>
        </div>
      </Card>
      <Card>
        <div className={ui.stack}>
          <h2>Уведомления внутри кабинета</h2>
          {[
            ["SCHEDULE", "Изменения расписания"],
            ["STUDY", "Учёба и работы"],
            ["REQUEST", "Обращения"],
            ["COMMUNITY", "События и кампании"],
          ].map(([id, label]) => (
            <label key={id} className={ui.row}>
              <input
                type="checkbox"
                disabled={busy}
                checked={notifications[id] !== false}
                onChange={async (e) => {
                  const next = { ...notifications, [id]: e.target.checked };
                  if (await save({ notifications: next }))
                    setNotifications(next);
                }}
              />
              {label}
            </label>
          ))}
          <p className={ui.caption}>
            Настройки относятся к новым уведомлениям. История сохраняется.
            Подключён только канал внутри кабинета.
          </p>
        </div>
      </Card>
      {message && (
        <p role="status" className={ui.success}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className={ui.error}>
          {error}
        </p>
      )}
      <Card>
        <div className={ui.between}>
          <div>
            <h2>{brand.name}</h2>
            <p className={ui.caption}>{brand.disclaimer}</p>
          </div>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await api("/api/auth/sign-out", { method: "POST", body: "{}" });
                router.push("/login");
                router.refresh();
              } catch {
                setError("Не удалось выйти. Повторите попытку.");
              }
            }}
          >
            <LogOut size={16} />
            Выйти из кабинета
          </Button>
        </div>
      </Card>
    </div>
  );
}
