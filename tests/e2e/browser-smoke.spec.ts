import { test, expect, origin } from "./fixtures";
import { dateKey, addDays } from "../../src/shared/lib/time";
import { writeFile } from "node:fs/promises";

test("header notifications open by the bell, scroll inside the panel and link to the inbox", async ({
  studentPage: page,
  student,
}) => {
  const response = await student.get("/api/notifications");
  expect(response.ok()).toBe(true);
  const [latest] = await response.json();
  await page.goto("/");
  const header = page.getByRole("banner");
  const bell = header.getByRole("button", { name: /^Уведомления/ });
  const search = header.getByRole("button", { name: "Глобальный поиск" });
  const panel = header.getByRole("region", { name: "Уведомления" });
  await expect(header).toHaveCSS("background-image", "none");
  await expect(header).toHaveCSS("border-bottom-width", "1px");
  await bell.click();
  await expect(page).toHaveURL(origin + "/");
  await expect(bell).toHaveAttribute("aria-expanded", "true");
  const item = panel
    .getByRole("list", { name: "Последние уведомления" })
    .getByRole("link")
    .first();
  await expect(item).toContainText(latest.title);
  await expect(item).toHaveAttribute("href", latest.href);
  const [buttonBox, panelBox] = await Promise.all([
    bell.boundingBox(),
    panel.boundingBox(),
  ]);
  expect(buttonBox!.height).toBeCloseTo(
    (await search.boundingBox())!.height,
    0,
  );
  expect(panelBox!.y).toBeGreaterThan(buttonBox!.y + buttonBox!.height);
  expect(panelBox!.x + panelBox!.width).toBeCloseTo(
    buttonBox!.x + buttonBox!.width,
    0,
  );

  await item.focus();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(bell).toBeFocused();

  await bell.click();
  await page.getByRole("heading", { level: 1, name: "Сегодня" }).click();
  await expect(panel).toBeHidden();

  await page.setViewportSize({ width: 390, height: 560 });
  await bell.click();
  const list = panel.getByRole("list", { name: "Последние уведомления" });
  const feed = list.locator("..");
  const all = panel.getByRole("link", { name: "Все уведомления" });
  await expect(all).toBeInViewport();
  await expect(all).toHaveCSS("border-top-width", "0px");
  expect((await bell.boundingBox())!.height).toBeCloseTo(
    (await search.boundingBox())!.height,
    0,
  );
  await expect(list).toBeVisible();
  await expect(feed).toHaveAttribute("data-fade-end", "true");
  await expect(feed).not.toHaveAttribute("data-fade-start", "true");
  await panel.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
  const footerTop = (await all.boundingBox())!.y;
  expect(
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    }),
  ).toBeGreaterThan(0);
  await expect(feed).toHaveAttribute("data-fade-start", "true");
  await expect(feed).not.toHaveAttribute("data-fade-end", "true");
  expect((await all.boundingBox())!.y).toBeCloseTo(footerTop, 0);
  await all.click();
  await expect(page).toHaveURL(origin + "/notifications");
  await expect(
    page.getByRole("heading", { level: 1, name: "Уведомления" }),
  ).toBeVisible();
  await expect(panel).toBeHidden();
});

test("filters preserve native select, checkbox keyboard and GET form behavior", async ({
  studentPage: page,
}) => {
  await page.goto("/notifications");
  await page
    .getByRole("combobox", { name: "Категория" })
    .selectOption("REQUEST");
  const unread = page.getByRole("checkbox", { name: "Только непрочитанные" });
  await unread.press("Space");
  await expect(unread).toBeChecked();
  await expect(unread).toBeFocused();
  await page.getByRole("button", { name: "Показать", exact: true }).click();
  await expect(page).toHaveURL(/category=REQUEST&unread=true/);
  await expect(page.getByRole("combobox", { name: "Категория" })).toHaveValue(
    "REQUEST",
  );
  await expect(unread).toBeChecked();
});

