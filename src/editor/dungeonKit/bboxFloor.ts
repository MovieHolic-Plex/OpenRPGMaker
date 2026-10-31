// 모델이 칸 단위로 쓴 던전 한 층(bbox 배치, 2026-10-31 조수 v2) — 검사하고 그대로 깐다. 함수는 고르지도 더하지도 옮기지도 않는다.
// 실험 scripts/experiments/bbox-dungeon/lay.mts(브랜치 agent/bbox-dungeon, Opus 판정 참고 던전 대비 19승 10무 1패)를 제품 경로로 옮겼다.
//   - 방(사각형 여럿의 합)·통로(꺾이는 점 목록, 폭 1~3)·문·위험(물·용암·구덩이)·다리 → 열린 칸 격자. 벽·천장·바닥·액체 그림은 열린 칸에서 끌어낸다(composeExactFloor).
//   - 조각(칩셋 메타에서 뽑은 영어 목록)을 적힌 x,y 에 찍는다 — 벽걸이는 벽 앞면에만, 바닥 조각은 걷는 바닥에만, 겹침 금지.
//   - 검사: 입구 계단에서 걸어서 모든 방·통로·상자·내려가는 계단 닿음, 보스 방은 앞방을 거쳐야만, 통로 양끝 문, 맞닿는 곳 문.
// 모델이 받는 글(오류·목록·형식)은 모두 영어다. 오류 글은 칸 좌표와 고치는 법을 함께 적는다.
import type { StructureKitDef, TilesetDef, GameMap } from "@/project/types";
import { checkGroundSupportForStamp, kitSupportKind } from "@/project/groundSupport";
import { composeExactFloor } from "./beodeul/compose";
import { Grid } from "./grid";
import type { DungeonType, PlacedRoom } from "./types";

export const BBOX_DUNGEON_THEMES = ["catacomb", "castle", "temple"] as const;
export type BboxDungeonTheme = typeof BBOX_DUNGEON_THEMES[number];
export const BBOX_PURPOSES = ["entrance", "guard", "puzzle", "treasure", "antechamber", "boss", "other"] as const;

export interface BboxRect { x: number; y: number; w: number; h: number }
export interface BboxPut { id: string; x: number; y: number; repeat?: { count?: number; dx?: number; dy?: number }; room?: string; purpose?: string }
/** 모델이 쓰는 층 배치(영어 형식 BBOX_DUNGEON_FORMAT). */
export interface BboxDungeonLayout {
  name?: string;
  theme?: string;
  map?: { w?: number; h?: number };
  rooms?: { id: string; purpose: string; rects?: BboxRect[]; shape?: BboxRoomShape; x?: number; y?: number; w?: number; h?: number; landmark?: BboxPut; note?: string }[];
  corridors?: { id: string; from: string; to: string; width?: number; path: [number, number][] }[];
  doors?: { x: number; y: number; connects: [string, string]; locked?: boolean }[];
  hazards?: { kind: "water" | "lava" | "pit"; x: number; y: number; w?: number; h?: number }[];
  bridges?: BboxRect[];
  objects?: BboxPut[];
  traps?: BboxPut[];
  chests?: { x: number; y: number }[];
  enemies?: { x: number; y: number }[];
  boss?: { x: number; y: number };
}

/**
 * 방 모양(확장 자리): 지금은 rects(사각 합집합)만. 다각형·타원·동굴 덩이 같은 새 모양은 BBOX_ROOM_SHAPES 에 칸 목록 함수 하나를 더하면
 * 검사(겹침·문·이어짐·보스 앞방)와 그리기(exact compose)가 그대로 받는다 — 모두 칸 집합만 본다.
 */
export interface BboxRoomShape { readonly kind: string; readonly [extra: string]: unknown }
export type BboxRoomShapeCells = (room: NonNullable<BboxDungeonLayout["rooms"]>[number], W: number, H: number) => { cells: [number, number][]; errors: string[] };
export const BBOX_ROOM_SHAPES: Record<string, BboxRoomShapeCells> = {
  rects: (r) => {
    const cells: [number, number][] = [], errors: string[] = [];
    const rects = Array.isArray(r.rects) && r.rects.length ? r.rects : [r as BboxRect];
    for (const q of rects) {
      if (![q?.x, q?.y, q?.w, q?.h].every((v) => typeof v === "number" && Number.isInteger(v)) || q.w < 1 || q.h < 1) { errors.push("every rect needs integer x,y,w,h >= 1."); continue; }
      for (let y = q.y; y < q.y + q.h; y += 1) for (let x = q.x; x < q.x + q.w; x += 1) cells.push([x, y]);
    }
    return { cells, errors };
  },
};
/** 방마다 더 거는 검사(확장 자리: 빈 바닥 넓이·깔개 수 같은 것). 칸 집합과 놓인 조각을 받아 영어 문제 글을 돌려준다. */
export type BboxRoomCheck = (room: { id: string; purpose: string; cells: ReadonlySet<number>; W: number; H: number }) => string[];
export const BBOX_ROOM_CHECKS: BboxRoomCheck[] = [];
/** 방 채움: 걸을 수 있는 칸 이만큼마다 조각 하나(최소 2). */
export const BBOX_CELLS_PER_PIECE = 24;

export type BboxPlacement = "wall" | "floor" | "decal";
export interface BboxPiece { readonly name: string; readonly kitId: string; readonly w: number; readonly h: number; readonly place: BboxPlacement; readonly family: string }

