"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Upload, Link2, Trash2 } from "lucide-react";
import { Button, Card, Empty, ui } from "@/shared/ui/primitives";
import { CopyButton } from "@/shared/ui/CopyButton";
import { Dialog } from "@/shared/ui/Dialog";
import { api } from "@/shared/lib/client";
import { addDays, formatDate } from "@/shared/lib/time";
import { eventTypes, eventLabels, type EventType } from "./types";
import type { previewImport } from "./integrations";
import {
  CalendarDateField,
  formatCalendarDate,
  parseCalendarDate,
} from "./CalendarDateField";
import s from "./calendar.module.css";

type Source = { id: string; name: string; count: number };
type Feed = { id: string; name: string; layers: string[]; createdAt: string };
const defaults: EventType[] = ["LESSON", "EXAM", "DEADLINE"];
function Layers({
  value,
  onChange,
}: {
  value: EventType[];
  onChange: (v: EventType[]) => void;
}) {
  return (
    <fieldset className={ui.fieldset}>
      <legend>Что включить</legend>
      <div className={ui.row}>
        {eventTypes.map((type) => (
          <label className={ui.row} key={type}>
            <input
              type="checkbox"
              checked={value.includes(type)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, type]
                    : value.filter((x) => x !== type),
                )
              }
            />
            {type === "PERSONAL"
              ? "Личное и импортированное"
              : eventLabels[type]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function ExportPanel({ today }: { today: string }) {
  const [from, setFrom] = useState(formatCalendarDate(today)),
    [through, setThrough] = useState(formatCalendarDate(addDays(today, 6))),
    [layers, setLayers] = useState(defaults),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function download(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({
        from: parseCalendarDate(from),
        to: addDays(parseCalendarDate(through), 1),
        types: layers.join(","),
      });
      const response = await fetch(`/api/calendar/export.ics?${query}`);
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message ??
            "Не удалось скачать календарь.",
        );
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "ryadom-calendar.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось скачать.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={ui.stack} onSubmit={download}>
      <h2>Забрать события с собой</h2>
      <p className={ui.muted}>
        Скачайте файл и откройте в любимом календаре. Это снимок выбранных
        событий — изменения в нём не появятся автоматически.
      </p>
      <div className={ui.row}>
        {[
          ["Неделя", 6],
          ["Месяц", 29],
          ["Семестр", 179],
        ].map(([label, length]) => (
          <Button
            key={label}
            type="button"
            small
            onClick={() => {
              setFrom(formatCalendarDate(today));
              setThrough(formatCalendarDate(addDays(today, Number(length))));
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className={ui.grid2}>
        <CalendarDateField
          label="С"
          today={today}
          value={from}
          onChange={setFrom}
        />
        <CalendarDateField
          label="По"
          today={today}
          value={through}
          onChange={setThrough}
          min={parseCalendarDate(from) || undefined}
        />
      </div>
      <Layers value={layers} onChange={setLayers} />
      <p className={ui.caption}>
        Оценки, посещаемость, участники и личные сведения не экспортируются.
        Диапазон — до 12 месяцев.
      </p>
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <div>
        <Button variant="primary" disabled={busy || !layers.length}>
          <Download size={17} />
          {busy ? "Готовим файл…" : "Скачать календарь"}
        </Button>
      </div>
    </form>
  );
}
function ImportPanel({
  today,
  sources,
  onChanged,
}: {
  today: string;
  sources: Source[];
  onChanged: () => void;
}) {
  const [from, setFrom] = useState(formatCalendarDate(today));
  const [through, setThrough] = useState(
    formatCalendarDate(addDays(today, 179)),
  );
  const [preview, setPreview] = useState<Awaited<
      ReturnType<typeof previewImport>
    > | null>(null),
    [replace, setReplace] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [source, setSource] = useState("");
  async function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set("to", addDays(String(form.get("to")), 1));
    setBusy(true);
    setError("");
    setMessage("");
    setReplace(false);
    try {
      setPreview(
        await api("/api/calendar/imports/preview", {
          method: "POST",
          body: form,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось прочитать файл.");
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{
        added: number;
        updated: number;
        unchanged: number;
        removed: number;
      }>(`/api/calendar/imports/${preview.id}/commit`, {
        method: "POST",
        body: JSON.stringify({ replace }),
      });
      setMessage(
        `Импорт завершён: добавлено ${result.added}, обновлено ${result.updated}, без изменений ${result.unchanged}${result.removed ? `, отменено ${result.removed}` : ""}.`,
      );
      setPreview(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось импортировать.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={ui.stack}>
      <form onSubmit={prepare} className={ui.stack}>
        <h2>Собрать планы в одном месте</h2>
        <p className={ui.muted}>
          Загрузите ICS из другого календаря. Сначала покажем предпросмотр,
          затем сохраним события в отдельный личный слой.
        </p>
        <fieldset disabled={busy} className={ui.fieldset}>
          <label>
            Файл ICS
            <input
              type="file"
              name="file"
              accept=".ics,text/calendar"
              required
            />
          </label>
          <div className={ui.grid2}>
            <label>
              Куда импортировать
              <select
                name="sourceId"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Новый слой</option>
                {sources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Название слоя
              <input
                name="name"
                required
                maxLength={100}
                defaultValue="Мои планы"
              />
            </label>
            <CalendarDateField
              label="С"
              name="from"
              today={today}
              value={from}
              onChange={setFrom}
            />
            <CalendarDateField
              label="По"
              name="to"
              today={today}
              value={through}
              onChange={setThrough}
              min={parseCalendarDate(from) || undefined}
            />
          </div>
          <label>
            Часовой пояс для времени без зоны
            <span className={s.timezoneField}>
              <input
                name="timezone"
                required
                defaultValue="Europe/Moscow"
                list="timezones"
              />
              <ChevronDown size={17} aria-hidden="true" />
            </span>
            <datalist id="timezones">
              <option>Europe/Moscow</option>
              <option>Europe/Berlin</option>
              <option>Asia/Yekaterinburg</option>
              <option>Asia/Novosibirsk</option>
              <option>America/New_York</option>
              <option>UTC</option>
            </datalist>
          </label>
          <p className={ui.caption}>
            До 5 MiB, 2000 исходных событий и 10000 повторений за период до 12
            месяцев. Повторная загрузка в тот же слой обновляет совпадающие
            события без дублей.
          </p>
          <div>
            <Button variant="primary">
              <Upload size={17} />
              {busy ? "Разбираем файл…" : "Посмотреть перед импортом"}
            </Button>
          </div>
        </fieldset>
      </form>
      {error && !preview && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={ui.alert}>
          {message}
        </p>
      )}
      <Dialog
        open={!!preview}
        dismissible={!busy}
        onClose={() => {
          if (!busy) setPreview(null);
        }}
        title="Предпросмотр импорта"
      >
        {preview && (
          <div className={ui.stack}>
            <p>
              <strong>{preview.name}</strong> · {preview.from} —{" "}
              {addDays(preview.to, -1)}
            </p>
            <p>
              Найдено {preview.total} вхождений: новых {preview.added},
              обновлений {preview.updated}, без изменений {preview.unchanged}.
              Повторов в файле: {preview.duplicates}.
            </p>
            <p className={ui.caption}>
              Подтвердите до{" "}
              {formatDate(preview.expiresAt, {
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Исходный файл временный и будет удалён.
            </p>
            {preview.warnings.length > 0 && (
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className={ui.list}>
              {preview.sample.map((item, index) => (
                <div className={ui.listItem} key={index}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className={ui.caption}>
                      {item.startDate ??
                        formatDate(item.startsAt!, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      {item.cancelled ? " · отменено" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {source && (
              <label className={ui.row}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                Заменить весь слой: отменить все старые события, которых нет в
                этом предпросмотре, в том числе вне выбранного периода
              </label>
            )}
            {error && (
              <p role="alert" className={`${ui.alert} ${ui.error}`}>
                {error}
              </p>
            )}
            <Button variant="primary" disabled={busy} onClick={commit}>
              {busy ? "Сохраняем…" : "Подтвердить импорт"}
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
function FeedPanel({
  feeds,
  publicAddress,
  onChanged,
}: {
  feeds: Feed[];
  publicAddress: boolean;
  onChanged: () => void;
}) {
  const [layers, setLayers] = useState(defaults),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Feed | null>(null);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ url: string }>("/api/calendar/feeds", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), layers }),
      });
      setSecret(result.url);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать ссылку.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={ui.stack}>
      <form onSubmit={create} className={ui.stack}>
        <h2>Календарь, который обновляется</h2>
        <p className={ui.muted}>
          Подписка отдаёт актуальные события за последние 30 и следующие 180
          дней. Частоту обновления определяет ваш календарь; изменения могут
          появиться с задержкой.
        </p>
        {!publicAddress && (
          <p className={ui.alert}>
            Сейчас кабинет работает локально. Файлы ICS доступны, а для подписки
            Google, Apple, Яндекс или Outlook нужен публичный HTTPS-адрес
            сервера.
          </p>
        )}
        <label>
          Название устройства или календаря
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Например, календарь на телефоне"
          />
        </label>
        <Layers value={layers} onChange={setLayers} />
        <p className={ui.caption}>
          По этой ссылке можно прочитать выбранные события. Передавайте её
          только календарю, которому доверяете. Полная ссылка показывается один
          раз: сохраните её до ухода со страницы. При потере создайте новую и
          отзовите старую.
        </p>
        <div>
          <Button
            variant="primary"
            disabled={busy || !layers.length || !!secret}
          >
            <Link2 size={17} />
            Создать ссылку
          </Button>
        </div>
      </form>
      {secret && (
        <div className={`${ui.alert} ${ui.stack}`} role="status">
          <strong>Ссылка готова — сохраните её сейчас</strong>
          <label>
            Приватная ссылка HTTPS
            <input readOnly value={secret} onFocus={(e) => e.target.select()} />
          </label>
          <CopyButton value={secret} label="Копировать ссылку" />
          {publicAddress && (
            <>
              <CopyButton
                value={secret.replace(/^https:/, "webcal:")}
                label="Копировать webcal для Apple"
              />
              <a href={secret.replace(/^https:/, "webcal:")} rel="noreferrer">
                Открыть подписку в Календаре Apple
              </a>
            </>
          )}
          <Button onClick={() => setSecret("")}>
            Ссылка сохранена, скрыть
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className={`${ui.alert} ${ui.error}`}>
          {error}
        </p>
      )}
      <h3>Активные ссылки</h3>
      {feeds.length ? (
        <div className={ui.list}>
          {feeds.map((feed) => (
            <div key={feed.id} className={ui.listItem}>
              <div>
                <strong>{feed.name}</strong>
                <p className={ui.caption}>
                  {formatDate(feed.createdAt)} ·{" "}
                  {feed.layers
                    .map((layer) => eventLabels[layer as EventType])
                    .join(", ")}
                </p>
              </div>
              <Button small onClick={() => setRemove(feed)}>
                Отозвать
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Подписок пока нет"
          description="Создайте отдельную ссылку для каждого календаря."
        />
      )}
      <Dialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Отозвать ссылку?"
      >
        <div className={ui.stack}>
          <p>
            Календарь «{remove?.name}» больше не сможет получать события. Уже
            скачанные копии останутся у провайдера.
          </p>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(`/api/calendar/feeds/${remove!.id}`, {
                  method: "DELETE",
                });
                setRemove(null);
                setSecret("");
                onChanged();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка отзыва.");
                setRemove(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            Отозвать ссылку
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
export function Integrations({
  today,
  sources,
  feeds,
  publicAddress,
  onChanged,
}: {
  today: string;
  sources: Source[];
  feeds: Feed[];
  publicAddress: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const refresh = () => {
    router.refresh();
    onChanged?.();
  };
  const [tab, setTab] = useState("export"),
    [remove, setRemove] = useState<Source | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className={ui.stack}>
      <nav className={ui.row} aria-label="Способ подключения">
        {[
          ["export", "Скачать"],
          ["import", "Импортировать"],
          ["feed", "Подписка"],
        ].map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "primary" : "default"}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <Card>
        {tab === "export" ? (
          <ExportPanel today={today} />
        ) : tab === "import" ? (
          <ImportPanel today={today} sources={sources} onChanged={refresh} />
        ) : (
          <FeedPanel
            feeds={feeds}
            publicAddress={publicAddress}
            onChanged={refresh}
          />
        )}
      </Card>
      {sources.length > 0 && (
        <Card>
          <div className={ui.stack}>
            <h2>Импортированные слои</h2>
            {sources.map((source) => (
              <div className={ui.between} key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <p className={ui.caption}>
                    {source.count} вхождений · видны только вам
                  </p>
                </div>
                <Button small onClick={() => setRemove(source)}>
                  <Trash2 size={14} />
                  Удалить слой
                </Button>
              </div>
            ))}
            {error && <p role="alert">{error}</p>}
          </div>
        </Card>
      )}
      <Dialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Удалить импортированный слой?"
      >
        <div className={ui.stack}>
          <p>
            События «{remove?.name}» исчезнут из вашего календаря. Официальное
            расписание и другие слои сохранятся.
          </p>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api(`/api/calendar/imports/sources/${remove!.id}`, {
                  method: "DELETE",
                });
                setRemove(null);
                refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Ошибка удаления.");
                setRemove(null);
              } finally {
                setBusy(false);
              }
            }}
          >
            Удалить слой
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
