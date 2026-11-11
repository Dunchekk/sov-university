import { z } from 'zod';
import { assertOrigin, requireStudent, type StudentContext } from './access';
import { readLimited } from './body';
import { errorResponse, invariant } from './errors';
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'Referrer-Policy': 'no-referrer' };
export function route(handler: (request: Request, student: StudentContext) => Promise<Response | unknown>) {
  return async (request: Request) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertOrigin(request);
      const student = await requireStudent(request.headers);
      const result = await handler(request, student);
      const response = result instanceof Response ? result : Response.json(result);
      for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
      return response;
    } catch (error) {
      const response = errorResponse(error);
      for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
      return response;
    }
  };
}
export async function jsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  invariant((request.headers.get('content-type') ?? '').includes('application/json'), 415, 'CONTENT_TYPE', 'Ожидается JSON.');
  const text = (await readLimited(request,64 * 1024)).toString();
  invariant(Buffer.byteLength(text) <= 64 * 1024, 413, 'TOO_LARGE', 'Слишком большой запрос.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { invariant(false, 400, 'JSON', 'Некорректный JSON.'); }
  return schema.parse(value);
}
export const idSchema = z.string().min(1).max(150);
export const safeUrl = z.string().url().refine(s => s.startsWith('https://'), 'Нужна ссылка HTTPS.');
export const dateOnly = z.iso.date();
