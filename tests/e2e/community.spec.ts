import { randomUUID } from "node:crypto";
import { db } from "../../src/server/db";
import { addDays, dateKey, formatDate } from "../../src/shared/lib/time";
import { expect, test } from "./fixtures";

test("selecting and clearing a date keeps the rail in place across months", async ({
  studentPage: page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/community?rail=2026-11-28");
  const rail = page.getByRole("navigation", { name: "Публикации по дате" });
  const track = rail.locator(":scope > div");
  const december = rail.getByRole("link", { name: /\b1 декабря 2026/ });
  const scrollLeft = () => track.evaluate((element) => element.scrollLeft);
  await expect.poll(scrollLeft).toBeGreaterThan(0);
  await expect(rail.getByText("ноябрь", { exact: true })).toHaveCount(0);
  await expect(rail.getByText("декабрь", { exact: true })).toHaveCount(1);
  await expect(december.locator("..")).toContainText("декабрь");
  const initialPosition = await scrollLeft();
  await december.click();
  await expect(december).toHaveAttribute("aria-current", "date");
  expect(await scrollLeft()).toBe(initialPosition);
  await page.getByRole("link", { name: "Все даты", exact: true }).click();
  await expect(december).not.toHaveAttribute("aria-current", "date");
  expect(await scrollLeft()).toBe(initialPosition);
  await page.goBack();
  await expect(december).toHaveAttribute("aria-current", "date");
  expect(await scrollLeft()).toBe(initialPosition);
});

test("community filters publications and opens illustrated details", async ({
  studentPage: page,
  student,
}) => {
  const response = await student.get("/api/community/event-0");
  expect(response.ok()).toBe(true);
  const event = await response.json();
  const date = dateKey(event.startsAt);
  await page.goto(`/community?from=${addDays(date, -18)}`);

  const tabs = page.getByRole("navigation", { name: "Виды публикаций" });
  const feed = page.getByRole("list", { name: "Публикации" });
  await expect(tabs.getByRole("link", { name: "Все" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(feed.getByRole("listitem")).toHaveCount(47);
  await tabs.getByRole("link", { name: "Новости" }).click();
  await expect(feed.getByRole("listitem")).toHaveCount(22);
  await feed.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/community\/news\//);
  await expect(page.locator("main article p").nth(1)).toBeVisible();
  const cover = page.locator("main article img");
  await expect
    .poll(() => cover.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.goBack();

  const eventsTab = tabs.getByRole("link", { name: "События" });
  await eventsTab.click();
  await expect(eventsTab).toHaveAttribute("aria-current", "page");

  let releaseCityRequest!: () => void;
  const cityRequest = new Promise<void>((resolve) => {
    releaseCityRequest = resolve;
  });
  await page.route(
    (url) =>
      url.pathname === "/community" &&
      url.searchParams.get("city") === "Москва",
    async (route) => {
      await cityRequest;
      await route.continue();
    },
  );
  const city = page.getByRole("button", { name: /^Город:/ });
  await city.press("ArrowDown");
  const cityMenu = page.getByRole("menu", { name: "Город" });
  await expect(cityMenu).toBeVisible();
  await expect
    .poll(async () => {
      const trigger = (await city.boundingBox())!;
      const popup = (await cityMenu.boundingBox())!;
      return popup.y - trigger.y - trigger.height;
    })
    .toBeGreaterThan(0);
  await expect(
    cityMenu.getByRole("menuitemradio", { name: "Все города" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    cityMenu.getByRole("menuitemradio", { name: "Москва" }),
  ).toBeFocused();
  try {
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("status", { name: "Загрузка публикаций" }),
    ).toBeVisible();
    await expect(feed).toHaveCount(0);
  } finally {
    releaseCityRequest();
  }
  await expect(
    page.getByRole("heading", { name: "Москва", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Категория:/ }).click();
  await page.getByRole("menuitemradio", { name: "Образование" }).click();
  await expect(feed.getByRole("listitem")).toHaveCount(2);

  const day = page
    .getByRole("navigation", { name: "Публикации по дате" })
    .getByRole("link", {
      name: formatDate(event.startsAt, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      exact: true,
    });
  await day.click();
  await expect(feed.getByRole("listitem")).toHaveCount(1);
  await expect(day).toHaveAttribute("aria-current", "date");
  await feed.getByRole("link", { name: new RegExp(event.title) }).click();
  await expect(
    page.getByRole("heading", { name: event.title, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /в мой календарь|в моём календаре/i }),
  ).toBeVisible();
});

test("the new edition shows original illustrated event and news stories", async ({
  studentPage: page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const cases = [
    {
      path: "/community/edition-event-winter-bird-count",
      title: "Кого слышно в зимнем парке",
      paragraph: "В каждой паре один человек наблюдает",
      cover: "city-birds.webp",
    },
    {
      path: "/community/news/edition-news-pond-water-project",
      title: "Студенты собрали первый атлас жизни в городском пруду",
      paragraph: "Рядом с каждым снимком указаны место отбора",
      cover: "microscope.webp",
    },
  ];
  for (const item of cases) {
    await page.goto(item.path);
    const article = page.getByRole("article");
    await expect(article.getByRole("heading", { level: 1 })).toHaveText(
      item.title,
    );
    await expect(
      article.getByText(item.paragraph, { exact: false }),
    ).toBeVisible();
    const cover = article.locator("img");
    await expect(cover).toHaveAttribute("src", new RegExp(item.cover));
    await cover.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        cover.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  }
});

test("home highlights mix events and news and fade only scrollable edges", async ({
  studentPage: page,
}) => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/ryadom_test")
    throw new Error("Refusing non-test DB");
  const id = randomUUID();
  const title = "Ближайшее событие для проверки афиши";
  await db.communityEvent.create({
    data: {
      id,
      title,
      category: "Образование",
      description: "Проверка карточки события на главной.",
      organizer: "Студенческий центр",
      location: "Учебный корпус",
      startsAt: new Date(Date.now() + 15 * 60_000),
      endsAt: new Date(Date.now() + 75 * 60_000),
      cover: "/community/covers/urban-lab.webp",
    },
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");
    const section = page.getByRole("region", { name: "За пределами пар" });
    const strip = section.getByRole("list", { name: "События и новости" });
    const headingLink = section
      .getByRole("heading", { name: "За пределами пар" })
      .getByRole("link");
    const event = strip.getByRole("link", { name: new RegExp(title) });
    await expect(event).toHaveAttribute("href", `/community/${id}`);
    await strip.scrollIntoViewIfNeeded();
    const cover = event.locator("img");
    await expect(cover).toBeVisible();
    await expect
      .poll(() =>
        cover.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const cards = strip.locator(":scope > li > a");
    expect(await strip.locator("img").count()).toBeGreaterThanOrEqual(
      (await cards.count()) - 2,
    );
    const heights = () =>
      cards.evaluateAll((links) =>
        links.map((link) => link.getBoundingClientRect().height),
      );
    expect(await heights()).toEqual(Array(await cards.count()).fill(144));
    await expect(strip).toHaveCSS("scroll-snap-type", "x mandatory");
    await expect(
      strip.locator('a[href^="/community/news/"]').first(),
    ).toBeVisible();
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(headingLink).toHaveAttribute("href", "/community");
    await expect(headingLink.locator("svg")).toHaveCount(1);
    await expect(strip).not.toHaveAttribute("data-fade-start");
    await expect(strip).toHaveAttribute("data-fade-end", "true");
    await strip.press("ArrowRight");
    await expect(strip).toHaveAttribute("data-fade-start", "true");
    await strip.press("ArrowLeft");
    await expect(strip).not.toHaveAttribute("data-fade-start");
    await strip.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect(strip).not.toHaveAttribute("data-fade-end");
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await heights()).toEqual(Array(await cards.count()).fill(144));
    await headingLink.click();
    await expect(
      page.getByRole("heading", { name: "События", level: 1 }),
    ).toBeVisible();
  } finally {
    await db.communityEvent.delete({ where: { id } });
  }
});
