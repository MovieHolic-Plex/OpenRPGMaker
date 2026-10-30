// bbox-chipsets round 3: floors are a material per zone, not per tile. The model picks the material and the zone; this code lays it.
//   tatamiTiling(cells, W)  → whole 1x2 mats, edge-aligned, no point where four mat corners meet (shūgijiki), or null when impossible
//   floorReport(...)        → soft checks: one dominant floor per room (+ at most one purposeful sub-zone), single-cell floor islands
export type Mat = { a: number; b: number; dir: "h" | "v" };

/** Domino tiling of a cell set (indices y*W+x) under the tatami rule. Deterministic backtracking, first uncovered cell in row-major order,
 *  horizontal first on even rows and vertical first on odd rows (gives the usual staggered look). Returns null when no tiling exists. */
export function tatamiTiling(cells: Set<number>, W: number, budget = 400000): Mat[] | null {
  const order = [...cells].sort((a, b) => a - b);
  if (order.length % 2) return null;
  const owner = new Map<number, number>();
  const mats: Mat[] = [];
  let nodes = 0;
  // a grid corner (x,y) = the point shared by cells (x-1,y-1),(x,y-1),(x-1,y),(x,y); four different mats there is forbidden
  const cornerBad = (x: number, y: number) => {
    const c = [(y - 1) * W + x - 1, (y - 1) * W + x, y * W + x - 1, y * W + x];
    if (x < 1 || y < 1 || x >= W) return false;
    if (!c.every((i) => owner.has(i))) return false;
    return new Set(c.map((i) => owner.get(i))).size === 4;
  };
  const cornersOf = (i: number) => { const x = i % W, y = Math.floor(i / W); return [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]; };
  const go = (k: number): boolean => {
    if (++nodes > budget) return false;
    while (k < order.length && owner.has(order[k]!)) k++;
    if (k >= order.length) return true;
    const i = order[k]!, x = i % W, y = Math.floor(i / W);
    const tries: ["h" | "v", number][] = y % 2 ? [["v", i + W], ["h", i + 1]] : [["h", i + 1], ["v", i + W]];
    for (const [dir, j] of tries) {
      if (!cells.has(j) || owner.has(j) || (dir === "h" && (j % W) !== x + 1)) continue;
      const id = mats.length; owner.set(i, id); owner.set(j, id); mats.push({ a: i, b: j, dir });
      const bad = [...cornersOf(i), ...cornersOf(j)].some(([cx, cy]) => cornerBad(cx!, cy!));
      if (!bad && go(k + 1)) return true;
      owner.delete(i); owner.delete(j); mats.pop();
    }
    return false;
  };
  return go(0) ? mats : null;
}

/** w x h sizes (cells) that hold `cells` floor cells as whole mats, for the Fixed-call text. */
export function tatamiSizes(n: number): string {
  const out: string[] = [];
  for (let w = 2; w <= 10; w++) for (let h = 2; h <= 10; h++) if (w * h === n && w <= h) out.push(`${w}x${h}`);
  return out.join(" / ");
}

/** Soft floor checks over the final per-cell floor ids (null = not floor). rooms = groups of region ids that are joined into one space. */
export function floorReport(W: number, H: number, floorAt: (x: number, y: number) => string | null, rooms: { id: string; cells: number[] }[]) {
  const warnings: string[] = [];
  const mix: { room: string; floors: Record<string, number> }[] = [];
  for (const r of rooms) {
    const c: Record<string, number> = {};
    for (const i of r.cells) { const f = floorAt(i % W, Math.floor(i / W)); if (f) c[f] = (c[f] ?? 0) + 1; }
    mix.push({ room: r.id, floors: c });
    const kinds = Object.keys(c).sort((a, b) => c[b]! - c[a]!);
    if (kinds.length > 2) warnings.push(`floor: room "${r.id}" uses ${kinds.length} floor materials (${kinds.map((k) => `${k} ${c[k]}`).join(", ")}) — keep one dominant floor plus at most one purposeful sub-zone (genkan, kitchen tiles, a wet area).`);
  }
  let islands = 0; const where: string[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const f = floorAt(x, y); if (!f) continue;
    const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].map(([a, b]) => (a! >= 0 && b! >= 0 && a! < W && b! < H ? floorAt(a!, b!) : null)).filter((v) => v);
    if (n.length >= 2 && n.every((v) => v !== f)) { islands++; if (where.length < 6) where.push(`(${x},${y}) ${f}`); }
  }
  if (islands) warnings.push(`floor: ${islands} single-cell floor island(s) — a lone cell of a different material (${where.join(", ")}); widen that zone or merge it into its neighbour.`);
  return { warnings, mix, islands };
}
