import { expect, test } from "./fixtures";

test("menu acknowledges a slow transition and preserves browser history", async ({
  studentPage: page,
}) => {
  await page.goto("/services");
  const menu = page.getByRole("complementary", { name: "Основная навигация" });
  const courses = menu.getByRole("link", { name: "Дисциплины" });
  const overlay = page.locator("[data-navigation-overlay]");
  await expect(overlay).toBeHidden();
  const origin = new URL(page.url()).origin;
  const requestedCourses = (url: URL) => url.pathname === "/studies/courses";
  const { promise, resolve: release } = Promise.withResolvers<void>();
  await page.route(requestedCourses, async (route) => {
    await promise;
    await route.continue();
  });

  try {
    await overlay.evaluate((node) => {
      let startedAt: number | undefined;
      const observer = new MutationObserver(() => {
        if (node.hasAttribute("data-visible")) startedAt ??= performance.now();
        else if (startedAt !== undefined) {
          node.setAttribute(
            "data-observed-duration",
            String(performance.now() - startedAt),
          );
          observer.disconnect();
        }
      });
      observer.observe(node, {
        attributes: true,
        attributeFilter: ["data-visible"],
      });
    });
    await courses.click();
    await expect(courses.locator('span[aria-hidden="true"]')).toBeVisible();
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(
      page.getByText("Загрузка страницы…", { exact: true }),
    ).toHaveAttribute("role", "status");
    await expect(
      overlay.getByText("Загрузка...", { exact: true }),
    ).toBeVisible();
    await expect(overlay).toHaveCSS("backdrop-filter", "blur(6px)");
    const sidebar = (await menu.boundingBox())!;
    const layer = (await overlay.boundingBox())!;
    expect(layer.x).toBe(sidebar.x + sidebar.width);
    expect(layer.x + layer.width).toBe(page.viewportSize()!.width);
    expect(layer.height).toBe(page.viewportSize()!.height);
    await menu.getByRole("link", { name: "Финансы" }).click();
    await expect(
      page.getByRole("heading", { name: "Финансы", level: 1 }),
    ).toBeVisible();
    await expect(courses.locator('span[aria-hidden="true"]')).toHaveCount(0);
    await expect(overlay).toBeHidden();
    expect(
      Number(await overlay.getAttribute("data-observed-duration")),
    ).toBeGreaterThanOrEqual(590);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    release();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/services$/);

  await courses.click();
  await page.getByRole("link", { name: "Завершённые" }).click();
  await expect(page).toHaveURL(/\/studies\/courses\?semester=past$/);
  const firstCourse = page.locator('main a[href^="/studies/courses/"]').first();
  const coursePath = await firstCourse.getAttribute("href");
  await firstCourse.click();
  await expect(page).toHaveURL(origin + coursePath);
  await page.goBack();
  await expect(page).toHaveURL(/\/studies\/courses\?semester=past$/);
  await page.goForward();
  await expect(page).toHaveURL(origin + coursePath);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Материалы и задания" }),
  ).toBeVisible();
});
