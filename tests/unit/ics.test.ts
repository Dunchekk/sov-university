import { describe, it, expect } from "vitest";
import nodeIcal, { type VEvent } from "node-ical";
import { parseImport, exportICS } from "@/modules/calendar/ics";
import type { CalendarEvent } from "@/modules/calendar/types";
const wrap = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const event = (body: string) => `BEGIN:VEVENT\r\n${body}\r\nEND:VEVENT`;
const options = {
  name: "Test",
  from: "2026-03-01",
  to: "2026-05-01",
  timezone: "Europe/Moscow",
};
describe("ICS standard library boundary", () => {
  it("rejects invalid source intervals before expansion and preserves zero-duration instants", async () => {
    await expect(
      parseImport(
        wrap(
          event(
            "UID:reverse\r\nDTSTART;VALUE=DATE:20260322\r\nDTEND;VALUE=DATE:20260321",
          ),
        ),
        options,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      parseImport(
        wrap(
          event(
            "UID:reverse\r\nDTSTART:20260322T100000Z\r\nDTEND:20260322T090000Z",
          ),
        ),
        options,
      ),
    ).rejects.toMatchObject({ status: 422 });
    const parsed = await parseImport(
      wrap(event("UID:instant\r\nDTSTART:20260322T100000Z")),
      options,
    );
    expect(parsed.events[0].startsAt).toBe(parsed.events[0].endsAt);
  });
  it("handles DST, duration, EXDATE cancellation and original identity of a moved occurrence", async () => {
    const parsed = await parseImport(
      wrap(
        event(
          "UID:series\r\nDTSTART;TZID=Europe/Berlin:20260322T100000\r\nDURATION:PT1H\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE;TZID=Europe/Berlin:20260329T100000\r\nSUMMARY:Семинар",
        ),
        event(
          "UID:series\r\nRECURRENCE-ID;TZID=Europe/Berlin:20260405T100000\r\nDTSTART;TZID=Europe/Berlin:20260406T110000\r\nDURATION:PT2H\r\nSUMMARY:Перенос",
        ),
      ),
      options,
    );
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0].startsAt).toBe("2026-03-22T09:00:00.000Z");
    expect(parsed.events.find((e) => e.cancelled)?.recurrenceKey).toBe(
      "2026-03-29T08:00:00.000Z",
    );
    const moved = parsed.events.find((e) => e.title === "Перенос")!;
    expect(moved.recurrenceKey).toBe("2026-04-05T08:00:00.000Z");
    expect(moved.startsAt).toBe("2026-04-06T09:00:00.000Z");
    expect(moved.endsAt).toBe("2026-04-06T11:00:00.000Z");
  });
  it("keeps all-day dates and applies selected timezone only to floating times", async () => {
    const parsed = await parseImport(
      wrap(
        event(
          "UID:day\r\nDTSTART;VALUE=DATE:20260329\r\nDTEND;VALUE=DATE:20260331\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Выходные",
        ),
        event(
          "UID:floating\r\nDTSTART:20260329T120000\r\nDTEND:20260329T130000\r\nSUMMARY:Планы",
        ),
      ),
      options,
    );
    expect(parsed.events.find((e) => e.uid === "day")).toMatchObject({
      startDate: "2026-03-29",
      endDate: "2026-03-31",
      startsAt: null,
    });
    expect(parsed.events.find((e) => e.uid === "floating")?.startsAt).toBe(
      "2026-03-29T09:00:00.000Z",
    );
    expect(parsed.warnings.join(" ")).toContain("Europe/Moscow");
  });
  it("reports unsupported components and unknown timezones without guessing", async () => {
    const parsed = await parseImport(
      wrap(
        event(
          "UID:bad\r\nDTSTART;TZID=Mars/Olympus:20260322T100000\r\nDTEND;TZID=Mars/Olympus:20260322T110000\r\nSUMMARY:Не угадать",
        ),
        "BEGIN:VTODO\r\nUID:todo\r\nSUMMARY:Задача\r\nEND:VTODO",
      ),
      options,
    );
    expect(parsed.events).toEqual([]);
    expect(parsed.warnings.join(" ")).toContain("TZID");
    expect(parsed.warnings.join(" ")).toContain("VTODO");
  });
  it("rejects size, base-event and recurrence limits without returning a partial import", async () => {
    await expect(
      parseImport("x".repeat(5 * 1024 * 1024 + 1), options),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      parseImport(
        wrap(
          ...Array.from({ length: 2001 }, (_, i) =>
            event(
              `UID:${i}\r\nDTSTART:20260322T100000Z\r\nDTEND:20260322T110000Z`,
            ),
          ),
        ),
        options,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      parseImport(
        wrap(
          event(
            "UID:dense\r\nDTSTART:20260301T000000Z\r\nDURATION:PT1S\r\nRRULE:FREQ=SECONDLY;COUNT=20000",
          ),
        ),
        options,
      ),
    ).rejects.toMatchObject({ status: 422 });
  }, 12000);
  it("exports UTF-8 folded CRLF and stable UID/sequence/cancellation with an independent parser", () => {
    const data: CalendarEvent = {
      id: "e",
      uid: "stable@ryadom.local",
      type: "PERSONAL",
      title: "Кириллица, точка; слеш\\ и перенос\n".repeat(8),
      description: "<script>literal</script>",
      location: "Аудитория",
      startsAt: null,
      endsAt: null,
      startDate: "2026-03-29",
      endDate: "2026-03-31",
      timezone: "Europe/Moscow",
      source: "Личное",
      comparison: false,
      cancelled: true,
      sequence: 2,
      updatedAt: "2026-03-20T10:00:00Z",
      editable: true,
    };
    const exported = exportICS([data]);
    expect(exported.replaceAll("\r\n", "")).not.toContain("\n");
    expect(
      exported.split("\r\n").every((line) => Buffer.byteLength(line) <= 76),
    ).toBe(true);
    const parsed = nodeIcal.sync.parseICS(exported)[
      "stable@ryadom.local"
    ] as VEvent;
    expect(parsed.type).toBe("VEVENT");
    if (parsed.type !== "VEVENT") throw new Error("Expected event");
    expect(parsed.summary).toBe(data.title);
    expect(parsed.status).toBe("CANCELLED");
    expect(parsed.sequence).toBe(2);
    expect(parsed.start.dateOnly).toBe(true);
    expect(parsed.start.getDate()).toBe(29);
    expect(parsed.end!.getDate()).toBe(31);
  });
});
