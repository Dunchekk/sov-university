"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ComponentProps } from "react";
import { api } from "@/shared/lib/client";

async function markRead(id: string) {
  try {
    await api("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ id }),
      keepalive: true,
    });
    return true;
  } catch {
    // A failed read receipt should still allow opening the destination.
    return false;
  }
}

export async function openNotification(
  router: ReturnType<typeof useRouter>,
  href: string,
  unreadId: string,
) {
  const read = await markRead(unreadId);
  router.push(href);
  if (read) router.refresh();
}

export function NotificationLink({
  href,
  unreadId,
  onOpen,
  ...props
}: Pick<
  ComponentProps<typeof Link>,
  "children" | "className" | "aria-labelledby"
> & {
  href: string;
  unreadId?: string;
  onOpen?: () => void;
}) {
  const router = useRouter();
  const opening = useRef(false);

  async function readInBackground() {
    if (unreadId && (await markRead(unreadId))) router.refresh();
  }

  return (
    <Link
      {...props}
      href={href}
      data-unread={unreadId ? "" : undefined}
      onNavigate={async (event) => {
        if (!unreadId) return onOpen?.();
        event.preventDefault();
        if (opening.current) return;
        opening.current = true;
        try {
          onOpen?.();
          await openNotification(router, href, unreadId);
        } finally {
          opening.current = false;
        }
      }}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey)
          void readInBackground();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) void readInBackground();
      }}
    />
  );
}
