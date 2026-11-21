"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addDays, dateKey } from "@/shared/lib/time";
import { CALENDAR_BUFFER_DAYS } from "./layout";

const dayDifference = (from: string, to: string) =>
  (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000;
const bufferContains = (from: string, day: string, margin = 0) => {
  const position = dayDifference(from, day);
  return position >= margin && position <= 2 * CALENDAR_BUFFER_DAYS - margin;
};
const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveal = (node: HTMLDivElement | null) => {
  if (!node) return;
  node.style.opacity = "";
  delete node.dataset.transition;
  if (!reducedMotion())
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: "ease-out",
    });
};

const highlightDay = (frame: HTMLDivElement | null, day: string) => {
  if (!frame) return;
  frame.querySelectorAll<HTMLElement>("[data-calendar-day]").forEach((node) => {
    node
      .getAnimations()
      .filter((a) => a.id === "calendar-day-highlight")
      .forEach((a) => a.cancel());
    if (node.dataset.calendarDay !== day) return;
    const color = getComputedStyle(node).getPropertyValue("--accent-soft");
    const frames = reducedMotion()
      ? [{ backgroundColor: color }, { backgroundColor: color }]
      : [
          { backgroundColor: "transparent", offset: 0 },
          { backgroundColor: color, offset: 0.08 },
          { backgroundColor: color, offset: 0.72 },
          { backgroundColor: "transparent", offset: 1 },
        ];
    const animation = node.animate(frames, {
      duration: 2200,
      easing: "ease-out",
    });
    animation.id = "calendar-day-highlight";
  });
};

