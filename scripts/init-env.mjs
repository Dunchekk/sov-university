import { randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
const file = process.argv[2] ?? ".env";
const port = Number(process.argv[3] ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Укажите порт от 1024 до 65535.");
const password = randomBytes(24).toString("hex");
await mkdir(".local", { recursive: true });
try {
  await writeFile(
    file,
    `DATABASE_URL=postgresql://ryadom:${password}@localhost:5438/ryadom\nPOSTGRES_PASSWORD=${password}\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nAPP_URL=http://localhost:${port}\nTRUSTED_ORIGINS=http://localhost:${port}\nAPP_PORT=${port}\nSTORAGE_DIR=./.data/files\nNEXT_TELEMETRY_DISABLED=1\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(`Создан ${file}; секреты не выводятся в лог.`);
} catch (error) {
  if (error.code === "EEXIST")
    console.log(`${file} уже существует, сохранён без изменений.`);
  else throw error;
}
