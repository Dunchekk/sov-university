"use client";

import { useEffect, useRef, useState } from "react";
import s from "./shell.module.css";

const showAfter = 400;
const minimumVisible = 600;

export function NavigationOverlay({
  pending,
  prepared,
}: {
  pending: boolean;
  prepared: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    const startedAt = shownAt.current;
    if (pending === (startedAt !== null)) return;
    const delay =
      startedAt === null
        ? showAfter
        : Math.max(0, startedAt + minimumVisible - performance.now());
    const timer = window.setTimeout(() => {
      shownAt.current = pending ? performance.now() : null;
      setVisible(pending);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <div
      role="status"
      aria-label="Загрузка страницы"
      data-prepared={prepared ? "" : undefined}
      data-visible={visible ? "" : undefined}
      className={s.navigationOverlay}
    >
      <div className={s.navigationIndicator} aria-hidden>
        <p className={s.navigationLabel}>
          Загрузка
          <span className={s.navigationDots}>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    </div>
  );
}
