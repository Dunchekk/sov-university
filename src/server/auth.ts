import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import { db } from './db';
import { hashPassword, verifyPassword } from './password';
export const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
export const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? appUrl).split(',').map(s => s.trim());
export const auth = betterAuth({
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql' }),
  trustedOrigins,
  emailAndPassword: { enabled: true, disableSignUp: true, password: { hash: hashPassword, verify: verifyPassword } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  user: { changeEmail: { enabled: false }, deleteUser: { enabled: false } },
  rateLimit: { enabled: true, storage: 'database', window: 60, max: 100 },
  advanced: { useSecureCookies: appUrl.startsWith('https://'), defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' } },
});
