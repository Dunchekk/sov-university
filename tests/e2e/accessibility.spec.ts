import { brand } from "../../src/shared/config/brand";
import { expect, test } from "./fixtures";

test("keyboard users can skip navigation and leave the mobile menu", async ({
  studentPage: page,
}) => {
  await page.goto("/profile");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Перейти к основному содержанию" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  const main = page.getByRole("main");
  await expect(main).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await main.evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/finance");
  const toggle = page.getByRole("button", { name: /^(Открыть|Закрыть) меню$/ });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const navigation = page.getByRole("complementary", {
    name: "Основная навигация",
  });
  await expect(
    navigation.getByRole("link", { name: brand.name, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(navigation).toBeHidden();
});

test("detail titles, calendar descriptions and study tables expose their context", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/courses/course-1?tab=assessment");
  const course = page.getByRole("heading", { level: 1 });
  await expect(page).toHaveTitle(`${await course.innerText()} · ${brand.name}`);
  const table = page.getByRole("table", { name: "Работы и оценки" });
  await expect(
    table.getByRole("columnheader", { name: "Срок" }),
  ).toBeAttached();
  const scroll = page.getByRole("region", {
    name: "Прокрутка таблицы работ и оценок",
  });
  await scroll.focus();
  await expect(scroll).toBeFocused();

  await page.goto("/calendar?view=week");
  const calendar = page.getByRole("region", { name: "Календарь занятий" });
  const event = calendar.locator('button[aria-haspopup="dialog"]').first();
  await expect(event).toHaveAccessibleName(/\S/);
  await expect(event).toHaveAccessibleDescription(/\p{L}/u);
  await expect(calendar.locator('[aria-live="polite"]')).toContainText(
    "Период календаря",
  );
});

test("the calendar respects the system contrast preference", async ({
  studentPage: page,
}) => {
  await page.emulateMedia({ colorScheme: "light", contrast: "no-preference" });
  await page.goto("/calendar?view=month");
  const weekday = page
    .getByRole("region", { name: "Выбор даты" })
    .getByText("Пн", { exact: true });
  const regular = await weekday.evaluate(
    (element) => getComputedStyle(element).color,
  );
  await page.emulateMedia({ contrast: "more" });
  await expect
    .poll(() => weekday.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(regular);
});
