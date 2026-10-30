// 실내 칸 배치(layout) 길 — 모델이 칸 단위 배치 JSON(맵 크기·방 사각형·문 틈·입구·깔개·단·기물, 랜드마크 먼저)을 쓰고 코드는 그대로 깐다.
//
// 왜(2026-10-30 bbox-room 실험, agent/bbox-room scripts/experiments/bbox-room): 영어 칩셋 목록 + 칸 배치 JSON 을 받은 모델이 기준 방 대비
// Opus 판정 16승 6무/28(57%), terra 7승 3무/14 — 방 그래프·구역 설계 길(3회차 5/52)보다 훨씬 강했다. 원칙은 같다: 모델이 모든 칸을 설계하고,
// 코드는 실행·검증만 한다(가구·방 수·배치를 고르지 않는다). 검증 실패는 영어 Rejected / You sent / Fixed call 로 돌려보낸다(고치기 두 번까지).
// 실행은 build_hand_interior_room(plan·zones·objects·lines·daises·start)을 거쳐 buildHandInteriorLayers 가 한다.
// 모델이 받는 글은 모두 영어다(2026-10-30 사용자 결정).
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorLayers, type HandInteriorSpec } from "@/editor/handInterior/builder";
import type { TilesetDef } from "@/project/types";
import { checkWallLayout, type WallsLayoutFields, type WallsRoomOut } from "./interiorWalls";

export interface LayoutRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface LayoutRegion extends LayoutRect { readonly id: string; readonly floor: string; readonly wall: string; readonly purpose?: string; readonly role?: string; readonly landmark?: string; readonly stairs?: string }
export interface LayoutObject { readonly id: string; readonly x: number; readonly y: number; readonly repeat?: { readonly count?: number; readonly dx?: number; readonly dy?: number }; readonly purpose?: string }
/** 두 형식: 벽 우선(outer_wall·walls·doors·rooms·wall_items — 정본, interiorWalls.ts) 또는 사각형 영역(regions·openings). */
export interface InteriorLayout extends WallsLayoutFields {
  readonly map: { readonly w: number; readonly h: number };
  readonly landmark?: LayoutObject & { readonly wall?: string };
  readonly regions?: readonly LayoutRegion[];
  readonly openings?: readonly (LayoutRect & { readonly purpose?: string })[];
  readonly entrance: { readonly x: number; readonly y: number };
  readonly carpets?: readonly (LayoutRect & { readonly id: string; readonly purpose?: string })[];
  readonly daises?: readonly (LayoutRect & { readonly id: string })[];
  readonly objects?: readonly LayoutObject[];
}

const RULE: Record<string, string> = { floor: "f", wall: "w", hang: "h", flat: "d" };
const SIZED = /^([a-z]+) (\d+)x(\d+)$/u;

/** 칩셋 목록(영어, 짧게) — 범주별로 `id WxH k[^N]`. k: f 바닥에 서서 막음 · w 북벽 벽면 바로 아래 첫 바닥 줄 · h 벽면 윗줄(걸이) · d 밟는 바닥 무늬. ^N = 그림이 N칸 위로 솟음. */
export function layoutCatalog(S: HandInteriorSpec, opts: { categories?: readonly string[]; limit?: number } = {}): string {
  const by = new Map<string, string[]>();
  for (const [id, o] of Object.entries(S.objects)) {
    if (o.kind === "door" || o.kind === "sidedoor") continue;
    if (opts.categories && !opts.categories.includes(o.category)) continue;
    const up = Math.round((o.up ?? 0) / 16);
    const k = o.stairs ? `s${o.stairs === "up" ? "u" : "d"}` : RULE[o.kind] ?? "f";
    const entry = `${id} ${o.w}x${Math.max(1, o.h)} ${k}${up > 0 ? `^${up}` : ""}`;
    (by.get(o.category) ?? by.set(o.category, []).get(o.category)!).push(entry);
  }
  const lines = [...by.entries()].sort((a, b) => b[1].length - a[1].length).map(([c, ids]) => `${c}: ${ids.slice(0, opts.limit ?? 999).join(", ")}`);
  return [
    `floors: ${Object.keys(S.floors).join(", ")}`,
    `walls: ${Object.keys(S.walls).join(", ")}`,
    `sized tables (any WxH in the id, e.g. "dining 3x2"; counter/kcounter are 1 row): ${Object.entries(S.tables).map(([k, t]) => `${k}${t.oneRow ? "(1 row)" : ""}`).join(", ")}`,
    `carpets (any rect, walkable): ${Object.keys(S.lines).filter((k) => S.lines[k]!.kind === "flat").join(", ")}`,
    `daises (any rect, walkable raised platform): ${Object.keys(S.daises).join(", ")}`,
    "objects — id WxH kind (f = stands on floor, blocks walking · w = against the north wall, on the first floor row under a wall face · h = wall-mounted, on the UPPER wall-face row · d = walkable floor decal · su/sd = stairs up/down, su against the north wall · ^N = art N cells taller, drawn upward):",
    ...lines,
  ].join("\n");
}

