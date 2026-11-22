import { academicYear } from "../../src/modules/rating/domain";
import { expect, test } from "./fixtures";

test("breadcrumbs identify the current portal section and selected tab", async ({
  studentPage: page,
}) => {
  const year = academicYear(new Date());
  const pages = [
    ["/", "Главная"],
    ["/calendar", "Календарь"],
    ["/calendar/integrations", "Календарь с собой"],
    ["/community", "Все"],
    ["/community?tab=events", "События"],
    ["/community?tab=saved", "Сохранённые"],
    ["/finance?tab=contracts", "Договоры"],
    ["/notifications", "Уведомления"],
    ["/people", "Мои преподаватели"],
    ["/people?tab=departments", "Подразделения"],
    ["/profile", "Основное"],
    ["/profile?tab=documents", "Документы"],
    ["/profile?tab=history", "Учебная история"],
    ["/services", "Каталог услуг"],
    ["/services?tab=requests", "Мои обращения"],
    ["/settings", "Настройки"],
    ["/studies/achievements", "Достижения"],
    ["/studies/achievements/new", "Новое достижение"],
    ["/studies/courses", "Текущий семестр"],
    ["/studies/courses?semester=past", "Завершённые"],
    ["/studies/curriculum?semester=2", "2 семестр"],
    ["/studies/projects", "Практика и проекты"],
    [`/studies/rating?year=${year - 1}`, `${year - 1}/${year}`],
    ["/studies/results?status=attention", "Требует внимания"],
    ["/support", "Поддержка"],
  ];
  const breadcrumbs = page.getByRole("navigation", { name: "Хлебные крошки" });

  for (const [path, label] of pages) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText(
        label,
      );
      const parentLinks = await breadcrumbs.getByRole("link").all();
      for (const link of parentLinks) {
        expect(await link.getAttribute("href")).not.toBe(path);
      }
    });
  }
});

test("details use their page titles and breadcrumbs navigate through tabs and history", async ({
  studentPage: page,
}) => {
  const details = [
    ["/community/event-0", "События", "/community?tab=events"],
    ["/community/news/news-0", "Новости", "/community?tab=news"],
    ["/people/lecturer-0", "Люди", "/people?tab=all"],
    ["/requests/request-2", "Мои обращения", "/services?tab=requests"],
    ["/services/enrollment", "Справки и заявления", "/services"],
    [
      "/studies/achievements/achievement-0",
      "Достижения",
      "/studies/achievements",
    ],
    ["/studies/projects/project-0", "Практика и проекты", "/studies/projects"],
    ["/studies/courses/course-1", "Дисциплины", "/studies/courses"],
  ];
  const breadcrumbs = page.getByRole("navigation", { name: "Хлебные крошки" });
  const current = breadcrumbs.locator('[aria-current="page"]');
  const heading = page.getByRole("main").getByRole("heading", { level: 1 });

  for (const [path, parent, href] of details) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(heading).toBeVisible();
      await expect(current).toHaveText(await heading.innerText());
      await expect(
        breadcrumbs.getByRole("link", { name: parent }),
      ).toHaveAttribute("href", href);
    });
  }

  const course = await heading.innerText();
  await page.getByRole("link", { name: "Участники", exact: true }).click();
  await expect(current).toHaveText("Участники");
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(current).toBeInViewport();
  await expect(breadcrumbs.getByRole("link", { name: course })).toHaveAttribute(
    "href",
    "/studies/courses/course-1",
  );
  await breadcrumbs.getByRole("link", { name: course }).click();
  await expect(current).toHaveText(course);
  await page.goBack();
  await expect(current).toHaveText("Участники");
  await breadcrumbs.getByRole("link", { name: "Дисциплины" }).click();
  await expect(current).toHaveText("Текущий семестр");
  await page.goBack();
  await expect(current).toHaveText("Участники");
});
