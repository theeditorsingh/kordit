import { prisma } from '@/lib/prisma';

/**
 * Postgres-backed fixed-window rate limiting. Counters live in the "RateLimit" table so the
 * limit holds across serverless instances. If the table is unavailable (e.g. the migration
 * has not been applied yet) the limiter fails open and logs, so the app keeps working.
 */

export const LIMITS = {
  loginIdentifier: { limit: 5, windowMs: 15 * 60 * 1000 },
  loginIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  magicLinkEmail: { limit: 3, windowMs: 15 * 60 * 1000 },
  magicLinkIp: { limit: 10, windowMs: 15 * 60 * 1000 },
  ai: { limit: 20, windowMs: 60 * 60 * 1000 },
  invites: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const;

export type LimitConfig = { limit: number; windowMs: number };

export class RateLimitError extends Error {
  constructor(message = 'Too many requests. Please wait a few minutes and try again.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Counts one hit against `key`. Returns false once the window's limit is exceeded. */
export async function consume(key: string, { limit, windowMs }: LimitConfig): Promise<boolean> {
  try {
    const resetAt = new Date(Date.now() + windowMs);
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count"
    `;
    // Occasionally clear out expired windows so the table stays small
    if (Math.random() < 0.01) {
      prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < NOW() - INTERVAL '1 day'`.catch(() => undefined);
    }
    return (rows[0]?.count ?? 0) <= limit;
  } catch (error) {
    console.error('[rateLimit] unavailable, allowing request', error);
    return true;
  }
}

/** True when `key` has already used up its window, without counting a hit. */
export async function isBlocked(key: string, { limit }: LimitConfig): Promise<boolean> {
  try {
    const row = await prisma.rateLimit.findUnique({ where: { key } });
    return !!row && row.resetAt > new Date() && row.count >= limit;
  } catch (error) {
    console.error('[rateLimit] unavailable, allowing request', error);
    return false;
  }
}

/** Throws RateLimitError when the hit exceeds the limit. */
export async function enforce(key: string, config: LimitConfig, message?: string) {
  if (!(await consume(key, config))) throw new RateLimitError(message);
}

/** Best-effort client IP from proxy headers (accepts a Headers object or a plain record). */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined | null): string {
  if (!headers) return 'unknown';
  const get = (name: string) => {
    if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined;
    const value = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(value) ? value[0] : value;
  };
  const forwarded = get('x-forwarded-for');
  return (forwarded?.split(',')[0] || get('x-real-ip') || 'unknown').trim();
}
