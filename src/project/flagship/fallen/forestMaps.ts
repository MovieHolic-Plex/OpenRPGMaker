/**
 * 폴른 스타 · 속삭이는 숲을 여러 맵으로 나눈다 (2026-10-24 사용자 「숲은 탐험하는 느낌이어야 한다」).
 *
 * 예전 숲은 남쪽 입구 → 북쪽 추락지 공터까지 한 줄 길 한 장(30×40)이었다. 이제 여섯 장이 이어진다.
 *
 *   왕도 동문 ─ ① 숲 어귀(봉화·이정표 갈림목) ─┬─ 동 ─ ② 옛 수로(돌다리) ─┬─ 북 ─ ④ 별지기 사당 터 ─ 북 ─ ⑤ 깊은 숲(브람·추락지)
 *                                            │                         └─ 남동 ─ ⑥ 사냥꾼 쉼터(막다른 곳·상자)
 *                                            └─ 북 ─ ③ 가시덤불 샛길(갈림길·막다른 곁길 상자) ─ 동 ─ ④
 *
 * ①→②→④ 와 ①→③→④ 는 고리다(어느 쪽으로 가도 사당 터에서 만난다). 막다른 곳(③ 곁길 끝·⑥)에는 반드시 상자가 있다.
 * ④ 사당 터는 짐승이 들지 않는 쉼터(조우 없음)이고 사당 앞 공물 상자가 있다.
 * ⑤ 는 원래 숲 맵(fs_forest)의 북쪽 27줄이다 — 관·이리스·브람·표지석·불씨 자국·연기 같은 이야기 장치는 그 자리에 그대로 둔다.
 * 남쪽 굽은 숲길 토막(27~39줄)은 잘라 내고, 그 길이만큼의 걸음은 앞 맵들이 맡는다.
 *
 * 칠하기는 원래 숲과 같은 버들항 시공(wildRouteBeodeul.paintBeodeulWildRoute — author_wild_route 의 몸통)이다:
 * 모랫길 오토타일 → 버들항 수관 오토타일 숲 벽(#3259 planBeodeulCanopy, 2026-10-24 plantBeodeulForestWall) → 길섶 소품 → 숲 바닥 잔디.
 * 길 계획기(planRouteCorridor)는 출구를 차례로 잇는 한 줄 길만 그어 갈림길·막다른 곁길·광장을 못 만들어, 길 모양만 여기서 손으로 정한다.
 */
import { runTool } from "@/editor/tools/toolRunner";
import { pickSpot, placeRoamer } from "@/editor/tools/jrpgVolumeTools";
import { BEODEUL_PLAIN_GRASS, paintBeodeulWildRoute } from "@/editor/tools/wildRouteBeodeul";
import { isPassable } from "@/project/collision";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { FS_PREFIX } from "../fallenStarStory";
import { FS_FIRE_FLASK, FS_HI_POTION, FS_STAR_SCENT } from "./battleItems";

export const FS_FOREST_MAP_IDS = {
  edge: "fs_forest_edge",
  stream: "fs_forest_stream",
  thicket: "fs_forest_thicket",
  shrine: "fs_forest_shrine",
  glade: "fs_forest_glade",
} as const;

/** 깊은 숲(원래 숲 맵)을 이 높이로 자른다 — 0~26줄(추락지·브람·표지석)만 남는다. */
const DEEP_GROVE_HEIGHT = 27;

type Cell = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Dir = "up" | "down" | "left" | "right";
type Encounter = { troopId: string; weight: number };

export interface FallenForestHelpers {
  /** chronoBell.ts 의 숲 바닥 덮개(고사리·히스 덩이) — 원래 숲과 같은 밀도로. */
  readonly understory: (mapId: string) => void;
}

function tool(project: Project, name: string, args: Record<string, unknown>): { data?: unknown; warnings?: unknown } {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[fallen-forest] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return res as { data?: unknown; warnings?: unknown };
}

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as Command);

function readable(map: GameMap, key: string, name: string, at: Cell, commands: Command[]): void {
  const id = `ev_${FS_PREFIX}_forest_${key}`;
  map.events = map.events.filter((e) => e.id !== id);
  map.events.push({
    id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: `${id}_p`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
    } as unknown as EventPage],
  } as unknown as GameEvent);
}

