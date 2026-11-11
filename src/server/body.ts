import { invariant } from "./errors";
export async function readLimited(request: Request, limit: number) {
  invariant(
    Number(request.headers.get("content-length") ?? 0) <= limit,
    413,
    "TOO_LARGE",
    "Файл превышает допустимый размер.",
  );
  const reader = request.body?.getReader();
  invariant(reader, 400, "EMPTY", "Пустой запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      invariant(false, 413, "TOO_LARGE", "Файл превышает допустимый размер.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
