import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { test, expect, origin, login } from "./fixtures";
import { db } from "../../src/server/db";
import { addDays, dateKey } from "../../src/shared/lib/time";

async function clearTestRateLimits() {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/ryadom_test")
    throw new Error("Refusing non-test DB");
  await db.rateLimit.deleteMany();
  await db.loginAttempt.deleteMany();
}
test.beforeEach(async ({}, info) => {
  if (info.title.startsWith("auth:")) await clearTestRateLimits();
});
test.afterEach(async ({}, info) => {
  if (info.title.startsWith("auth:")) await clearTestRateLimits();
});

test("auth: neutral invalid password, registration closed, throttling, origin and logout revocation", async ({
  playwright,
}) => {
  const request = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const email = `missing-${randomUUID()}@example.org`;
  let limited = false;
  for (let i = 0; i < 6; i++) {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password: "intentionally-incorrect" },
    });
    if (response.status() === 429) {
      limited = true;
      break;
    }
    expect(response.status()).toBe(401);
  }
  expect(limited).toBe(true);
  await clearTestRateLimits();
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        data: { email, password: "intentionally-incorrect", name: "QA" },
      })
    ).status(),
  ).toBe(404);
  await login(request);
  const state = await request.storageState();
  const old = await playwright.request.newContext({
    baseURL: origin,
    storageState: state,
  });
  expect((await old.get("/api/me")).status()).toBe(200);
  expect(
    (
      await request.post("/api/auth/sign-out", {
        data: {},
        headers: { Origin: "https://foreign.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/auth/sign-out", { data: {} })).status(),
  ).toBe(200);
  expect((await old.get("/api/me")).status()).toBe(401);
  await old.dispose();
  await request.dispose();
});