function trailOf(project: Project, map: GameMap): Set<number> {
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const out = new Set<number>();
  for (let i = 0; i < map.lowerTiles.length; i += 1) if ((meta[map.lowerTiles[i]!]?.label ?? "").startsWith("버들항 · 모랫길")) out.add(i);
  return out;
}

const transfersIn = (event: GameEvent): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [];
  const walk = (list: Command[] | undefined): void => {
    for (const c of list ?? []) {
      const rec = c as unknown as Record<string, unknown>;
      if (rec.kind === "transfer") out.push(rec);
      for (const key of ["then", "else", "branch", "cancelBranch"]) if (Array.isArray(rec[key])) walk(rec[key] as Command[]);
      if (Array.isArray(rec.options)) for (const o of rec.options as { branch?: Command[] }[]) walk(o.branch);
    }
  };
  walk(event.commands);
  for (const page of event.pages ?? []) walk(page.commands);
  return out;
};

/** 가장자리 칸에서 맵 안쪽으로 한 칸 — 도착 칸·도착 방향(출구를 등지고 안쪽을 본다). */
function inward(map: GameMap, at: Cell): { cell: Cell; dir: Dir } {
  if (at.y === map.height - 1) return { cell: { x: at.x, y: at.y - 1 }, dir: "up" };
  if (at.y === 0) return { cell: { x: at.x, y: 1 }, dir: "down" };
  if (at.x === 0) return { cell: { x: 1, y: at.y }, dir: "right" };
  if (at.x === map.width - 1) return { cell: { x: at.x - 1, y: at.y }, dir: "left" };
  return { cell: { x: at.x, y: at.y + 1 }, dir: "down" };
}

/**
 * 숲 맵 한 장의 설계. 길은 두 칸 폭 꺾은선(점 = 길의 왼쪽 위 칸; 세로 토막은 x·x+1, 가로 토막은 y·y+1).
 * 수관 마스크는 4칸보다 좁은 숲 띠를 버린다(shapeBeodeulCanopyMask minExtent 4) — 길섶 1칸씩을 더해 나란한 길 사이·길과 맵 끝 사이는
 * 6칸 이상 띄운다. 모자라면 그 띠가 맨 풀밭으로 열려 벽이 사라진다. 아래 좌표는 모두 그 간격을 지킨다.
 */
interface ForestSpec {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly paths: readonly (readonly Cell[])[];
  /** 가장자리 출구 칸(문이 설 칸 — 두 칸 폭 길의 왼쪽/위쪽 칸). */
  readonly exits: readonly Cell[];
  /** 나무를 심지 않는 풀밭(소품·사건 자리). */
  readonly clearings?: readonly Rect[];
  /** 물(버들항 강·운하 물) — 길보다 먼저 칠해 숲이 물가에서 멈춘다. */
  readonly water?: readonly Rect[];
  /** 길이 지나가도 모랫길을 칠하지 않는 칸(다리 밑 물). */
  readonly bridges?: readonly Rect[];
  readonly encounters: readonly Encounter[];
}

function carve(width: number, height: number, paths: ForestSpec["paths"]): Set<number> {
  const out = new Set<number>();
  for (const line of paths) for (let k = 0; k + 1 < line.length; k += 1) {
    const a = line[k]!, b = line[k + 1]!;
    if (a.x !== b.x && a.y !== b.y) throw new Error(`[fallen-forest] 길 토막은 곧아야 한다: (${a.x},${a.y})→(${b.x},${b.y})`);
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y) + 1; y += 1) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x) + 1; x += 1) {
      if (x >= 0 && y >= 0 && x < width && y < height) out.add(y * width + x);
    }
  }
  return out;
}

