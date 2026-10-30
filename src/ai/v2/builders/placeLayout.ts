// 조수 v2 칸 배치 장소(bbox, 2026-10-31): 던전 한 층과 코드 지형 마을을 모델이 칸 단위 배치 JSON 으로 쓰고, 함수는 검사하고 그대로 깐다.
//   던전: spec.dungeonLayout → lay_dungeon_layout(bboxFloor.ts, exact compose) → 적·보스·상자는 모델이 적은 칸에 그대로.
//   마을: 코드 지형(높이맵·강·단)을 먼저 만들고 그림·격자·요약·조각 목록을 준다 → spec.villageLayout → lay_village_layout(bboxVillage.ts).
// 모델이 배치를 안 주면 옛 빌더(author_dungeon·author_beodeul_town)로 짓는다. 모델에게 가는 글은 모두 영어다.
// 자기 비평 두 바퀴: 지은 뒤 1배 그림 옆에 배치 상자 그림을 보여 주고 고친 배치(또는 «고칠 것 없음»)를 받는다 — 할 일 항목(관문 열쇠 place:<맵>:layout-*)이 센다.
// 실험 근거: scripts/experiments/bbox-dungeon(Opus 판정 v2 빌더 대비 10승 2무 0패)·bbox-village(8승 6무 2패)·bbox-better(자기 비평 2바퀴 0.61→0.71).
import type { PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import type { PiAssistantV2Env } from "../env";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";
import type { Project, TilesetDef } from "@/project/types";
import { createBuildRun } from "../buildRun";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "@/editor/tools/sharedObjectTools";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { BBOX_DUNGEON_FORMAT, BBOX_DUNGEON_RULES, BBOX_DUNGEON_THEMES, bboxDungeonCatalog, bboxDungeonCatalogText, bboxGraphShape, layBboxDungeon, type BboxDungeonLayout } from "@/editor/dungeonKit/bboxFloor";
import { composeExactFloor } from "@/editor/dungeonKit/beodeul/compose";
import { Grid } from "@/editor/dungeonKit/grid";
import { BBOX_VILLAGE_FORMAT, BBOX_VILLAGE_RULES, bboxTerrainText, bboxVillageCatalog, bboxVillageCatalogText, checkBboxVillage, type BboxVillageLayout, type BboxVillageTerrain } from "@/editor/tools/bboxVillage";
import { BBOX_DECL_TAG, readLayoutDecl } from "@/editor/tools/bboxPlaceTools";
import { codeTerrainFor, usesCodeTerrain } from "@/editor/tools/authorBeodeulTown";
import { terrainPreviewPng } from "@/editor/tools/beodeulTerrainPreview";
import { themedTroops } from "@/editor/tools/dungeonTools";
import { chestLoot } from "@/editor/tools/jrpgVolumeTools";
import { terrainReachability } from "@/project/terrainReachability";
import { dungeonArgs, enlargeBoss, planTroops } from "./dungeon";
import { villageArgs, villageMapSize } from "./village";
import { ensureBossRest, ensureHealingAccess } from "../healingAccess";

const TS = "beodeul_city";
/** 실행기·측정 스위치: OPRN_V2_BBOX_PLACES=0 이면 칸 배치 경로를 끄고 옛 빌더만 쓴다(측정 대조군). */
export function bboxPlacesOn(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_V2_BBOX_PLACES !== "0";
}
/** 자기 비평 바퀴 수(실험 bbox-better: 2바퀴). */
export const LAYOUT_CRITIQUE_ROUNDS = 2;
/** 거절된 배치를 고쳐 다시 보낼 수 있는 횟수 — 넘으면 옛 빌더로 짓는다. */
export const LAYOUT_REPAIRS = 2;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const hasDungeonLayout = (spec: PlaceSpec): boolean => isObj(spec.dungeonLayout) && Array.isArray((spec.dungeonLayout as BboxDungeonLayout).rooms) && (spec.dungeonLayout as BboxDungeonLayout).rooms!.length >= 2;
export const hasVillageLayout = (spec: PlaceSpec): boolean => isObj(spec.villageLayout) && (((spec.villageLayout as BboxVillageLayout).roads as unknown[] | undefined)?.length ?? 0) + (((spec.villageLayout as BboxVillageLayout).buildings as unknown[] | undefined)?.length ?? 0) > 0;
/** 칸 배치 던전을 받는 명세(type dungeon — 동굴은 옛 빌더). */
export const bboxDungeonSpec = (spec: PlaceSpec): boolean => bboxPlacesOn() && spec.type === "dungeon";
const VILLAGE_STYLE_OK = (spec: PlaceSpec) => spec.type === "village" && !/jp-modern|modern-city|wizarding|sengoku/.test(spec.style ?? "");
/** 칸 배치 마을을 받는 명세(코드 지형을 쓰는 마을). */
export function bboxVillageSpec(spec: PlaceSpec): boolean {
  if (!bboxPlacesOn() || !VILLAGE_STYLE_OK(spec)) return false;
  const va = villageArgs(spec).args;
  return usesCodeTerrain(va, String(va.theme ?? "river"));
}

// ── 세션 상태(동사 사이) ──
export interface LayoutPlaceState { kind: "dungeon" | "village"; name: string; critiqueRounds: number; rejects: number; lastErrors?: string[]; graph?: ReturnType<typeof bboxGraphShape> }
const STATES = new WeakMap<object, { byMap: Map<string, LayoutPlaceState>; rejects: Map<string, number>; cards: Set<string> }>();
export function layoutSession(session: object) {
  let s = STATES.get(session);
  if (!s) { s = { byMap: new Map(), rejects: new Map(), cards: new Set() }; STATES.set(session, s); }
  return s;
}

// ── 지을 맵 ──
function targetMapId(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0]) return previous.result.mapIds[0];
  if (spec.mapId && run.ctx.project.maps[spec.mapId]?.tilesetId === TS) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && cur.tilesetId === TS && isBlankMap(cur)) return cur.id;
  return undefined;
}

