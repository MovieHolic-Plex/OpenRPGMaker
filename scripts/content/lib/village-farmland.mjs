// Farm plots on forest_harmony sheets: the builtin_farmland 3×3 (inside 187, edges and corners around it).
// 188 alone is the RIGHT edge — a plot filled with it shows a grass notch on every cell (vertical stripes).
export const FARMLAND = [[156, 157, 158], [186, 187, 188], [216, 217, 218]];
export const FARMLAND_TILES = new Set(FARMLAND.flat());

// Row-major lower tiles of a w×h plot. A one-row / one-column plot uses the middle row / column.
export function farmlandTiles(w, h) {
  return Array.from({ length: w * h }, (_, k) => {
    const dx = k % w, dy = Math.floor(k / w);
    const row = h === 1 ? 1 : dy === 0 ? 0 : dy === h - 1 ? 2 : 1;
    const col = w === 1 ? 1 : dx === 0 ? 0 : dx === w - 1 ? 2 : 1;
    return FARMLAND[row][col];
  });
}
