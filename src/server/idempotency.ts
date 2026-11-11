import { createHash } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { db } from './db';
import { invariant } from './errors';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export const hashPayload = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export async function idempotent<T extends Prisma.InputJsonValue>(studentId: string, operation: string, key: string, payload: unknown, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  invariant(key.length >= 8 && key.length <= 128, 422, 'IDEMPOTENCY_KEY', 'Необходим ключ операции.');
  const payloadHash = hashPayload(payload);
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${studentId}:${operation}:${key}`}, 0))`;
    const prior = await tx.idempotencyRecord.findUnique({ where: { studentId_operation_key: { studentId, operation, key } } });
    if (prior) { invariant(prior.payloadHash === payloadHash, 409, 'IDEMPOTENCY_CONFLICT', 'Ключ уже использован для других данных.'); return prior.result as T; }
    const result = await action(tx);
    await tx.idempotencyRecord.create({ data: { studentId, operation, key, payloadHash, result } });
    return result;
  }, { timeout: 15000 });
}
