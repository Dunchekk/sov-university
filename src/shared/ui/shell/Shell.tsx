"use client";
import { Suspense, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  CalendarDays,
  GraduationCap,
  Files,
  Wallet,
  Users,
  Compass,
  LifeBuoy,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Avatar, Button } from "../primitives";
import { PageContainer } from "../PageContainer";
import { Search } from "./Search";
import { NotificationPopover } from "./NotificationPopover";
import { Breadcrumbs, BreadcrumbTrail } from "./Breadcrumbs";
import { brand } from "@/shared/config/brand";
import { api } from "@/shared/lib/client";
import s from "./shell.module.css";
const study = [
  ["/studies/courses", "Дисциплины"],
  ["/studies/results", "Оценки и посещаемость"],
  ["/studies/curriculum", "Учебный план"],
  ["/studies/projects", "Практика и проекты"],
  ["/studies/achievements", "Достижения"],
];
const nav = [
  { href: "/", label: "Главная", icon: House },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/services", label: "Справки и заявления", icon: Files },
  { href: "/finance", label: "Финансы", icon: Wallet },
  { href: "/community", label: "События", icon: Compass },
  { href: "/people", label: "Люди", icon: Users },
];
const secondaryLabels: Record<string, string> = {
  "/profile": "Профиль",
  "/settings": "Настройки",
  "/notifications": "Уведомления",
  "/support": "Поддержка",
  "/requests": "Мои обращения",
};

function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className={s.navPending} /> : null;
}

export function Shell({
  name,
  group,
  unread,
  collapsed: initial,
  children,
}: {
  name: string;
  group: string;
  unread: number;
  collapsed: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initial),
    [mobile, setMobile] = useState(false),
    [expanded, setExpanded] = useState(true),
    [error, setError] = useState("");
  const active = (href: string) =>
    path === href || (href !== "/" && path.startsWith(`${href}/`));
  const studySection = study.find(([href]) => active(href));
  const section = studySection
    ? { href: studySection[0], label: studySection[1] }
    : (nav.find((n) => active(n.href)) ?? {
        href: path,
        label: secondaryLabels[path] ?? "Личный кабинет",
      });
  const item = (href: string, label: string, Icon: typeof House) => (
    <Link
      href={href}
      key={href}
      className={s.navItem}
      aria-current={active(href) ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      onClick={() => setMobile(false)}
    >
      <Icon size={19} strokeWidth={1.7} />
      <span className={s.label}>{label}</span>
      <NavigationPending />
    </Link>
  );
  return (
    <div
      className={`${s.shell} ${collapsed ? s.collapsed : ""} ${mobile ? s.mobileOpen : ""}`}
    >
      <aside className={s.sidebar} aria-label="Основная навигация">
        <Link href="/" className={s.brand}>
          <span className={s.mark}>{brand.mark}</span>
          <span className={s.label}>{brand.name}</span>
        </Link>
        <Link
          href="/profile"
          className={s.profile}
          onClick={() => setMobile(false)}
          aria-label="Мой профиль"
        >
          <Avatar name={name} />
          <div className={s.profileText}>
            <strong>
              {name.split(" ")[0]} {name.split(" ")[1]?.slice(0, 1)}.
            </strong>
            <small>{group} · 2 курс</small>
          </div>
        </Link>
        <nav className={s.nav}>
          {nav.slice(0, 2).map((n) => item(n.href, n.label, n.icon))}
          <button
            className={s.groupButton}
            onClick={() => {
              if (collapsed) setCollapsed(false);
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-label="Учёба"
          >
            <GraduationCap size={19} />
            <span className={s.label}>Учёба</span>
            <ChevronDown size={14} className={s.label} />
          </button>
          {expanded && (
            <div className={s.subnav}>
              {study.map(([href, label]) => (
                <Link
                  href={href}
                  key={href}
                  className={s.navItem}
                  aria-current={active(href) ? "page" : undefined}
                  onClick={() => setMobile(false)}
                >
                  {label}
                  <NavigationPending />
                </Link>
              ))}
            </div>
          )}
          {nav.slice(2).map((n) => item(n.href, n.label, n.icon))}
        </nav>
        <div className={s.bottom}>
          {item("/support", "Поддержка", LifeBuoy)}
          {item("/settings", "Настройки", Settings)}
          <div className={s.collapse}>
            <Button
              aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
              onClick={async () => {
                try {
                  await api("/api/me/preferences", {
                    method: "PATCH",
                    body: JSON.stringify({ sidebarCollapsed: !collapsed }),
                  });
                  setCollapsed((v) => !v);
                  setError("");
                } catch {
                  setError("Не удалось сохранить меню.");
                }
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
              <span className={s.label}>Свернуть меню</span>
            </Button>
            {error && <small role="alert">{error}</small>}
          </div>
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.header}>
          <Button
            className={s.mobileMenu}
            aria-label={mobile ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <X size={19} /> : <Menu size={19} />}
          </Button>
          <Suspense
            fallback={
              <BreadcrumbTrail
                parent={{ href: "/", label: "Личный кабинет" }}
                title={section.label}
              />
            }
          >
            <Breadcrumbs path={path} section={section} />
          </Suspense>
          <div className={s.headerActions}>
            <Search />
            <NotificationPopover key={path} unread={unread} />
          </div>
        </header>
        <PageContainer>{children}</PageContainer>
      </div>
    </div>
  );
}
