function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Omitted object fields survive a patch; arrays and explicit scalar values replace.
 * A changed discriminator replaces the variant instead of retaining its old fields.
 */
/** 사전 칸을 병합하지 않고 통째로 바꾸라는 표지 — 조수의 listOps.remove 가 사전 열쇠를 뺄 때 붙인다(dbUpsertEnvelope.ts). 저장되지 않는다. */
export const REPLACE_WHOLE = "__replaceWhole";

export function mergeRecordPatch(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = isObject(existing) ? existing : {};
  const changedKind = patch.kind !== undefined && base.kind !== undefined && patch.kind !== base.kind;
  const result: Record<string, unknown> = changedKind ? {} : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === "__proto__" || key === "constructor" || key === "prototype" || key === REPLACE_WHOLE) continue;
    if (isObject(value) && value[REPLACE_WHOLE] === true) { const { [REPLACE_WHOLE]: _mark, ...whole } = value; result[key] = structuredClone(whole); continue; }
    result[key] = isObject(value) ? mergeRecordPatch(result[key], value) : structuredClone(value);
  }
  return result;
}
