function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Omitted object fields survive a patch; arrays and explicit scalar values replace.
 * A changed discriminator replaces the variant instead of retaining its old fields.
 */
export function mergeRecordPatch(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = isObject(existing) ? existing : {};
  const changedKind = patch.kind !== undefined && base.kind !== undefined && patch.kind !== base.kind;
  const result: Record<string, unknown> = changedKind ? {} : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    result[key] = isObject(value) ? mergeRecordPatch(result[key], value) : structuredClone(value);
  }
  return result;
}
