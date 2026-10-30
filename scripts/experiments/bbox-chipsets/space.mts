// bbox-chipsets round 2: size/space checks. Functions only measure and name problems; they never move or add anything.
// Design principle the checks enforce: size each room or yard to its content. A cell is "bare" when nothing stands on it and
// nothing stands next to it (8 neighbours) — aisles beside furniture are in use, open floor far from every piece is not.
//   indoorSpace(plan, pieces, rooms)  → per room: floor cells, bare cells, empty-floor %, largest bare rect
//   outdoorSpace(W, H, drawn, walkable, open) → whole yard: bare-ground %, largest bare rect outside the declared open courtyard
export type Rect = { x: number; y: number; w: number; h: number };
export type RoomSpace = { id: string; floor: number; bare: number; emptyPct: number; largest: Rect | null; rect?: Rect; used?: Rect | null };

/** Largest all-true axis-aligned rectangle in a boolean grid (histogram method). */
export function largestRect(W: number, H: number, ok: (x: number, y: number) => boolean): Rect | null {
  const hgt = new Array(W).fill(0); let best: Rect | null = null, area = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) hgt[x] = ok(x, y) ? hgt[x] + 1 : 0;
    const st: number[] = [];
    for (let x = 0; x <= W; x++) {
      const h = x < W ? hgt[x] : 0;
      while (st.length && hgt[st[st.length - 1]!] >= h) {
        const top = st.pop()!, hh = hgt[top]!, x0 = st.length ? st[st.length - 1]! + 1 : 0, ww = x - x0;
        if (hh * ww > area) { area = hh * ww; best = { x: x0, y: y - hh + 1, w: ww, h: hh }; }
      }
      st.push(x);
    }
  }
  return best;
}

const nearOcc = (W: number, H: number, occ: Uint8Array) => {
  const near = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (occ[y * W + x])
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) near[ny * W + nx] = 1; }
  return near;
};

/** plan: '#' solid, anything else open. pieces: occupied footprint rects (furniture, tables, daises — not decals/carpets/wall-mounted).
 *  rooms: rects to report on (cells outside the plan's floor are ignored). Floor = open cell that is not wall face (2 rows under a solid cell). */
export function indoorSpace(plan: string[], pieces: Rect[], rooms: (Rect & { id: string })[]): { rooms: RoomSpace[]; total: RoomSpace } {
  const H = plan.length, W = plan[0]!.length;
  const solid = (x: number, y: number) => y < 0 || x < 0 || x >= W || y >= H || plan[y]![x] === "#";
  const floor = (x: number, y: number) => !solid(x, y) && !solid(x, y - 1) && !solid(x, y - 2) && y < H - 1;
  const occ = new Uint8Array(W * H);
  for (const p of pieces) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) occ[y * W + x] = 1;
  const near = nearOcc(W, H, occ);
  const bare = (x: number, y: number) => floor(x, y) && !near[y * W + x];
  const one = (r: Rect & { id: string }, claimed?: Uint8Array): RoomSpace => {
    let f = 0, b = 0, ux0 = 1e9, uy1 = -1, ux1 = -1;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H || !floor(x, y) || (claimed && claimed[y * W + x])) continue;
      if (claimed) claimed[y * W + x] = 1;
      f++; if (bare(x, y)) b++; else { ux0 = Math.min(ux0, x); ux1 = Math.max(ux1, x); uy1 = Math.max(uy1, y); }
    }
    const lr = largestRect(r.w, r.h, (x, y) => bare(r.x + x, r.y + y));
    // the part of the region that is in use: columns ux0..ux1, rows from the region top (wall face) down to the last used row
    const used = ux1 >= 0 ? { x: ux0, y: r.y, w: ux1 - ux0 + 1, h: uy1 - r.y + 1 } : null;
    return { id: r.id, floor: f, bare: b, emptyPct: f ? Math.round((100 * b) / f) : 0, largest: lr ? { x: lr.x + r.x, y: lr.y + r.y, w: lr.w, h: lr.h } : null, rect: r, used };
  };
  const claimed = new Uint8Array(W * H);
  const out = rooms.map((r) => one(r, claimed));
  const all = one({ id: "whole map", x: 0, y: 0, w: W, h: H });
  return { rooms: out, total: all };
}

/** Outdoor: every walkable cell counts as ground; bare = no piece drawn on it or next to it. `open` = declared open courtyard rects
 *  (intentional open space): their cells still count toward the bare-ground %, but the largest-bare-rect check skips them. */
export function outdoorSpace(W: number, H: number, drawn: (x: number, y: number) => boolean, walkable: (x: number, y: number) => boolean, open: Rect[]) {
  const occ = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (drawn(x, y)) occ[y * W + x] = 1;
  const near = nearOcc(W, H, occ);
  const inOpen = (x: number, y: number) => open.some((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
  let g = 0, b = 0, ob = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(x, y) && !occ[y * W + x]) { g++; if (!near[y * W + x]) { b++; if (inOpen(x, y)) ob++; } }
  let cells = W * H, walkN = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkable(x, y)) walkN++;
  const bareAt = (x: number, y: number) => walkable(x, y) && !near[y * W + x];
  return { cells, ground: g, bare: b, barePct: Math.round((100 * b) / Math.max(1, walkN)), openBare: ob,
    largest: largestRect(W, H, (x, y) => bareAt(x, y) && !inOpen(x, y)), largestAny: largestRect(W, H, bareAt) };
}

