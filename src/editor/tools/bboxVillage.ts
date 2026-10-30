// 코드 지형 위에 모델이 칸 단위로 쓴 마을(bbox 배치, 2026-10-31 조수 v2) — 검사하고 그대로 칠한다. 함수는 길·집·나무를 더하거나 옮기지 않는다.
// 실험 scripts/experiments/bbox-village/lay.mts(브랜치 agent/bbox-village, Opus 판정 같은 코드 지형의 v2 대비 8승 6무 2패)를 제품 경로로 옮겼다.
//   검사: 칸 하나에 주인 하나(길끼리·광장 위 소품만 겹침 허용), 한 단 위에만, 물 위엔 배·잔교만, 계단은 남북으로 낮은 단에서 절벽에 붙여 높이 차+1 길이,
//         길·광장·계단이 한 덩이로 이어지고(실제 걷기 규칙: 높이·계단) 하나는 마른 맵 끝에 닿음, 집 문앞 칸은 그 집과 같은 단의 이어진 길,
//         울타리 문 밖은 이어진 길.
//   칠하기: 풀 → 포석·모랫길·광장·물 → 밭 → 집(그림자·기초) → 나무 → 소품 → 울타리 → 둑 풀·숲 수관·그림자 → 물 위 길은 널판 → 높이(relief)·계단 그림.
// 조각 목록은 칩셋 메타(structureKits 의 ai.role·ai.tags·parts.entrance·크기)에서 뽑는다. 모델이 받는 글은 모두 영어다.
import type { Project, StructureKitDef, TilesetDef, GameMap } from "@/project/types";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { translateTiles } from "@/project/objectStamp";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { planBeodeulCanopy } from "./beodeulForest";
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "@/project/relief/walk";
import { createBeodeulGroundTileset } from "@/project/defaults/beodeulGround";
import groundCatalog from "@/assets/beodeulGroundCatalog.json";
import type { ReliefData } from "@/project/relief/types";
import { ToolError, type ToolExecResult } from "./types";

export interface BboxVillageTerrain { W: number; H: number; levels: number[]; water: number[]; theme?: string; river?: number[]; crossings?: { x: number; y: number; dir: string }[]; areas?: { level: number; area: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }[] }
type Rect = { x: number; y: number; w: number; h: number };
export interface BboxVillageLayout {
  name?: string;
  zones?: ({ name?: string; purpose?: string } & Partial<Rect>)[];
  roads?: { kind: string; purpose?: string; rects: Rect[] }[];
  plazas?: (Rect & { purpose?: string })[];
  stairs?: (Rect & { dir: string })[];
  buildings?: { id: string; x: number; y: number; purpose?: string }[];
  fields?: (Rect & { crop: string })[];
  fences?: (Rect & { gate: [number, number] | { x: number; y: number } })[];
  forests?: Rect[];
  trees?: { id: string; x: number; y: number }[];
  props?: { id: string; x: number; y: number }[];
}
export type VillageKitKind = "building" | "prop" | "tree" | "boat";
export interface VillageKit { readonly id: string; readonly kind: VillageKitKind; readonly w: number; readonly h: number; readonly en: string; readonly door?: { dx: number; dy: number } }