// ── 조각 목록: 칩셋 메타(structureKits 의 ai.role·ai.themes·크기·받침 종류)에서 뽑는다 ─────────────────────────────
// 던전 테마 조각(ai.themes 에 dungeon) 가운데 바닥에 서거나 벽에 거는 물건(role prop) + 바닥 무늬(메달리온·석관 뚜껑·모래 함정·바닥 창살).
// 바깥 풍경 묶음(난파선 암초·등대 곶·마법사 탑 정원), 레일 조각, 7칸 넘는 큰 조각은 뺀다. 같은 묶음 안 변형(-a/-b/-2…)은 첫 것만.
const OUTDOOR_FAMILY = /^(shipwreck-reef|headland-lighthouse|wizard-tower)$/;
const DECAL_SLUG = /medallion|tomb-slab|sand-pit|grate-floor|cracked-floor|tower-rune/;
const SKIP_SLUG = /^(rails-|boardwalk|lily-pads|mangrove|swamp-moss|snow-drift|sand-drift|bramble|giant-tree|portcullis|door-open|lever-down|portal-gate-open|ore-vein-[a-z]+-1|stairs)/;
const familyOf = (id: string): { family: string; slug: string } => {
  const m = /^bd-pick-(aqueduct-sewer|castle-catacombs|sea-cave|temple-ruins|volcano-cave|dungeon-theme2|dungeon-theme|dungeon-cave|shipwreck-reef|headland-lighthouse|wizard-tower)-(.+)$/.exec(id);
  if (m) return { family: m[1]!, slug: m[2]! };
  const d = /^bd-dg-(.+)$/.exec(id);
  return d ? { family: "dg", slug: d[1]! } : { family: "", slug: id };
};
const baseSlug = (slug: string) => slug.replace(/-(?:[a-c]|\d{1,2})$/u, "");
const hasUpper = (k: StructureKitDef) => k.rows.some((r) => (r.upperTiles ?? []).some((t) => t >= 0));
const isDungeon = (k: StructureKitDef) => (k.ai?.themes ?? []).some((t) => t === "dungeon" || t === "던전");

const catalogCache = new WeakMap<TilesetDef, BboxPiece[]>();
/** 칩셋 메타에서 영어 조각 목록을 만든다(타일셋마다 한 번). 입구 계단 «stairs up»·«stairs down» 은 이름이 정해져 있다. */
export function bboxDungeonCatalog(ts: TilesetDef): BboxPiece[] {
  const hit = catalogCache.get(ts);
  if (hit) return hit;
  const kits = (ts.structureKits ?? []) as StructureKitDef[];
  const out: BboxPiece[] = [];
  const taken = new Set<string>();
  const add = (name: string, k: StructureKitDef, place: BboxPlacement, family: string) => { if (taken.has(name)) return; taken.add(name); out.push({ name, kitId: k.id, w: k.width, h: k.height, place, family }); };
  const up = kits.find((k) => /stairs-up-face$/.test(k.id)), down = kits.find((k) => /ruins-stairs-down$/.test(k.id));
  if (up) add("stairs up", up, "wall", "stairs");
  if (down) add("stairs down", down, "decal", "stairs");
  const seenBase = new Set<string>();
  for (const k of kits) {
    if (!isDungeon(k) || k.width > 7 || k.height > 7) continue;
    const { family, slug } = familyOf(k.id);
    if (!family || OUTDOOR_FAMILY.test(family) || SKIP_SLUG.test(slug)) continue;
    const role = String(k.ai?.role ?? "");
    let place: BboxPlacement;
    if (role === "prop") {
      const sk = kitSupportKind(k);
      place = sk === "mount" || sk === "door" ? "wall" : hasUpper(k) ? "floor" : "decal";
    } else if ((role === "terrain" || role === "floor") && DECAL_SLUG.test(slug)) place = "decal";
    else continue;
    const base = `${family}|${baseSlug(slug)}`;
    if (seenBase.has(base) && !/medallion/.test(slug)) continue;
    seenBase.add(base);
    const short = family === "dg" ? "" : family.split("-").pop()!;
    const plain = slug.replace(/-/g, " ");
    const name = taken.has(plain) ? `${short} ${plain}` : plain;
    add(name, k, place, family);
  }
  catalogCache.set(ts, out);
  return out;
}

const RULE: Record<BboxPlacement, string> = {
  wall: "wall-mounted: hangs on the north wall face of an open area (the 3 solid rows right above its top floor row); a 2-tall piece covers the 2 face rows just above the floor, a 1-tall piece sits on the face row 2 above the floor",
  floor: "floor: stands on walkable floor and blocks walking; art taller than 1 row may overlap the wall face above",
  decal: "floor decal: walkable, drawn on the floor (not on water/lava/pit)",
};

/** 모델이 읽는 조각 목록 글(영어). sheet 가 있으면 그림 속 자리를 같이 적는다. */
export function bboxDungeonCatalogText(cat: readonly BboxPiece[], sheet?: ReadonlyMap<string, { x: number; y: number }>): string {
  const L = ["# Piece catalog (beodeul dungeon chipset, 16px cells) — use these exact ids. Generated from the chipset's kit metadata.",
    "id | w x h cells | placement" + (sheet ? " | where it is drawn on the attached piece sheet (top-left cell)" : "")];
  for (const p of cat) { const at = sheet?.get(p.name); L.push(`${p.name} | ${p.w}x${p.h} | ${p.place === "wall" ? "wall-mounted" : p.place}${at ? ` | sheet (${at.x},${at.y})` : ""}`); }
  L.push("", "Placement rules:", ...Object.entries(RULE).map(([k, v]) => `- ${k === "wall" ? "wall-mounted" : k}: ${v.split(": ").slice(1).join(": ")}`));
  return L.join("\n");
}

