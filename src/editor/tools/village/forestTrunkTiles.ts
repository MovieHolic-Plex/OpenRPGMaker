/** Approved cliff-village trunks: complete three-row roots between a left and a right end. */
const LEFT = [[1422, 1423, 1424], [1426, 1427, 1428], [1430, 1431, 1432]];
const RIGHT = [[1453, 1454, 1455], [1457, 1458, 1459], [1461, 1462, 1463]];
const PAIR = [[1425, 1350], [1429, 1428], [1433, 1432]];
/** Columns of LEFT and RIGHT that close into whole trees below six cells (checked by eye on the sheet). */
const NARROW: Record<number, readonly (readonly [readonly number[][], number])[]> = {
  2: [[LEFT, 0], [RIGHT, 2]],
  3: [[LEFT, 0], [LEFT, 1], [RIGHT, 2]],
  4: [[LEFT, 0], [LEFT, 1], [RIGHT, 1], [RIGHT, 2]],
  5: [[LEFT, 0], [LEFT, 1], [LEFT, 2], [RIGHT, 1], [RIGHT, 2]],
};

/** Every tile a trunk assembly uses. */
export const FOREST_TRUNK_TILES: ReadonlySet<number> = new Set([LEFT, RIGHT, PAIR].flat(2));

/** The narrowest bottom edge that carries whole trunks. */
export const FOREST_TRUNK_MIN_WIDTH = 2;

/** Roots exactly as wide as the canopy edge above them. From six cells LEFT and RIGHT meet directly or
 * around PAIR columns; narrower edges drop inner columns. A single cell has no assembly. The old
 * 4-wide caps ended in half a trunk, and a run wider than its edge slid under the neighbouring canopy's
 * transparent edge; both read as a trunk cut in half. */
export function forestTrunkCandidates(start: number, width: number) {
  if (width < FOREST_TRUNK_MIN_WIDTH) return [];
  const rows = width < 6
    ? LEFT.map((_, dy) => NARROW[width]!.map(([part, column]) => part[dy]![column]!))
    : LEFT.map((row, dy) => [...row,
      ...Array.from({ length: width - 6 }, (_, i) => PAIR[dy]![i % 2]!), ...RIGHT[dy]!]);
  return [{ x: start, rows }];
}