// ── 조각 목록(칩셋 메타) ──
const VILLAGE_PROP_FAMILY = /^bd-(prop-|farm-|pick-wizard-tower-bed-|out-(woodpile|signpost)|pick-(riverside-mill|fishing-port|walled-market|wheat-roman-road|vineyard|deep-forest-path)-|pick-(coast-cliff-road|swamp-stilt)-rowboat)/;
const ORIGINAL_HOUSE = /^bd-house-(h1\d\d_\d|inn|cafe|smithy_town|ware0|mill1)$|^bd-farm-/;
const ENG = (k: StructureKitDef) => {
  const tags = (k.ai?.tags ?? []).filter((t) => /^[a-z][a-z ]*$/i.test(t) && !/^(house|home|prop|tree|v\d)$/i.test(t));
  const par = /\(([a-z][a-z ,'-]{2,40})\)/i.exec(String(k.ai?.description ?? ""))?.[1];
  const slug = k.id.replace(/^bd-(house-mk-|house-|prop-|out-|pick-[a-z]+-[a-z]+-|tree-|mpart-|farm-)/, "").replace(/[-_]/g, " ");
  return [...new Set([par, ...tags, /^[0-9a-f]{6}$/.test(slug.replace(/ /g, "")) || /^h\d/.test(slug) ? "" : slug].filter(Boolean))].join(", ") || slug;
};
const vcache = new WeakMap<TilesetDef, VillageKit[]>();
export function bboxVillageCatalog(ts: TilesetDef): VillageKit[] {
  const hit = vcache.get(ts); if (hit) return hit;
  const out: VillageKit[] = [];
  for (const k of (ts.structureKits ?? []) as StructureKitDef[]) {
    const role = String(k.ai?.role ?? "");
    const isDungeon = (k.ai?.themes ?? []).some((t) => t === "dungeon" || t === "던전");
    if (role === "building" && (((k.ai?.tags ?? []) as string[]).includes("검수 통과") || ORIGINAL_HOUSE.test(k.id))) {
      const dr = ((k as unknown as { parts?: { kind: string; dx: number; dy: number; h?: number }[] }).parts ?? []).find((q) => q.kind === "entrance");
      if (!dr) continue;
      const dy = k.id.startsWith("bd-house-mk-") ? dr.dy + Math.max(1, dr.h ?? 1) - 1 : dr.dy;
      if (dy !== k.height - 1) continue;
      out.push({ id: k.id, kind: "building", w: k.width, h: k.height, en: `${ENG(k)}${k.id.startsWith("bd-house-mk-") ? " (medieval)" : k.id.startsWith("bd-house-h") ? " (red tile roof)" : ""}`, door: { dx: dr.dx, dy } });
    } else if (role === "prop" && !isDungeon && /^bd-tree-/.test(k.id)) out.push({ id: k.id, kind: "tree", w: k.width, h: k.height, en: `${k.width >= 4 ? "big " : k.width <= 2 ? "small " : ""}tree` });
    else if (/^bd-mpart-bush-[ce]$/.test(k.id)) out.push({ id: k.id, kind: "tree", w: k.width, h: k.height, en: "round bush" });
    else if (role === "prop" && (!isDungeon || /wizard-tower-bed-/.test(k.id)) && VILLAGE_PROP_FAMILY.test(k.id) && k.width <= 8 && k.height <= 8) out.push({ id: k.id, kind: /rowboat/.test(k.id) ? "boat" : "prop", w: k.width, h: k.height, en: `${ENG(k)}${/rowboat/.test(k.id) ? " (ON WATER only)" : ""}` });
  }
  vcache.set(ts, out);
  return out;
}

export function bboxVillageCatalogText(cat: readonly VillageKit[]): string {
  const L = ["# Kit catalog (chipset beodeul_city, 16px cells) — generated from the chipset's kit metadata. Use exact ids.",
    "x,y of a kit = top-left cell of its footprint w x h (art may have transparent corners).", "",
    "## Buildings  (id | w x h | door front cell | description) — the DOOR FRONT cell (just below the door, outside) must be a road/track/plaza cell."];
  for (const e of cat) if (e.kind === "building") L.push(`${e.id} | ${e.w}x${e.h} | (x+${e.door!.dx}, y+${e.h}) | ${e.en}`);
  L.push("", "## Props  (id | w x h | description) — dry land; props may also stand on a plaza; boats only on water");
  for (const e of cat) if (e.kind === "prop" || e.kind === "boat") L.push(`${e.id} | ${e.w}x${e.h} | ${e.en}`);
  L.push("", "## Trees  (id | w x h) — the footprint includes the crown");
  for (const e of cat) if (e.kind === "tree") L.push(`${e.id} | ${e.w}x${e.h} | ${e.en}`);
  L.push("", "## Surfaces (rects, not kits)",
    "road kind main = paved stone road, lane = paved lane, track = sandy dirt path, pier = wooden plank pier (the only road that may go onto the sea; on a river any road becomes a plank bridge)",
    "plaza = paved stone square (props may stand on it)",
    "field crop: wheat | barley | rye (1-cell crop tiles, any size >= 2x2) · vines (vineyard rows, size a multiple of 8x4) · herbs | flowers (2x2 beds, even sizes)",
    "forest = continuous tree canopy (blocks walking), any rects; overlapping rects merge into one wood",
    "fence = wooden fence ring around a rect with one gate cell; stairs = stone stairs (see rules)");
  return L.join("\n");
}

export const BBOX_VILLAGE_FORMAT = `{"name": "...",
 "zones": [{"name": "harbour", "purpose": "...", "x": X, "y": Y, "w": W, "h": H}],
 "roads": [{"kind": "main|lane|track|pier", "purpose": "...", "rects": [{"x": X, "y": Y, "w": W, "h": H}]}],
 "plazas": [{"x": X, "y": Y, "w": W, "h": H, "purpose": "..."}],
 "stairs": [{"x": X, "y": Y, "w": W, "h": H, "dir": "north|south"}],
 "buildings": [{"id": "<building id>", "x": X, "y": Y, "purpose": "..."}],
 "fields": [{"crop": "wheat|barley|rye|vines|herbs|flowers", "x": X, "y": Y, "w": W, "h": H}],
 "fences": [{"x": X, "y": Y, "w": W, "h": H, "gate": [GX, GY]}],
 "forests": [{"x": X, "y": Y, "w": W, "h": H}],
 "trees": [{"id": "<tree id>", "x": X, "y": Y}],
 "props": [{"id": "<prop id>", "x": X, "y": Y}]}`;

export const BBOX_VILLAGE_RULES: readonly string[] = [
  "Coordinates are cells. A rect {x,y,w,h} covers x..x+w-1, y..y+h-1. Kits are placed by their top-left cell. The terrain (levels, water) is fixed — you cannot change it.",
  "Nothing may overlap, except: roads may cross/join other roads; props may stand on a plaza. Kits, fields, fences and forests must not cover road cells.",
  "Buildings, props, trees, fields, fences and plazas lie on ONE level each (no straddling a cliff) and on dry land. Boats lie fully on water. Do not put a building where higher ground lies within the 2 rows just south of it.",
  "Every building's door front cell must be a road/track/plaza cell of the connected network, on the building's own level.",
  "All road/track/pier/plaza/stair cells form ONE connected network (walking rules), and at least one road reaches a dry map edge cell (the village entrance).",
  "Paths change level ONLY by stairs, and only north-south. Stairs rect: on the LOWER level, directly against the cliff; the row just beyond it (north for dir \"north\") is the higher level; h = level difference + 1 (a 2-level step needs h = 3); w = 1..3. The cells just above and below the stairs are road/track/plaza (landings). Stair cells count as path; do not also list them as road.",
  "A road on a river is drawn as a plank bridge; only kind \"pier\" may go onto the sea.",
  "Fence: the rect is the fence ring itself (border cells), with one gate cell on the ring (not a corner); the cell just outside the gate must be a road/track cell.",
  "zones are labels only (harbour, market, residential, farms...). Empty cells stay plain grass and nothing is added for you: design a lived-in village with a clear centre and landmark, distinct zones, roads that follow the land, stairs where it climbs, and fields, woods, orchards (rows of trees) and props so no large area is empty grass. Use the whole map.",
];

/** 지형 → 모델이 읽는 글(영어): 단·물·평지·칸 격자(한 칸 한 글자). */
export function bboxTerrainText(T: BboxVillageTerrain): string {
  const { W, H, levels: lv, water: wa } = T;
  const cnt = new Map<number, number>(); for (let i = 0; i < W * H; i += 1) if (!wa[i]) cnt.set(lv[i]!, (cnt.get(lv[i]!) ?? 0) + 1);
  const L = [`# Terrain (made by code — you cannot change it). Map ${W} x ${H} cells, x to the right 0..${W - 1}, y down 0..${H - 1}.`,
    `Levels (height) present on dry land: ${[...cnt.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `level ${k}: ${v} cells`).join(", ")}.`,
    "One terrace step = 2 levels. Where a higher area lies north of a lower one, the drop is drawn as a 2-cell-high cliff face on the south side.",
    `Water: ${[[1, "river"], [2, "lake"], [3, "sea"]].filter(([v]) => wa.includes(v as number)).map(([, n]) => n).join(", ") || "none"}. Nothing but piers/bridges (roads) and boats may be on water.`];
  if (T.river?.length) { const a = T.river[0]!, b = T.river[T.river.length - 1]!; L.push(`River flows from (${a % W},${Math.floor(a / W)}) to (${b % W},${Math.floor(b / W)}). Good bridge spots (straight river, same-level banks): ${(T.crossings ?? []).slice(0, 6).map((k) => `(${k.x},${k.y},${k.dir})`).join(" ")}`); }
  if (T.areas?.length) L.push(`Flat areas (connected same-level land): ${T.areas.filter((a) => a.area >= 30).map((a) => `level ${a.level} area ${a.area} cells, box (${a.x0},${a.y0})-(${a.x1},${a.y1}), centre (${a.cx},${a.cy})`).join("; ")}`);
  L.push("", "Cell grid (one char per cell; digit = level of dry land, ~ = river, o = lake, = = sea). Row label = y. Column header = x (tens row, then units row).");
  L.push("    " + Array.from({ length: W }, (_, x) => String(Math.floor(x / 10) % 10)).join(""));
  L.push("    " + Array.from({ length: W }, (_, x) => String(x % 10)).join(""));
  for (let y = 0; y < H; y += 1) L.push(`${String(y).padStart(3)} ` + Array.from({ length: W }, (_, x) => ({ 1: "~", 2: "o", 3: "=" } as Record<number, string>)[wa[y * W + x]!] ?? String(lv[y * W + x])).join(""));
  return L.join("\n");
}

// ── 검사 ──
export interface VillagePlan {
  readonly W: number; readonly H: number; readonly lv: number[]; readonly water: number[];
  readonly kind: string[]; readonly roadMat: Map<number, string>; readonly ramps: number[]; readonly stairCells: Set<number>;
  readonly placed: { id: string; x: number; y: number; w: number; h: number; k: VillageKitKind; who: string; door?: { dx: number; dy: number } }[];
  readonly fieldList: (Rect & { crop: string })[]; readonly fenceAt: Map<number, string>; readonly forestSet: Set<number>; readonly stairs: (Rect & { dir: string })[];
  readonly netSize: number; readonly stats: Record<string, number>;
}
export interface VillageCheck { readonly ok: boolean; readonly errors: string[]; readonly warnings: string[]; readonly plan?: VillagePlan }

export function checkBboxVillage(cat: readonly VillageKit[], L: BboxVillageLayout, T: BboxVillageTerrain): VillageCheck {
  const CAT = new Map(cat.map((k) => [k.id, k] as const));
  const W = T.W, H = T.H;
  const lv = T.levels.slice(), water = T.water;
  const errors: string[] = [], warnings: string[] = [];
  const num = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const P = (c: number) => `(${c % W},${Math.floor(c / W)})`;
  const arr = <K extends keyof BboxVillageLayout>(k: K): NonNullable<BboxVillageLayout[K]> => (Array.isArray(L?.[k]) ? L[k] : []) as NonNullable<BboxVillageLayout[K]>;
  const rectOk = (r: Partial<Rect> | undefined, tag: string, minW = 1, minH = 1): r is Rect => {
    if (![r?.x, r?.y, r?.w, r?.h].every(num) || r!.w! < minW || r!.h! < minH) { errors.push(`${tag}: x,y,w,h must be integers with w>=${minW}, h>=${minH} (got ${JSON.stringify(r).slice(0, 80)}).`); return false; }
    if (r!.x! < 0 || r!.y! < 0 || r!.x! + r!.w! > W || r!.y! + r!.h! > H) { errors.push(`${tag} rect (${r!.x},${r!.y},${r!.w}x${r!.h}) is out of the ${W}x${H} map.`); return false; }
    return true;
  };
  const cellsOf = (r: Rect) => { const out: number[] = []; for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) out.push(idx(x, y)); return out; };
  const owner = new Array<string>(W * H).fill(""), kind = new Array<string>(W * H).fill("");
  const claim = (c: number, k: string, who: string, allowOn: string[] = []) => { if (owner[c] && !allowOn.includes(kind[c]!)) { errors.push(`${who} overlaps ${owner[c]} at ${P(c)} — move one of them.`); return; } owner[c] = who; kind[c] = k; };
  const roadMat = new Map<number, string>();
  arr("roads").forEach((rd, i) => {
    const k = ["main", "lane", "track", "pier"].includes(rd?.kind) ? rd.kind : null;
    if (!k) { errors.push(`roads[${i}].kind must be main|lane|track|pier (got ${JSON.stringify(rd?.kind)}).`); return; }
    (Array.isArray(rd.rects) ? rd.rects : []).forEach((r, j) => {
      const tag = `roads[${i}] (${k}) rect ${j}`;
      if (!rectOk(r, tag)) return;
      if (r.w > 3 && r.h > 3) errors.push(`${tag} (${r.w}x${r.h}) is not a road strip — a road rect must be at most 3 cells wide in one direction (use plazas for squares).`);
      for (const c of cellsOf(r)) {
        if (water[c] && k !== "pier" && water[c] !== 1) { errors.push(`${tag} cell ${P(c)} is on ${water[c] === 3 ? "sea" : "lake"} water — only a 'pier' road may go onto the sea.`); continue; }
        if (kind[c] === "road" || kind[c] === "track" || kind[c] === "pier") continue;
        claim(c, k === "track" ? "track" : k === "pier" ? "pier" : "road", `road ${i}`);
        roadMat.set(c, k);
      }
    });
  });
  arr("plazas").forEach((r, i) => {
    if (!rectOk(r, `plazas[${i}]`, 2, 2)) return;
    for (const c of cellsOf(r)) { if (water[c]) { errors.push(`plazas[${i}] cell ${P(c)} is on water.`); continue; } if (roadMat.has(c)) { roadMat.delete(c); owner[c] = ""; kind[c] = ""; } claim(c, "plaza", `plaza ${i}`); }
    const ls = new Set(cellsOf(r).map((c) => lv[c])); if (ls.size > 1) errors.push(`plazas[${i}] spans terrain levels ${[...ls].join("/")} — a plaza must lie on one level.`);
  });
  const ramps = new Array<number>(W * H).fill(0);
  const stairCells = new Set<number>();
  arr("stairs").forEach((s, i) => {
    const tag = `stairs[${i}]`;
    if (!rectOk(s, tag)) return;
    if (s.dir !== "north" && s.dir !== "south") { errors.push(`${tag}.dir must be "north" or "south" (the direction you walk to climb; there are no east-west stair pieces).`); return; }
    if (s.w > 3) errors.push(`${tag} is ${s.w} wide — stairs are 1 to 3 cells wide.`);
    const cs = cellsOf(s), lo = lv[cs[0]!]!;
    if (cs.some((c) => lv[c] !== lo || water[c])) { errors.push(`${tag} (${s.x},${s.y},${s.w}x${s.h}): all stair cells must be dry land on the LOWER level (found levels ${[...new Set(cs.map((c) => lv[c]))].join("/")}).`); return; }
    const hiY = s.dir === "north" ? s.y - 1 : s.y + s.h, loY = s.dir === "north" ? s.y + s.h : s.y - 1;
    if (!inMap(s.x, hiY) || !inMap(s.x, loY)) { errors.push(`${tag}: needs a landing cell above and below inside the map.`); return; }
    const his = new Set<number>(); for (let x = s.x; x < s.x + s.w; x += 1) his.add(lv[idx(x, hiY)]!);
    const hi = [...his][0]!;
    if (his.size > 1 || hi <= lo) { errors.push(`${tag}: the row just ${s.dir} of it (y=${hiY}) must be ONE higher level than the stair cells (level ${lo}); it is level ${[...his].join("/")}. Put the stairs on the low side directly against the cliff.`); return; }
    if (hi - lo > 2) { errors.push(`${tag}: the cliff there is ${hi - lo} levels high — stairs climb at most 2 levels; choose another spot.`); return; }
    if (s.h !== hi - lo + 1) errors.push(`${tag}: a climb from level ${lo} to ${hi} needs a stair flight exactly ${hi - lo + 1} cells long (h=${hi - lo + 1}), got h=${s.h}.`);
    for (let x = s.x; x < s.x + s.w; x += 1) {
      const top = idx(x, hiY), bot = idx(x, loY);
      if (!["road", "track", "plaza"].includes(kind[top]!)) errors.push(`${tag}: upper landing ${P(top)} must be a road/path/plaza cell.`);
      if (!["road", "track", "plaza"].includes(kind[bot]!) || lv[bot] !== lo) errors.push(`${tag}: lower landing ${P(bot)} must be a road/path/plaza cell on level ${lo}.`);
    }
    for (const c of cs) { if (kind[c] === "road" || kind[c] === "track") { owner[c] = ""; kind[c] = ""; roadMat.delete(c); } claim(c, "stair", `stairs ${i}`); ramps[c] = rampCode(s.dir === "north" ? "n" : "s", true); stairCells.add(c); }
  });
  const placed: VillagePlan["placed"][number][] = [];
  const placeKit = (o: { id: string; x: number; y: number } | undefined, group: string, i: number, kinds: VillageKitKind[]) => {
    const tag = `${group}[${i}] "${o?.id}"`;
    const d = o ? CAT.get(o.id) : undefined;
    if (!o || !d) { errors.push(`${tag}: unknown id — use an exact id from the catalog.`); return; }
    if (!kinds.includes(d.kind)) { errors.push(`${tag} is a ${d.kind}, not allowed in "${group}" (use ${d.kind === "building" ? "buildings" : d.kind === "tree" ? "trees" : "props"}).`); return; }
    if (!num(o.x) || !num(o.y)) { errors.push(`${tag}: needs integer x, y.`); return; }
    const r = { x: o.x, y: o.y, w: d.w, h: d.h };
    if (!rectOk(r, tag)) return;
    const cs = cellsOf(r), who = `${o.id}@(${o.x},${o.y})`;
    if (d.kind === "boat") { if (cs.some((c) => !water[c])) errors.push(`${tag}: a boat must lie fully on water.`); }
    else if (cs.some((c) => water[c])) { errors.push(`${tag} (${d.w}x${d.h} at ${o.x},${o.y}) touches water — only boats go on water.`); return; }
    const ls = new Set(cs.map((c) => lv[c])); if (d.kind !== "boat" && ls.size > 1) errors.push(`${tag} (${d.w}x${d.h} at ${o.x},${o.y}) straddles terrain levels ${[...ls].join("/")} — its whole footprint must be on one level.`);
    const L0 = lv[cs[cs.length - 1]!]!;
    if (d.kind === "building") for (let i2 = 0; i2 < d.w; i2 += 1) for (const kk of [1, 2]) { const Y = o.y + d.h - 1 + kk; if (Y < H && lv[idx(o.x + i2, Y)]! > L0 + kk - 1) { errors.push(`${tag}: higher ground right in front of it at (${o.x + i2},${Y}) would hide its front — move it.`); break; } }
    for (const c of cs) { const onPlaza = kind[c] === "plaza" && d.kind === "prop"; claim(c, onPlaza ? "plazaprop" : d.kind === "building" ? "bld" : d.kind, who, d.kind === "prop" ? ["plaza"] : []); }
    placed.push({ id: o.id, x: o.x, y: o.y, w: d.w, h: d.h, k: d.kind, who, ...(d.door ? { door: d.door } : {}) });
  };
  arr("buildings").forEach((o, i) => placeKit(o, "buildings", i, ["building", "prop"]));
  const fieldList: (Rect & { crop: string })[] = [];
  arr("fields").forEach((f, i) => {
    const tag = `fields[${i}]`;
    if (!rectOk(f, tag, 2, 2)) return;
    if (!["wheat", "barley", "rye", "vines", "herbs", "flowers"].includes(f.crop)) { errors.push(`${tag}.crop must be wheat|barley|rye|vines|herbs|flowers.`); return; }
    if (f.crop === "vines" && (f.w % 8 || f.h % 4)) errors.push(`${tag}: a vines field must be a multiple of 8x4 cells (got ${f.w}x${f.h}).`);
    if ((f.crop === "herbs" || f.crop === "flowers") && (f.w % 2 || f.h % 2)) errors.push(`${tag}: herbs/flowers beds come in 2x2 — use even w and h (got ${f.w}x${f.h}).`);
    const cs = cellsOf(f);
    if (cs.some((c) => water[c])) { errors.push(`${tag} touches water.`); return; }
    const ls = new Set(cs.map((c) => lv[c])); if (ls.size > 1) errors.push(`${tag} spans terrain levels ${[...ls].join("/")} — a field must lie on one level.`);
    for (const c of cs) claim(c, "field", `field ${i}`);
    fieldList.push(f);
  });
  const fenceAt = new Map<number, string>();
  const gates: { c: number; out: number; who: string }[] = [];
  arr("fences").forEach((f, i) => {
    const tag = `fences[${i}]`;
    if (!rectOk(f, tag, 4, 3)) return;
    const x0 = f.x, y0 = f.y, x1 = f.x + f.w - 1, y1 = f.y + f.h - 1;
    const g = Array.isArray(f.gate) ? { x: f.gate[0], y: f.gate[1] } : f.gate;
    const onRing = (x: number, y: number) => (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (!g || !num(g.x) || !num(g.y) || !onRing(g.x, g.y) || ((g.x === x0 || g.x === x1) && (g.y === y0 || g.y === y1))) { errors.push(`${tag}.gate must be one cell [x,y] on the fence ring, not a corner.`); return; }
    const ring: number[] = [];
    for (let x = x0; x <= x1; x += 1) ring.push(idx(x, y0), idx(x, y1));
    for (let y = y0 + 1; y < y1; y += 1) ring.push(idx(x0, y), idx(x1, y));
    const ls = new Set(ring.map((c) => lv[c])); if (ls.size > 1) errors.push(`${tag} ring spans terrain levels ${[...ls].join("/")} — a fence must lie on one level.`);
    if (ring.some((c) => water[c])) { errors.push(`${tag} touches water.`); return; }
    const gc = idx(g.x, g.y);
    for (const c of ring) {
      const x = c % W, y = Math.floor(c / W);
      if (c === gc) { claim(c, "gate", `fence ${i} gate`); continue; }
      let k = y === y0 ? (x === x0 ? "tl" : x === x1 ? "tr" : "h") : y === y1 ? (x === x0 ? "bl" : x === x1 ? "br" : "h") : "v";
      if (k === "h" && y === g.y && Math.abs(x - g.x) === 1) k = x < g.x ? "endE" : "endW";
      if (k === "v" && x === g.x && Math.abs(y - g.y) === 1) k = y < g.y ? "endS" : "endN";
      claim(c, "fence", `fence ${i}`); fenceAt.set(c, k);
    }
    const [ox, oy] = g.y === y0 ? [g.x, g.y - 1] : g.y === y1 ? [g.x, g.y + 1] : g.x === x0 ? [g.x - 1, g.y] : [g.x + 1, g.y];
    gates.push({ c: gc, out: inMap(ox, oy) ? idx(ox, oy) : -1, who: tag });
  });
  const forestSet = new Set<number>();
  arr("forests").forEach((f, i) => { if (!rectOk(f, `forests[${i}]`, 2, 2)) return; for (const c of cellsOf(f)) { if (water[c] || kind[c] === "forest") continue; claim(c, "forest", `forest ${i}`); forestSet.add(c); } });
  arr("trees").forEach((o, i) => placeKit(o, "trees", i, ["tree"]));
  arr("props").forEach((o, i) => placeKit(o, "props", i, ["prop", "boat"]));
  // 걷기 규칙(높이·계단)으로 길 그물 잇기
  const rel: ReliefData = { width: W, height: H, levels: lv.slice(), ramps: ramps.slice() };
  invalidateReliefSlopes(rel);
  const pathy = (c: number) => ["road", "track", "pier", "plaza", "stair", "gate"].includes(kind[c]!);
  const reported = new Set<string>();
  for (let c = 0; c < W * H; c += 1) {
    if (!pathy(c)) continue; const x = c % W, y = Math.floor(c / W);
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy);
      if (!pathy(n) || lv[c] === lv[n] || stairCells.has(c) || stairCells.has(n)) continue;
      const key = `${Math.min(lv[c]!, lv[n]!)}-${dx}-${Math.floor(x / 3)}-${Math.floor(y / 3)}`; if (reported.has(key)) continue; reported.add(key);
      errors.push(dx ? `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across an east-west level change — paths cannot climb sideways; route the path north/south through stairs.`
        : `path cells ${P(c)} (level ${lv[c]}) and ${P(n)} (level ${lv[n]}) meet across a cliff without stairs — add a stairs rect there (on the low side, h = level difference + 1).`);
    }
  }
  const pathCells = [...Array(W * H).keys()].filter(pathy);
  const comps: number[][] = [];
  { const seen = new Uint8Array(W * H);
    for (const s of pathCells) {
      if (seen[s]) continue; const q = [s]; seen[s] = 1;
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = Math.floor(c / W);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
          if (seen[n] || !pathy(n) || !reliefAllowsStep(rel, x, y, nx, ny)) continue; seen[n] = 1; q.push(n); } }
      comps.push(q);
    }
    comps.sort((a, b) => b.length - a.length); }
  const net = new Set(comps[0] ?? []);
  if (!pathCells.length) errors.push("No roads at all: give road rect chains.");
  if (comps.length > 1) for (const cp of comps.slice(1, 6)) errors.push(`path network is split: ${cp.length} path cell(s) around ${P(cp[0]!)} are not connected (walking, stairs included) to the main network around ${P(comps[0]![0]!)}.`);
  if (pathCells.length && !pathCells.some((c) => { const x = c % W, y = Math.floor(c / W); return net.has(c) && (x === 0 || y === 0 || x === W - 1 || y === H - 1) && !water[c]; }))
    errors.push("No road leaves the map: at least one main road must reach a dry map edge cell (the village entrance).");
  for (const p of placed.filter((q) => q.k === "building")) {
    if (!p.door) continue;
    const fx = p.x + p.door.dx, fy = p.y + p.door.dy + 1;
    if (!inMap(fx, fy)) { errors.push(`building ${p.who}: its door front cell (${fx},${fy}) is off the map.`); continue; }
    const f = idx(fx, fy);
    if (!["road", "track", "plaza", "pier"].includes(kind[f]!)) errors.push(`building ${p.who}: door front cell (${fx},${fy}) must be a road/path/plaza cell (lay at least a 1-cell track from the door to the network).`);
    else if (lv[f] !== lv[idx(p.x, p.y + p.h - 1)]) errors.push(`building ${p.who}: door front cell (${fx},${fy}) is on level ${lv[f]} but the building stands on level ${lv[idx(p.x, p.y + p.h - 1)]}.`);
    else if (!net.has(f)) errors.push(`building ${p.who}: door front (${fx},${fy}) is on a path piece not connected to the main network.`);
  }
  for (const g of gates) if (g.out < 0 || !net.has(g.out)) errors.push(`${g.who}: the cell just outside the gate ${g.out >= 0 ? P(g.out) : ""} must be a connected road/path cell.`);
  const free = [...Array(W * H).keys()].filter((c) => !water[c] && !owner[c]).length, land = water.filter((v) => !v).length;
  if (land && free / land > 0.6) warnings.push(`${Math.round((free / land) * 100)}% of the dry land is still bare grass — consider more fields, forests, orchards or props.`);
  const stats = { W, H, buildings: placed.filter((p) => p.k === "building").length, props: placed.filter((p) => p.k === "prop" || p.k === "boat").length, trees: placed.filter((p) => p.k === "tree").length,
    pathCells: pathCells.length, stairs: arr("stairs").length, fields: fieldList.length, forest: forestSet.size, bareLandPct: land ? Math.round((free / land) * 100) : 0 };
  if (errors.length) return { ok: false, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  return { ok: true, errors: [], warnings: [...new Set(warnings)], plan: { W, H, lv, water: water.slice(), kind, roadMat, ramps, stairCells, placed, fieldList, fenceAt, forestSet, stairs: arr("stairs"), netSize: net.size, stats } };
}

