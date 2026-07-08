import { NextResponse } from 'next/server';

/**
 * Advanced Rate Limiter with Sliding Window
 * Lebih akurat daripada fixed window counter
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
  attempts: number[]; // Timestamp array untuk sliding window
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries setiap 10 menit
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * Check if a key is rate limited using sliding window algorithm
   * @param key - Unique identifier (e.g., username:ip)
   * @param limit - Maximum attempts allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if rate limited, false otherwise
   */
  isRateLimited(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    let entry = this.store.get(key);

    // Initialize if not exists
    if (!entry) {
      entry = { count: 0, resetAt: now + windowMs, attempts: [] };
      this.store.set(key, entry);
    }

    // Filter out attempts outside the sliding window
    entry.attempts = entry.attempts.filter(timestamp => now - timestamp < windowMs);

    // Check if limit exceeded
    if (entry.attempts.length >= limit) {
      return true;
    }

    // Add current attempt
    entry.attempts.push(now);
    entry.count = entry.attempts.length;
    
    return false;
  }

  /**
   * Get remaining attempts for a key
   */
  getRemainingAttempts(key: string, limit: number, windowMs: number): number {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      return limit;
    }

    // Filter valid attempts
    const validAttempts = entry.attempts.filter(timestamp => now - timestamp < windowMs);
    return Math.max(0, limit - validAttempts.length);
  }

  /**
   * Reset rate limit for a key (e.g., after successful login)
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now && entry.attempts.length === 0) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get time until reset in seconds
   */
  getTimeUntilReset(key: string, windowMs: number): number {
    const entry = this.store.get(key);
    if (!entry || entry.attempts.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestAttempt = entry.attempts[0];
    const resetTime = oldestAttempt + windowMs;
    
    return Math.max(0, Math.ceil((resetTime - now) / 1000));
  }

  /**
   * Destroy the rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  LOGIN: { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 attempts per 5 minutes
  API_GENERAL: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  API_WRITE: { limit: 30, windowMs: 60 * 1000 }, // 30 writes per minute
  WEBHOOK: { limit: 50, windowMs: 60 * 1000 }, // 50 webhooks per minute
} as const;

export function getRateLimitActor(req: Request): string {
  const userId = req.headers.get('x-user-id')?.trim();
  if (userId) {
    return `user:${userId}`;
  }

  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

export function enforceRateLimit(
  req: Request,
  bucket: keyof typeof RATE_LIMITS,
  scope: string
) {
  const actor = getRateLimitActor(req);
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${scope}:${actor}`;

  if (!rateLimiter.isRateLimited(key, limit, windowMs)) {
    return null;
  }

  const retryAfter = rateLimiter.getTimeUntilReset(key, windowMs);
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: `Terlalu banyak permintaan. Coba lagi dalam ${retryAfter} detik.`,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
