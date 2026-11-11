import { db } from "@/server/db";
import { mkdir, access, constants } from "node:fs/promises";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const dir = process.env.STORAGE_DIR ?? ".data/files";
    await mkdir(dir, { recursive: true });
    await access(dir, constants.W_OK);
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
