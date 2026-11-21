"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import { ui } from "@/shared/ui/primitives";
import s from "./community.module.css";

const NavigationContext = createContext<{
  pending: boolean;
  navigate: (href: string) => void;
} | null>(null);

export function useFeedNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("FeedNavigation is required");
  return navigation;
}

export function FeedNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <NavigationContext.Provider value={{ pending, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function FeedLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "scroll"> & {
  href: string;
}) {
  const { navigate } = useFeedNavigation();
  return (
    <Link
      {...props}
      href={href}
      scroll={false}
      onNavigate={(event) => {
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}

export function FeedResults({ children }: { children: ReactNode }) {
  const { pending } = useFeedNavigation();
  return <div aria-busy={pending}>{pending ? <FeedSkeleton /> : children}</div>;
}

function FeedSkeleton() {
  return (
    <div role="status" aria-label="Загрузка публикаций">
      <div className={s.feed} aria-hidden>
        {[0, 1, 2].map((index) => (
          <div key={index} className={s.post}>
            <div className={`${ui.skeleton} ${s.skeletonMedia}`} />
            <div className={s.skeletonCopy}>
              <div className={ui.skeleton} />
              <div className={ui.skeleton} />
              <div className={ui.skeleton} />
              <div className={ui.skeleton} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