/** 벽 우선 형식(정본) — 모델에게 보이는 글(영어). bbox-walls run.py 의 규칙을 옮겼다. */
export const LAYOUT_FORMAT = `{"map":{"w":W,"h":H},
 "landmark":{"id":"<catalog id>","x":X,"y":Y,"wall":"<wall id, only for a wall piece>","purpose":"..."},
 "outer_wall":{"material":"<wall id>","path":[[x,y],...]},
 "walls":[{"id":"w_kitchen","material":"<wall id>","thickness":1,"path":[[x,y],[x,y]],"purpose":"..."}],
 "doors":[{"wall":"w_kitchen","x":X,"y":Y,"piece":null,"purpose":"..."}],
 "entrance":{"x":X,"y":H-1},
 "rooms":[{"id":"hall","at":[x,y],"floor":"<floor id>","purpose":"...","role":"main|side|corridor|stairs","stairs":"up|down|none"}],
 "wall_items":[{"id":"<catalog id>","wall":"outer","x":X,"y":Y,"purpose":"..."}],
 "objects":[{"id":"<catalog id>","x":X,"y":Y,"repeat":{"count":2,"dx":3,"dy":0},"purpose":"..."}],
 "carpets":[{"id":"<carpet id>","x":X,"y":Y,"w":W,"h":H}], "rails":[{"id":"bars","path":[[x,y],[x,y]]}]}`;

export const LAYOUT_GRID_RULES = [
  "Cells are 16px, x to the right, y down, origin top-left. A wall is a line of solid cells (seen from above as a dark cap).",
  "A wall shows a FACE only on its SOUTH side: the 2 cells directly below any wall cell are wall face (drawn as wall, not walkable), so a room's floor starts 3 rows below its north wall cell (wall on row 6 → face rows 7–8 → floor from row 9). Vertical walls and the building's south side show only the cap; nothing hangs on them.",
  "wall_items: wall-mounted pieces (h: windows, shelves, signs, pictures) hang on the UPPER face row y = wall row + 1; against-wall pieces (w: fireplace, bookshelves, beds, cupboards, stairs up, kitchen range) stand on y = wall row + 3. Each names its \"wall\". Windows only on the outer wall.",
  "outer_wall: a closed ring of corner points (straight segments, back to the first point) around the whole building; outside it is void. Its south side runs along the bottom row y=H-1 where the entrance is. Notches (L, T, U shapes) are fine.",
  "walls: partitions, each a path of corner points, thickness 1 (or 2), a material. A partition runs from wall to wall (both ends touch another wall or the ring) so every room is closed; \"stub\": true allows a freestanding piece.",
  "doors: {wall, x, y} on a partition cell. Horizontal wall: a 1-cell gap (\"width\" 2–3 allowed) joining the rooms north and south. Vertical wall: 3 cells tall — (x,y) is the walkable bottom cell and (x,y-1),(x,y-2) must also be cells of that wall. Optional \"piece\": \"locked door\" | \"iron gate\" | \"iron gate open\".",
  "entrance: one cell of the outer wall on the bottom row with a room cell directly above; the only opening in the ring.",
  "rooms: every space closed by walls needs exactly one entry {id, at:[x,y] any cell inside, floor, purpose}; two labels in one space means a wall is not closed.",
  "objects: floor pieces, x,y = top-left of the footprint, optional repeat {count,dx,dy}. Footprints must not overlap and must be on floor cells (not face rows). Keep every doorway and the cells in front of it free so every room and the landmark are reachable from the entrance. Tall art draws upward; keep that space free of other tall pieces. Carpets and decals are walkable.",
  "landmark: the one big piece the place is built around, written once (it may also appear in objects/wall_items at the same x,y — counted once).",
];