test("personal event ownership, schedule search and saved comparisons persist", async ({
  student,
  other,
  studentPage: page,
}) => {
  const day = dateKey();
  const title = `QA event ${randomUUID()}`;
  const created = await student.post("/api/calendar/personal-events", {
    data: { title, startDate: day, endDate: addDays(day, 2) },
  });
  expect(created.status()).toBe(200);
  const own = await created.json();
  try {
    expect(
      (
        await other.patch(`/api/calendar/personal-events/${own.id}`, {
          data: {
            title: "Foreign",
            startDate: day,
            endDate: addDays(day, 1),
            sequence: 0,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await other.delete(`/api/calendar/personal-events/${own.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await student.patch(`/api/calendar/personal-events/${own.id}`, {
          data: {
            title: `${title} edited`,
            startDate: day,
            endDate: addDays(day, 2),
            sequence: 0,
          },
        })
      ).status(),
    ).toBe(200);
    const schedules = await (
      await student.get("/api/schedules/search?q=ПИ-22")
    ).json();
    expect(schedules.some((s: { id: string }) => s.id === "p-22")).toBe(true);
    await student.post("/api/schedules/saved", {
      data: { kind: "group", targetId: "p-22" },
    });
    await page.goto(`/calendar?date=${day}&view=day&schedules=group:p-22`);
    await expect(
      page.getByText(`${title} edited`, { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    expect(page.url()).toContain("group:p-22");
    await page.getByRole("button", { name: "Сравнить расписания" }).click();
    await expect(
      page.getByRole("button", { name: "Убрать ПИ-22 из избранного" }).first(),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Следующий период" }).click();
    await expect(page).toHaveURL(new RegExp(`date=${addDays(day, 1)}`));
    await page.getByRole("button", { name: "Сегодня", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`date=${day}`));
  } finally {
    await student.delete(`/api/calendar/personal-events/${own.id}`);
  }
  const events = await (
    await student.get(`/api/calendar/events?from=${day}&to=${addDays(day, 3)}`)
  ).json();
  expect(events.some((e: { id: string }) => e.id === own.id)).toBe(false);
});

test("private profile loads on demand, community state and notification reads persist", async ({
  studentPage: page,
  student,
  other,
}) => {
  let privateReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/me/private-details")
      privateReads++;
  });
  const response = await page.goto("/profile");
  expect(await response!.text()).not.toContain("DEMO-000001");
  expect(privateReads).toBe(0);
  const profile = page.getByRole("main");
  await expect(
    profile.getByRole("heading", { name: "Александра Миронова", level: 1 }),
  ).toBeVisible();
  await expect(profile.locator('a[href^="/calendar"]')).toHaveCount(0);
  const enrollment = profile.getByRole("link", { name: "Справка об обучении" });
  await expect(enrollment).toHaveAttribute("href", "/services/enrollment");
  await expect(enrollment).toHaveCSS("border-top-width", "0px");
  await expect(profile.getByRole("region", { name: "Обучение" })).toHaveCSS(
    "border-top-width",
    "0px",
  );
  expect(await page.locator("body").textContent()).not.toContain(
    "student-a@personal.example.org",
  );
  await profile.getByRole("button", { name: "Показать личный email" }).click();
  await expect(
    page.getByText("student-a@personal.example.org", { exact: true }),
  ).toBeVisible();
  expect(privateReads).toBe(1);
  await expect(profile.getByText("DEMO-000001", { exact: true })).toHaveCount(
    0,
  );
  await profile.getByRole("button", { name: "Скрыть личный email" }).click();
  await expect(
    profile.getByText("student-a@personal.example.org", { exact: true }),
  ).toHaveCount(0);
  await profile.getByRole("link", { name: "Документы", exact: true }).click();
  await expect(page).toHaveURL(/\/profile\?tab=documents$/);
  await expect(profile.locator('a[href="/api/files/result-3"]')).toBeVisible();
  await expect(
    profile.locator('a[href="/api/files/contract-file"]'),
  ).toHaveCount(0);
  expect(privateReads).toBe(1);
  await profile
    .getByRole("button", { name: "Показать документы и адрес" })
    .click();
  await expect(profile.getByText("DEMO-000001", { exact: true })).toBeVisible();
  expect(privateReads).toBe(2);
  await profile
    .getByRole("button", { name: "Скрыть документы и адрес" })
    .click();
  await expect(profile.getByText("DEMO-000001", { exact: true })).toHaveCount(
    0,
  );
  const documentsB = await other.get("/profile?tab=documents");
  expect(documentsB.status()).toBe(200);
  const documentsHtml = await documentsB.text();
  expect(documentsHtml).toContain('href="/api/files/contract-file"');
  expect(documentsHtml).toContain('href="/api/files/result-8"');
  expect(documentsHtml).not.toContain("/api/files/result-3");
  expect(documentsHtml).not.toContain("DEMO-000002");
  const contract = await other.get("/api/files/contract-file");
  expect(contract.status()).toBe(200);
  expect((await contract.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await student.get("/api/files/contract-file")).status()).toBe(404);
  const privateB = await (
    await other.get("/api/me/private-details?studentId=student-a")
  ).json();
  expect(privateB.contactEmail).toBe("student-b@personal.example.org");
  await student.patch("/api/community/event-1", {
    data: { saved: true, inCalendar: true },
  });
  const event = await (await student.get("/api/community/event-1")).json();
  expect(event.savedBy[0]).toMatchObject({ saved: true, inCalendar: true });
  const day = dateKey(event.startsAt);
  const calendar = await (
    await student.get(
      `/api/calendar/events?from=${day}&to=${addDays(day, 1)}&types=COMMUNITY`,
    )
  ).json();
  expect(calendar.some((e: { id: string }) => e.id === "event-1")).toBe(true);
  const notifications = await (await student.get("/api/notifications")).json();
  expect(notifications.length).toBeGreaterThan(0);
  const id = notifications[0].id;
  await student.post("/api/notifications", { data: { id } });
  const refreshed = await (await student.get("/api/notifications")).json();
  expect(
    refreshed.find((n: { id: string }) => n.id === id).readAt,
  ).toBeTruthy();
  expect(new Set(refreshed.map((n: { id: string }) => n.id)).size).toBe(
    refreshed.length,
  );
});

test("request clarification author is enforced and expired PDF cannot be downloaded", async ({
  student,
  other,
}) => {
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/ryadom_test");
  const draft = await (
    await student.post("/api/requests", {
      data: {
        serviceSlug: "support",
        fields: {
          subject: "QA вопрос",

          description: "QA вопрос для проверки",
        },
        key: randomUUID(),
      },
    })
  ).json();
  // Employee action is only a fixture in the isolated test DB; there is no employee HTTP API.
  await db.studentRequest.update({
    where: { id: draft.id },
    data: { status: "NEEDS_INFO", version: 1 },
  });
  const answer = {
    action: "respond",
    version: 1,
    key: randomUUID(),
    text: "Подробное уточнение студента.",
  };
  expect(
    (
      await student.post(`/api/requests/${draft.id}`, {
        data: { ...answer, authorRole: "STAFF" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (await other.post(`/api/requests/${draft.id}`, { data: answer })).status(),
  ).toBe(404);
  expect(
    (
      await student.post(`/api/requests/${draft.id}`, { data: answer })
    ).status(),
  ).toBe(200);
  const detail = await (await student.get(`/api/requests/${draft.id}`)).json();
  expect(detail.status).toBe("IN_REVIEW");
  expect(detail.comments.at(-1)).toMatchObject({
    authorRole: "STUDENT",
    authorName: "Александра Миронова",
  });
  const file = { id: "result-3" };
  const source = await db.studentRequest.findUniqueOrThrow({
    where: { id: "request-3" },
  });
  try {
    await db.studentRequest.update({
      where: { id: source.id },
      data: { resultExpiresAt: new Date(Date.now() - 1000) },
    });
    expect((await student.get(`/api/files/${file.id}`)).status()).toBe(410);
    expect((await other.get(`/api/files/${file.id}`)).status()).toBe(404);
    const profile = await student.get("/profile?tab=documents");
    expect(await profile.text()).not.toContain(`/api/files/${file.id}`);
  } finally {
    await db.studentRequest.update({
      where: { id: source.id },
      data: { resultExpiresAt: source.resultExpiresAt },
    });
  }
});

test("attendance explanation supports keyboard and returns focus; course and result values agree", async ({
  studentPage: page,
  student,
}) => {
  const result = await (
    await student.get("/api/courses/course-1/results")
  ).json();
  await page.goto("/studies/courses/course-1?tab=assessment");
  const button = page
    .getByRole("button", { name: "Как посещаемость влияет на результат" })
    .first();
  await expect(button).toHaveText("");
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Посещаемость и результат" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    `${Math.round(result.attendance.percentage)}%`,
  );
  await expect(dialog).toContainText("не меняет оценку");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
  await page.goto("/studies/results?course=course-1");
  await expect(
    page
      .getByText(`${Math.round(result.attendance.percentage)}%`, {
        exact: true,
      })
      .first(),
  ).toBeVisible();

  await page.goto("/studies/courses?q=Проектирование");
  await expect(button).toHaveText("");
  await expect(button.locator("svg")).toBeVisible();
  await expect(button).toHaveCSS("border-top-width", "0px");
  await expect(button).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await button.click();
  await expect(dialog).toContainText("При посещаемости ниже 80%");
});

test("assessment guidance opens only from the question button and closes with Escape or outside click", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/courses/course-0?tab=assessment");
  const help = page.getByRole("button", {
    name: "Условия получения результата",
  });
  const guidance = page.getByText(/^Для допуска нужно/);
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await expect(guidance).toBeHidden();

  await help.press("Enter");
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await expect(guidance).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(guidance).toBeHidden();
  await expect(help).toBeFocused();

  await help.click();
  await expect(guidance).toBeVisible();
  await page.getByRole("heading", { name: "Как получить результат" }).click();
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await expect(guidance).toBeHidden();
});

test("home omits the academic card and finance links have room to wrap", async ({
  studentPage: page,
}) => {
  await page
    .context()
    .addCookies([{ name: "theme", value: "light", url: origin }]);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Мои академические данные" }),
  ).toHaveCount(0);
  const attention = page.getByRole("region", { name: "Требует внимания" });
  await expect(attention.locator("svg").first()).toHaveCSS(
    "color",
    "rgb(163, 69, 22)",
  );
  await expect(
    page.getByRole("heading", { name: "За пределами пар" }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByRole("region", { name: "Обучение" })).toBeVisible();

  await page.goto("/finance");
  const heading = page.getByRole("heading", { name: "Финансовые документы" });
  const card = heading.locator("..");
  const first = card.getByRole("link", { name: "Сведения о выплатах" });
  const last = card.getByRole("link", { name: "Стипендиальные кампании" });
  const caption = card.getByText(/^Справочные демонстрационные данные/);
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const [titleBox, firstBox, lastBox, captionBox] = await Promise.all([
      heading.boundingBox(),
      first.boundingBox(),
      last.boundingBox(),
      caption.boundingBox(),
    ]);
    expect(
      firstBox!.y - (titleBox!.y + titleBox!.height),
    ).toBeGreaterThanOrEqual(16);
    expect(
      captionBox!.y - (lastBox!.y + lastBox!.height),
    ).toBeGreaterThanOrEqual(16);
  }
});

for (const width of [1440, 1280, 360])
  test(`both themes and essential routes fit viewport ${width}`, async ({
    studentPage: page,
    student,
  }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const durations: Record<string, number> = {};
    const routes = [
      "/",
      "/calendar?view=month",
      "/studies/courses",
      "/studies/results",
      "/studies/curriculum",
      "/studies/projects",
      "/studies/achievements",
      "/services",
      "/finance",
      "/people",
      "/community",
      "/notifications",
      "/profile",
      "/settings",
      "/support",
      "/calendar/integrations",
    ];
    for (const theme of ["light", "dark"]) {
      await page.request.patch("/api/me/preferences", {
        data: { theme },
        headers: { Origin: origin },
      });
      for (const route of routes) {
        const start = performance.now();
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await page.locator("h1").waitFor();
        const container = await page.locator("main#main").evaluate((main) => {
          const style = getComputedStyle(main);
          const padding =
            parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
          const bounds = main.getBoundingClientRect();
          const workspace = main.parentElement!.getBoundingClientRect();
          return {
            width: bounds.width - padding,
            available: workspace.width - padding,
            left: bounds.left - workspace.left,
            right: workspace.right - bounds.right,
          };
        });
        const expectedWidth =
          route === "/calendar?view=month"
            ? container.available
            : Math.min(1048, container.available);
        expect(container.width, route).toBeCloseTo(expectedWidth, 0);
        expect(container.left, route).toBeCloseTo(container.right, 0);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${theme} ${width} ${route}`,
        ).toBe(true);
        if (theme === "dark")
          expect(
            await page.evaluate(
              () => getComputedStyle(document.body).backgroundColor,
            ),
          ).toBe("rgb(0, 0, 0)");
        if (route === "/calendar?view=month") {
          const workspace = page.locator("[data-calendar-workspace]");
          await expect(workspace).toHaveCSS(
            "background-color",
            theme === "dark" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)",
          );
          await expect(page.locator("main")).toHaveCSS("padding", "0px");
          expect(
            await page
              .locator('[class*="monthDay"]')
              .evaluateAll((cells) =>
                cells.every((cell) =>
                  Array.from(cell.children).every(
                    (child) =>
                      child.getBoundingClientRect().bottom <=
                      cell.getBoundingClientRect().bottom,
                  ),
                ),
              ),
          ).toBe(true);
          if (width > 650) {
            const bounds = (await workspace.boundingBox())!;
            expect(
              Math.abs(bounds.y + bounds.height - page.viewportSize()!.height),
            ).toBeLessThan(2);
          }
        }
        durations[`${theme} ${route}`] = Math.round(performance.now() - start);
        if (
          ["/", "/calendar?view=month", "/services"].includes(route) &&
          width !== 1280
        ) {
          await page.evaluate(() => document.fonts.ready);
          await mkdir("docs/screenshots", { recursive: true });
          await page.screenshot({
            path: `docs/screenshots/${route === "/" ? "home" : route.startsWith("/calendar") ? "calendar" : "services"}-${theme}-${width}.png`,
            fullPage: true,
            caret: "initial",
          });
        }
      }
    }
    await student.patch("/api/me/preferences", { data: { theme: "light" } });
    expect(errors).toEqual([]);
    await mkdir(".local", { recursive: true });
    await writeFile(
      `.local/ui-metrics-${width}.json`,
      JSON.stringify(durations, null, 2),
    );
  });
