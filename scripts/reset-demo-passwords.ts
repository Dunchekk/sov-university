import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/password";
// Explicit local administrative recovery command, never exposed over HTTP.
const file =
  process.env.DEMO_CREDENTIALS_FILE ?? ".local/demo-credentials.json";
const credentials: Record<string, { email: string; password: string }> = {};
for (const id of ["student-a", "student-b"]) {
  const user = await db.user.findUniqueOrThrow({ where: { id: `user-${id}` } });
  const password = randomBytes(18).toString("base64url");
  const hash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: hash },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
  credentials[id] = { email: user.email, password };
}
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(credentials, null, 2), { mode: 0o600 });
await db.$disconnect();
console.log("Демо-пароли обновлены в локальном файле, старые сессии отозваны.");
