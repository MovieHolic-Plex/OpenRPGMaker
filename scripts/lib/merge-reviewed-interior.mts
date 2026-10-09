import { isDeepStrictEqual as equal } from 'node:util';
import type { TilesetDef } from '../../src/project/types';

/** Replace only exact reviewed defaults; preserve authored records and array overrides. */
export function mergeReviewedInterior(current: TilesetDef, before: TilesetDef, next: TilesetDef): TilesetDef {
  const out = structuredClone(current);
  const locked = (value: any) => value?.source === 'user' || value?.userLocked === true;
  for (const key of ['structureKits', 'tileGroups', 'autotileGroups'] as const) {
    const oldRecords: any[] = before[key] ?? [];
    const newRecords: any[] = next[key] ?? [];
    const existing: any[] = current[key] ?? [];
    // An explicit empty structure library is an authored deletion.
    if (key === 'structureKits' && current[key]?.length === 0) continue;
    const merged = existing.flatMap(record => {
      const previous = oldRecords.find(x => x.id === record.id);
      const replacement = newRecords.find(x => x.id === record.id);
      if (previous && !locked(record) && equal(previous, record)) return replacement ? [replacement] : [];
      return [record];
    });
    for (const record of newRecords) if (!existing.some(x => x.id === record.id)) merged.push(record);
    (out as any)[key] = merged;
  }
  for (let tile = 0; tile < current.count; tile++) {
    const oldMeta = before.tileMeta?.[tile];
    const currentMeta = current.tileMeta?.[tile];
    if (locked(currentMeta) || !equal(currentMeta, oldMeta)) continue;
    if (next.tileMeta?.[tile] !== undefined) {
      out.tileMeta ??= [];
      out.tileMeta[tile] = structuredClone(next.tileMeta[tile]!);
    }
    for (const key of ['passability', 'priority', 'terrain'] as const) {
      if (equal(current[key]?.[tile], before[key]?.[tile]) && next[key]?.[tile] !== undefined) {
        (out[key] as any)[tile] = structuredClone(next[key]![tile]);
      }
    }
  }
  return out;
}
