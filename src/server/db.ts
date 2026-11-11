import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const singleton = globalThis as unknown as { prisma?: PrismaClient };
export const db = singleton.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 }) });
if (process.env.NODE_ENV !== 'production') singleton.prisma = db;
