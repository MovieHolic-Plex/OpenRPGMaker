interface Bucket {
  timestamps: number[];
}

declare global {
  var __openrpgRateBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__openrpgRateBuckets) globalThis.__openrpgRateBuckets = new Map();
  return globalThis.__openrpgRateBuckets;
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const map = buckets();
  const bucket = map.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    map.set(key, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  map.set(key, bucket);
  if (map.size > 5000) {
    for (const [k, v] of map) {
      if (v.timestamps.every((t) => now - t > windowMs)) map.delete(k);
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
