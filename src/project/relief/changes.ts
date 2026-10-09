import type { ReliefData } from "./types";

export interface ReliefChangeCell { readonly x: number; readonly y: number }
/** Extension of the store descriptor. Absent = unknown/full relief change;
 * [] = known no cell changes. These are raw authored cells, not rendered lift
 * dependencies, and do not imply a lower/upper tile change.
 */
export interface ReliefCellChange { readonly reliefCells?: readonly ReliefChangeCell[] }

export function reliefChangedCells(before: ReliefData | undefined, after: ReliefData | undefined, width: number, height: number): ReliefChangeCell[] | undefined {
  if ((before?.style ?? "") !== (after?.style ?? "")) return undefined;
  const indices = new Set<number>();
  for (let i = 0; i < width * height; i++) {
    if ((before?.levels[i] ?? 0) !== (after?.levels[i] ?? 0) || (before?.ramps?.[i] ?? 0) !== (after?.ramps?.[i] ?? 0)) indices.add(i);
  }
  const decor = (r: ReliefData | undefined) => {
    const cells = new Map<number, string[]>();
    for (const d of r?.wallDecor ?? []) {
      const i = d.y * width + d.x;
      const list = cells.get(i) ?? []; list.push(`${d.row},${d.tile}`); cells.set(i, list);
    }
    return cells;
  };
  const a = decor(before), b = decor(after);
  for (const i of new Set([...a.keys(), ...b.keys()])) if ((a.get(i) ?? []).join(";") !== (b.get(i) ?? []).join(";")) indices.add(i);
  return [...indices].map(i => ({ x: i % width, y: Math.floor(i / width) }));
}
