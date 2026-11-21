"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useFeedNavigation } from "./FeedNavigation";
import s from "./community.module.css";

type Choice = {
  label: string;
  href: string;
  selected: boolean;
};

export function FeedSelect({
  label,
  choices,
}: {
  label: string;
  choices: Choice[];
}) {
  const { navigate } = useFeedNavigation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = choices.find((choice) => choice.selected) ?? choices[0];

  useEffect(() => {
    if (!open || !menu.current) return;
    const list = menu.current;
    const selectedItem = list.querySelector<HTMLButtonElement>(
      '[aria-checked="true"]',
    );
    selectedItem?.focus({ preventScroll: true });
    if (list.getBoundingClientRect().bottom > innerHeight) {
      list.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    selectedItem?.scrollIntoView({ block: "nearest", inline: "nearest" });

    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const items = Array.from(event.currentTarget.querySelectorAll("button"));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div
      className={s.select}
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className={s.selectTrigger}
        ref={trigger}
        aria-label={`${label}: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            else
              menu.current
                ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
                ?.focus();
          }
        }}
      >
        <span>{selected.label}</span>
        <ChevronDown size={15} aria-hidden />
      </button>
      {open && (
        <div
          className={s.selectMenu}
          id={menuId}
          ref={menu}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
        >
          {choices.map((choice) => (
            <button
              key={choice.href}
              type="button"
              role="menuitemradio"
              aria-checked={choice.selected}
              tabIndex={-1}
              className={s.selectOption}
              onClick={() => {
                close();
                if (!choice.selected) navigate(choice.href);
              }}
            >
              {choice.label}
              {choice.selected && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