/** 모델에게 주는 형식(영어). */
export const BBOX_DUNGEON_FORMAT = `{"name": "...", "theme": "catacomb|castle|temple",
 "map": {"w": W, "h": H},
 "rooms": [{"id": "...", "purpose": "entrance|guard|puzzle|treasure|antechamber|boss|other", "rects": [{"x": X, "y": Y, "w": W, "h": H}], "landmark": {"id": "<piece id>", "x": X, "y": Y}, "note": "..."}],
 "corridors": [{"id": "...", "from": "<room id>", "to": "<room id>", "width": 1, "path": [[X, Y], [X, Y]]}],
 "doors": [{"x": X, "y": Y, "connects": ["<id>", "<id>"], "locked": false}],
 "hazards": [{"kind": "water|lava|pit", "x": X, "y": Y, "w": W, "h": H}],
 "bridges": [{"x": X, "y": Y, "w": W, "h": H}],
 "objects": [{"id": "<piece id>", "x": X, "y": Y, "repeat": {"count": 3, "dx": 2, "dy": 0}}],
 "traps": [{"id": "<trap piece id>", "x": X, "y": Y}],
 "chests": [{"x": X, "y": Y}],
 "enemies": [{"x": X, "y": Y}],
 "boss": {"x": X, "y": Y}}`;

export const BBOX_DUNGEON_RULES: readonly string[] = [
  "Grid: 16px cells, x to the right, y down, origin top-left. Map w 16..80, h 16..70. Every cell outside rooms and corridors is solid rock. Wall art comes from the open cells: the 3 solid rows directly above any open cell are its north wall face; other solid cells are dark ceiling.",
  "Keep at least 4 solid rows between an open area and any open cell above it in the same column (3 wall-face rows + 1 ceiling row). Side by side, 1 solid column is enough. Open areas lie in x 1..w-2, y 4..h-2.",
  "Rooms: one or more rects each (a union of rects may form an L, T, cross or irregular shape). Rooms do not overlap or touch other rooms/corridors except at a door. Exactly one entrance, one antechamber and one boss room; at least one guard, puzzle and treasure room.",
  "Corridors: waypoints [[x,y],...]; consecutive waypoints share a row or column (add corner waypoints). Width 1..3 widens each path cell to a width x width square going right/down. A corridor may enter its own from/to rooms, never other rooms.",
  "Doors: every corridor needs a door at each end, and every place where two rooms/corridors touch needs a door {x,y,connects:[idA,idB],locked} on the open cell where they meet. A locked door is drawn as iron bars.",
  "Hazards: water, lava or pit rects inside rooms/corridors (not walkable). Bridges: rects over hazard cells (walkable). Leave a walkable path to every room.",
  "Entrance: exactly one \"stairs up\" piece on the entrance room's north wall face (its 2 cells are the 2 wall rows just above the room's top floor row; the floor cell right below it is where the player arrives).",
  "Boss gating: every walking route from the entrance into the boss room passes through the antechamber. boss {x,y} = where the boss stands, a walkable cell in the boss room. enemies = cells where visible enemies stand (outside the boss room) — a dungeon floor has enemies: at least max(2, rooms - 3) of them, spread over the rooms on the way (guard rooms first).",
  "Pieces: x,y = top-left cell of the piece. Every room has one landmark piece. Floor pieces need walkable floor under their bottom row and must not overlap other pieces; wall-mounted pieces only on wall face. Pieces with solid bases block walking — keep paths open. Chests {x,y} on walkable floor, reachable.",
  "Shape the walk: rooms of different sizes and shapes, a route with choices — at least one loop (a second route between two rooms) or two side branches, never a single line of rooms — hazards that shape the path, and a clear climax at the boss.",
  "Furnish every room: at least one piece per 24 walkable cells (min 2, the landmark counts) whose base (or, for a wall piece, the cell below it) is in that room — pieces that show what the room is for. A big empty room is rejected; make it smaller or fill it.",
];

// ── 검사 + 깔기 ────────────────────────────────────────────────────────────────────────────────────────────────
export interface BboxDungeonOut {
  readonly W: number; readonly H: number; readonly type: DungeonType;
  readonly lower: number[]; readonly upper: number[];
  readonly rooms: { id: string; purpose: string; kind: string; x: number; y: number; w: number; h: number; cells: number[] }[];
  readonly corridors: { id: string; cells: number[] }[];
  readonly stairsUp: { x: number; y: number; front: { x: number; y: number } };
  readonly stairsDown: { x: number; y: number }[];
  readonly locked: { x: number; y: number }[];
  readonly chests: { x: number; y: number }[];
  readonly enemies: { x: number; y: number }[];
  readonly boss?: { x: number; y: number };
  readonly stamped: { name: string; kitId: string; x: number; y: number; w: number; h: number; place: BboxPlacement }[];
  readonly stats: Record<string, number | string>;
}
export interface BboxDungeonResult { readonly ok: boolean; readonly errors: string[]; readonly warnings: string[]; readonly out?: BboxDungeonOut }

const KIND: Record<string, string> = { entrance: "entrance", boss: "boss", treasure: "vault", guard: "hall", puzzle: "shrine", antechamber: "hall", other: "hall" };

