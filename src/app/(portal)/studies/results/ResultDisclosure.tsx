"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import s from "./results.module.css";

export function ResultDisclosure({
  expanded,
  summary,
  children,
}: {
  expanded: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const transition = useRef<{ animation: Animation; opening: boolean }>(null);

  useEffect(() => {
    const panel = body.current;
    return () => {
      transition.current?.animation.cancel();
      transition.current = null;
      if (panel) delete panel.dataset.animating;
    };
  }, [expanded]);

  function toggle(event: MouseEvent<HTMLElement>) {
    const disclosure = details.current;
    const panel = body.current;
    if (!disclosure || !panel) return;
    const previous = transition.current;
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !panel.animate
    ) {
      if (previous) {
        previous.animation.cancel();
        transition.current = null;
        delete panel.dataset.animating;
        disclosure.open = previous.opening;
      }
      return;
    }

    event.preventDefault();
    const opening = !(previous?.opening ?? disclosure.open);
    const start = disclosure.open ? panel.getBoundingClientRect().height : 0;
    previous?.animation.cancel();
    disclosure.open = true;
    panel.dataset.animating = "";
    const end = opening ? panel.getBoundingClientRect().height : 0;
    const animation = panel.animate(
      [{ height: `${start}px` }, { height: `${end}px` }],
      { duration: 220, easing: "cubic-bezier(.2, .65, .3, 1)", fill: "both" },
    );
    transition.current = { animation, opening };
    animation.onfinish = () => {
      if (transition.current?.animation !== animation) return;
      disclosure.open = opening;
      animation.cancel();
      delete panel.dataset.animating;
      transition.current = null;
    };
  }

  return (
    <details ref={details} className={s.result} open={expanded}>
      <summary className={s.summary} onClick={toggle}>
        {summary}
      </summary>
      <div ref={body}>{children}</div>
    </details>
  );
}