// ── 던전 빌더 ──
function buildDungeon(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const L = spec.dungeonLayout as BboxDungeonLayout;
  const warnings: string[] = [];
  const firstCall = run.calls.length;
  const mapId = targetMapId(run, spec, previous);
  const gate = !previous && spec.gate && run.ctx.project.maps[spec.gate.fromMapId] ? spec.gate : undefined;
  // 옛 빌더로 지었던 여러 층 던전을 칸 배치로 다시 짓는다 — 위층은 지운다(한 층 배치).
  // 먼저 검사만(순수) — 거절이면 문제 목록 전부를 돌려준다(도구 거절 글은 잘린다).
  const ts = run.ctx.project.tilesets[TS];
  const laidCheck = ts ? layBboxDungeon(ts, L) : { ok: false, errors: ["the beodeul_city chipset is not in this project."], warnings: [] };
  // 적 없는 던전 층 — 평화 던전(populate:false)이 아니면 최소 수를 요구한다(규칙 글과 같은 수).
  const peaceful = dungeonArgs({ ...spec, dungeonDesign: undefined, floorDesigns: undefined } as PlaceSpec).args.populate === false;
  const minFoes = Math.max(2, (Array.isArray(L.rooms) ? L.rooms.length : 0) - 3);
  const foeCount = (Array.isArray(L.enemies) ? L.enemies : []).filter(Boolean).length;
  const foeErrors = laidCheck.ok && !peaceful && foeCount < minFoes ? [`enemies: ${foeCount} given — a dungeon floor needs at least ${minFoes} visible enemies (max(2, rooms - 3)) on walkable floor outside the boss room, spread over the rooms on the way.`] : [];
  const pre = { ok: laidCheck.ok && !foeErrors.length, errors: [...laidCheck.errors, ...foeErrors] };
  if (!pre.ok) return { ok: false, mapIds: [], summary: `Rejected: ${pre.errors.length} problem(s) in dungeonLayout`, warnings: pre.errors, missingArt: [], calls: [], state: { bbox: "dungeon", rejected: pre.errors } };
  if (previous) for (const id of previous.result.mapIds.slice(1)) if (run.ctx.project.maps[id]) run.call("remove_map", { mapId: id });
  const laid = run.call("lay_dungeon_layout", { layout: L, name: spec.name, ...(mapId ? { mapId } : {}), ...(gate ? { entrance: gate } : {}) });
  if (!laid.ok) {
    const errors = [String(laid.summary ?? "").replace(/^.*?Rejected:\s*/su, "")];
    return { ok: false, mapIds: [], summary: `Rejected: ${errors.length} problem(s) in dungeonLayout`, warnings: errors, missingArt: [], calls: run.calls.slice(firstCall), state: { bbox: "dungeon", rejected: errors } };
  }
  const data = (laid.data ?? {}) as { mapId: string; entrance: { x: number; y: number }; entryStair: { x: number; y: number; front: { x: number; y: number } }; enemies: { x: number; y: number }[]; chests: { x: number; y: number }[]; boss: { x: number; y: number } | null; anchors: Record<string, unknown>; rooms: unknown[] };
  warnings.push(...(laid.warnings ?? []), ...(((laid as { diff?: { warnings?: string[] } }).diff?.warnings) ?? []).filter((w) => !(laid.warnings ?? []).includes(w)));
  const floor = data.mapId;
  // 적 그룹: 요청 낱말 > 주제(옛 빌더와 같은 고르기). 자리는 모델이 적은 칸 그대로.
  const plan = dungeonArgs({ ...spec, dungeonDesign: undefined, floorDesigns: undefined } as PlaceSpec);
  const toolArgs = { name: spec.name, type: String(L.theme), theme: spec.theme ?? "" };
  const given = plan.args.populate === false ? undefined : planTroops(run, plan, toolArgs, warnings);
  const troops = themedTroops(run.ctx.project, { ...toolArgs, ...(given ? { troops: given } : {}) });
  const placedFoes: string[] = [];
  (data.enemies ?? []).forEach((e, i) => {
    if (!troops.field.length) return;
    const troopId = troops.field[i % troops.field.length]!;
    const id = `ev_${floor}_v2foe${i + 1}`;
    const r = run.call("place_field_enemy", { mapId: floor, x: e.x, y: e.y, troopId, behavior: "patrol", patrol: { length: 2, axis: i % 2 ? "vertical" : "horizontal" }, id });
    const r2 = r.ok ? r : run.call("place_field_enemy", { mapId: floor, x: e.x, y: e.y, troopId, behavior: "stationary", id });
    if (r2.ok) placedFoes.push(`(${e.x},${e.y})`); else warnings.push(`enemy at (${e.x},${e.y}) was not placed: ${String(r2.summary).slice(0, 140)}`);
  });
  let bossNote = "";
  // 보스 칸을 안 적었으면(검사기가 경고만 했다) 보스방에서 가운데에 가장 가까운 빈 걷는 칸.
  if (!data.boss) {
    const room = (data.rooms as { purpose: string; x: number; y: number; w: number; h: number }[]).find((r) => r.purpose === "boss");
    const m = run.ctx.project.maps[floor]!;
    const reach = room ? terrainReachability(run.ctx.project, m, data.entryStair.front) : undefined;
    if (room && reach) {
      const cx = room.x + room.w / 2, cy = room.y + room.h / 2; let best: { x: number; y: number } | undefined; let bd = Infinity;
      for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
        if (!reach[y * m.width + x] || m.events.some((e) => e.x === x && e.y === y)) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d < bd) { bd = d; best = { x, y }; }
      }
      if (best) data.boss = best;
    }
  }
  if (data.boss && troops.boss) {
    const r = run.call("place_field_enemy", { mapId: floor, x: data.boss.x, y: data.boss.y, troopId: troops.boss, behavior: "stationary", canEscape: false, alert: "anger", id: `ev_${floor}_boss` });
    if (r.ok) {
      const big = enlargeBoss(run, floor, { entryStair: data.entryStair }, /_boss$/, 2.5, warnings, false);
      bossNote = ` · boss at (${data.boss.x},${data.boss.y})${big ? " (drawn large)" : ""}`;
    } else warnings.push(`boss at (${data.boss.x},${data.boss.y}) was not placed: ${String(r.summary).slice(0, 160)}`);
  }
  (data.chests ?? []).forEach((c, i) => {
    const r = run.call("place_chest", { mapId: floor, x: c.x, y: c.y, id: `ev_${floor}_chest${i + 1}`, name: "보물상자", contents: chestLoot(run.ctx.project, i + 3) });
    if (!r.ok) warnings.push(`chest at (${c.x},${c.y}) was not placed: ${String(r.summary).slice(0, 140)}`);
  });
  let healNote = "";
  try { const heal = ensureHealingAccess(run); if (heal.length) healNote = ` · healing: ${heal.join(", ")}`; } catch { /* 회복 넣기 실패는 던전을 깨지 않는다 */ }
  try { const rest = ensureBossRest(run); if (rest.length) healNote += ` · ${rest.join(", ")}`; } catch { /* 쉼터 넣기 실패는 던전을 깨지 않는다 */ }
  const start = run.ctx.project.startPos;
  const entrance = run.ctx.project.startMapId === floor && start ? { mapId: floor, x: start.x, y: start.y } : { mapId: floor, x: data.entryStair.front.x, y: data.entryStair.front.y };
  const g = bboxGraphShape(L);
  const map = run.ctx.project.maps[floor]!;
  return {
    ok: true, mapIds: [floor], entrance,
    summary: `${spec.name}: ${String(L.theme)} floor laid exactly as your layout (${map.width}x${map.height}, ${g.rooms} rooms, ${g.links} links, ${g.loops} loop(s), ${g.branches} side branch(es), ${placedFoes.length} enemies${bossNote}, ${(data.chests ?? []).length} chests)${healNote}`,
    warnings, missingArt: [], calls: run.calls.slice(firstCall), state: { bbox: "dungeon", floors: [floor], graph: g },
  };
}

