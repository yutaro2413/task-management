// Simple in-memory cache for API responses
const cache = new Map<string, { data: unknown; timestamp: number }>();

// Cache TTL: master data = 5 min, entries = 30 sec
const MASTER_TTL = 5 * 60 * 1000;
const DATA_TTL = 30 * 1000;

export async function cachedFetch<T>(url: string, ttl: number = DATA_TTL): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  const res = await fetch(url);
  const data = await res.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

export function invalidateCache(urlPattern?: string) {
  if (!urlPattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(urlPattern)) {
      cache.delete(key);
    }
  }
}

export { MASTER_TTL, DATA_TTL };
