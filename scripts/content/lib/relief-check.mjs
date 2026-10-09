// Relief face / stair / bridge structure check (relief round 3, 2026-09-29 — openwiki/relief-terrain.md, openwiki/runtime-project-schema.md 「렌더러 r3」).
// Reads one finished map ({ width, height, lowerTiles, upperTiles, relief }) and returns [{ code, x, y, note }]. The reference
// documents' error pictures are real maps altered on purpose and fed to this check; the codes and coordinates they print come from here.
//   RELIEF_THIN_FACE       a south face lower than minFace levels (a 1-level cliff draws as a 16 px strip that reads as a line)
//   RELIEF_STAIR_NO_FLANK  a north stair (code 5) whose side columns are not the high ground it climbs to (the steps stand in the open)
//   RELIEF_STAIR_NO_LANDING  the row above a stair's top is not the high ground (the climb ends against nothing)
//   RELIEF_LANDING_ROW0    a stair's top row is row 0 or its landing is row 0 (the renderer's thinning treats outside the map as
//                          ground 0 and lowers a one-row landing there)
//   RELIEF_STAIR_BLOCKED   a solid upper tile (tree, post, prop) on a stair or bridge deck cell
//   RELIEF_DECK_LEVEL      a bridge deck cell (code 9) not at the level of the high ground at both ends
//   RELIEF_DECK_NO_CODE    a deck plank tile on a cell without code 9 (drawn as a raised strip with its own walls — a dam, not a bridge)
//   RELIEF_DECK_FACE      a deck with the wall behind it (north) closer than its lift + 2 rows: on screen the deck lies on that wall's face
//                         (planks nailed to a cliff) instead of over a visible gorge
//   RELIEF_PATH_HIDDEN    (with isRoad) a path cell on the rows a raised block hides north of it — the block's lifted top covers it on screen
//   RELIEF_TOP_BAND        a column whose row 0 is lower than the largest north overhang (the game camera widens above the map by
//                          that overhang; the lower column shows an empty band there)
//   RELIEF_UNREACHED       (with api) a passable cell, stair cell or deck cell not reached from `from` with the engine's canMove
// Scope: structure and passage only. Whether it reads well (colour, rhythm, variety) is the visual QA's job, not this check's.
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function checkRelief(map, { minFace = 2, deckTiles = [], api = null, project = null, from = null, isRoad = null } = {}) {
  const r = map.relief, W = map.width, H = map.height, lv = r.levels, rp = r.ramps ?? [], out = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : lv[y * W + x]);
  const code = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : rp[y * W + x] ?? 0);
  const push = (c, x, y, note) => out.push({ code: c, x, y, ...(note ? { note } : {}) });
  // faces
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = i + W, d = lv[i] - lv[j];
    if (d > 0 && d < minFace && !rp[i] && !rp[j]) push("RELIEF_THIN_FACE", x, y, `drop ${d}`);
  }
  // north stairs, grouped by column runs of code 5
  const seen = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) {
    if (rp[s] !== 5 || seen[s]) continue;
    const cells = [s]; seen[s] = 1;
    for (let k = 0; k < cells.length; k++) { const c = cells[k], x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && !seen[j] && rp[j] === 5) { seen[j] = 1; cells.push(j); } } }
    const xs = cells.map((c) => c % W), ys = cells.map((c) => (c / W) | 0);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const hi = Math.max(...Array.from({ length: x1 - x0 + 1 }, (_, k) => at(x0 + k, y0 - 1)));
    for (let y = y0; y <= y1; y++) for (const x of [x0 - 1, x1 + 1]) if (at(x, y) !== hi || code(x, y)) { push("RELIEF_STAIR_NO_FLANK", x0, y0, `side ${x},${y} level ${at(x, y)} ≠ ${hi}`); y = y1 + 1; break; }
    if (y0 - 1 <= 0) push("RELIEF_LANDING_ROW0", x0, y0);
    else for (let x = x0; x <= x1; x++) if (at(x, y0 - 1) <= at(x, y0) || code(x, y0 - 1)) { push("RELIEF_STAIR_NO_LANDING", x0, y0); break; }
  }
  // decks
  const deckSet = new Set(deckTiles);
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (deckSet.has(map.lowerTiles[i]) && rp[i] !== 9) push("RELIEF_DECK_NO_CODE", x, y);
    if (rp[i] === 9) {
      const ends = N4.map(([dx, dy]) => [x + dx, y + dy]).filter(([X, Y]) => X >= 0 && Y >= 0 && X < W && Y < H && code(X, Y) !== 9 && at(X, Y) >= lv[i] - 0);
      const high = ends.map(([X, Y]) => at(X, Y));
      if (high.some((h) => h !== lv[i])) push("RELIEF_DECK_LEVEL", x, y, `deck ${lv[i]} vs end ${high.join("/")}`);
    }
    if ((rp[i] >= 5 && rp[i] <= 9) && map.upperTiles[i] >= 0 && api && project && !api.isPassable(project, map, x, y)) push("RELIEF_STAIR_BLOCKED", x, y);
  }
  // deck against the wall behind it: lift = deck level − the gorge floor level (the lowest non-deck neighbour)
  for (let i = 0; i < W * H; i++) {
    if (rp[i] !== 9) continue;
    const x = i % W, y = (i / W) | 0;
    let floor = lv[i]; for (const [dx, dy] of [...N4, [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && code(X, Y) !== 9) floor = Math.min(floor, lv[Y * W + X]); }
    const lift = lv[i] - floor; if (lift <= 0 || code(x, y - 1) === 9) continue;   // the north row of the deck only
    for (let k = 1; k <= lift + 1; k++) { if (y - k < 0) break; if (at(x, y - k) >= lv[i]) { push("RELIEF_DECK_FACE", x, y, `wall ${k} rows north, lift ${lift}`); break; } }
  }
  if (isRoad) for (let i = 0; i < W * H; i++) {
    if (!isRoad(i) || rp[i]) continue;
    const x = i % W, y = (i / W) | 0;
    for (let k = 1; k <= 14 && y + k < H; k++) { if (code(x, y + k) === 9) break; if (at(x, y + k) - lv[i] >= k) { push("RELIEF_PATH_HIDDEN", x, y, `covered by ${x},${y + k}`); break; } }
  }
  // top band
  let over = 0; for (let i = 0; i < W * H; i++) over = Math.max(over, lv[i] - ((i / W) | 0));
  const band = []; for (let x = 0; x < W; x++) if (lv[x] < over) band.push(x);
  if (band.length) push("RELIEF_TOP_BAND", band[0], 0, `columns ${band[0]}..${band[band.length - 1]} (${band.length}) row-0 level < overhang ${over}`);
  // walk
  if (api && project && from) {
    const seenW = new Set([from[1] * W + from[0]]), q = [from];
    for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && !seenW.has(j) && api.canMove(project, map, x, y, X, Y)) { seenW.add(j); q.push([X, Y]); } } }
    const miss = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!seenW.has(i) && (api.isPassable(project, map, x, y) || (rp[i] >= 5 && rp[i] <= 9))) miss.push([x, y]); }
    if (miss.length) push("RELIEF_UNREACHED", miss[0][0], miss[0][1], `${miss.length} cells, first ${miss.slice(0, 4).map((c) => c.join(",")).join(" ")}`);
  }
  return out;
}
