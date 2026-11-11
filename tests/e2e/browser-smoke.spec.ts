import { test, expect, origin } from "./fixtures";
import { dateKey, addDays } from "../../src/shared/lib/time";
import { writeFile } from "node:fs/promises";
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