// ── 칠하기 ──
const GRASS = "버들항 풀밭", PAVING = "버들항 길 포석", PLAZA = "버들항 광장 판석", WATER = "버들항 강·운하 물", SAND = "버들항 모랫길";
const REVIEWED = [{ house: "bd-house-rv-", shadow: "bd-rv-shadow-", foundation: "bd-rv-foundation-" }, { house: "bd-house-mk-", shadow: "bd-mk-shadow-", foundation: "bd-mk-foundation-" }];

export function layBboxVillageInDraft(draft: Project, L: BboxVillageLayout, T: BboxVillageTerrain, opts: { name?: string; prepare: (W: number, H: number) => { map: GameMap } } & Record<string, unknown>): ToolExecResult {
  const TS = "beodeul_city", ts = draft.tilesets[TS];
  if (!ts) throw new ToolError("the beodeul_city chipset is not in this project.", { code: "tileset-missing" });
  const chk = checkBboxVillage(bboxVillageCatalog(ts), L, T);
  if (!chk.ok || !chk.plan) throw new ToolError(`Rejected: ${chk.errors.slice(0, 30).join(" | ")}`, { code: "layout-rejected" });
  const pl = chk.plan, W = pl.W, H = pl.H, kind = pl.kind, water = pl.water, lv = pl.lv;
  const warnings = [...chk.warnings];
  const { map: m0 } = opts.prepare(W, H);
  const mapId = m0.id;
  m0.lowerTiles = new Array(W * H).fill(-1); m0.upperTiles = new Array(W * H).fill(-1);
  for (const k of ["shadowBits"] as const) delete (m0 as unknown as Record<string, unknown>)[k];
  m0.mapRole = "town" as GameMap["mapRole"];
  const map = () => draft.maps[mapId]!;
  const fillTool = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "fill_region")!, stampTool = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;
  const fill = (rect: Rect, material: string, clearUpper?: boolean) => { try { fillTool.run(draft, { mapId, rect, material, ...(clearUpper ? { clearUpper } : {}), _exactCells: true }); } catch (e) { warnings.push(`paint ${material}: ${(e as Error).message.slice(0, 120)}`); } };
  const paintCells = (cells: number[], mat: string) => {
    const rows = new Map<number, number[]>(); for (const c of cells) { const y = Math.floor(c / W); (rows.get(y) ?? rows.set(y, []).get(y)!).push(c % W); }
    for (const [y, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0]!, p = s; for (let i = 1; i <= xs.length; i += 1) { const v = xs[i]; if (v === p + 1) { p = v; continue; } fill({ x: s, y, w: p - s + 1, h: 1 }, mat); if (v !== undefined) { s = v; p = v; } } }
  };
  fill({ x: 0, y: 0, w: W, h: H }, GRASS, true);
  const all = [...Array(W * H).keys()];
  paintCells(all.filter((c) => (kind[c] === "road" || kind[c] === "stair") && !water[c] && pl.roadMat.get(c) !== "track"), PAVING);
  paintCells(all.filter((c) => (kind[c] === "track" || pl.roadMat.get(c) === "track" || kind[c] === "gate") && !water[c]), SAND);
  paintCells(all.filter((c) => kind[c] === "plaza" || kind[c] === "plazaprop"), PLAZA);
  paintCells(all.filter((c) => water[c]), WATER);
  const canal = ts.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47");
  const canalMembers = new Set(canal?.memberTileIds ?? []), fullWater = canal?.variantMap?.["255"] ?? -1;
  for (const c of all) if (water[c] && canalMembers.has(map().lowerTiles[c]!)) map().lowerTiles[c] = fullWater;
  const stampFails: string[] = [];
  const kitDef = (id: string) => (ts.structureKits ?? []).find((k) => k.id === id);
  const stamp = (id: string, x: number, y: number) => { try { stampTool.run(draft, { objectId: `kit:${TS}/${id}`, mapId, x, y }); return true; } catch (e) { stampFails.push(`${id}@(${x},${y}): ${(e as Error).message.slice(0, 120)}`); return false; } };
  for (const f of pl.fieldList) {
    if (f.crop === "vines") { for (let y = f.y; y < f.y + f.h; y += 4) for (let x = f.x; x < f.x + f.w; x += 8) stamp("bd-pick-vineyard-vine-field", x, y); continue; }
    if (f.crop === "herbs" || f.crop === "flowers") { for (let y = f.y; y < f.y + f.h; y += 2) for (let x = f.x; x < f.x + f.w; x += 2) stamp(`bd-pick-wizard-tower-bed-${f.crop === "herbs" ? "herb" : "flower"}`, x, y); continue; }
    const id = `bd-pick-wheat-roman-road-wheat-${f.crop === "wheat" ? "a" : f.crop === "barley" ? "b" : "c"}`;
    for (let y = f.y; y < f.y + f.h; y += 1) for (let x = f.x; x < f.x + f.w; x += 1) stamp(id, x, y);
  }
  const stampedOk = pl.placed.filter((p) => stamp(p.id, p.x, p.y));
  for (const p of stampedOk) {
    const set = REVIEWED.find((r) => p.id.startsWith(r.house));
    if (set) for (const [prefix, layer] of [[set.shadow, 2], [set.foundation, 4]] as const) {
      const kit = kitDef(prefix + p.id.slice(set.house.length)); if (!kit) continue;
      kit.rows.forEach((row, j) => (row.upperTiles ?? []).forEach((t, i) => { const x = p.x + i, y = p.y + j; if (t >= 0 && x < W && y < H && layerTileAt(map(), layer, y * W + x) < 0) setLayerTileAt(map(), layer, y * W + x, t); }));
    }
  }
  if (stampFails.length) warnings.push(...stampFails.slice(0, 8).map((s) => `stamp failed ${s}`));
  const natureTileset = () => { const t = draft.tilesets[BEODEUL_NATURE_ID]; return t && t.count >= BEODEUL_NATURE.count ? t : (draft.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset()); };
  if (pl.fenceAt.size) {
    const common = draft.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
    const srcH = (groundCatalog as unknown as { recipes: { id: string; rows: number[][] }[] }).recipes.find((r) => r.id === "bdg-woodland-fence-horizontal")!.rows[0]![0]!;
    const fence = BEODEUL_NATURE.fence as Record<string, number>;
    const tr = translateTiles(natureTileset(), ts, new Set([...pl.fenceAt.values()].map((k) => fence[k]!)));
    for (const to of tr.map.values()) { ts.priority[to] = common.priority[srcH]!; ts.passability[to] = structuredClone(common.passability[srcH]!); }
    for (const [c, k] of pl.fenceAt) setLayerTileAt(map(), 3, c, tr.map.get(fence[k]!)!);
  }
  {
    const m = map(); const want = new Map<number, number>(), canopyAt = new Map<number, number>();
    const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
    for (const c of all) if (water[c] && !pl.roadMat.has(c) && m.lowerTiles[c] === fullWater) {
      const x = c % W, y = Math.floor(c / W); let mask = 0;
      N8.forEach(([dx, dy], b) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || water[ny * W + nx]! > 0) mask |= 1 << b; });
      const t = BEODEUL_NATURE.bankGrass[mask]!; if (t >= 0) want.set(c, t);
    }
    if (pl.forestSet.size) {
      const plan = planBeodeulCanopy(W, H, "leaf", pl.forestSet, (s) => !water[s] && !pl.forestSet.has(s) && layerTileAt(m, 2, s) < 0 && !want.has(s) && !pl.stairCells.has(s) && lv[s] === lv[s - W], (a, b) => lv[a] === lv[b]);
      for (const [c, t] of plan.canopy) canopyAt.set(c, t);
      for (const [c, t] of plan.shade) want.set(c, t);
    }
    for (const st of pl.placed) {
      const sh = (BEODEUL_NATURE.shadows as unknown as Record<string, { dx: number; dy: number; rows: number[][] }>)[st.id]; if (!sh) continue;
      sh.rows.forEach((row, j) => row.forEach((t, i) => {
        if (t < 0) return; const x = st.x + sh.dx + i, y = st.y + sh.dy + j; if (x < 0 || y < 0 || x >= W || y >= H) return; const c = y * W + x;
        if (water[c] || pl.forestSet.has(c) || want.has(c) || layerTileAt(m, 2, c) >= 0 || pl.stairCells.has(c) || lv[c] !== lv[(st.y + st.h - 1) * W + st.x]) return;
        want.set(c, t);
      }));
    }
    if (want.size || canopyAt.size) {
      const tr = translateTiles(natureTileset(), ts, new Set([...want.values(), ...canopyAt.values()]));
      const blocked = new Set(canopyAt.values());
      for (const [from, to] of tr.map) { ts.priority[to] = "upper"; ts.passability[to] = blocked.has(from) ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true }; }
      for (const [c, t] of want) setLayerTileAt(m, 2, c, tr.map.get(t)!);
      for (const [c, t] of canopyAt) setLayerTileAt(m, c + W < W * H && canopyAt.has(c + W) ? 3 : 2, c, tr.map.get(t)!);
    }
  }
  {
    const plank = kitDef("bd-pick-fishing-port-jetty-west");
    const mids = (plank?.rows ?? []).map((r) => r.tiles?.[0] ?? -1).filter((t) => t >= 0);
    let i = 0;
    for (const c of all) if (water[c] && pl.roadMat.has(c) && mids.length) { map().lowerTiles[c] = mids[1 + (i % Math.max(1, mids.length - 1))] ?? mids[0]!; for (const Lr of [2, 3, 4] as const) setLayerTileAt(map(), Lr, c, -1); i += 1; }
  }
  {
    const m = map();
    if (lv.some((v) => v > 0)) {
      m.relief = { width: W, height: H, levels: lv.slice(), ramps: pl.ramps.slice(), style: "grass-steps" } as GameMap["relief"];
      invalidateReliefSlopes(m.relief!);
      const mp = kitDef("bd-mpart-stairs");
      const tileAt = (col: number, row: number) => mp?.rows[row]?.tiles?.[col] ?? -1;
      for (const s of pl.stairs) for (let y = s.y; y < s.y + s.h; y += 1) for (let x = s.x; x < s.x + s.w; x += 1) {
        const row = (s.y + s.h - 1 - y) % 2 === 0 ? 1 : 0;
        const t = tileAt(s.w === 1 ? 2 : x === s.x ? 1 : x === s.x + s.w - 1 ? 3 : 2, row); if (t < 0) continue;
        const c = y * W + x; m.lowerTiles[c] = t; for (const Lr of [2, 3, 4] as const) setLayerTileAt(m, Lr, c, -1);
      }
    }
  }
  // 맵 끝에 닿은 길 칸(마을 입구 후보) — 다른 맵과 잇는 자리. 문앞 칸 목록 — 사람·문 잇기 자리.
  const edgeRoads = all.filter((c) => { const x = c % W, y = Math.floor(c / W); return (x === 0 || y === 0 || x === W - 1 || y === H - 1) && ["road", "track", "plaza"].includes(kind[c]!) && !water[c]; }).map((c) => ({ x: c % W, y: Math.floor(c / W) }));
  const doors = pl.placed.filter((p) => p.k === "building" && p.door).map((p) => ({ id: p.id, x: p.x + p.door!.dx, y: p.y + p.door!.dy, front: { x: p.x + p.door!.dx, y: p.y + p.door!.dy + 1 } }));
  return {
    summary: `laid village ${mapId} (${W}x${H}, ${pl.stats.buildings} buildings, ${pl.stats.props} props, ${pl.stats.trees} trees, ${pl.stats.pathCells} path cells) exactly as written`,
    warnings,
    data: { mapId, width: W, height: H, entrance: edgeRoads[0] ?? null, edgeRoads, doors, stats: pl.stats, stampFails: stampFails.length },
  };
}
