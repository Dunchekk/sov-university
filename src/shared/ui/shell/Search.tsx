"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { Dialog } from "../Dialog";
import { Empty, ui } from "../primitives";
import s from "./shell.module.css";
type Item = { id: string; title: string; type: string; href: string };
export function Search() {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [items, setItems] = useState<Item[]>([]),
    [active, setActive] = useState(0),
    [error, setError] = useState("");
  const router = useRouter();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Поиск временно недоступен.");
        setItems(await response.json());
        setActive(0);
        setError("");
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, open]);
  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };
  return (
    <>
      <button
        className={s.searchButton}
        onClick={(e) => {
          e.currentTarget.focus();
          setOpen(true);
        }}
        aria-label="Глобальный поиск"
      >
        <SearchIcon size={18} />
        <span>Найти в кабинете</span>
        <kbd>⌘ K</kbd>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Поиск по кабинету"
      >
        <label>
          Дисциплина, человек, услуга или событие
          <input
            ref={field}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Например, справка для работы"
            role="combobox"
            aria-controls="global-results"
            aria-expanded={items.length > 0}
            aria-activedescendant={
              items[active] ? `search-${active}` : undefined
            }
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((v) => Math.min(items.length - 1, v + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((v) => Math.max(0, v - 1));
              }
              if (e.key === "Enter" && items[active]) {
                e.preventDefault();
                go(items[active]);
              }
            }}
          />
        </label>
        {error && (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        )}
        <div id="global-results" role="listbox" className={s.searchResults}>
          {items.map((item, i) => (
            <div key={`${item.type}-${item.id}`}>
              {items[i - 1]?.type !== item.type && (
                <div className={s.searchGroup}>{item.type}</div>
              )}
              <div
                id={`search-${i}`}
                role="option"
                aria-selected={i === active}
                className={s.result}
                onMouseMove={() => setActive(i)}
                onClick={() => go(item)}
              >
                {item.title}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <Empty
              title={q.length < 2 ? "Что ищем?" : "Ничего не найдено"}
              description={
                q.length < 2
                  ? "Введите хотя бы два символа."
                  : "Попробуйте другое название или назначение."
              }
            />
          )}
        </div>
      </Dialog>
    </>
  );
}
