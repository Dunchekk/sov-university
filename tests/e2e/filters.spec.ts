import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
import { dateKey } from "../../src/shared/lib/time";
import { expect, test } from "./fixtures";

test("achievement category filters the cards immediately and survives reload and reset", async ({
  studentPage: page,
}) => {
  const expected = await db.achievement.findMany({
    where: { studentId: "student-a", category: "Наука" },
    orderBy: { date: "desc" },
    select: { title: true },
  });
  expect(expected.length).toBeGreaterThan(0);

  await page.goto("/studies/achievements");
  const cards = page.locator('main a[href^="/studies/achievements/"] h2');
  expect(await cards.count()).toBeGreaterThan(expected.length);
  const filter = page.getByRole("combobox", { name: "Категория" });
  await filter.focus();
  await filter.selectOption("Наука");
  await expect(cards).toHaveText(expected.map(({ title }) => title));
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("category") === "Наука",
  );
  await expect(filter).toBeFocused();

  await page.reload();
  await expect(filter).toHaveValue("Наука");
  await expect(cards).toHaveText(expected.map(({ title }) => title));
  await filter.selectOption("");
  await expect(page).toHaveURL(/\/studies\/achievements$/);
  await expect(cards).not.toHaveCount(expected.length);
  await page.goBack();
  await expect(filter).toHaveValue("Наука");
  await expect(cards).toHaveText(expected.map(({ title }) => title));
});

test("project type combines with a semester read from the student's projects", async ({
  studentPage: page,
}) => {
  const project = await db.studentProject.findUniqueOrThrow({
    where: { id: "project-0" },
  });
  await db.studentProject.update({
    where: { id: project.id },
    data: { semester: 5 },
  });
  try {
    await page.goto("/studies/projects");
    const semester = page.getByRole("combobox", { name: "Семестр" });
    const kind = page.getByRole("combobox", { name: "Тип работы" });
    const cards = page.locator('main a[href^="/studies/projects/"] h2');
    await semester.selectOption("5");
    await expect(cards).toHaveText([project.title]);
    await kind.selectOption(project.kind === "ВКР" ? "Практика" : "ВКР");
    await expect(page.getByText("Работ по фильтру нет")).toBeVisible();
    await expect(cards).toHaveCount(0);
    await expect(semester).toHaveValue("5");
    await page.getByRole("link", { name: "Сбросить фильтры" }).click();
    await expect(cards).not.toHaveCount(0);
    await expect(semester).toHaveValue("");
    await expect(kind).toHaveValue("");
  } finally {
    await db.studentProject.update({
      where: { id: project.id },
      data: { semester: project.semester },
    });
  }
});

test("notification category and unread filters survive pagination", async ({
  studentPage: page,
}) => {
  const prefix = `filter-${randomUUID()}`;
  const title = (index: number) => `Проверка уведомлений ${prefix} ${index}`;
  await db.notification.createMany({
    data: Array.from({ length: 23 }, (_, index) => ({
      studentId: "student-a",
      dedupKey: `${prefix}-${index}`,
      title: title(index),
      body: "Проверка фильтра",
      href: "/calendar",
      category: index === 22 ? "REQUEST" : "CALENDAR",
      readAt: index === 21 ? new Date() : null,
      createdAt: new Date(2200000000000 + index * 1000),
    })),
  });
  try {
    await page.goto("/notifications");
    await page
      .getByRole("combobox", { name: "Категория" })
      .selectOption("CALENDAR");
    await page.getByRole("checkbox", { name: "Только непрочитанные" }).check();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("category") === "CALENDAR" &&
        url.searchParams.get("unread") === "true",
    );
    await expect(
      page.getByRole("heading", { name: title(20), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: title(21), exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: title(22), exact: true }),
    ).toHaveCount(0);

    await page.getByRole("link", { name: "Далее", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title(0), exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("page") === "2" &&
        url.searchParams.get("category") === "CALENDAR" &&
        url.searchParams.get("unread") === "true",
    );
    await page.getByRole("link", { name: "Назад", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title(20), exact: true }),
    ).toBeVisible();
  } finally {
    await db.notification.deleteMany({
      where: { studentId: "student-a", dedupKey: { startsWith: prefix } },
    });
  }
});

