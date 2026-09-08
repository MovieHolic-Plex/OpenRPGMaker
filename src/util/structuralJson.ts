/** Structural JSON only: sort object keys, keep every field and array position. No normalization. */
export function structuralJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, Reflect.get(item, key)]));
  });
}