export const BBOX_DUNGEON_BUILDER: PlaceBuilder = {
  id: "dungeon",
  accepts: (spec) => bboxDungeonSpec(spec) && hasDungeonLayout(spec),
  build: buildDungeon,
};

// ── 마을 빌더 ──
/** 마을 명세의 코드 지형(make_place 가 미리보기로 보여 준 땅). 같은 씨앗·크기면 같은 땅이다. */
export function villageTerrainFor(spec: PlaceSpec): BboxVillageTerrain {
  const va = villageArgs(spec).args; const theme = String(va.theme ?? "river");
  const [width, height] = villageMapSize(spec, va);
  const seed = typeof spec.hints?.terrainSeed === "number" ? Math.max(0, Math.floor(spec.hints.terrainSeed)) : (spec.salt ?? 0) % 100000;
  const t = codeTerrainFor(theme, va, width, height, seed);
  return { W: t.W, H: t.H, levels: Array.from(t.levels), water: Array.from(t.water), theme, river: t.river, crossings: t.crossings, areas: t.areas };
}

function buildVillage(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const firstCall = run.calls.length;
  const prevTerrain = (previous?.result.state as { terrain?: BboxVillageTerrain } | undefined)?.terrain;
  const T = prevTerrain ?? villageTerrainFor(spec);
  const mapId = targetMapId(run, spec, previous);
  const vts = run.ctx.project.tilesets[TS];
  const pre = vts ? checkBboxVillage(bboxVillageCatalog(vts), spec.villageLayout as BboxVillageLayout, T) : { ok: false, errors: ["the beodeul_city chipset is not in this project."] };
  if (!pre.ok) return { ok: false, mapIds: [], summary: `Rejected: ${pre.errors.length} problem(s) in villageLayout`, warnings: pre.errors, missingArt: [], calls: [], state: { bbox: "village", rejected: pre.errors, terrain: T } };
  const laid = run.call("lay_village_layout", { layout: spec.villageLayout, terrain: T, name: spec.name, ...(mapId ? { mapId } : {}) });
  if (!laid.ok) {
    const errors = [String(laid.summary ?? "").replace(/^.*?Rejected:\s*/su, "")];
    return { ok: false, mapIds: [], summary: `Rejected: ${errors.length} problem(s) in villageLayout`, warnings: errors, missingArt: [], calls: run.calls.slice(firstCall), state: { bbox: "village", rejected: errors, terrain: T } };
  }
  const data = (laid.data ?? {}) as { mapId: string; entrance: { x: number; y: number } | null; stats: Record<string, number> };
  const id = data.mapId;
  const project = run.ctx.project;
  // 시작 맵이 이 마을이면 시작 칸을 마을 입구 길로(빈 시작 맵에 지은 판).
  if (project.startMapId === id && data.entrance) project.startPos = { ...project.startPos, x: data.entrance.x, y: data.entrance.y };
  const start = project.startPos;
  const entrance = project.startMapId === id && start ? { mapId: id, x: start.x, y: start.y } : data.entrance ? { mapId: id, ...data.entrance } : undefined;
  const s = data.stats ?? {};
  return {
    ok: true, mapIds: [id], ...(entrance ? { entrance } : {}),
    summary: `${spec.name}: village laid exactly as your layout on the code terrain (${T.W}x${T.H}, ${s.buildings ?? 0} buildings, ${s.props ?? 0} props, ${s.trees ?? 0} trees, ${s.pathCells ?? 0} path cells, ${s.stairs ?? 0} stairs, bare land ${s.bareLandPct ?? 0}%)`,
    warnings: [...(laid.warnings ?? [])], missingArt: [], calls: run.calls.slice(firstCall), state: { bbox: "village", terrain: T },
  };
}

export const BBOX_VILLAGE_BUILDER: PlaceBuilder = {
  id: "village",
  accepts: (spec) => bboxVillageSpec(spec) && hasVillageLayout(spec),
  build: buildVillage,
};

// ── 조각 견본 그림(칩셋 메타에서 뽑은 목록을 사본 맵에 찍어 1배로) ──
const sheets = new WeakMap<TilesetDef, Map<string, { dataUrl?: string; pos: Map<string, { x: number; y: number }> }>>();
async function renderScratch(env: PiAssistantV2Env, project: Project, mapId: string): Promise<string | undefined> {
  if (!env.render) return undefined;
  const m = project.maps[mapId]; if (!m) return undefined;
  const keep = env.ctx.project;
  try { env.ctx.project = project; return await env.render(mapId, 0, 0, m.width, m.height); } catch { return undefined; } finally { env.ctx.project = keep; }
}

