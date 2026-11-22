import { randomUUID } from "node:crypto";
import nodeIcal, { type VEvent } from "node-ical";
import { test, expect } from "./fixtures";
import { db } from "../../src/server/db";
import { addDays, dateKey } from "../../src/shared/lib/time";
const wrap = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const event = (body: string) => `BEGIN:VEVENT\r\n${body}\r\nEND:VEVENT`;
const fixed =
  "UID:series\r\nDTSTART;TZID=Europe/Berlin:20260322T100000\r\nDURATION:PT1H\r\nRRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE;TZID=Europe/Berlin:20260329T100000\r\nSUMMARY:Семинар";

test("a hidden assessment disappears from both calendars without changing course results", async ({
  student,
  other,
}) => {
  const assessment = await db.assessment.findUniqueOrThrow({
    where: { id: "assessment-1-0" },
  });
  const from = dateKey(assessment.dueAt);
  const range = `from=${from}&to=${addDays(from, 1)}&types=DEADLINE`;
  const accounts = [student, other];
  const resultsPath = `/api/courses/${assessment.courseId}/results`;
  const before = await Promise.all(
    accounts.map(async (account) => {
      const listed = await account.get(`/api/calendar/events?${range}`);
      expect(listed.ok()).toBe(true);
      expect(await listed.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: assessment.id }),
        ]),
      );
      const result = await account.get(resultsPath);
      expect(result.ok()).toBe(true);
      return result.json();
    }),
  );

  try {
    await db.assessment.update({
      where: { id: assessment.id },
      data: { calendarVisible: false },
    });
    for (const [index, account] of accounts.entries()) {
      const listed = await account.get(
        `/api/calendar/events?${range}&course=${assessment.courseId}`,
      );
      expect(listed.ok()).toBe(true);
      expect(await listed.json()).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: assessment.id }),
        ]),
      );
      const ics = await account.get(`/api/calendar/export.ics?${range}`);
      expect(ics.ok()).toBe(true);
      expect(await ics.text()).not.toContain(
        `UID:${assessment.id}@ryadom.local`,
      );
      const result = await account.get(resultsPath);
      expect(result.ok()).toBe(true);
      expect(await result.json()).toEqual(before[index]);
    }
  } finally {
    await db.assessment.update({
      where: { id: assessment.id },
      data: {
        calendarVisible: assessment.calendarVisible,
        updatedAt: assessment.updatedAt,
      },
    });
  }
});

test("loaded events use browser history and schedule searches wait for the dialog", async ({
  studentPage: page,
}) => {
  const retake = await db.retake.findUniqueOrThrow({
    where: { id: "retake-a" },
  });
  const day = dateKey(retake.startsAt);
  const calendarRequests: string[] = [];
  const scheduleRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/calendar" && url.searchParams.get("date") === day)
      calendarRequests.push(url.search);
    if (url.pathname.startsWith("/api/schedules/"))
      scheduleRequests.push(url.pathname);
  });

  await page.goto(`/calendar?date=${day}&view=week`);
  const card = page
    .locator('button[data-type="EXAM"]')
    .filter({ hasText: retake.title });
  const dialog = page.getByRole("dialog", { name: retake.title, exact: true });
  await card.click();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Елена Викторовна Белова" }),
  ).toHaveAttribute("href", "/people/lecturer-2");
  await expect(page).toHaveURL(new RegExp(`event=${retake.id}`));
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/event=/);
  await page.goBack();
  await expect(dialog).toBeVisible();
  await page.goForward();
  await expect(dialog).toBeHidden();
  expect(calendarRequests).toHaveLength(1);
  expect(scheduleRequests).toHaveLength(0);

  const searchLoaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/schedules/search",
  );
  await page.getByRole("button", { name: "Сравнить расписания" }).click();
  await expect(
    page.getByRole("dialog", { name: "Сравнение расписаний" }),
  ).toBeVisible();
  expect((await searchLoaded).ok()).toBe(true);
  expect(scheduleRequests).toContain("/api/schedules/saved");
});

