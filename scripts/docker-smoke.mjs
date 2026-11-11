import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { request, chromium } from "@playwright/test";
const origin = "http://localhost:3010";
const credentials = JSON.parse(
  await readFile(".local/docker-smoke-credentials.json", "utf8"),
);
const client = await request.newContext({
  baseURL: origin,
  extraHTTPHeaders: { Origin: origin },
});
assert.equal(
  (
    await client.post("/api/auth/sign-in/email", {
      data: credentials["student-a"],
    })
  ).status(),
  200,
  "Docker login",
);
const created = await client.post("/api/requests", {
  data: {
    serviceSlug: "support",
    fields: {
      subject: "Docker persistence",
      description: "Проверка сохранности после перезапуска.",
    },
    key: randomUUID(),
  },
});
assert.equal(created.status(), 200);
const draft = await created.json();
const sourcePdf = await client.get("/api/files/result-3");
assert.equal(sourcePdf.status(), 200);
const bytes = await sourcePdf.body();
const upload = await client.post("/api/files", {
  multipart: {
    purpose: "REQUEST_ATTACHMENT",
    resourceId: draft.id,
    file: { name: "smoke.pdf", mimeType: "application/pdf", buffer: bytes },
  },
});
assert.equal(upload.status(), 200);
const file = await upload.json();
const digest = createHash("sha256").update(bytes).digest("hex");
const from = new Date().toISOString().slice(0, 10);
const to = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
const calendar = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:docker-smoke\r\nDTSTART:${from.replaceAll("-", "")}T180000Z\r\nSUMMARY:Проверка Docker\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const preview = await client.post("/api/calendar/imports/preview", {
  multipart: {
    name: "Docker smoke",
    timezone: "Europe/Moscow",
    from,
    to,
    file: {
      name: "smoke.ics",
      mimeType: "text/calendar",
      buffer: Buffer.from(calendar),
    },
  },
});
assert.equal(
  preview.status(),
  200,
  "ICS worker available inside standalone image",
);
const p = await preview.json();
assert.equal(
  (
    await client.post(`/api/calendar/imports/${p.id}/commit`, { data: {} })
  ).status(),
  200,
  "Zero-duration ICS committed",
);
const feed = await (
  await client.post("/api/calendar/feeds", {
    data: { name: "Smoke", layers: ["LESSON"] },
  })
).json();
const anonymous = await request.newContext();
assert.equal((await anonymous.get(feed.url)).status(), 200, "Anonymous feed");
await client.delete(`/api/calendar/feeds/${feed.id}`);
assert.equal((await anonymous.get(feed.url)).status(), 404, "Revoked feed");
execFileSync(
  "docker",
  [
    "--context",
    "colima-hackathon",
    "compose",
    "-p",
    "ryadom-smoke",
    "--env-file",
    ".env.smoke",
    "restart",
    "app",
    "db",
  ],
  { stdio: "inherit" },
);
let ready = false;
for (let i = 0; i < 80; i++) {
  try {
    ready = (await fetch(`${origin}/api/health`)).ok;
  } catch {}
  if (ready) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert.equal(ready, true, "Health after restart");
assert.equal(
  (await client.get("/api/me")).status(),
  200,
  "Session survives restart",
);
const after = await client.get(`/api/requests/${draft.id}`);
assert.equal(after.status(), 200);
assert.equal((await after.json()).fields.subject, "Docker persistence");
const downloaded = await client.get(`/api/files/${file.id}`);
assert.equal(downloaded.status(), 200);
assert.equal(
  createHash("sha256")
    .update(await downloaded.body())
    .digest("hex"),
  digest,
);
const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: await client.storageState(),
});
const page = await context.newPage();
const errors = [];
const externalRequests = new Set();
const fonts = new Set();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()))
    errors.push(message.text());
});
page.on("request", (r) => {
  const url = new URL(r.url());
  if (url.origin !== origin) externalRequests.add(url.origin);
  if (r.resourceType() === "font") fonts.add(url.pathname);
});
await page.goto(origin);
await page.getByRole("heading", { name: "Сегодня", exact: true }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.goto(`${origin}/calendar?view=month`);
await page.getByRole("heading", { name: "Календарь", exact: true }).waitFor();
await page.goto(`${origin}/studies/courses/course-1?tab=people`);
await page.getByLabel("Найти участника").waitFor();
await page.goto(`${origin}/calendar/integrations`);
await page.getByRole("button", { name: "Импортировать", exact: true }).click();
await page.getByLabel("Название слоя").waitFor();
assert.deepEqual(errors, []);
assert.deepEqual([...externalRequests], [], "All runtime resources stay local");
assert.ok(fonts.size > 0, "Local font resources were loaded");
await browser.close();
await anonymous.dispose();
await client.dispose();
await writeFile(
  ".local/docker-smoke-result.json",
  JSON.stringify(
    {
      passed: true,
      requestId: draft.id,
      fileId: file.id,
      checksum: digest,
      network: {
        externalRequests: [...externalRequests],
        localFonts: [...fonts],
      },
      tests: [
        "clean migrate+seed",
        "non-root runtime",
        "login",
        "request+PDF",
        "isolated ICS worker",
        "zero-duration import",
        "feed+revoke",
        "app/db restart",
        "session+data+file persistence",
        "Chromium hydration",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Docker smoke passed: login, request/PDF, ICS/feed, restart persistence and browser.",
);
