"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import s from "./assessment.module.css";

export function ResultHelp({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      ref={root}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus({ preventScroll: true });
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={s.helpButton}
        aria-label="Условия получения результата"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setOpen((value) => !value);
        }}
      >
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className={s.helpPanel} id={id} tabIndex={0}>
          {children}
        </div>
      )}
    </div>
  );
}
