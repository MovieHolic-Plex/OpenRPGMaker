/**
 * 폴른 스타 · 속삭이는 숲 — 여섯 맵 (2026-10-24 r2: 숲은 왕도 북쪽, 굽은 숲길, B1 활엽 composer 나무).
 *
 *                          ⑤ 깊은 숲(브람·추락지, 원래 숲 맵 fs_forest)
 *                                  │ 북
 *                          ④ 별지기 사당 터(쉼터·회복 세이브·공물 상자, 짐승 없음)
 *                         ╱ 북서                ╲ 북동
 *   ③ 가시덤불 샛길(서쪽 곁길 끝 상자)      ② 옛 수로(굽은 개울·돌다리) ─ 동 ─ ⑥ 사냥꾼 쉼터(막다른 곳·상자)
 *                         ╲                     ╱
 *                          ① 숲 어귀(갈림목·이정표)
 *                                  │ 남
 *                             왕도 성문
 *
 * ①→②→④ 와 ①→③→④ 는 고리다. 막다른 곳(③ 곁길 끝·⑥)에는 상자가 있고, 나무 사이 틈에 숨은 물건이 셋(①·②·⑤) 있다.
 * 땅 모양은 forestSpecs.ts, 칠하기는 woodland.ts(굽은 길·들쭉날쭉 숲 덩이·빈터·자연 둑 개울·B1 composer 나무).
 * 깊은 숲은 추락지(DEEP_KEEP) 바닥·장식을 지키고 그 밖을 같은 방식으로 다시 칠한다.
 * 눈에 보이는 짐승·조우 표는 구역 트룹(#3335 battleRoles 의 FS_AREA_ENCOUNTERS 와 같은 id)을 먼저 쓰고, 아직 없으면 옛 셋(늑대·거미·도깨비불)으로.
 */
import { runTool } from "@/editor/tools/toolRunner";
import { pickSpot, placeRoamer } from "@/editor/tools/jrpgVolumeTools";
import { BEODEUL_PLAIN_GRASS } from "@/editor/tools/wildRouteBeodeul";
import { beodeulNatureTileset } from "@/editor/tools/beodeulForest";
import { lootGrantCommands } from "@/editor/lootFeedback";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { FS_PREFIX } from "../fallenStarStory";
import { FS_FIRE_FLASK, FS_HI_POTION, FS_SMOKE_PELLET, FS_STAR_SCENT, FS_TONIC, FS_WATER_FLASK } from "./battleItems";
import { DEEP_KEEP, DEEP_SIZE, DEEP_SPEC, EDGE_SPEC, FOREST_SPECS, FS_FOREST_MAP_IDS, GLADE_SPEC, SHRINE_SPEC, STREAM_SPEC, THICKET_SPEC } from "./forestSpecs";
import { paintWoodland, paintWoodlandOnto } from "./woodland";

export { FS_FOREST_MAP_IDS } from "./forestSpecs";

type Cell = { x: number; y: number };
type Dir = "up" | "down" | "left" | "right";
type Encounter = { troopId: string; weight: number };

export interface FallenForestHelpers {
  /** chronoBell.ts 의 숲 바닥 덮개(고사리·히스 덩이). r2 숲은 woodland 가 길섶을 꾸미므로 쓰지 않는다(호출부 호환을 위해 남김). */
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
  readonly hidden: Array<{ mapId: string; x: number; y: number; itemId: string }>;
}

/** 구역 트룹(#3335 FS_AREA_ENCOUNTERS 와 같은 id·무게) — 데이터베이스에 있는 것만. 하나도 없으면 옛 셋으로. */
const AREA_TROOPS: Record<string, ReadonlyArray<readonly [string, number]>> = {
  fs_forest_edge: [["troop_fs_wolves", 3], ["troop_fs_edge_boar", 2], ["troop_fs_edge_hornets", 2]],
  fs_forest_stream: [["troop_fs_stream_crabs", 3], ["troop_fs_stream_eels", 2], ["troop_fs_wolves", 1]],
  fs_forest_thicket: [["troop_fs_spiders", 3], ["troop_fs_thicket_moths", 2], ["troop_fs_thicket_flytrap", 2]],
  fs_forest_glade: [["troop_fs_glade_poachers", 3], ["troop_fs_edge_hornets", 1], ["troop_fs_edge_boar", 1]],
  fs_forest: [["troop_fs_wisps", 3], ["troop_fs_deep_ghosts", 2], ["troop_fs_spiders", 1]],
};

