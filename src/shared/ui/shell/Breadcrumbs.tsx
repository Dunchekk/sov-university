"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "./shell.module.css";

const tabs: Record<
  string,
  { key?: string; labels: Record<string, string>; initial: string }
> = {
  "/community": {
    initial: "all",
    labels: {
      all: "Все",
      events: "События",
      news: "Новости",
      saved: "Сохранённые",
    },
  },
  "/services": {
    initial: "catalog",
    labels: { catalog: "Каталог услуг", requests: "Мои обращения" },
  },
  "/finance": {
    initial: "overview",
    labels: {
      overview: "Обзор",
      scholarships: "Стипендии",
      payments: "Выплаты",
      contracts: "Договоры",
    },
  },
  "/people": {
    initial: "teachers",
    labels: {
      teachers: "Преподаватели",
      group: "Моя группа",
      departments: "Подразделения",
    },
  },
  "/studies/results": {
    key: "status",
    initial: "all",
    labels: {
      all: "Все результаты",
      attention: "Требует внимания",
      completed: "Завершено",
    },
  },
};

const details: Record<string, string> = {
  "/calendar": "Календарь с собой",
  "/community": "О событии",
  "/services": "Оформление услуги",
  "/people": "Преподаватель",
  "/studies/courses": "О дисциплине",
  "/studies/projects": "О проекте",
  "/studies/achievements": "О достижении",
};

type Section = { href: string; label: string };

export function BreadcrumbTrail({
  parent,
  title,
}: {
  parent: Section;
  title: string;
}) {
  return (
    <nav aria-label="Хлебные крошки" className={s.breadcrumb}>
      <Link href={parent.href} title={parent.label}>
        {parent.label}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" title={title}>
        {title}
      </span>
    </nav>
  );
}

export function Breadcrumbs({
  path,
  section,
}: {
  path: string;
  section: Section;
}) {
  const params = useSearchParams();
  if (path.startsWith("/requests/"))
    return (
      <BreadcrumbTrail
        parent={{ href: "/services?tab=requests", label: "Мои обращения" }}
        title="Обращение"
      />
    );
  if (path.startsWith("/community/news/"))
    return (
      <BreadcrumbTrail
        parent={{ href: "/community?tab=news", label: "Новости" }}
        title="О новости"
      />
    );
  if (path === "/studies/achievements/new")
    return <BreadcrumbTrail parent={section} title="Новое достижение" />;

  const tab = path === section.href ? tabs[path] : undefined;
  if (tab) {
    const selected = params.get(tab.key ?? "tab");
    return (
      <BreadcrumbTrail
        parent={section}
        title={
          (selected &&
            Object.hasOwn(tab.labels, selected) &&
            tab.labels[selected]) ||
          tab.labels[tab.initial]
        }
      />
    );
  }

  const detail = path !== section.href ? details[section.href] : undefined;
  if (detail) return <BreadcrumbTrail parent={section} title={detail} />;
  return (
    <BreadcrumbTrail
      parent={{ href: "/", label: "Личный кабинет" }}
      title={section.label}
    />
  );
}
