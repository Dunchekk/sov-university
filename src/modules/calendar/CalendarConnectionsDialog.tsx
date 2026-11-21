"use client";

import { useEffect, useState } from "react";
import { api } from "@/shared/lib/client";
import { ui } from "@/shared/ui/primitives";
import {
  CalendarConnections,
  type CalendarConnectionsData,
} from "./CalendarConnections";

export function CalendarConnectionsDialog({
  today,
  publicAddress,
  opening,
}: {
  today: string;
  publicAddress: boolean;
  opening: number;
}) {
  const [data, setData] = useState<CalendarConnectionsData>();
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<CalendarConnectionsData>("/api/calendar/feeds", {
      signal: controller.signal,
    }).then(
      (result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(false);
      },
      () => {
        if (!controller.signal.aborted) setError(true);
      },
    );
    return () => controller.abort();
  }, [opening, revision]);
  return (
    <>
      {error && (
        <p className={ui.error} role="alert">
          Не удалось загрузить подключения календаря.
        </p>
      )}
      {data ? (
        <CalendarConnections
          data={data}
          today={today}
          publicAddress={publicAddress}
          onChanged={() => setRevision((value) => value + 1)}
        />
      ) : (
        !error && (
          <div
            className={ui.skeleton}
            role="status"
            aria-label="Загрузка подключений"
          />
        )
      )}
    </>
  );
}
