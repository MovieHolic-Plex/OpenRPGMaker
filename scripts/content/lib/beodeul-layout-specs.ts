// Layout definitions for author-beodeul-layouts.mts. A layout only calls the api (stamp / fill / path) — the same operations the assistant has.
export interface LayoutApi {
  project(): any; tileset(): any; map(): any;
  call(name: string, args: any): { ok: boolean; summary?: unknown };
  stamp(id: string, x: number, y: number): boolean;
  fill(rect: { x: number; y: number; w: number; h: number }, material: string): boolean;
  path(points: { x: number; y: number }[], material?: string): boolean;
}
export interface Tamper { id: string; caption: string; box: [number, number, number, number]; apply(api: LayoutApi, stamps: { objectId: string; x: number; y: number }[]): void }
export interface LayoutSpec { id: string; name: string; build(api: LayoutApi): void; tampers?: Tamper[] }

// deterministic PRNG
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

/** Kit info: size + door (cell of the entrance part) from the tileset. */
export function kitInfo(api: LayoutApi, id: string) {
  const k = (api.tileset().structureKits as any[]).find((kit) => kit.id === id);
  if (!k) throw new Error(`no kit ${id}`);
  const d = (k.parts ?? []).find((p: any) => p.kind === "entrance");
  return { w: k.width as number, h: k.height as number, door: d ? { dx: d.dx as number, dy: d.dy as number } : null, kit: k };
}
/** Are all non-empty cells of the kit at (x,y) still open ground (grass lower, nothing above)? */
export function freeFor(api: LayoutApi, id: string, x: number, y: number, margin = 0): boolean {
  const { kit, w, h } = kitInfo(api, id); const m = api.map(); const grass = lawnTiles(api);
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) {
    const r = kit.rows[j]; const lo = r.tiles[i], up = r.upperTiles?.[i] ?? -1; if (lo < 0 && up < 0) continue;
    for (let dy = -margin; dy <= margin; dy += 1) for (let dx = -margin; dx <= margin; dx += 1) {
      const cx = x + i + dx, cy = y + j + dy; if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height) { if (dx === 0 && dy === 0) return false; continue; }
      const idx = cy * m.width + cx; if (m.upperTiles[idx] >= 0 || !grass.has(m.lowerTiles[idx])) return false;
    }
  }
  return true;
}
let GRASS = -1;
export function grassTile(api: LayoutApi): number {
  if (GRASS < 0) { const g = (api.tileset().tileGroups as any[]).find((t) => t.id === "beodeul:grass"); GRASS = g.tileIds[0]; }
  return GRASS;
}
let LAWN: Set<number> | null = null;
/** The flat lawn tile plus every tile of the lawn patch kits: all of these count as open ground. */
export function lawnTiles(api: LayoutApi): Set<number> {
  if (!LAWN) { LAWN = new Set([grassTile(api)]); for (const k of api.tileset().structureKits as any[]) if (/^bd-ground-lawn-/.test(k.id)) for (const r of k.rows) for (const t of r.tiles) if (t >= 0) LAWN.add(t); }
  return LAWN;
}
export const HOUSE_IDS = (api: LayoutApi) => (api.tileset().structureKits as any[]).map((k) => k.id as string).filter((id) => /^bd-house-(h|i)\d/.test(id));
export const TREE_IDS = (api: LayoutApi) => (api.tileset().structureKits as any[]).map((k) => k.id as string).filter((id) => /^bd-tree-/.test(id));

/** A row of houses whose doors face a road: the road row is `roadY`; houses stand on row roadY-1 (side "N") or, mirrored
 *  is not possible (kits are not flipped), so houses only stand NORTH of an east-west road. Returns the placed kit ids. */
export function terrace(api: LayoutApi, seed: number, roadY: number, x0: number, x1: number, opts: { gap?: number; skip?: (x: number) => boolean; ids?: string[] } = {}) {
  const r = rng(seed); const ids = opts.ids ?? HOUSE_IDS(api); const placed: { id: string; x: number; y: number }[] = []; let x = x0; let last = "", last2 = "";
  while (x < x1) {
    const tries = ids.map((id) => ({ id, s: r() })).sort((a, b) => a.s - b.s).map((t) => t.id);
    let done = false;
    for (const id of tries) {
      if (id === last || id === last2) continue;
      const { w, h, door } = kitInfo(api, id); if (!door || door.dy + 1 !== h || x + w > x1 + 1) continue; const y = roadY - h;
      if (opts.skip?.(x)) break;
      if (!freeFor(api, id, x, y)) continue;
      if (api.stamp(id, x, y)) { placed.push({ id, x, y }); last2 = last; last = id; x += w + (r() < (opts.gap ?? 0.15) ? 1 : 0); done = true; break; }
    }
    if (!done) x += 1;
  }
  return placed;
}
/** Scatter tree kits on free ground (never within `keep` cells of `avoid` cells: doors, roads). */
export function scatterTrees(api: LayoutApi, seed: number, rect: { x: number; y: number; w: number; h: number }, count: number, avoid: (x: number, y: number) => boolean = () => false) {
  const r = rng(seed); const ids = TREE_IDS(api); let placed = 0; let recent: string[] = [];
  for (let n = 0; n < count * 12 && placed < count; n += 1) {
    const id = ids[Math.floor(r() * ids.length)]!; if (recent.includes(id)) continue;
    const { w, h } = kitInfo(api, id); const x = rect.x + Math.floor(r() * (rect.w - w + 1)), y = rect.y + Math.floor(r() * (rect.h - h + 1));
    if (avoid(x, y) || avoid(x + w - 1, y + h - 1) || !freeFor(api, id, x, y, 1)) continue;
    if (api.stamp(id, x, y)) { placed += 1; recent = [id, ...recent].slice(0, 4); }
  }
  return placed;
}

