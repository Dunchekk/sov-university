import Link from "next/link";
import Image from "next/image";
import type { ReactNode, ComponentProps } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import { BreadcrumbTitle } from "./shell/BreadcrumbTitle";
import s from "./ui.module.css";
export { default as ui } from "./ui.module.css";
export function Button({
  variant = "default",
  small = false,
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: "default" | "primary" | "danger";
  small?: boolean;
}) {
  return (
    <button
      {...props}
      className={`${s.button} ${variant === "primary" ? s.primary : variant === "danger" ? s.danger : ""} ${small ? s.small : ""} ${className}`}
    />
  );
}
export function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link href={href} className={`${s.button} ${primary ? s.primary : ""}`}>
      {children}
    </Link>
  );
}
export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`${s.card} ${className}`}>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  description,
  action,
  breadcrumb,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  breadcrumb?: { path: string; label?: string; parentHref?: string };
}) {
  return (
    <div className={s.pageTitle}>
      {breadcrumb && (
        <BreadcrumbTitle
          path={breadcrumb.path}
          title={breadcrumb.label ?? title}
          parentHref={breadcrumb.parentHref}
        />
      )}
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warning" | "success" | "info" | "danger";
}) {
  return (
    <span
      className={`${s.badge} ${tone === "danger" ? s.error : tone === "default" ? "" : s[tone]}`}
    >
      {children}
    </span>
  );
}
export function Empty({
  title,
  description,
  action,
  heading: Heading = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  heading?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={s.empty}>
      <Inbox size={28} aria-hidden />
      <Heading className={s.smallHeading}>{title}</Heading>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  href,
  label = "Все",
}: {
  title: ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className={s.between}>
      <h2>{title}</h2>
      {href && (
        <Link
          href={href}
          className={`${s.row} ${s.caption}`}
          aria-label={
            typeof title === "string" ? `${label} — ${title}` : undefined
          }
        >
          {label}
          <ArrowUpRight size={15} aria-hidden />
        </Link>
      )}
    </div>
  );
}
export function Avatar({
  name,
  src,
  unoptimized,
}: {
  name: string;
  src?: string | null;
  unoptimized?: boolean;
}) {
  if (src)
    return (
      <Image
        className={s.avatar}
        src={src}
        width={40}
        height={40}
        alt=""
        unoptimized={unoptimized}
      />
    );
  return (
    <span className={s.avatar} aria-hidden>
      {name
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")}
    </span>
  );
}
export function Tabs({
  items,
  active,
}: {
  items: { id: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <nav className={s.tabs} aria-label="Вкладки раздела">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={s.tab}
          aria-current={active === item.id ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
