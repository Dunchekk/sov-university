import { ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function invariant(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Объект не найден или недоступен.');
export function errorResponse(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof ZodError) return Response.json({ error: { code: 'VALIDATION', message: 'Проверьте заполнение полей.', fields: error.flatten().fieldErrors, requestId } }, { status: 422 });
  if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message, requestId } }, { status: error.status });
  console.error(JSON.stringify({ requestId, operation: 'api', status: 500, errorType: error instanceof Error ? error.name : 'unknown' }));
  return Response.json({ error: { code: 'INTERNAL', message: 'Не удалось выполнить операцию. Попробуйте ещё раз.', requestId } }, { status: 500 });
}
