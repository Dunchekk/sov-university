import { Worker } from "node:worker_threads";
import path from "node:path";
import ICAL from "ical.js";
import { z } from "zod";
import { AppError, invariant } from "@/server/errors";
import { validTimezone } from "@/shared/lib/time";
import type { CalendarEvent } from "./types";

export const importOptions = z
  .object({
    name: z.string().trim().min(1).max(100),
    sourceId: z.string().max(150).optional(),
    timezone: z
      .string()
      .max(100)
      .refine(validTimezone, "Неизвестный часовой пояс."),
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .strict()
  .refine(
    (v) =>
      v.to > v.from &&
      new Date(v.to).getTime() - new Date(v.from).getTime() <= 366 * 86400000,
    "Выберите диапазон до 12 месяцев.",
  );
export type ImportOptions = z.infer<typeof importOptions>;
export type ImportedOccurrence = {
  uid: string;
  recurrenceKey: string;
  title: string;
  description: string;
  location: string;
  url: string | null;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  cancelled: boolean;
  contentHash: string;
};
export type ParsedImport = {
  events: ImportedOccurrence[];
  warnings: string[];
  duplicates: number;
  baseEvents: number;
};
let active = 0;
export async function parseImport(
  original: string,
  options: ImportOptions,
): Promise<ParsedImport> {
  importOptions.parse(options);
  invariant(
    Buffer.byteLength(original) <= 5 * 1024 * 1024,
    413,
    "ICS_SIZE",
    "Файл должен быть не больше 5 MiB.",
  );
  invariant(
    active < 2,
    429,
    "IMPORT_BUSY",
    "Сейчас разбираются другие файлы. Повторите через несколько секунд.",
  );
  active++;
  try {
    return await new Promise<ParsedImport>((resolve, reject) => {
      const worker = new Worker(
        path.join(process.cwd(), "runtime/ics-worker.mjs"),
        {
          workerData: { original, ...options },
          resourceLimits: { maxOldGenerationSizeMb: 96, stackSizeMb: 4 },
          stdout: true,
          stderr: true,
        },
      );
      worker.stdout.resume();
      worker.stderr.resume();
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(
          new AppError(
            422,
            "ICS_COMPLEXITY",
            "Разбор занял слишком много времени. Уменьшите диапазон или разделите файл.",
          ),
        );
      }, 8000);
      worker.once(
        "message",
        (data: { result?: ParsedImport; error?: string }) => {
          clearTimeout(timer);
          void worker.terminate();
          if (data.result) resolve(data.result);
          else
            reject(
              new AppError(
                422,
                "ICS_PARSE",
                data.error ?? "Не удалось прочитать ICS.",
              ),
            );
        },
      );
      worker.once("error", () => {
        clearTimeout(timer);
        reject(
          new AppError(
            422,
            "ICS_COMPLEXITY",
            "Превышен лимит разбора ICS. Уменьшите диапазон или разделите файл.",
          ),
        );
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(
            new AppError(422, "ICS_PARSE", "Не удалось завершить разбор ICS."),
          );
      });
    });
  } finally {
    active--;
  }
}

export function exportICS(events: CalendarEvent[]) {
  const calendar = new ICAL.Component("vcalendar");
  calendar.addPropertyWithValue("version", "2.0");
  calendar.addPropertyWithValue("prodid", "-//Ryadom//Student Portal 1.0//RU");
  calendar.addPropertyWithValue("calscale", "GREGORIAN");
  const instant = (value: string) =>
    ICAL.Time.fromJSDate(new Date(value), true);
  for (const event of events) {
    const item = new ICAL.Component("vevent");
    item.addPropertyWithValue("uid", event.uid);
    item.addPropertyWithValue("summary", event.title);
    item.addPropertyWithValue(
      "description",
      event.exportDescription ?? event.description,
    );
    item.addPropertyWithValue("location", event.location);
    if (event.url?.startsWith("https://"))
      item.addPropertyWithValue("url", event.url);
    item.addPropertyWithValue(
      "dtstart",
      event.startDate
        ? ICAL.Time.fromDateString(event.startDate)
        : instant(event.startsAt!),
    );
    item.addPropertyWithValue(
      "dtend",
      event.endDate
        ? ICAL.Time.fromDateString(event.endDate)
        : instant(event.endsAt!),
    );
    item.addPropertyWithValue("sequence", event.sequence);
    item.addPropertyWithValue("dtstamp", instant(event.updatedAt));
    item.addPropertyWithValue("last-modified", instant(event.updatedAt));
    item.addPropertyWithValue(
      "status",
      event.cancelled ? "CANCELLED" : "CONFIRMED",
    );
    calendar.addSubcomponent(item);
  }
  return calendar.toString() + "\r\n";
}
export const icsHeaders = {
  "Content-Type": "text/calendar; charset=utf-8",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