// Limits (calibrated on the chipsets' own example maps, see calibrate.mts; English messages go to the model's repair call).
// refs (jp house-1f/hiraya/mokuchin, mc konbini/cafe/bank): whole map 7-20% bare, rooms <= 27%, largest bare rect <= 3x4.
// round 1 model maps: 25-64% bare, rects up to 18x4. Limits sit just above the refs.
export const INDOOR = { mapEmptyPct: 25, roomEmptyPct: 30, rectArea: 14, rectSide: 2, minRoomFloor: 8 };
export const OUTDOOR = { barePct: 40, rectArea: 20, rectSide: 4 };
const rs = (r: Rect) => `x ${r.x}..${r.x + r.w - 1}, y ${r.y}..${r.y + r.h - 1} (${r.w}x${r.h})`;

export function indoorProblems(s: ReturnType<typeof indoorSpace>): string[] {
  const out: string[] = [];
  for (const r of s.rooms) {
    const big = r.largest && r.largest.w >= INDOOR.rectSide && r.largest.h >= INDOOR.rectSide && r.largest.w * r.largest.h >= INDOOR.rectArea ? r.largest : null;
    const pct = r.floor >= INDOOR.minRoomFloor && r.emptyPct > INDOOR.roomEmptyPct;
    if (pct || big) {
      // concrete numbers, not advice: the failing count, what the empty part is, and two exact ways out (round 3: terra2 jp-house moved
      // a stool and a bucket around a 6x6 bath for three repairs — the old text never said that rearranging cannot pass)
      const need = Math.max(0, r.bare - Math.floor((INDOOR.roomEmptyPct / 100) * r.floor));
      const R = r.rect!, U = r.used;
      const shrink = U && (U.w < R.w || U.h < R.h) ? `Option A (shrink): the used part of this region is ${rs(U)} — set the region to {"x": ${U.x}, "y": ${U.y}, "w": ${U.w}, "h": ${Math.max(3, U.h)}} and move its walls, openings and neighbours to match. ` : `Option A (shrink): make the region smaller around its furniture and move its walls, openings and neighbours to match. `;
      // round 3: when only the block rule fails, say so — terra2 jp-house read "too big for its content … 26%, limit 30%" as a contradiction
      // and spent three repairs nibbling at the region; the failing thing was one 4x5 block, not the share
      if (big && !pct) { out.push(`space: region "${r.id}" (${rs(R)}) has one empty block at ${rs(big)} — no standing piece on it or next to it. Its overall bare share is fine (${r.emptyPct}%, limit ${INDOOR.roomEmptyPct}%); the rule that fails is the block rule: no bare block with both sides >= ${INDOOR.rectSide} and area >= ${INDOOR.rectArea} in a region. Fix only this block: put a purposeful standing group inside it or along its edge (a piece clears its own cells and the 8 around it, so one piece in the middle of a ${big.w}x${big.h} block leaves at most a thin strip), or cut the block out of the region by moving that wall in. Do not move other furniture.`); continue; }
      out.push(`space: region "${r.id}" (${rs(R)}) is too big for its content — ${r.bare} of its ${r.floor} floor cells are bare (${r.emptyPct}%, limit ${INDOOR.roomEmptyPct}%)${big ? `, including an empty rect ${rs(big)}` : r.largest ? `; the biggest empty part is ${rs(r.largest)}` : ""}. Moving the same pieces around will not pass: the region must get smaller or get more standing pieces. ${shrink}Option B (fill): add a group of standing pieces that serves this room's purpose, covering or bordering at least ${Math.max(need, 1)} of the bare cells (wall-mounted pieces, decals and carpets do not count).`);
    }
  }
  if (!out.length && s.total.emptyPct > INDOOR.mapEmptyPct) out.push(`space: ${s.total.emptyPct}% of the whole floor is bare (limit ${INDOOR.mapEmptyPct}%; largest empty rect ${s.total.largest ? rs(s.total.largest) : "-"}). Shrink the rooms to their content or fill the open floor with purposeful groups.`);
  return out;
}

export function outdoorProblems(s: ReturnType<typeof outdoorSpace>): string[] {
  const out: string[] = [];
  const big = s.largest && s.largest.w >= OUTDOOR.rectSide && s.largest.h >= OUTDOOR.rectSide && s.largest.w * s.largest.h >= OUTDOOR.rectArea ? s.largest : null;
  if (s.barePct > OUTDOOR.barePct) out.push(`space: ${s.barePct}% of the walkable ground is bare (no piece on or next to it) (limit ${OUTDOOR.barePct}%, the open courtyard included). Either shrink the map / the compound walls so the yard fits its buildings, or fill the bare parts with purposeful groups (jar terrace, well with a path, garden bed with trees and rocks, woodpile by the kitchen) — an intentional open courtyard may stay, but the whole yard must not be mostly bare.`);
  if (big) out.push(`space: empty ground rect at ${rs(big)} outside the declared open courtyard (no piece on or next to it). Either shrink the map there, mark it as the one intentional open courtyard ("open": true on a grounds rect), or fill it with a purposeful group.`);
  return out;
}

/** Box-room count (measured only): a region is a plain box when no other region touches or overlaps it (no L-shape, alcove or bay),
 *  its rect has no solid cell inside (no column, half-wall or pillar) and no raised platform stands in it. */
export function boxRegions(regions: Rect[], plan: string[], daises: Rect[]): number {
  const touch = (a: Rect, b: Rect) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
  return regions.filter((r) => !regions.some((o) => o !== r && touch(r, o))
    && !Array.from({ length: r.h }, (_, dy) => plan[r.y + dy]?.slice(r.x, r.x + r.w) ?? "").join("").includes("#")
    && !daises.some((d) => d.x < r.x + r.w && r.x < d.x + d.w && d.y < r.y + r.h && r.y < d.y + d.h)).length;
}
