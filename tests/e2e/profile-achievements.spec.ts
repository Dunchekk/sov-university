import { expect, origin, test } from "./fixtures";

for (const profile of [
  {
    account: "student-a",
    name: "Александра Миронова",
    width: 1440,
    theme: "light",
    exclusive: ["ДПО пройдено", "Командный проект", "Волонтёр кампуса"],
    description:
      /завершение программы дополнительного профессионального образования/,
  },
  {
    account: "student-b",
    name: "Михаил Соколов",
    width: 360,
    theme: "dark",
    exclusive: [
      "Больше 30 кредитов за месяц",
      "В пятёрке рейтинга",
      "Финалист хакатона",
    ],
    description: /за один календарный месяц/,
  },
]) {
  test(`profile achievements for ${profile.name}`, async ({
    browser,
    aState,
    bState,
  }) => {
    const context = await browser.newContext({
      baseURL: origin,
      storageState: profile.account === "student-a" ? aState : bState,
      viewport: { width: profile.width, height: 900 },
    });
    try {
      await context.addCookies([
        { name: "theme", value: profile.theme, url: origin },
      ]);
      const page = await context.newPage();
      await page.goto("/profile");
      await expect(
        page.getByRole("heading", { name: profile.name }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        profile.theme,
      );

      const card = page.getByRole("region", { name: "Ачивки" });
      const badges = card.getByRole("list").getByRole("button");
      const expected = ["Студент", "Сессия закрыта", ...profile.exclusive];
      await expect(badges).toHaveCount(expected.length);
      for (const title of expected)
        await expect(
          card.getByRole("button", { name: title, exact: true }),
        ).toBeVisible();

      const settings = (await page
        .getByRole("navigation", { name: "Действия профиля" })
        .getByRole("link", { name: "Настройки", exact: true })
        .boundingBox())!;
      const bounds = (await card.boundingBox())!;
      if (profile.width <= 760) {
        const contacts = (await page
          .getByRole("region", { name: "Контакты", exact: true })
          .boundingBox())!;
        expect(bounds.x).toBeCloseTo(contacts.x, 0);
        expect(bounds.width).toBeCloseTo(contacts.width, 0);
        expect(bounds.y).toBeGreaterThanOrEqual(contacts.y + contacts.height);
      } else {
        expect(bounds.x).toBeCloseTo(settings.x, 0);
        expect(bounds.width).toBeCloseTo(settings.width, 0);
        const gap = bounds.y - settings.y - settings.height;
        expect(gap).toBeGreaterThanOrEqual(0);
        expect(gap).toBeLessThanOrEqual(16);
      }

      const [title] = profile.exclusive;
      const badge = card.getByRole("button", { name: title, exact: true });
      await badge.focus();
      await badge.press("Enter");
      const detail = page.getByRole("dialog", { name: title });
      await expect(detail.getByText(profile.description)).toBeVisible();
      await expect
        .poll(() =>
          detail
            .locator("img")
            .evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(detail).toBeHidden();
      await expect(badge).toBeFocused();

      const all = card.getByRole("button", { name: "Посмотреть все" });
      await all.click();
      const collection = page.getByRole("dialog", { name: "Все ачивки" });
      await expect(collection.getByRole("listitem")).toHaveCount(
        expected.length,
      );
      await collection.getByRole("button", { name: title }).click();
      await expect(detail).toBeVisible();
      const back = detail.getByRole("button", { name: "Ко всем ачивкам" });
      await expect(back).toBeFocused();
      await back.press("Enter");
      await expect(collection).toBeVisible();
      await collection.getByRole("button", { name: "Закрыть" }).click();
      await expect(collection).toBeHidden();
    } finally {
      await context.close();
    }
  });
}
