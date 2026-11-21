import { expect, test } from "./fixtures";

test("results combine filters, preserve them across tabs and keep retakes with their course", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/results");
  const results = page.getByRole("region", { name: "Результаты" });
  const rows = results.locator(":scope > details > summary");
  const debt = results.locator("details").filter({
    has: page
      .locator("summary")
      .getByText("Основы дискретной математики", { exact: true }),
  });
  const course = page.getByRole("combobox", { name: "Дисциплина" });
  const semester = page.getByRole("combobox", { name: "Семестр" });
  const type = page.getByRole("combobox", { name: "Аттестация" });
  const sort = page.getByRole("combobox", { name: "Порядок" });

  await expect(rows.first()).toContainText("Основы дискретной математики");
  await expect(debt.getByRole("heading", { name: /Пересдача/ })).toBeHidden();
  await debt.locator(":scope > summary").click();
  await expect(debt.getByRole("heading", { name: /Пересдача/ })).toBeVisible();
  await expect(debt.getByText(/Корпус А, аудитория 405/)).toBeVisible();
  await expect(debt.locator(":scope > summary")).not.toContainText(
    "Итог 3 / 10",
  );
  await expect(
    debt.getByRole("link", { name: "Елена Викторовна Белова" }),
  ).toHaveAttribute("href", "/people/lecturer-2");
  const disclosure = debt.getByText("Шкала и правила оценивания", {
    exact: true,
  });
  await disclosure.click();
  await expect(disclosure.locator("..")).toHaveCSS("border-top-width", "0px");
  const scale = debt.getByRole("table", { name: "Шкала оценивания" });
  const threshold = scale.getByRole("row", { name: "30 3", exact: true });
  await expect(
    threshold.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();

  await course.selectOption("course-debt");
  await semester.selectOption("2");
  await type.selectOption("Экзамен");
  await sort.selectOption("name");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("course") === "course-debt" &&
      url.searchParams.get("semester") === "2" &&
      url.searchParams.get("type") === "Экзамен" &&
      url.searchParams.get("sort") === "name",
  );
  await expect(rows).toHaveCount(1);
  await expect(debt.getByRole("heading", { name: /Пересдача/ })).toBeVisible();

  await page.getByRole("link", { name: "Требует внимания · 1" }).click();
  await expect(
    page.getByRole("link", { name: "Требует внимания · 1" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(course).toHaveValue("course-debt");
  await expect(semester).toHaveValue("2");
  await expect(type).toHaveValue("Экзамен");
  await expect(sort).toHaveValue("name");
  await expect(rows).toHaveCount(1);

  await page.getByRole("link", { name: "Завершено · 0" }).click();
  await expect(
    results.getByText("Нет результатов по этим фильтрам"),
  ).toBeVisible();
  await expect(debt).toHaveCount(0);
  await page.goBack();
  await expect(debt.getByRole("heading", { name: /Пересдача/ })).toBeVisible();
  await page.getByRole("link", { name: "Завершено · 0" }).click();
  await results.getByRole("link", { name: "Сбросить фильтры" }).click();
  await expect(
    page.getByRole("link", { name: /^Завершено ·/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(course).toHaveValue("");
  await expect(sort).toHaveValue("name");
  await expect(rows.first()).toBeVisible();
  await expect(debt).toHaveCount(0);
  await expect(rows.first()).toContainText(/Итог \d+ \/ 10/);
  await rows.first().click();
  const breakdown = results.getByRole("region", {
    name: "Оценивание и посещаемость",
  });
  await expect(
    breakdown.getByRole("heading", { name: "Работы и оценки" }),
  ).toBeVisible();
  await expect(breakdown.getByRole("table")).toBeVisible();
  await breakdown.getByText("Журнал посещаемости", { exact: true }).click();
  await expect(
    breakdown.getByText("Записей о занятиях пока нет."),
  ).toBeVisible();
});

test("results offer data-driven filter values and order courses by name or semester", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/results?status=unknown&semester=999&sort=unknown");
  const results = page.getByRole("region", { name: "Результаты" });
  const rows = results.locator(":scope > details > summary");
  const type = page.getByRole("combobox", { name: "Аттестация" });
  const sort = page.getByRole("combobox", { name: "Порядок" });
  const labels = rows.locator("span:first-child > strong");
  const byName = new Intl.Collator("ru");
  await expect(
    page.getByRole("link", { name: /^Все результаты ·/ }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sort).toHaveValue("priority");
  await expect(page.getByRole("combobox", { name: "Семестр" })).toHaveValue("");
  const courseCount = await rows.count();
  expect(courseCount).toBeGreaterThan(1);

  await sort.selectOption("name");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(rows).toHaveCount(courseCount);
  const names = await labels.allTextContents();
  expect(names).toEqual([...names].sort(byName.compare));

  await sort.selectOption("semester");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/sort=semester/);
  await expect(rows).toHaveCount(courseCount);
  const semesters = (
    await rows.locator("span:first-child > span").allTextContents()
  ).map((label) => Number.parseInt(label, 10));
  expect(new Set(semesters).size).toBeGreaterThan(1);
  expect(semesters).toEqual([...semesters].sort((a, b) => b - a));

  await type.selectOption("Зачёт");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(rows.first()).toContainText("Зачёт");
  const metadata = await rows
    .locator("span:first-child > span")
    .allTextContents();
  expect(metadata.length).toBeGreaterThan(0);
  expect(metadata.every((label) => label.endsWith("Зачёт"))).toBe(true);
  await page.goto("/studies/results?course=course-1");
  await expect(
    results.getByRole("heading", { name: "Работы и оценки" }),
  ).toBeVisible();
  await expect(
    results.getByText("Ближайшая работа", { exact: true }),
  ).toHaveCount(0);
});