test("exam tags match the schedule and the mini calendar marks the session independently of filters", async ({
  studentPage: page,
}) => {
  const [retake, exams] = await Promise.all([
    db.retake.findUniqueOrThrow({ where: { id: "retake-a" } }),
    db.lesson.findMany({
      where: { id: { startsWith: "exam-enroll-student-a-" } },
      orderBy: { startsAt: "asc" },
    }),
  ]);
  const firstDay = dateKey(exams[0].startsAt);
  const lastDay = dateKey(exams.at(-1)!.startsAt);
  const retakeDay = dateKey(retake.startsAt);
  await page.goto(`/calendar?date=${retakeDay}&view=week&event=${retake.id}`);
  const dialog = page.getByRole("dialog", { name: retake.title, exact: true });
  const badge = dialog.getByText("Экзамен", { exact: true });
  const examCard = page
    .locator('button[data-type="EXAM"]')
    .filter({
      hasText: retake.title,
    })
    .first();
  const colors = await examCard.evaluate((element) => ({
    text: getComputedStyle(element).color,
    background: getComputedStyle(element).backgroundColor,
  }));
  await expect(badge).toHaveCSS("color", colors.text);
  await expect(badge).toHaveCSS("background-color", colors.background);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const picker = page.getByRole("region", { name: "Выбор даты" });
  await expect(
    picker.locator(`[data-date="${retakeDay}"]`),
  ).not.toHaveAttribute("data-session", "true");
  await page.goto(`/calendar?date=${firstDay}&view=month&types=LESSON`);
  await expect(page.locator('button[data-type="EXAM"]')).toHaveCount(0);
  for (const day of [firstDay, addDays(firstDay, 1), lastDay]) {
    await expect(picker.locator(`[data-date="${day}"]`)).toHaveAttribute(
      "data-session",
      "true",
    );
  }
  await expect(
    picker.locator(`[data-date="${addDays(lastDay, 1)}"]`),
  ).not.toHaveAttribute("data-session", "true");
});

