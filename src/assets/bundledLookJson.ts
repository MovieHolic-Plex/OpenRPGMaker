import {
  BUNDLED_LOOK_JSON_KEYS,
  BUNDLED_LOOK_JSON_LAZY,
  bundledLookJsonSync,
  loadBundledLookJsonEntry,
  setBundledLookJsonReader,
  type BundledLookJsonData,
  type BundledLookJsonKey,
  type BundledLookJsonReader,
} from "./bundledLookJsonSources";

export type { BundledLookJsonKey, BundledLookJsonReader };
export { BUNDLED_LOOK_JSON_KEYS, setBundledLookJsonReader };

const cache = new Map<BundledLookJsonKey, unknown>();
const pending = new Map<BundledLookJsonKey, Promise<void>>();

export function bundledLookJson<K extends BundledLookJsonKey>(key: K): BundledLookJsonData[K] {
  let value = cache.get(key) as BundledLookJsonData[K] | undefined;
  if (value === undefined) {
    value = bundledLookJsonSync(key);
    cache.set(key, value);
  }
  return value;
}

export function bundledLookJsonLoaded(key: BundledLookJsonKey): boolean {
  return !BUNDLED_LOOK_JSON_LAZY || cache.has(key);
}

export function preloadBundledLookJson(
  keys: readonly BundledLookJsonKey[] = BUNDLED_LOOK_JSON_KEYS,
): Promise<void> {
  if (!BUNDLED_LOOK_JSON_LAZY) return Promise.resolve();
  const waits: Promise<void>[] = [];
  for (const key of keys) {
    if (cache.has(key)) continue;
    let wait = pending.get(key);
    if (!wait) {
      wait = loadBundledLookJsonEntry(key).then((value) => {
        if (!cache.has(key)) cache.set(key, value);
      }).finally(() => pending.delete(key));
      pending.set(key, wait);
    }
    waits.push(wait);
  }
  return waits.length ? Promise.all(waits).then(() => undefined) : Promise.resolve();
}
