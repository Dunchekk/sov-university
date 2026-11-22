"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Compass,
  Files,
  GraduationCap,
} from "lucide-react";
import { api } from "@/shared/lib/client";
import { NotificationLink } from "@/modules/community/NotificationLink";
import { formatDate } from "@/shared/lib/time";
import { ui } from "../primitives";
import s from "./shell.module.css";

type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  category: string;
  readAt: string | null;
  createdAt: string;
};

const icons: Partial<Record<string, typeof Bell>> = {
  SCHEDULE: CalendarDays,
  CALENDAR: CalendarDays,
  STUDY: GraduationCap,
  REQUEST: Files,
  COMMUNITY: Compass,
};

export function NotificationPopover({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | "error" | null>(null);
  const [fadeStart, setFadeStart] = useState(false);
  const [fadeEnd, setFadeEnd] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousHeight = useRef<number | undefined>(undefined);
  const listRef = useRef<HTMLUListElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const from = previousHeight.current;
    previousHeight.current = undefined;
    if (
      !panel ||
      from === undefined ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const to = panel.getBoundingClientRect().height;
    if (from === to) return;

    const animation = panel.animate(
      [{ height: `${from}px` }, { height: `${to}px` }],
      { duration: 280, easing: "ease-in-out" },
    );
    return () => animation.cancel();
  }, [items, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();

    function showItems(next: Notification[] | "error") {
      if (controller.signal.aborted) return;
      previousHeight.current = panelRef.current?.getBoundingClientRect().height;
      setItems(next);
    }

    api<Notification[]>("/api/notifications", {
      signal: controller.signal,
    }).then(showItems, () => showItems("error"));

    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !anchor.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      controller.abort();
    };
  }, [open, unread]);

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;

    const updateEdges = () => {
      setFadeStart(list.scrollTop > 1);
      setFadeEnd(list.scrollHeight - list.clientHeight - list.scrollTop > 1);
    };

    const resize = new ResizeObserver(updateEdges);
    resize.observe(list);
    list.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      list.removeEventListener("scroll", updateEdges);
      resize.disconnect();
    };
  }, [items, open]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <div
      className={s.notificationAnchor}
      ref={anchor}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className={s.bell}
        aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          if (!open) {
            setItems(null);
            setFadeStart(false);
            setFadeEnd(false);
          }
          setOpen(!open);
        }}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && <span className={s.dot} aria-hidden="true" />}
      </button>
      {open && (
        <section
          ref={panelRef}
          id={panelId}
          className={s.notificationPanel}
          aria-labelledby={`${panelId}-title`}
        >
          <h2 id={`${panelId}-title`}>Уведомления</h2>
          {items === null ? (
            <p className={s.notificationStatus} role="status">
              Загружаем уведомления…
            </p>
          ) : items === "error" ? (
            <p className={s.notificationStatus} role="alert">
              Не удалось загрузить уведомления.
            </p>
          ) : items.length ? (
            <div
              className={s.notificationFeed}
              data-fade-start={fadeStart || undefined}
              data-fade-end={fadeEnd || undefined}
            >
              <ul
                className={s.notificationList}
                ref={listRef}
                aria-label="Последние уведомления"
              >
                {items.map((item) => {
                  const Icon = icons[item.category] ?? Bell;
                  return (
                    <li key={item.id}>
                      <NotificationLink
                        className={s.notificationItem}
                        href={item.href}
                        unreadId={item.readAt ? undefined : item.id}
                        onOpen={close}
                      >
                        <span className={s.notificationIcon}>
                          <Icon size={17} aria-hidden="true" />
                        </span>
                        <span className={s.notificationText}>
                          <strong>{item.title}</strong>
                          <span className={s.notificationBody}>
                            {item.body}
                          </span>
                          <time dateTime={item.createdAt}>
                            {formatDate(item.createdAt, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </span>
                        {!item.readAt && (
                          <>
                            <span
                              className={s.notificationUnread}
                              aria-hidden="true"
                            />
                            <span className={ui.srOnly}>Непрочитанное</span>
                          </>
                        )}
                      </NotificationLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className={s.notificationStatus} role="status">
              Пока нет уведомлений.
            </p>
          )}
          <Link
            href="/notifications"
            className={`${ui.button} ${s.notificationLink}`}
            onNavigate={close}
          >
            Все уведомления <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}
