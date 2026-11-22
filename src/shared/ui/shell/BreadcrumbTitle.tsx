"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type RouteTitle = { path: string; title: string; parentHref?: string };
const RouteTitleContext = createContext<RouteTitle | null>(null);
const SetRouteTitleContext = createContext<Dispatch<
  SetStateAction<RouteTitle | null>
> | null>(null);

export function BreadcrumbTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<RouteTitle | null>(null);
  return (
    <SetRouteTitleContext.Provider value={setTitle}>
      <RouteTitleContext.Provider value={title}>
        {children}
      </RouteTitleContext.Provider>
    </SetRouteTitleContext.Provider>
  );
}

export function useBreadcrumbTitle(path: string) {
  const entry = useContext(RouteTitleContext);
  return entry?.path === path ? entry : null;
}

export function BreadcrumbTitle({ path, title, parentHref }: RouteTitle) {
  const setTitle = useContext(SetRouteTitleContext);
  useLayoutEffect(() => {
    const entry = { path, title, parentHref };
    setTitle?.(entry);
    return () => setTitle?.((current) => (current === entry ? null : current));
  }, [path, title, parentHref, setTitle]);
  return null;
}
