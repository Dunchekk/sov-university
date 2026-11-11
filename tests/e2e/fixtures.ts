import {
  test as base,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { readFile } from "node:fs/promises";
export const origin = "http://localhost:3001";
export type Credentials = Record<string, { email: string; password: string }>;
export const credentials = async () =>
  JSON.parse(
    await readFile(".local/test-credentials.json", "utf8"),
  ) as Credentials;
export const login = async (
  request: APIRequestContext,
  which = "student-a",
) => {
  const all = await credentials();
  const response = await request.post("/api/auth/sign-in/email", {
    data: all[which],
    headers: { Origin: origin },
  });
  expect(response.status()).toBe(200);
};
export const test = base.extend<
  { studentPage: Page; other: APIRequestContext; student: APIRequestContext },
  {
    aState: Awaited<ReturnType<BrowserContext["storageState"]>>;
    bState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  }
>({
  aState: [
    async ({ playwright }, provide) => {
      const request = await playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
      });
      await login(request);
      await provide(await request.storageState());
      await request.dispose();
    },
    { scope: "worker" },
  ],
  bState: [
    async ({ playwright }, provide) => {
      const request = await playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
      });
      await login(request, "student-b");
      await provide(await request.storageState());
      await request.dispose();
    },
    { scope: "worker" },
  ],
  student: [
    async ({ playwright, aState }, provide) => {
      const request = await playwright.request.newContext({
        baseURL: origin,
        storageState: aState,
        extraHTTPHeaders: { Origin: origin },
      });
      await provide(request);
      await request.dispose();
    },
    { scope: "test" },
  ],
  other: [
    async ({ playwright, bState }, provide) => {
      const request = await playwright.request.newContext({
        baseURL: origin,
        storageState: bState,
        extraHTTPHeaders: { Origin: origin },
      });
      await provide(request);
      await request.dispose();
    },
    { scope: "test" },
  ],
  studentPage: async ({ browser, aState }, provide) => {
    const context = await browser.newContext({
      baseURL: origin,
      storageState: aState,
      viewport: { width: 1440, height: 900 },
      timezoneId: "Europe/Moscow",
    });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});
export { expect };