function areaEncounters(project: Project, mapId: string, fallback: readonly Encounter[]): Encounter[] {
  const have = new Set(project.database.troops.map((t) => t.id));
  const rows = (AREA_TROOPS[mapId] ?? []).filter(([id]) => have.has(id)).map(([troopId, weight]) => ({ troopId, weight }));
  // 구역 트룹이 하나뿐이면(아직 #3335 전) 옛 표를 그대로 쓴다 — 늑대 한 종만 남으면 숲이 단조롭다.
  return rows.length >= 2 ? rows : fallback.filter((e) => have.has(e.troopId));
}

/** 나무 사이 틈의 숨은 물건 — 투명 조사 이벤트(한 번), 곁 칸에 버섯 덤불 한 포기(눈치챌 만한 작은 표시). */
function hiddenItem(project: Project, mapId: string, at: Cell, key: string, itemId: string, gold: number): void {
  const map = project.maps[mapId]!;
  const id = `ev_${FS_PREFIX}_forest_${key}`;
  const item = project.database.items.find((i) => i.id === itemId);
  const name = item?.name?.trim() || itemId;
  map.events = map.events.filter((e) => e.id !== id);
  map.events.push({
    id, name: "나무 사이 틈", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [],
    pages: [
      { id: `${id}_p0`, name: "숨은 물건", conditions: [{ kind: "selfSwitch", key: "A", value: false }], graphic: { transparent: true }, trigger: { kind: "action" },
        priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "text", body: "나무뿌리 사이에 무언가 끼어 있다." } as Command,
          ...lootGrantCommands({ itemId, gold }),
          { kind: "text", body: `${name}${/[가-힣]$/.test(name) && ((name.charCodeAt(name.length - 1) - 0xac00) % 28) ? "을" : "를"} 주웠다. 금화 ${gold}닢도 함께.` } as Command,
          { kind: "setSelfSwitch", key: "A", value: true } as Command,
        ] },
      { id: `${id}_p1`, name: "빈 틈", conditions: [{ kind: "selfSwitch", key: "A", value: true }], graphic: { transparent: true }, trigger: { kind: "action" },
        priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
    ] as unknown as EventPage[],
  } as unknown as GameEvent);
  // 작은 표시 — 주머니 옆 칸(오른쪽·아래)에 버섯 한 포기.
  const hint = (project.tilesets[map.tilesetId]?.structureKits ?? []).find((k) => k.id === "bd-pick-deep-forest-path-toadstools-b");
  const t = hint?.rows[0]?.upperTiles?.[0] ?? -1;
  if (t >= 0) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]] as const) {
    const x = at.x + dx, y = at.y + dy, c = y * map.width + x;
    if (x < map.width && y < map.height && isPassable(project, map, x, y) && layerTileAt(map, 3, c) < 0) { setLayerTileAt(map, 3, c, t); break; }
  }
}

/** 깊은 숲의 옛 수관 오토타일(beodeul_nature 수관·그늘) 칸 번호 — 이 칩셋에 이식된 칸. */
function natureCanopyTiles(project: Project, map: GameMap): { canopy: Set<number>; shade: Set<number> } {
  const tileset = project.tilesets[map.tilesetId]!;
  const natureChip = beodeulNatureTileset(project).image.id;
  const canopySrc = new Set(Object.values(BEODEUL_NATURE.forestCanopy).flat(2));
  const shadeSrc = new Set(Object.values(BEODEUL_NATURE.forestShade).flat());
  const canopy = new Set<number>(), shade = new Set<number>();
  for (const g of tileset.tileGrafts ?? []) {
    if (g.sourceChipset !== natureChip) continue;
    if (canopySrc.has(g.sourceTile)) canopy.add(g.targetTile);
    else if (shadeSrc.has(g.sourceTile)) shade.add(g.targetTile);
  }
  return { canopy, shade };
}

