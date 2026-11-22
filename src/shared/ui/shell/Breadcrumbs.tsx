"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { courseTabs } from "@/modules/courses/tabs";
import { useBreadcrumbTitle } from "./BreadcrumbTitle";
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
      teachers: "Мои преподаватели",
      all: "Все преподаватели",
      group: "Моя группа",
      departments: "Подразделения",
    },
  },
  "/profile": {
    initial: "overview",
    labels: {
      overview: "Основное",
      documents: "Документы",
      history: "Учебная история",
    },
  },
  "/studies/courses": {
    key: "semester",
    initial: "current",
    labels: { current: "Текущий семестр", past: "Завершённые" },
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
  "/community": "Событие",
  "/services": "Услуга",
  "/people": "Преподаватель",
  "/studies/courses": "Дисциплина",
  "/studies/projects": "Проект",
  "/studies/achievements": "Достижение",
};

type Section = { href: string; label: string };
const home = { href: "/", label: "Главная" };
const requests = { href: "/services?tab=requests", label: "Мои обращения" };

export function BreadcrumbTrail({
  parents = [],
  title,
}: {
  parents?: { label: string; href?: string }[];
  title: string;
}) {
  return (
    <nav aria-label="Хлебные крошки" className={s.breadcrumb}>
      {parents.map(({ href, label }) => (
        <Fragment key={href ?? label}>
          {href ? (
            <Link href={href} title={label} className={s.breadcrumbParent}>
              {label}
            </Link>
          ) : (
            <span title={label} className={s.breadcrumbParent}>
              {label}
            </span>
          )}
          <span aria-hidden="true">/</span>
        </Fragment>
      ))}
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
  const entry = useBreadcrumbTitle(path);
  if (path === "/") return <BreadcrumbTrail title={home.label} />;
  if (/^\/requests\/[^/]+$/.test(path))
    return (
      <BreadcrumbTrail
        parents={[requests]}
        title={entry?.title ?? "Обращение"}
      />
    );
  if (/^\/community\/news\/[^/]+$/.test(path))
    return (
      <BreadcrumbTrail
        parents={[{ href: "/community?tab=news", label: "Новости" }]}
        title={entry?.title ?? "Новость"}
      />
    );
  if (path === "/calendar/integrations")
    return <BreadcrumbTrail parents={[section]} title="Календарь с собой" />;
  if (path === "/studies/achievements/new")
    return <BreadcrumbTrail parents={[section]} title="Новое достижение" />;

  if (path === section.href) {
    const tab = tabs[path];
    const selected = tab && params.get(tab.key ?? "tab");
    const tabLabel =
      tab &&
      (selected && Object.hasOwn(tab.labels, selected)
        ? tab.labels[selected]
        : tab.labels[tab.initial]);
    const title = entry?.title ?? tabLabel ?? section.label;
    return (
      <BreadcrumbTrail
        parents={[
          title === section.label
            ? home
            : {
                label: section.label,
                href: params.size ? section.href : undefined,
              },
        ]}
        title={title}
      />
    );
  }

  const detail = details[section.href];
  if (!detail || path.slice(section.href.length + 1).includes("/"))
    return <BreadcrumbTrail parents={[home]} title="Страница не найдена" />;

  const parent =
    section.href === "/community"
      ? { href: "/community?tab=events", label: "События" }
      : section.href === "/services" && params.get("draft")
        ? requests
        : { ...section, href: entry?.parentHref ?? section.href };
  const title = entry?.title ?? detail;
  const courseTab =
    section.href === "/studies/courses" &&
    courseTabs.find(([id]) => id !== "overview" && id === params.get("tab"));
  return courseTab ? (
    <BreadcrumbTrail
      parents={[parent, { href: path, label: title }]}
      title={courseTab[1]}
    />
  ) : (
    <BreadcrumbTrail parents={[parent]} title={title} />
  );
}
