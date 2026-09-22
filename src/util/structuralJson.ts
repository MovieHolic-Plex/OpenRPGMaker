/** Structural JSON only: sort object keys, keep every field and array position. No normalization. */
export function structuralJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, Reflect.get(item, key)]));
  });
}

const TILE_PAYLOAD_KEYS = new Set(["lowerTiles", "upperTiles", "lowerTileStacks", "upperTileStacks"]);
const LONG_STRING = 512;

/**
 * Change detection for load-time normalizers. Tile grids and long embedded
 * strings (tileset reference images) are digested instead of copied into the
 * comparison text, so a heavy project is not stringified twice on open.
 */
export function normalizationFingerprint(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => {
    if (TILE_PAYLOAD_KEYS.has(key) && Array.isArray(item)) return digestTilePayload(item);
    if (typeof item === "string" && item.length > LONG_STRING) return digestString(item);
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(objectKey => [objectKey, Reflect.get(item, objectKey)]));
  });
}

function digestTilePayload(values: readonly unknown[]): string {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5 ^ values.length;
  const mix = (n: number): void => {
    h1 = Math.imul(h1 ^ n, 16777619);
    h2 = Math.imul(h2 ^ n, 2246822519);
  };
  const walk = (item: unknown): void => {
    if (typeof item === "number") mix(item | 0);
    else if (Array.isArray(item)) for (const child of item) walk(child);
    else mix(0);
  };
  for (const item of values) walk(item);
  return `t${values.length}:${h1 >>> 0}:${h2 >>> 0}`;
}

function digestString(value: string): string {
  let h1 = 2166136261;
  let h2 = 0x811c9dc5 ^ value.length;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ code, 2246822519);
  }
  return `s${value.length}:${h1 >>> 0}:${h2 >>> 0}`;
}
