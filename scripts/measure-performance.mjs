import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, request } from "@playwright/test";
import { parse } from "dotenv";

const root = resolve(process.argv[2] ?? ".");
const env = parse(await readFile(resolve(root, ".env.test")));
const database = new URL(env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/ryadom_test"
)
  throw new Error("Use a local ryadom_test database.");

const port = 3002;
const origin = `http://localhost:${port}`;
const routes = [
  { path: "/studies/courses", ready: 'main a[href^="/studies/courses/"]' },
  { path: "/studies/results", ready: 'main section[aria-label="Результаты"]' },
  { path: "/calendar", ready: "[data-calendar-workspace]" },
  { path: "/services", ready: 'main a[href^="/services/"]' },
  { path: "/community", ready: 'main a[href^="/community/"]' },
];
const credentials = JSON.parse(
  await readFile(
    resolve(root, env.DEMO_CREDENTIALS_FILE ?? ".local/test-credentials.json"),
  ),
);
const standalone = resolve(
  root,
  env.NEXT_DIST_DIR ?? ".next-test",
  "standalone",
);
await readFile(resolve(standalone, "server.js"));

function summary(samples) {
  const values = samples.toSorted((a, b) => a - b);
  const percentile = (p) =>
    values.length ? Math.round(values[Math.ceil(values.length * p) - 1]) : null;
  return {
    samples: values.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
  };
}

async function session(identity) {
  const client = await request.newContext({ baseURL: origin });
  try {
    const started = performance.now();
    const response = await client.post("/api/auth/sign-in/email", {
      headers: { Origin: origin },
      data: credentials[identity],
    });
    if (!response.ok())
      throw new Error(`Test sign-in returned ${response.status()}`);
    const signInMs = Math.round(performance.now() - started);
    return { storageState: await client.storageState(), signInMs };
  } finally {
    await client.dispose();
  }
}

async function measureClicks(storageState) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ storageState });
    const samples = routes.map(() => []);
    let scheduleRequests = 0;
    page.on("request", (pending) => {
      if (pending.url().startsWith(`${origin}/api/schedules/`))
        scheduleRequests++;
    });
    await page.goto(origin);
    const first = [];
    for (let round = 0; round < 7; round++) {
      for (const [index, route] of routes.entries()) {
        const link = page.locator(`aside nav a[href="${route.path}"]`);
        await link.evaluate((element, { path, ready }) => {
          window.portalNavigation = new Promise((resolve, reject) => {
            element.addEventListener(
              "click",
              () => {
                const start = performance.now();
                const waitForContent = () => {
                  const visible =
                    location.pathname === path &&
                    document.querySelector(ready)?.getClientRects().length;
                  if (visible)
                    requestAnimationFrame(() =>
                      resolve(performance.now() - start),
                    );
                  else if (performance.now() - start > 10000)
                    reject(new Error(`Content did not render for ${path}`));
                  else requestAnimationFrame(waitForContent);
                };
                requestAnimationFrame(waitForContent);
              },
              { once: true },
            );
          });
        }, route);
        await link.click();
        const elapsed = await page.evaluate(() => window.portalNavigation);
        if (round === 0) first[index] = Math.round(elapsed);
        else samples[index].push(elapsed);
      }
    }
    return {
      clicks: Object.fromEntries(
        routes.map(({ path }, i) => [
          path,
          { firstMs: first[i], ...summary(samples[i]) },
        ]),
      ),
      backgroundScheduleRequests: scheduleRequests,
    };
  } finally {
    await browser.close();
  }
}

async function measureLoad(sessions) {
  const cookies = sessions.map(({ storageState }) =>
    storageState.cookies
      .map(({ name, value }) => `${name}=${value}`)
      .join("; "),
  );
  const paths = ["/", ...routes.map(({ path }) => path)];
  const results = [];
  for (const concurrency of [1, 10, 30, 60]) {
    const total = Math.max(30, concurrency * 6);
    const samples = [];
    let errors = 0;
    let next = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (next < total) {
          const index = next++;
          const path = paths[index % paths.length];
          const started = performance.now();
          try {
            const response = await fetch(origin + path, {
              headers: {
                Cookie:
                  cookies[Math.floor(index / paths.length) % cookies.length],
              },
              redirect: "manual",
              signal: AbortSignal.timeout(15000),
            });
            const body = await response.text();
            if (!response.ok || body.includes('content="0;url=/login"'))
              errors++;
            samples.push(performance.now() - started);
          } catch {
            errors++;
          }
        }
      }),
    );
    results.push({ concurrency, total, errors, ...summary(samples) });
  }
  return results;
}

async function awaitHealth(server) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null)
      throw new Error("The standalone server exited.");
    const health = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(500),
    }).catch(() => null);
    if (health?.ok) return;
    await delay(250);
  }
  throw new Error("The standalone server did not become healthy.");
}

const portCheck = createServer();
await new Promise((resolve, reject) => {
  portCheck.once("error", reject);
  portCheck.listen(port, "127.0.0.1", resolve);
});
await new Promise((resolve) => portCheck.close(resolve));

const server = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  env: {
    ...process.env,
    ...env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    APP_URL: origin,
    TRUSTED_ORIGINS: origin,
    STORAGE_DIR: resolve(root, env.STORAGE_DIR),
  },
  stdio: ["ignore", "ignore", "inherit"],
});
try {
  await awaitHealth(server);
  const studentA = await session("student-a");
  const browser = await measureClicks(studentA.storageState);
  const studentB = await session("student-b");
  const load = await measureLoad([studentA, studentB]);
  console.log(
    JSON.stringify(
      {
        signInMs: [studentA.signInMs, studentB.signInMs],
        ...browser,
        load,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