export async function dungeonPieceSheet(env: PiAssistantV2Env): Promise<{ dataUrl?: string; pos: Map<string, { x: number; y: number }> }> {
  const ts = env.ctx.project.tilesets[TS];
  if (!ts) return { pos: new Map() };
  const cache = sheets.get(ts) ?? new Map(); sheets.set(ts, cache);
  const hit = cache.get("dungeon"); if (hit) return hit;
  const cat = bboxDungeonCatalog(ts);
  const W = 64; const wallN = cat.filter((p) => p.place === "wall"), floorN = cat.filter((p) => p.place !== "wall");
  const bands: { y: number; h: number }[] = []; const pos = new Map<string, { x: number; y: number }>();
  let y = 4, bx = 2; const BH = 4; bands.push({ y, h: 3 });
  for (const p of wallN) { if (bx + p.w > W - 2) { y += 7; bands.push({ y, h: 3 }); bx = 2; } pos.set(p.name, { x: bx, y: y - 2 - (p.h > 2 ? p.h - 2 : 0) }); bx += p.w + 3; }
  y += 7; bands.push({ y, h: BH }); bx = 2;
  for (const p of floorN) { if (bx + p.w > W - 2) { y += BH + 4; bands.push({ y, h: BH }); bx = 2; } pos.set(p.name, { x: bx, y: y + 1 }); bx += Math.max(p.w, 4) + 2; }
  const H = y + BH + 2;
  const g = new Grid(W, H);
  for (const b of bands) for (let yy = b.y; yy < b.y + b.h; yy += 1) for (let x = 1; x < W - 1; x += 1) { g.floor[yy * W + x] = 1; g.roomAt[yy * W + x] = 0; }
  const out = { pos } as { dataUrl?: string; pos: Map<string, { x: number; y: number }> };
  try {
    const comp = composeExactFloor(ts, "catacomb", { rooms: [{ id: "p", kind: "hall", x: 1, y: 4, w: W - 2, h: H - 6, from: null, dir: null, depth: 0 }], corridors: [], width: W, height: H, notes: [], grid: g, thin: true } as never, new Uint8Array(W * H));
    const lower = comp.lower.slice(), upper = comp.upper.slice();
    const kits = new Map((ts.structureKits ?? []).map((k) => [k.id, k] as const));
    for (const p of cat) { const k = kits.get(p.kitId); const at = pos.get(p.name); if (!k || !at) continue; k.rows.forEach((r, dy) => r.tiles.forEach((t, dx) => { const i = (at.y + dy) * W + at.x + dx; if (i < 0 || i >= W * H) return; if (t >= 0) lower[i] = t; const u = r.upperTiles?.[dx] ?? -1; if (u >= 0) upper[i] = u; })); }
    const scratch = { ...env.ctx, project: cloneProjectSharingSharedDictionaries(env.ctx.project), assistantRun: true } as typeof env.ctx;
    const made = createBuildRun(scratch).call("create_map", { name: "piece sheet", width: W, height: H, tilesetId: TS, border: "none" });
    const id = String((made.data as { mapId?: string; id?: string } | undefined)?.mapId ?? (made.data as { id?: string } | undefined)?.id ?? "");
    const m = scratch.project.maps[id];
    if (made.ok && m) { m.lowerTiles = lower; m.upperTiles = upper; m.events = []; out.dataUrl = await renderScratch(env, scratch.project, id); }
  } catch { /* 견본 그림 없이 글만 */ }
  cache.set("dungeon", out);
  return out;
}

export async function villageKitSheet(env: PiAssistantV2Env): Promise<{ dataUrl?: string; pos: Map<string, { x: number; y: number }> }> {
  const ts = env.ctx.project.tilesets[TS];
  if (!ts) return { pos: new Map() };
  const cache = sheets.get(ts) ?? new Map(); sheets.set(ts, cache);
  const hit = cache.get("village"); if (hit) return hit;
  const cat = bboxVillageCatalog(ts);
  const COLS = 72; const pos = new Map<string, { x: number; y: number }>();
  let x = 1, y = 1, rowH = 0, last = "";
  for (const k of cat) {
    const slotW = Math.max(k.w, 9);
    if (x + slotW > COLS - 1 || (last && last !== k.kind && k.kind !== "boat" && last !== "boat")) { x = 1; y += rowH + 2; rowH = 0; }
    pos.set(k.id, { x, y }); x += slotW + 1; rowH = Math.max(rowH, k.h); last = k.kind;
  }
  const W = COLS, H = y + rowH + 2;
  const out = { pos } as { dataUrl?: string; pos: Map<string, { x: number; y: number }> };
  try {
    const scratch = { ...env.ctx, project: cloneProjectSharingSharedDictionaries(env.ctx.project), assistantRun: true } as typeof env.ctx;
    const run = createBuildRun(scratch);
    const made = run.call("create_map", { name: "kit sheet", width: W, height: H, tilesetId: TS, border: "none" });
    const id = String((made.data as { mapId?: string; id?: string } | undefined)?.mapId ?? (made.data as { id?: string } | undefined)?.id ?? "");
    if (made.ok && scratch.project.maps[id]) {
      // 견본 사본에는 도구를 바로 돌린다 — run.call 은 호출마다 기록·사본을 만들어 208개에 200초를 넘겼고
      // (2026-10-31 부하 박스 실측), 그동안 조수 스트림이 끊겨 포구 판이 모두 「terminated」로 끝났다.
      const fill = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "fill_region")!, stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;
      const direct = (tool: typeof fill, args: Record<string, unknown>) => { try { tool.run(scratch.project, args); } catch { /* 한 견본이 실패해도 나머지는 그린다 */ } };
      direct(fill, { mapId: id, rect: { x: 0, y: 0, w: W, h: H }, material: "버들항 풀밭", clearUpper: true, _exactCells: true });
      for (const k of cat) {
        const at = pos.get(k.id)!;
        if (k.kind === "boat") direct(fill, { mapId: id, rect: { x: at.x, y: at.y, w: k.w, h: k.h }, material: "버들항 강·운하 물", _exactCells: true });
        direct(stamp, { objectId: `kit:${TS}/${k.id}`, mapId: id, x: at.x, y: at.y });
      }
      out.dataUrl = await renderScratch(env, scratch.project, id);
    }
  } catch { /* 견본 그림 없이 글만 */ }
  cache.set("village", out);
  return out;
}

const pushImage = (res: PiToolExecResult, dataUrl: string | undefined): void => {
  if (!dataUrl) return;
  const comma = dataUrl.indexOf(",");
  res.content.push({ type: "image", mimeType: "image/png", data: dataUrl.slice(comma + 1) });
};
const pushPng = (res: PiToolExecResult, png: Uint8Array): void => {
  let bin = ""; for (let k = 0; k < png.length; k += 1) bin += String.fromCharCode(png[k]!);
  res.content.push({ type: "image", mimeType: "image/png", data: btoa(bin) });
};
const textRes = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

// ── 되돌려 보내기 카드(영어) ──
export async function dungeonLayoutCard(env: PiAssistantV2Env, spec: PlaceSpec, task: string, context: string): Promise<PiToolExecResult> {
  const ts = env.ctx.project.tilesets[TS]!;
  const sheet = await dungeonPieceSheet(env);
  const cat = bboxDungeonCatalog(ts);
  const lines = [
    `Not built yet (this is not a failure). You design the dungeon floor "${spec.name}" yourself as an exact cell layout: call make_place again with the same spec plus spec.dungeonLayout = your layout object (format below). Your layout is laid onto the map cell by cell by code that only checks and executes it — every room, corridor, door, hazard and piece you write is exactly what appears; nothing is added, moved or decorated for you. The boss, enemies and chests stand on the cells you give.`,
    `User request: ${task}`,
    ...(context ? [`Context: ${context}`] : []),
    `Image 1 = the piece sheet: every catalog piece drawn at real size (16 px per cell) in a real wall/floor setting; "sheet (x,y)" in the catalog is its top-left cell on that sheet (pixel = 16*x, 16*y).`,
    "",
    bboxDungeonCatalogText(cat, sheet.dataUrl ? sheet.pos : undefined),
    "",
    "# Grid rules (the checker rejects the layout if any is broken)",
    ...BBOX_DUNGEON_RULES.map((r) => `- ${r}`),
    "",
    "# Layout format (spec.dungeonLayout)",
    BBOX_DUNGEON_FORMAT,
    `"repeat" is optional. theme picks the wall/floor art: ${BBOX_DUNGEON_THEMES.join(" | ")} (catacomb = grey crypt stone, castle = castle stone, temple = pale temple stone — a flooded or sunken place uses water hazards).`,
    "Design a specific floor that fits the request: rooms of different sizes and shapes, a route with choices — at least one loop or side branch, not a single line of rooms — hazards that shape the walk, and a clear climax at the boss. Use the whole map.",
  ];
  const res = textRes(lines.join("\n"));
  pushImage(res, sheet.dataUrl);
  return res;
}

