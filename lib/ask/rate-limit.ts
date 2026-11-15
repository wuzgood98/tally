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
  /** How many people it's counting for: idle ones are forgotten. */
  readonly size: () => number;
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
  let sweptAt = Number.NEGATIVE_INFINITY;

  /** Once a window, forget everyone whose questions have all expired. */
  const sweep = (now: number): void => {
    if (now - sweptAt < windowMs) {
      return;
    }

    sweptAt = now;

    for (const [key, times] of hits) {
      if (times.every((time) => time <= now - windowMs)) {
        hits.delete(key);
      }
    }
  };

  const take = (key: string, now = Date.now()): RateDecision => {
    sweep(now);

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

  return { size: () => hits.size, take };
};
