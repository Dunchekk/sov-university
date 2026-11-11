import { route } from "@/server/http";
import { readLimited } from "@/server/body";
import { invariant } from "@/server/errors";
import { importOptions } from "@/modules/calendar/ics";
import { previewImport } from "@/modules/calendar/integrations";
export const POST = route(async (request, student) => {
  const contentType = request.headers.get("content-type") ?? "";
  invariant(
    contentType.startsWith("multipart/form-data"),
    415,
    "CONTENT_TYPE",
    "Загрузите файл ICS.",
  );
  const buffer = await readLimited(request, 5 * 1024 * 1024 + 32768);
  const form = await new Response(new Uint8Array(buffer), {
    headers: { "content-type": contentType },
  }).formData();
  const file = form.get("file");
  invariant(
    file instanceof File && file.name.toLowerCase().endsWith(".ics"),
    422,
    "ICS_FILE",
    "Выберите файл с расширением .ics.",
  );
  invariant(
    file.size <= 5 * 1024 * 1024,
    413,
    "ICS_SIZE",
    "Файл должен быть не больше 5 MiB.",
  );
  const options = importOptions.parse({
    name: form.get("name"),
    sourceId: form.get("sourceId") || undefined,
    timezone: form.get("timezone"),
    from: form.get("from"),
    to: form.get("to"),
  });
  return previewImport(student, await file.text(), options);
});
