import { access, unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  avatarEndpoint,
  avatarPurpose,
} from "../../src/modules/students/avatar";
import { storageRoot } from "../../src/modules/files/service";
import { db } from "../../src/server/db";
import { expect, origin, test } from "./fixtures";

test("a student can upload, replace and remove the private avatar in profile and sidebar", async ({
  browser,
  other,
  student,
}) => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/ryadom_test")
    throw new Error("Refusing non-test DB");
  const userId = "user-student-b";
  const initial = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { image: true },
  });
  const avatars = { studentId: "student-b", purpose: avatarPurpose };
  expect(await db.fileObject.count({ where: avatars })).toBe(0);
  const context = await browser.newContext({
    baseURL: origin,
    storageState: await other.storageState(),
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto("/profile");
    const sidebar = page
      .getByRole("complementary", { name: "Основная навигация" })
      .getByRole("link", { name: "Мой профиль" });
    const sidebarPhoto = sidebar.locator("img");
    const profilePhoto = page
      .getByRole("main")
      .locator(`img[src^="${avatarEndpoint}"]`);
    const upload = page.getByRole("button", { name: "Загрузить фото" });
    const replace = page.getByRole("button", { name: "Изменить фото" });
    const remove = page.getByRole("button", { name: "Удалить фото" });
    const expectRemoveInCorner = async () => {
      await expect(
        profilePhoto
          .locator("..")
          .getByRole("button", { name: "Удалить фото" }),
      ).toBeVisible();
      await expect(remove).toHaveText("");
      const photo = (await profilePhoto.boundingBox())!;
      const button = (await remove.boundingBox())!;
      expect(button.x - photo.x).toBeCloseTo(8, 0);
      expect(photo.y + photo.height - button.y - button.height).toBeCloseTo(
        8,
        0,
      );
    };

    await expect(sidebarPhoto).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      upload.click(),
    ]);
    const png = await sharp({
      create: { width: 720, height: 600, channels: 3, background: "#4166b0" },
    })
      .png()
      .toBuffer();
    await chooser.setFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(replace).toBeEnabled();
    await expect(profilePhoto).toBeVisible();
    await expect(profilePhoto).toHaveCSS("pointer-events", "none");
    await expectRemoveInCorner();
    const first = (await profilePhoto.getAttribute("src"))!;
    await expect(sidebarPhoto).toHaveAttribute("src", first);
    await expect
      .poll(() =>
        sidebarPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    const stored = await other.get(first);
    expect(stored.ok()).toBe(true);
    expect(stored.headers()["content-type"]).toBe("image/webp");
    expect(stored.headers()["cache-control"]).toContain("no-store");
    const metadata = await sharp(await stored.body()).metadata();
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect((await student.get(first)).status()).toBe(404);
    expect(
      (
        await other.get(
          `/api/files/${new URL(first, origin).searchParams.get("v")}`,
        )
      ).status(),
    ).toBe(404);

    await page.reload();
    await expect(profilePhoto).toHaveAttribute("src", first);
    await expect(sidebarPhoto).toHaveAttribute("src", first);
    await page.setViewportSize({ width: 360, height: 800 });
    await expectRemoveInCorner();
    const [replaceChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      replace.click(),
    ]);
    const jpeg = await sharp({
      create: { width: 560, height: 560, channels: 3, background: "#c66a34" },
    })
      .jpeg()
      .toBuffer();
    await replaceChooser.setFiles({
      name: "new.jpg",
      mimeType: "image/jpeg",
      buffer: jpeg,
    });
    await expect(profilePhoto).not.toHaveAttribute("src", first);
    await expect(profilePhoto).toBeVisible();
    const second = (await profilePhoto.getAttribute("src"))!;
    await page.goto("/calendar");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await expect(sidebarPhoto).toHaveAttribute("src", second);
    const bounds = (await sidebarPhoto.boundingBox())!;
    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await expect(page).toHaveURL(/\/profile$/);
    expect((await other.get(first)).status()).toBe(404);
    expect(await db.fileObject.count({ where: avatars })).toBe(1);

    const invalid = await other.post(avatarEndpoint, {
      multipart: {
        file: {
          name: "portrait.png",
          mimeType: "image/png",
          buffer: Buffer.from("not an image"),
        },
      },
    });
    expect(invalid.status()).toBe(422);
    await expect(profilePhoto).toHaveAttribute("src", second);

    await remove.click();
    await expect(upload).toBeEnabled();
    await expect(profilePhoto).toHaveCount(0);
    await expect(remove).toHaveCount(0);
    expect((await other.get(second)).status()).toBe(404);
    expect(await db.fileObject.count({ where: avatars })).toBe(0);
    const key = new URL(second, origin).searchParams.get("v")!;
    await expect(access(join(storageRoot(), key))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect((await other.delete(avatarEndpoint)).ok()).toBe(true);

    await page.reload();
    await expect(upload).toBeEnabled();
    await expect(profilePhoto).toHaveCount(0);
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await expect(sidebarPhoto).toHaveCount(0);
    await expect(sidebar.locator("span[aria-hidden=true]")).toHaveText("МС");
  } finally {
    await context.close();
    const files = await db.fileObject.findMany({
      where: avatars,
      select: { storageKey: true },
    });
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { image: initial.image } }),
      db.fileObject.deleteMany({ where: avatars }),
    ]);
    await Promise.all(
      files.map(({ storageKey }) => unlink(join(storageRoot(), storageKey))),
    );
  }
});
