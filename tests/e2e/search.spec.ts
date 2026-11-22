import { expect, test } from "./fixtures";

test("header shows the current section and global search filters by category", async ({
  studentPage: page,
}) => {
  await page.goto("/community");
  const crumbs = page.getByRole("navigation", { name: "Хлебные крошки" });
  const trigger = page.getByRole("button", { name: "Глобальный поиск" });
  await expect(crumbs.locator("[aria-current]")).toHaveText("Все");
  expect((await crumbs.boundingBox())!.x).toBeLessThan(
    (await trigger.boundingBox())!.x,
  );
  await page
    .getByRole("navigation", { name: "Виды публикаций" })
    .getByRole("link", { name: "Новости", exact: true })
    .click();
  await expect(crumbs.locator("[aria-current]")).toHaveText("Новости");

  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Поиск по кабинету" });
  const field = dialog.getByRole("combobox", { name: "Поисковый запрос" });
  const all = dialog.getByRole("button", { name: "Всё", exact: true });
  await expect(field).toBeFocused();
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toBeInViewport();
  const settledBounds = async () => {
    await dialog.evaluate(async (element) => {
      await Promise.allSettled(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      );
    });
    return (await dialog.boundingBox())!;
  };
  const center = page.viewportSize()!.height / 2;
  const compact = await settledBounds();
  expect(compact.y + compact.height / 2).toBeCloseTo(center, 0);

  await field.fill("кампус");
  const event = dialog.getByRole("option", { name: /Кубок кампусов/ });
  const news = dialog.getByRole("option", { name: /звуковой архив кампуса/ });
  await expect(event).toBeVisible();
  await expect(news).toBeVisible();
  const expanded = await settledBounds();
  expect(expanded.y + expanded.height / 2).toBeCloseTo(center, 0);
  expect(expanded.y).toBeLessThan(compact.y);
  expect(expanded.y + expanded.height).toBeGreaterThan(
    compact.y + compact.height,
  );
  const transparent = "rgba(0, 0, 0, 0)";
  await expect(event).toHaveCSS("background-color", transparent);
  await news.hover();
  await expect(news).not.toHaveCSS("background-color", transparent);
  await field.hover();
  await expect(news).toHaveCSS("background-color", transparent);
  const firstResult = dialog.getByRole("option").first();
  await field.press("ArrowDown");
  await expect(firstResult).toHaveAttribute("aria-selected", "true");
  await expect(firstResult).toHaveCSS("outline-width", "2px");
  await expect(firstResult).toHaveCSS("background-color", transparent);

  await dialog.getByRole("button", { name: "Новости", exact: true }).click();
  await expect(news).toBeVisible();
  await expect(event).toHaveCount(0);
  await expect(field).toHaveValue("кампус");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(field).toBeFocused();
  await field.fill("звуковой архив");
  await expect(news).toBeVisible();
  await field.press("Enter");
  await expect(page).toHaveURL(/\/community\/news\/news-0$/);
  await expect(dialog).toBeHidden();
});

test("search by request number only returns the signed-in student's request", async ({
  student,
  other,
}) => {
  const url = "/api/search?q=00003&scope=services";
  const response = await student.get(url);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual([
    expect.objectContaining({ href: "/requests/request-2", type: "Обращения" }),
  ]);
  const otherResponse = await other.get(url);
  expect(otherResponse.ok()).toBe(true);
  expect(await otherResponse.json()).toEqual([]);
});

test("service aliases match typing and open the correct form from global search", async ({
  studentPage: page,
}) => {
  await page.goto("/profile?tab=documents");
  await page.getByRole("button", { name: "Глобальный поиск" }).click();
  const dialog = page.getByRole("dialog", { name: "Поиск по кабинету" });
  const field = dialog.getByRole("combobox");
  await dialog.getByRole("button", { name: "Справки и заявления" }).click();
  await field.fill("об обу");
  await expect(dialog.getByRole("option").first()).toContainText(
    "Подтверждение обучения",
  );
  await expect(
    dialog.getByRole("option", { name: /Подтверждение обучения · №/ }),
  ).toHaveCount(1);
  await field.fill("спрвка об обучении");
  await expect(dialog.getByRole("option").first()).toContainText(
    "Справка об обучении",
  );
  await field.press("Enter");
  await expect(page).toHaveURL(/\/services\/enrollment$/);
});

test("search covers section destinations and respects access to personal results", async ({
  student,
  other,
  request,
}) => {
  const cases = [
    ["мои курсы", "study", "/studies/courses"],
    ["импорт ics", "calendar", "/calendar/integrations"],
    ["моя группа", "people", "/people?tab=group"],
    ["справка об обучении", "all", "/services/enrollment"],
    ["договор об обучении", "finance", "/finance?tab=contracts"],
    ["за пределами пар", "events", "/community"],
    ["звуковой архив", "news", "/community/news/news-0"],
    ["документы профиля", "account", "/profile?tab=documents"],
    ["светлая тема", "account", "/settings"],
    ["как учитывается посещаемость", "account", "/support#faq-attendance"],
    [
      "перевод на второй курс",
      "account",
      "/profile?tab=history#order-order-student-a",
    ],
  ];
  for (const [q, scope, href] of cases) {
    const response = await student.get(
      `/api/search?${new URLSearchParams({ q, scope })}`,
    );
    expect(response.status(), q).toBe(200);
    expect(await response.json(), q).toContainEqual(
      expect.objectContaining({ href }),
    );
  }
  const personal = `/api/search?${new URLSearchParams({ q: "встреча проектной команды", scope: "calendar" })}`;
  expect(await (await student.get(personal)).json()).toContainEqual(
    expect.objectContaining({ type: "Личные события" }),
  );
  expect(await (await other.get(personal)).json()).not.toContainEqual(
    expect.objectContaining({ type: "Личные события" }),
  );
  expect((await request.get(personal)).status()).toBe(401);
});