/** Round-3 block town: the street grid is laid first (hierarchy: avenue 4 cells with lamps and trees, street 2, alley 1), then one
 *  block kit per grid cell, then the streets are filled again so every block edge, alley end and plaza joins the curb-less road.
 *  Grid columns (x, width): the N-S streets and the avenue sit between them. Bands (y, height): the E-W streets between them. */
export const BLOCK_COLS: [number, number][] = [[2, 20], [24, 20], [48, 20], [70, 14], [86, 14]];
export const BLOCK_VSTREETS: [number, number][] = [[0, 2], [22, 2], [44, 4], [68, 2], [84, 2]];          // x, width (44: the avenue)
export const BLOCK_HSTREETS: [number, number][] = [[17, 2], [32, 4], [49, 2], [59, 1], [73, 2], [83, 2]]; // y, height (32: avenue, 59: alley, 83: the quay street on the harbour)
/** One block kit per grid cell. No id twice on neighbouring blocks, no id more than twice (beodeul-metrics blockRepeats). */
export const BLOCK_BANDS: { y: number; h: number; row: (string | [string, string] | null)[] }[] = [
  { y: 0, h: 17, row: ["bd-block-church-20x17", ["bd-block-res-20x8", "bd-block-shop-20x8-b"], ["bd-block-res-20x8-c", "bd-block-shop-20x8"], ["bd-block-res-14x8", "bd-block-market-14x8"], ["bd-block-res-14x8-b", "bd-block-shop-14x8"]] },
  { y: 19, h: 13, row: ["bd-block-res-20x13", "bd-block-market-20x13", "bd-block-shop-20x13", "bd-block-res-14x13", "bd-block-shop-14x13"] },
  { y: 36, h: 13, row: ["bd-block-manor-20x13-b", "bd-block-res-20x13-b", "bd-block-shop-20x13-b", "bd-block-market-14x13", "bd-block-manor-14x13"] },
  { y: 51, h: 8, row: ["bd-block-res-20x8-b", "bd-block-shop-20x8", "bd-block-res-20x8", "bd-block-shop-14x8-b", "bd-block-res-14x8-c"] },
  { y: 60, h: 13, row: ["bd-block-out-20x13", "bd-block-manor-20x13-c", "bd-block-res-20x13", "bd-block-res-14x13-b", null] },
  { y: 75, h: 8, row: ["bd-block-out-20x8", "bd-block-port-20x8-b", "bd-block-port-20x8", "bd-block-market-14x8-b", "bd-block-out-14x8"] },
];
/** stamp props with no clearance ring on still-open lawn */
export function dense(api: LayoutApi, seed: number, rect: { x: number; y: number; w: number; h: number }, ids: string[], count: number, avoid: (x: number, y: number) => boolean = () => false) {
  const r = rng(seed); let placed = 0;
  for (let n = 0; n < count * 20 && placed < count; n += 1) {
    const id = ids[Math.floor(r() * ids.length)]!; const { w, h } = kitInfo(api, id);
    const x = rect.x + Math.floor(r() * (rect.w - w + 1)), y = rect.y + Math.floor(r() * (rect.h - h + 1));
    let bad = false; for (let j = 0; j < h && !bad; j += 1) for (let i = 0; i < w; i += 1) if (avoid(x + i, y + j)) { bad = true; break; }
    if (bad || !freeFor(api, id, x, y)) continue;
    if (api.stamp(id, x, y)) placed += 1;
  }
  return placed;
}
export const LAYOUTS: LayoutSpec[] = [
  { id: "hilltop", name: "언덕 위 성 아래 마을", build(api) {
      const R = "버들항 길 포석", SAND = "버들항 모랫길";
      // 0. ground variety: lawn patches on the flat lawn (the material fill alone is one flat tile)
      const rg = rng(5); for (let n = 0; n < 60; n += 1) api.stamp(`bd-ground-lawn-${1 + Math.floor(rg() * 6)}`, Math.floor(rg() * 92), Math.floor(rg() * 92));
      // 1. landmarks first: the castle on the top-centre hill, the estate and the cathedral on the flanks (kits keep their cliffs, walls and gates)
      api.stamp("bd-castle", 33, 0);           // exit: causeway stair, cells (48..50, 32)
      api.stamp("bd-estate", 6, 4);            // gate exit (14..15, 25)
      api.stamp("bd-cathedral", 77, 5);        // plaza exit (83..84, 26)
      api.stamp("bd-forum", 39, 44);           // top strip y=44 (exits rel 2..9, 14..18), west exit (39,54), south exit (55..56, 57)
      api.stamp("bd-windmill", 1, 40);         // its own lane is the east column x=12, rows 40..61
      // 2. the noble quarter (new kits): manor whose door front is the top of the formal garden; the garden's foot meets the street at y=61
      api.stamp("bd-manor-timber", 72, 41);    // door (80,50), stairs (79..81, 51..52)
      api.stamp("bd-garden-formal", 72, 53);   // path cell (80,53) is right below the stairs
      // 3. streets (autotile: curbs appear by themselves; they meet the plaza/stairs/bridges without a curb).
      //    Leave no one-cell slit between a street and a kit: fill_region closes such slits ("벽 틈 메움") and they become stubs.
      api.fill({ x: 48, y: 33, w: 3, h: 5 }, R);
      api.fill({ x: 14, y: 26, w: 2, h: 12 }, R);
      api.fill({ x: 83, y: 27, w: 2, h: 11 }, R);
      api.fill({ x: 12, y: 38, w: 73, h: 2 }, R);              // main street: from the windmill lane to the cathedral road
      api.fill({ x: 48, y: 40, w: 3, h: 4 }, R);               // boulevard reaches the forum's top strip
      api.fill({ x: 16, y: 40, w: 2, h: 30 }, R);              // west avenue
      api.fill({ x: 61, y: 40, w: 2, h: 30 }, R);              // east avenue, flush with the forum's east wall
      api.fill({ x: 13, y: 48, w: 3, h: 2 }, R);               // the windmill lane joins the avenue
      api.fill({ x: 18, y: 48, w: 21, h: 2 }, R);
      api.fill({ x: 37, y: 50, w: 2, h: 8 }, R);               // forum west exit down to street y=58
      api.fill({ x: 13, y: 58, w: 26, h: 2 }, R);              // street y=58 west part (ends at the forum spur)
      api.fill({ x: 55, y: 58, w: 6, h: 2 }, R);               // forum south exit → east avenue (not under the forum: its wall gaps would be filled)
      api.fill({ x: 12, y: 62, w: 1, h: 6 }, R);               // windmill lane continues to street y=68
      api.fill({ x: 12, y: 68, w: 88, h: 2 }, R);              // lower street: windmill lane → leaves town at the east edge
      api.fill({ x: 79, y: 61, w: 3, h: 7 }, R);               // the garden foot (80,61) runs straight down to street y=68
      api.fill({ x: 42, y: 58, w: 1, h: 10 }, R);              // the forum's south arch gate (42,57) → lane → street y=68
      api.fill({ x: 16, y: 70, w: 2, h: 8 }, R); api.fill({ x: 94, y: 70, w: 2, h: 8 }, R);   // the town streets reach the country road
      // 4. houses: every house stands NORTH of an east-west street with its door on the street row
      terrace(api, 11, 38, 18, 47); terrace(api, 12, 38, 52, 80);
      terrace(api, 14, 48, 18, 36);
      terrace(api, 16, 58, 18, 36);
      terrace(api, 17, 68, 18, 60); terrace(api, 19, 68, 63, 99);
      // 5. outside the walls: a sand road, a well plaza, wooden houses (new kits), a fenced yard
      api.fill({ x: 48, y: 70, w: 2, h: 1 }, R);       // meets the plaza kit's north opening (49,71)
      api.fill({ x: 0, y: 78, w: 100, h: 2 }, SAND);            // the country road leaves town at both edges
      api.stamp("bd-out-well-plaza-sand", 44, 71 - 1 + 1);
      const OUT = ["bd-out-cabin", "bd-out-cabin-small", "bd-out-house-plank", "bd-out-longhouse"];
      terrace(api, 31, 78, 8, 43, { gap: 0.3, ids: OUT }); terrace(api, 32, 78, 56, 91, { gap: 0.3, ids: OUT });
      // 6. trees: groves hide the cut ends of the castle cliff; the country south of the road is a wood, not an empty lawn
      scatterTrees(api, 23, { x: 28, y: 18, w: 5, h: 18 }, 4); scatterTrees(api, 24, { x: 66, y: 18, w: 6, h: 18 }, 4);
      scatterTrees(api, 21, { x: 2, y: 24, w: 96, h: 74 }, 60, (x, y) => false);
      scatterTrees(api, 22, { x: 0, y: 80, w: 100, h: 20 }, 55);
    },
    tampers: [
      { id: "err-layout-door-blocked", caption: "문 앞 칸(길)에 사과 궤짝 한 칸을 찍었다 — 그 집 문이 막힌다.", box: [0, 0, 0, 0],
        apply(api, stamps) { const s = stamps.find((t) => /bd-house-h/.test(t.objectId) && t.y > 45)!; const k = kitInfo(api, s.objectId.split("/")[1]!);
          const fx = s.x + k.door!.dx, fy = s.y + k.door!.dy + 1; api.stamp("bd-prop-crate_apple", fx, fy); (this as any).box = [fx - 8, fy - 8, fx + 9, fy + 5]; } },
      { id: "err-layout-dead-end", caption: "아래 거리에서 남쪽으로 두 칸짜리 곁길을 냈다가 풀밭에서 끊었다 — 막다른 길.", box: [80, 62, 98, 76],
        apply(api) { api.fill({ x: 88, y: 70, w: 2, h: 2 }, "버들항 길 포석"); } },
      { id: "err-layout-same-row", caption: "아래 거리(68행) 북쪽 집 줄 한 토막을 같은 집 조각(bd-house-h113_0) 셋으로 바꿨다 — 같은 조각 일렬.", box: [14, 56, 46, 72],
        apply(api, stamps) { const m = api.map(); const g = grassTile(api);
          // the houses standing on street row 68 from x=18: clear their footprints until 15 cells are free, then three of the same house
          const row = stamps.filter((s) => /bd-house-/.test(s.objectId) && s.x >= 18 && s.y + kitInfo(api, s.objectId.split("/")[1]!).h === 68).sort((a, b) => a.x - b.x);
          let freed = 0; const x0 = row[0]!.x;
          for (const s of row) { if (freed >= 15) break; const k = kitInfo(api, s.objectId.split("/")[1]!);
            for (let y = s.y; y < s.y + k.h; y += 1) for (let x = s.x; x < s.x + k.w; x += 1) { m.upperTiles[y * m.width + x] = -1; m.lowerTiles[y * m.width + x] = g; }
            stamps.splice(stamps.indexOf(s), 1); freed = s.x + k.w - x0; }
          for (const i of [0, 1, 2]) api.stamp("bd-house-h113_0", x0 + i * 5, 62); } },
    ] },
  { id: "blocks", name: "블록 조립 도시", build(api) {
      const R = "버들항 길 포석";
      // 1. plan: the whole street grid first — avenues (4), streets (2), the quay (3) and the harbour water below it
      const streets: { x: number; y: number; w: number; h: number }[] = [];
      for (const [x, w] of BLOCK_VSTREETS) streets.push({ x, y: 0, w, h: 85 });
      for (const [y, h] of BLOCK_HSTREETS) streets.push({ x: 0, y, w: 100, h });
      streets.push({ x: 22, y: 8, w: 78, h: 1 });              // the back alley of the two-deep top band (1 cell)
      for (const r of streets) api.fill(r, R);
      // the harbour: the lake kit under the quay street (its top row is the quay), a warehouse block and a grove east of it
      api.stamp("bd-harbour-lake", 0, 85);
      // 2. fill: one block kit per grid cell (the top band stacks two 8-deep blocks on the alley)
      for (const band of BLOCK_BANDS) band.row.forEach((b, c) => {
        const [x] = BLOCK_COLS[c]!; if (!b) return;
        if (Array.isArray(b)) { api.stamp(b[0], x, band.y); api.stamp(b[1], x, band.y + 9); } else api.stamp(b, x, band.y);
      });
      // 3. join the alley ends: re-fill only the one street cell outside each end of a block's back alley (row 6 of a 13-deep
      //    res/shop/out block) so the curb opens. Never re-fill whole streets after the blocks: fill_region closes every one-cell
      //    lawn slit on a block rim ("벽 틈 메움") and bites road notches into the blocks.
      for (const band of BLOCK_BANDS) band.row.forEach((b, c) => {
        if (typeof b !== "string" || band.h !== 13 || !/-(res|shop|out)-/.test(b)) return; const [x, w] = BLOCK_COLS[c]!; const y = band.y + 6;
        if (x - 1 >= 0) api.fill({ x: x - 1, y, w: 1, h: 1 }, R); if (x + w < 100) api.fill({ x: x + w, y, w: 1, h: 1 }, R);
      });
      // 4. finish: the park with a curved lane (two parallel lay_path lines = a 2-cell street), street trees and lamps on the avenues
      // a diagonal lane through the park: one 3-cell row slice per map row, each shifted east by about one cell (the road autotile
      // draws the curb steps). lay_path draws a one-cell 8-neighbour line — two parallel lay_paths read as a staircase, not a street.
      for (let t = 0; t < 13; t += 1) api.fill({ x: 86 + Math.round((t * 11) / 12), y: 60 + t, w: 3, h: 1 }, R);
      const onPath = (x: number, y: number) => { const m = api.map(); const t = m.lowerTiles[y * m.width + x]; return !lawnTiles(api).has(t); };
      dense(api, 71, { x: 86, y: 60, w: 14, h: 13 }, ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-47e17a"], 12, onPath);
      dense(api, 72, { x: 86, y: 60, w: 14, h: 13 }, ["bd-prop-flowerbed", "bd-prop-bench_wood", "bd-prop-planter_round", "bd-tree-eef4bc"], 14, onPath);
      api.stamp("bd-block-port-14x8", 86, 85);
      // its warehouse doors face south: a lane down the lake's east bank (x=83..85) and a lane along the doors (y=93..94) to the map edge
      api.fill({ x: 83, y: 85, w: 3, h: 10 }, R); api.fill({ x: 86, y: 93, w: 14, h: 2 }, R);
      dense(api, 73, { x: 83, y: 95, w: 3, h: 5 }, ["bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-eef4bc", "bd-tree-28ad5e"], 3);
      dense(api, 74, { x: 86, y: 95, w: 14, h: 5 }, ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-prop-flowerbed", "bd-prop-planter_round"], 14);
      // avenue furniture on the edge row that no door or alley opens onto: the E-W avenue's bottom row (y=35), the N-S avenue's east column (x=47)
      const crossX = new Set<number>(); for (const [x, w] of BLOCK_VSTREETS) for (let i = -1; i <= w; i += 1) crossX.add(x + i);
      const crossY = new Set<number>(); for (const [y, h] of BLOCK_HSTREETS) for (let i = -1; i <= h; i += 1) crossY.add(y + i); for (const y of [7, 8, 9, 24, 25, 26, 41, 42, 43, 65, 66, 67]) crossY.add(y);
      let n = 0; for (let x = 4; x < 98; x += 5) { if (crossX.has(x)) continue; api.stamp(n++ % 2 ? "bd-tree-eef4bc" : "bd-prop-lamp_crook", x, 33); }
      n = 0; for (let y = 10; y < 80; y += 4) { if ([y, y + 1, y + 2].some((v) => crossY.has(v))) continue; api.stamp(n++ % 2 ? "bd-tree-28ad5e" : "bd-prop-lamp_crook", 47, y); }
    } },
  { id: "bends", name: "굽이 운하 도시", build(api) {
      // Round 4 example (tiledata/beodeul-city/tile-laying-theory.md). Lynch's five elements are fixed first, as coordinates:
      //  edge = the canal (centre-line table below, three bends) · paths = promenades on both banks + an east avenue that jogs 6 cells
      //  · districts = castle bank (west), estate/cathedral hill (north-east), market quarter (east), harbour (south)
      //  · nodes = forum, harbour square, well plaza, the market blocks · landmarks = castle NW, estate + cathedral NE, forum, windmill W.
      // Blocks are packed band by band: every band starts under a street and ends on a street, gap streets between blocks join the two,
      // so no street ends in grass. Block ids are reserved before stamping: no id twice, never the same id within 24 cells.
      const R = "버들항 길 포석", WATER = "물";
      const rg = rng(11); for (let n = 0; n < 60; n += 1) api.stamp(`bd-ground-lawn-${1 + Math.floor(rg() * 6)}`, Math.floor(rg() * 92), Math.floor(rg() * 92));
      // ---- 1. edge: canal centre line (y, left x of the 4-wide water). Plateaus carry the bridges; slopes move one cell per row.
      const PTS: [number, number][] = [[0, 36], [8, 36], [18, 44], [34, 44], [46, 32], [60, 32], [68, 38], [84, 38]];
      const left = (y: number) => { for (let i = 1; i < PTS.length; i += 1) { const [y0, x0] = PTS[i - 1]!, [y1, x1] = PTS[i]!; if (y <= y1) return Math.round(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)); } return 40; };
      api.stamp("bd-harbour-lake", 0, 84);                              // the river enters the lake at lake x + 38..41 = 38..41
      for (let y = 0; y < 84; y += 1) api.fill({ x: left(y), y, w: 4, h: 1 }, WATER);
      // promenades on both banks, row by row (the slanting bank never leaves a slit)
      for (let y = 0; y < 84; y += 1) api.fill({ x: left(y) - 2, y, w: 2, h: 1 }, R);
      for (let y = 0; y < 84; y += 1) api.fill({ x: left(y) + 4, y, w: 2, h: 1 }, R);
      const wEnd = (y: number) => left(y) - 3, eStart = (y: number) => left(y) + 6;     // last free column west / first free column east
      const hW = (y: number, x0 = 0) => { for (let j = 0; j < 2; j += 1) api.fill({ x: x0, y: y + j, w: wEnd(y + j) - x0 + 1, h: 1 }, R); };
      const hE = (y: number, x1: number, rows = 2) => { for (let j = 0; j < rows; j += 1) api.fill({ x: eStart(y + j), y: y + j, w: x1 - eStart(y + j) + 1, h: 1 }, R); };
      // ---- 2. landmarks
      api.stamp("bd-castle", 1, 0); api.stamp("bd-estate", 55, 0); api.stamp("bd-cathedral", 80, 2); api.stamp("bd-windmill", 0, 60);
      // ---- 3. paths
      hW(33, 0);                                        // castle gate street
      hE(22, 75);                                       // estate street → avenue (x 72..75)
      api.fill({ x: 72, y: 24, w: 28, h: 2 }, R);       // cathedral street, two rows south: the jog
      api.fill({ x: 72, y: 22, w: 4, h: 28 }, R);       // avenue, upper part (x 72..75, y 22..49)
      api.fill({ x: 66, y: 47, w: 10, h: 2 }, R);       // avenue jog street
      api.fill({ x: 66, y: 47, w: 4, h: 37 }, R);       // avenue, lower part (x 66..69, y 47..83)
      api.fill({ x: 12, y: 58, w: 2, h: 26 }, R);       // windmill lane (x 12..13)
      for (const by of [21, 47, 72]) api.stamp("bd-bridge-arch", left(by), by);   // decks on rows by+1, by+2
      // ---- 4. blocks, band by band
      const TOWN = ["res", "shop", "market"], HOME = ["res", "out", "manor"], ALL = ["res", "shop", "market", "manor", "out"];
      const pool = (w: number, h: number, kinds: string[]) => (api.tileset().structureKits as any[]).map((k) => k.id as string)
        .filter((id) => new RegExp(`^bd-block-(${kinds.join("|")})-${w}x${h}(-[bc])?$`).test(id));
      const used = new Map<string, number>(); const done: { id: string; x: number; y: number; w: number; h: number }[] = [];
      const near = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h)) <= 24;
      const pick = (b: { x: number; y: number; w: number; h: number }, kinds: string[]) => {
        // markets: two per town at most (three market squares read as empty paving)
        const markets = done.filter((d) => d.id.includes("-market-")).length;
        const all = pool(b.w, b.h, markets >= 2 && kinds.some((k) => k !== "market") ? kinds.filter((k) => k !== "market") : kinds);
        const free = all.filter((id) => !done.some((d) => d.id === id && near(d, b)));
        const ok = free.filter((id) => (used.get(id) ?? 0) < 2); const c = (ok.length ? ok : free).sort((a, z) => (used.get(a) ?? 0) - (used.get(z) ?? 0) || (a < z ? -1 : 1));
        return c[Math.floor(rng(b.x * 131 + b.y * 7)() * Math.min(3, c.length))];
      };
      /** widths (10/14/20, 2-cell gap streets) that fill `len` best; `turn` rotates the order so bands differ */
      const widths = (len: number, turn: number, avail: number[]) => {
        let best: number[] = [], bestUsed = -1;
        const walk = (acc: number[], sum: number) => { if (sum > len) return; const u = sum; if (u > bestUsed || (u === bestUsed && new Set(acc).size > new Set(best).size)) { best = [...acc]; bestUsed = u; }
          if (acc.length >= 5) return; for (const w of avail) walk([...acc, w], sum + (acc.length ? 2 : 0) + w); };
        walk([], 0); const r = turn % Math.max(1, best.length); return [...best.slice(r), ...best.slice(0, r)];
      };
      let turn = 0;
      /** one band: blocks between x0 and x1 (x1 may follow the canal: pass a function), a 2-row street under it */
      const band = (y: number, h: number, x0: number, x1: number | ((y: number) => number), kinds: string[], street: "W" | "E" | number = "W") => {
        const xe = (yy: number) => (typeof x1 === "number" ? x1 : x1(yy));
        let xMax = 999; for (let j = 0; j < h + 2; j += 1) xMax = Math.min(xMax, xe(y + j));
        const ws = widths(xMax - x0 + 1, turn++, [20, 14, 10].filter((w) => pool(w, h, kinds).length)); let x = x0; const placed: { x: number; w: number }[] = [];
        for (const w of ws) { placed.push({ x, w }); x += w + 2; }
        // gap streets between blocks, and the wedge between the last block and the bank (row by row, it follows the promenade)
        for (let i = 1; i < placed.length; i += 1) api.fill({ x: placed[i - 1]!.x + placed[i - 1]!.w, y, w: 2, h }, R);
        const last = placed[placed.length - 1]!; for (let j = 0; j < h; j += 1) { const a = last.x + last.w, b = xe(y + j); if (b >= a) api.fill({ x: a, y: y + j, w: b - a + 1, h: 1 }, R); }
        if (street === "W") hW(y + h, x0); else if (street === "E") hE(y + h, xMax); else api.fill({ x: x0, y: y + h, w: street - x0 + 1, h: 2 }, R);
        for (const p of placed) { const b = { x: p.x, y, w: p.w, h }; const id = pick(b, kinds); if (!id) continue;
          if (api.stamp(id, p.x, y)) { used.set(id, (used.get(id) ?? 0) + 1); done.push({ id, ...b });
            if (h === 13) for (const gx of [p.x - 1, p.x + p.w]) if (gx >= 0 && gx < 100) api.fill({ x: gx, y: y + 6, w: 1, h: 1 }, R); } }  // open the back-lane curb
      };
      const westBank = (yy: number) => wEnd(yy);
      // west bank, under the castle (bands end on the promenade)
      band(35, 13, 0, westBank, ["res", "shop", "manor"]);
      band(50, 8, 0, westBank, TOWN);
      band(60, 13, 14, westBank, HOME);
      band(75, 8, 14, westBank, ["out", "port", "res"]);
      // east bank, between the promenade and the avenue (upper part x ..71, lower part x ..65)
      const eBand = (y: number, h: number, x1: number, kinds: string[]) => {
        let x0 = 0; for (let j = 0; j < h + 2; j += 1) x0 = Math.max(x0, eStart(y + j));
        // the wedge on the bank side, row by row
        for (let j = 0; j < h; j += 1) if (x0 - 1 >= eStart(y + j)) api.fill({ x: eStart(y + j), y: y + j, w: x0 - eStart(y + j), h: 1 }, R);
        band(y, h, x0, x1, kinds, "E");
      };
      eBand(24, 13, 71, ALL);
      eBand(38, 8, 71, TOWN);
      eBand(48, 13, 65, ALL);
      // forum (a node) + the market quarter east of the lower avenue
      api.stamp("bd-forum", 44, 64); hE(78, 65);
      // east of the avenue: bands shifted two rows south of the west part
      band(26, 13, 76, 99, ["res", "shop", "manor", "out"], 99);
      band(41, 13, 76, 99, TOWN, 99);
      band(56, 8, 70, 99, ["res", "shop", "out"], 99);
      band(67, 13, 70, 99, ALL, 99);
      api.fill({ x: 70, y: 82, w: 13, h: 2 }, R);        // the quay: street 80..81 widens onto the lake promenade
      // ---- 5. nodes in the leftovers
      api.stamp("bd-harbour-square", 86, 82);
      api.stamp("bd-out-well-plaza", 42, 1);
      // ---- 6. groves on the leftover lawn (never on a street: freeFor keeps one cell clear)
      const TREES = ["bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-1a786c", "bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-f4f319", "bd-tree-37f48b", "bd-tree-cc0fcb", "bd-tree-eef4bc"];
      const grove = (x0: number, y0: number, w: number, h: number, seed: number) => { const r = rng(seed);
        for (let n = 0; n < 60; n += 1) { const id = TREES[Math.floor(r() * TREES.length)]!; const x = x0 + Math.floor(r() * w), y = y0 + Math.floor(r() * h);
          if (freeFor(api, id, x, y, 1)) api.stamp(id, x, y); } };
      const TREES_SMALL = ["bd-tree-f4f319", "bd-tree-37f48b", "bd-tree-cc0fcb", "bd-tree-e9d9b3", "bd-tree-47e17a"];
      for (let s2 = 1; s2 <= 4; s2 += 1) { grove(42, 9, 13, 14, s2); grove(80, 86, 20, 14, 10 + s2); grove(51, 0, 4, 10, 20 + s2); } grove(75, 0, 5, 23, 4); grove(96, 0, 4, 25, 5); grove(0, 34, 2, 50, 6);
      for (let x = 45; x < 64; x += 3) api.stamp(TREES_SMALL[x % TREES_SMALL.length]!, x, 81);   // a row of small trees on the strip under the forum street
    } },
  { id: "estuary", name: "강어귀 항구 도시", build(api) {
      const R = "버들항 길 포석", SAND = "버들항 모랫길", WATER = "물";
      const rg = rng(9); for (let n = 0; n < 60; n += 1) api.stamp(`bd-ground-lawn-${1 + Math.floor(rg() * 6)}`, Math.floor(rg() * 92), Math.floor(rg() * 92));
      // 1. water first: the harbour lake along the bottom edge from x=0 (its river mouth is kit columns 38..41), the river comes in
      //    from the north map edge (water autotile: no bank at the edge) and runs straight down to the mouth.
      api.stamp("bd-harbour-lake", 0, 85);
      api.fill({ x: 38, y: 0, w: 4, h: 85 }, WATER);
      // 2. landmarks: the castle on the west bank, estate and cathedral on the east bank, the manor + garden on the west bank
      api.stamp("bd-castle", 2, 0);            // exits (18,32) stair and (25..26,32) → street y=33
      api.stamp("bd-estate", 48, 4);           // gate exit (56..57, 26)
      api.stamp("bd-cathedral", 78, 4);        // plaza exit (84..85, 26)
      api.stamp("bd-manor-vine", 4, 40);       // door (12,49), stairs down to the garden
      api.stamp("bd-garden-formal", 4, 52);    // garden foot (12,60) meets street y=61
      // 3. bridges: three crossings plus the quay bridge inside the lake kit
      api.stamp("bd-bridge-arch", 38, 32); api.stamp("bd-bridge-arch", 38, 60); api.stamp("bd-bridge-arch", 38, 72);
      // 4. streets. Rule: a street ends at a junction, a kit entrance, a bridge or the map edge (a road leaving town) — never in the
      //    grass or at the water. River-bank promenades on both banks take the cross streets.
      api.fill({ x: 0, y: 33, w: 38, h: 2 }, R); api.fill({ x: 42, y: 33, w: 58, h: 2 }, R);     // main street
      api.fill({ x: 56, y: 26, w: 2, h: 7 }, R); api.fill({ x: 84, y: 26, w: 2, h: 7 }, R);     // estate + cathedral
      api.fill({ x: 36, y: 35, w: 2, h: 49 }, R); api.fill({ x: 42, y: 35, w: 2, h: 49 }, R);   // promenades
      api.fill({ x: 24, y: 35, w: 2, h: 49 }, R); api.fill({ x: 84, y: 35, w: 2, h: 49 }, R);   // west and east avenues
      api.fill({ x: 26, y: 47, w: 10, h: 2 }, R);
      api.fill({ x: 44, y: 49, w: 40, h: 2 }, R);                                              // forum south street
      // The forum and the windmill have grass cells on their rims. A street filled AFTER them would close those one-cell slits
      // ("벽 틈 메움") into road stubs, so they are stamped after the streets beside them; re-filling the street cells at their exits
      // re-shapes the curbs so the exits join without a curb.
      api.stamp("bd-forum", 44, 35);           // top strip on the main street, west exit on the promenade (43,45), south exit (60..61, 49)
      api.fill({ x: 44, y: 34, w: 22, h: 1 }, R); api.fill({ x: 43, y: 44, w: 1, h: 3 }, R); api.fill({ x: 59, y: 49, w: 4, h: 1 }, R);
      api.fill({ x: 11, y: 60, w: 3, h: 1 }, R);
      api.fill({ x: 0, y: 61, w: 38, h: 2 }, R); api.fill({ x: 44, y: 61, w: 40, h: 2 }, R);
      api.fill({ x: 86, y: 59, w: 14, h: 2 }, R);                                              // reaches the windmill lane top
      api.stamp("bd-windmill", 86, 61);        // its lane is column x=97, rows 61..82 (east avenue x=84..85 and street y=59..60 are already there)
      api.fill({ x: 96, y: 60, w: 3, h: 1 }, R);
      api.fill({ x: 0, y: 73, w: 38, h: 2 }, R); api.fill({ x: 44, y: 73, w: 40, h: 2 }, R);
      api.fill({ x: 24, y: 84, w: 14, h: 1 }, R); api.fill({ x: 42, y: 84, w: 58, h: 1 }, R);   // quay street over the lake kit
      api.fill({ x: 97, y: 83, w: 1, h: 1 }, R);
      api.fill({ x: 3, y: 84, w: 21, h: 1 }, SAND);                                            // the fishermen's sand lane
      // 5. houses north of every east-west street
      terrace(api, 41, 33, 44, 55); terrace(api, 42, 33, 58, 83); terrace(api, 43, 33, 86, 99);
      terrace(api, 44, 47, 26, 35); terrace(api, 45, 61, 26, 35);
      terrace(api, 46, 49, 66, 83); terrace(api, 47, 61, 44, 83); terrace(api, 48, 59, 86, 99);
      terrace(api, 49, 73, 0, 23); terrace(api, 50, 73, 26, 35); terrace(api, 51, 73, 44, 83);
      terrace(api, 52, 84, 44, 83);
      // 6. the fishermen's quarter: wooden houses on the sand lane and a well plaza that opens onto street y=73
      api.stamp("bd-out-well-plaza-sand", 26, 76);
      api.fill({ x: 30, y: 75, w: 2, h: 1 }, R);
      const OUT = ["bd-out-cabin", "bd-out-cabin-small", "bd-out-house-plank", "bd-out-longhouse"];
      terrace(api, 53, 84, 3, 23, { gap: 0.3, ids: OUT });
      // 7. trees: a grove closes the lake kit's east end and the castle cliff's east end
      scatterTrees(api, 55, { x: 82, y: 85, w: 18, h: 15 }, 10); scatterTrees(api, 56, { x: 33, y: 18, w: 4, h: 14 }, 3);
      scatterTrees(api, 54, { x: 0, y: 0, w: 100, h: 85 }, 45);
    },
    tampers: [
      { id: "err-layout-bridge-missing", caption: "가운데 거리(61~62행)의 아치 다리와 다리 머리 둑길 칸을 강물로 되돌렸다 — 동서 거리와 둑길이 물가에서 끊긴다.", box: [28, 54, 52, 70],
        apply(api) { api.fill({ x: 36, y: 60, w: 8, h: 5 }, "물"); } },
    ] },
];