test("an imported midnight instant appears in its calendar day and no adjacent day", async ({
  student,
}) => {
  const original = wrap(
    event("UID:midnight\r\nDTSTART:20260321T210000Z\r\nSUMMARY:Полночь"),
  );
  const preview = await student.post("/api/calendar/imports/preview", {
    multipart: {
      name: "Midnight regression",
      timezone: "Europe/Moscow",
      from: "2026-03-22",
      to: "2026-03-23",
      file: {
        name: "instant.ics",
        mimeType: "text/calendar",
        buffer: Buffer.from(original),
      },
    },
  });
  expect(preview.status()).toBe(200);
  const p = await preview.json();
  expect(p.total).toBe(1);
  const committed = await student.post(`/api/calendar/imports/${p.id}/commit`, {
    data: {},
  });
  expect(committed.status()).toBe(200);
  const source = (await committed.json()).sourceId;
  try {
    for (const [from, to, count] of [
      ["2026-03-21", "2026-03-22", 0],
      ["2026-03-22", "2026-03-23", 1],
      ["2026-03-23", "2026-03-24", 0],
    ] as const) {
      const events = await (
        await student.get(
          `/api/calendar/events?from=${from}&to=${to}&types=PERSONAL`,
        )
      ).json();
      expect(
        events.filter((e: { sourceId: string }) => e.sourceId === source),
      ).toHaveLength(count);
    }
  } finally {
    await student.delete(`/api/calendar/imports/sources/${source}`);
  }
});
test("ICS preview/commit ownership, retry, updates, replacement and expiry", async ({
  student,
  other,
}) => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/ryadom_test");
  const file = wrap(
    event(fixed),
    event(
      "UID:day\r\nDTSTART;VALUE=DATE:20260329\r\nDTEND;VALUE=DATE:20260331\r\nSUMMARY:Выходные",
    ),
  );
  const prepare = async (original: string, sourceId = "") =>
    student.post("/api/calendar/imports/preview", {
      multipart: {
        name: "QA импорт",
        sourceId,
        timezone: "Europe/Moscow",
        from: "2026-03-01",
        to: "2026-05-01",
        file: {
          name: "plans.ics",
          mimeType: "text/calendar",
          buffer: Buffer.from(original),
        },
      },
    });
  const preview = await prepare(file);
  expect(preview.status()).toBe(200);
  const p = await preview.json();
  expect(p.total).toBe(4);
  expect(
    (
      await other.post(`/api/calendar/imports/${p.id}/commit`, { data: {} })
    ).status(),
  ).toBe(404);
  expect(
    (
      await student.post(`/api/calendar/imports/${p.id}/commit`, {
        data: { events: [] },
      })
    ).status(),
  ).toBe(422);
  const [one, two] = await Promise.all([
    student.post(`/api/calendar/imports/${p.id}/commit`, { data: {} }),
    student.post(`/api/calendar/imports/${p.id}/commit`, { data: {} }),
  ]);
  expect(one.status()).toBe(200);
  expect(two.status()).toBe(200);
  const saved = await one.json();
  expect(await two.json()).toEqual(saved);
  expect(saved.added).toBe(4);
  const sourceId = saved.sourceId;
  try {
    expect(
      (await db.importPreview.findUniqueOrThrow({ where: { id: p.id } }))
        .original,
    ).toBeNull();
    const replay = await (await prepare(file, sourceId)).json();
    expect(replay.unchanged).toBe(4);
    expect(
      (
        await (
          await student.post(`/api/calendar/imports/${replay.id}/commit`, {
            data: {},
          })
        ).json()
      ).added,
    ).toBe(0);
    const before = await db.importedEvent.findMany({
      where: { sourceId },
      orderBy: { recurrenceKey: "asc" },
    });
    const movedFile = wrap(
      event(fixed),
      event(
        "UID:series\r\nRECURRENCE-ID;TZID=Europe/Berlin:20260405T100000\r\nDTSTART;TZID=Europe/Berlin:20260406T110000\r\nDURATION:PT2H\r\nSUMMARY:Перенос",
      ),
    );
    const update = await (await prepare(movedFile, sourceId)).json();
    const change = await (
      await student.post(`/api/calendar/imports/${update.id}/commit`, {
        data: {},
      })
    ).json();
    expect(change.updated).toBe(1);
    expect(change.added).toBe(0);
    const after = await db.importedEvent.findMany({
      where: { sourceId },
      orderBy: { recurrenceKey: "asc" },
    });
    expect(after.map((e) => e.id)).toEqual(before.map((e) => e.id));
    expect(after.find((e) => e.title === "Перенос")).toMatchObject({
      recurrenceKey: "2026-04-05T08:00:00.000Z",
      sequence: 1,
    });
    const q = "from=2026-03-01&to=2026-05-01&types=PERSONAL";
    const own = await (await student.get(`/api/calendar/events?${q}`)).json();
    expect(own.some((e: { sourceId: string }) => e.sourceId === sourceId)).toBe(
      true,
    );
    const foreign = await (
      await other.get(
        `/api/calendar/events?${q}&schedules=group:group-design-21`,
      )
    ).json();
    expect(
      foreign.some((e: { sourceId: string }) => e.sourceId === sourceId),
    ).toBe(false);
    expect(
      (
        await other.delete(`/api/calendar/imports/sources/${sourceId}`)
      ).status(),
    ).toBe(404);
    const replacement = await (await prepare(movedFile, sourceId)).json();
    expect(
      (
        await (
          await student.post(`/api/calendar/imports/${replacement.id}/commit`, {
            data: { replace: true },
          })
        ).json()
      ).removed,
    ).toBe(1);
    const stale = await (await prepare(file, sourceId)).json();
    await db.importPreview.update({
      where: { id: stale.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(
      (
        await student.post(`/api/calendar/imports/${stale.id}/commit`, {
          data: {},
        })
      ).status(),
    ).toBe(410);
  } finally {
    await student.delete(`/api/calendar/imports/sources/${sourceId}`);
  }
});

test("export/feed stay private, update a stable lesson UID, cancel and revoke even with ETag", async ({
  student,
  other,
  request,
}) => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/ryadom_test");
  const day = dateKey(),
    to = addDays(day, 10);
  const own = await (
    await student.post("/api/calendar/personal-events", {
      data: {
        title: `QA personal ${randomUUID()}`,
        description: "Личная заметка",
        startDate: day,
        endDate: addDays(day, 1),
      },
    })
  ).json();
  const defaultExport = await student.get(
    `/api/calendar/export.ics?from=${day}&to=${to}`,
  );
  expect(defaultExport.headers()["content-type"]).toContain("text/calendar");
  expect(defaultExport.headers()["content-disposition"]).toContain(
    "attachment",
  );
  expect(await defaultExport.text()).not.toContain(own.id);
  expect(await defaultExport.text()).not.toContain(
    "Не достигнут порог положительной оценки",
  );
  expect(
    (
      await other.get(
        `/api/calendar/export.ics?from=${day}&to=${to}&types=PERSONAL&event=${own.id}`,
      )
    ).status(),
  ).toBe(404);
  const created = await (
    await student.post("/api/calendar/feeds", {
      data: { name: "QA calendar", layers: ["LESSON", "EXAM", "PERSONAL"] },
    })
  ).json();
  try {
    const stored = await db.calendarFeed.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.tokenHash).toHaveLength(64);
    expect(
      JSON.stringify(await (await student.get("/api/calendar/feeds")).json()),
    ).not.toContain(created.url);
    expect(
      (await other.delete(`/api/calendar/feeds/${created.id}`)).status(),
    ).toBe(404);
    const first = await request.get(created.url);
    expect(first.status()).toBe(200);
    expect(first.headers()["cache-control"]).toContain("no-store");
    const etag = first.headers().etag;
    expect(
      (
        await request.get(created.url, { headers: { "If-None-Match": etag } })
      ).status(),
    ).toBe(304);
    expect(await first.text()).toContain(own.id);
    const lesson = await db.lesson.findFirstOrThrow({
      where: {
        startsAt: { gte: new Date(), lt: new Date(Date.now() + 10 * 86400000) },
        course: { enrollments: { some: { studentId: "student-a" } } },
        cancelled: false,
      },
    });
    try {
      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          startsAt: new Date(+lesson.startsAt + 3600000),
          endsAt: new Date(+lesson.endsAt + 3600000),
          sequence: { increment: 1 },
        },
      });
      const moved = await request.get(created.url);
      const text = await moved.text();
      const parsed = nodeIcal.sync.parseICS(text);
      const item = parsed[`${lesson.id}@ryadom.local`] as VEvent;
      expect(item.type).toBe("VEVENT");
      if (item.type !== "VEVENT") throw new Error("Missing lesson");
      expect(item.start.toISOString()).toBe(
        new Date(+lesson.startsAt + 3600000).toISOString(),
      );
      expect(item.sequence).toBe(lesson.sequence + 1);
      expect(text.split(`UID:${lesson.id}@ryadom.local`)).toHaveLength(2);
      await db.lesson.update({
        where: { id: lesson.id },
        data: { cancelled: true, sequence: { increment: 1 } },
      });
      const cancelled = nodeIcal.sync.parseICS(
        await (await request.get(created.url)).text(),
      )[`${lesson.id}@ryadom.local`] as VEvent;
      expect(cancelled.type === "VEVENT" && cancelled.status).toBe("CANCELLED");
    } finally {
      await db.lesson.update({
        where: { id: lesson.id },
        data: {
          startsAt: lesson.startsAt,
          endsAt: lesson.endsAt,
          cancelled: lesson.cancelled,
          sequence: { increment: 1 },
        },
      });
    }
    expect(
      (await student.delete(`/api/calendar/feeds/${created.id}`)).status(),
    ).toBe(200);
    expect(
      (
        await request.get(created.url, { headers: { "If-None-Match": etag } })
      ).status(),
    ).toBe(404);
  } finally {
    await student.delete(`/api/calendar/feeds/${created.id}`);
    await student.delete(`/api/calendar/personal-events/${own.id}`);
  }
});