test("services and courses apply real queries and clear empty results", async ({
  studentPage: page,
}) => {
  await page.goto("/services");
  const search = page.getByRole("textbox", { name: "Поиск услуг" });
  await expect(search).toHaveAttribute("placeholder", "Поиск...");
  await expect(page.getByText("Что нужно?", { exact: true })).toHaveCount(0);
  await search.fill("оплата");
  await page
    .getByRole("combobox", { name: "Категория" })
    .selectOption("Финансы");
  const services = page.locator('main a[href^="/services/"] h2');
  await expect(services).toHaveText(["Подтверждение оплаты обучения"]);
  await search.fill("%");
  await search.press("Enter");
  await expect(services).toHaveCount(0);
  await expect(page.getByText("Услуги не найдены")).toBeVisible();

  await page.goto("/studies/courses?semester=past");
  const courses = page.locator('main a[href^="/studies/courses/"] h2');
  const courseSearch = page.getByRole("textbox", { name: "Поиск дисциплины" });
  await expect(courseSearch).toHaveAttribute("placeholder", "Поиск...");
  await expect(page.getByText("Поиск дисциплины", { exact: true })).toHaveCount(
    0,
  );
  await courseSearch.fill("типографика");
  await courseSearch.press("Enter");
  await expect(courses).toHaveText([/типографика/i]);
  await page.getByRole("link", { name: "Текущий семестр" }).click();
  await expect(page.getByText("Дисциплины не найдены")).toBeVisible();
  await expect(courseSearch).toHaveValue("типографика");
  await page.getByRole("link", { name: "Сбросить поиск" }).click();
  await expect(courses.first()).toBeVisible();
});

test("roster combines group and role and restores the selected filters after reload", async ({
  studentPage: page,
}) => {
  const lesson = await db.lesson.findFirstOrThrow({
    where: { courseId: "course-1" },
  });
  const group = await db.group.findFirstOrThrow({
    where: { id: { not: lesson.groupId }, roster: { some: {} } },
  });
  const id = `qa-roster-${randomUUID()}`;
  await db.lesson.create({ data: { ...lesson, id, groupId: group.id } });
  try {
    await page.goto("/studies/courses/course-1?tab=people");
    const role = page.getByRole("combobox", { name: "Роль" });
    const groupFilter = page.getByRole("combobox", {
      name: "Группа студентов",
    });
    await groupFilter.selectOption(group.id);
    await role.selectOption("student");
    const students = page.getByText(/^Студент · /);
    await expect(students.first()).toHaveText(`Студент · ${group.name}`);
    expect(
      (await students.allTextContents()).every((text) =>
        text.endsWith(group.name),
      ),
    ).toBe(true);
    await expect(page.getByText(/^Преподаватель · /)).toHaveCount(0);

    await page.reload();
    await expect(role).toHaveValue("student");
    await expect(groupFilter).toHaveValue(group.id);
    await expect(students.first()).toHaveText(`Студент · ${group.name}`);
    await role.selectOption("teacher");
    await page.getByLabel("Найти участника").fill("точного совпадения нет");
    await expect(page.getByText("Участники не найдены")).toBeVisible();
    await page.getByRole("link", { name: "Участники", exact: true }).click();
    await expect(role).toHaveValue("");
    await expect(page.getByLabel("Найти участника")).toHaveValue("");
  } finally {
    await db.lesson.delete({ where: { id } });
  }
});

test("search under My teachers stays within the student's courses", async ({
  studentPage: page,
}) => {
  const taught = { enrollments: { some: { studentId: "student-a" } } };
  const [mine, other] = await Promise.all([
    db.person.findFirstOrThrow({ where: { courses: { some: taught } } }),
    db.person.findFirstOrThrow({ where: { courses: { none: taught } } }),
  ]);
  await page.goto("/people");
  const search = page.getByRole("textbox", { name: "Поиск" });
  await search.fill(mine.name);
  await search.press("Enter");
  await expect(page.locator("main h2")).toHaveText([mine.name]);
  await search.fill(other.name);
  await search.press("Enter");
  await expect(page.getByText("Никого не нашли")).toBeVisible();
  await expect(page.getByRole("heading", { name: other.name })).toHaveCount(0);
});

test("calendar combines rapid filter changes and keeps matching events on reload", async ({
  studentPage: page,
}) => {
  await page.goto(`/calendar?view=week&date=${dateKey()}`);
  const lessons = page.locator('button[data-type="LESSON"]');
  const deadlines = page.locator('button[data-type="DEADLINE"]');
  expect(await lessons.count()).toBeGreaterThan(0);
  expect(await deadlines.count()).toBeGreaterThan(0);

  const lessonFilter = page.getByRole("checkbox", {
    name: "Пара",
    exact: true,
  });
  const deadlineFilter = page.getByRole("checkbox", {
    name: "Дедлайн",
    exact: true,
  });
  await lessonFilter.uncheck();
  await deadlineFilter.uncheck();
  await expect(page).toHaveURL((url) => {
    const types = url.searchParams.get("types")?.split(",");
    return !!types && !types.includes("LESSON") && !types.includes("DEADLINE");
  });
  await expect(lessons).toHaveCount(0);
  await expect(deadlines).toHaveCount(0);
  await page.reload();
  await expect(lessonFilter).not.toBeChecked();
  await expect(deadlineFilter).not.toBeChecked();
  await expect(lessons).toHaveCount(0);
  await expect(deadlines).toHaveCount(0);
});
