import { readLimited } from "@/server/body";
import { createHash } from "node:crypto";
import { auth } from "@/server/auth";
import { assertOrigin } from "@/server/access";
import { db } from "@/server/db";
import { errorResponse, invariant } from "@/server/errors";
export const dynamic = "force-dynamic";
async function limited(key: string, limit: number) {
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "LoginAttempt" ("key", "count", "expiresAt") VALUES (${key}, 1, NOW() + INTERVAL '15 minutes') ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "LoginAttempt"."expiresAt" < NOW() THEN 1 ELSE "LoginAttempt"."count" + 1 END, "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" < NOW() THEN NOW() + INTERVAL '15 minutes' ELSE "LoginAttempt"."expiresAt" END RETURNING "count"`;
  invariant(
    rows[0].count <= limit,
    429,
    "RATE_LIMIT",
    "Слишком много попыток. Попробуйте через 15 минут.",
  );
}
async function handler(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const allowed =
      request.method === "GET"
        ? ["/api/auth/get-session"]
        : ["/api/auth/sign-in/email", "/api/auth/sign-out"];
    invariant(
      allowed.includes(pathname),
      404,
      "NOT_FOUND",
      "Маршрут недоступен.",
    );
    if (request.method !== "GET") assertOrigin(request);
    let emailKey: string | undefined;
    const bytes =
      request.method === "POST" ? await readLimited(request, 4096) : undefined;
    const authRequest = bytes
      ? new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: new Uint8Array(bytes),
        })
      : request;
    if (pathname.endsWith("/sign-in/email")) {
      const body = bytes!.toString();
      invariant(
        Buffer.byteLength(body) < 4096,
        413,
        "TOO_LARGE",
        "Слишком большой запрос.",
      );
      let email = "";
      try {
        email = String(JSON.parse(body).email ?? "")
          .trim()
          .toLowerCase();
      } catch {
        invariant(false, 400, "JSON", "Некорректный запрос.");
      }
      // Behind Caddy, direct access remains loopback-only and the header is overwritten by the proxy.
      const ip =
        process.env.TRUST_PROXY === "1"
          ? (request.headers.get("x-real-ip") ?? "unattributed")
          : "unattributed";
      const digest = (s: string) =>
        createHash("sha256").update(s).digest("hex");
      emailKey = digest(`login:${ip}:${email}`);
      await limited(digest(`ip:${ip}`), 50);
      await limited(emailKey, 5);
    }
    const response = await auth.handler(authRequest);
    if (emailKey && response.ok) {
      await db.loginAttempt.deleteMany({ where: { key: emailKey } });
      const body = await response.clone().json();
      const preference = body.user?.id
        ? await db.preference.findFirst({
            where: { student: { userId: body.user.id } },
            select: { theme: true },
          })
        : null;
      if (preference)
        response.headers.append(
          "Set-Cookie",
          `theme=${preference.theme}; Path=/; SameSite=Lax; Max-Age=31536000${process.env.APP_URL?.startsWith("https://") ? "; Secure" : ""}`,
        );
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = handler;
export const POST = handler;
