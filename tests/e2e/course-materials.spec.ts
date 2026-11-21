import { expect, test } from "./fixtures";

test("course materials provide authorised downloads and preserve the task list", async ({
  studentPage: page,
  student,
  other,
}) => {
  await page.goto("/studies/courses/course-0?tab=materials");
  const active = page.getByRole("link", {
    name: "Материалы и задания",
    exact: true,
  });
  await expect(active).toHaveAttribute("aria-current", "page");
  await expect(active).toHaveCSS("font-weight", "400");
  await expect(
    page.getByRole("link", { name: "Участники", exact: true }),
  ).toHaveCSS("font-weight", "400");
  await expect(
    page.getByRole("heading", { name: "Задания и сроки" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Итоговый проект" }),
  ).toBeVisible();

  for (const [label, format, mime] of [
    ["Презентации", "PDF", "application/pdf"],
    ["Расшифровки", "TXT", "text/plain; charset=utf-8"],
    ["Записи встреч", "M4A", "audio/mp4"],
  ]) {
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    const href = await page
      .getByRole("link", {
        name: new RegExp(`Проверка прототипа интерфейса.*${format}`),
      })
      .getAttribute("href");
    expect(href).toBeTruthy();
    const response = await student.get(href!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toBe(mime);
    expect(response.headers()["content-disposition"]).toContain("attachment");
    expect((await other.get(href!)).status()).toBe(404);
    const bytes = await response.body();
    if (format === "PDF") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    if (format === "TXT")
      expect(bytes.toString()).toContain("Демонстрационная расшифровка");
    if (format === "M4A") expect(bytes.subarray(4, 8).toString()).toBe("ftyp");
  }
});

test("course assessment uses white keyboard-accessible disclosures", async ({
  studentPage: page,
}) => {
  await page.goto("/studies/courses/course-0?tab=assessment");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  for (const label of ["Шкала и правила оценивания", "Журнал посещаемости"]) {
    const toggle = page.locator("summary").filter({ hasText: label });
    const disclosure = toggle.locator("..");
    await expect(disclosure).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(disclosure).toHaveJSProperty("open", false);
    await toggle.scrollIntoViewIfNeeded();
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveJSProperty("open", true);
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveJSProperty("open", false);
  }
});