const inRects = (rects: readonly Rect[] | undefined, x: number, y: number): boolean =>
  (rects ?? []).some((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);

function createForest(project: Project, spec: ForestSpec): GameMap {
  tool(project, "create_map", { id: spec.id, name: spec.name, width: spec.width, height: spec.height, themeScene: "beodeul_field", seed: spec.seed });
  {
    // 구성기가 깐 기본 길을 걷어 낸다(author_wild_route replace 와 같은 초기화).
    const map = project.maps[spec.id]!;
    const size = map.width * map.height;
    map.lowerTiles = Array.from({ length: size }, () => BEODEUL_PLAIN_GRASS);
    map.upperTiles = Array.from({ length: size }, () => -1);
    delete map.lowerTileStacks;
    delete map.upperTileStacks;
    if (map.lowerOverlayTiles) map.lowerOverlayTiles = Array.from({ length: size }, () => -1);
    if (map.upperOverlayTiles) map.upperOverlayTiles = Array.from({ length: size }, () => -1);
    if (map.shadowBits) map.shadowBits = Array.from({ length: size }, () => 0);
    map.mapRole ??= "field";
  }
  for (const r of spec.water ?? []) tool(project, "fill_region", { mapId: spec.id, rect: r, material: "버들항 강·운하 물" });
  const map = project.maps[spec.id]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const road = new Set([...carve(map.width, map.height, spec.paths)].filter((i) => !inRects(spec.bridges, i % map.width, Math.floor(i / map.width))));
  paintBeodeulWildRoute({
    project, map, tileset, road, grass: new Set(), patches: [], exits: spec.exits,
    clearings: [...(spec.clearings ?? []), ...(spec.bridges ?? [])], rng: mulberry32(spec.seed ^ 0x5eed17), forestType: "mixed",
  });
  const live = project.maps[spec.id]!;
  live.encounterTable = spec.encounters.map((e) => ({ troopId: e.troopId, weight: e.weight }));
  live.encounterRate = spec.encounters.length ? 1.0 : 0;
  return live;
}

/** 소품 키트를 둘 수 있는 자리(전부 걸을 수 있고 길이 아니고 이벤트와 한 칸 넘게 떨어진)를 가까운 데부터 찾아 찍는다. */
function placeKit(project: Project, mapId: string, kitId: string, want: Cell, avoid: Set<number>, radius = 3): Cell | undefined {
  const kit = project.tilesets.beodeul_city?.structureKits?.find((k) => k.id === kitId);
  if (!kit) return undefined;
  const offsets: Cell[] = [];
  for (let r = 0; r <= radius; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) offsets.push({ x: dx, y: dy });
  for (const o of offsets) {
    const map = project.maps[mapId]!;
    const x0 = want.x + o.x, y0 = want.y + o.y;
    let ok = true;
    for (let dy = 0; dy < kit.height && ok; dy += 1) for (let dx = 0; dx < kit.width && ok; dx += 1) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1 || !isPassable(project, map, x, y) || avoid.has(y * map.width + x)) ok = false;
      else if (map.events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) ok = false;
    }
    if (!ok) continue;
    // 걸을 수 있는 칸 위의 작은 길섶 소품(고사리·들꽃·돌 — 위층 3·4)은 표지에 자리를 내준다. 수관은 걷지 못하는 칸이라 위에서 이미 걸렀다.
    const cleared: Array<{ i: number; up: number; uo: number }> = [];
    for (let dy = 0; dy < kit.height; dy += 1) for (let dx = 0; dx < kit.width; dx += 1) {
      const i = (y0 + dy) * map.width + x0 + dx;
      const up = map.upperTiles[i] ?? -1, uo = map.upperOverlayTiles?.[i] ?? -1;
      if (up < 0 && uo < 0) continue;
      cleared.push({ i, up, uo });
      map.upperTiles[i] = -1;
      if (map.upperOverlayTiles) map.upperOverlayTiles[i] = -1;
    }
    try {
      tool(project, "stamp_object", { objectId: `kit:beodeul_city/${kitId}`, mapId, x: x0, y: y0 });
      return { x: x0, y: y0 };
    } catch (error) {
      const live = project.maps[mapId]!;
      for (const c of cleared) { live.upperTiles[c.i] = c.up; if (live.upperOverlayTiles) live.upperOverlayTiles[c.i] = c.uo; }
      // 이 자리는 도장이 거절했다 — 다음 자리
      if (typeof process !== "undefined" && process.env?.FS_DEBUG) console.error(`[fallen-forest] ${kitId} (${x0},${y0}) 거절: ${String((error as Error).message).replace(/^[^)]*\) 실행 실패: /, '').slice(0, 220)}`);
    }
  }
  if (typeof process !== "undefined" && process.env?.FS_DEBUG) console.error(`[fallen-forest] ${kitId} 자리 없음 ${mapId} 근처 (${want.x},${want.y})`);
  return undefined;
}

/** 길 칸과 그 바로 곁(소품이 길을 막지 않게). */
function pathGuard(project: Project, map: GameMap): Set<number> {
  const trail = trailOf(project, map);
  const out = new Set<number>();
  for (const i of trail) for (const d of [0, -1, 1, -map.width, map.width]) out.add(i + d);
  return out;
}

