import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
const env = dotenv.parse(await readFile(".env.test"));
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  { env: { ...process.env, ...env }, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