/** 배치를 검사하고, 오류가 없으면 그림(lower/upper)까지 만든다. 함수는 아무것도 더하거나 옮기지 않는다. */
export function layBboxDungeon(ts: TilesetDef, L: BboxDungeonLayout): BboxDungeonResult {
  const errors: string[] = [], warnings: string[] = [];
  const fail = (): BboxDungeonResult => ({ ok: false, errors: [...new Set(errors)], warnings });
  const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
  const W = L?.map?.w, H = L?.map?.h;
  if (!num(W) || !num(H) || W < 16 || H < 16 || W > 80 || H > 70) { errors.push(`map.w/map.h must be integers, w 16..80, h 16..70 (got ${W}x${H}).`); return fail(); }
  const theme = String(L.theme ?? "");
  if (!(BBOX_DUNGEON_THEMES as readonly string[]).includes(theme)) errors.push(`theme must be one of ${BBOX_DUNGEON_THEMES.join(", ")} (got "${theme}").`);
  const cat = bboxDungeonCatalog(ts);
  const byName = new Map(cat.map((p) => [p.name, p] as const));
  const byKit = new Map(cat.map((p) => [p.kitId, p] as const));
  const piece = (id: unknown) => typeof id === "string" ? byName.get(id.trim().toLowerCase().replace(/[-_]+/g, " ")) ?? byName.get(id) ?? byKit.get(id) : undefined;
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const P = (x: number, y: number) => `(${x},${y})`;

  type Region = { id: string; kind: "room" | "corridor"; purpose?: string; cells: Set<number> };
  const regions = new Map<string, Region>();
  const owner = new Int32Array(W * H).fill(-1);
  const regionList: Region[] = [];
  const addRegion = (r: Region) => { if (regions.has(r.id)) errors.push(`duplicate id "${r.id}" — room and corridor ids must be unique.`); regions.set(r.id, r); regionList.push(r); };
  const rooms = Array.isArray(L.rooms) ? L.rooms : [];
  for (const r of rooms) {
    const tag = `room "${r?.id}"`;
    if (typeof r?.id !== "string") { errors.push("a room has no string id."); continue; }
    if (!(BBOX_PURPOSES as readonly string[]).includes(r.purpose)) errors.push(`${tag}: purpose must be one of ${BBOX_PURPOSES.join(", ")} (got "${r.purpose}").`);
    const reg: Region = { id: r.id, kind: "room", purpose: r.purpose, cells: new Set() };
    addRegion(reg);
    const shapeKind = r.shape?.kind ?? "rects";
    const shapeFn = BBOX_ROOM_SHAPES[shapeKind];
    if (!shapeFn) { errors.push(`${tag}: room shape kind "${shapeKind}" is not supported (supported: ${Object.keys(BBOX_ROOM_SHAPES).join(", ")}).`); continue; }
    const shaped = shapeFn(r, W, H);
    for (const e of shaped.errors) errors.push(`${tag}: ${e}`);
    let outside = false;
    for (const [x, y] of shaped.cells) {
      if (x < 1 || x > W - 2 || y < 4 || y > H - 2) { outside = true; continue; }
      const o = owner[idx(x, y)]!;
      if (o >= 0 && regionList[o] !== reg) { errors.push(`${tag} overlaps ${regionList[o]!.kind} "${regionList[o]!.id}" at ${P(x, y)} — rooms must not overlap; leave solid cells between them and connect with a door or corridor.`); continue; }
      owner[idx(x, y)] = regionList.indexOf(reg); reg.cells.add(idx(x, y));
    }
    if (outside) errors.push(`${tag} must lie inside x 1..${W - 2}, y 4..${H - 2} (the 3 rows above every open area are its wall face, and a solid border stays).`);
    for (const check of BBOX_ROOM_CHECKS) for (const e of check({ id: r.id, purpose: r.purpose, cells: reg.cells, W, H })) errors.push(`${tag}: ${e}`);
  }
  const byPurpose = (p: string) => rooms.filter((r) => r?.purpose === p);
  for (const p of ["entrance", "antechamber", "boss"]) if (byPurpose(p).length !== 1) errors.push(`need exactly one room with purpose "${p}" (got ${byPurpose(p).length}).`);
  for (const p of ["guard", "puzzle", "treasure"]) if (!byPurpose(p).length) errors.push(`need at least one room with purpose "${p}".`);
  const corridors = Array.isArray(L.corridors) ? L.corridors : [];
  for (const c of corridors) {
    const tag = `corridor "${c?.id}"`;
    if (typeof c?.id !== "string") { errors.push("a corridor has no string id."); continue; }
    const w = c.width ?? 1;
    if (!num(w) || w < 1 || w > 3) errors.push(`${tag}: width must be 1, 2 or 3.`);
    const path = Array.isArray(c.path) ? c.path : [];
    if (path.length < 2) { errors.push(`${tag}: path needs at least 2 waypoints [[x,y],...].`); continue; }
    const reg: Region = { id: c.id, kind: "corridor", cells: new Set() };
    addRegion(reg);
    for (const id of [c.from, c.to]) if (!rooms.some((r) => r?.id === id)) errors.push(`${tag}: from/to "${id}" is not a room id.`);
    for (let k = 1; k < path.length; k += 1) {
      const [x0, y0] = path[k - 1] ?? [], [x1, y1] = path[k] ?? [];
      if (![x0, y0, x1, y1].every(num)) { errors.push(`${tag}: waypoints must be integer pairs [x,y].`); break; }
      if (x0 !== x1 && y0 !== y1) { errors.push(`${tag}: waypoints ${P(x0!, y0!)} -> ${P(x1!, y1!)} are not on one row or column; add a corner waypoint.`); continue; }
      const n = Math.max(Math.abs(x1! - x0!), Math.abs(y1! - y0!));
      for (let s = 0; s <= n; s += 1) {
        const x = x0! + Math.sign(x1! - x0!) * s, y = y0! + Math.sign(y1! - y0!) * s;
        for (let dy = 0; dy < (num(w) ? w : 1); dy += 1) for (let dx = 0; dx < (num(w) ? w : 1); dx += 1) {
          const X = x + dx, Y = y + dy;
          if (X < 1 || Y < 1 || X > W - 2 || Y > H - 2) { errors.push(`${tag}: cell ${P(X, Y)} leaves the map interior.`); continue; }
          const o = owner[idx(X, Y)]!;
          if (o >= 0) { const other = regionList[o]!; if (other.kind === "room" && other.id !== c.from && other.id !== c.to) errors.push(`${tag} runs through room "${other.id}" at ${P(X, Y)} — route around it (only its from/to rooms may be entered).`); continue; }
          owner[idx(X, Y)] = regionList.indexOf(reg); reg.cells.add(idx(X, Y));
        }
      }
    }
  }
  const doors = Array.isArray(L.doors) ? L.doors : [];
  const near = (reg: Region | undefined, x: number, y: number) => !!reg && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(x + dx!, y + dy!) && reg.cells.has(idx(x + dx!, y + dy!)));
  for (const d of doors) {
    const [a, b] = Array.isArray(d?.connects) ? d.connects : [];
    if (!num(d?.x) || !num(d?.y) || !regions.has(a!) || !regions.has(b!)) { errors.push(`door ${JSON.stringify(d).slice(0, 80)}: needs integer x,y and connects:[idA,idB] of existing rooms/corridors.`); continue; }
    if (!inb(d.x, d.y) || owner[idx(d.x, d.y)]! < 0) errors.push(`door ${P(d.x, d.y)} is on a solid cell — a door is an open cell where ${a} and ${b} meet.`);
    else if (!near(regions.get(a!), d.x, d.y) || !near(regions.get(b!), d.x, d.y)) errors.push(`door ${P(d.x, d.y)} does not touch both "${a}" and "${b}" — put it on the cell where they meet.`);
  }
  const hasDoor = (a: string, b: string, x?: number, y?: number) => doors.some((d) => Array.isArray(d?.connects) && d.connects.includes(a) && d.connects.includes(b) && (x === undefined || Math.abs(d.x - x) + Math.abs(d.y - y!) <= 4));
  for (const c of corridors) for (const end of [c?.from, c?.to]) if (typeof c?.id === "string" && regions.has(end) && !hasDoor(c.id, end)) errors.push(`corridor "${c.id}" has no door into room "${end}" — add a door {x,y,connects:["${c.id}","${end}"]} where they meet.`);
  const touched = new Set<string>();
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const o = owner[idx(x, y)]!; if (o < 0) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      if (!inb(x + dx, y + dy)) continue;
      const o2 = owner[idx(x + dx, y + dy)]!;
      if (o2 < 0 || o2 === o) continue;
      const a = regionList[o]!.id, b = regionList[o2]!.id, key = [a, b].sort().join("|");
      if (touched.has(key)) continue;
      if (!hasDoor(a, b, x, y)) { touched.add(key); errors.push(`"${a}" and "${b}" touch at ${P(x, y)}-${P(x + dx, y + dy)} with no door there — leave a solid cell between them or add a door at the meeting cell.`); }
    }
  }
  const liqKind = new Uint8Array(W * H), bridge = new Uint8Array(W * H);
  const HZ: Record<string, number> = { water: 1, lava: 2, pit: 3 };
  for (const h of Array.isArray(L.hazards) ? L.hazards : []) {
    if (!HZ[h?.kind] || ![h.x, h.y, h.w ?? 1, h.h ?? 1].every(num)) { errors.push(`hazard ${JSON.stringify(h).slice(0, 80)}: kind water|lava|pit with integer x,y,w,h.`); continue; }
    for (let y = h.y; y < h.y + (h.h ?? 1); y += 1) for (let x = h.x; x < h.x + (h.w ?? 1); x += 1) {
      if (!inb(x, y) || owner[idx(x, y)]! < 0) { errors.push(`hazard ${h.kind} cell ${P(x, y)} is not inside a room or corridor.`); continue; }
      liqKind[idx(x, y)] = HZ[h.kind]!;
    }
  }
  for (const b of Array.isArray(L.bridges) ? L.bridges : []) {
    if (![b?.x, b?.y, b?.w ?? 1, b?.h ?? 1].every(num)) { errors.push(`bridge ${JSON.stringify(b).slice(0, 60)}: integer x,y,w,h.`); continue; }
    for (let y = b.y; y < b.y + (b.h ?? 1); y += 1) for (let x = b.x; x < b.x + (b.w ?? 1); x += 1) {
      if (!inb(x, y) || !liqKind[idx(x, y)]) { errors.push(`bridge cell ${P(x, y)} is not over a hazard cell (bridges only cross water/lava/pit).`); continue; }
      bridge[idx(x, y)] = 1;
    }
  }
  type Put = { name: string; x: number; y: number; room?: string };
  const puts: Put[] = [];
  const expand = (o: BboxPut, room?: string): Put[] => { const n = Math.min(24, Math.max(1, Number(o.repeat?.count ?? 1) || 1)), dx = Number(o.repeat?.dx ?? 0) || 0, dy = Number(o.repeat?.dy ?? 0) || 0; return Array.from({ length: n }, (_, i) => ({ name: String(o.id), x: o.x + i * dx, y: o.y + i * dy, ...(room ?? o.room ? { room: room ?? o.room } : {}) })); };
  for (const r of rooms) {
    if (typeof r?.id !== "string") continue;
    if (!r.landmark) { errors.push(`room "${r.id}" has no landmark — give each room one memorable piece {id,x,y}.`); continue; }
    puts.push(...expand(r.landmark, r.id));
  }
  for (const o of [...(Array.isArray(L.objects) ? L.objects : []), ...(Array.isArray(L.traps) ? L.traps : [])]) if (o) puts.push(...expand(o));
  for (const p of puts) if (!piece(p.name) || !num(p.x) || !num(p.y)) errors.push(`piece ${JSON.stringify(p).slice(0, 80)}: unknown catalog id or non-integer x,y — use an exact id from the catalog.`);
  const chests = (Array.isArray(L.chests) ? L.chests : []).filter(Boolean);
  const ups = puts.filter((p) => piece(p.name)?.name === "stairs up");
  if (ups.length !== 1) errors.push(`need exactly one "stairs up" (the entrance stairs, on the entrance room's north wall face) — got ${ups.length}.`);
  if (errors.length) return fail();

  // ── 그림: 열린 칸 → 벽·천장·바닥·액체 ──
  const g = new Grid(W, H);
  const roomRegions = regionList.filter((r) => r.kind === "room");
  const order = [...roomRegions].sort((a, b) => (a.purpose === "entrance" ? -1 : b.purpose === "entrance" ? 1 : 0));
  for (let i = 0; i < W * H; i += 1) {
    const o = owner[i]!; if (o < 0) continue;
    g.floor[i] = 1;
    const reg = regionList[o]!;
    g.roomAt[i] = reg.kind === "room" ? order.indexOf(reg) : -1;
    if (liqKind[i] && !bridge[i]) g.liquid[i] = 1;
    if (bridge[i]) g.bridge[i] = 1;
  }
  const box = (r: Region) => { const xs = [...r.cells].map((c) => c % W), ys = [...r.cells].map((c) => (c / W) | 0); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 }; };
  const placedRooms: PlacedRoom[] = order.map((r) => ({ id: r.id, kind: (KIND[r.purpose ?? "other"] ?? "hall") as PlacedRoom["kind"], ...box(r), from: null, dir: null, depth: 0 } as unknown as PlacedRoom));
  let comp: { lower: number[]; upper: number[]; wallB: Int8Array };
  try {
    comp = composeExactFloor(ts, theme as DungeonType, { rooms: placedRooms, corridors: [], width: W, height: H, notes: [], grid: g, thin: true }, liqKind);
  } catch (e) {
    const m = String((e as Error).message ?? e);
    const cells = m.match(/\(\d+,\d+\)/gu)?.slice(0, 6).join(" ") ?? "";
    if (/stranded-wall|벽 앞면 위에 천장/u.test(m)) errors.push(`wall too thin above open cells ${cells}: an open cell has another open cell 1-3 rows above it in the same column. Keep at least 4 solid rows between an open area and any open cell above it (3 become its wall face, 1 stays ceiling), or join them into one open area.`);
    else errors.push(`painter failed: ${m.slice(0, 300)}`);
    return fail();
  }
  const { lower, upper, wallB } = comp;
  const kits = new Map((ts.structureKits ?? []).map((k) => [k.id, k as StructureKitDef] as const));
  const isOpen = (x: number, y: number) => inb(x, y) && owner[idx(x, y)]! >= 0;
  const isWalkFloor = (x: number, y: number) => isOpen(x, y) && (!liqKind[idx(x, y)] || bridge[idx(x, y)] === 1);
  const isFace = (x: number, y: number) => inb(x, y) && wallB[idx(x, y)]! >= 0;
  const pseudo = { id: "bbox", name: "bbox", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
  const occupied = new Map<number, string>();
  const stamped: BboxDungeonOut["stamped"] = [];
  let stairsFront: { x: number; y: number } | null = null, stairsAt: { x: number; y: number } | null = null;
  const stairsDownAt: { x: number; y: number }[] = [];
  for (const p of puts) {
    const pc = piece(p.name)!;
    const def = kits.get(pc.kitId);
    if (!def) { errors.push(`piece "${p.name}" is missing from this tileset.`); continue; }
    const cls = pc.place;
    const at = `"${pc.name}" at ${P(p.x, p.y)} (${def.width}x${def.height}, ${cls === "wall" ? "wall-mounted" : cls})`;
    if (p.x < 0 || p.y < 0 || p.x + def.width > W || p.y + def.height > H) { errors.push(`${at} is out of the map.`); continue; }
    let bad = "";
    for (let dy = 0; dy < def.height && !bad; dy += 1) for (let dx = 0; dx < def.width && !bad; dx += 1) {
      const X = p.x + dx, Y = p.y + dy, bottom = dy === def.height - 1;
      const lo = def.rows[dy]?.tiles[dx] ?? -1, up = def.rows[dy]?.upperTiles?.[dx] ?? -1;
      if (lo < 0 && up < 0) continue;
      if (cls === "wall") { if (!isFace(X, Y)) bad = `cell ${P(X, Y)} is not wall face (wall-mounted pieces hang on the 3 solid rows right above an open area's top floor row; for a 2-tall piece use the two rows just above the floor)`; else if (bottom && !(isFace(X, Y + 1) || isWalkFloor(X, Y + 1))) bad = `bottom cell ${P(X, Y)} must have wall face or floor below it`; }
      else if (cls === "decal") { if (!isWalkFloor(X, Y)) bad = `cell ${P(X, Y)} is not walkable floor`; }
      else if (bottom ? !isWalkFloor(X, Y) : !(isWalkFloor(X, Y) || isFace(X, Y))) bad = bottom ? `base cell ${P(X, Y)} is not walkable floor (not on solid, wall face, water, lava or pit)` : `art cell ${P(X, Y)} is neither floor nor wall face`;
      if (!bad && cls !== "decal" && occupied.has(idx(X, Y))) bad = `cell ${P(X, Y)} is already used by "${occupied.get(idx(X, Y))}"`;
    }
    if (!bad && cls !== "decal" && pc.name !== "stairs up") { const s = checkGroundSupportForStamp(pseudo, ts, def, p.x, p.y); if (s) bad = "wrong support (wall pieces on wall face, floor pieces on floor)"; }
    if (bad) { errors.push(`${at}: ${bad}.`); continue; }
    for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
      const X = p.x + dx, Y = p.y + dy;
      const lo = def.rows[dy]?.tiles[dx] ?? -1, up = def.rows[dy]?.upperTiles?.[dx] ?? -1;
      if (lo >= 0) lower[idx(X, Y)] = lo;
      if (up >= 0) upper[idx(X, Y)] = up;
      if ((lo >= 0 || up >= 0) && cls !== "decal") occupied.set(idx(X, Y), pc.name);
    }
    stamped.push({ name: pc.name, kitId: pc.kitId, x: p.x, y: p.y, w: def.width, h: def.height, place: cls });
    if (pc.name === "stairs up") {
      const front = { x: p.x, y: p.y + def.height };
      const ent = roomRegions.find((r) => r.purpose === "entrance")!;
      if (!ent.cells.has(idx(front.x, front.y))) errors.push(`"stairs up" at ${P(p.x, p.y)}: the floor cell in front of it ${P(front.x, front.y)} must belong to the entrance room "${ent.id}".`);
      stairsFront = front; stairsAt = { x: p.x, y: p.y + def.height - 1 };
    }
    if (pc.name === "stairs down") stairsDownAt.push({ x: p.x, y: p.y });
  }
  // 방마다 채움: 빈 상자 방의 사슬로 읽히지 않게 방 넓이에 맞는 조각 수를 요구한다(2026-10-31 v2 측정: 판정자가 칸 배치 던전을
  // 「빈 회색 상자 방의 나열」로 읽어 기준 그림 대비 10%, 지금 빌더 60%). 조각은 발밑(또는 벽 조각 바로 아래) 칸이 그 방에 있으면 그 방 것이다.
  for (const r of roomRegions) {
    const walk = [...r.cells].filter((c) => !liqKind[c] || bridge[c] === 1).length;
    const need = Math.max(2, Math.ceil(walk / BBOX_CELLS_PER_PIECE));
    const have = stamped.filter((s) => { for (let dx = 0; dx < s.w; dx += 1) for (const yy of [s.y + s.h - 1, s.y + s.h]) if (r.cells.has(idx(s.x + dx, yy))) return true; return false; }).length;
    if (have < need) errors.push(`room "${r.id}" (${r.purpose}, ${walk} walkable cells) has ${have} piece(s) — it needs at least ${need} (one per ${BBOX_CELLS_PER_PIECE} walkable cells, min 2): add pieces that show what the room is for, or make the room smaller.`);
  }
  const shape = bboxGraphShape(L);
  if (shape.loops < 1 && shape.branches < 2) errors.push(`the room graph is a single line (${shape.rooms} rooms, ${shape.loops} loop(s), ${shape.branches} branching room(s)) — add a loop (a second route between two rooms) or at least two side branches.`);
  const evCells = new Set<number>();
  const putEvent = (c: { x: number; y: number } | undefined, what: string, room?: Region): boolean => {
    if (!c || !num(c.x) || !num(c.y) || !isWalkFloor(c.x, c.y)) { errors.push(`${what} ${c ? P(c.x, c.y) : ""} must be on walkable floor.`); return false; }
    if (occupied.has(idx(c.x, c.y))) { errors.push(`${what} ${P(c.x, c.y)} sits on "${occupied.get(idx(c.x, c.y))}".`); return false; }
    if (evCells.has(idx(c.x, c.y))) { errors.push(`${what} ${P(c.x, c.y)} shares its cell with another chest/enemy/boss.`); return false; }
    if (room && !room.cells.has(idx(c.x, c.y))) { errors.push(`${what} ${P(c.x, c.y)} must be inside room "${room.id}".`); return false; }
    evCells.add(idx(c.x, c.y)); return true;
  };
  for (const c of chests) if (putEvent(c, "chest")) occupied.set(idx(c.x, c.y), "chest");
  const bossRoom = roomRegions.find((r) => r.purpose === "boss");
  const enemies = (Array.isArray(L.enemies) ? L.enemies : []).filter(Boolean);
  for (const e of enemies) { if (putEvent(e, "enemy") && bossRoom?.cells.has(idx(e.x, e.y))) errors.push(`enemy ${P(e.x, e.y)} is inside the boss room — enemies stand outside it; the boss is "boss".`); }
  if (L.boss) putEvent(L.boss, "boss", bossRoom);
  else warnings.push("no boss {x,y} given — the boss will stand on a free floor cell of the boss room picked by the builder.");
  if (errors.length) return fail();

  // ── 걷기 검사: 입구 계단 앞 칸에서 ──
  const passTile = (t: number) => { const p = ts.passability[t]; return !!p && Object.values(p).some(Boolean); };
  const walkable = (x: number, y: number, blockRoom?: Region) => isWalkFloor(x, y) && passTile(lower[idx(x, y)]!) && (upper[idx(x, y)]! < 0 || passTile(upper[idx(x, y)]!))
    && occupied.get(idx(x, y)) !== "chest" && !(blockRoom && blockRoom.cells.has(idx(x, y)));
  const flood = (blockRoom?: Region) => {
    const seen = new Uint8Array(W * H);
    if (!stairsFront || !walkable(stairsFront.x, stairsFront.y, blockRoom)) return seen;
    const q: [number, number][] = [[stairsFront.x, stairsFront.y]]; seen[idx(stairsFront.x, stairsFront.y)] = 1;
    while (q.length) { const [x, y] = q.pop()!; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) if (inb(nx, ny) && !seen[idx(nx, ny)] && walkable(nx, ny, blockRoom)) { seen[idx(nx, ny)] = 1; q.push([nx, ny]); } }
    return seen;
  };
  const seen = flood();
  const sf = stairsFront as { x: number; y: number } | null;
  if (sf && !seen[idx(sf.x, sf.y)]) errors.push(`the floor cell in front of "stairs up" ${P(sf.x, sf.y)} is blocked.`);
  const hazardNote = (L.hazards?.length ? " Water/lava/pit cells are not walkable — leave a dry path or add a bridge." : "") + " Pieces with a solid base also block.";
  for (const r of regionList) {
    const cells = [...r.cells].filter((c) => walkable(c % W, (c / W) | 0));
    if (!cells.length) { errors.push(`${r.kind} "${r.id}" has no walkable cell left.`); continue; }
    if (!cells.some((c) => seen[c])) errors.push(`${r.kind} "${r.id}" is not reachable on foot from the entrance stairs.${hazardNote}`);
  }
  const nb4 = (x: number, y: number) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const;
  for (const c of chests) if (!nb4(c.x, c.y).some(([x, y]) => inb(x, y) && seen[idx(x, y)])) errors.push(`chest ${P(c.x, c.y)} cannot be reached (no reachable floor next to it).`);
  for (const e of [...enemies, ...(L.boss ? [L.boss] : [])]) if (!seen[idx(e.x, e.y)]) errors.push(`enemy/boss cell ${P(e.x, e.y)} cannot be reached on foot.`);
  for (const s of stairsDownAt) if (!seen[idx(s.x, s.y)] && !nb4(s.x, s.y).some(([a, b]) => inb(a, b) && seen[idx(a, b)])) errors.push(`"stairs down" ${P(s.x, s.y)} cannot be reached.`);
  const ante = roomRegions.find((r) => r.purpose === "antechamber");
  if (ante && bossRoom) {
    const s2 = flood(ante);
    const leak = [...bossRoom.cells].find((c) => s2[c]);
    if (leak !== undefined) errors.push(`the boss room "${bossRoom.id}" can be reached without passing through the antechamber "${ante.id}" (e.g. at ${P(leak % W, (leak / W) | 0)}). The only way into the boss room must lead through the antechamber.`);
  }
  let pockets = 0;
  for (let i = 0; i < W * H; i += 1) if (!seen[i] && walkable(i % W, (i / W) | 0)) pockets += 1;
  if (pockets) warnings.push(`${pockets} walkable floor cells cannot be reached from the entrance (cut off by pieces or hazards).`);
  if (errors.length) return fail();
  const roomsOut = order.map((r) => ({ id: r.id, purpose: r.purpose ?? "other", kind: KIND[r.purpose ?? "other"] ?? "hall", ...box(r), cells: [...r.cells] }));
  return {
    ok: true, errors: [], warnings,
    out: {
      W, H, type: theme as DungeonType, lower, upper, rooms: roomsOut,
      corridors: regionList.filter((r) => r.kind === "corridor").map((r) => ({ id: r.id, cells: [...r.cells] })),
      stairsUp: { ...(stairsAt as unknown as { x: number; y: number }), front: sf! }, stairsDown: stairsDownAt,
      locked: doors.filter((d) => d.locked).map((d) => ({ x: d.x, y: d.y })), chests: chests.map((c) => ({ x: c.x, y: c.y })), enemies: enemies.map((e) => ({ x: e.x, y: e.y })),
      ...(L.boss ? { boss: { x: L.boss.x, y: L.boss.y } } : {}), stamped,
      stats: { w: W, h: H, theme, rooms: roomsOut.length, corridors: corridors.length, doors: doors.length, locked: doors.filter((d) => d.locked).length, hazards: (L.hazards ?? []).length, pieces: stamped.length, chests: chests.length, pockets },
    },
  };
}

