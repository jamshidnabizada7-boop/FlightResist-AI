interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 60000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 60000);

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = store.get(identifier) ?? { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - now };
  }

  entry.timestamps.push(now);
  store.set(identifier, entry);

  return { allowed: true, remaining: limit - entry.timestamps.length, resetMs: windowMs };
}
