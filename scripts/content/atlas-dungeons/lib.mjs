// Small helpers for the atlas dungeon plans (terrain grammar and prop keys: rpg-dungeons/kit.mjs, parts: parts.json).
export { grid } from "../rpg-dungeons/kit.mjs";

/** The same prop along a row / a column (step between pieces). */
export const row = (key, x0, x1, y, step = 1) => { const a = []; for (let x = x0; x <= x1; x += step) a.push([key, x, y]); return a; };
export const col = (key, x, y0, y1, step = 1) => { const a = []; for (let y = y0; y <= y1; y += step) a.push([key, x, y]); return a; };
/** An iron railing x0..x1 on row y ([ = … ]), optional gate cell. */
export const railing = (x0, x1, y, gate) => [["[", x0, y], ...Array.from({ length: x1 - x0 - 1 }, (_, i) => [gate === x0 + 1 + i ? "0" : "=", x0 + 1 + i, y]), ["]", x1, y]];
/** A table with side chairs facing it from both ends (297 looks right, 298 looks left) and, optionally, back chairs
 *  on its north side (267/268 show their backrest above the seat: they face south, at the table). */
export const dining = (x, y, len = 3, set = "int", north = false) => {
  const t = len === 1 ? [[`${set}:table-square`, x, y]] : [[`${set}:table-long`, x, y]];
  const n = north ? Array.from({ length: len }, (_, i) => [i % 2 ? `${set}:chair-s2` : `${set}:chair-s`, x + i, y - 1]) : [];
  return [...t, [`${set}:seat-r`, x - 1, y], [`${set}:seat-l`, x + len, y], ...n];
};
/** A natural chamber: a seeded blob around (cx,cy) with radii rx,ry. Its top two rows become the wall face. */
export const room = (cx, cy, rx, ry, seed, wobble = 0.1, c = ".") => [c, cx - rx, cy - ry, cx + rx, cy + ry, { blob: seed, wobble }];
/** A horizontal passage: two face rows above two walking rows y..y+1 (x0..x1). */
export const hpass = (x0, x1, y, c = ".") => [c, Math.min(x0, x1), y - 2, Math.max(x0, x1), y + 1];
/** A vertical passage three cells wide centred on x (y0..y1). */
export const vpass = (x, y0, y1, c = ".", w = 3) => [c, x - Math.floor(w / 2), Math.min(y0, y1), x - Math.floor(w / 2) + w - 1, Math.max(y0, y1)];
/** Plan defaults per series. */
export const series = (defaults) => (plan) => ({ ...defaults, ...plan });