export async function villageLayoutCard(env: PiAssistantV2Env, spec: PlaceSpec, task: string, T: BboxVillageTerrain): Promise<PiToolExecResult> {
  const ts = env.ctx.project.tilesets[TS]!;
  const sheet = await villageKitSheet(env);
  const cat = bboxVillageCatalog(ts);
  const catText = bboxVillageCatalogText(cat).split("\n").map((line) => {
    const id = line.split(" | ")[0]!; const at = sheet.dataUrl ? sheet.pos.get(id) : undefined;
    return at ? `${line} | sheet (${at.x},${at.y})` : line;
  }).join("\n");
  const lines = [
    `Not built yet (this is not a failure). The land of "${spec.name}" was made by code (${T.W}x${T.H} cells). You design the village yourself as an exact cell layout on top of it: call make_place again with the same spec plus spec.villageLayout = your layout object (format below). Your layout is executed cell by cell by code that only paints what you write — every road, plaza, stair, building, field, fence, forest, tree and prop you write is exactly what appears, and NOTHING else is added (no automatic trees, roads or decoration). Empty cells stay plain grass. To get a different land instead, change hints.landform / water / high or hints.terrainSeed and call make_place without a layout.`,
    `User request: ${task}`,
    "Image 1 = the terrain: lighter green = higher level, black lines = level borders (cliffs), blue = water, white dots = good bridge spots; grid lines every 5 cells with x/y labels.",
    ...(sheet.dataUrl ? ["Image 2 = the kit sheet: every building/prop/tree drawn at real size (16 px per cell); \"sheet (x,y)\" in the catalog is its top-left cell on that sheet."] : []),
    "",
    bboxTerrainText(T),
    "",
    catText,
    "",
    "# Rules (the checker rejects the layout if any is broken)",
    ...BBOX_VILLAGE_RULES.map((r) => `- ${r}`),
    "",
    "# Layout format (spec.villageLayout)",
    BBOX_VILLAGE_FORMAT,
  ];
  const res = textRes(lines.join("\n"));
  const png = terrainPreviewPng({ ...T, levels: Uint8Array.from(T.levels), water: Uint8Array.from(T.water), river: T.river ?? [], crossings: T.crossings ?? [], areas: T.areas ?? [] } as never, 8);
  pushPng(res, png);
  pushImage(res, sheet.dataUrl);
  return res;
}

/** 거절된 배치: 문제 목록(칸 좌표) + 고친 호출. 남은 횟수가 없으면 undefined(부른 쪽이 옛 빌더로 짓는다). */
export function layoutRejectText(kind: "dungeon" | "village", spec: PlaceSpec, errors: readonly string[], left: number): PiToolExecResult {
  const field = kind === "dungeon" ? "dungeonLayout" : "villageLayout";
  return textRes({
    ok: false, notFailure: true,
    summary: `Rejected: the checker found ${errors.length} problem(s) in spec.${field} of "${spec.name}" — nothing was built. Fixed call: fix every problem below and call make_place again with the same spec and the full corrected ${field} (same format). ${left} repair(s) left; after that the old automatic builder is used instead of your layout.`,
    problems: errors.slice(0, 40),
  });
}