export const LAYOUT_FORMAT_REGIONS = `{"map":{"w":W,"h":H}, "landmark":{"id":"<object id>","x":X,"y":Y,"purpose":"..."},
 "regions":[{"id":"hall","x":X,"y":Y,"w":W,"h":H,"floor":"<floor id>","wall":"<wall id>","purpose":"...","role":"main|side|corridor|stairs","landmark":"<object id in this region>"}],
 "openings":[{"x":X,"y":Y,"w":1,"h":1,"purpose":"door to the kitchen"}], "entrance":{"x":X,"y":H-1},
 "carpets":[{"id":"<carpet id>","x":X,"y":Y,"w":W,"h":H}], "daises":[{"id":"<dais id>","x":X,"y":Y,"w":W,"h":H}],
 "objects":[{"id":"<catalog id>","x":X,"y":Y,"repeat":{"count":3,"dx":2,"dy":0},"purpose":"..."}]}`;

export const LAYOUT_GRID_RULES_REGIONS = [
  "Cells are 16px, x to the right, y down, origin top-left. Every cell outside all regions is solid. Regions are rectangles of interior space.",
  "Regions that touch or overlap merge into one open space. To put a wall between two regions leave at least one solid cell between them, then carve openings.",
  "Wall face: inside a region the two rows directly below a solid cell are wall face (drawn as wall, not walkable) — a region's top two rows are its north wall; its floor starts at y+2. h pieces go on row y (the upper face row); w pieces and stairs up go on row y+2.",
  "Openings carve solid cells. In a horizontal wall a 1-cell opening is a doorway. In a vertical wall an opening must be 3 cells tall (its top two cells become wall face; the bottom one is the passage).",
  "Keep a solid border: regions inside x 1..w-2, y 1..h-2. The entrance is one cell on the bottom map row (y = h-1) directly below a region cell; the rest of the bottom row stays solid.",
  "x,y of a piece = the top-left cell of its footprint. Footprints must not overlap, must lie on floor cells, and every piece needs a reachable free side. Keep paths from the entrance to every region and to the landmark. Carpets, decals and daises are walkable and may lie under furniture.",
];

/** 배치 JSON 을 읽어 고칠 말(영어)과 짓기 인자를 낸다. 함수는 칸을 고르지 않는다 — 막힌 것은 무엇이 어디서 막혔는지만 말한다. */
export interface LayoutCheck {
  readonly errors: string[]; readonly warnings: string[];
  readonly input?: HandInteriorInput; readonly built?: HandInteriorLayers;
  /** 문제의 기물(지워도 되는 것) 인덱스 — 고치기 횟수를 다 쓴 뒤 «되는 것만 깔기»에 쓴다. */
  readonly badObjects: Set<number>;
  readonly objects: (LayoutObject & { readonly region?: string })[];
  /** 벽 우선 형식만: 벽으로 닫힌 방·문으로 이은 방 쌍·입구가 여는 방. */
  readonly rooms?: WallsRoomOut[];
  /** 모델이 쓴 기물 목록(랜드마크 먼저) — badObjects 인덱스가 가리킨다. */
  readonly sources?: readonly LayoutObject[];
  readonly connections?: { a: string; b: string; type: string }[];
  readonly entranceRoom?: string;
}