/** 깊은 숲 다시 칠하기 — 추락지 사각형은 바닥·장식을 두고 수관만 걷는다(그 자리는 composer 숲으로 다시 선다). 그 밖은 풀밭에서 새로. */
function regrowDeepGrove(project: Project, mapId: string): ReturnType<typeof paintWoodlandOnto> {
  const map = project.maps[mapId]!;
  const W = map.width, H = map.height;
  const keep = (x: number, y: number) => x >= DEEP_KEEP.x && y >= DEEP_KEEP.y && x < DEEP_KEEP.x + DEEP_KEEP.w && y < DEEP_KEEP.y + DEEP_KEEP.h;
  const { canopy, shade } = natureCanopyTiles(project, map);
  const keepForest = new Set<number>();
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = y * W + x;
    if (keep(x, y)) {
      for (const L of [2, 3, 4] as const) {
        const t = layerTileAt(map, L, c);
        if (canopy.has(t)) { keepForest.add(c); setLayerTileAt(map, L, c, -1); } else if (shade.has(t)) setLayerTileAt(map, L, c, -1);
      }
      continue;
    }
    map.lowerTiles[c] = BEODEUL_PLAIN_GRASS;
    for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, c, -1);
    if (map.lowerTileStacks) delete map.lowerTileStacks[c];
    if (map.upperTileStacks) delete map.upperTileStacks[c];
    if (map.shadowBits) map.shadowBits[c] = 0;
  }
  return paintWoodlandOnto(project, map, DEEP_SPEC(mapId, map.name), (x, y) => !keep(x, y), keepForest);
}

