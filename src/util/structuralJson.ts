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

/**
 * `JSON.stringify(a) === JSON.stringify(b)` 과 같은 판정을, 문자열을 만들지 않고 첫 차이에서 멈춘다.
 * 키 순서는 보지 않는다(값이 같으면 같다). 값이 undefined 인 키는 없는 키와 같다 — JSON 과 같다.
 * 같은 객체를 만나면 바로 넘어가므로 타일셋처럼 대부분 공유된 무거운 트리에서 싸다.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
  }
  const aArray = Array.isArray(a);
  if (aArray !== Array.isArray(b)) return false;
  if (aArray) {
    const left = a as unknown[];
    const right = b as unknown[];
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      const x = left[index] === undefined ? null : left[index];
      const y = right[index] === undefined ? null : right[index];
      if (!jsonEqual(x, y)) return false;
    }
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  let leftCount = 0;
  for (const key of Object.keys(left)) {
    const value = left[key];
    if (value === undefined || typeof value === "function") continue;
    leftCount += 1;
    if (!jsonEqual(value, right[key])) return false;
  }
  let rightCount = 0;
  for (const key of Object.keys(right)) {
    const value = right[key];
    if (value !== undefined && typeof value !== "function") rightCount += 1;
  }
  return leftCount === rightCount;
}