/** 칸 배치가 실제로 왔나 — 엄격 스키마로 빈 껍데기({regions:[], outer_wall:{path:[]}})를 채워 보내는 모델이 있다. */
export const layoutGiven = (raw: unknown): boolean => !!raw && typeof raw === "object" && ((Array.isArray((raw as { regions?: unknown }).regions) && ((raw as { regions: unknown[] }).regions.length > 0)) || isWallsLayout(raw));
/** 벽 우선 형식인가(바깥 벽 고리가 있다). */
export const isWallsLayout = (raw: unknown): boolean => !!(raw && typeof raw === "object" && (raw as WallsLayoutFields).outer_wall && Array.isArray((raw as WallsLayoutFields).outer_wall?.path) && (raw as WallsLayoutFields).outer_wall!.path.length > 0);

const int = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const footprint = (S: HandInteriorSpec, id: string): { w: number; h: number } => {
  const d = S.objects[id]; const s = SIZED.exec(id);
  return { w: d?.w ?? Number(s?.[2] ?? 1), h: Math.max(1, d?.h ?? Number(s?.[3] ?? 1)) };
};

export function checkLayout(raw: unknown, S: HandInteriorSpec, tileset: TilesetDef, opts: { dropObjects?: ReadonlySet<number> } = {}): LayoutCheck {
  if (isWallsLayout(raw)) return checkWallLayout(raw, S, tileset, opts);
  const errors: string[] = [], warnings: string[] = [];
  const badObjects = new Set<number>();
  const L = (raw ?? {}) as Partial<InteriorLayout>;
  const W = L.map?.w, H = L.map?.h;
  const out = (extra: Partial<LayoutCheck> = {}): LayoutCheck => ({ errors, warnings, badObjects, objects: [], ...extra });
  if (!int(W) || !int(H) || W < 5 || H < 5 || W > 60 || H > 50) { errors.push(`map.w/map.h must be integers, 5..60 wide and 5..50 tall (got ${W}x${H}).`); return out(); }
  const grid: string[][] = Array.from({ length: H }, () => Array<string>(W).fill("#"));
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const regions = Array.isArray(L.regions) ? L.regions : [];
  if (!regions.length) errors.push("No regions: give at least one region rect.");
  const ids = new Set<string>();
  for (const r of regions) {
    const tag = `region "${r.id}"`;
    if (!r.id || ids.has(r.id)) errors.push(`region id "${r.id}" is missing or used twice — give each region its own id.`);
    ids.add(r.id);
    if (![r.x, r.y, r.w, r.h].every(int) || r.w < 1 || r.h < 3) { errors.push(`${tag}: x,y,w,h must be integers, w >= 1, h >= 3 (two wall-face rows + floor).`); continue; }
    if (r.x < 1 || r.y < 1 || r.x + r.w > W - 1 || r.y + r.h > H - 1) errors.push(`${tag} rect (${r.x},${r.y},${r.w}x${r.h}) leaves the solid border — keep regions inside x 1..${W - 2}, y 1..${H - 2}.`);
    if (!S.floors[r.floor]) errors.push(`${tag}: unknown floor id "${r.floor}" — use one of: ${Object.keys(S.floors).slice(0, 12).join(", ")}…`);
    if (!S.walls[r.wall]) errors.push(`${tag}: unknown wall id "${r.wall}" — use one of: ${Object.keys(S.walls).slice(0, 12).join(", ")}…`);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(x, y)) grid[y]![x] = ".";
  }
  const openings = Array.isArray(L.openings) ? L.openings : [];
  for (const o of openings) {
    const w = o.w ?? 1, h = o.h ?? 1;
    if (![o.x, o.y, w, h].every(int)) { errors.push(`opening ${JSON.stringify(o).slice(0, 80)}: x,y (and optional w,h) must be integers.`); continue; }
    for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) { if (inMap(x, y)) grid[y]![x] = "."; else errors.push(`opening cell (${x},${y}) is out of bounds.`); }
  }
  const ent = L.entrance;
  if (!ent || !int(ent.x) || !int(ent.y)) errors.push(`entrance {x,y} is missing — one cell on the bottom row y=${H - 1}.`);
  else if (ent.y !== H - 1) errors.push(`entrance (${ent.x},${ent.y}) must be on the bottom map row y=${H - 1}.`);
  else if (!inMap(ent.x, ent.y)) errors.push(`entrance (${ent.x},${ent.y}) is out of bounds.`);
  else { grid[ent.y]![ent.x] = "."; if (grid[ent.y - 1]?.[ent.x] !== ".") errors.push(`entrance (${ent.x},${ent.y}) must sit directly below a region cell (${ent.x},${ent.y - 1}).`); }
  for (let x = 0; x < W; x++) if (grid[H - 1]![x] === "." && !(ent && x === ent.x)) errors.push(`cell (${x},${H - 1}) on the bottom row is open but is not the entrance — end regions at y <= ${H - 2}.`);

  // 기물: 랜드마크 먼저, 모델이 쓴 순서대로(반복은 펼친다).
  const regionAt = (x: number, y: number) => regions.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)?.id;
  const objs: (LayoutObject & { region?: string; src: number })[] = [];
  // 랜드마크를 objects 에 또 적은 것(같은 id·자리, 반복 없음)은 하나로 친다 — 겹침으로 거절하지 않는다(2026-10-31 감독 지적).
  const lmSame = (o: LayoutObject) => !!L.landmark && o?.id === L.landmark.id && o.x === L.landmark.x && o.y === L.landmark.y && !((o.repeat?.count ?? 1) > 1);
  const srcList = [...(L.landmark ? [L.landmark] : []), ...(Array.isArray(L.objects) ? L.objects : []).filter((o) => !lmSame(o))];
  if (!L.landmark) errors.push(`landmark is missing — name the one big piece the place is built around: "landmark":{"id":"<object id>","x":X,"y":Y,"purpose":"..."}.`);
  srcList.forEach((o, i) => {
    if (opts.dropObjects?.has(i)) return;
    if (typeof o?.id !== "string" || !int(o.x) || !int(o.y)) { errors.push(`object ${JSON.stringify(o).slice(0, 80)}: needs id and integer x, y.`); badObjects.add(i); return; }
    const sized = SIZED.exec(o.id);
    if (!S.objects[o.id] && !(sized && S.tables[sized[1]!])) { errors.push(`unknown catalog id "${o.id}" at (${o.x},${o.y}) — use an exact id from the catalog.`); badObjects.add(i); return; }
    const n = Math.max(1, Math.min(40, Number(o.repeat?.count ?? 1) || 1)), dx = Number(o.repeat?.dx ?? 0) || 0, dy = Number(o.repeat?.dy ?? 0) || 0;
    for (let k = 0; k < n; k++) {
      const p = { id: o.id, x: o.x + k * dx, y: o.y + k * dy, purpose: o.purpose, src: i };
      const f = footprint(S, p.id);
      if (p.x < 0 || p.y < 0 || p.x + f.w > W || p.y + f.h > H) { errors.push(`"${p.id}" at (${p.x},${p.y}) (${f.w}x${f.h}) is out of bounds of the ${W}x${H} map.`); badObjects.add(i); continue; }
      objs.push({ ...p, region: regionAt(p.x, p.y) });
    }
  });
  const lines = (Array.isArray(L.carpets) ? L.carpets : []).flatMap((c) => {
    if (!S.lines[c.id] || S.lines[c.id]!.kind !== "flat") { errors.push(`unknown carpet id "${c.id}" — use one of: ${Object.keys(S.lines).filter((k) => S.lines[k]!.kind === "flat").join(", ")}.`); return []; }
    if (![c.x, c.y, c.w, c.h].every(int)) { errors.push(`carpet ${c.id}: x,y,w,h must be integers.`); return []; }
    return [{ id: c.id, rect: { x0: c.x, y0: c.y, x1: c.x + c.w - 1, y1: c.y + c.h - 1 } }];
  });
  const daises = (Array.isArray(L.daises) ? L.daises : []).flatMap((d) => {
    if (!S.daises[d.id]) { errors.push(`unknown dais id "${d.id}" — use one of: ${Object.keys(S.daises).join(", ")}.`); return []; }
    if (![d.x, d.y, d.w, d.h].every(int)) { errors.push(`dais ${d.id}: x,y,w,h must be integers.`); return []; }
    return [{ id: d.id, x: d.x, y: d.y, w: d.w, h: d.h }];
  });
  for (const r of regions) if (r.landmark && !objs.some((o) => o.id === r.landmark && o.region === r.id)) warnings.push(`region "${r.id}" names landmark "${r.landmark}" but no such object stands in it.`);
  if (errors.length) return out({ objects: objs, sources: srcList });

  const plan = grid.map((row) => row.join(""));
  const input: HandInteriorInput = {
    plan, floor: regions[0]!.floor, wall: regions[0]!.wall,
    zones: regions.map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1, floor: r.floor, wall: r.wall })),
    objects: objs.map(({ id, x, y }) => ({ id, x, y })), lines, daises, start: ent ? [{ x: ent.x, y: ent.y }] : undefined,
  };
  const built = buildHandInteriorLayers(input, tileset, S);
  const EN: Record<string, string> = {
    overlap: "two pieces overlap on this cell — move one of them",
    "not-on-floor": "this footprint cell is not walkable floor (solid, or a wall-face row: the two rows under any solid cell are wall face)",
    "hang-not-on-face": "an h (wall-mounted) piece must be on the UPPER wall-face row (the first row below a solid cell)",
    "wall-piece-needs-face": "a w (against-wall) piece must stand on the first floor row directly below a north wall face",
    "stairs-not-at-wall": "stairs up must stand on the first floor row directly below a north wall face",
    "table-one-row": "counter/kcounter can only be 1 row tall",
    "out-of-bounds": "the piece's art goes out of the map",
    "no-entrance": "the entrance cell is blocked or not walkable",
  };
  const hits = (x?: number, y?: number) => x === undefined || y === undefined ? [] : objs.filter((p) => { const f = footprint(S, p.id); return x >= p.x && x < p.x + f.w && y >= p.y && y < p.y + f.h; });
  for (const i of built.issues) {
    const at = i.x !== undefined ? ` at (${i.x},${i.y})` : "";
    const who = hits(i.x, i.y);
    const txt = `${EN[i.code] ?? i.code}${at}${who.length ? ` [${who.map((p) => `"${p.id}"@(${p.x},${p.y})`).join(", ")}]` : ""}`;
    if (i.severity === "error") { errors.push(txt); for (const p of who) badObjects.add(p.src); }
    else if (i.code === "unreachable-piece") { warnings.push(`a piece has no reachable free side${at}${who.length ? ` [${who.map((p) => `"${p.id}"@(${p.x},${p.y})`).join(", ")}]` : ""}`); }
    else if (i.code === "too-many-layers") warnings.push(`too many stacked pieces${at}`);
  }
  // 닿기: 문 틈·방·랜드마크는 입구에서 걸어 닿아야 한다(거절), 나머지 닿지 않는 바닥은 경고.
  const unreached = new Set(built.unreachedFloor.map((c) => `${c.x},${c.y}`));
  for (const o of openings) for (let y = o.y; y < o.y + (o.h ?? 1); y++) for (let x = o.x; x < o.x + (o.w ?? 1); x++) {
    // 세로 벽 3줄 틈은 위 두 칸이 벽면이라 맨 아래 칸만 통로다.
    if ((o.h ?? 1) >= 3 && y < o.y + (o.h ?? 1) - 1) continue;
    if (unreached.has(`${x},${y}`)) errors.push(`opening at (${x},${y}) is not reachable from the entrance — furniture blocks it, or it is not between two regions (a vertical-wall opening needs 3 cells, the bottom one is the passage).`);
  }
  for (const r of regions) {
    let floor = 0, reached = 0;
    for (let y = r.y + 2; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { floor++; if (!unreached.has(`${x},${y}`)) reached++; }
    if (floor > 0 && reached === 0) errors.push(`region "${r.id}" cannot be reached from the entrance — carve an opening into it (or move the furniture that closes it off).`);
  }
  const lm = objs.find((o) => o.src === 0 && L.landmark);
  if (lm && built.issues.some((i) => i.code === "unreachable-piece" && hits(i.x, i.y).some((p) => p.src === 0))) errors.push(`landmark "${lm.id}" at (${lm.x},${lm.y}) has no reachable free side — clear a cell next to it that connects to the entrance.`);
  const rest = built.unreachedFloor.length;
  if (rest) warnings.push(`${rest} floor cells are not reachable from the entrance (e.g. ${built.unreachedFloor.slice(0, 6).map((c) => `(${c.x},${c.y})`).join(" ")}).`);
  return { errors, warnings, badObjects, input, built, objects: objs, sources: srcList };
}