// ── 배치 상자 그림(자기 비평용 — 1배 그림 옆에) ──
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"], "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"], "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"], "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"], "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
};
const PAL: [number, number, number][] = [
  [24, 24, 28], [235, 235, 235], [10, 10, 10], [50, 50, 56], // 0 여백 1 글자 2 선 3 바위
  [58, 110, 168], [200, 70, 40], [20, 20, 20], [140, 110, 70], // 4 물 5 용암 6 구덩이 7 다리
  [110, 110, 120], // 8 통로
  [90, 150, 90], [160, 120, 200], [210, 180, 80], [200, 120, 60], [120, 160, 210], [200, 60, 60], [150, 150, 150], // 9..15 방: entrance guard? 순서 아래
  [255, 255, 255], [255, 220, 0], [255, 60, 60], [255, 140, 0], // 16 문 17 상자 18 적 19 보스
  [60, 100, 50], [90, 140, 70], [130, 175, 90], [170, 200, 110], [200, 220, 140], [225, 235, 170], // 20..25 단 0~5
  [170, 170, 175], [215, 205, 170], [200, 190, 120], [190, 60, 50], [230, 200, 60], [30, 80, 30], [60, 160, 60], [240, 140, 40], [245, 245, 245], // 26 길 27 광장 28 모랫길 29 집 30 밭 31 숲 32 나무 33 소품 34 계단
];
const PURPOSE_COLOR: Record<string, number> = { entrance: 9, guard: 10, puzzle: 11, treasure: 12, antechamber: 13, boss: 14, other: 15 };
function crc32(b: Uint8Array): number { let c = ~0; for (let i = 0; i < b.length; i += 1) { c ^= b[i]!; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
}
function zstore(raw: Uint8Array): Uint8Array {
  const parts: number[] = [0x78, 0x01];
  for (let o = 0; o < raw.length; o += 65535) { const n = Math.min(65535, raw.length - o); parts.push(o + n >= raw.length ? 1 : 0, n & 255, n >> 8, ~n & 255, (~n >> 8) & 255); for (let i = 0; i < n; i += 1) parts.push(raw[o + i]!); }
  let a = 1, b = 0; for (let i = 0; i < raw.length; i += 1) { a = (a + raw[i]!) % 65521; b = (b + a) % 65521; }
  parts.push((b >> 8) & 255, b & 255, (a >> 8) & 255, a & 255); return Uint8Array.from(parts);
}
function png(w: number, h: number, px: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3;
  const plte = new Uint8Array(PAL.length * 3); PAL.forEach((c, i) => plte.set(c, i * 3));
  const raw = new Uint8Array((w + 1) * h); for (let y = 0; y < h; y += 1) raw.set(px.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const parts = [Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", zstore(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

/** 배치 JSON 을 칸 상자 그림으로(8px/칸, 5칸 눈금·10칸 번호). 던전: 방 색 = 목적, 통로 회색, 문 흰색, 물·용암·구덩이, 상자 노랑·적 빨강·보스 주황, 조각 테두리. 마을: 지형 위 길·광장·집·밭·숲·나무·소품·계단. */
export function layoutBoxesPng(kind: "dungeon" | "village", layout: unknown, opts: { W: number; H: number; terrain?: BboxVillageTerrain; pieces?: readonly [string, number, number, string][]; pieceSize?: (id: string) => { w: number; h: number } | undefined }): Uint8Array {
  const S = 8, M = 16, W = opts.W, H = opts.H;
  const w = M + W * S, h = M + H * S; const px = new Uint8Array(w * h);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = v; };
  const cell = (cx: number, cy: number, v: number, inset = 0) => { for (let j = inset; j < S - inset; j += 1) for (let i = inset; i < S - inset; i += 1) set(M + cx * S + i, M + cy * S + j, v); };
  const rectFill = (r: { x: number; y: number; w?: number; h?: number }, v: number) => { for (let y = r.y; y < r.y + (r.h ?? 1); y += 1) for (let x = r.x; x < r.x + (r.w ?? 1); x += 1) if (x >= 0 && y >= 0 && x < W && y < H) cell(x, y, v); };
  const rectLine = (r: { x: number; y: number; w?: number; h?: number }, v: number) => {
    const x0 = M + r.x * S, y0 = M + r.y * S, x1 = M + (r.x + (r.w ?? 1)) * S - 1, y1 = M + (r.y + (r.h ?? 1)) * S - 1;
    for (let x = x0; x <= x1; x += 1) { set(x, y0, v); set(x, y1, v); } for (let y = y0; y <= y1; y += 1) { set(x0, y, v); set(x1, y, v); }
  };
  const text = (s: string, x: number, y: number, v = 1) => { let cx = x; for (const ch of s) { const g = FONT[ch]; if (g) g.forEach((row, j) => [...row].forEach((b, i) => { if (b === "1") set(cx + i, y + j, v); })); cx += 4; } };
  const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  if (kind === "dungeon") {
    const L = (layout ?? {}) as BboxDungeonLayout;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) cell(x, y, 3);
    for (const r of L.rooms ?? []) for (const q of r.rects ?? (num(r.x) ? [{ x: r.x!, y: r.y!, w: r.w!, h: r.h! }] : [])) rectFill(q, PURPOSE_COLOR[r.purpose] ?? 15);
    for (const c of L.corridors ?? []) {
      const wd = Math.max(1, Math.min(3, Number(c.width ?? 1)));
      const path = Array.isArray(c.path) ? c.path : [];
      for (let k = 0; k + 1 < path.length; k += 1) {
        const [ax, ay] = path[k]!, [bx, by] = path[k + 1]!;
        for (let t = 0; t <= Math.max(Math.abs(bx - ax), Math.abs(by - ay)); t += 1) { const x = ax + Math.sign(bx - ax) * t, y = ay + Math.sign(by - ay) * t; rectFill({ x, y, w: wd, h: wd }, 8); }
      }
    }
    for (const z of L.hazards ?? []) rectFill(z, z.kind === "lava" ? 5 : z.kind === "pit" ? 6 : 4);
    for (const b of L.bridges ?? []) rectFill(b, 7);
    for (const r of L.rooms ?? []) for (const q of r.rects ?? (num(r.x) ? [{ x: r.x!, y: r.y!, w: r.w!, h: r.h! }] : [])) rectLine(q, 2);
    for (const p of opts.pieces ?? []) { const sz = opts.pieceSize?.(p[0]); rectLine({ x: p[1], y: p[2], w: sz?.w ?? 1, h: sz?.h ?? 1 }, 1); }
    for (const d of L.doors ?? []) if (num(d.x)) cell(d.x, d.y, d.locked ? 6 : 16, 1);
    for (const c of L.chests ?? []) if (num(c.x)) cell(c.x, c.y, 17, 2);
    for (const e of L.enemies ?? []) if (num(e.x)) cell(e.x, e.y, 18, 2);
    if (L.boss && num(L.boss.x)) cell(L.boss.x, L.boss.y, 19, 0);
  } else {
    const L = (layout ?? {}) as BboxVillageLayout; const T = opts.terrain!;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const c = y * W + x; const wv = T.water[c]!; cell(x, y, wv ? 4 : 20 + Math.min(5, T.levels[c]!)); }
    for (const f of L.forests ?? []) rectFill(f, 31);
    for (const f of L.fields ?? []) rectFill(f, 30);
    for (const rd of L.roads ?? []) for (const r of rd.rects ?? []) rectFill(r, rd.kind === "track" ? 28 : rd.kind === "pier" ? 7 : 26);
    for (const p of L.plazas ?? []) rectFill(p, 27);
    for (const s of L.stairs ?? []) rectFill(s, 34);
    for (const f of L.fences ?? []) rectLine(f, 2);
    const kits = new Map(bboxVillageCatalogKits.map((k) => [k.id, k] as const));
    for (const b of L.buildings ?? []) { const k = kits.get(b.id); if (k && num(b.x)) { rectFill({ x: b.x, y: b.y, w: k.w, h: k.h }, 29); rectLine({ x: b.x, y: b.y, w: k.w, h: k.h }, 2); if (k.door) cell(b.x + k.door.dx, b.y + k.door.dy, 16, 2); } }
    for (const t of L.trees ?? []) { const k = kits.get(t.id); if (k && num(t.x)) rectFill({ x: t.x, y: t.y, w: k.w, h: k.h }, 32); }
    for (const p of L.props ?? []) { const k = kits.get(p.id); if (k && num(p.x)) rectFill({ x: p.x, y: p.y, w: k.w, h: k.h }, 33); }
  }
  for (let k = 0; k <= Math.max(W, H); k += 5) {
    const strong = k % 10 === 0;
    if (k <= W) for (let y = M; y < h; y += strong ? 1 : 3) set(M + k * S, y, 2);
    if (k <= H) for (let x = M; x < w; x += strong ? 1 : 3) set(x, M + k * S, 2);
    if (k < W) text(String(k), M + k * S + 1, 5); if (k < H) text(String(k), 1, M + k * S + 2);
  }
  return png(w, h, px);
}
/** 마을 상자 그림이 조각 크기를 찾을 목록(마지막으로 만든 목록 — 칩셋 하나라 같다). */
let bboxVillageCatalogKits: ReturnType<typeof bboxVillageCatalog> = [];

/** 지은 뒤 붙이는 자기 비평 글 + 배치 상자 그림. 바퀴가 다 찼으면 아무것도 붙이지 않는다. */
export function attachLayoutCritique(res: PiToolExecResult, env: PiAssistantV2Env, session: object, mapId: string, spec: PlaceSpec, state?: unknown): void {
  const st = layoutSession(session).byMap.get(mapId);
  if (!st || st.critiqueRounds >= LAYOUT_CRITIQUE_ROUNDS) return;
  const map = env.ctx.project.maps[mapId]; if (!map) return;
  const ts = env.ctx.project.tilesets[TS];
  const field = st.kind === "dungeon" ? "dungeonLayout" : "villageLayout";
  const layout = st.kind === "dungeon" ? spec.dungeonLayout : spec.villageLayout;
  let boxes: Uint8Array | undefined;
  try {
    if (st.kind === "dungeon") {
      const decl = readLayoutDecl(map)?.decl as { pieces?: [string, number, number, string][] } | undefined;
      const kits = new Map((ts?.structureKits ?? []).map((k) => [k.id, k] as const));
      boxes = layoutBoxesPng("dungeon", layout, { W: map.width, H: map.height, pieces: decl?.pieces ?? [], pieceSize: (id) => { const k = kits.get(id); return k ? { w: k.width, h: k.height } : undefined; } });
    } else {
      const T = (state as { terrain?: BboxVillageTerrain } | undefined)?.terrain;
      if (T && ts) { bboxVillageCatalogKits = bboxVillageCatalog(ts); boxes = layoutBoxesPng("village", layout, { W: T.W, H: T.H, terrain: T }); }
    }
  } catch { boxes = undefined; }
  const round = st.critiqueRounds + 1;
  const loopNote = st.kind === "dungeon" && st.graph && st.graph.loops === 0 && st.graph.branches === 0 ? ` Note: your room graph is a single line (${st.graph.rooms} rooms, longest chain ${st.graph.longestChain}) — a good floor has at least one loop or side branch.` : "";
  res.content.push({ type: "text", text: [
    `Self-critique round ${round} of ${LAYOUT_CRITIQUE_ROUNDS} for "${spec.name}" (${mapId}). The first image above is the built map at 1x; the last image is your layout as boxes on the same grid (8 px per cell, grid every 5 cells${st.kind === "dungeon" ? "; room colours = purpose, grey = corridor, white = door, black = locked door, yellow = chest, red = enemy, orange = boss, thin white outlines = pieces" : "; grey = road, sand = track, light = plaza, red = building with white door, yellow = field, dark green = forest, green = tree, orange = prop, white = stairs"}).`,
    `Compare the map with the request and your intent like a strict reviewer: empty or monotonous areas, ${st.kind === "dungeon" ? "a route that is a single line, rooms without a clear role, unreadable boss approach, hazards that do not shape the walk" : "areas of bare grass, roads that do not follow the land, buildings without purpose or facing nothing, a missing centre or landmark, fields/woods that look pasted"}, pieces that look wrong where they stand.${loopNote}`,
    `Then do exactly one of: (a) call edit_place {patch: {mapId: "${mapId}", set: {${field}: <the FULL corrected layout>}}} — the place is re-laid exactly from it; or (b) if nothing should change, call edit_place {patch: {mapId: "${mapId}", layoutReview: "<what you checked and why it is good>"}}. Either one counts as this round.`,
  ].join("\n") });
  if (boxes) pushPng(res, boxes);
}

/** 할 일 고리 관문 문제(열쇠 place:<맵>:layout-<면>) — 지금 맵에서 다시 잰다. fixable = 고치기 상한 전인 맵. */
export function placeLayoutProblems(project: Project, session: object, fixable: (mapId: string) => boolean): { key: string; text: string; source: "gate" }[] {
  const out: { key: string; text: string; source: "gate" }[] = [];
  for (const [mapId, st] of layoutSession(session).byMap) {
    const map = project.maps[mapId];
    if (!map || !fixable(mapId)) continue;
    const decl = readLayoutDecl(map);
    const field = st.kind === "dungeon" ? "dungeonLayout" : "villageLayout";
    const add = (aspect: string, text: string) => out.push({ key: `place:${mapId}:layout-${aspect}`, text: `${st.name}(${mapId}) ${text}`, source: "gate" });
    if (!decl) { add("items", `the layout declaration is gone from the map — re-lay the place with edit_place {patch:{mapId:"${mapId}", set:{${field}: <full layout>}}}.`); continue; }
    if (st.kind === "dungeon") {
      const d = decl.decl as { boss?: { x: number; y: number } | null; enemies?: { x: number; y: number }[]; chests?: { x: number; y: number }[]; pieces?: [string, number, number, string][]; stairsUp?: { front: { x: number; y: number } }; rooms?: { id: string; purpose: string; x: number; y: number; w: number; h: number }[] };
      const evAt = (x: number, y: number, re: RegExp) => map.events.some((e) => re.test(e.id) && Math.abs(e.x - x) + Math.abs(e.y - y) <= 2);
      const missing: string[] = [];
      if (d.boss && !evAt(d.boss.x, d.boss.y, /_boss$/)) missing.push(`boss at (${d.boss.x},${d.boss.y})`);
      for (const c of d.chests ?? []) if (!map.events.some((e) => /chest/.test(e.id) && e.x === c.x && e.y === c.y)) missing.push(`chest at (${c.x},${c.y})`);
      const foes = map.events.filter((e) => /_v2foe\d/.test(e.id)).length;
      if (foes < (d.enemies ?? []).length) missing.push(`${(d.enemies ?? []).length - foes} enemy(ies)`);
      if (missing.length) add("items", `layout items missing on the map: ${missing.slice(0, 6).join(", ")} — move them to free walkable cells in your layout and re-lay with edit_place set.${field}.`);
      // 이어짐·보스 앞방: 입구 착지에서 걸어 닿는지(지금 맵 기준 — 뒤에 놓인 이벤트·물건이 길을 막았나).
      const front = d.stairsUp?.front;
      if (front) {
        const reach = terrainReachability(project, map, front);
        const W = map.width;
        const unreached = (d.rooms ?? []).filter((r) => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (reach[y * W + x]) return false; return true; });
        if (unreached.length) add("connected", `rooms not reachable on foot from the entrance (${front.x},${front.y}): ${unreached.map((r) => `${r.id}(${r.x},${r.y})`).join(", ")} — open the way in your layout (doors, bridges, pieces that block) and re-lay.`);
        const boss = (d.rooms ?? []).find((r) => r.purpose === "boss"), ante = (d.rooms ?? []).find((r) => r.purpose === "antechamber");
        if (boss && ante) {
          // 앞방 칸을 막고 보스방에 닿으면 앞방을 거치지 않는 길이 있다.
          const blocked = new Uint8Array(W * map.height);
          for (let y = ante.y; y < ante.y + ante.h; y += 1) for (let x = ante.x; x < ante.x + ante.w; x += 1) blocked[y * W + x] = 1;
          const q = [front.y * W + front.x]; const seen = new Uint8Array(W * map.height); seen[q[0]!] = 1; let bypass = false;
          for (let k = 0; k < q.length && !bypass; k += 1) { const c = q[k]!, x = c % W, y = (c - x) / W;
            if (x >= boss.x && y >= boss.y && x < boss.x + boss.w && y < boss.y + boss.h) bypass = true;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= map.height) continue; const n = ny * W + nx; if (seen[n] || blocked[n] || !reach[n]) continue; seen[n] = 1; q.push(n); } }
          if (bypass) add("boss_gate", `the boss room "${boss.id}" can be reached without passing the antechamber "${ante.id}" — make the antechamber the only way in and re-lay.`);
        }
      }
    } else {
      const d = decl.decl as { doors?: { id: string; front: { x: number; y: number } }[]; entrance?: { x: number; y: number } | null };
      const start = d.entrance ?? undefined;
      if (start) {
        const reach = terrainReachability(project, map, start);
        const bad = (d.doors ?? []).filter((q) => !reach[q.front.y * map.width + q.front.x]);
        if (bad.length) add("doors_roads", `house doors not reachable on foot from the village entrance (${start.x},${start.y}): ${bad.slice(0, 6).map((q) => `${q.id} door front (${q.front.x},${q.front.y})`).join(", ")} — connect their door front cells to the road network (stairs for level changes) and re-lay.`);
      } else add("connected", `no road reaches a dry map edge (no village entrance) — give one main road to the map edge and re-lay.`);
    }
    if (st.critiqueRounds < LAYOUT_CRITIQUE_ROUNDS) add("critique", `self-critique round ${st.critiqueRounds + 1} of ${LAYOUT_CRITIQUE_ROUNDS} not done: compare the built map with your layout and the request, then call edit_place {patch:{mapId:"${mapId}", set:{${field}: <full corrected layout>}}} or edit_place {patch:{mapId:"${mapId}", layoutReview:"<what you checked>"}}.`);
  }
  return out;
}

