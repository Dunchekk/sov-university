import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import s from "./ui.module.css";
export { default as ui } from "./ui.module.css";
export function Button({
  variant = "default",
  small = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.pageTitle}>
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      <Inbox size={28} />
      <h3>{title}</h3>
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
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className={s.between}>
      <h2>{title}</h2>
      {href && (
        <Link href={href} className={`${s.row} ${s.caption}`}>
          {label}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Avatar({ name }: { name: string }) {
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