/** 거절 글: Rejected / You sent / Fixed call (영어). */
export function rejectionText(name: string, check: LayoutCheck, sent: unknown, left: number): string {
  const sentText = JSON.stringify(sent ?? {}).slice(0, 500);
  return [`Rejected: the interior layout for "${name}" cannot be laid as written (${check.errors.length} problem${check.errors.length === 1 ? "" : "s"}):`,
    ...check.errors.slice(0, 30).map((e) => `- ${e}`),
    ...(check.warnings.length ? ["Warnings (fix if you can):", ...check.warnings.slice(0, 8).map((w) => `- ${w}`)] : []),
    `You sent: ${sentText}${sentText.length >= 500 ? "…" : ""}`,
    `Fixed call: make_place again with the same name and the full corrected spec.layout — change only what the problems name (move or drop the listed pieces, close or extend the named walls, carve the missing doors). ${left > 0 ? `${left} repair${left === 1 ? "" : "s"} left; after that, pieces that still fail are left out and the rest is laid.` : "This was the last repair: next time the pieces that still fail are left out and the rest is laid."}`].join("\n");
}

/** 지은 뒤 남기는 선언(맵 위치 note) — 할 일 검사 layout_built 가 읽는다. 좌표는 지은 맵 좌표. */
export interface LayoutDecl {
  /** 방 상자(벽 우선 형식은 방 칸의 바깥 상자, cells = 방 칸 수). */
  readonly regions: readonly { id: string; x: number; y: number; w: number; h: number; cells?: number; purpose?: string; role?: string }[];
  readonly objects: readonly { id: string; x: number; y: number; w: number; h: number }[];
  readonly landmark?: { id: string; x: number; y: number; w: number; h: number };
  readonly entrance: { x: number; y: number };
  /** 자기 검토(review_layout) 바퀴 수 — 할 일 검사 layout_review 가 읽는다. */
  readonly reviews?: number;
  readonly reviewNotes?: readonly string[];
}
export const LAYOUT_TAG = "interior-layout";

