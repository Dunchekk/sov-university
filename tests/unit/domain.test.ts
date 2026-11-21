import { describe, it, expect } from "vitest";
import {
  attendanceStats,
  gradeSummary,
  type Scheme,
} from "@/modules/assessment/domain";
import { timedLayout, eventsOnDay } from "@/modules/calendar/layout";
import { readLimited } from "@/server/body";
import type { CalendarEvent } from "@/modules/calendar/types";
const clock = { now: () => new Date("2026-11-11T12:00:00Z") };
it("a midnight instant belongs only to its new Moscow day", () => {
  const instant = {
    startsAt: "2026-11-11T21:00:00.000Z",
    endsAt: "2026-11-11T21:00:00.000Z",
  } as CalendarEvent;
  expect(eventsOnDay([instant], "2026-11-11")).toHaveLength(0);
  expect(eventsOnDay([instant], "2026-11-12")).toHaveLength(1);
  expect(eventsOnDay([instant], "2026-11-13")).toHaveLength(0);
});
const scheme: Scheme = {
  version: 1,
  type: "POINTS",
  admissionPoints: 50,
  passPoints: 60,
  attendanceThreshold: 80,
  attendancePenalty: 1,
  excludeExcused: true,
  thresholds: [
    { points: 0, grade: 1 },
    { points: 60, grade: 6 },
    { points: 80, grade: 8 },
  ],
};
const lesson = {
  startsAt: new Date("2026-11-01T09:00:00Z"),
  endsAt: new Date("2026-11-01T10:00:00Z"),
  cancelled: false,
};
const rows = (present: number, absent: number) => [
  ...Array.from({ length: present }, () => ({ status: "PRESENT", lesson })),
  ...Array.from({ length: absent }, () => ({ status: "ABSENT", lesson })),
];
describe("attendance", () => {
  it("7/10 needs five visits to reach 80%", () => {
    const a = attendanceStats(rows(7, 3), scheme, 6, clock);
    expect(a).toMatchObject({ percentage: 70, needed: 5, reachable: true });
    expect(attendanceStats(rows(7, 3), scheme, 4, clock).reachable).toBe(false);
  });
  it("exact boundary, no data and unattainable 100%", () => {
    expect(attendanceStats(rows(8, 2), scheme, 0, clock).needed).toBe(0);
    expect(attendanceStats([], scheme, 6, clock).percentage).toBeNull();
    expect(
      attendanceStats(
        rows(8, 2),
        { ...scheme, attendanceThreshold: 100 },
        50,
        clock,
      ).needed,
    ).toBeNull();
  });
  it("does not count future, cancelled, excused or missing as absence", () => {
    const a = attendanceStats(
      [
        ...rows(7, 3),
        { status: "EXCUSED", lesson },
        { status: "UNRECORDED", lesson },
        { status: "ABSENT", lesson: { ...lesson, cancelled: true } },
        {
          status: "ABSENT",
          lesson: { ...lesson, endsAt: new Date("2027-01-01") },
        },
      ],
      scheme,
      6,
      clock,
    );
    expect(a).toMatchObject({
      total: 10,
      excused: 1,
      unrecorded: 1,
      percentage: 70,
    });
  });
});
describe("grades", () => {
  const a = attendanceStats(rows(7, 3), scheme, 6, clock);
  it("counts points for checked work and satisfies its mandatory requirement", () => {
    const result = gradeSummary(
      [
        {
          id: "checked",
          title: "Проверенная работа",
          maxPoints: 100,
          mandatory: true,
          dueAt: lesson.endsAt,
          results: [{ points: 84, status: "CHECKED" }],
        },
      ],
      scheme,
      a,
      clock,
    );
    expect(result).toMatchObject({
      points: 84,
      missing: [],
      remaining: 0,
      admitted: true,
    });
  });
  it("expired mandatory work prevents ordinary pass despite enough points", () => {
    const result = gradeSummary(
      [
        {
          id: "a",
          title: "Контрольная",
          maxPoints: 70,
          mandatory: false,
          dueAt: lesson.endsAt,
          results: [{ points: 70, status: "PUBLISHED" }],
        },
        {
          id: "b",
          title: "Лабораторная",
          maxPoints: 30,
          mandatory: true,
          dueAt: lesson.endsAt,
          results: [],
        },
      ],
      scheme,
      a,
      clock,
    );
    expect(result).toMatchObject({
      points: 70,
      admitted: false,
      canReachPass: false,
      blockedMandatory: ["Лабораторная"],
      baseGrade: 6,
      projectedGrade: 5,
      penalty: 1,
    });
  });
  it("unpublished null is pending, published zero is an actual result", () => {
    const result = gradeSummary(
      [
        {
          id: "a",
          title: "A",
          maxPoints: 50,
          mandatory: true,
          dueAt: new Date("2026-12-01"),
          results: [{ points: null, status: "SUBMITTED" }],
        },
        {
          id: "b",
          title: "B",
          maxPoints: 50,
          mandatory: false,
          dueAt: lesson.endsAt,
          results: [{ points: 0, status: "PUBLISHED" }],
        },
      ],
      scheme,
      a,
      clock,
    );
    expect(result).toMatchObject({ points: 0, remaining: 50, missing: [] });
  });
});
it("visual minimum height does not overlap neighbouring short event", () => {
  const event = (id: string, start: string, end: string) =>
    ({
      id,
      startsAt: `2026-11-11T${start}:00+03:00`,
      endsAt: `2026-11-11T${end}:00+03:00`,
    }) as CalendarEvent;
  const result = timedLayout(
    [event("deadline", "10:00", "10:01"), event("lesson", "10:05", "11:00")],
    "2026-11-11",
  );
  expect(result.map((e) => e.lane)).toEqual([0, 1]);
  expect(result.every((e) => e.lanes === 2 && !e.conflict)).toBe(true);
});
it("bounded reader stops oversized streaming input", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(100));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("http://localhost", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(readLimited(req, 50)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});
