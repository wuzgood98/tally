/**
 * How many questions someone may ask in a sliding window. Kept in memory,
 * so each server instance counts on its own: good enough to stop a public
 * demo account being used to run up the bill, not an exact quota.
 */

export type RateDecision =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAt: Date };

export interface RateLimiter {
  /** Counts a question for `key` if there's room, and says so. */
  readonly take: (key: string, now?: number) => RateDecision;
}

interface RateLimitOptions {
  readonly limit: number;
  readonly windowMs: number;
}

export const createRateLimiter = ({
  limit,
  windowMs,
}: RateLimitOptions): RateLimiter => {
  const hits = new Map<string, number[]>();

  const take = (key: string, now = Date.now()): RateDecision => {
    const recent = (hits.get(key) ?? []).filter(
      (time) => time > now - windowMs
    );

    const [oldest] = recent;

    if (recent.length >= limit && oldest !== undefined) {
      hits.set(key, recent);

      return { allowed: false, retryAt: new Date(oldest + windowMs) };
    }

    recent.push(now);
    hits.set(key, recent);

    return { allowed: true, remaining: limit - recent.length };
  };

  return { take };
};
