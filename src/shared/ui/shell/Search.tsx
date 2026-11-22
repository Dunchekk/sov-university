"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { openNotification } from "@/modules/community/NotificationLink";
import {
  searchScopes,
  type SearchResult,
  type SearchScope,
} from "@/modules/search/types";
import { Dialog } from "../Dialog";
import { ui } from "../primitives";
import s from "./shell.module.css";

type ResponseState = { key: string; items: SearchResult[]; error?: string };

export function Search() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const resultsArea = useRef<HTMLDivElement>(null);
  const resultsContent = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const router = useRouter();
  const term = q.trim();
  const key = `${scope}:${term}`;
  const current = response?.key === key ? response : null;
  const items = current?.items ?? [];
  const pending = term.length >= 2 && !current;

  function openSearch() {
    resultsArea.current?.style.removeProperty("height");
    setQ("");
    setScope("all");
    setResponse(null);
    setActive(null);
    setOpen(true);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.repeat) return;
        if (open) setOpen(false);
        else openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  useLayoutEffect(() => {
    const area = resultsArea.current;
    const content = resultsContent.current;
    if (!open || pending || !area || !content) return;
    const resize = () => {
      if (content.offsetWidth) area.style.height = `${content.offsetHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, pending]);

  useEffect(() => {
    if (!open || term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: term, scope });
      try {
        const result = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });
        if (!result.ok) throw new Error("Search failed");
        const items: SearchResult[] = await result.json();
        if (controller.signal.aborted) return;
        setResponse({ key, items });
        setActive(null);
      } catch {
        if (!controller.signal.aborted)
          setResponse({ key, items: [], error: "Поиск временно недоступен." });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, open, scope, term]);

  const go = (item: SearchResult) => {
    setOpen(false);
    if (item.unreadNotificationId) {
      void openNotification(router, item.href, item.unreadNotificationId);
    } else {
      router.push(item.href);
    }
  };
  const optionId = (index: number) => `${resultsId}-${index}`;

  return (
    <>
      <button
        type="button"
        className={s.searchButton}
        onClick={(event) => {
          event.currentTarget.focus();
          openSearch();
        }}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <SearchIcon size={18} aria-hidden="true" />
        <span>Найти в кабинете</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Поиск по кабинету"
        className={s.searchDialog}
      >
        <div className={s.searchField}>
          <SearchIcon size={19} aria-hidden="true" />
          <input
            ref={field}
            autoFocus
            autoComplete="off"
            aria-label="Поисковый запрос"
            maxLength={80}
            value={q}
            onChange={(event) => {
              if (event.target.value.trim() !== term) {
                setResponse(null);
                setActive(null);
              }
              setQ(event.target.value);
            }}
            placeholder="Поиск..."
            role="combobox"
            aria-autocomplete="list"
            aria-controls={resultsId}
            aria-expanded={items.length > 0}
            aria-activedescendant={
              active !== null && items[active] ? optionId(active) : undefined
            }
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || !items.length) return;
              if (event.key === "Enter") {
                event.preventDefault();
                go(items[active ?? 0]);
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next =
                  event.key === "ArrowDown"
                    ? Math.min(items.length - 1, (active ?? -1) + 1)
                    : Math.max(0, (active ?? items.length) - 1);
                setActive(next);
                document
                  .getElementById(optionId(next))
                  ?.scrollIntoView({ block: "nearest" });
              }
            }}
          />
        </div>
        <div
          className={s.searchScopes}
          role="group"
          aria-label="Искать в разделе"
        >
          {searchScopes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={scope === id}
              onClick={() => {
                if (scope === id) return;
                setScope(id);
                setResponse(null);
                setActive(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={s.searchResultsArea} ref={resultsArea}>
          <div ref={resultsContent}>
            <div
              id={resultsId}
              role="listbox"
              aria-label="Результаты поиска"
              className={s.searchResults}
              hidden={!items.length}
              onPointerMove={() => {
                if (active !== null) setActive(null);
              }}
            >
              {items.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={s.result}
                  onClick={() => go(item)}
                >
                  <span>{item.title}</span>
                  <small>
                    {item.description
                      ? `${item.type} · ${item.description}`
                      : item.type}
                  </small>
                </div>
              ))}
            </div>
            {current?.error ? (
              <p role="alert" className={`${s.searchStatus} ${ui.error}`}>
                {current.error}
              </p>
            ) : (
              <p
                role="status"
                className={items.length ? ui.srOnly : s.searchStatus}
              >
                {term.length < 2
                  ? "Введите хотя бы два символа."
                  : pending
                    ? "Ищем…"
                    : items.length
                      ? `Найдено: ${items.length}`
                      : "Ничего не найдено. Попробуйте другой запрос или раздел."}
              </p>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
