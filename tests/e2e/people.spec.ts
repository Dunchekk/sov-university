import { expect, test } from "./fixtures";

test("the directory shows 30 linked portraits in a single column and searches teaching topics", async ({
  studentPage: page,
}) => {
  await page.goto("/people");
  const directory = page.getByRole("list", { name: "Преподаватели" });
  await expect(
    directory.getByRole("heading", { name: "Тимур Ринатович Мусин" }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Все преподаватели", exact: true })
    .click();
  const links = directory.getByRole("link");
  await expect(links).toHaveCount(30);
  await expect(directory.locator("img")).toHaveCount(30);

  const boxes = await links.evaluateAll((items) =>
    items.map((item) => {
      const { x, width, top, bottom } = item.getBoundingClientRect();
      return { x, width, top, bottom };
    }),
  );
  expect(
    boxes.every(
      (box, index) =>
        box.x === boxes[0].x &&
        box.width === boxes[0].width &&
        (index === 0 || box.top >= boxes[index - 1].bottom),
    ),
  ).toBe(true);

  const search = page.getByRole("textbox", { name: "Поиск" });
  await search.fill("Оценка экспериментов");
  await search.press("Enter");
  await expect(links).toHaveCount(1);
  const lecturer = directory.getByRole("link", {
    name: /Тимур Ринатович Мусин/,
  });
  await expect(lecturer).toContainText("доб. 2410");
  await lecturer.press("Enter");
  await expect(page).toHaveURL(/\/people\/lecturer-9$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Тимур Ринатович Мусин",
  );
  await expect(
    page.getByRole("heading", { name: "Образование" }),
  ).toBeVisible();
  await expect(
    page.getByText("Оценка экспериментов", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Опубликованное расписание" }),
  ).toHaveCount(0);
  const image = page.getByRole("article").locator("img");
  await expect
    .poll(() =>
      image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("a current teacher keeps links to their course and schedule on mobile", async ({
  studentPage: page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/people");
  await page.getByRole("link", { name: /Анна Сергеевна Воронцова/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Анна Сергеевна Воронцова",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await expect(
    page.getByRole("link", { name: "Проектирование интерфейсов" }),
  ).toHaveAttribute("href", /^\/studies\/courses\//);
  await page.getByRole("link", { name: "Опубликованное расписание" }).click();
  await expect(page).toHaveURL(/schedules=lecturer(?::|%3A)lecturer-0/);
});