export { BBOX_DECL_TAG };

// ── 동사 스키마(영어 — 자유 키 객체 없이) ──
const I = { type: "integer" } as const;
const RECT = { type: "object", properties: { x: I, y: I, w: I, h: I }, required: ["x", "y", "w", "h"] } as const;
const PUT = { type: "object", properties: { id: { type: "string", description: "exact piece id from the catalog" }, x: I, y: I,
  repeat: { type: "object", properties: { count: I, dx: I, dy: I }, description: "optional: repeat the piece count times, stepping dx,dy" } }, required: ["id", "x", "y"] } as const;
const CELL = { type: "object", properties: { x: I, y: I }, required: ["x", "y"] } as const;
export const DUNGEON_LAYOUT_SCHEMA = {
  type: "object",
  description: "(dungeon) your exact cell layout of the floor — format and rules come with the make_place card. The function only checks and lays it.",
  properties: {
    name: { type: "string" }, theme: { type: "string", enum: [...BBOX_DUNGEON_THEMES] },
    map: { type: "object", properties: { w: I, h: I }, required: ["w", "h"] },
    rooms: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, purpose: { type: "string", enum: ["entrance", "guard", "puzzle", "treasure", "antechamber", "boss", "other"] },
      rects: { type: "array", items: RECT }, landmark: PUT, note: { type: "string" } }, required: ["id", "purpose", "rects"] } },
    corridors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, from: { type: "string" }, to: { type: "string" }, width: I,
      path: { type: "array", items: { type: "array", items: I }, description: "waypoints [[x,y],...]" } }, required: ["id", "from", "to", "path"] } },
    doors: { type: "array", items: { type: "object", properties: { x: I, y: I, connects: { type: "array", items: { type: "string" } }, locked: { type: "boolean" } }, required: ["x", "y", "connects"] } },
    hazards: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["water", "lava", "pit"] }, x: I, y: I, w: I, h: I }, required: ["kind", "x", "y", "w", "h"] } },
    bridges: { type: "array", items: RECT },
    objects: { type: "array", items: PUT },
    traps: { type: "array", items: PUT },
    chests: { type: "array", items: CELL },
    enemies: { type: "array", items: CELL },
    boss: CELL,
  },
  required: ["theme", "map", "rooms", "corridors", "doors"],
} as const;
const KITPUT = { type: "object", properties: { id: { type: "string", description: "exact kit id from the catalog" }, x: I, y: I, purpose: { type: "string" } }, required: ["id", "x", "y"] } as const;
export const VILLAGE_LAYOUT_SCHEMA = {
  type: "object",
  description: "(village on code terrain) your exact cell layout of the village — format and rules come with the make_place terrain card. The function only checks and paints it.",
  properties: {
    name: { type: "string" },
    zones: { type: "array", items: { type: "object", properties: { name: { type: "string" }, purpose: { type: "string" }, x: I, y: I, w: I, h: I }, required: ["name"] } },
    roads: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["main", "lane", "track", "pier"] }, purpose: { type: "string" }, rects: { type: "array", items: RECT } }, required: ["kind", "rects"] } },
    plazas: { type: "array", items: { type: "object", properties: { x: I, y: I, w: I, h: I, purpose: { type: "string" } }, required: ["x", "y", "w", "h"] } },
    stairs: { type: "array", items: { type: "object", properties: { x: I, y: I, w: I, h: I, dir: { type: "string", enum: ["north", "south"] } }, required: ["x", "y", "w", "h", "dir"] } },
    buildings: { type: "array", items: KITPUT },
    fields: { type: "array", items: { type: "object", properties: { crop: { type: "string", enum: ["wheat", "barley", "rye", "vines", "herbs", "flowers"] }, x: I, y: I, w: I, h: I }, required: ["crop", "x", "y", "w", "h"] } },
    fences: { type: "array", items: { type: "object", properties: { x: I, y: I, w: I, h: I, gate: { type: "array", items: I, description: "[gx, gy]" } }, required: ["x", "y", "w", "h", "gate"] } },
    forests: { type: "array", items: RECT },
    trees: { type: "array", items: KITPUT },
    props: { type: "array", items: KITPUT },
  },
  required: ["roads", "buildings"],
} as const;

/** 코드 지형(CodeTerrain) → 칸 배치 지형. */
export function toBboxTerrain(t: { W: number; H: number; levels: ArrayLike<number>; water: ArrayLike<number>; river?: number[]; crossings?: { x: number; y: number; dir: string }[]; areas?: BboxVillageTerrain["areas"] }, theme: string): BboxVillageTerrain {
  return { W: t.W, H: t.H, levels: Array.from(t.levels), water: Array.from(t.water), theme, river: t.river, crossings: t.crossings, areas: t.areas };
}