test("home-to-calendar, roster search, curriculum, finance prefill and mobile dialog", async ({
  studentPage: page,
  student,
  browser,
  bState,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const day = addDays(dateKey(), 2);
  await page.goto("/");
  await page
    .locator(`a[href="/calendar?date=${day}&view=day"]`)
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`date=${day}`));
  await page.locator('a[href="/studies/courses"]').first().click();
  await page.locator('a[href="/studies/courses/course-1"]').click();
  await page.getByRole("link", { name: "Участники", exact: true }).click();
  const roster = await (
    await student.get("/api/courses/course-1/roster")
  ).json();
  expect(roster.total).toBeGreaterThan(20);
  const name = roster.items[0].name;
  const started = performance.now();
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/courses/course-1/roster" &&
      new URL(r.url()).searchParams.get("q") === name &&
      r.ok(),
  );
  await page.getByLabel("Найти участника").fill(name);
  await expect(page.getByLabel("Найти участника")).toHaveValue(name);
  await response;
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await writeFile(
    `.local/roster-metrics-${info.project.name}.json`,
    JSON.stringify({
      elapsedMs: Math.round(performance.now() - started),
      people: roster.total,
    }),
  );
  await page.locator('a[href="/studies/curriculum"]').first().click();
  const progress = page.getByRole("progressbar", { name: "Освоенные кредиты" });
  const credits = await progress.getAttribute("value");
  expect(Number(credits)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "2 семестр", exact: true }).click();
  await expect(page).toHaveURL(/semester=2/);
  await expect(progress).toHaveAttribute("value", credits!);
  const contextB = await browser.newContext({
    baseURL: origin,
    storageState: bState,
  });
  const b = await contextB.newPage();
  await b.goto("/finance?tab=contracts");
  await b
    .getByRole("link", { name: "Заказать справку об оплате" })
    .first()
    .click();
  await expect(b.getByLabel("Договор", { exact: true })).not.toHaveValue("");
  await expect(b.getByRole("heading", { level: 1 })).toBeVisible();
  await contextB.close();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await page.getByRole("link", { name: "Календарь", exact: true }).click();
  await expect(page).toHaveURL(/view=day/);
  await page.getByRole("button", { name: "Событие", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Личное событие",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Название", { exact: true })
    .fill("Незавершённая заметка");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Событие", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("dialogs ignore drags and fade out without shrinking on every close path", async ({
  studentPage: page,
  student,
}) => {
  const today = dateKey();
  const response = await student.get(
    `/api/calendar/events?from=${today}&to=${addDays(today, 7)}&types=LESSON`,
  );
  expect(response.ok()).toBe(true);
  const [lesson] = await response.json();
  const lessonDay = dateKey(lesson.startsAt);
  await page.goto(`/calendar?date=${lessonDay}&view=week`);
  await expect(
    page.getByRole("button", { name: "Неделя", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const trigger = page.getByRole("button", { name: "Событие", exact: true });
  const dialog = page.locator("dialog[open]");
  await trigger.click();
  await expect(dialog.getByLabel("Название", { exact: true })).toBeVisible();
  await expect(dialog.locator('input[type="url"]')).toHaveCount(0);
  await dialog.getByLabel("Заметка").fill("Текст заметки для выделения");
  const note = (await dialog.getByLabel("Заметка").boundingBox())!;
  const bounds = (await dialog.boundingBox())!;
  // Releasing a selection or the resize grip outside must keep the dialog open.
  for (const start of [
    { x: note.x + 10, y: note.y + 12 },
    { x: note.x + note.width - 3, y: note.y + note.height - 3 },
  ]) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(bounds.x - 20, bounds.y + bounds.height + 20, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
  }
  // A drag that returns to its starting point is still a drag, not a click.
  await page.mouse.move(10, 10);
  await page.mouse.down();
  await page.mouse.move(100, 10, { steps: 4 });
  await page.mouse.move(10, 10, { steps: 4 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();

  const expectSmoothClose = async (close: () => Promise<unknown>) => {
    // Finish entrance before sampling exit geometry and opacity frame by frame.
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations().map((a) => a.finished)),
    );
    const samples = dialog.evaluate(
      (element) =>
        new Promise<
          {
            height: number;
            width: number;
            opacity: number;
            text: string | null;
          }[]
        >((resolve) => {
          const frames: {
            height: number;
            width: number;
            opacity: number;
            text: string | null;
          }[] = [];
          const sample = () => {
            if (!(element as HTMLDialogElement).open) return resolve(frames);
            const rect = element.getBoundingClientRect();
            frames.push({
              height: rect.height,
              width: rect.width,
              opacity: Number(getComputedStyle(element).opacity),
              text: element.textContent,
            });
            requestAnimationFrame(sample);
          };
          sample();
        }),
    );
    await close();
    const frames = await samples;
    expect(
      frames.some((frame) => frame.opacity > 0 && frame.opacity < 0.95),
    ).toBe(true);
    expect(
      Math.max(...frames.map((frame) => frame.height)) -
        Math.min(...frames.map((frame) => frame.height)),
    ).toBeLessThan(1);
    expect(
      Math.max(...frames.map((frame) => frame.width)) -
        Math.min(...frames.map((frame) => frame.width)),
    ).toBeLessThan(1);
    expect(new Set(frames.map((frame) => frame.text)).size).toBe(1);
    await expect(dialog).toHaveCount(0);
  };
  for (const action of ["backdrop", "button", "escape"] as const) {
    if (action !== "backdrop") await trigger.click();
    await expectSmoothClose(() =>
      action === "backdrop"
        ? page.mouse.click(10, 10)
        : action === "button"
          ? dialog.getByRole("button", { name: "Закрыть", exact: true }).click()
          : page.keyboard.press("Escape"),
    );
    await expect(trigger).toBeFocused();
  }
  // Back clears the selected event in the parent before its exit completes.
  await page
    .locator(`[data-date="${lessonDay}"] button[data-type="LESSON"]`)
    .filter({ hasText: lesson.title })
    .first()
    .click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2 + p")).toHaveText(lesson.description);
  await expect(dialog.getByText(/^Скачается файл события/)).toHaveCount(0);
  await expect(
    dialog.getByRole("link", { name: "Добавить в свой календарь" }),
  ).toHaveAttribute("href", /\/api\/calendar\/export\.ics\?/);
  await expectSmoothClose(() => page.goBack());
  // Cancelling while Save has focus must not submit during the fading frames.
  let submitted = false;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/calendar/personal-events")
    )
      submitted = true;
  });
  await trigger.click();
  await dialog
    .getByLabel("Название", { exact: true })
    .fill("Не сохранять после отмены");
  await dialog.getByRole("button", { name: "Сохранить событие" }).focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(submitted).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await page.mouse.click(10, 10);
  await expect(dialog).toHaveCount(0);
});