export function layoutDecl(L: InteriorLayout, check: LayoutCheck, S: HandInteriorSpec): LayoutDecl {
  const fp = (o: { id: string; x: number; y: number }) => ({ id: o.id, x: o.x, y: o.y, ...footprint(S, o.id) });
  const lm = L.landmark && check.objects.find((o) => o.id === L.landmark!.id && o.x === L.landmark!.x && o.y === L.landmark!.y);
  if (check.rooms) return {
    regions: check.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, cells: r.cells, ...(r.purpose ? { purpose: r.purpose } : {}), ...(r.role ? { role: r.role } : {}) })),
    objects: check.objects.map(fp),
    ...(lm ? { landmark: fp(lm) } : {}),
    entrance: L.entrance,
  };
  return {
    regions: (L.regions ?? []).map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, ...(r.purpose ? { purpose: String(r.purpose).slice(0, 60) } : {}), ...(r.role ? { role: String(r.role) } : {}) })),
    objects: check.objects.map(fp),
    ...(lm ? { landmark: fp(lm) } : {}),
    entrance: L.entrance,
  };
}

/** 칸 배치 고침(자기 검토·고치기): 기물 빼기/더하기, 벽에 붙인 기물 빼기/더하기, 칸 통째 바꾸기. 함수는 고른 것 없이 그대로 적용하고 검증은 짓기가 한다. */
export interface LayoutPatch {
  readonly remove_objects?: readonly { id: string; x: number; y: number }[];
  readonly add_objects?: readonly LayoutObject[];
  readonly remove_wall_items?: readonly { id: string; x: number; y: number }[];
  readonly add_wall_items?: readonly (LayoutObject & { wall?: string })[];
  readonly replace?: Readonly<Record<string, unknown>>;
}
const REPLACEABLE = new Set(["map", "landmark", "outer_wall", "walls", "doors", "entrance", "rooms", "wall_items", "objects", "carpets", "rails", "regions", "openings", "daises"]);
export function layoutPatchIsEmpty(p: LayoutPatch | undefined): boolean {
  if (!p) return true;
  const real = (v: unknown) => Array.isArray(v) ? v.some((o) => o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string" && (o as { id: string }).id !== "") : false;
  const rep = Object.entries(p.replace ?? {}).filter(([k, v]) => REPLACEABLE.has(k) && v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length));
  return !real(p.remove_objects) && !real(p.add_objects) && !real(p.remove_wall_items) && !real(p.add_wall_items) && !rep.length;
}
export function applyLayoutPatch(L: InteriorLayout, p: LayoutPatch): { layout: InteriorLayout; errors: string[] } {
  const errors: string[] = [];
  const out: Record<string, unknown> = structuredClone(L) as unknown as Record<string, unknown>;
  const take = (key: "objects" | "wall_items", rm: readonly { id: string; x: number; y: number }[] | undefined, add: readonly LayoutObject[] | undefined) => {
    const list = [...((out[key] as LayoutObject[] | undefined) ?? [])];
    for (const r of rm ?? []) {
      if (!r || typeof r.id !== "string" || r.id === "") continue;
      const i = list.findIndex((o) => o.id === r.id && o.x === r.x && o.y === r.y);
      if (i >= 0) list.splice(i, 1);
      else if (key === "objects" && L.landmark && L.landmark.id === r.id && L.landmark.x === r.x && L.landmark.y === r.y) errors.push(`remove_objects: "${r.id}" at (${r.x},${r.y}) is the landmark — move it with replace.landmark instead.`);
      else errors.push(`remove_${key}: no entry "${r.id}" at (${r.x},${r.y}) in "${key}" — use the exact id and x,y of an entry in the current layout.`);
    }
    for (const a of add ?? []) if (a && typeof a.id === "string" && a.id !== "") list.push(a);
    out[key] = list;
  };
  take("objects", p.remove_objects, p.add_objects);
  if (p.remove_wall_items?.length || p.add_wall_items?.length) take("wall_items", p.remove_wall_items, p.add_wall_items);
  for (const [k, v] of Object.entries(p.replace ?? {})) {
    if (v === null || v === undefined || (Array.isArray(v) && !v.length && k !== "walls" && k !== "doors" && k !== "carpets")) continue;
    if (typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) continue;
    if (REPLACEABLE.has(k)) out[k] = v; else errors.push(`replace: unknown field "${k}".`);
  }
  return { layout: out as unknown as InteriorLayout, errors };
}

