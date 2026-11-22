import type { ReactNode } from "react";
import s from "./page-container.module.css";

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <main id="main" className={s.container} tabIndex={-1}>
      {children}
    </main>
  );
}