test("calendar scrolls across dates continuously and preserves vertical position and history", async ({
  studentPage: page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const day = dateKey();
  await page.goto(`/calendar?date=${day}&view=week`);
  const timeline = page.getByRole("region", { name: "Расписание по дням" });
  const expectDate = async (value: string) => {
    await expect(page).toHaveURL(new RegExp(`date=${value}`));
    await expect(
      page.locator('[aria-label="Выбор даты"] [data-anchor]'),
    ).toHaveAttribute("data-date", value);
  };
  await expect(timeline).toHaveAttribute("data-ready", "true");
  await expectDate(day);
  await expect(timeline).toHaveCSS("scrollbar-width", "none");
  const deadlines = timeline.locator('[data-date] > [data-type="DEADLINE"]');
  expect(await deadlines.count()).toBeGreaterThan(0);
  expect(
    await timeline.locator("[data-date] > button").evaluateAll((events) =>
      events.every((event) => {
        const card = event.getBoundingClientRect();
        const column = event.parentElement!.getBoundingClientRect();
        return card.top >= column.top && card.bottom <= column.bottom + 1;
      }),
    ),
  ).toBe(true);
  await timeline.evaluate((element) => {
    element.scrollTop = 600;
  });
  await page.getByRole("button", { name: "Следующий период" }).click();
  await expectDate(addDays(day, 1));
  expect(await timeline.evaluate((element) => element.scrollTop)).toBe(600);
  await expect(
    page.locator('[aria-label="Выбор даты"] [aria-pressed="true"]'),
  ).toHaveCount(7);
  await timeline.evaluate((element) => {
    element.scrollLeft +=
      parseFloat(getComputedStyle(element).getPropertyValue("--day-width")) *
      0.2;
  });
  await expect(
    page.locator('[aria-label="Выбор даты"] [aria-pressed="true"]'),
  ).toHaveCount(7);
  // Cross the original buffer using horizontal scroll; server refills it in place.
  for (const offset of [13, 26]) {
    await timeline.evaluate((element) => {
      const width = parseFloat(
        getComputedStyle(element).getPropertyValue("--day-width"),
      );
      element.scrollLeft += width * 13;
    });
    await expectDate(addDays(day, 1 + offset));
    expect(await timeline.evaluate((element) => element.scrollTop)).toBe(600);
  }
  expect(
    await timeline.evaluate(
      (element) =>
        new Promise<boolean>((resolve) => {
          const started = performance.now();
          const sample = () => {
            const highlighted = [
              ...element.querySelectorAll("[data-calendar-day]"),
            ].some((day) =>
              day
                .getAnimations()
                .some((a) => a.id === "calendar-day-highlight"),
            );
            if (highlighted) return resolve(false);
            if (performance.now() - started >= 600) return resolve(true);
            requestAnimationFrame(sample);
          };
          sample();
        }),
    ),
  ).toBe(true);
  const exam = page.getByRole("checkbox", { name: "Экзамен", exact: true });
  await exam.click();
  await expect(exam).not.toBeChecked();
  await expect(page).toHaveURL(/types=/);
  await page.goBack();
  await expect(exam).toBeChecked();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(timeline).toBeVisible();
  expect(await timeline.evaluate((element) => element.scrollTop)).toBe(600);
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await expectDate(day);
  await page.getByRole("button", { name: "День", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "День", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await timeline.focus();
  await page.keyboard.press("ArrowLeft");
  await expectDate(addDays(day, -1));
  await page.reload();
  await expectDate(addDays(day, -1));
  const sidebar = page.getByRole("complementary", {
    name: "Управление календарём",
  });
  await expect(
    sidebar.getByRole("button", { name: "Событие", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("checkbox", { name: "Пара", exact: true }),
  ).toBeVisible();
  const target = addDays(day, 45);
  const picker = page.getByRole("region", { name: "Выбор даты" });
  // The chosen date can be far outside the loaded buffer.
  for (
    let n = 0;
    n < 3 && !(await picker.locator(`[data-date="${target}"]`).count());
    n++
  ) {
    await picker.getByRole("button", { name: "Следующий месяц" }).click();
  }
  const frame = timeline.locator("..");
  const transition = frame.evaluate(
    (element, targetDate) =>
      new Promise<number[]>((resolve) => {
        const opacities: number[] = [];
        const sample = () => {
          const opacity = Number(getComputedStyle(element).opacity);
          opacities.push(opacity);
          if (
            location.search.includes(`date=${targetDate}`) &&
            !element.hasAttribute("data-transition") &&
            opacity >= 0.999 &&
            opacities.some((n) => n < 0.9)
          )
            return resolve(opacities);
          requestAnimationFrame(sample);
        };
        sample();
      }),
    target,
  );
  await picker.locator(`[data-date="${target}"]`).click();
  await expectDate(target);
  expect(
    (await transition).some((opacity) => opacity > 0 && opacity < 0.95),
  ).toBe(true);
  await expect(frame).toHaveCSS("opacity", "1");
  const selectedColumn = timeline.locator(`[data-date="${target}"]`);
  await expect(selectedColumn).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(selectedColumn).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
    { timeout: 5000 },
  );
  await page.reload();
  await expectDate(target);
  await sidebar.getByRole("button", { name: "Месяц", exact: true }).click();
  await expect(
    sidebar.getByRole("button", { name: "Месяц", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker.locator(`[data-date="${target}"]`).click();
  await expect(
    sidebar.getByRole("button", { name: "День", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectDate(target);
  expect(errors).toEqual([]);
});
