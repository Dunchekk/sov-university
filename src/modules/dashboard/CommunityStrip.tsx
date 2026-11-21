"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Cover } from "@/modules/community/Cover";
import type { communityHighlights } from "@/modules/community/service";
import s from "./dashboard.module.css";

type Highlight = Awaited<ReturnType<typeof communityHighlights>>[number];

export function CommunityStrip({ items }: { items: Highlight[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const list = track.current;
    if (!list) return;

    const updateEdges = () => {
      setCanGoBack(list.scrollLeft > 1);
      setCanGoForward(
        list.scrollWidth - list.clientWidth - list.scrollLeft > 1,
      );
    };

    const resize = new ResizeObserver(updateEdges);
    resize.observe(list);
    list.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      list.removeEventListener("scroll", updateEdges);
      resize.disconnect();
    };
  }, [items.length]);

  function scroll(direction: -1 | 1) {
    const list = track.current;
    const first = list?.firstElementChild;
    if (!list || !first) return;
    const step =
      first.getBoundingClientRect().width +
      parseFloat(getComputedStyle(list).columnGap);
    list.scrollBy({
      left: direction * step,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <section aria-labelledby="community-highlights-title">
      <h2 id="community-highlights-title" className={s.communityHeading}>
        <Link href="/community" className={s.communityLink}>
          За пределами пар <ArrowUpRight size={17} aria-hidden />
        </Link>
      </h2>
      {items.length ? (
        <ul
          className={s.communityStrip}
          ref={track}
          aria-label="События и новости"
          tabIndex={0}
          data-fade-start={canGoBack || undefined}
          data-fade-end={canGoForward || undefined}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              scroll(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={s.communityPost}>
                <div className={s.communityCopy}>
                  <p className={s.communityMeta}>
                    {item.kind} ·{" "}
                    <time dateTime={item.date}>{item.dateLabel}</time>
                  </p>
                  <h3>{item.title}</h3>
                  <p className={s.communityMeta}>
                    {item.city} · {item.category}
                  </p>
                </div>
                {item.cover && (
                  <div className={s.communityMedia}>
                    <Cover src={item.cover} sizes="160px" />
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.communityMeta}>Пока нет событий и новостей.</p>
      )}
    </section>
  );
}
