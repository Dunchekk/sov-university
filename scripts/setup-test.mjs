import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import dotenv from "dotenv";
const env = dotenv.parse(await readFile(".env"));
const url = new URL(env.DATABASE_URL);
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
const exists = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='ryadom_test'",
);
if (!exists.rowCount) await client.query("CREATE DATABASE ryadom_test");
await client.end();
url.pathname = "/ryadom_test";
await mkdir(".local", { recursive: true });
let previous = {};
try {
  previous = dotenv.parse(await readFile(".env.test"));
} catch {}
const config = {
  ...env,
  DATABASE_URL: url.toString(),
  APP_URL: "http://localhost:3001",
  TRUSTED_ORIGINS: "http://localhost:3001",
  BETTER_AUTH_SECRET:
    previous.BETTER_AUTH_SECRET ?? randomBytes(32).toString("hex"),
  STORAGE_DIR: ".data/test-files",
  DEMO_CREDENTIALS_FILE: ".local/test-credentials.json",
  NEXT_DIST_DIR: ".next-test",
};
await writeFile(
  ".env.test",
  Object.entries(config)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
for (const args of [
  ["prisma", "migrate", "deploy"],
  ["tsx", "prisma/seed.ts"],
]) {
  const r = spawnSync("npx", args, {
    env: { ...process.env, ...config },
    stdio: "inherit",
  });
  if (r.status) process.exit(r.status);
}
console.log("Изолированная test database готова.");
