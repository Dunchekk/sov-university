import type { Metadata } from "next";
import { cookies } from "next/headers";
import { brand } from "@/shared/config/brand";
import "@/shared/styles/globals.css";
export const metadata: Metadata = {
  title: {
    default: `${brand.name} — личный кабинет`,
    template: `%s · ${brand.name}`,
  },
  description: `Личный кабинет студента · ${brand.university}`,
  robots: { index: false, follow: false },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await cookies()).get("theme")?.value;
  const preference =
    cookie === "light" || cookie === "dark" ? cookie : "system";
  return (
    <html lang="ru" data-theme={preference}>
      <body>{children}</body>
    </html>
  );
}
