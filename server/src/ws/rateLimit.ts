import { db, schema } from '../db';
import { eq, and, gt, lt } from 'drizzle-orm';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  create_room: { maxRequests: Number(process.env.RATE_LIMIT_CREATE_ROOM || 5), windowMs: 60 * 60 * 1000 }, // 5 per hour
  join_room: { maxRequests: Number(process.env.RATE_LIMIT_JOIN_ROOM || 10), windowMs: 60 * 1000 }, // 10 per minute
};

export function checkRateLimit(ip: string, action: 'create_room' | 'join_room'): { allowed: boolean; retryAfterMs?: number } {
  const config = RATE_LIMITS[action];
  const windowStart = new Date(Date.now() - config.windowMs);

  // Find existing rate limit record
  const existing = db
    .select()
    .from(schema.rateLimits)
    .where(
      and(
        eq(schema.rateLimits.ip, ip),
        eq(schema.rateLimits.action, action),
        gt(schema.rateLimits.windowStart, windowStart)
      )
    )
    .get();

  if (!existing) {
    // Create new record
    db.insert(schema.rateLimits).values({
      ip,
      action,
      count: 1,
      windowStart: new Date(),
    }).run();

    return { allowed: true };
  }

  if (existing.count >= config.maxRequests) {
    const retryAfterMs = existing.windowStart.getTime() + config.windowMs - Date.now();
    return { allowed: false, retryAfterMs };
  }

  // Increment count
  db.update(schema.rateLimits)
    .set({ count: existing.count + 1 })
    .where(eq(schema.rateLimits.id, existing.id))
    .run();

  return { allowed: true };
}

// Cleanup old rate limit records (call periodically)
export function cleanupRateLimits(): void {
  const oldestAllowed = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  db.delete(schema.rateLimits)
    .where(lt(schema.rateLimits.windowStart, oldestAllowed))
    .run();
}


