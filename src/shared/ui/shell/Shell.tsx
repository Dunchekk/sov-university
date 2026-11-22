"use client";
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
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
  MessagesSquare,
  LifeBuoy,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Avatar, Button, ui } from "../primitives";
import { BrandMark } from "../BrandMark";
import { PageContainer } from "../PageContainer";
import { Search } from "./Search";
import { NotificationPopover } from "./NotificationPopover";
import { FeedbackDialog } from "./FeedbackDialog";
import { NavigationOverlay } from "./NavigationOverlay";
import { Breadcrumbs, BreadcrumbTrail } from "./Breadcrumbs";
import { BreadcrumbTitleProvider } from "./BreadcrumbTitle";
import { brand } from "@/shared/config/brand";
import { avatarEndpoint } from "@/modules/students/avatar";
import { api } from "@/shared/lib/client";
import s from "./shell.module.css";
const study = [
  ["/studies/courses", "Дисциплины"],
  ["/studies/results", "Оценки и посещаемость"],
  ["/studies/rating", "Рейтинг"],
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
};

function NavigationPending({
  setPendingLinks,
}: {
  setPendingLinks: Dispatch<SetStateAction<number>>;
}) {
  const { pending } = useLinkStatus();
  useEffect(() => {
    if (!pending) return;
    setPendingLinks((count) => count + 1);
    return () => setPendingLinks((count) => count - 1);
  }, [pending, setPendingLinks]);
  return pending ? <span aria-hidden className={s.navPending} /> : null;
}