/** 방 그래프의 갈래·고리 수(조수 결과 글·측정용): 방=점, 통로·문=선. 고리 = 선 − 점 + 1(이어진 그래프), 갈래 = 차수 3 이상 점 수. */
export function bboxGraphShape(L: BboxDungeonLayout): { rooms: number; links: number; loops: number; branches: number; longestChain: number } {
  const rooms = (L.rooms ?? []).map((r) => r.id);
  const corr = new Map((L.corridors ?? []).map((c) => [c.id, c] as const));
  const edges = new Set<string>();
  const add = (a: string, b: string) => { if (a !== b && rooms.includes(a) && rooms.includes(b)) edges.add([a, b].sort().join("|")); };
  for (const c of L.corridors ?? []) add(c.from, c.to);
  for (const d of L.doors ?? []) { const [a, b] = d.connects ?? []; if (a && b && !corr.has(a) && !corr.has(b)) add(a, b); }
  const deg = new Map<string, number>(); for (const e of edges) for (const v of e.split("|")) deg.set(v, (deg.get(v) ?? 0) + 1);
  const branches = [...deg.values()].filter((d) => d >= 3).length;
  const loops = Math.max(0, edges.size - rooms.length + 1);
  return { rooms: rooms.length, links: edges.size, loops, branches, longestChain: loops === 0 && branches === 0 ? rooms.length : 0 };
}
