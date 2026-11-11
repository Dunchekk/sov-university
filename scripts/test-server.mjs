import { readFile, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
const values = dotenv.parse(await readFile(".env.test"));
const env = {
  ...process.env,
  ...values,
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_ENV: "production",
};
delete env.NO_COLOR;
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
let active = build;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => active.kill(signal));
const code = await new Promise((resolve) => build.once("exit", resolve));
if (code !== 0) process.exit(Number(code ?? 1));
const dist = values.NEXT_DIST_DIR ?? ".next-test";
const standalone = resolve(dist, "standalone");
await cp(join(dist, "static"), join(standalone, dist, "static"), {
  recursive: true,
});
await cp("public", join(standalone, "public"), { recursive: true });
active = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  env: {
    ...env,
    STORAGE_DIR: resolve(values.STORAGE_DIR),
    HOSTNAME: "127.0.0.1",
    PORT: "3001",
  },
  stdio: "inherit",
});
active.once("exit", (code) => process.exit(code ?? 0));