type Mood = { lighting?: GameMap["defaultLighting"]; atmosphere?: GameMap["atmosphereEffects"]; bgm?: GameMap["bgm"]; battleBackground?: string };

/** 원래 숲의 분위기(초록 그늘 조명·반딧불·나뭇잎·숲 BGM·전투 배경)를 새 숲 맵에 옮긴다. 광원은 맵마다 따로. */
function setMood(project: Project, mapId: string, mood: Mood, sources: Array<Record<string, unknown>> = []): void {
  const lighting = mood.lighting as unknown as { ambient?: number; color?: string } | undefined;
  tool(project, "set_scene_mood", {
    mapId, applyMode: "map",
    lighting: { ambient: lighting?.ambient ?? 0.22, color: lighting?.color ?? "#2c4a38", ...(sources.length ? { sources } : {}) },
  });
  const live = project.maps[mapId]!;
  if (mood.atmosphere) live.atmosphereEffects = JSON.parse(JSON.stringify(mood.atmosphere));
  if (mood.bgm) live.bgm = JSON.parse(JSON.stringify(mood.bgm));
  if (mood.battleBackground) live.battleBackground = mood.battleBackground;
}

/** 떠도는 짐승 — 입구에서 걸음 거리 순위(rank)로 자리를 고른다. 출입구 2칸 안·순찰이 막힌 자리는 도구가 거절하니 순위를 조금씩 옮겨 다시 고른다. */
function roamers(project: Project, mapId: string, origin: Cell, troops: readonly string[], ranks: readonly number[]): number {
  const taken = new Set<string>();
  let n = 0;
  ranks.forEach((rank, i) => {
    for (const shift of [0, -0.08, 0.08, -0.16, 0.16, -0.24, -0.32]) {
      const map = project.maps[mapId]!;
      const at = pickSpot(project, map, origin, taken, Math.max(0.1, Math.min(0.95, rank + shift)), 3);
      if (!at) continue;
      try {
        placeRoamer(project, { mapId, x: at.x, y: at.y, troopId: troops[i % troops.length], behavior: "patrol", id: `ev_${mapId}_foe${i + 1}` }, i % 2 === 0);
        taken.add(`${at.x},${at.y}`);
        n += 1;
        return;
      } catch { taken.add(`${at.x},${at.y}`); }
    }
  });
  return n;
}

/** 두 맵의 가장자리 출구를 잇는다 — 도착은 상대 출구 한 칸 안쪽, 출구를 등지고 안쪽을 본다. */
function link(project: Project, a: { mapId: string } & Cell, b: { mapId: string } & Cell): void {
  tool(project, "create_transfer_pair", { a, b });
  const fix = (from: { mapId: string } & Cell, to: { mapId: string } & Cell): void => {
    const map = project.maps[from.mapId]!;
    const door = map.events.find((e) => e.x === from.x && e.y === from.y && transfersIn(e).some((t) => t.mapId === to.mapId));
    if (!door) throw new Error(`[fallen-forest] ${from.mapId} (${from.x},${from.y}) → ${to.mapId} 문이 없다`);
    const land = inward(project.maps[to.mapId]!, to);
    for (const t of transfersIn(door)) if (t.mapId === to.mapId) { t.x = land.cell.x; t.y = land.cell.y; t.direction = land.dir; }
  };
  fix(a, b);
  fix(b, a);
}

/** 두 칸 폭 길의 출구 — 길 옆 칸으로 걸어 나가도 같은 문이 되게 같은 가장자리의 이웃 길 칸에 문을 하나 더 둔다. */
function widenEdgeDoors(project: Project, mapIds: readonly string[]): void {
  for (const mapId of mapIds) {
    const map = project.maps[mapId]!;
    const trail = trailOf(project, map);
    const doors = map.events.filter((e) => (e.x === 0 || e.y === 0 || e.x === map.width - 1 || e.y === map.height - 1) && transfersIn(e).length > 0);
    for (const door of doors) {
      const along: Cell[] = door.y === 0 || door.y === map.height - 1 ? [{ x: door.x - 1, y: door.y }, { x: door.x + 1, y: door.y }] : [{ x: door.x, y: door.y - 1 }, { x: door.x, y: door.y + 1 }];
      for (const c of along) {
        if (c.x < 0 || c.y < 0 || c.x >= map.width || c.y >= map.height) continue;
        if (!trail.has(c.y * map.width + c.x) || !isPassable(project, map, c.x, c.y) || map.events.some((e) => e.x === c.x && e.y === c.y)) continue;
        const twin = JSON.parse(JSON.stringify(door)) as GameEvent;
        twin.id = `${door.id}_w`;
        twin.x = c.x; twin.y = c.y;
        // 도착 칸도 옆으로 한 칸 — 같은 줄을 따라 나온 걸음이 그대로 이어지게.
        for (const t of transfersIn(twin)) {
          const target = project.maps[String(t.mapId)];
          const dx = c.x - door.x, dy = c.y - door.y;
          const nx = Number(t.x) + dx, ny = Number(t.y) + dy;
          if (target && nx >= 0 && ny >= 0 && nx < target.width && ny < target.height && isPassable(project, target, nx, ny)) { t.x = nx; t.y = ny; }
        }
        for (const page of twin.pages ?? []) page.id = `${page.id}_w`;
        map.events.push(twin);
        break;
      }
    }
  }
}