export function Shell({
  name,
  avatar,
  group,
  unread,
  collapsed: initial,
  children,
}: {
  name: string;
  avatar: string | null;
  group: string;
  unread: number;
  collapsed: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const sidebarId = useId();
  const studyId = useId();
  const sidebar = useRef<HTMLElement>(null);
  const mobileMenu = useRef<HTMLButtonElement>(null);
  const [firstName, surname] = name.split(" ");
  const profileName = surname ? `${firstName} ${surname[0]}.` : firstName;
  const [collapsed, setCollapsed] = useState(initial),
    [mobile, setMobile] = useState(false),
    [feedbackOpen, setFeedbackOpen] = useState(false),
    [expanded, setExpanded] = useState(true),
    [prefetchTarget, setPrefetchTarget] = useState<string>(),
    [loaderPrepared, setLoaderPrepared] = useState(false),
    [pendingLinks, setPendingLinks] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    if (!mobile) return;
    const media = matchMedia("(max-width:760px)");
    sidebar.current?.querySelector<HTMLAnchorElement>("a")?.focus({
      preventScroll: true,
    });
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobile(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [mobile]);
  function closeMobileMenu() {
    setMobile(false);
    mobileMenu.current?.focus({ preventScroll: true });
  }
  const active = (href: string) =>
    path === href || (href !== "/" && path.startsWith(`${href}/`));
  const studySection = study.find(([href]) => active(href));
  const section = studySection
    ? { href: studySection[0], label: studySection[1] }
    : (nav.find((n) => active(n.href)) ?? {
        href: path,
        label: secondaryLabels[path] ?? "Страница не найдена",
      });
  const sidebarLink = (href: string) => ({
    href,
    prefetch: href !== path && prefetchTarget === href ? true : undefined,
    onMouseEnter: () => setPrefetchTarget(href),
    onFocus: () => setPrefetchTarget(href),
    onNavigate: () => {
      setMobile(false);
      if (href !== path) setLoaderPrepared(true);
    },
  });
  const item = (href: string, label: string, Icon: typeof House) => (
    <Link
      {...sidebarLink(href)}
      key={href}
      className={s.navItem}
      aria-current={active(href) ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
    >
      <Icon size={19} strokeWidth={1.7} aria-hidden />
      <span className={s.label}>{label}</span>
      {href !== path && <NavigationPending setPendingLinks={setPendingLinks} />}
    </Link>
  );
  return (
    <div
      className={`${s.shell} ${collapsed ? s.collapsed : ""} ${mobile ? s.mobileOpen : ""}`}
      onKeyDown={(event) => {
        if (!mobile || event.defaultPrevented || event.key !== "Escape") return;
        event.preventDefault();
        closeMobileMenu();
      }}
    >
      <a className={`${ui.button} ${s.skipLink}`} href="#main">
        Перейти к основному содержанию
      </a>
      <aside
        ref={sidebar}
        id={sidebarId}
        className={s.sidebar}
        aria-label="Основная навигация"
      >
        <Link {...sidebarLink("/")} className={s.brand} aria-label={brand.name}>
          <BrandMark />
          <span className={s.label}>{brand.name}</span>
          {path !== "/" && (
            <NavigationPending setPendingLinks={setPendingLinks} />
          )}
        </Link>
        <Link
          {...sidebarLink("/profile")}
          className={s.profile}
          aria-label={`Мой профиль — ${profileName} ${group} · 2 курс`}
          aria-current={path === "/profile" ? "page" : undefined}
        >
          <Avatar
            name={name}
            src={avatar}
            unoptimized={avatar?.startsWith(avatarEndpoint)}
          />
          <div className={s.profileText}>
            <strong>{profileName}</strong>
            <small>{group} · 2 курс</small>
          </div>
          {path !== "/profile" && (
            <NavigationPending setPendingLinks={setPendingLinks} />
          )}
        </Link>
        <nav className={s.nav} aria-label="Разделы кабинета">
          {nav.slice(0, 2).map((n) => item(n.href, n.label, n.icon))}
          <button
            className={s.groupButton}
            onClick={() => {
              if (collapsed) setCollapsed(false);
              setExpanded((v) => !v);
            }}
            aria-expanded={expanded}
            aria-controls={studyId}
            aria-label="Учёба"
          >
            <GraduationCap size={19} aria-hidden />
            <span className={s.label}>Учёба</span>
            <ChevronDown size={14} className={s.label} aria-hidden />
          </button>
          <div id={studyId} className={s.subnav} hidden={!expanded}>
            {study.map(([href, label]) => (
              <Link
                {...sidebarLink(href)}
                key={href}
                className={s.navItem}
                aria-current={active(href) ? "page" : undefined}
              >
                {label}
                {href !== path && (
                  <NavigationPending setPendingLinks={setPendingLinks} />
                )}
              </Link>
            ))}
          </div>
          {nav.slice(2).map((n) => item(n.href, n.label, n.icon))}
        </nav>
        <div className={s.bottom}>
          <button
            type="button"
            className={`${s.navItem} ${s.feedbackButton}`}
            aria-label="Выразительная кнопка"
            aria-haspopup="dialog"
            title={collapsed ? "Выразительная кнопка" : undefined}
            onClick={() => setFeedbackOpen(true)}
          >
            <MessagesSquare size={19} strokeWidth={1.7} aria-hidden />
            <span className={s.label}>Выразительная кнопка</span>
          </button>
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
      <BreadcrumbTitleProvider>
        <div className={s.workspace}>
          <header className={s.header}>
            <Button
              ref={mobileMenu}
              className={s.mobileMenu}
              aria-label={mobile ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobile}
              aria-controls={sidebarId}
              onClick={() => (mobile ? closeMobileMenu() : setMobile(true))}
            >
              {mobile ? <X size={19} /> : <Menu size={19} />}
            </Button>
            <Suspense fallback={<BreadcrumbTrail title={section.label} />}>
              <Breadcrumbs path={path} section={section} />
            </Suspense>
            <div className={s.headerActions}>
              <Search />
              <NotificationPopover key={path} unread={unread} />
            </div>
          </header>
          <PageContainer>{children}</PageContainer>
          <NavigationOverlay
            pending={pendingLinks > 0}
            prepared={loaderPrepared}
          />
        </div>
      </BreadcrumbTitleProvider>
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onNavigate={() => {
          setFeedbackOpen(false);
          setMobile(false);
        }}
      />
    </div>
  );
}