export function buildFallenForestMaps(project: Project, ids: { hub: string; forest: string }, troops: readonly string[], helpers: FallenForestHelpers): FallenForestResult {
  void helpers;
  const deep0 = project.maps[ids.forest];
  if (!deep0) throw new Error("[fallen-forest] 깊은 숲 맵이 없다");
  const [wolves, spiders, wisps] = [troops[0] ?? "troop_fs_wolves", troops[1] ?? "troop_fs_spiders", troops[2] ?? "troop_fs_wisps"];
  const enc = (w: number, s: number, p: number): Encounter[] => [{ troopId: wolves, weight: w }, { troopId: spiders, weight: s }, { troopId: wisps, weight: p }].filter((e) => e.weight > 0);
  const M = FS_FOREST_MAP_IDS;
  const chests: FallenForestResult["chests"] = [];
  const hidden: FallenForestResult["hidden"] = [];
  const chest = (mapId: string, at: Cell, contents: Record<string, unknown>, name: string): void => {
    tool(project, "place_chest", { mapId, x: at.x, y: at.y, contents, name, id: `ev_${mapId}_chest` });
    const ev = project.maps[mapId]!.events.find((e) => e.id === `ev_${mapId}_chest`);
    chests.push({ mapId, x: ev?.x ?? at.x, y: ev?.y ?? at.y, contents });
  };

  // 깊은 숲 — 왕도로 가던 문은 ① 어귀로 옮기고, 자를 줄 아래 이벤트·떠도는 짐승은 뺀다(짐승은 아래에서 구역 트룹으로 다시 둔다).
  const hubDoor = deep0.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.hub));
  if (!hubDoor) throw new Error("[fallen-forest] 숲 → 왕도 문이 없다");
  deep0.events = deep0.events.filter((e) => e !== hubDoor && e.y < DEEP_SIZE.height - 2 && !/_foe\d+$/.test(e.id));
  const mood = { lighting: deep0.defaultLighting, atmosphere: deep0.atmosphereEffects, bgm: deep0.bgm, battleBackground: deep0.battleBackground };

  for (const spec of FOREST_SPECS) paintWoodland(project, spec);

  // ── 잇기 ───────────────────────────────────────────────────────────────
  // 왕도 성문 → 어귀 남쪽. 숲에 있던 왕도행 문(도착 칸·방향 그대로)을 어귀 남쪽 출구로 옮긴다.
  const edgeSouth = EDGE_SPEC.exits[0]!;
  {
    const map = project.maps[M.edge]!;
    hubDoor.x = edgeSouth.x; hubDoor.y = edgeSouth.y;
    map.events = map.events.filter((e) => !(e.x === hubDoor.x && e.y === hubDoor.y));
    map.events.push(hubDoor);
    const land = inward(map, edgeSouth);
    for (const event of project.maps[ids.hub]!.events) for (const t of transfersIn(event)) if (t.mapId === ids.forest) { t.mapId = M.edge; t.x = land.cell.x; t.y = land.cell.y; t.direction = land.dir; }
  }
  // 왕도가 더는 숲 남쪽 끝을 가리키지 않으니 깊은 숲을 30×36 으로 맞추고 추락지 밖을 다시 칠한다.
  tool(project, "resize_map", { mapId: ids.forest, width: DEEP_SIZE.width, height: DEEP_SIZE.height });
  project.maps[ids.forest]!.name = "속삭이는 숲 · 깊은 곳";
  const deepPaint = regrowDeepGrove(project, ids.forest);
  const deepSouth = DEEP_SPEC(ids.forest, "").exits[0]!;

  link(project, { mapId: M.edge, ...EDGE_SPEC.exits[1]! }, { mapId: M.thicket, ...THICKET_SPEC.exits[0]! });
  link(project, { mapId: M.edge, ...EDGE_SPEC.exits[2]! }, { mapId: M.stream, ...STREAM_SPEC.exits[0]! });
  link(project, { mapId: M.thicket, ...THICKET_SPEC.exits[1]! }, { mapId: M.shrine, ...SHRINE_SPEC.exits[0]! });
  link(project, { mapId: M.stream, ...STREAM_SPEC.exits[1]! }, { mapId: M.shrine, ...SHRINE_SPEC.exits[1]! });
  link(project, { mapId: M.stream, ...STREAM_SPEC.exits[2]! }, { mapId: M.glade, ...GLADE_SPEC.exits[0]! });
  link(project, { mapId: M.shrine, ...SHRINE_SPEC.exits[2]! }, { mapId: ids.forest, ...deepSouth });

  // ── 맵마다 표지·보상 ─────────────────────────────────────────────────────────
  // ① 어귀: 성문 길 들머리 봉화 둘·길가 십자, 갈림목 이정표, 북쪽 숲덩이 틈의 숨은 물건.
  {
    const id = M.edge, guard = pathGuard(project, project.maps[id]!);
    placeKit(project, id, "bd-pick-mountain-pass-brazier", { x: 12, y: 35 }, guard, 2);
    placeKit(project, id, "bd-pick-mountain-pass-brazier", { x: 19, y: 35 }, guard, 2);
    placeKit(project, id, "bd-pick-mountain-pass-wayside-cross", { x: 18, y: 30 }, guard, 2);
    const post = placeKit(project, id, "bd-pick-mountain-pass-trail-post", { x: 19, y: 21 }, guard, 2);
    if (post) readable(project.maps[id]!, "signpost", "이정표", { x: post.x, y: post.y + 1 }, [
      narrate("(이정표) 북서 — 가시덤불 샛길. 짐승 잦음.\n북동 — 옛 수로 돌다리."),
      narrate("(이정표) 두 길은 북쪽 별지기 사당 터에서 다시 만난다.\n떨어진 별은 그 너머 깊은 숲. — 숲지기 브람"),
    ]);
  }
  // ② 옛 수로: 다리 서쪽 빈터의 이끼 낀 비석.
  {
    const id = M.stream, guard = pathGuard(project, project.maps[id]!);
    const stone = placeKit(project, id, "bd-pick-deep-forest-path-cairn", { x: 13, y: 11 }, guard, 2);
    if (stone) readable(project.maps[id]!, "canal_stone", "이끼 낀 비석", { x: stone.x, y: stone.y + 1 }, [
      narrate("(비석) 별지기의 물길.\n별을 비추려고 숲 한가운데까지 물을 끌었다."),
      say("엘레나", "천문대 사람들이 이런 걸 만들었다고?\n선생님은 한 번도 말씀 안 하셨는데."),
    ]);
    placeKit(project, id, "bd-pick-deep-forest-path-log-fallen", { x: 15, y: 13 }, guard, 2);
  }
  // ③ 가시덤불 샛길: 서쪽 곁길 끝 작은 빈터의 상자(불꽃 병 — 거미줄에 잘 든다).
  chest(M.thicket, { x: 4, y: 11 }, { itemId: FS_FIRE_FLASK, gold: 60 }, "덤불 속 상자");
  // ④ 사당 터: 무너진 성문·별 무늬 바닥·사당·부러진 기둥, 사당 앞 상자, 회복 세이브. 짐승이 들지 않는 쉼터(조우 없음).
  {
    const id = M.shrine, guard = pathGuard(project, project.maps[id]!);
    placeKit(project, id, "bd-pick-temple-ruins-mosaic-medallion-5x5", { x: 13, y: 9 }, guard, 2);
    // 무너진 성문(4×4) — 빈터 가장자리 몇 곳 중 들어가는 자리.
    const gate = [{ x: 24, y: 16 }, { x: 11, y: 14 }, { x: 25, y: 6 }, { x: 13, y: 4 }].reduce<Cell | undefined>((got, at) => got ?? placeKit(project, id, "bd-pick-deep-forest-path-ruin-gate", at, guard, 3), undefined);
    const shrineAt = placeKit(project, id, "bd-pick-mountain-pass-shrine", { x: 25, y: 9 }, guard, 3);
    placeKit(project, id, "bd-pick-temple-ruins-column-temple-broken", { x: 13, y: 17 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-fallen-column-temple", { x: 15, y: 19 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-rubble-temple", { x: 27, y: 13 }, guard, 2);
    placeKit(project, id, "bd-pick-temple-ruins-column-temple-broken", { x: 22, y: 9 }, guard, 2);
    const lights: Array<Record<string, unknown>> = [{ id: `light_${id}_gap`, at: { x: 20, y: 13 }, radius: 6, intensity: 0.45, color: "#fff1c4", flicker: false }];
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
    // 쉼터 — 사당 곁 맑은 샘(세이브 포인트, 체력·마력 회복). 길이 아니고 장식과 겹치지 않는 공터 칸.
    const map = project.maps[id]!;
    const restAt = [{ x: 17, y: 12 }, { x: 22, y: 12 }, { x: 16, y: 15 }, { x: 24, y: 14 }, { x: 18, y: 17 }]
      .find((c) => isPassable(project, map, c.x, c.y) && !guard.has(c.y * map.width + c.x) && !map.events.some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1)) ?? { x: 17, y: 12 };
    tool(project, "place_savepoint", { mapId: id, x: restAt.x, y: restAt.y, heal: true, name: "별지기 쉼터", id: `ev_${id}_rest` });
    lights.push({ id: `light_${id}_rest`, at: restAt, radius: 2, intensity: 0.6, color: "#bfe8ff", flicker: true });
    setMood(project, id, mood, lights);
  }
  // ⑥ 사냥꾼 쉼터: 모닥불·사냥 표지 기둥, 막다른 끝 상자와 브람의 쪽지.
  {
    const id = M.glade, guard = pathGuard(project, project.maps[id]!);
    chest(id, { x: 26, y: 11 }, { itemId: FS_HI_POTION, gold: 120 }, "사냥꾼의 상자");
    placeKit(project, id, "bd-pick-deep-forest-path-campfire", { x: 21, y: 15 }, guard, 2);
    const post = placeKit(project, id, "bd-pick-deep-forest-path-hunter-post", { x: 24, y: 9 }, guard, 2);
    placeKit(project, id, "bd-pick-deep-forest-path-log-fallen", { x: 19, y: 10 }, guard, 2);
    placeKit(project, id, "bd-pick-deep-forest-path-hide-rack", { x: 18, y: 15 }, guard, 2);
    if (post) readable(project.maps[id]!, "hunter_note", "사냥꾼의 쪽지", { x: post.x, y: post.y + 1 }, [
      narrate("(쪽지) 별 떨어진 밤부터 늑대가 북쪽으로 몰린다.\n당분간 쉼터는 비워 둔다. 필요한 건 가져가라. — 브람"),
    ]);
  }
  // ⑤ 깊은 숲: 브람 곁 모닥불, 두 번째 별 표지석(돌무덤), 숨은 물건.
  {
    const id = ids.forest;
    const map = project.maps[id]!;
    const bram = map.events.find((e) => e.id === `ev_${FS_PREFIX}_bram`);
    if (bram) placeKit(project, id, "bd-pick-deep-forest-path-campfire", { x: bram.x - 2, y: bram.y + 1 }, pathGuard(project, map), 2);
    const marker = project.maps[id]!.events.find((e) => e.id === `ev_${FS_PREFIX}_lore_l7_marker`);
    if (marker) try { tool(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-deep-forest-path-cairn", mapId: id, x: marker.x, y: marker.y - 1 }); } catch { /* 자리 없음 — 표지석은 조사로만 */ }
  }
  // 나무 사이 틈의 숨은 물건 — 세 맵에 하나씩(어귀·옛 수로·깊은 숲).
  const pocketsOf = (spec: { nooks?: readonly { to: Cell }[] }): Cell[] => (spec.nooks ?? []).map((n) => n.to);
  const stash = (mapId: string, at: Cell | undefined, key: string, itemId: string, gold: number): void => {
    if (!at) return;
    hiddenItem(project, mapId, at, key, itemId, gold);
    hidden.push({ mapId, x: at.x, y: at.y, itemId });
  };
  stash(M.edge, pocketsOf(EDGE_SPEC)[0], "edge_hidden", FS_TONIC, 30);
  stash(M.stream, pocketsOf(STREAM_SPEC)[0], "stream_hidden", FS_WATER_FLASK, 40);
  stash(ids.forest, deepPaint.pockets[0], "deep_hidden", FS_SMOKE_PELLET, 50);

  // 분위기·조우·떠도는 짐승(부딪히면 전투) — 조우율 1.0, 짐승은 그 구역 트룹. 사당 터는 조우 없음.
  for (const id of [M.edge, M.stream, M.thicket, M.glade]) setMood(project, id, mood);
  const tables: Record<string, Encounter[]> = {
    [M.edge]: areaEncounters(project, M.edge, enc(3, 1, 1)),
    [M.stream]: areaEncounters(project, M.stream, enc(2, 2, 1)),
    [M.thicket]: areaEncounters(project, M.thicket, enc(1, 3, 2)),
    [M.glade]: areaEncounters(project, M.glade, enc(2, 0, 2)),
    [ids.forest]: areaEncounters(project, ids.forest, enc(1, 1, 3)),
  };
  for (const [mapId, rows] of Object.entries(tables)) {
    const map = project.maps[mapId]!;
    map.encounterTable = rows.map((e) => ({ troopId: e.troopId, weight: e.weight }));
    map.encounterRate = rows.length ? 1.0 : 0;
  }
  project.maps[M.shrine]!.encounterTable = [];
  project.maps[M.shrine]!.encounterRate = 0;
  const entryOf = (mapId: string, at: Cell): Cell => inward(project.maps[mapId]!, at).cell;
  const foes = (mapId: string): string[] => [...tables[mapId]!].sort((a, b) => b.weight - a.weight).map((e) => e.troopId);
  roamers(project, M.edge, entryOf(M.edge, edgeSouth), foes(M.edge), [0.45, 0.8]);
  roamers(project, M.stream, entryOf(M.stream, STREAM_SPEC.exits[0]!), foes(M.stream), [0.35, 0.7]);
  roamers(project, M.thicket, entryOf(M.thicket, THICKET_SPEC.exits[0]!), foes(M.thicket), [0.35, 0.75]);
  roamers(project, M.glade, entryOf(M.glade, GLADE_SPEC.exits[0]!), foes(M.glade), [0.45, 0.8]);
  roamers(project, ids.forest, entryOf(ids.forest, deepSouth), foes(ids.forest), [0.4]);

  widenEdgeDoors(project, [M.edge, M.stream, M.thicket, M.shrine, M.glade, ids.forest]);

  // 맵 나무 — 숲 맵들을 어귀 아래에 묶는다.
  const tree = project.mapTree as { mapId: string; children: { mapId: string; children: unknown[] }[] } | undefined;
  if (tree) {
    tree.children = tree.children.filter((c) => c.mapId !== ids.forest);
    tree.children.push({
      mapId: M.edge,
      children: [
        { mapId: M.thicket, children: [] },
        { mapId: M.stream, children: [{ mapId: M.glade, children: [] }] },
        { mapId: M.shrine, children: [{ mapId: ids.forest, children: [] }] },
      ],
    });
  }
  return { mapIds: [M.edge, M.stream, M.thicket, M.shrine, M.glade, ids.forest], chests, hidden };
}
