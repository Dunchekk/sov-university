"use client";

import Link from "next/link";
import { ArrowUpRight, Lightbulb, MessageCircle, Smile } from "lucide-react";
import { Dialog } from "../Dialog";
import { ui } from "../primitives";
import s from "./shell.module.css";

const general = "/services/general?category=OTHER&subject=";
const topics = [
  {
    icon: MessageCircle,
    title: "Сообщить о проблеме",
    description: "В работе сервиса или подразделения",
    href: `${general}${encodeURIComponent("Сообщение о проблеме")}`,
  },
  {
    icon: Lightbulb,
    title: "Предложить улучшение",
    description: "Для учёбы, кабинета или студенческой жизни",
    href: `${general}${encodeURIComponent("Предложение по улучшению")}`,
  },
  {
    icon: Smile,
    title: "Поблагодарить",
    description: "Преподавателя, сотрудника или команду",
    href: `${general}${encodeURIComponent("Благодарность")}`,
  },
];

export function FeedbackDialog({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Выразительная кнопка"
      subtitle="Выберите повод для обращения в университет."
    >
      <div className={s.feedbackTopics}>
        {topics.map(({ icon: Icon, title, description, href }) => (
          <Link
            className={s.feedbackTopic}
            href={href}
            key={href}
            onNavigate={onNavigate}
          >
            <Icon size={19} aria-hidden />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        ))}
      </div>
      <p className={ui.caption}>
        С вопросом об учёбе можно обратиться в{" "}
        <Link
          href="/people?tab=departments"
          className={ui.link}
          onNavigate={onNavigate}
        >
          учебный офис
        </Link>
        , а с ошибкой в кабинете — в{" "}
        <Link
          href="/services/support"
          className={ui.link}
          onNavigate={onNavigate}
        >
          техническую поддержку
        </Link>
        .
      </p>
    </Dialog>
  );
}
