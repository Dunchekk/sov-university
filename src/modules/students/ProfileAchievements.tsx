"use client";

import Image from "next/image";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/shared/ui/Dialog";
import { Button, ui } from "@/shared/ui/primitives";
import type { Achievement } from "./achievements";
import s from "./achievements.module.css";

function Badge({ id, size }: { id: string; size: number }) {
  return (
    <Image
      className={s.badge}
      src={`/achievements/${id}.webp`}
      alt=""
      width={size}
      height={size}
      unoptimized
    />
  );
}

function focusWithinOpenDialog(button: HTMLButtonElement | null) {
  if (button?.closest("dialog")?.open) button.focus();
}

export function ProfileAchievements({
  achievements,
}: {
  achievements: readonly Achievement[];
}) {
  const [view, setView] = useState<Achievement | "all" | null>(null);
  const selected = view === "all" ? null : view;

  return (
    <>
      <section className={s.card} aria-labelledby="profile-achievements">
        <h2 id="profile-achievements">Ачивки</h2>
        <ul className={s.grid}>
          {achievements.map((achievement) => (
            <li key={achievement.id}>
              <button
                className={s.badgeButton}
                type="button"
                aria-label={achievement.title}
                aria-haspopup="dialog"
                title={achievement.title}
                onClick={() => setView(achievement)}
              >
                <Badge id={achievement.id} size={48} />
              </button>
            </li>
          ))}
        </ul>
        <Button
          className={s.allButton}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setView("all")}
        >
          Посмотреть все
        </Button>
      </section>

      <Dialog
        open={view !== null}
        onClose={() => setView(null)}
        title={selected?.title ?? "Все ачивки"}
        subtitle={selected?.category}
        titleIcon={selected && <Badge id={selected.id} size={88} />}
        className={s.dialog}
      >
        {selected ? (
          <div className={s.detail}>
            <p>{selected.description}</p>
            <button
              ref={focusWithinOpenDialog}
              type="button"
              className={`${ui.button} ${s.backButton}`}
              onClick={() => setView("all")}
            >
              <ArrowLeft size={16} aria-hidden /> Ко всем ачивкам
            </button>
          </div>
        ) : view === "all" ? (
          <ul className={s.collection}>
            {achievements.map((achievement, index) => (
              <li key={achievement.id}>
                <button
                  ref={index === 0 ? focusWithinOpenDialog : undefined}
                  className={s.collectionButton}
                  type="button"
                  onClick={() => setView(achievement)}
                >
                  <Badge id={achievement.id} size={44} />
                  <span>
                    {achievement.title}
                    <span className={s.category}>{achievement.category}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>
    </>
  );
}
