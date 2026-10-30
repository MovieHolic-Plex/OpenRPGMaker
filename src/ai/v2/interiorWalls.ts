// 실내 칸 배치의 벽 우선 형식 — 모델이 바깥 벽 고리·칸막이 벽 경로·벽 위 문·방 이름표·벽에 묶인 기물을 쓰고, 코드는 칸으로 펴고 검사해 그대로 깐다.
//
// 왜(2026-10-31, agent/bbox-walls scripts/experiments/bbox-walls/lay.mts): 사각형 영역 형식(57%)보다 벽을 1급 재료로 준 형식이
// Opus 판정 31승 10무 3패/44, 벽 점수 7.6 으로 더 강했다. 함수는 벽·방·가구를 고르지 않는다 — 펴기·검사·영어 거절만 한다.
// 실험 lay.mts 를 함수로 옮겼다(칩셋 사양 S 를 받는다 — v5 밖 roomKit 칩셋도 같은 규칙).
import { analyseHandInteriorPlan, buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "@/editor/handInterior/builder";
import type { TilesetDef } from "@/project/types";
import type { LayoutCheck, LayoutObject } from "./interiorLayout";

export interface WallPath { readonly id?: string; readonly material: string; readonly path: readonly (readonly [number, number])[]; readonly thickness?: number; readonly stub?: boolean; readonly purpose?: string }
export interface WallDoor { readonly wall: string; readonly x: number; readonly y: number; readonly width?: number; readonly piece?: string | null; readonly purpose?: string }
export interface WallRoom { readonly id: string; readonly at: readonly [number, number]; readonly floor: string; readonly purpose?: string; readonly role?: string; readonly landmark?: string; readonly stairs?: string; readonly repeat?: boolean }
export interface WallItem extends LayoutObject { readonly wall?: string }
export interface WallsLayoutFields {
  readonly outer_wall?: WallPath;
  readonly walls?: readonly WallPath[];
  readonly doors?: readonly WallDoor[];
  readonly rooms?: readonly WallRoom[];
  readonly wall_items?: readonly WallItem[];
  readonly rails?: readonly { readonly id: string; readonly path: readonly (readonly [number, number])[] }[];
}

/** 지은 방(벽으로 닫힌 공간) — 상자는 방 칸의 바깥 상자, cells 는 방 칸 수. */
export interface WallsRoomOut { id: string; x: number; y: number; w: number; h: number; cells: number; floor: string; purpose?: string; role?: string; landmark?: string; stairs?: string }

import { spaceChecks } from "./interiorSpace";

const DOOR_PIECES = new Set(["locked door", "iron gate", "iron gate open"]);
const WINDOW = /window|stained glass/u;
const SIZED = /^([a-z-]+) (\d+)x(\d+)$/u;
const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function checkWallLayout(raw: unknown, S: HandInteriorSpec, tileset: TilesetDef, opts: { dropObjects?: ReadonlySet<number> } = {}): LayoutCheck {
  const errors: string[] = [], warnings: string[] = [];
  const badObjects = new Set<number>();
  const L = (raw ?? {}) as WallsLayoutFields & { map?: { w?: number; h?: number }; entrance?: { x?: number; y?: number }; landmark?: WallItem; objects?: readonly LayoutObject[]; carpets?: readonly { id: string; x: number; y: number; w: number; h: number }[] };
  const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
  const out = (extra: Partial<LayoutCheck> = {}): LayoutCheck => ({ errors, warnings, badObjects, objects: [], ...extra });
  const W = L.map?.w, H = L.map?.h;
  if (!num(W) || !num(H) || W < 8 || H < 8 || W > 60 || H > 60) { errors.push(`map.w/map.h must be integers 8..60 (got ${W}x${H}).`); return out(); }
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x: number, y: number) => y * W + x;
  const P = (x: number, y: number) => `(${x},${y})`;
  const fp = (id: string) => { const d = S.objects[id]; const s = SIZED.exec(id); return d ? { w: d.w, h: Math.max(1, d.h) } : { w: Number(s?.[2] ?? 1), h: Number(s?.[3] ?? 1) }; };

  // ---- 벽: 경로를 칸으로 편다 ----
  type Wall = { id: string; material: string; outer: boolean; thickness: number; stub: boolean; cells: number[]; ends: [number, number][]; horiz: Set<number>; vert: Set<number> };
  const wallOf = new Int32Array(W * H).fill(-1);
  const walls: Wall[] = [];
  const raster = (id: string, path: unknown, thickness: number, outer: boolean): Omit<Wall, "id" | "material" | "outer" | "stub"> | undefined => {
    if (!Array.isArray(path) || path.length < 2 || !path.every((p) => Array.isArray(p) && p.length === 2 && num(p[0]) && num(p[1]))) { errors.push(`wall "${id}": path must be a list of at least 2 [x,y] integer points.`); return undefined; }
    const pts: [number, number][] = path.map((p: [number, number]) => [p[0], p[1]]);
    if (outer) {
      const a = pts[0]!, b = pts[pts.length - 1]!;
      if (a[0] !== b[0] || a[1] !== b[1]) { if (a[0] === b[0] || a[1] === b[1]) pts.push([a[0], a[1]]); else { errors.push(`outer wall path is not closed: last point ${P(...b)} must return to the first point ${P(...a)} with straight segments.`); return undefined; } }
    }
    const cells: number[] = [], horiz = new Set<number>(), vert = new Set<number>();
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, y0] = pts[k]!, [x1, y1] = pts[k + 1]!;
      if (x0 !== x1 && y0 !== y1) { errors.push(`wall "${id}": segment ${P(x0, y0)}->${P(x1, y1)} is diagonal — every segment must be horizontal or vertical.`); return undefined; }
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
      for (let s = 0; s <= n; s++) for (let t = 0; t < thickness; t++) {
        const x = x0 + s * sx + (sy !== 0 ? t : 0), y = y0 + s * sy + (sx !== 0 ? t : 0);
        if (!inMap(x, y)) { errors.push(`wall "${id}" cell ${P(x, y)} is outside the ${W}x${H} map.`); return undefined; }
        cells.push(idx(x, y)); (sx !== 0 ? horiz : vert).add(idx(x, y));
      }
    }
    return { thickness, cells, ends: outer ? [] : [pts[0]!, pts[pts.length - 1]!], horiz, vert };
  };
  const ow = L.outer_wall;
  if (!ow) { errors.push(`outer_wall is missing — a closed ring of wall cells around the building: {"material":"<wall id>","path":[[x,y],...]}.`); return out(); }
  if (!S.walls[ow.material]) errors.push(`outer_wall: unknown wall material "${ow.material}" — use a catalog wall id (${Object.keys(S.walls).slice(0, 10).join(", ")}…).`);
  const r0 = raster("outer", ow.path, 1, true);
  if (r0) walls.push({ id: "outer", material: ow.material, outer: true, stub: false, ...r0 });
  for (const w of Array.isArray(L.walls) ? L.walls : []) {
    const id = String(w?.id ?? `wall${walls.length}`);
    if (id === "outer" || walls.some((x) => x.id === id)) { errors.push(`wall id "${id}" is used twice.`); continue; }
    if (!S.walls[w.material]) errors.push(`wall "${id}": unknown wall material "${w.material}" — use a catalog wall id.`);
    const t = w.thickness ?? 1;
    if (t !== 1 && t !== 2) { errors.push(`wall "${id}": thickness must be 1 or 2.`); continue; }
    const r = raster(id, w.path, t, false);
    if (r) walls.push({ id, material: w.material, outer: false, stub: Boolean(w.stub), ...r });
  }
  if (errors.length) return out();
  walls.forEach((w, k) => { for (const i of w.cells) if (wallOf[i]! < 0 || w.outer) wallOf[i] = k; });
  const wallByName = new Map(walls.map((w, k) => [w.id, k]));
  // 바깥 = 맵 가장자리에서 벽 아닌 칸으로 번진 곳
  const outside = new Uint8Array(W * H);
  {
    const q: number[] = [];
    const seed = (x: number, y: number) => { const i = idx(x, y); if (wallOf[i]! < 0 && !outside[i]) { outside[i] = 1; q.push(i); } };
    for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
    for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
    while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (inMap(X, Y)) seed(X, Y); } }
  }
  let interiorN = 0; for (let i = 0; i < W * H; i++) if (!outside[i] && wallOf[i]! < 0) interiorN++;
  if (!interiorN) { errors.push("outer wall encloses no interior cells — the ring must surround the building (its inside must be at least 1 cell from the ring on every side)."); return out(); }
  for (const w of walls) if (!w.outer) {
    const bad = w.cells.filter((i) => { const x = i % W, y = (i - x) / W; return N4.some(([dx, dy]) => inMap(x + dx, y + dy) && outside[idx(x + dx, y + dy)]); });
    const self = new Set(w.cells);
    const onOuter = w.cells.filter((i) => walls[wallOf[i]!]!.outer);
    if (bad.length) errors.push(`wall "${w.id}" runs outside the outer wall near ${P(bad[0]! % W, Math.floor(bad[0]! / W))} — partitions must stay inside the outer ring.`);
    if (onOuter.length > 2) warnings.push(`wall "${w.id}" lies on the outer wall for ${onOuter.length} cells — partitions should only touch the outer wall at their ends.`);
    if (!w.stub) for (const [ex, ey] of w.ends) {
      const touch = N4.some(([dx, dy]) => { const X = ex + dx, Y = ey + dy; return inMap(X, Y) && wallOf[idx(X, Y)]! >= 0 && !self.has(idx(X, Y)); }) || walls[wallOf[idx(ex, ey)]!]!.id !== w.id;
      if (!touch) errors.push(`wall "${w.id}" end ${P(ex, ey)} does not touch another wall — a partition must run from wall to wall so rooms are closed (extend the path by one cell until it meets the other wall), or mark it "stub": true for a freestanding wall piece.`);
    }
  }
  const grid: string[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (outside[idx(x, y)] || wallOf[idx(x, y)]! >= 0 ? "#" : ".")));

  // ---- 문 ----
  type Door = { wall: string; cells: number[]; piece?: string; x: number; y: number; vertical: boolean; a: number; b: number };
  const doors: Door[] = [];
  const doorCell = new Set<number>();
  const isDoorPiece = (id: string) => DOOR_PIECES.has(id) || S.objects[id]?.kind === "door" || S.objects[id]?.kind === "sidedoor";
  for (const d of Array.isArray(L.doors) ? L.doors : []) {
    const k = wallByName.get(d?.wall);
    if (k === undefined) { errors.push(`door ${P(d?.x, d?.y)}: unknown wall "${d?.wall}" — use the id of a partition wall.`); continue; }
    if (!num(d.x) || !num(d.y)) { errors.push(`door on "${d.wall}": x,y must be integers.`); continue; }
    const w = walls[k]!;
    if (w.outer) { errors.push(`door ${P(d.x, d.y)} is on the outer wall — the only opening in the outer wall is the "entrance" (bottom map row). Interior doors go on partition walls.`); continue; }
    const i0 = idx(d.x, d.y);
    if (!inMap(d.x, d.y) || !w.cells.includes(i0)) { errors.push(`door ${P(d.x, d.y)} is not on wall "${w.id}" — x,y must be a cell of that wall's path.`); continue; }
    const vertical = w.vert.has(i0) && !w.horiz.has(i0);
    const cells: number[] = [];
    if (!vertical) { const width = d.width ?? 1; for (let s = 0; s < width; s++) for (let t = 0; t < w.thickness; t++) cells.push(idx(d.x + s, d.y + t)); }
    else for (let t = 0; t < w.thickness; t++) for (const dy of [0, -1, -2]) cells.push(idx(d.x + t, d.y + dy));
    const off = cells.filter((i) => !w.cells.includes(i));
    if (off.length) {
      errors.push(vertical
        ? `door ${P(d.x, d.y)} in vertical wall "${w.id}": a vertical-wall doorway is 3 cells tall — (x,y) is the walkable bottom cell, and (x,y-1),(x,y-2) above it (they become wall face) must also be cells of "${w.id}"; ${off.map((i) => P(i % W, Math.floor(i / W))).join(" ")} are not. Move the door down or lengthen the wall.`
        : `door ${P(d.x, d.y)} width ${d.width ?? 1} runs off wall "${w.id}" at ${off.map((i) => P(i % W, Math.floor(i / W))).join(" ")}.`);
      continue;
    }
    const [a, b] = vertical ? [[d.x - 1, d.y], [d.x + w.thickness, d.y]] : [[d.x, d.y - 1], [d.x, d.y + w.thickness]];
    const open = (p: number[]) => inMap(p[0]!, p[1]!) && grid[p[1]!]![p[0]!] === ".";
    if (!open(a!) || !open(b!)) { errors.push(`door ${P(d.x, d.y)} on "${w.id}" does not join two rooms: ${P(a![0]!, a![1]!)} and ${P(b![0]!, b![1]!)} must both be room cells (not wall).`); continue; }
    if (d.piece !== undefined && d.piece !== null && d.piece !== "" && !isDoorPiece(d.piece)) errors.push(`door ${P(d.x, d.y)}: piece "${d.piece}" is not a door piece — use ${[...DOOR_PIECES].join(", ")}, or omit it for an open doorway.`);
    for (const i of cells) doorCell.add(i);
    doors.push({ wall: w.id, cells, ...(d.piece ? { piece: d.piece } : {}), x: d.x, y: d.y, vertical, a: idx(a![0]!, a![1]!), b: idx(b![0]!, b![1]!) });
  }
  const ent = L.entrance;
  if (!ent || !num(ent.x) || !num(ent.y)) { errors.push("entrance {x,y} is missing — one cell of the outer wall on the bottom map row."); return out(); }
  if (ent.y !== H - 1) { errors.push(`entrance ${P(ent.x, ent.y)} must be on the bottom map row y=${H - 1}, in the outer wall (so the outer wall's south side must run along y=${H - 1} there).`); return out(); }
  if (!inMap(ent.x, ent.y) || wallOf[idx(ent.x, ent.y)]! < 0 || !walls[wallOf[idx(ent.x, ent.y)]!]!.outer) { errors.push(`entrance ${P(ent.x, ent.y)} must be a cell of the outer wall on the bottom map row.`); return out(); }
  if (grid[ent.y - 1]![ent.x] !== ".") { errors.push(`entrance ${P(ent.x, ent.y)} must have a room cell directly above it ${P(ent.x, ent.y - 1)}.`); return out(); }

  // ---- 방 = 벽으로 닫힌 공간(문은 닫힌 채로 센다) ----
  const comp = new Int32Array(W * H).fill(-1); const comps: number[][] = [];
  for (let i = 0; i < W * H; i++) if (grid[Math.floor(i / W)]![i % W] === "." && comp[i]! < 0) {
    const c = comps.length, q = [i], cells: number[] = []; comp[i] = c;
    while (q.length) { const j: number = q.pop()!; cells.push(j); const x: number = j % W, y: number = (j - x) / W;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (inMap(X, Y) && grid[Y]![X] === "." && comp[idx(X, Y)]! < 0) { comp[idx(X, Y)] = c; q.push(idx(X, Y)); } } }
    comps.push(cells);
  }
  const rooms = Array.isArray(L.rooms) ? L.rooms : [];
  const roomOfComp = new Map<number, WallRoom>();
  for (const r of rooms) {
    const at = r?.at;
    if (!Array.isArray(at) || !num(at[0]) || !num(at[1]) || !inMap(at[0], at[1])) { errors.push(`room "${r?.id}": "at" must be an [x,y] cell inside the room.`); continue; }
    if (!S.floors[r.floor]) errors.push(`room "${r.id}": unknown floor "${r.floor}" — use a catalog floor id (${Object.keys(S.floors).slice(0, 10).join(", ")}…).`);
    const c = comp[idx(at[0], at[1])]!;
    if (c < 0) { errors.push(`room "${r.id}" label ${P(at[0], at[1])} is on a wall or outside the outer wall — put "at" on a cell inside the room.`); continue; }
    const prev = roomOfComp.get(c);
    if (prev) {
      const xs = comps[c]!.map((i) => i % W), ys = comps[c]!.map((i) => Math.floor(i / W));
      errors.push(`rooms "${prev.id}" and "${r.id}" are one connected space (cells ${P(Math.min(...xs), Math.min(...ys))}..${P(Math.max(...xs), Math.max(...ys))}) — the wall between them is not closed. Walls must run wall to wall; only a door may make a gap.`);
      continue;
    }
    roomOfComp.set(c, r);
  }
  comps.forEach((cells, c) => {
    if (roomOfComp.has(c)) return;
    const xs = cells.map((i) => i % W), ys = cells.map((i) => Math.floor(i / W));
    errors.push(`enclosed space ${P(Math.min(...xs), Math.min(...ys))}..${P(Math.max(...xs), Math.max(...ys))} (${cells.length} cells) has no room label — add it to "rooms" or close it off with wall (no leftover pockets between walls).`);
  });
  for (const [c, r] of roomOfComp) {
    const floorN = comps[c]!.filter((i) => { const x = i % W, y = (i - x) / W; return !(y >= 1 && grid[y - 1]![x] === "#") && !(y >= 2 && grid[y - 2]![x] === "#"); }).length;
    if (floorN < 4) errors.push(`room "${r.id}" has only ${floorN} floor cells — the two rows under every north wall are wall face (not floor), so make the room taller.`);
  }
  if (!roomOfComp.size || errors.length) return out();

  for (const i of doorCell) grid[Math.floor(i / W)]![i % W] = ".";
  grid[ent.y]![ent.x] = ".";
  const plan = grid.map((r) => r.join(""));
  const A = analyseHandInteriorPlan(plan);
  const wallAbove = (x: number, y: number): number => { for (let k = 1; k <= 2; k++) { const Y = y - k; if (Y < 0) return -1; if (grid[Y]![x] === "#") return wallOf[idx(x, Y)]!; } return -1; };

  // ---- 기물: 랜드마크 먼저(같은 id·자리가 objects/wall_items 에 또 있으면 하나로 친다), objects, wall_items ----
  const roomList = [...roomOfComp.entries()];
  const roomIdAt = (x: number, y: number): string | undefined => { const c = inMap(x, y) ? comp[idx(x, y)]! : -1; return c >= 0 ? roomOfComp.get(c)?.id : undefined; };
  type Pl = { id: string; x: number; y: number; wall?: string; src: number; purpose?: string };
  const objs: Pl[] = [];
  const lmRaw = L.landmark;
  const same = (a: { id?: string; x?: number; y?: number }, b: { id?: string; x?: number; y?: number }) => a.id === b.id && a.x === b.x && a.y === b.y;
  const objList = (Array.isArray(L.objects) ? L.objects : []).filter((o) => !(lmRaw && o && same(o, lmRaw) && !(o.repeat && (o.repeat.count ?? 1) > 1)));
  const itemList = (Array.isArray(L.wall_items) ? L.wall_items : []).filter((o) => !(lmRaw && o && same(o, lmRaw) && !(o.repeat && (o.repeat.count ?? 1) > 1)));
  // 랜드마크가 걸이·벽붙이면 wall_items 쪽 규칙으로 본다(벽을 안 적었으면 바로 위 벽을 쓴다 — 그 벽이 없으면 거절 글이 자리를 알려 준다).
  const lmKind = lmRaw ? S.objects[lmRaw.id]?.kind : undefined;
  const lmIsItem = lmKind === "hang" || lmKind === "wall";
  const srcList: { o: WallItem; item: boolean }[] = [
    ...(lmRaw ? [{ o: lmRaw, item: lmIsItem }] : []),
    ...objList.map((o) => ({ o, item: false })),
    ...itemList.map((o) => ({ o: o as WallItem, item: true })),
  ];
  if (!lmRaw) errors.push(`landmark is missing — name the one big piece the place is built around: "landmark":{"id":"<catalog id>","x":X,"y":Y,"purpose":"..."} (add "wall" if it is a wall piece).`);
  const expand = (o: WallItem, src: number): Pl[] => {
    const n = Math.max(1, Math.min(40, Number(o.repeat?.count ?? 1) || 1)), dx = Number(o.repeat?.dx ?? 0) || 0, dy = Number(o.repeat?.dy ?? 0) || 0;
    return Array.from({ length: n }, (_, i) => ({ id: o.id, x: o.x + i * dx, y: o.y + i * dy, ...(o.wall ? { wall: o.wall } : {}), src, ...(o.purpose ? { purpose: o.purpose } : {}) }));
  };
  srcList.forEach(({ o, item }, src) => {
    if (opts.dropObjects?.has(src)) return;
    const bad = (msg: string) => { errors.push(msg); badObjects.add(src); };
    if (typeof o?.id !== "string" || !num(o.x) || !num(o.y)) return bad(`${item ? "wall_item" : "object"} ${JSON.stringify(o).slice(0, 80)}: needs id and integer x, y.`);
    const d = S.objects[o.id], s = SIZED.exec(o.id);
    if (!d && !(s && S.tables[s[1]!])) return bad(`unknown catalog id "${o.id}" at ${P(o.x, o.y)} — use an exact id from the catalog.`);
    if (!item) {
      if (d && (d.kind === "hang" || d.kind === "wall")) return bad(`"${o.id}" at ${P(o.x, o.y)} is a wall piece — move it to "wall_items" with the "wall" it belongs to.`);
      if (isDoorPiece(o.id) && doors.some((dd) => dd.cells.includes(idx(o.x, o.y)))) return bad(`"${o.id}" at ${P(o.x, o.y)} sits in a wall door — give it as "piece" on that door instead.`);
      objs.push(...expand(o, src));
      return;
    }
    if (!d || (d.kind !== "hang" && d.kind !== "wall")) return bad(`"${o.id}" is not a wall piece — put it in "objects".`);
    let wname = o.wall;
    if (!wname) { const k0 = wallAbove(o.x, d.kind === "hang" ? o.y : o.y - 1); if (k0 >= 0) wname = walls[k0]!.id; }
    const k = wname === undefined ? undefined : wallByName.get(wname);
    if (k === undefined) return bad(`wall_item "${o.id}" at ${P(o.x, o.y)}: unknown wall "${o.wall ?? ""}" — name the wall it hangs on / stands against.`);
    if (WINDOW.test(o.id) && !walls[k]!.outer) bad(`"${o.id}" at ${P(o.x, o.y)} is a window on interior wall "${wname}" — windows go on the outer wall only.`);
    for (const p of expand({ ...o, wall: wname }, src)) {
      const cols = Array.from({ length: Math.max(1, d.w) }, (_, i) => p.x + i);
      const hang = d.kind === "hang";
      const off: number[] = cols.filter((x: number) => hang ? !(A.face[p.y]?.[x] === 1 && wallOf[idx(x, p.y - 1)] === k) : !(A.face[p.y - 1]?.[x] === 2 && wallOf[idx(x, p.y - 3)] === k));
      if (off.length) {
        const x0: number = off[0]!; let hint = "";
        for (let y = 0; y < H; y++) if (wallOf[idx(x0, y)] === k && A.face[y + 1]?.[x0] === 1) { hint = ` — the face of "${wname}" in column ${x0} starts at y=${y + 1}, so ${hang ? `hang it at y=${y + 1}` : `stand it at y=${y + 3}`}`; break; }
        if (!hint) hint = ` — "${wname}" has no visible face in column ${x0} (only the south side of a horizontal wall shows a face; vertical walls and the south outer wall show no face, so nothing can hang on them)`;
        bad(`"${o.id}" at ${P(p.x, p.y)} does not touch the face of wall "${wname}" at column(s) ${off.join(",")}: ${hang ? "a wall-mounted piece goes on the UPPER face row (the row right below the wall cap)" : "an against-wall piece stands on the first floor row right below the 2-row face"}${hint}.`);
      }
      objs.push(p);
    }
  });
  for (const d of doors) if (d.piece) objs.push({ id: d.piece, x: d.x, y: d.y, src: -1 });
  const lines: { id: string; cells?: { x: number; y: number }[]; rect?: { x0: number; y0: number; x1: number; y1: number } }[] = [];
  for (const c of Array.isArray(L.carpets) ? L.carpets : []) {
    if (!S.lines[c?.id] || S.lines[c.id]!.kind !== "flat") { errors.push(`unknown carpet id "${c?.id}" — use one of: ${Object.keys(S.lines).filter((k) => S.lines[k]!.kind === "flat").join(", ")}.`); continue; }
    if (![c.x, c.y, c.w, c.h].every(num)) { errors.push(`carpet ${c.id}: x,y,w,h must be integers.`); continue; }
    lines.push({ id: c.id, rect: { x0: c.x, y0: c.y, x1: c.x + c.w - 1, y1: c.y + c.h - 1 } });
  }
  const railCells = new Set<number>();
  for (const r of Array.isArray(L.rails) ? L.rails : []) {
    if (!S.lines[r?.id] || S.lines[r.id]!.kind !== "floor") { errors.push(`unknown rail id "${r?.id}".`); continue; }
    const pts = Array.isArray(r.path) ? r.path : [];
    const cells: { x: number; y: number }[] = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [x0, y0] = pts[k]!, [x1, y1] = pts[k + 1]!;
      if (x0 !== x1 && y0 !== y1) { errors.push(`rail ${r.id}: segment ${P(x0, y0)}->${P(x1, y1)} is diagonal.`); break; }
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= n; s++) cells.push({ x: x0 + s * Math.sign(x1 - x0), y: y0 + s * Math.sign(y1 - y0) });
    }
    for (const c of cells) { if (!A.isFloor(c.x, c.y)) errors.push(`rail ${r.id} cell ${P(c.x, c.y)} is not floor.`); railCells.add(idx(c.x, c.y)); }
    lines.push({ id: r.id, cells });
  }
  for (const p of objs) { const { w, h } = fp(p.id); if (p.x < 0 || p.y < 0 || p.x + w > W || p.y + h > H) { errors.push(`"${p.id}" at ${P(p.x, p.y)} (${w}x${h}) is out of the map.`); if (p.src >= 0) badObjects.add(p.src); } }
  const stairSoft: string[] = [];
  // ---- 계단: 칩셋 계단 킷 그대로 — 위로 가는 계단은 3칸 폭 x 3줄(북벽 벽면 두 줄 + 첫 바닥 줄), 남쪽 한 줄이 들어오는 자리(비운 바닥) ----
  {
    const occ = new Map<number, string>();
    for (const p of objs) { const d = S.objects[p.id]; if (d && (d.kind === "hang" || d.kind === "flat" || d.stairs)) continue; if (isDoorPiece(p.id)) continue;
      const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) occ.set(idx(p.x + dx, p.y + dy), `"${p.id}"@${P(p.x, p.y)}`); }
    for (const i of railCells) occ.set(i, "a rail");
    const upWhy = (id: string, x: number, y: number, k: number): string | null => {
      const d = S.objects[id]!; const cols = Array.from({ length: d.w }, (_, i) => x + i);
      const badCol = cols.filter((c) => !(A.face[y - 2]?.[c] === 1 && A.face[y - 1]?.[c] === 2 && inMap(c, y - 3) && wallOf[idx(c, y - 3)] === k && A.isFloor(c, y) && !occ.has(idx(c, y))));
      if (badCol.length) return `its ${d.w}x3 kit does not fit: column(s) ${badCol.join(",")} are not [2 face rows of one straight wall at rows ${y - 2},${y - 1}] + [free floor at row ${y}] (no door, corner or furniture in those ${d.w} columns)`;
      const blocked = cols.filter((c) => !A.isFloor(c, y + 1) || occ.has(idx(c, y + 1)) || doorCell.has(idx(c, y + 1)));
      if (blocked.length) return `its entry side (south) is blocked: ${blocked.map((c) => P(c, y + 1) + (occ.has(idx(c, y + 1)) ? ` by ${occ.get(idx(c, y + 1))}` : doorCell.has(idx(c, y + 1)) ? " (a doorway)" : " (not floor)")).join(", ")} — the ${d.w} cells ${P(x, y + 1)}..${P(x + d.w - 1, y + 1)} must stay free walkable floor`;
      return null;
    };
    const upSpots = (id: string, k?: number) => { const out: { x: number; y: number; k: number }[] = [];
      for (let y = 3; y < H - 1; y++) for (let x = 0; x < W; x++) { const kk = wallOf[idx(x, y - 3)]!; if (kk < 0 || (k !== undefined && kk !== k)) continue; if (!upWhy(id, x, y, kk)) out.push({ x, y, k: kk }); }
      return out; };
    const fixedUp = (id: string, x: number, y: number, k?: number): string => {
      let c = k !== undefined ? upSpots(id, k) : []; if (!c.length) c = upSpots(id);
      if (!c.length) return ` No wall in this layout has a free straight ${S.objects[id]!.w}-cell north face with free floor in front: lengthen a room northward or clear a stretch of a north wall.`;
      c.sort((a, b) => Math.abs(a.x - x) + Math.abs(a.y - y) - Math.abs(b.x - x) - Math.abs(b.y - y));
      const f = c[0]!; return ` Fixed call: wall_items entry {"id": "${id}", "wall": "${walls[f.k]!.id}", "x": ${f.x}, "y": ${f.y}} (kit covers ${P(f.x, f.y - 2)}..${P(f.x + S.objects[id]!.w - 1, f.y)}, entry ${P(f.x, f.y + 1)}..${P(f.x + S.objects[id]!.w - 1, f.y + 1)}).`;
    };
    const seen = new Set<number>();
    for (const p of objs) {
      const d = S.objects[p.id]; if (!d?.stairs || seen.has(p.src)) continue;
      if (d.stairs === "up" && d.kind === "wall") {
        const k = p.wall !== undefined ? wallByName.get(p.wall) : undefined;
        if (k === undefined) continue; // 벽 이름이 틀린 것은 위에서 이미 거절했다
        const why = upWhy(p.id, p.x, p.y, k);
        if (why) { seen.add(p.src); errors.push(`"${p.id}" at ${P(p.x, p.y)} on wall "${walls[k]!.id}": ${why}.${fixedUp(p.id, p.x, p.y, k)}`); if (p.src >= 0) badObjects.add(p.src); }
      } else if (d.stairs === "down") {
        const bad = Array.from({ length: d.w }, (_, i) => [p.x + i, p.y + Math.max(1, d.h)] as const).filter(([c, r]) => !inMap(c, r) || !A.isFloor(c, r) || occ.has(idx(c, r)));
        if (bad.length) { seen.add(p.src); errors.push(`"${p.id}" at ${P(p.x, p.y)} is a ${d.w}x${Math.max(1, d.h)} hole in the floor entered from the south: ${bad.map(([c, r]) => P(c, r)).join(" ")} must stay free walkable floor — move it so the row below it is open floor.`); if (p.src >= 0) badObjects.add(p.src); }
      }
    }
    // 방이 계단을 선언했는데 계단이 없다 — 고치기 글(soft): 고치기를 다 쓰면(걸린 계단을 뺀 뒤에도) 경고로 남기고 깐다
    for (const [c, r] of roomOfComp) {
      const want = r.stairs === "up" || r.stairs === "down" ? r.stairs : undefined; if (!want) continue;
      const cells = new Set(comps[c]!);
      const has = objs.some((p) => S.objects[p.id]?.stairs === want && (cells.has(idx(p.x, p.y)) || cells.has(idx(p.x, p.y + 1))));
      if (has) continue;
      const ids = Object.keys(S.objects).filter((id) => S.objects[id]!.stairs === want);
      if (!ids.length) continue;
      if (want === "up") {
        const id = ids.find((i) => /wood/u.test(i)) ?? ids[0]!;
        const spots = upSpots(id).filter((s) => cells.has(idx(s.x, s.y)));
        const xs = comps[c]!.map((i) => i % W), ys = comps[c]!.map((i) => Math.floor(i / W));
        stairSoft.push(`room "${r.id}" says "stairs": "up" but has no stairs up (${ids.map((i) => `"${i}"`).join(" / ")}, a ${S.objects[id]!.w}x3 kit on a north wall, in "wall_items").${spots.length ? fixedUp(id, spots[0]!.x, spots[0]!.y, spots[0]!.k) : fixedUp(id, Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.max(...ys))}`);
      } else stairSoft.push(`room "${r.id}" says "stairs": "down" but has no stairs down (${ids.map((i) => `"${i}" ${S.objects[i]!.w}x${Math.max(1, S.objects[i]!.h)}`).join(", ")} in "objects", with free floor on the row below it).`);
    }
  }
  const objectsOut = objs.map((p) => ({ id: p.id, x: p.x, y: p.y, ...(p.purpose ? { purpose: p.purpose } : {}), region: roomIdAt(p.x, p.y + fp(p.id).h - 1) ?? roomIdAt(p.x, p.y) }));
  if (errors.length) return out({ objects: objectsOut, sources: srcList.map((x) => x.o) });

  // ---- 바닥 구역: 방 바닥, 벽면 재질 = 위 벽의 재질 ----
  const zones: { x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string }[] = [];
  const roomAt = new Int32Array(W * H).fill(-1);
  roomList.forEach(([c], k) => { for (const i of comps[c]!) roomAt[i] = k; });
  for (const d of doors) for (const i of d.cells) {
    const x = i % W, y = (i - x) / W; const nb = d.vertical ? idx(x + 1, y) : idx(x, y + 1);
    roomAt[i] = roomAt[nb]! >= 0 ? roomAt[nb]! : roomAt[d.vertical ? idx(x - 1, y) : idx(x, y - 1)]!;
  }
  roomAt[idx(ent.x, ent.y)] = roomAt[idx(ent.x, ent.y - 1)]!;
  for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const k = roomAt[idx(x, y)]!; let x1 = x; while (x1 + 1 < W && roomAt[idx(x1 + 1, y)] === k) x1++; if (k >= 0) zones.push({ x0: x, y0: y, x1, y1: y, floor: roomList[k]![1].floor }); x = x1 + 1; } }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A.face[y]![x]) { const k = wallAbove(x, y); if (k >= 0) zones.push({ x0: x, y0: y, x1: x, y1: y, wall: walls[k]!.material }); }

  // 세로 칸막이 문 틈 위 두 칸은 트인 통로로 그린다(bbox-walls-4: 벽면으로 그리면 «벽판»으로 읽혔다).
  const passages = doors.filter((d) => d.vertical).flatMap((d) => d.cells.map((i) => ({ x: i % W, y: Math.floor(i / W) })).filter((c) => c.y < d.y));
  const input: HandInteriorInput = { plan, floor: roomList[0]![1].floor, wall: ow.material, zones, objects: objs.map(({ id, x, y }) => ({ id, x, y })), lines, start: [{ x: ent.x, y: ent.y }], ...(passages.length ? { passages } : {}) };
  const built = buildHandInteriorLayers(input, tileset, S);
  const EN: Record<string, string> = {
    overlap: "two pieces overlap on this cell — move one of them",
    "not-on-floor": "this footprint cell is not walkable floor (it is wall, or one of the 2 face rows under a wall)",
    "hang-not-on-face": "wall-mounted piece is not on the upper face row",
    "wall-piece-needs-face": "against-wall piece must stand on the first floor row right below a 2-row wall face",
    "stairs-not-at-wall": "stairs up must stand on the first floor row right below a north wall face",
    "table-one-row": "counter/kcounter can only be 1 row tall",
    "out-of-bounds": "piece art goes out of the map",
    "no-entrance": "the entrance cell is blocked",
    "stair-entrance-blocked": "the stairs' front cell is blocked or not floor",
    "travel-landing-unreached": "the cell in front of the stairs cannot be reached",
  };
  const hits = (x?: number, y?: number) => x === undefined || y === undefined ? [] : objs.filter((p) => { const { w, h } = fp(p.id); return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h; });
  const who = (x?: number, y?: number) => { const h = hits(x, y); return h.length ? ` [${h.map((p) => `"${p.id}"@${P(p.x, p.y)}`).join(", ")}]` : ""; };
  for (const i of built.issues) {
    const at = i.x !== undefined ? ` at ${P(i.x, i.y!)}` : "";
    if (i.severity === "error") { errors.push((EN[i.code] ?? i.code) + at + who(i.x, i.y)); for (const p of hits(i.x, i.y)) if (p.src >= 0) badObjects.add(p.src); }
    else if (i.code === "unreachable-piece") warnings.push(`a piece has no reachable free side${at}${who(i.x, i.y)}`);
    else if (i.code === "too-many-layers") warnings.push(`too many stacked pieces${at}${who(i.x, i.y)}`);
  }
  // 방마다 입구에서 닿아야 한다(문짝은 지나갈 수 있는 문으로 친다)
  const block = new Uint8Array(W * H);
  for (const p of objs) { const d = S.objects[p.id]; if (d && (d.kind === "hang" || d.kind === "flat")) continue; if (isDoorPiece(p.id)) continue;
    const { w, h } = fp(p.id); for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (inMap(p.x + dx, p.y + dy)) block[idx(p.x + dx, p.y + dy)] = 1; }
  for (const i of railCells) block[i] = 1;
  const seen = new Uint8Array(W * H);
  { const q = [idx(ent.x, ent.y)]; seen[q[0]!] = 1;
    while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W;
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; const j = idx(X, Y); if (inMap(X, Y) && !seen[j] && A.isFloor(X, Y) && !block[j]) { seen[j] = 1; q.push(j); } } } }
  const roomsOut: WallsRoomOut[] = [];
  for (const [c, r] of roomList) {
    const fl = comps[c]!.filter((i) => A.isFloor(i % W, Math.floor(i / W)));
    if (!fl.some((i) => seen[i])) errors.push(`room "${r.id}" cannot be reached from the entrance — give it a door, and keep the doorway and the cell on each side of it free of furniture.`);
    const xs = comps[c]!.map((i) => i % W), ys = comps[c]!.map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    roomsOut.push({ id: r.id, x: x0, y: y0, w: Math.max(...xs) - x0 + 1, h: Math.max(...ys) - y0 + 1, cells: comps[c]!.length, floor: r.floor,
      ...(r.purpose ? { purpose: String(r.purpose).slice(0, 60) } : {}), ...(r.role ? { role: String(r.role) } : {}), ...(r.landmark ? { landmark: r.landmark } : {}), ...(r.stairs ? { stairs: r.stairs } : {}) });
  }
  if (lmRaw && built.issues.some((i) => i.code === "unreachable-piece" && hits(i.x, i.y).some((p) => p.src === 0))) errors.push(`landmark "${lmRaw.id}" at ${P(lmRaw.x, lmRaw.y)} has no reachable free side — clear a cell next to it that connects to the entrance.`);
  if (built.unreachedFloor.length) warnings.push(`${built.unreachedFloor.length} floor cells are not reachable from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => P(c.x, c.y)).join(" ")}) — furniture blocks the way.`);
  const compRoom = (i: number) => { const c = comp[i]!; return c >= 0 ? roomOfComp.get(c)?.id : undefined; };
  // ---- 공간 검사(빈 바닥·큰 빈 사각형·복도 폭·큰 방 채움·깔개 상한·방 크기 위계) — 구조가 맞을 때만, 고치기 글은 soft 로 ----
  let soft: string[] = [], notes: string[] = [], space: LayoutCheck["space"];
  if (!errors.length) {
    const roomIdx = new Map<string, number>(); roomList.forEach(([c, r]) => roomIdx.set(r.id, c));
    const rugs = new Map<string, number>(), pieces = new Map<string, number>();
    for (const cp of Array.isArray(L.carpets) ? L.carpets : []) { const id = num(cp?.x) && num(cp?.y) && inMap(cp.x, cp.y) ? compRoom(idx(cp.x, cp.y)) : undefined; if (id) rugs.set(id, (rugs.get(id) ?? 0) + 1); }
    for (const p of objs) {
      const d = S.objects[p.id]; const id = roomIdAt(p.x, p.y + fp(p.id).h - 1) ?? roomIdAt(p.x, p.y); if (!id) continue;
      if (d?.kind === "flat") { if (/rug|runner|carpet/u.test(p.id)) rugs.set(id, (rugs.get(id) ?? 0) + 1); continue; }
      if (d?.kind === "hang" || isDoorPiece(p.id)) continue;
      pieces.set(id, (pieces.get(id) ?? 0) + 1);
    }
    const portals = [...doorCell, idx(ent.x, ent.y)];
    for (const p of objs) { const d = S.objects[p.id]; if (d?.stairs === "up") for (let c = 0; c < d.w; c++) portals.push(idx(p.x + c, p.y + 1)); else if (d?.stairs === "down") for (let c = 0; c < d.w; c++) portals.push(idx(p.x + c, p.y + Math.max(1, d.h))); }
    const spaceRooms = roomList.map(([c, r]) => {
      const ws = new Set<string>();
      for (const i of comps[c]!) { const x = i % W, y = (i - x) / W; for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (inMap(X, Y) && wallOf[idx(X, Y)]! >= 0 && !doorCell.has(idx(X, Y))) ws.add(walls[wallOf[idx(X, Y)]!]!.id); } }
      return { id: r.id, cells: comps[c]!, ...(r.purpose ? { purpose: String(r.purpose) } : {}), ...(r.role ? { role: String(r.role) } : {}), ...(r.repeat ? { repeat: true } : {}), walls: [...ws] };
    });
    const res = spaceChecks({ W, H, isFloor: A.isFloor, block, dais: new Set<number>(), rooms: spaceRooms, portals, rugs, pieces });
    soft = [...stairSoft, ...res.problems]; notes = res.notes;
    space = { emptyPct: res.emptyPct, roomCV: res.roomCV, rooms: res.rooms };
  }
  const connections = doors.flatMap((d) => { const a = compRoom(d.a), b = compRoom(d.b); return a && b && a !== b ? [{ a, b, type: "door" }] : []; });
  return { errors, warnings: [...warnings, ...notes], soft, ...(space ? { space } : {}), badObjects, input, built, objects: objectsOut, sources: srcList.map((x) => x.o), rooms: roomsOut, connections, entranceRoom: compRoom(idx(ent.x, ent.y - 1)) };
}