export function useCalendarScroll(date: string, view: string, from: string) {
  const scroll = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ day: string; fraction: number } | null>(null);
  const lastView = useRef(view);
  const renderedRange = useRef({ from, view });
  const dayWidth = useRef(144);
  const lastLeft = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const jump = useRef<{
    date: string;
    view: string;
    revision: number;
    highlight: boolean;
  } | null>(null);
  const revision = useRef(0);
  const animation = useRef<Animation | null>(null);
  const [visible, setVisible] = useState({
    from: date,
    to: addDays(date, view === "day" ? 1 : 7),
  });
  const router = useRouter();
  const path = usePathname();

  const publishVisible = (
    node: HTMLDivElement,
    start: string,
    count: number,
  ) => {
    const position = node.scrollLeft / dayWidth.current;
    const first = addDays(start, Math.round(position));
    const to = addDays(first, count);
    setVisible((old) =>
      old.from === first && old.to === to ? old : { from: first, to },
    );
  };

  useLayoutEffect(() => {
    renderedRange.current = { from, view };
    const node = scroll.current;
    if (node) {
      const reset = !anchor.current || lastView.current !== view;
      if (reset) {
        const urlDate = new URLSearchParams(window.location.search).get("date");
        anchor.current = {
          day: urlDate && bufferContains(from, urlDate) ? urlDate : date,
          fraction: 0,
        };
      }
      const position = () => {
        const width = Math.max(
          144,
          (node.clientWidth - 48) / (view === "week" ? 7 : 1),
        );
        dayWidth.current = width;
        node.style.setProperty("--day-width", `${width}px`);
        const current = anchor.current!;
        node.scrollLeft =
          (dayDifference(from, current.day) + current.fraction) * width;
        lastLeft.current = node.scrollLeft;
      };
      position();
      publishVisible(node, from, view === "day" ? 1 : 7);
      if (reset && node.scrollTop === 0) node.scrollTop = 8 * 52;
      node.dataset.ready = "true";
      const observer = new ResizeObserver(() => {
        position();
        publishVisible(node, from, view === "day" ? 1 : 7);
      });
      observer.observe(node);
      lastView.current = view;
      if (jump.current?.date === date && jump.current.view === view) {
        const shouldHighlight = jump.current.highlight;
        jump.current = null;
        reveal(frameRef.current);
        if (shouldHighlight) highlightDay(frameRef.current, date);
      }
      return () => observer.disconnect();
    }
    anchor.current = null;
    lastView.current = view;
    if (jump.current?.date === date && jump.current.view === view) {
      jump.current = null;
      reveal(frameRef.current);
    }
  }, [date, from, view]);

  useEffect(() => {
    const restore = () => {
      clearTimeout(timer.current);
      revision.current++;
      animation.current?.cancel();
      jump.current = null;
      if (frameRef.current) {
        frameRef.current.style.opacity = "";
        delete frameRef.current.dataset.transition;
      }
      const params = new URLSearchParams(window.location.search);
      const day = params.get("date") || dateKey();
      if (anchor.current?.day === day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
        return;
      anchor.current = { day, fraction: 0 };
      const { from, view } = renderedRange.current;
      const node = scroll.current;
      if (
        node &&
        (!params.has("view") || params.get("view") === view) &&
        bufferContains(from, day)
      ) {
        node.scrollLeft = dayDifference(from, day) * dayWidth.current;
        lastLeft.current = node.scrollLeft;
        publishVisible(node, from, view === "day" ? 1 : 7);
      }
    };
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      clearTimeout(timer.current);
      animation.current?.cancel();
    };
  }, []);

  const transitionTo = async (
    next: string,
    nextView: string,
    commit: () => boolean,
    highlight = false,
  ) => {
    clearTimeout(timer.current);
    const id = ++revision.current;
    animation.current?.cancel();
    jump.current = { date: next, view: nextView, revision: id, highlight };
    const frame = frameRef.current;
    if (frame && !reducedMotion()) {
      frame.dataset.transition = "out";
      animation.current = frame.animate(
        [{ opacity: getComputedStyle(frame).opacity }, { opacity: 0 }],
        { duration: 110, fill: "forwards", easing: "ease-in" },
      );
      try {
        await animation.current.finished;
      } catch {
        return;
      }
      if (id !== revision.current) return;
      frame.style.opacity = "0";
      animation.current.cancel();
    }
    anchor.current = { day: next, fraction: 0 };
    const node = scroll.current;
    if (node && nextView === view) {
      const offset = dayDifference(from, next) * dayWidth.current;
      if (offset >= 0 && offset <= node.scrollWidth - node.clientWidth) {
        node.scrollLeft = offset;
        lastLeft.current = node.scrollLeft;
      }
    }
    const alreadyCurrent = commit();
    if (alreadyCurrent || (next === date && nextView === view)) {
      jump.current = null;
      if (node) publishVisible(node, from, view === "day" ? 1 : 7);
      reveal(frame);
      if (highlight) highlightDay(frame, next);
    }
  };

  const move = (direction: number) => {
    const node = scroll.current;
    if (!node || jump.current) return;
    node.scrollTo({
      left:
        (Math.round(node.scrollLeft / dayWidth.current) + direction) *
        dayWidth.current,
      behavior: reducedMotion() ? "instant" : "smooth",
    });
  };

  const onScroll = () => {
    const node = scroll.current;
    if (
      !node ||
      jump.current ||
      Math.abs(node.scrollLeft - lastLeft.current) < 0.1
    )
      return;
    lastLeft.current = node.scrollLeft;
    const position = node.scrollLeft / dayWidth.current;
    const index = Math.round(position);
    const day = addDays(from, index);
    anchor.current = { day, fraction: position - index };
    publishVisible(node, from, view === "day" ? 1 : 7);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(window.location.search);
      if (
        next.has("event") ||
        (next.has("view") && next.get("view") !== view) ||
        next.get("date") === day
      )
        return;
      next.set("date", day);
      next.set("view", view);
      next.delete("finance");
      const href = `${path}?${next}`;
      if (bufferContains(from, day, 7))
        window.history.replaceState(null, "", href);
      else router.replace(href, { scroll: false });
    }, 180);
  };

  return { scrollRef: scroll, frameRef, visible, onScroll, move, transitionTo };
}
