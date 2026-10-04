import type { StateRecord } from '@/project/types';
/** Missing-only state defaults: preserve authored records and their order exactly. */
export function mergeStateDefaults(existing: readonly StateRecord[], defaults: readonly StateRecord[]): StateRecord[] {
  const result = structuredClone([...existing]);
  const known = new Set(result.map(s => s.id));
  for (const state of defaults) if (!known.has(state.id)) {
    result.push(structuredClone(state));
    known.add(state.id);
  }
  return result;
}
