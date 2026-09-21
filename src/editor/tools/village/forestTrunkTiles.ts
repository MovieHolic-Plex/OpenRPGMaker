/** Approved cliff-village trunks: complete three-row roots and end caps. */
const LEFT = [[1422, 1423, 1424], [1426, 1427, 1428], [1430, 1431, 1432]];
const RIGHT = [[1453, 1454, 1455], [1457, 1458, 1459], [1461, 1462, 1463]];
const PAIR = [[1425, 1350], [1429, 1428], [1433, 1432]];
const LEFT_CAP = LEFT.map((row, dy) => [...row, PAIR[dy]![0]!]);
const RIGHT_CAP = RIGHT.map((row, dy) => [PAIR[dy]![1]!, ...row]);

export function forestTrunkCandidates(start: number, width: number) {
  const span = Math.max(8, Math.ceil(width / 2) * 2);
  const rows = LEFT.map((row, dy) => [...row,
    ...Array.from({ length: span - 6 }, (_, i) => PAIR[dy]![i % 2]!), ...RIGHT[dy]!]);
  return width <= 4 ? [{ x: start, rows: LEFT_CAP }, { x: start + width - 4, rows: RIGHT_CAP }]
    : [{ x: start, rows }, { x: start + width - span, rows }];
}
