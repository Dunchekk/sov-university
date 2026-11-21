import { academicYear } from "../../src/modules/rating/domain";
import { expect, test } from "./fixtures";

test("rating opens the current year and reconciles the course rows with the score", async ({
  studentPage: page,
  other,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Рейтинг", exact: true }).click();
  await expect(page).toHaveURL(/\/studies\/rating$/);
  const year = academicYear(new Date());
  const nav = page.getByRole("navigation", { name: "Вкладки раздела" });
  const current = nav.getByRole("link", { name: `${year}/${year + 1}` });
  const previous = nav.getByRole("link", { name: `${year - 1}/${year}` });
  await expect(current).toHaveAttribute("aria-current", "page");
  const summary = page.getByRole("region", { name: "Текущий рейтинг" });
  await expect(summary.getByText(/^\d+ из \d+$/)).toBeVisible();
  await expect(summary.getByText(/^\d+%$/)).toBeVisible();
  const courses = page.getByRole("table", { name: "Дисциплины в расчёте" });
  await expect(
    courses.getByRole("link", { name: "Проверка источников" }),
  ).toBeVisible();
  const calculations = await courses.locator("tbody td").allTextContents();
  expect(calculations.length).toBeGreaterThanOrEqual(3);
  const sum = calculations.reduce((total, expression) => {
    const [credits, grade, contribution] = expression
      .match(/\d+/g)!
      .map(Number);
    expect(contribution).toBe(credits * grade);
    return total + contribution;
  }, 0);
  await expect(courses.locator("tfoot td")).toHaveText(String(sum));
  await expect(
    page.getByRole("heading", { name: "Как считается рейтинг" }),
  ).toBeVisible();

  await previous.click();
  await expect(page).toHaveURL(new RegExp(`year=${year - 1}`));
  await expect(previous).toHaveAttribute("aria-current", "page");
  await expect(
    courses.getByRole("link", { name: "Визуальные коммуникации" }),
  ).toBeVisible();
  expect(await courses.locator("tbody tr").count()).toBeGreaterThanOrEqual(15);
  const engineering = await other.get(`/studies/rating?year=${year - 1}`);
  expect(engineering.ok()).toBe(true);
  const engineeringPage = await engineering.text();
  expect(engineeringPage).toContain("Математический анализ");
  expect(engineeringPage).not.toContain("Визуальные коммуникации");
  await page.reload();
  await expect(previous).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 360, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await current.click();
  await courses.getByRole("link", { name: "Проверка источников" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Проверка источников",
  );
});
