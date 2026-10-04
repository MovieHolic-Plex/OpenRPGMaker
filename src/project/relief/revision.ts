import type { ReliefData } from "./types";

type State = { signature: number; elevated: boolean; bridge: boolean };
const readers = new WeakMap<ReliefData, () => string | undefined>();
const epochs = new WeakMap<ReliefData, number>();
const states = new WeakMap<ReliefData, { revision: string; state: State }>();

/** Only bind a committed document whose writer publishes a mutation revision.
 * Drafts/old snapshots return undefined and are checked by content. No proxies or
 * document properties: structuredClone, JSON and history keep plain data arrays.
 */
export function bindReliefRevision(relief: ReliefData, read: () => string | undefined): void {
  readers.set(relief, read);
}

/** For in-place geometry writers that query the draft before publishing it. */
export function invalidateReliefRevision(relief: ReliefData): void {
  epochs.set(relief, (epochs.get(relief) ?? 0) + 1);
  states.delete(relief);
}

/** Unversioned input deliberately remains content checked. Identity is never a
 * sufficient cache key, including array element and decoration property writes.
 */
export function reliefState(relief: ReliefData, verifyContent = false): State {
  const source = readers.get(relief)?.();
  const revision = source === undefined ? undefined : `${source}:${epochs.get(relief) ?? 0}`;
  const cached = states.get(relief);
  if (!verifyContent && revision !== undefined && cached?.revision === revision) return cached.state;
  let hash = 0x811c9dc5, elevated = false, bridge = false;
  const mix = (v: number) => { hash ^= v & 0xffff; hash = Math.imul(hash, 0x01000193); hash ^= v >>> 16; hash = Math.imul(hash, 0x01000193); };
  mix(relief.width); mix(relief.height);
  for (const v of relief.levels) { mix(v); elevated ||= v > 0; }
  mix(relief.ramps?.length ?? 0);
  for (const v of relief.ramps ?? []) { mix(v); bridge ||= v === 9; }
  mix(relief.wallDecor?.length ?? 0);
  for (const d of relief.wallDecor ?? []) { mix(d.x); mix(d.y); mix(d.row); mix(d.tile); }
  for (const ch of relief.style ?? "") mix(ch.charCodeAt(0));
  const state = { signature: hash >>> 0, elevated, bridge };
  if (revision !== undefined) states.set(relief, { revision, state });
  return state;
}