test("browser imports a file, confirms its preview and navigates calendar views", async ({
  studentPage: page,
  student,
}) => {
  const name = `QA browser ${randomUUID().slice(0, 8)}`;
  const day = dateKey();
  await page.goto("/calendar?view=week");
  await page
    .getByRole("button", { name: "Импорт и подписки", exact: true })
    .click();
  const connections = page.getByRole("dialog", {
    name: "Импорт и подписки",
    exact: true,
  });
  await expect(connections).toBeVisible();
  await expect(connections).toHaveCSS("scrollbar-width", "none");
  const pickEnd = connections.getByRole("button", {
    name: "Выбрать дату «По»",
  });
  const datePicker = connections.getByRole("dialog", {
    name: "Выбор даты «По»",
  });
  await pickEnd.click();
  await expect(datePicker.getByRole("button", { pressed: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(datePicker).toBeHidden();
  await expect(connections).toBeVisible();
  await expect(pickEnd).toBeFocused();
  await pickEnd.click();
  const end = addDays(day, 7);
  await datePicker.locator(`[data-date="${end}"]`).click();
  await expect(
    connections.getByRole("textbox", { name: "По", exact: true }),
  ).toHaveValue(end.split("-").reverse().join("."));
  const exportRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/calendar/export.ics" &&
      url.searchParams.get("from") === day &&
      url.searchParams.get("to") === addDays(end, 1)
    );
  });
  await connections.getByRole("button", { name: "Скачать календарь" }).click();
  await exportRequest;
  await page
    .getByRole("button", { name: "Импортировать", exact: true })
    .click();
  await page.getByLabel("Название слоя").fill(name);
  await page.getByLabel("Файл ICS").setInputFiles({
    name: "browser.ics",
    mimeType: "text/calendar",
    buffer: Buffer.from(
      wrap(
        event(
          `UID:browser\r\nDTSTART;VALUE=DATE:${day.replaceAll("-", "")}\r\nDTEND;VALUE=DATE:${addDays(day, 1).replaceAll("-", "")}\r\nSUMMARY:${name}\r\nLOCATION:Корпус А · 405`,
        ),
      ),
    ),
  });
  await page.getByRole("button", { name: "Посмотреть перед импортом" }).click();
  const dialog = page.getByRole("dialog", { name: "Предпросмотр импорта" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(connections).toBeVisible();
  await page.getByRole("button", { name: "Посмотреть перед импортом" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Подтвердить импорт" }).click();
  await expect(page.getByRole("status")).toContainText("Импорт завершён");
  const sources = (await (await student.get("/api/calendar/feeds")).json())
    .sources;
  const source = sources.find((s: { name: string }) => s.name === name);
  try {
    const layers = connections.locator("section").filter({
      has: page.getByRole("heading", { name: "Импортированные слои" }),
    });
    await expect(layers.getByText(name, { exact: true })).toBeVisible();
    for (const view of ["day", "week", "month"]) {
      await page.goto(`/calendar?view=${view}&date=${day}`);
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      const eventCard = page
        .getByRole("button")
        .filter({ hasText: name })
        .first();
      if (view === "month") {
        await expect(eventCard).toHaveText(name);
        expect((await eventCard.boundingBox())!.height).toBeLessThanOrEqual(24);
        await eventCard.click();
        await expect(
          page.getByRole("dialog", { name, exact: true }),
        ).toContainText("Корпус А · 405");
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("dialog", { name, exact: true }),
        ).not.toBeVisible();
      } else await expect(eventCard).toContainText("Корпус А · 405");
    }
    await page.reload();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  } finally {
    if (source)
      await student.delete(`/api/calendar/imports/sources/${source.id}`);
  }
});