export interface FallenForestResult {
  readonly mapIds: string[];
  readonly chests: Array<{ mapId: string; x: number; y: number; contents: Record<string, unknown> }>;
}

export function buildFallenForestMaps(project: Project, ids: { hub: string; forest: string }, troops: readonly string[], helpers: FallenForestHelpers): FallenForestResult {
  const deep0 = project.maps[ids.forest];
  if (!deep0) throw new Error("[fallen-forest] 깊은 숲 맵이 없다");
  const [wolves, spiders, wisps] = [troops[0] ?? "troop_fs_wolves", troops[1] ?? "troop_fs_spiders", troops[2] ?? "troop_fs_wisps"];
  const enc = (w: number, s: number, p: number): Encounter[] => [{ troopId: wolves, weight: w }, { troopId: spiders, weight: s }, { troopId: wisps, weight: p }].filter((e) => e.weight > 0);
  const M = FS_FOREST_MAP_IDS;
  const chests: FallenForestResult["chests"] = [];
  const chest = (mapId: string, at: Cell, contents: Record<string, unknown>, name: string): void => {
    tool(project, "place_chest", { mapId, x: at.x, y: at.y, contents, name, id: `ev_${mapId}_chest` });
    const ev = project.maps[mapId]!.events.find((e) => e.id === `ev_${mapId}_chest`);
    chests.push({ mapId, x: ev?.x ?? at.x, y: ev?.y ?? at.y, contents });
  };

  // 깊은 숲 — 왕도로 가던 문은 ① 어귀로 옮기고, 자를 줄 아래의 이벤트(남쪽 굽은 길의 짐승)는 뺀다.
  const hubDoor = deep0.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.hub));
  if (!hubDoor) throw new Error("[fallen-forest] 숲 → 왕도 문이 없다");
  deep0.events = deep0.events.filter((e) => e !== hubDoor && e.y < DEEP_GROVE_HEIGHT);
  const mood = { lighting: deep0.defaultLighting, atmosphere: deep0.atmosphereEffects, bgm: deep0.bgm, battleBackground: deep0.battleBackground };

  // ① 숲 어귀 30×26 — 남쪽 성문 길에서 올라와 갈림목: 동쪽은 옛 수로, 북쪽은 가시덤불 샛길.
  const edge: ForestSpec = {
    id: M.edge, name: "속삭이는 숲 · 어귀", width: 30, height: 26, seed: 41,
    paths: [[{ x: 14, y: 25 }, { x: 14, y: 16 }, { x: 29, y: 16 }], [{ x: 14, y: 16 }, { x: 14, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 0 }]],
    exits: [{ x: 14, y: 25 }, { x: 29, y: 16 }, { x: 8, y: 0 }],
    encounters: enc(3, 1, 1),
  };
  // ② 옛 수로 36×27 — 별지기가 숲에 끌어 온 돌 둑 물길을 돌다리로 건넌다. 북쪽은 사당 터, 남동 곁길은 사냥꾼 쉼터.
  const stream: ForestSpec = {
    id: M.stream, name: "속삭이는 숲 · 옛 수로", width: 36, height: 27, seed: 91,
    paths: [[{ x: 0, y: 11 }, { x: 26, y: 11 }, { x: 26, y: 0 }], [{ x: 20, y: 11 }, { x: 20, y: 19 }, { x: 35, y: 19 }]],
    exits: [{ x: 0, y: 11 }, { x: 26, y: 0 }, { x: 35, y: 19 }],
    water: [{ x: 10, y: 0, w: 5, h: 27 }],
    bridges: [{ x: 10, y: 11, w: 5, h: 2 }],
    clearings: [{ x: 5, y: 7, w: 4, h: 3 }],
    encounters: enc(2, 2, 1),
  };
  // ③ 가시덤불 샛길 40×32 — 굽이진 덤불 길. 둘째 굽이에서 갈린다: 북쪽은 사당 터로 빠지고, 서쪽은 막다른 곁길 끝 상자.
  const thicket: ForestSpec = {
    id: M.thicket, name: "속삭이는 숲 · 가시덤불 샛길", width: 40, height: 32, seed: 53,
    paths: [[{ x: 12, y: 31 }, { x: 12, y: 24 }, { x: 30, y: 24 }, { x: 30, y: 15 }, { x: 6, y: 15 }, { x: 6, y: 8 }], [{ x: 18, y: 15 }, { x: 18, y: 6 }, { x: 39, y: 6 }]],
    exits: [{ x: 12, y: 31 }, { x: 39, y: 6 }],
    encounters: enc(1, 3, 2),
  };
  // ④ 별지기 사당 터 34×28 — 세 길이 만나는 숲속 공터. 무너진 성문·사당·부러진 기둥. 짐승이 들지 않는다.
  const shrine: ForestSpec = {
    id: M.shrine, name: "속삭이는 숲 · 별지기 사당 터", width: 34, height: 28, seed: 67,
    paths: [[{ x: 20, y: 27 }, { x: 20, y: 13 }], [{ x: 0, y: 13 }, { x: 20, y: 13 }], [{ x: 14, y: 13 }, { x: 14, y: 0 }]],
    exits: [{ x: 20, y: 27 }, { x: 0, y: 13 }, { x: 14, y: 0 }],
    clearings: [{ x: 8, y: 6, w: 18, h: 14 }],
    encounters: [],
  };
  // ⑥ 사냥꾼 쉼터 30×20 — 옛 수로에서 갈라진 막다른 곁길 끝, 모닥불 자리와 상자.
  const glade: ForestSpec = {
    id: M.glade, name: "속삭이는 숲 · 사냥꾼 쉼터", width: 30, height: 20, seed: 79,
    paths: [[{ x: 0, y: 9 }, { x: 21, y: 9 }]],
    exits: [{ x: 0, y: 9 }],
    clearings: [{ x: 17, y: 4, w: 9, h: 11 }],
    encounters: enc(2, 0, 2),
  };
  for (const spec of [edge, stream, thicket, shrine, glade]) createForest(project, spec);
  // 옛 수로 돌다리 — 마을 강 다리와 같은 산길 개울 돌다리(5×4: 난간·바닥 두 줄·아래 난간), 바닥 두 줄이 길 두 줄에 얹힌다.
  // 바닥 덮개를 먼저 깐다 — 다리를 먼저 얹으면 걸을 수 있는 다리 바닥에 고사리 덩이가 앉았다. 다리는 잇기 전에 있어야 한다(물 건너 출구가 닿는다).
  helpers.understory(M.stream);
  tool(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-mountain-pass-stone-bridge", mapId: M.stream, x: 10, y: 10 });

  // ── 잇기 ───────────────────────────────────────────────────────────────
  // 왕도 동문 → 어귀 남쪽. 숲에 있던 왕도행 문(도착 칸·방향 그대로)을 어귀 남쪽 출구로 옮긴다.
  const edgeSouth = edge.exits[0]!;
  {
    const map = project.maps[M.edge]!;
    hubDoor.x = edgeSouth.x; hubDoor.y = edgeSouth.y;
    map.events = map.events.filter((e) => !(e.x === hubDoor.x && e.y === hubDoor.y));
    map.events.push(hubDoor);
    const land = inward(map, edgeSouth);
    for (const event of project.maps[ids.hub]!.events) for (const t of transfersIn(event)) if (t.mapId === ids.forest) { t.mapId = M.edge; t.x = land.cell.x; t.y = land.cell.y; t.direction = land.dir; }
  }
  // 왕도가 더는 숲 남쪽 끝(15,38)을 가리키지 않으니 이제 자른다.
  tool(project, "resize_map", { mapId: ids.forest, width: deep0.width, height: DEEP_GROVE_HEIGHT });
  project.maps[ids.forest]!.name = "속삭이는 숲 · 깊은 곳";
  const deep = project.maps[ids.forest]!;
  const deepSouth = [...trailOf(project, deep)].filter((i) => Math.floor(i / deep.width) === deep.height - 1).map((i) => i % deep.width).sort((a, b) => a - b)[0];
  if (deepSouth === undefined) throw new Error("[fallen-forest] 깊은 숲 남쪽 끝에 길이 없다");

  link(project, { mapId: M.edge, ...edge.exits[1]! }, { mapId: M.stream, ...stream.exits[0]! });
  link(project, { mapId: M.edge, ...edge.exits[2]! }, { mapId: M.thicket, ...thicket.exits[0]! });
  link(project, { mapId: M.stream, ...stream.exits[1]! }, { mapId: M.shrine, ...shrine.exits[0]! });
  link(project, { mapId: M.thicket, ...thicket.exits[1]! }, { mapId: M.shrine, ...shrine.exits[1]! });
  link(project, { mapId: M.stream, ...stream.exits[2]! }, { mapId: M.glade, ...glade.exits[0]! });
  link(project, { mapId: M.shrine, ...shrine.exits[2]! }, { mapId: ids.forest, x: deepSouth, y: DEEP_GROVE_HEIGHT - 1 });

  // ── 맵마다 표지·보상 ─────────────────────────────────────────────────────────
  // ① 어귀: 길 양옆 봉화 둘·길가 십자(예전 숲 입구 장식), 갈림목 이정표.
  {
    const id = M.edge, guard = pathGuard(project, project.maps[id]!);
    placeKit(project, id, "bd-pick-mountain-pass-brazier", { x: 13, y: 22 }, new Set(), 0);
    placeKit(project, id, "bd-pick-mountain-pass-brazier", { x: 16, y: 22 }, new Set(), 0);
    placeKit(project, id, "bd-pick-mountain-pass-wayside-cross", { x: 13, y: 18 }, new Set(), 1);
    const post = placeKit(project, id, "bd-pick-mountain-pass-trail-post", { x: 16, y: 18 }, new Set(), 1);
    if (post) readable(project.maps[id]!, "signpost", "이정표", { x: post.x, y: post.y + 1 }, [
      narrate("(이정표) 북 — 가시덤불 샛길. 짐승 잦음.\n동 — 옛 수로 돌다리."),
      narrate("(이정표) 두 길은 별지기 사당 터에서 다시 만난다.\n떨어진 별은 그 너머 깊은 숲. — 숲지기 브람"),
    ]);
    void guard;
  }
  // ② 옛 수로: 다리 서쪽 공터의 이끼 낀 비석.
  {
    const id = M.stream;
    const stone = placeKit(project, id, "bd-pick-deep-forest-path-cairn", { x: 6, y: 7 }, new Set(), 1);
    if (stone) readable(project.maps[id]!, "canal_stone", "이끼 낀 비석", { x: stone.x, y: stone.y + 1 }, [
      narrate("(비석) 별지기의 물길.\n별을 비추려고 숲 한가운데까지 물을 끌었다."),
      say("엘레나", "천문대 사람들이 이런 걸 만들었다고?\n선생님은 한 번도 말씀 안 하셨는데."),
    ]);
    placeKit(project, id, "bd-pick-deep-forest-path-log-fallen", { x: 7, y: 8 }, new Set(), 1);
  }
  // ③ 가시덤불 샛길: 막다른 곁길 끝 상자(불꽃 병 — 거미줄에 잘 든다).
  chest(M.thicket, { x: 6, y: 7 }, { itemId: FS_FIRE_FLASK, gold: 60 }, "덤불 속 상자");
  // ④ 사당 터: 무너진 성문·사당·부러진 기둥, 사당 앞 상자. 짐승이 들지 않는 쉼터(조우 없음).
  {
    const id = M.shrine, guard = pathGuard(project, project.maps[id]!);
    const gate = placeKit(project, id, "bd-pick-deep-forest-path-ruin-gate", { x: 9, y: 7 }, guard, 2);
    // 별지기의 별 무늬 바닥 — 공터 북동, 사당 앞마당.
    placeKit(project, id, "bd-pick-temple-ruins-mosaic-medallion-5x5", { x: 17, y: 7 }, guard, 1);
    const shrineAt = placeKit(project, id, "bd-pick-mountain-pass-shrine", { x: 23, y: 7 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-column-temple-broken", { x: 10, y: 17 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-fallen-column-temple", { x: 16, y: 17 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-rubble-temple", { x: 24, y: 17 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-column-temple-broken", { x: 24, y: 12 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-rubble-temple", { x: 17, y: 9 }, guard, 2);
    const lights: Array<Record<string, unknown>> = [];
    if (shrineAt) {
      readable(project.maps[id]!, "shrine", "별지기 사당", { x: shrineAt.x, y: shrineAt.y + 2 }, [
        narrate("(사당) 이끼 낀 돌 사당. 지붕 밑에 별 무늬가 새겨져 있다."),
        say("엘레나", "이 별 무늬, 천문대 서고 바닥에서 본 것 같아."),
        narrate("(사당) 향 주머니가 놓여 있다. 누군가 아직 이곳을 돌본다."),
      ]);
      chest(id, { x: shrineAt.x - 1, y: shrineAt.y + 3 }, { itemId: FS_STAR_SCENT }, "사당 공물 상자");
      lights.push({ id: `light_${id}_shrine`, at: { x: shrineAt.x, y: shrineAt.y + 1 }, radius: 3, intensity: 0.8, color: "#a0c8ff", flicker: true });
    }
    if (gate) lights.push({ id: `light_${id}_gate`, at: { x: gate.x + 1, y: gate.y + 2 }, radius: 2, intensity: 0.5, color: "#c8dcff", flicker: false });
    setMood(project, id, mood, lights);
  }
  // ⑥ 사냥꾼 쉼터: 모닥불·사냥 표지 기둥, 막다른 끝 상자와 브람의 쪽지.
  {
    const id = M.glade;
    chest(id, { x: 23, y: 8 }, { itemId: FS_HI_POTION, gold: 120 }, "사냥꾼의 상자");
    placeKit(project, id, "bd-pick-deep-forest-path-campfire", { x: 20, y: 12 }, new Set(), 1);
    const post = placeKit(project, id, "bd-pick-deep-forest-path-hunter-post", { x: 24, y: 6 }, new Set(), 1);
    placeKit(project, id, "bd-pick-deep-forest-path-log-fallen", { x: 18, y: 6 }, new Set(), 1);
    if (post) readable(project.maps[id]!, "hunter_note", "사냥꾼의 쪽지", { x: post.x, y: post.y + 1 }, [
      narrate("(쪽지) 별 떨어진 밤부터 늑대가 북쪽으로 몰린다.\n당분간 쉼터는 비워 둔다. 필요한 건 가져가라. — 브람"),
    ]);
  }

  // 분위기·떠도는 짐승(부딪히면 전투) — 원래 숲과 같은 조우율 1.0, 짐승은 맵마다 하나~둘.
  for (const id of [M.edge, M.stream, M.thicket, M.glade]) setMood(project, id, mood);
  const entryOf = (mapId: string, at: Cell): Cell => inward(project.maps[mapId]!, at).cell;
  roamers(project, M.edge, entryOf(M.edge, edgeSouth), [wolves], [0.6]);
  roamers(project, M.stream, entryOf(M.stream, stream.exits[0]!), [spiders, wolves], [0.45, 0.8]);
  roamers(project, M.thicket, entryOf(M.thicket, thicket.exits[0]!), [spiders, wisps], [0.35, 0.7]);
  roamers(project, M.glade, entryOf(M.glade, glade.exits[0]!), [wisps], [0.5]);

  // 바닥 덮개 — 원래 숲과 같은 고사리·히스 덩이.
  // 사당 터 공터는 덮지 않는다 — 공터에 덤불 덩이가 줄지어 앉아 밭처럼 읽혔다(유적·모자이크만 둔다).
  for (const id of [M.edge, M.thicket, M.glade]) helpers.understory(id);
  widenEdgeDoors(project, [M.edge, M.stream, M.thicket, M.shrine, M.glade, ids.forest]);

  // 맵 나무 — 숲 맵들을 어귀 아래에 묶는다.
  const tree = project.mapTree as { mapId: string; children: { mapId: string; children: unknown[] }[] } | undefined;
  if (tree) {
    tree.children = tree.children.filter((c) => c.mapId !== ids.forest);
    tree.children.push({
      mapId: M.edge,
      children: [
        { mapId: M.stream, children: [{ mapId: M.glade, children: [] }] },
        { mapId: M.thicket, children: [] },
        { mapId: M.shrine, children: [{ mapId: ids.forest, children: [] }] },
      ],
    });
  }
  return { mapIds: [M.edge, M.stream, M.thicket, M.shrine, M.glade, ids.forest], chests };
}
