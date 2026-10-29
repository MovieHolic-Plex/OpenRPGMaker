import { starterChoiceCommands } from "@/project/starterChoice";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassableLanding } from "@/project/collision";
import { slideRuleAt } from "@/project/slideTiles";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel } from "@/project/monsterCollection";
import { charsetGraphic, demoEnemy, demoTroop } from "@/project/defaults/scarloxyDemoGame";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { EXPEDITION_AUDIO as audio } from "./audio";
import { EXPEDITION_BALL_IDS, EXPEDITION_HELD_ITEM_IDS, EXPEDITION_STONE_IDS, EXPEDITION_SPECIES, EXPEDITION_STARTERS, EXPEDITION_LEGENDARIES } from "./roster";
import { EXPEDITION_TOWNS as allTowns, EXPEDITION_GYMS as gyms, EXPEDITION_ROUTES as planRoutes, EXPEDITION_SIDE_AREAS as allSides } from "./worldPlan";
import { campaignLevels, campaignShape, clampGymCount, FULL_GYMS, gymWord } from "./campaignPlan";
import markerAssets from "./markers.json";
import templateData from "./mapTemplates.json";
import { composeTown, START_ROUTES, START_TOWNS, TOWN_SKETCHES, VOLCANO_ROUTE_KEYS, VOLCANO_TOWN_KEYS, volcanoRouteSketch, volcanoTownSketch, homeTownSketch, type HomeTownLayout, type StartTheme } from "./townLayouts";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { roughenTallGrass } from "./tallGrassShape";
import { expeditionEnemyActions } from "./enemyActions";
import { repairExpeditionShopPrices } from './shopPrices';
import { monsterCenterCommands } from "@/project/monsterCenterRecipe";
import { configureExpeditionFishing, EXPEDITION_FIELD_ITEM_IDS, EXPEDITION_FISHING_ROD_ID } from './fieldItems';
import { repairExpeditionResidents } from './residents';
import { repairExpeditionNpcLayout } from "./npcLayout";
import { EXPEDITION_HERO_BACK, expeditionTrainerFront, gymLeaderArt, typeArt } from "./trainerArt";
import { ensureGrassTerrainRecord, GRASS_TERRAIN_ID } from "@/project/defaults/defaultDatabaseUtilityRecords";
import { terrainRecordAt } from "@/project/terrainAt";
import { fillAreaByUse } from "@/project/kitAreaFurnish";
import { badgeAwardCommands, badgeIconResourceId } from "@/project/monsterBadgeCeremony";
import { withJosa } from "@/util/josa";

type Point = { x: number; y: number };
type Template = { width: number; height: number; lower: number[]; upper: number[]; tilesetId: string; run: string;
  names: Record<string, number>; buildings: { name: string; width: number; height: number; rowsLower: number[][]; rowsUpper: number[][] }[];
  marks?: Record<string, number[][]>; leader?: number[] };
const templates = templateData as unknown as Record<string, Template>;
const fixed = { type: "fixed", speed: 3, frequency: 3 } as const;
/** 시야선 트레이너 시선 칸 수(3세대: 3~4칸). */
const SIGHT_RANGE = 4;
const invisible = { transparent: true };
const marker = (key: "exit" | "chest" | "star") => ({ sprite: { type: "uploaded" as const, id: `mx_marker_${key}` }, pattern: 0, direction: "down" as const, transparent: false });
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const mid = (map: GameMap): Point => ({ x: map.width >> 1, y: map.height >> 1 });
const id = (key: string) => `mx_map_${key}`;
const sw = (switchId: string, value = true): Command => ({ kind: "setSwitch", switchId, value });
const text = (body: string, speaker?: string): Command => ({ kind: "text", body, ...(speaker ? { speaker } : {}) });
const condition = (switchId: string) => ({ kind: "switch", switchId, value: true } as const);
const gain = (itemId: string, amount: number): Command => ({ kind: "changeItem", itemId, op: "+=", amount });
const transfer = (map: GameMap, at: Point): Command => ({ kind: "transfer", mapId: map.id, ...at, direction: "down", fade: "black" });
const battleMusic = (resourceId?: string): Command => ({ kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: resourceId ? { cue: "battle", operation: "set", resourceId, volume: 100 } : { cue: "battle", operation: "reset", value: "", volume: 100 } });
const music = (resourceId: string): Command => ({ kind: "playAudio", resourceId, channel: "bgm", loop: true });

export interface ExpeditionManifest {
  maps: { id: string; name: string; template: string; entry: Point; role: string }[];
  links: { from: string; to: string; eventId: string; source: Point; destination: Point; required?: string }[];
  battles: { mapId: string; eventId: string; troopId: string; level: number; victorySwitch?: string }[];
  devices: { mapId: string; eventId: string; switchId: string; cells: number }[];
}

/** Build one ordinary editor project. No game-specific gameplay engine is hidden here. */
const START_HABITAT: Readonly<Record<StartTheme, string>> = { desert: "desert", snow: "snow", coast: "coast", volcano: "volcano" };
const START_ROUTE_NAMES: Readonly<Record<StartTheme, string>> = { desert: "1번길 · 모래바람 길", snow: "1번길 · 서리 들길", coast: "1번길 · 바닷바람 길", volcano: "1번길 · 재바람 길" };
/** 화산 캠페인: 시작 길 이후의 길도 같은 재 재료로 깐다(townLayouts.volcanoRouteSketch). 고개·유적은 본래 바위 그림이라 그대로 둔다. */
const VOLCANO_ROUTE_NAMES: Readonly<Record<string, string>> = { forest: "2번길 · 재 능선", river: "3번길 · 온천 협곡", desert: "5번길 · 유리재 평원", snow: "6번길 · 연기 고개", marsh: "7번길 · 증기 비탈" };

/** 관장 타입을 바꾼 관의 배지 이름. 본래 타입이면 worldPlan 의 배지를 그대로 쓴다. */
const TYPE_BADGE: Readonly<Record<string, string>> = {
  normal: "보름 배지", fire: "불씨 배지", water: "밀물 배지", grass: "새잎 배지", electric: "번개 배지", ice: "눈결정 배지",
  fighting: "기백 배지", poison: "가시 배지", ground: "모래시계 배지", flying: "깃털 배지", psychic: "거울 배지", bug: "고치 배지",
  rock: "주춧돌 배지", ghost: "등불 배지", dragon: "별마루 배지", dark: "그믐 배지", steel: "강철 배지", fairy: "꽃잎 배지",
};

/** 관장 타입 → 체육관 판(gyms/gym_<키>). 판 여덟 가지에 타입 열여덟을 가장 가까운 분위기로 나눈다. */
const GYM_KEY_BY_TYPE: Readonly<Record<string, string>> = {
  grass: "grass", bug: "grass",
  water: "water",
  fire: "fire",
  psychic: "psychic", electric: "psychic", fairy: "psychic",
  fighting: "dojo", ground: "dojo", rock: "dojo", normal: "dojo",
  ice: "ice",
  ghost: "ghost", dark: "ghost", poison: "ghost",
  dragon: "dragon", steel: "dragon", flying: "dragon",
};

export function authorExpeditionWorld(project: Project, options: { readonly firstGymType?: string; readonly gymTypes?: readonly (string | undefined)[]; readonly startTheme?: StartTheme; readonly gymCount?: number; readonly startLayout?: HomeTownLayout } = {}): ExpeditionManifest {
  // 화산 기획의 1관은 불 체육관이다 — 시작 마을이 재 마을 판(둘째 마을 ↔ 잿빛 온천 맞바꿈)이라 풀 관장이 서 있으면 어색하다. 기획서가 첫 관 타입을 정하면 그것이 이긴다.
  if (options.startTheme === "volcano" && !options.firstGymType && options.gymTypes?.[0] === undefined) options = { ...options, firstGymType: "fire" };
  // 규모(체육관 수) — 기본 8관은 아래 모든 값이 본래 그대로다. 0~7관은 마을·길·부속 지역·리그를 앞에서부터 잘라 쓴다.
  const gymCount = clampGymCount(options.gymCount);
  const shape = campaignShape(gymCount);
  const levels = campaignLevels(gymCount);
  const towns = allTowns.slice(0, shape.finalTown + 1);
  const finalKey = towns[shape.finalTown]!.key;
  const townIndex = (key: string) => allTowns.findIndex(t => t.key === key);
  // 체육관 수보다 큰 배지 번호는 이 캠페인에 없다 — 그 번호로 잠근 문은 앞 약속(마지막 배지, 0관은 스타터)으로 잠근다.
  const gate = (switchId: string | undefined): string | undefined => {
    const m = switchId && /^mx_badge_(\d+)$/.exec(switchId);
    return m && Number(m[1]) > gymCount ? (gymCount >= 1 ? `mx_badge_${gymCount}` : "mx_starter") : switchId;
  };
  const sides = allSides.filter(s => towns.some(t => t.key === s.town)).map(s => ({ ...s, level: levels.side(townIndex(s.town), s.level) }));
  // 시작 테마의 1번길 이름도 그 땅으로 — 사막 모랫길 위에 「1번길 · 별싹 들판」 표지가 떴다(2026-10-07 사막 런타임 캡처).
  const routes = planRoutes.slice(0, shape.finalTown).map((r, j) => ({ ...r, level: levels.route(j + 1), required: gate(r.required)!, ...(r.key === "meadow" && options.startTheme ? { name: START_ROUTE_NAMES[options.startTheme] } : {}),
    ...(options.startTheme === "volcano" && VOLCANO_ROUTE_NAMES[r.key] ? { name: VOLCANO_ROUTE_NAMES[r.key] } : {}) }));
  const volcano = options.startTheme === "volcano";
  /** 화산 캠페인의 재 길: 길 열쇠 → 변주 번호(0 은 시작 길 그대로). */
  const volcanoRoute = (key: string): number => volcano ? ([...VOLCANO_ROUTE_KEYS, "desert"] as string[]).indexOf(key) : -1;
  for (const [aid, asset] of Object.entries(markerAssets)) project.assets.uploaded[aid] = structuredClone(asset) as Project["assets"]["uploaded"][string];
  project.maps = {};
  project.mapConnections = [];
  const manifest: ExpeditionManifest = { maps: [], links: [], battles: [], devices: [] };
  /** 맵 id → 그 맵 대표 트레이너(관장·사천왕·악당 두목)의 전투 그림 역할. battle() 이 읽는다. */
  const trainerArtByMap = new Map<string, string>();
  const sources = new Map<string, Template>();
  const entries = new Map<string, Point>();
  const reserved = new Map<string, Set<string>>();
  const doorSpots = new Map<string, Point>();
  const exitHints = new Map<string, Point>();
  function drawnExit(map: GameMap, t: Template): Point | undefined {
    const exits = new Set(Object.entries(t.names).filter(([n]) => /_exit$|_mat(_|$)/.test(n) && !/edge_mat/.test(n)).map(([, v]) => v));
    for (let y = map.height - 1; y >= map.height - 3; y--) for (let x = 0; x < map.width; x++) {
      if (exits.has(map.lowerTiles[y * map.width + x]!)) return { x, y };
    }
    return undefined;
  }
  const speciesById = new Map((project.database.monsterSpecies ?? []).map(s => [s.id, s]));
  const coord = (p: Point) => `${p.x},${p.y}`;
  const reserve = (map: GameMap, p: Point) => reserved.get(map.id)!.add(coord(p));

  // 시작 테마가 있으면 둘째 마을(1관)도 그 땅의 마을 판을 쓴다 — 사막 마을·사막 길 다음에 꽃밭 마을과 정원 체육관이 나와
  // 분위기가 튀었다(2026-10-07 사용자 지적). 같은 기후의 뒤쪽 마을(모래종·서리꽃)과 판·안내 문장을 맞바꾼다.
  // 바닷가는 바꾸지 않는다 — 물결 항구는 잔교·배 출구 좌표가 그 판에 묶여 있고(harborExit), 바닷가 시작 마을도 풀밭 판이다.
  const swappedTown = options.startTheme === "desert" ? "dune" : options.startTheme === "snow" ? "frost" : options.startTheme === "volcano" ? "ember" : undefined;
  const lookOf = (key: string): string => !swappedTown ? key : key === "grove" ? swappedTown : key === swappedTown ? "grove" : key;
  // 화산 캠페인에서 풀 마을 판을 쓰던 마을 이름(새순)이 재 땅에 남지 않게 한다 — 재를 뚫고 나는 싹이라는 본래 소개 문장은 그대로 맞는다.
  const VOLCANO_TOWN_RENAME: Readonly<Record<string, string>> = { "새순 마을": "재싹 마을" };
  const lookTown = (t: (typeof allTowns)[number]) => { const look = allTowns.find(other => other.key === lookOf(t.key))!; return volcano && VOLCANO_TOWN_RENAME[look.name] ? { ...look, name: VOLCANO_TOWN_RENAME[look.name]! } : look; };
  const gymPlanTowns = new Set<string>(gyms.slice(0, gymCount).map(g => g.town));

  function make(key: string, name: string, source: string, track: keyof typeof audio, role: "town" | "field" | "interior" | "dungeon"): GameMap {
    const look = role === "town" ? lookOf(key) : key;
    const t = templates[source];
    if (!t) throw Error(`Missing reviewed map ingredient ${source}`);
    const map: GameMap = { id: id(key), name, width: t.width, height: t.height, tilesetId: t.tilesetId, tileSize: 16,
      lowerTiles: [...t.lower], upperTiles: [...t.upper], events: [], encounterRate: 0,
      mapRole: role, bgm: { mode: "custom", resourceId: audio[track], fadeInMs: 350 }, battleBackground: undefined };
    if (look === "ember" || look === "frost") {
      const oldWidth = map.width, insert = 6;
      const lower: number[] = [], upper: number[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < oldWidth + insert; x++) {
        if (look === "frost" && x >= 2 && x < 2 + insert && (y < 3 || y >= map.height - 2)) {
          // 눈 마을 위 숲 띠는 세 줄(아래는 두 줄)이다 — 첫 줄만 이어 붙여 왼쪽 위에 흰 네모가 뚫려 있었다(2026-10-07 눈 시작 렌더).
          const cell = y * oldWidth + 2 + ((x - 2) & 1);
          lower.push(t.lower[cell]!); upper.push(t.upper[cell]!);
        } else if (x >= 2 && x < 2 + insert) {
          lower.push(y === 0 || y === map.height - 1 ? t.lower[y * oldWidth]! : t.names[look === "frost" ? "snow0" : "ash0"]!);
          upper.push(-1);
        } else {
          const cell = y * oldWidth + (x < 2 ? x : x - insert);
          lower.push(t.lower[cell]!); upper.push(t.upper[cell]!);
        }
      }
      map.width += insert; map.lowerTiles = lower; map.upperTiles = upper;
      stamp(map, t.buildings.find(b => b.name === "mart")!, 3, 4);
    }
    // 같은 템플릿을 지붕 색만 바꿔 쓰던 마을은 저마다의 판으로 다시 깐다(townLayouts.ts).
    const startTown = !options.startTheme ? undefined : key === "home" ? START_TOWNS[options.startTheme] : key === "meadow" ? START_ROUTES[options.startTheme] : undefined;
    // 화산 캠페인은 시작 마을·길만이 아니라 뒤의 재 마을·재 길도 같은 재 재료 판이다(항구·도시는 섬의 항구라 그대로).
    const volcanoTown = volcano && role === "town" && key !== "home" && (VOLCANO_TOWN_KEYS as readonly string[]).includes(key);
    const volcanoField = volcano && role === "field" && key !== "meadow" && volcanoRoute(key) > 0;
    // 시작 마을 짜임(2026-10-24): 풀밭 시작 마을은 손잡이·씨앗으로 판을 새로 짠다 — 늘 같은 템플릿이었다.
    const homeLayout = key === "home" && !options.startTheme && options.startLayout ? homeTownSketch(options.startLayout).sketch : undefined;
    const sketch = homeLayout ?? (volcanoTown ? volcanoTownSketch(towns.findIndex(x => x.key === key) + 1, gymPlanTowns.has(key))
      : volcanoField ? volcanoRouteSketch(volcanoRoute(key)) : startTown?.sketch ?? TOWN_SKETCHES[look]);
    // 0관 캠페인: 마을 판의 체육관 건물(7×7)은 체육관 문처럼 보이는데 안은 조련사 회관(교실 판 재사용)이었다. 같은 크기의 박공 집으로 바꾼다.
    const gymless = gymCount === 0 && role === "town" && sketch && t.buildings.some(b => b.name === "gable_a");
    if (sketch) composeTown(project, map, t, gymless ? { ...sketch, kits: sketch.kits.map(([n, x, y]) => [n.startsWith("gym_") ? "gable_a" : n, x, y] as [string, number, number]) } : sketch, templates);
    // 1번길 템플릿은 길 끝 다섯 줄이 모래 띠였다 — 길로 이어 깐다(모래 네모가 풀숲 옆에 떠 보였다, 2026-10-06 시각 QA).
    // 메아리 동굴 템플릿은 바닥 한가운데 밝은 노란 모래 네모가 떠 보였고, 드나드는 문도 바닥 한가운데 보이지 않는 칸이었다.
    // 모래는 동굴 바닥으로, 문은 템플릿이 그려 둔 사다리(「이동 이벤트를 올릴 자리」) 칸으로 옮긴다.
    // 8번길 유적 템플릿은 출구 위 모래에 돌바닥 두 칸이 덩그러니 떠 있었다(2026-10-06 조화 검수 지적, 렌더로 확인) — 모래로 덮는다.
    if (source === "dungeon/ruins" && !TOWN_SKETCHES[key]) {
      const stone = new Set(["ru_fl2", "ru_fl3"].map(n => t.names[n]));
      for (let x = 0; x < map.width; x++) {
        const cell = (map.height - 3) * map.width + x;
        if (stone.has(map.lowerTiles[cell]!)) map.lowerTiles[cell] = t.names[x % 2 ? "ru_sand1" : "ru_sand2"]!;
      }
    }
    if (source === "overworld/cave") {
      // 쓰지 않는 아래층 구멍도 길처럼 읽히므로 함께 바닥으로.
      const sand = new Set([...Object.entries(t.names).filter(([n]) => n.startsWith("cave_sand")).map(([, v]) => v), t.names.hole_down!]);
      const floor = ["cave_floor0", "cave_floor1", "cave_floor2", "cave_floor3"].map(n => t.names[n]!);
      map.lowerTiles.forEach((tile, i) => { if (sand.has(tile)) map.lowerTiles[i] = floor[(i * 7 + (i >> 3)) % floor.length]!; });
      const ladder = map.lowerTiles.indexOf(t.names.ladder_up!);
      if (ladder >= 0) doorSpots.set(map.id, { x: ladder % map.width, y: Math.floor(ladder / map.width) });
    }
    if (source === "overworld/route") {
      const clearing = autotileGroupsForTileset(project.tilesets[map.tilesetId]).find(g => g.id === "clearing")!;
      const sand = new Set(Object.entries(t.names).filter(([n]) => n.startsWith("sand_at")).map(([, v]) => v));
      const changed: Point[] = [];
      map.lowerTiles.forEach((tile, i) => { if (sand.has(tile)) { map.lowerTiles[i] = clearing.variantMap["255"]!; changed.push({ x: i % map.width, y: Math.floor(i / map.width) }); } });
      shapeAllAutotileGroupsAround(map, [clearing], changed);
    }
    // 길 맵의 키큰 풀숲은 템플릿의 자로 그은 네모였다(2026-10-28 장부 125 「풀이 경직된 격자」) — 가장자리를 깎고 내밀어 둥근 덩이로.
    if (role === "field") roughenTallGrass(map, t.names, map.id);
    project.maps[map.id] = map;
    sources.set(map.id, t);
    reserved.set(map.id, new Set());
    const gymStart = source.startsWith("gyms/") ? { x: ["grass", "ice", "dojo", "ghost"].some(k => source.endsWith(k)) ? 8 : 9, y: source.endsWith("grass") || source.endsWith("ice") ? 19 : source.endsWith("dojo") ? 18 : 17 } : undefined;
    // 템플릿이 그려 둔 출구(「…_exit」·문 앞 매트)에 드나든다 — 가운데로 셈하면 유적·탑에서 그린 출구 옆 칸에 문이 섰다(2026-10-06).
    const drawn = drawnExit(map, t);
    if (drawn) exitHints.set(map.id, drawn);
    const p = gymStart ?? anchor(map, drawn ?? { x: map.width >> 1, y: map.height - 2 });
    entries.set(map.id, p);
    reserve(map, p);
    manifest.maps.push({ id: map.id, name, template: source, entry: p, role });
    return map;
  }

  function stamp(map: GameMap, kit: Template["buildings"][number], ox: number, oy: number): void {
    if (!kit) throw Error("Missing reviewed building kit");
    for (let y = 0; y < kit.height; y++) for (let x = 0; x < kit.width; x++) {
      const cell = (oy + y) * map.width + ox + x;
      for (const layer of ["lower", "upper"] as const) {
        const tile = (layer === "lower" ? kit.rowsLower : kit.rowsUpper)[y]![x]!;
        // Replace the complete footprint, including transparent upper cells.
        if (tile >= 0 || layer === "upper") (layer === "lower" ? map.lowerTiles : map.upperTiles)[cell] = tile;
      }
    }
  }

  // 드나드는 칸은 가까운 길 위로 — 맵 가운데 아래를 그대로 쓰면 1번길 남쪽 문이 길 옆 풀숲 속에 섰다(2026-10-06 실플레이).
  function anchor(map: GameMap, wanted: Point, component?: Point[]): Point {
    const walkway = new Set(autotileGroupsForTileset(project.tilesets[map.tilesetId])
      .filter(g => ["clearing", "path", "snowpath", "ashpath"].includes(g.id)).flatMap(g => g.memberTileIds));
    const near = (component ?? Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: Math.floor(i / map.width) })))
      .filter(p => walkway.has(map.lowerTiles[p.y * map.width + p.x]!) && Math.abs(p.x - wanted.x) + Math.abs(p.y - wanted.y) <= 4
        && !reserved.get(map.id)?.has(coord(p)) && !map.events.some(e => e.x === p.x && e.y === p.y));
    return near.length ? nearest(map, wanted, near, true) : nearest(map, wanted, component, component !== undefined);
  }

  function connected(map: GameMap, start = entries.get(map.id) ?? mid(map)): Point[] {
    const queue = [start], seen = new Set([coord(start)]);
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]!;
      for (const [dx, dy] of directions) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (!seen.has(coord(q)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(coord(q)); queue.push(q); }
      }
    }
    return queue;
  }

  function nearest(map: GameMap, wanted: Point, component?: Point[], avoid = false): Point {
    const candidates = component ?? Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
    const t = project.tilesets[map.tilesetId]!;
    const allowed = candidates.filter(p => isPassableLanding(project, map, p.x, p.y)
      && (!avoid || (!reserved.get(map.id)?.has(coord(p)) && !map.events.some(e => e.x === p.x && e.y === p.y)))
      && !slideRuleAt(t, map, p.x, p.y));
    allowed.sort((a, b) => Math.abs(a.x - wanted.x) + Math.abs(a.y - wanted.y) - Math.abs(b.x - wanted.x) - Math.abs(b.y - wanted.y));
    const p = allowed[0];
    if (!p) throw Error(`No walkable authored anchor in ${map.id}`);
    return p;
  }

  function event(map: GameMap, suffix: string, at: Point, commands: Command[], options: { graphic?: EventPage["graphic"]; below?: boolean; trigger?: "action" | "playerTouch" | "auto"; pages?: EventPage[] } = {}): GameEvent {
    const eid = `${map.id}_${suffix}`;
    const trigger = { kind: options.trigger ?? "action" } as const;
    const priority = options.below || options.trigger === "auto" ? "below" : "same";
    const p: EventPage = { id: `${eid}_page`, name: suffix, conditions: [], graphic: options.graphic ?? invisible,
      movement: fixed, priority, trigger, overlapForbidden: priority === "same" && options.graphic !== undefined && options.graphic.transparent !== true, commands };
    const e: GameEvent = { id: eid, x: at.x, y: at.y, trigger, commands: [], pages: options.pages ?? [p] };
    map.events.push(e); reserve(map, at); return e;
  }

  function npc(map: GameMap, suffix: string, name: string, body: string, wanted: Point, commands: Command[] = [], index = 2): GameEvent {
    const component = connected(map);
    const wide = component.filter(p => directions.every(([dx, dy]) => canMove(project, map, p.x, p.y, p.x + dx, p.y + dy)));
    const at = nearest(map, wanted, wide.length ? wide : component, true);
    return event(map, suffix, at, [text(body, name), ...commands], { graphic: charsetGraphic("tex_easyrpg_charset_people1", index) });
  }

  function portal(map: GameMap, target: GameMap, at: Point, landing: Point, wantedRequired?: string, label = target.name): void {
    const required = gate(wantedRequired);
    if (!isPassableLanding(project, map, at.x, at.y) || !isPassableLanding(project, target, landing.x, landing.y)) throw Error(`Blocked doorway ${map.name} → ${target.name}`);
    const go = transfer(target, landing);
    const commands: Command[] = required ? [{ kind: "fork", condition: condition(required), then: [go], else: [text(`${label}로 가는 길은 아직 열리지 않았다. 메뉴의 「배지·목표」에서 다음 약속을 확인하자.`)] }] : [go];
    // Travel is shown by authored doors, paths and stairs; transfer events do not
    // draw a navigation arrow over the native tiles.
    const e = event(map, `to_${target.id}`, at, commands, { trigger: "playerTouch", below: true, graphic: invisible });
    manifest.links.push({ from: map.id, to: target.id, eventId: e.id, source: at, destination: landing, ...(required ? { required } : {}) });
  }

  // 입구에서 걸어 닿는 칸 — 막는 사람·표지판 칸은 지나지 못하고, 이동 칸(문)은 닿기만 하고 넘어가지 않는다.
  function walkable(map: GameMap, extraBlock?: Point): Set<string> {
    const solid = new Set(map.events.filter(e => e.pages?.[0]?.overlapForbidden).map(e => coord(e)));
    if (extraBlock) solid.add(coord(extraBlock));
    const doors = new Set(map.events.filter(e => e.id.includes("_to_")).map(e => coord(e)));
    const start = entries.get(map.id)!;
    const queue = [start], seen = new Set([coord(start)]);
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]!;
      if (n > 0 && doors.has(coord(p))) continue;
      for (const [dx, dy] of directions) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (!seen.has(coord(q)) && !solid.has(coord(q)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(coord(q)); queue.push(q); }
      }
    }
    return seen;
  }

  // 트레이너가 설 자리 — 풀숲(조우)·계단·턱·출구 판 위나 문 곁, 길목에는 세우지 않는다. 시각 QA(2026-10-06)에서
  // 트레이너가 풀숲 한가운데·산길 돌계단·유적 출구 판 위에 서 있었다. 그런 칸이 없으면 예전처럼 가장 가까운 칸.
  function standSpot(map: GameMap, wanted: Point, sighted = false, apart: readonly Point[] = [], strict = false, keepsRoute?: (p: Point) => boolean): Point | undefined {
    const meta = project.tilesets[map.tilesetId]?.tileMeta ?? [];
    const busy = (tile: number | undefined) => tile !== undefined && tile >= 0 && /키 큰 풀|계단|stairs|턱|출구|매트|mat\(/i.test(meta[tile]?.label ?? "");
    const doors = map.events.filter(e => e.id.includes("_to_"));
    const before = walkable(map).size;
    const slide = project.tilesets[map.tilesetId]!;
    const fits = (p: Point) => !busy(map.lowerTiles[p.y * map.width + p.x]) && !busy(map.upperTiles[p.y * map.width + p.x]) && !slideRuleAt(slide, map, p.x, p.y)
      && doors.every(d => Math.max(Math.abs(d.x - p.x), Math.abs(d.y - p.y)) > 2)
      && !reserved.get(map.id)!.has(coord(p)) && !map.events.some(e => e.x === p.x && e.y === p.y);
    // 시야선 트레이너는 곧은 통로가 3칸 이상 트인 자리에 세운다(그래야 걸어오는 연출이 성립한다). 그런 칸이 없으면 예전처럼.
    const open = (p: Point) => !sighted || sightFacing(map, p).range >= 3;
    const candidates = connected(map).filter(p => fits(p) && open(p) && (!keepsRoute || keepsRoute(p)) && apart.every(a => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) >= 5))
      .sort((a, b) => Math.abs(a.x - wanted.x) + Math.abs(a.y - wanted.y) - Math.abs(b.x - wanted.x) - Math.abs(b.y - wanted.y));
    const spot = candidates.find(p => walkable(map, p).size === before - 1);
    // strict: 길을 끊지 않는 자리가 없으면 세우지 않는다(체육관 졸개 — 좁은 퍼즐 방에서 통로를 막아 장치까지 못 가게 만들었다).
    return spot ?? (strict ? undefined : nearest(map, wanted, connected(map), true));
  }

  function connect(a: GameMap, b: GameMap, required?: string): void {
    // 이미 선 표지판·사람 뒤로 문을 두지 않는다 — 새순·달그림자 마을에서 둘째 북쪽 문이 첫 표지판에 막혔다(2026-10-06).
    const reachA = walkable(a);
    const ca = connected(a).filter(p => reachA.has(coord(p))), cb = connected(b);
    const harborExit = a.id === id("harbor") ? ({ mx_map_river: { x: 15, y: 9 }, mx_map_ship_deck: { x: 16, y: 9 }, mx_map_beach: { x: 8, y: 10 }, mx_map_sea_cave: { x: 23, y: 10 } }[b.id]) : undefined;
    // 작은 캠페인(마지막 마을이 항구 같은 옛 중간 마을)에서는 마지막 마을 북쪽에 문이 둘(관측탑·리그) 붙는다. 리그 문이 첫 문 뒤 골목에
    // 갇히지 않게, 둘째 문은 그 아래 칸으로 걸어 닿는 자리에만 둔다(관측탑 문도 같다). 기본(8관) 캠페인과 그 밖의 연결은 한 칸도 달라지지 않는다.
    const wantedA = { x: a.width >> 1, y: 2 };
    const leagueDoor = shape.gyms < FULL_GYMS && !harborExit && a === townMaps.get(finalKey) && (b === observatory || b === league[0]);
    const openA = leagueDoor
      ? ca.filter(p => Math.abs(p.x - wantedA.x) + Math.abs(p.y - wantedA.y) <= 8
        && a.events.every(e => !e.id.includes("_to_") || Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) > 1))
        .filter(p => { const below = { x: p.x, y: p.y + 1 }, open = walkable(a, p); return canMove(project, a, p.x, p.y, below.x, below.y) && open.has(coord(below)) && a.events.every(e => !e.id.includes("_to_") || open.has(coord(e))); })
      : [];
    const atA = harborExit ?? anchor(a, wantedA, openA.length ? openA : ca);
    const drawnDoor = doorSpots.get(b.id);
    const atB = drawnDoor ?? anchor(b, exitHints.get(b.id) ?? { x: b.width >> 1, y: b.height - 2 }, cb);
    reserve(a, atA); reserve(b, atB);
    const landA = harborExit ? { x: harborExit.x, y: harborExit.y + (b.id === id("river") ? 1 : -1) } : nearest(a, { x: atA.x, y: atA.y + 1 }, ca, true);
    reserve(a, landA);
    const landB = nearest(b, { x: atB.x, y: atB.y + (drawnDoor ? 1 : -1) }, cb, true);
    reserve(b, landB);
    portal(a, b, atA, landB, required); portal(b, a, atB, landA);
    // Visible, inspectable signposts explain interior route entrances.
    // 표지판은 길목이 아닌 칸에 세운다 — 그 칸 하나 말고는 걸어 닿는 칸이 줄지 않아야 한다.
    // 나무 이정표는 바깥(마을·길)에만, 이미 3칸 안에 표지판이 있으면 더 세우지 않는다 — 리그 경기장·배 복도에 나무 이정표가 서고
    // 서리꽃 마을 북쪽 길목에 셋이 몰렸다(2026-10-06 실제 편집기 조수 실행의 조화 검수 지적, 렌더로 확인).
    const roleA = manifest.maps.find(m => m.id === a.id)?.role;
    if (roleA !== "town" && roleA !== "field") return;
    const before = walkable(a).size;
    const wide = connected(a).filter(p => directions.every(([dx, dy]) => canMove(project, a, p.x, p.y, p.x + dx, p.y + dy)))
      .filter(p => !reserved.get(a.id)!.has(coord(p)) && !a.events.some(e => e.x === p.x && e.y === p.y));
    const wanted = { x: atA.x + 1, y: atA.y + 1 };
    wide.sort((p, q) => Math.abs(p.x - wanted.x) + Math.abs(p.y - wanted.y) - Math.abs(q.x - wanted.x) - Math.abs(q.y - wanted.y));
    const spot = wide.find(p => walkable(a, p).size === before - 1) ?? wanted;
    if (a.events.some(e => /_sign_/.test(e.id) && Math.max(Math.abs(e.x - spot.x), Math.abs(e.y - spot.y)) <= 3)) return;
    npc(a, `sign_${b.id}`, "길 안내", `북쪽 길: ${b.name}`, spot, [], 4);
  }

  /** 문 자리 → 「북동쪽」 같은 방위(마을 가운데 기준). */
  function compass(map: GameMap, p: Point): string {
    const ns = p.y < map.height * 0.4 ? "북" : p.y > map.height * 0.6 ? "남" : "";
    const ew = p.x < map.width * 0.4 ? "서" : p.x > map.width * 0.6 ? "동" : "";
    return ns || ew ? `${ns}${ew}쪽` : "가운데";
  }

  function doorways(map: GameMap): { x: number; y: number; name: string }[] {
    const t = sources.get(map.id)!;
    const found: { x: number; y: number; name: string }[] = [];
    for (const kit of t.buildings) {
      const first = kit.rowsLower.flat().findIndex(v => v >= 0);
      const useLower = first >= 0;
      const rowData = useLower ? kit.rowsLower : kit.rowsUpper;
      const fi = useLower ? first : rowData.flat().findIndex(v => v >= 0);
      if (fi < 0) continue;
      const fx = fi % kit.width, fy = Math.floor(fi / kit.width), tile = rowData[fy]![fx]!;
      const layer = useLower ? map.lowerTiles : map.upperTiles;
      for (let cy = 0; cy < map.height; cy++) for (let cx = 0; cx < map.width; cx++) {
        if (layer[cy * map.width + cx] !== tile) continue;
        const ox = cx - fx, oy = cy - fy;
        if (ox < 0 || oy < 0 || ox + kit.width > map.width || oy + kit.height > map.height) continue;
        let matches = true;
        for (let y = 0; y < kit.height && matches; y++) for (let x = 0; x < kit.width; x++) {
          const idx = (oy + y) * map.width + ox + x;
          if ((kit.rowsLower[y]![x]! >= 0 && map.lowerTiles[idx] !== kit.rowsLower[y]![x])
            || (kit.rowsUpper[y]![x]! >= 0 && map.upperTiles[idx] !== kit.rowsUpper[y]![x])) { matches = false; break; }
        }
        if (!matches) continue;
        const openings = Array.from({ length: kit.width }, (_, x) => ({ x: ox + x, y: oy + kit.height - 1 }))
          .filter(p => isPassableLanding(project, map, p.x, p.y) && canMove(project, map, p.x, p.y + 1, p.x, p.y));
        const opening = openings.sort((a, b) => Math.abs(a.x - (ox + kit.width / 2)) - Math.abs(b.x - (ox + kit.width / 2)))[0];
        if (opening && !found.some(d => d.x === opening.x && d.y === opening.y)) found.push({ ...opening, name: kit.name });
      }
    }
    return found.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function attachRoom(town: GameMap, room: GameMap, doorway: Point): void {
    reserve(town, doorway);
    reserve(town, { x: doorway.x, y: doorway.y + 1 });
    const exit = entries.get(room.id)!;
    const landing = nearest(room, { x: exit.x, y: exit.y - 1 }, connected(room), true);
    reserve(room, landing);
    portal(town, room, doorway, landing);
    portal(room, town, exit, { x: doorway.x, y: doorway.y + 1 });
  }

  // 층계로 위아래 층을 잇는다 — 아래층 올라가는 계단(h_stairs·c_escalator) 발치를 밟으면 위층 내려가는 계단(_dn) 바로 앞에,
  // 위층 _dn 발치를 밟으면 아래층 계단 바로 앞에 선다. 발치 칸은 칩셋이 통행으로 둔다(bake 의 stairs 종류).
  // 그 전에는 계단이 막힌 소품이라 1층 계단을 밟을 수도 2층에 갈 수도 없었다(2026-10-07 사용자 지적).
  function stairFeet(map: GameMap, down: boolean): Point[] {
    const t = sources.get(map.id)!;
    const stair = (n: string) => { const m = /^(h_stairs|c_escalator)(_dn)?\.\d+\.(\d+)$/.exec(n); return m && !!m[2] === down ? { base: m[1]! + (m[2] ?? ""), dy: Number(m[3]) } : undefined; };
    const bottom = new Map<string, number>();
    for (const n of Object.keys(t.names)) { const s = stair(n); if (s) bottom.set(s.base, Math.max(bottom.get(s.base) ?? 0, s.dy)); }
    const feet = new Set(Object.entries(t.names).filter(([n]) => { const s = stair(n); return s !== undefined && s.dy === bottom.get(s.base); }).map(([, v]) => v));
    const found: Point[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const cell = y * map.width + x;
      if (feet.has(map.upperTiles[cell]!) || feet.has(map.lowerTiles[cell]!)) found.push({ x, y });
    }
    return found;
  }

  function attachStairs(lower: GameMap, upper: GameMap): void {
    const up = stairFeet(lower, false), down = stairFeet(upper, true);
    if (!up.length || up.length !== down.length) throw Error(`Stairs do not pair ${lower.id} (${up.length}) ↔ ${upper.id} (${down.length})`);
    up.forEach((foot, k) => {
      const back = down[k]!;
      const landUp = { x: back.x, y: back.y + 1 }, landDown = { x: foot.x, y: foot.y + 1 };
      for (const [map, at, target, land] of [[lower, foot, upper, landUp], [upper, back, lower, landDown]] as const) {
        if (!isPassableLanding(project, map, at.x, at.y) || !isPassableLanding(project, target, land.x, land.y)) throw Error(`Blocked stairs ${map.id} → ${target.id}`);
        reserve(target, land);
        const e = event(map, `stairs_${target.id}_${k}`, at, [transfer(target, land)], { trigger: "playerTouch", below: true, graphic: invisible });
        manifest.links.push({ from: map.id, to: target.id, eventId: e.id, source: at, destination: land });
      }
    });
  }

  function troop(name: string, key: string, speciesIds: readonly string[], baseLevel: number, trainer: boolean, aceBonus = 0): string {
    const enemyIds = speciesIds.map((speciesId, i) => {
      // 마지막 칸(간판)만 aceBonus 만큼 높다 — 관장·간부가 앞선 졸개와 같은 레벨 한 줄이 아니게(D35).
      const level = baseLevel + (speciesIds.length > 1 && i === speciesIds.length - 1 ? aceBonus : 0);
      const sid = `${key}_${i}`;
      const enemyId = `mx_enemy_${sid}`;
      const species = speciesById.get(speciesId);
      if (!species) throw Error(`Missing species ${speciesId}`);
      const skills = monsterSkillIdsAtLevel(species, level);
      const stats = monsterBattleStatsForSpecies(species, level, { hp: 12, atk: 12, def: 12, spd: 12 });
      const enemy = demoEnemy(enemyId, species.name, species.graphic.monsterResourceId!, stats,
        { exp: Math.round(level * (trainer ? level < 20 ? 6 : 4 : 5)), gold: trainer ? level * 16 : 0 }, skills, { level, speciesId });
      enemy.actions = expeditionEnemyActions(skills, project.database.skills);
      project.database.enemies.push(enemy);
      return enemyId;
    });
    const troopId = `mx_troop_${key}`;
    project.database.troops.push({ ...demoTroop(troopId, name, "", enemyIds.map((enemyId, i) => ({ enemyId, x: 84 + i * 20, y: 82 })), { uncapturable: trainer, trainerBattle: trainer }),
      activeSlots: 1, battleFlow: "strict", autoAlign: true, previewBackgroundResourceId: undefined });
    return troopId;
  }

  function minimumLevel(speciesId: string): number {
    const parents = (project.database.monsterSpecies ?? []).flatMap(s => (s.evolutions ?? []).filter(e => e.toSpeciesId === speciesId).map(e => ({ species: s.id, level: e.requires.level ?? 1 })));
    return parents.length ? Math.max(...parents.map(p => Math.max(minimumLevel(p.species), p.level))) : 1;
  }

  // 스타터 계통은 초반 풀숲·트레이너에 나오지 않는다 — 1번길에서 풀 스타터가 같은 풀 스타터를 만나 반감 기술로 서로 2씩 깎다 졌다(2026-10-06).
  const starterFamilies = new Set(EXPEDITION_SPECIES.filter(s => (EXPEDITION_STARTERS as readonly string[]).includes(s.id)).map(s => s.family));

  function pickSpecies(habitat: string, level: number, type?: string, count = 3): string[] {
    // 초반 트레이너·관장도 스타터 계통을 내보내지 않는다(1번길 트레이너가 새싹토로 거울전을 걸었다, 2026-10-06 실플레이).
    const early = (s: (typeof EXPEDITION_SPECIES)[number]) => level >= 20 || !starterFamilies.has(s.family);
    let pool = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && (!type || s.types.includes(type)) && (!habitat || s.habitat === habitat) && early(s));
    // 그 타입이 스타터 계통뿐이면(1관 풀 타입 Lv9) 스타터 계통을 쓴다 — 이르게 진화한 2단계(콩등충)는 Lv14 스타터도 못 이겼다(2026-10-06 실플레이).
    if (!pool.length) pool = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && (!type || s.types.includes(type)) && (!habitat || s.habitat === habitat));
    if (!pool.length) pool = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && (!type || s.types.includes(type)));
    if (!pool.length) throw Error(`No roster habitat/type ${habitat}/${type}`);
    const representatives = [...pool].sort((a, b) => b.stage - a.stage).filter((s, i, all) => all.findIndex(other => other.family === s.family) === i);
    // 계통이 모자라면 같은 계통의 앞 단계로 채운다 — 7관과 사천왕이 같은 장막인형만 셋·넷 내보냈다(2026-10-06 시각 QA).
    const roster = [...representatives, ...[...pool].sort((a, b) => b.stage - a.stage).filter(s => !representatives.includes(s))];
    // 그 타입으로 모자라면 같은 종을 되풀이하지 않고 다른 계통의 이른 종으로 채운다 — 1관 풀 타입 Lv9 이 새싹토 둘뿐이라 스타터와 같은 종 거울전이 되었다(3차 적대 감사 D35).
    // 타입 요건은 첫 칸이 지키고(관장의 간판), 뒤 칸은 스타터 계통을 뺀 이른 종 중 서로 다른 계통을 단계 높은 순으로 쓴다.
    if (roster.length < count) {
      const taken = new Set(roster.map(s => s.family));
      const fill = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && !starterFamilies.has(s.family) && !roster.includes(s))
        .sort((a, b) => Number(!!habitat && b.habitat === habitat) - Number(!!habitat && a.habitat === habitat) || b.stage - a.stage);
      for (const s of fill) { if (roster.length >= count) break; if (!taken.has(s.family)) { roster.push(s); taken.add(s.family); } }
    }
    return Array.from({ length: count }, (_, i) => roster[i % roster.length]!.id);
  }

  /** 관장은 타입 간판 종(pickSpecies 의 첫 칸)을 마지막에 내보낸다 — 첫 칸이 스타터와 같은 종 거울이 되지 않고, 간판이 가장 높은 레벨로 끝에 선다(D35). */
  const aceLast = (ids: string[]): string[] => ids.length > 1 ? [...ids.slice(1), ids[0]!] : ids;

  const neighbourHabitat: Record<string, string> = { grass: "forest", coast: "swamp" };

  function wild(map: GameMap, habitat: string, level: number, accent?: string): string[] {
    const fits = (s: (typeof EXPEDITION_SPECIES)[number]) => s.stage > 0 && minimumLevel(s.id) <= level - 2 && (level >= 20 || !starterFamilies.has(s.family));
    let pool = EXPEDITION_SPECIES.filter(s => s.habitat === habitat && fits(s)).map(s => s.id);
    // 스타터를 빼고 한 종만 남으면 이웃 서식지의 첫 단계 종을 빌려 온다(풀숲에 벌레가 섞이듯).
    if (pool.length < 2 && neighbourHabitat[habitat]) pool = [...pool, ...EXPEDITION_SPECIES.filter(s => s.habitat === neighbourHabitat[habitat] && s.stage === 1 && fits(s)).map(s => s.id)];
    // 시작 테마의 첫 길: 그 땅의 첫 단계 종을 둘째 자리(Lv2)에 — 사막 1번길 풀숲에서 바람삐·심지충만 나왔다(2026-10-07 사용자 지적).
    if (accent) {
      // 화산 서식지 종은 전부 스타터 계통(숯비늘)이라 초반에는 비어 있다 — 불 타입 첫 단계 종(심지충)이 그 자리를 맡는다.
      const native = EXPEDITION_SPECIES.filter(s => (s.habitat === accent || (accent === "volcano" && s.types.includes("fire"))) && s.stage === 1 && fits(s) && !pool.includes(s.id)).map(s => s.id);
      if (native.length) pool = [pool[0]!, ...native, ...pool.slice(1)].filter(Boolean);
    }
    map.encounterRate = 14;
    // Named habitats prevent encounters on the transport/entry row and indoor surfaces.
    map.locations = [{ id: `${map.id}_habitat`, name: "몬스터 서식지", x: 1, y: 3, w: map.width - 2, h: map.height - 6 }];
    // 첫 길은 Lv5 스타터 한 마리로 걸어 나가는 곳이라 야생을 두세 레벨 아래로 둔다.
    // 첫 종만 Lv3, 나머지는 Lv2 — Lv3 벌레는 벌레 기술을 배워 풀 스타터를 두 배로 때린다.
    const wildLevel = (i: number) => level <= 6 ? Math.max(2, level - (i === 0 ? 1 : 2)) : Math.max(3, level - i % 3);
    // 레벨은 항목마다 [기준, 기준+1] 범위로 굴린다(조우표 levelMin/levelMax) — 같은 풀에서 레벨이 조금씩 달라진다. 트룹 적 level 은 범위가 없을 때의 값.
    map.encounterTable = pool.map((speciesId, i) => ({ troopId: troop(`야생의 ${speciesById.get(speciesId)!.name}`, `${map.id}_wild_${i}`, [speciesId], wildLevel(i), false),
      levelMin: wildLevel(i), levelMax: wildLevel(i) + 1, weight: i < 3 ? 5 : 2, conditions: { locationId: `${map.id}_habitat`, switchId: "mx_starter" } }));
    return pool;
  }

  /** 시야선 트레이너가 바라볼 방향과 시선 칸 수 — 곧은 통로가 가장 긴 쪽(3~4칸), 문·시작점 곁은 시선에 들지 않게 자른다(들어서자마자 걸리지 않도록). */
  function sightFacing(map: GameMap, at: Point): { dir: "up" | "right" | "down" | "left"; range: number } {
    const doors = [...map.events.filter(e => e.id.includes("_to_")).map(e => ({ x: e.x, y: e.y })), entries.get(map.id)!];
    const near = (p: Point) => doors.some(d => Math.max(Math.abs(d.x - p.x), Math.abs(d.y - p.y)) <= 1);
    const order = [["down", 0, 1], ["left", -1, 0], ["right", 1, 0], ["up", 0, -1]] as const;
    let best: { dir: "up" | "right" | "down" | "left"; range: number } = { dir: "down", range: 0 };
    for (const [dir, dx, dy] of order) {
      let run = 0, cur = at;
      for (; run < SIGHT_RANGE; run++) {
        const next = { x: cur.x + dx, y: cur.y + dy };
        if (!canMove(project, map, cur.x, cur.y, next.x, next.y) || near(next) || map.events.some(e => e.x === next.x && e.y === next.y && e.pages?.[0]?.overlapForbidden)) break;
        cur = next;
      }
      if (run > best.range) best = { dir, range: run };
    }
    return best;
  }

  function battle(map: GameMap, suffix: string, name: string, at: Point, ids: string[], level: number, winSwitch: string | undefined, before: string, win: Command[], wantedRequired?: string, track: string = audio.trainerBattle, sight = false, aceBonus = 0): GameEvent {
    const required = gate(wantedRequired);
    const tid = troop(name, `${map.id}_${suffix}`, ids, level, true, aceBonus);
    // 전투 소개 그림 — 번들 트레이너 그림을 적 그룹에 배정해 슬라이드 인트로가 뜨게 한다(없으면 소개 없이 시작).
    const front = expeditionTrainerFront(suffix, name, trainerArtByMap.get(map.id));
    if (front) project.database.troops.find(entry => entry.id === tid)!.trainerSprite = { front, back: EXPEDITION_HERO_BACK };
    const intro = [text(before, name), battleMusic(track)];
    const fight: Command = { kind: "battleProcessing", troopId: tid, canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [battleMusic(), ...(winSwitch ? [sw(winSwitch)] : []), ...win, music(map.bgm!.resourceId!)],
      // 지면 야생 조우와 같은 블랙아웃(system.gameOver: 마지막 회복 센터로 귀환 + 소지금 절반) — 옛 분기는 가까운 센터로 옮기기만 하고 돈을 잃지 않았다.
      defeatBranch: [battleMusic(), text("눈앞이 캄캄해졌다…"), { kind: "gameOver" }],
      escapeBranch: [battleMusic(), text("다시 준비해서 돌아오자.")] };
    let commands: Command[] = [...intro, fight];
    if (required) commands = [{ kind: "fork", condition: condition(required), then: commands, else: [text("먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", name)] }];
    if (winSwitch) commands = [{ kind: "fork", condition: condition(winSwitch), then: [text("다시 만나 반가워. 동료들과 모험은 잘 되어 가니?", name),
      { kind: "choices", prompt: "재대결할까?", options: [{ text: "다시 겨룬다", branch: [...intro, { ...fight, victoryBranch: [battleMusic(), text("멋진 재대결이었다!", name), music(map.bgm!.resourceId!)] }] }, { text: "다음에", branch: [] }], cancelBehavior: "branch", cancelBranch: [] }], else: commands }];
    const graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
    // 시야선 트레이너(3세대 문법): 시선 방향 직선에 들면 「!」 → 걸어와서 말을 걸고 전투 → 이긴 뒤에는 다시 걸어오지 않고 말을 걸어야만 재대결.
    // 첫 페이지(승리 전)가 시야선, 둘째 페이지(승리 스위치)가 재대결 대사다 — 지거나 도망쳐도 승리 스위치가 없어 다시 시야에 들면 또 걸어온다.
    if (sight && winSwitch && !required) {
      const facing = sightFacing(map, at);
      if (facing.range >= 2) {
        const faced = { ...graphic, direction: facing.dir, pattern: charsetFrameIndex({ characterIndex: 6, direction: facing.dir, pattern: 1 }) };
        const common = { movement: fixed, priority: "same", overlapForbidden: true, trigger: { kind: "action" } } as const;
        const first: EventPage = { id: `${map.id}_${suffix}_page`, name: "시야선 트레이너", conditions: [], graphic: faced, ...common, commands: [...intro, fight],
          detectionEncounter: { sight: { range: facing.range, lineOfSight: true, facing: "forward" }, emote: "exclamation", emoteMs: 600, approachSpeed: 4 } };
        const rematch = commands[0] as Extract<Command, { kind: "fork" }>;
        const second: EventPage = { id: `${map.id}_${suffix}_rematch`, name: "재대결", conditions: [condition(winSwitch)], graphic: faced, ...common, commands: rematch.then };
        const ev = event(map, suffix, at, [], { graphic: faced, pages: [first, second] });
        manifest.battles.push({ mapId: map.id, eventId: ev.id, troopId: tid, level, victorySwitch: winSwitch });
        return ev;
      }
    }
    const e = event(map, suffix, at, commands, { graphic });
    manifest.battles.push({ mapId: map.id, eventId: e.id, troopId: tid, level, ...(winSwitch ? { victorySwitch: winSwitch } : {}) });
    return e;
  }

  const townMaps = new Map(towns.map(t => [t.key, make(t.key, lookTown(t).name, t.key === "home" && options.startTheme ? START_TOWNS[options.startTheme].template : volcano && (VOLCANO_TOWN_KEYS as readonly string[]).includes(t.key) ? "climate/ash_town" : lookTown(t).template, lookTown(t).music, "town")]));
  // 관장 타입을 기획서가 바꾸면(사막 기획서 1관 = 땅) 체육관 판도 그 타입의 판으로 — 「땅 관장」이 꽃밭 정원 체육관에 서 있었다(2026-10-07 사용자 지적).
  // 1관 타입을 기획서가 다른 관의 본래 타입으로 바꾸면(눈 기획서 1관 = 얼음) 그 관은 1관의 본래 타입을 받는다 — 얼음 관장이 둘 나왔다(2026-10-07 눈 시험).
  const displaced = options.firstGymType && options.firstGymType !== gyms[0]!.type
    ? gyms.findIndex((g, i) => i > 0 && g.type === options.firstGymType && options.gymTypes?.[i] === undefined) : -1;
  const gymType = (i: number, g: { readonly type: string }): string => options.gymTypes?.[i] ?? (i === 0 ? options.firstGymType : undefined) ?? (i === displaced ? gyms[0]!.type : g.type);
  const gymKeys = gyms.map((g, i) => GYM_KEY_BY_TYPE[gymType(i, g)] ?? g.key);
  // 이름·배지·대사도 판과 마을을 따른다 — 서리꽃 마을(판을 바꾼 둘째 마을) 얼음 체육관이 「새순 체육관」·「새잎 배지」였다.
  const gymPersonas = gyms.map((g, i) => {
    const type = gymType(i, g);
    const town = lookTown(allTowns.find(t => t.key === g.town)!).name;
    const moved = lookOf(g.town) !== g.town || gymKeys[i] !== g.key;
    const name = moved ? `${town.replace(/ (마을|시티|항구|온천)$/u, "")} ${gymKeys[i] === "dojo" ? "도장" : "체육관"}` : g.name;
    // 타입을 맞바꾼 두 관은 관장도 맞바꾼다 — 서리꽃 1관 얼음 관장은 설아, 새순으로 간 풀 관장은 유림.
    const source = i === 0 && displaced >= 0 ? gyms[displaced]! : i === displaced ? gyms[0]! : g;
    const badge = type === source.type ? source.badge : TYPE_BADGE[type] ?? g.badge;
    const after = type === g.type ? g.after : `${source.after.split(/(?<=[.!?])\s/u)[0]} 이 ${badge}를 맡길게.`;
    return { ...g, name, badge, after, leader: source.leader, before: source.before, level: levels.gym(i + 1) };
  }).slice(0, gymCount);
  const gymMaps = new Map(gymPersonas.map((g, i) => [g.town, make(`${g.town}_gym`, g.name, `gyms/gym_${gymKeys[i]}`, "gym", "interior")]));
  // 체육관 관장·리그 방별 전투 그림(trainerArt.ts) — battle() 이 맵 id 로 찾는다.
  for (const [i, g] of gymPersonas.entries()) trainerArtByMap.set(gymMaps.get(g.town)!.id, gymLeaderArt(gymKeys[i]!));
  const lab = make("lab", "천문박사의 연구소", "rooms/lab", "town", "interior");
  const museum = shape.museum ? make("museum", "별의 역사 박물관", "rooms/museum", "town", "interior") : undefined;
  const school = make("school", "조련사 학교", "rooms/school", "town", "interior");
  const hideout = shape.hideout ? make("hideout", "밤막회사 · 별빛 연구소", "dungeon/hideout", "cave", "dungeon") : undefined;
  const observatory = make("observatory", "옛 별 관측탑", "dungeon/ruins", "league", "dungeon");
  trainerArtByMap.set(observatory.id, "scientist");
  // 리그 방: 7·8관 사천왕 넷+챔피언, 4~6관 사천왕 둘+챔피언, 1~3관 챔피언만, 0관 없음(관측탑 보스가 엔딩).
  const LEAGUE_ROOMS = [{ key: "ice", type: "ice", name: "사천왕 · 서리" }, { key: "ghost", type: "ghost", name: "사천왕 · 등불" }, { key: "dark", type: "fighting", name: "사천왕 · 기백" },
    { key: "dragon", type: "dragon", name: "사천왕 · 용빛" }, { key: "champ", type: undefined, name: "챔피언 · 나루" }] as const;
  const leagueRooms = (shape.leagueRooms >= 5 ? [0, 1, 2, 3, 4] : shape.leagueRooms >= 3 ? [1, 3, 4] : shape.leagueRooms >= 1 ? [4] : []).map(i => LEAGUE_ROOMS[i]!);
  const league = leagueRooms.map((room, i) => make(`league_${i}`, room.key !== "champ" ? `별빛 리그 · 사천왕 ${i + 1}` : "별빛 리그 · 챔피언", `rooms/league_${room.key}`, "league", "interior"));
  for (const [i, room] of leagueRooms.entries()) trainerArtByMap.set(league[i]!.id, room.key === "champ" ? "hero_f_front" : typeArt(room.type));

  for (const [i, t] of towns.entries()) {
    const map = townMaps.get(t.key)!;
    const center = make(`${t.key}_center`, `${lookTown(t).name} · 회복 센터`, "overworld/room-center", "town", "interior");
    const mart = make(`${t.key}_mart`, `${lookTown(t).name} · 도구점`, "overworld/room-mart", "town", "interior");
    // 집은 마을마다 다른 방(부엌·거실·서재)이고 모두 2층이 있다 — 여덟 마을 집이 한 장 그림이었다(2026-10-07 사용자 「실내 많이 다듬어야」).
    // 시작 마을 짜임을 받았으면 주인공 집·내 방 판도 씨앗으로(2026-10-24 — 늘 같은 집 안이었다).
    const roomPick = i === 0 && options.startLayout ? Math.abs(options.startLayout.seed ?? 0) : i;
    const home = make(`${t.key}_house`, `${lookTown(t).name} · 주민의 집`, ["overworld/room-house", "overworld/room-house-b", "overworld/room-house-c"][roomPick % 3]!, "town", "interior");
    const upstairs = make(`${t.key}_house_2f`, i === 0 ? "내 방" : `${lookTown(t).name} · 주민의 집 2층`, (i === 0 && options.startLayout ? (roomPick >> 2) % 2 : i % 2) ? "overworld/room-house-2f-b" : "overworld/room-house-2f", "town", "interior");
    const lounge = make(`${t.key}_center_2f`, `${lookTown(t).name} · 회복 센터 2층`, "overworld/room-center-2f", "town", "interior");
    attachStairs(home, upstairs); attachStairs(center, lounge);
    const doors = doorways(map);
    const centerDoor = doors.find(d => /center|centre/.test(d.name));
    const martDoor = doors.find(d => /mart|shop/.test(d.name));
    const others = doors.filter(d => d !== centerDoor && d !== martDoor);
    // 체육관 건물 킷이 있으면 그 문이 체육관이다 — 없으면(옛 판) 두 번째 집.
    const gymDoor = others.find(d => /^gym_/.test(d.name)) ?? (i === 0 && options.startLayout ? others.find(d => /^gable_/.test(d.name)) : undefined) ?? others[1];
    const residential = [others.find(d => d !== gymDoor), gymDoor].filter((d): d is NonNullable<typeof d> => d !== undefined);
    if (!centerDoor || !martDoor || residential.length < 2) throw Error(`Current references lack four public building entrances in ${map.id}: ${JSON.stringify(doors)}`);
    attachRoom(map, center, centerDoor); attachRoom(map, mart, martDoor);
    attachRoom(map, home, residential[0]!);
    // 0관 캠페인의 마을에는 체육관이 없다 — 체육관 건물 문은 조련사 회관(작은 모임방)으로 잇는다.
    // 체육관이 없는 마을의 둘째 건물은 평범한 큰 집이다 — 교실 판을 「조련사 회관」으로 재사용하던 것을 몬스터 키트의 집 방(3종 중 다른 변주)으로.
    const gymRoom = i === 0 ? lab : gymMaps.get(t.key as Exclude<typeof t.key, "home">)
      ?? make(`${t.key}_annex`, `${lookTown(t).name} · 이웃집`, ["overworld/room-house", "overworld/room-house-b", "overworld/room-house-c"][(i + 1) % 3]!, "town", "interior");
    attachRoom(map, gymRoom, residential[1]!);
    if (i > 0 && !gymMaps.has(t.key as never)) {
      // 집 방 그림에는 계단이 있다 — 2층을 이어 주지 않으면 막다른 계단이 된다.
      const annexUp = make(`${t.key}_annex_2f`, `${lookTown(t).name} · 이웃집 2층`, i % 2 ? "overworld/room-house-2f" : "overworld/room-house-2f-b", "town", "interior");
      attachStairs(gymRoom, annexUp);
      npc(gymRoom, "host", "이웃 주민", "체육관이 없는 섬이라 다들 도감을 채우며 지내요. 동료들이 지쳤다면 여기서 쉬었다 가요.", { x: 6, y: 5 }, [{ kind: "recoverAll" }], 5);
      npc(annexUp, "kid", "아이", "우리 동네엔 체육관이 없어도 도감 모으는 사람이 많아. 나도 도감 반은 채웠어!", { x: 6, y: 6 }, [], 1);
    }
    npc(center, "nurse", "센터 직원", "몬스터 센터에 어서 오세요! 동료들을 건강하게 해 드릴까요?", { x: center.width >> 1, y: 5 },
      monsterCenterCommands({ greeting: null, checkpointLabel: `${lookTown(t).name} 회복 센터`, audio: { me: audio.victory }, machineCells: [5, 6, 7, 8, 9, 10].map(x => ({ x: x + ((center.width >> 1) - 7), y: 3 })) }), 3);
    npc(mart, "shop", "도구점 주인", "포획구슬과 회복 도구를 챙겨 가세요. 약은 메뉴에서 몬스터를 골라 사용할 수 있어요.", { x: mart.width >> 1, y: 5 },
      [{ kind: "shop", itemIds: ["item_capture_orb", ...EXPEDITION_BALL_IDS, "item_potion", "item_hi_potion", "item_ether", "item_antidote", "item_wake_herb", "mx_revive", ...EXPEDITION_FIELD_ITEM_IDS, ...EXPEDITION_STONE_IDS, ...EXPEDITION_HELD_ITEM_IDS], allowSell: true, quantityMode: "select", shopUiPreset: "pixel" }], 1);
    npc(home, "resident", i === 0 ? "엄마" : "마을 주민", i === 0 ? "모험에서 가장 중요한 건 무사히 돌아오는 일이야. 언제든 쉬어 가렴." : lookTown(t).flavor, { x: 6, y: 5 },
      [{ kind: "recoverAll" }, { kind: "fork", condition: { kind: "item", itemId: "item_capture_orb", present: false }, then: [gain("item_capture_orb", 3), text("구슬을 다 썼구나. 다시 시작할 수 있게 세 개를 챙겨 줄게.")] }], 2);
    if (i === 0) event(upstairs, "console", { x: 8, y: 3 }, [text("게임기다. 모험에서 돌아오면 또 하자.")], { graphic: invisible });
    else npc(upstairs, "kid", "아이", ["우와, 진짜 몬스터다! 나도 크면 조련사가 될 거야.", "2층 창문으로 보면 길 건너 풀숲이 다 보여.", "밤에는 풀숲에서 다른 몬스터가 나온대. 진짜일까?"][i % 3]!, { x: 6, y: 6 }, [], 1);
    npc(lounge, "traveler", "라운지 손님", ["상대 타입에 강한 기술을 고르면 두 배로 들어가요. 불은 풀에, 물은 불에, 풀은 물에.", "체력이 노란색이 되면 포획구슬이 잘 듣는대요.", "기술 횟수가 떨어지면 1층 직원에게 맡기세요. 모두 채워 줘요."][i % 3]!, { x: 7, y: 6 }, [], 3);
    npc(map, "guide", "여행 안내원", `${lookTown(t).name}에 온 걸 환영해요. ${i === 0 ? `${i === 0 && options.startLayout ? compass(map, residential[1]!) : "북동쪽"} 집이 천문박사의 연구소예요.` : "북동쪽 건물에서 지역의 관장에게 도전할 수 있어요."} 북쪽의 안내원이 다음 길을 알려 줍니다.`, mid(map), [], 4);
    npc(map, "local", "마을 주민", lookTown(t).flavor, { x: 3, y: 10 }, [], i % 8);
    // Return travel is earned by reaching a town, with no permanent progress rollback.
    event(map, "visit", entries.get(map.id)!, [sw(`mx_visit_${t.key}`)], { trigger: "auto", below: true,
      pages: [{ id: `${map.id}_visit_done`, name: "방문 기록", conditions: [{ kind: "switch", switchId: `mx_visit_${t.key}`, value: false }], graphic: invisible, movement: fixed, priority: "below", trigger: { kind: "auto" }, commands: [sw(`mx_visit_${t.key}`)] }] });
  }

  for (const r of routes) {
    const ashRoute = volcanoRoute(r.key) > 0;
    const map = make(r.key, r.name, ashRoute ? "climate/ash_town" : r.key === "meadow" && options.startTheme ? START_ROUTES[options.startTheme]?.template ?? r.template : r.template, r.music, "field");
    const wildPool = wild(map, r.habitat, r.level, ashRoute || (r.key === "meadow" && options.startTheme) ? START_HABITAT[options.startTheme!] : undefined);
    connect(townMaps.get(r.from)!, map, r.required);
    connect(map, townMaps.get(r.to)!);
    for (let i = 0; i < 3; i++) {
      const at = standSpot(map, { x: 3 + i * 7, y: 6 + i * 8 }, true)!;
      // 첫 길의 트레이너는 그 길 풀숲의 종을 한두 레벨 아래로 — 스타터 한 마리로 넘을 수 있어야 한다(Lv4~6 바람삐가 풀 스타터를 이겼다).
      const first = r.level <= 6;
      const team = first ? Array.from({ length: i === 2 ? 2 : 1 }, (_, k) => wildPool[(i + k) % wildPool.length]!) : pickSpecies(r.habitat, r.level + 1, undefined, i === 2 ? 2 : 1);
      battle(map, `trainer_${i}`, ["산책하는 소년", "연구원", "길을 걷는 조련사"][i]!, at, team, first ? Math.max(2, r.level - 1 + (i >> 1)) : r.level + i,
        `${map.id}_trainer_${i}_won`, ["우리 동료들이 자라는 모습을 봐 줘!", "타입 상성만큼 기술 횟수도 중요하지.", "먼 길을 걸었으니 서로 실력을 확인하자."][i]!, [gain("item_potion", 1), text("여행에 쓰라고 회복약 하나를 건네받았다.")], undefined, undefined, true);
    }
    npc(map, "trail_sign", "지역 안내", `${r.name}. 야생 몬스터는 포획할 수 있지만 조련사의 몬스터는 포획할 수 없습니다. 길을 걷기 전에 체력과 기술 PP를 확인하세요.`, { x: 3, y: map.height - 4 }, [], 4);
  }

  for (const s of sides) {
    const map = make(s.key, s.name, s.template, s.music, "dungeon");
    wild(map, s.habitat, s.level);
    connect(townMaps.get(s.town)!, map, "mx_starter");
    // 템플릿이 그려 둔 집(산호 해변 오두막)에 문 이벤트가 없어 문 앞에서 아무 일도 없었다(2026-10-06 검수 「해변 오두막 문 없음」).
    // 방 하나를 더 만들지 않고 문에서 주인이 맞아 쉬게 해 준다 — 야생이 사는 곁길 한가운데의 쉼터.
    if (sources.get(map.id)!.buildings.length) for (const [k, d] of doorways(map).entries()) {
      event(map, `hut_door_${k}`, d, [text("「바닷가 쉼터」 문을 두드리자 주인이 문을 열었다."), text("파도 소리 들으며 잠깐 쉬어 가렴. 동료들도 지쳤겠구나.", "쉼터 주인"),
        { kind: "recoverAll" }, text("동료들의 체력과 기술 횟수가 모두 회복되었다!")]);
      reserve(map, { x: d.x, y: d.y + 1 });
    }
    npc(map, "researcher", "서식지 연구원", `${s.name}에는 길에서 만나기 힘든 몬스터가 살아요. 도감에 빈칸이 있다면 천천히 탐색해 보세요.`, s.key === "beach" ? { x: 14, y: 32 } : { x: 2, y: map.height - 4 }, [], 5);
    const at = nearest(map, { x: map.width - 4, y: 5 }, connected(map), true);
    const flag = `${map.id}_treasure`;
    event(map, "treasure", at, [{ kind: "fork", condition: condition(flag), then: [text("빈 보관함이다.")], else: [gain("item_capture_orb", 3), gain("item_hi_potion", 1), gain("mx_candy", 1), sw(flag), text("포획구슬 세 개와 고급 회복약, 이상한 사탕 하나를 찾았다!")] }], { below: true, graphic: marker("chest") });
  }

  connect(townMaps.get("home")!, school);
  if (museum) connect(townMaps.get("prism")!, museum, "mx_badge_3");
  if (hideout) connect(townMaps.get("prism")!, hideout, "mx_badge_4");
  const finalTownMap = townMaps.get(finalKey)!;
  connect(finalTownMap, observatory, "mx_badge_8");
  if (league[0]) connect(finalTownMap, league[0], "mx_story_beacon");

  const starterCommands: Command[] = starterChoiceCommands(project, {
    speciesIds: EXPEDITION_STARTERS, notes: Object.fromEntries(EXPEDITION_SPECIES.map(s => [s.id, s.description])), speaker: "천문박사",
    afterGive: (sid) => [sw("mx_starter"), sw(`mx_starter_${sid}`), gain("item_capture_orb", 10), gain("item_potion", 5), gain("mx_revive", 1), gain("mx_candy", 1),
      text("첫 동료와 만났다! 야생 전투에서는 「가방」의 포획구슬을 사용해 보렴.", "천문박사"), text("여덟 지역의 약속을 모아, 빛을 잃어 가는 별의 등대를 다시 밝혀 주었으면 한단다.", "천문박사")],
  });
  npc(lab, "professor", "천문박사", "몬스터들은 오래전부터 별빛섬의 여덟 등불을 지켜 왔단다. 밤막회사가 빛을 가져가면서 섬의 균형이 무너지고 있어.", { x: 7, y: 5 },
    [{ kind: "fork", condition: condition("mx_starter"), then: [text("메뉴의 「도감」에서 만난 동료를, 「배지」에서 현재 목표를 볼 수 있단다. 여덟 관장의 약속을 모아 보렴.", "천문박사")], else: starterCommands }], 5);
  npc(school, "teacher", "선생님", "싸운다 → 기술 선택 → 상대 선택. 몬스터가 쓰러지면 교체해야 해요. 포획은 상대 체력을 낮춘 뒤 시도해 보세요. 메뉴의 몬스터 화면에서는 보관함 이동과 새 기술 교체도 할 수 있어요.", { x: 7, y: 5 }, [{ kind: "fork", condition: condition("mx_school_gift"), then: [], else: [gain("item_potion", 1), sw("mx_school_gift")] }], 5);
  if (museum) npc(museum, "curator", "학예사", "별빛은 섬의 생명을 빼앗아 만드는 에너지가 아니에요. 여덟 지역이 서로 돌볼 때 생겨나는 빛이지요. 밤막회사는 그 뜻을 잊었습니다.", { x: 9, y: 5 }, [], 5);

  const rivals: ReadonlyArray<readonly [string, number, number, string]> = [
    ["lab", 5, 1, "mx_starter"],
    ...(towns.some(t => t.key === "prism") && finalKey !== "prism" ? [["prism", levels.gym(4), 3, "mx_badge_3"] as const] : []),
    [finalKey, levels.endgame(46), 4, "mx_badge_7"],
  ];
  for (const [key, level, count, required] of rivals) {
    const map = project.maps[id(key)]!;
    battle(map, "rival", "나루", nearest(map, { x: map.width - 5, y: map.height - 5 }, connected(map), true), pickSpecies("", level, undefined, count), level,
      `mx_rival_${key}`, key === "lab" ? "우리도 같은 날 출발하는구나! 첫 동료와 짧게 겨뤄 볼래?" : "다른 길을 걸었어도 같은 별을 보고 있었네. 지금의 우리를 확인하자!",
      [text("리그에서 다시 만나자. 서로 끝까지 동료들을 지키는 거야.", "나루"), gain("item_capture_orb", 3)], required);
  }

  // All gym devices mutate real map tiles. Their switch journals survive save/load.
  for (const [i, g] of gymPersonas.entries()) {
    const map = gymMaps.get(g.town)!;
    const base = sources.get(map.id)!;
    const key = gymKeys[i]!;
    const done = templates[`gyms/gym_${key}_after`];
    const puzzleSwitch = `mx_gym_${i + 1}_puzzle`;
    const changes: Command[] = [];
    if (!["psychic", "ice"].includes(key) && !done) throw Error(`Missing authored device state ${key}`);
    if (done) for (let cell = 0; cell < map.width * map.height; cell++) for (const layer of ["lower", "upper"] as const) {
      if (base[layer][cell] !== done[layer][cell]) changes.push({ kind: "changeTile", mapId: map.id, layer, x: cell % map.width, y: Math.floor(cell / map.width), tile: done[layer][cell]! });
    }
    if (key === "psychic") {
      for (const digit of "12345678") {
        const pair = base.marks![digit]!;
        for (const [j, cell] of pair.entries()) {
          const target = pair[1 - j]!;
          event(map, `warp_${digit}_${j}`, { x: cell[0]!, y: cell[1]! }, [sw(puzzleSwitch), { kind: "transfer", mapId: map.id, x: target[0]!, y: target[1]!, fade: "black" }], { trigger: "playerTouch", below: true });
        }
      }
    } else if (key === "ice") {
      for (const [j, cell] of (base.marks?.x ?? []).entries()) event(map, `crack_${j}`, { x: cell[0]!, y: cell[1]! },
        [text("얼음이 갈라졌다! 입구에서 다시 발판을 살펴보자."), transfer(map, entries.get(map.id)!)], { trigger: "playerTouch", below: true });
      // The engine's authored slideTiles implements the ice travel itself.
    } else {
      if (!changes.length) throw Error(`Empty authored device state ${key}`);
      type Device = { key: string; at: Point; title: string; question: string; yes: string; no: string; changes: Command[] };
      const at = (x: number, y: number) => ({ x, y });
      const split = (predicate: (c: Command) => boolean) => changes.filter(predicate);
      const devices: Device[] = key === "grass" ? [
        // Keep the operator south of the vine gate cells it opens.
        { key: "pivot", at: at(8,17), title: "새싹 돌 받침", question: "받침에 손을 얹어 길을 막은 덩굴 나무 문을 열까?", yes: "손을 얹는다", no: "그대로 둔다", changes: split(c => c.kind === "changeTile" && c.y > 10) },
        { key: "cut", at: at(12,6), title: "가시 덤불", question: "비치된 정원 가위로 길을 덮은 가시 덤불을 정리할까?", yes: "덤불을 정리한다", no: "나중에", changes: split(c => c.kind === "changeTile" && c.y <= 10) }
      ] : key === "fire" ? [
        { key: "quiz_1", at: at(7,15), title: "화로 퀴즈 1", question: "물 타입 기술은 불꽃 타입에게 효과적인가?", yes: "효과적이다", no: "효과가 없다", changes: split(c => c.kind === "changeTile" && c.x < 10) },
        { key: "quiz_2", at: at(9,9), title: "화로 퀴즈 2", question: "풀 타입 동료가 불꽃 기술을 맞으면 피해가 커지는가?", yes: "피해가 커진다", no: "피해가 줄어든다", changes: split(c => c.kind === "changeTile" && c.x >= 10) }
      ] : key === "dragon" ? [
        { key: "boulder_1", at: at(9,8), title: "둥근 바위", question: "북쪽 틈으로 바위를 밀어 발판을 만들까?", yes: "북쪽으로 민다", no: "기다린다", changes: split(c => c.kind === "changeTile" && c.x < 11) },
        { key: "boulder_2", at: at(13,9), title: "두 번째 바위", question: "서쪽 틈으로 바위를 밀어 발판을 만들까?", yes: "서쪽으로 민다", no: "기다린다", changes: split(c => c.kind === "changeTile" && c.x >= 11) }
      ] : [{ key: "main", at: key === "water" ? at(1,10) : key === "ghost" ? at(1,2) : at(6,15),
        title: key === "water" ? "수로 밸브" : key === "ghost" ? "기억의 문양" : "격파 수련판",
        question: key === "water" ? "밸브를 열어 징검돌을 띄울까?" : key === "ghost" ? "문양에 등불을 놓아 숨은 다리를 밝힐까?" : "동료와 함께 수련판을 격파할까?",
        yes: "장치를 작동한다", no: "나중에", changes }];
      for (const d of devices) {
        const flag = `${puzzleSwitch}_${d.key}`;
        const finish: Command[] = devices.length === 1 ? [sw(puzzleSwitch)] : [{ kind: "fork", condition: { kind: "all", conditions: devices.map(part => condition(`${puzzleSwitch}_${part.key}`)) }, then: [sw(puzzleSwitch)] }];
        const e = event(map, `device_${d.key}`, d.at, [text(d.question, d.title), { kind: "fork", condition: condition(flag),
          then: [text("장치는 이미 작동했다.")], else: [{ kind: "choices", options: [
            { text: d.yes, branch: [...d.changes, sw(flag), ...finish, text("길의 모습이 바뀌었다!")] }, { text: d.no, branch: [text("다른 길과 안내를 살펴보자.")] }
          ], cancelBehavior: "branch", cancelBranch: [] }] }], { below: true });
        manifest.devices.push({ mapId: map.id, eventId: e.id, switchId: flag, cells: d.changes.length });
      }
    }
    if (key === "fire") {
      // Lower vent mouths are falls; the upper steam plume is only artwork.
      for (const [j, cell] of (base.marks?.v ?? []).entries()) event(map, `vent_${j}`, { x: cell[0]!, y: cell[1]! },
        [text("증기 구멍으로 미끄러졌다! 입구에서 안전한 발판을 찾아보자."), transfer(map, entries.get(map.id)!)], { trigger: "playerTouch", below: true });
    }
    const leader = { x: base.leader![0]!, y: base.leader![1]! };
    if (key === "ice") event(map, "ice_reached", { x: leader.x, y: leader.y + 1 }, [sw(puzzleSwitch)], { trigger: "playerTouch", below: true });
    battle(map, "leader", g.leader, leader, aceLast(pickSpecies("", g.level, gymType(i, g), i < 3 ? 2 : 3)), g.level, `mx_badge_${i + 1}`, g.before,
      // 관장 대사 → 배지 획득 연출(섬광·징글·떠오르는 배지, project/monsterBadgeCeremony.ts) → 보상. 배지 스위치는 승리 스위치가 이미 켠 뒤다.
      [text(g.after, g.leader), ...badgeAwardCommands({ badgeName: g.badge, badgeIndex: i + 1, badgeTotal: gymCount, type: gymType(i, g), fanfareResourceId: audio.victory }),
        { kind: "changeGold", op: "+=", amount: (i + 1) * 600 }, gain("item_hi_potion", 2), gain("mx_revive", 1), text("부활의 깃털도 건네받았다. 다음 길이 열렸다.")], puzzleSwitch, audio.trainerBattle, false, 2);
    // 체육관 졸개 트레이너(3세대 문법: 퍼즐 → 졸개들 → 관장). 입구에서 관장까지의 선을 따라 3~4명을 세우고 모두 시야선으로 걸어온다.
    // 관장 이벤트를 놓기 전에는 졸개를 놓지 않는다 — 관장 칸은 이미 예약되어 있어야 졸개가 그 자리를 피한다.
    const gruntCount = i < 3 ? 3 : 4;
    const entry = entries.get(map.id)!;
    const placed: Point[] = [];
    // 장치를 모두 푼 뒤의 지도 — 졸개가 풀린 길(1칸 통로)을 막으면 관장에게 못 간다(8관 검사: 달등 체육관 통로 한가운데에 졸개가 섰다).
    // 풀기 전 지도에서 길을 끊지 않는 것만으로는 모자라, 풀린 지도에서도 관장 곁까지 닿는 자리에만 세운다.
    const solved: GameMap = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
    for (const d of changes) if (d.kind === "changeTile") (d.layer === "upper" ? solved.upperTiles : solved.lowerTiles)[d.y * map.width + d.x] = d.tile;
    const leaderSides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => coord({ x: leader.x + dx!, y: leader.y + dy! }));
    const keepsRoute = (p: Point) => { const open = walkable(solved, p); return leaderSides.some(side => open.has(side)); };
    for (let k = 0; k < gruntCount; k++) {
      const t = (k + 1) / (gruntCount + 1);
      const wanted = { x: Math.round(entry.x + (leader.x - entry.x) * t), y: Math.round(entry.y + (leader.y - entry.y) * t) };
      const gruntLevel = Math.max(2, g.level - 3 + (k >> 1));
      const standing = standSpot(map, wanted, true, placed, true, keepsRoute);
      if (!standing) continue;
      placed.push(standing);
      battle(map, `grunt_${k}`, ["수련생", "견습 조련사", "체육관 단원", "문하생"][k % 4]!, standing, pickSpecies("", gruntLevel, gymType(i, g), k === gruntCount - 1 && gruntLevel >= 8 ? 2 : 1), gruntLevel,
        `${map.id}_grunt_${k}_won`, ["관장님께 가려면 먼저 나를 넘어야 해!", "여기 장치를 푼 실력, 내 동료들로 확인해 볼게.", "관장님의 제자로서 그냥 보낼 수는 없지!", "마지막으로 나와 겨뤄 보자. 지면 돌아가 다시 훈련이야."][k % 4]!,
        [gain("item_potion", 1), text("관장에게 가는 길이 한 걸음 가까워졌다.")], undefined, undefined, true);
    }
    const leaderEvent = map.events.find(e => e.id.endsWith("_leader"))!;
    const previous = i === 0 ? "mx_starter" : `mx_badge_${i}`;
    const body = leaderEvent.pages![0]!.commands;
    leaderEvent.pages![0]!.commands = [{ kind: "fork", condition: condition(previous), then: body, else: [text("먼저 앞 지역 관장의 약속을 받아 와 주세요.", g.leader)] }];
    npc(map, "gym_guide", "체육관 안내원", key === "psychic" ? "같은 무늬의 워프 판은 서로 이어집니다. 돌아온 방의 다른 판을 찾아보세요." : key === "ice" ? "얼음 위에서는 벽이나 바위에 닿을 때까지 미끄러집니다. 금 간 얼음은 피하세요." : key === "fire" ? "퀴즈 기계 둘을 풀면 셔터가 열립니다. 증기 구멍을 밟으면 입구로 돌아가니 벽돌 발판으로 돌아가세요." : "장치를 조작하면 관장에게 가는 길이 열립니다. 밸브, 문양, 수련판, 바위 앞에서 확인 버튼을 누르세요.", { x: 2, y: map.height - 3 }, [], 4);
  }

  if (hideout) {
    const hideLevel = levels.side(4, 24);
    for (const [i, wanted] of [{ x: 4, y: hideout.height - 5 }, { x: hideout.width - 5, y: 7 }].entries()) {
      battle(hideout, `company_${i}`, "밤막회사 연구원", nearest(hideout, wanted, connected(hideout), true), pickSpecies("ruins", hideLevel, undefined, 2), hideLevel,
        `mx_company_${i}`, "허가받지 않은 출입은 금지다. 회사의 실험을 방해하지 마라!", [text("저들은 몬스터들을 자원으로만 보고 있어… 위쪽 실험실에서 장치를 멈추자.")], i === 0 ? "mx_badge_4" : "mx_company_0");
    }
    const rescueAt = nearest(hideout, { x: hideout.width >> 1, y: 3 }, connected(hideout), true);
    battle(hideout, "boss", "밤막회사 지부장 · 서준", rescueAt, pickSpecies("ruins", hideLevel + 2, undefined, 3), hideLevel + 2, "mx_story_rescue",
      "섬의 빛은 효율적인 자원이야. 몬스터들의 마음 같은 건 계산에 넣지 않아!",
      [text("연구 장치의 전원을 끄자 갇힌 몬스터들이 풀려났다. 박사의 연구 기록도 되찾았다."), gain("item_capture_orb", 10), ...(towns.some(t => t.key === "dune") ? [text("이제 프리즘 시티의 서쪽, 유리모래 사막으로 갈 수 있다.")] : [])], "mx_company_1");
  }
  const finaleAt = nearest(observatory, { x: observatory.width >> 1, y: 3 }, connected(observatory), true);
  const finalName = lookTown(towns[shape.finalTown]!).name;
  battle(observatory, "boss", "밤막회사 대표 · 무영", finaleAt, pickSpecies("", levels.endgame(50), undefined, 4), levels.endgame(50), "mx_story_beacon",
    gymCount === 0 ? "세상이 흔들려도 빛만 모으면 내가 질서를 만들 수 있어. 이 섬을 걸어 다닌 네 동료들의 힘으로 나를 막아 보아라!" : "세상이 흔들려도 빛만 모으면 내가 질서를 만들 수 있어. 그 여덟 약속으로 나를 막아 보아라!",
    [text(gymCount === 0 ? "섬을 걸으며 모은 동료들의 울음이 하나로 모였다. 오래된 등대가 다시 별빛섬을 비추기 시작했다." : "여덟 배지의 빛과 동료들의 울음이 하나로 모였다. 오래된 등대가 다시 별빛섬을 비추기 시작했다."), text("빛은 누군가의 소유가 아니었어. 이제… 나도 섬을 다시 배워야겠군.", "무영"), { kind: "recoverAll" },
      ...(gymCount === 0
        ? [text("등대가 환하게 켜졌다. 이 섬의 모험은 이제 여러분의 것이다!"), sw("mx_ending"), { kind: "checkpointSave", label: "별빛섬의 등대" } as Command, music(audio.ending), { kind: "triggerEnding", endingId: "mx_ending_starlight" } as Command]
        : [text(`별빛 리그의 문이 열렸다. ${finalName}에서 마지막 도전을 시작하자.`)])], "mx_badge_8", audio.league);

  for (const [i, map] of league.entries()) {
    const room = leagueRooms[i]!, last = i === league.length - 1;
    const at = nearest(map, { x: map.width >> 1, y: 4 }, connected(map), true);
    const won = `mx_league_${i + 1}`;
    const reward: Command[] = [text(!last ? "다음 방에서 더 큰 도전이 기다리고 있다." : "끝까지 동료들을 믿었구나. 이제 별빛섬의 챔피언은 너야!", last ? "나루" : "사천왕")];
    if (last) reward.push(sw("mx_ending"), { kind: "checkpointSave", label: "별빛섬 챔피언" }, music(audio.ending), { kind: "triggerEnding", endingId: "mx_ending_starlight" });
    const leagueLevel = levels.endgame(50 + (shape.leagueRooms >= 5 ? i : leagueRooms.length === 3 ? [1, 3, 4][i]! : 4) * 2);
    // 이 레벨에 그 타입의 종이 없으면(짧은 캠페인의 낮은 레벨) 타입 없이 고른다.
    const type = room.type && EXPEDITION_SPECIES.some(sp => sp.stage > 0 && sp.types.includes(room.type!) && minimumLevel(sp.id) <= leagueLevel) ? room.type : undefined;
    battle(map, "league_challenge", room.name, at,
      pickSpecies("", leagueLevel, type, last ? 6 : 4), leagueLevel, won, last ? "같은 마을에서 출발한 우리가 여기서 다시 만났네. 마지막 한 번, 온 마음으로 싸우자!" : `${gymCount >= FULL_GYMS ? "여덟" : gymWord(gymCount)} 지역의 약속을 지닌 여행자여, 리그의 시련을 받아라!`, reward,
      i === 0 ? "mx_story_beacon" : `mx_league_${i}`, audio.league);
    if (!last) connect(map, league[i + 1]!, won);
    else npc(map, "return_home", "리그 안내원", "챔피언이 되어도 모험은 계속됩니다. 고향으로 돌아가 희귀 몬스터와 도감을 탐험해 보세요.", { x: 3, y: map.height - 4 },
      [{ kind: "fork", condition: condition("mx_ending"), then: [transfer(townMaps.get("home")!, entries.get(id("home"))!)], else: [text("먼저 챔피언에게 도전해 주세요.")] }], 4);
  }

  if (townMaps.has("harbor")) {
    const deck = make("ship_deck", "별바람호 · 갑판", "rooms/ship_deck", "coast", "interior");
    const corridor = make("ship_corridor", "별바람호 · 복도", "rooms/ship_corridor", "coast", "interior");
    const cabin = make("ship_cabin", "별바람호 · 선실", "rooms/ship_cabin", "coast", "interior");
    connect(townMaps.get("harbor")!, deck, "mx_badge_2"); connect(deck, corridor); connect(corridor, cabin);
    const ferryChoices = (list: typeof towns, blocked: string): Command => ({
      kind: "choices", options: list.map(t => ({ text: lookTown(t).name, branch: [{ kind: "fork", condition: condition(`mx_visit_${t.key}`),
        then: [transfer(townMaps.get(t.key)!, entries.get(id(t.key))!)], else: [text(blocked, "선장")] }] })),
      cancelBehavior: "branch", cancelBranch: [],
    });
    const ferry: Command[] = [{ kind: "choices", prompt: "어디로 갈까?", options: [
      { text: "서쪽 지역", branch: [ferryChoices(towns.slice(0, 5), "아직 방문하지 않은 마을이야. 먼저 육로로 길을 열어 줘.")] },
      ...(towns.length > 5 ? [{ text: "동쪽 지역", branch: [ferryChoices(towns.slice(5), "아직 방문하지 않은 마을이야.")] }] : []),
    ], cancelBehavior: "branch", cancelBranch: [] }];
    npc(cabin, "captain", "별바람호 선장", "한 번 방문한 마을로 데려다줄게. 돌아가는 길에서도 새 친구를 만날 수 있지.", { x: 4, y: 4 }, ferry, 7);
  }

  for (const [i, sid] of EXPEDITION_LEGENDARIES.entries()) {
    const record = EXPEDITION_SPECIES.find(s => s.id === sid)!;
    const candidates = Object.values(project.maps).filter(m => sources.get(m.id)?.tilesetId && (sides.find(s => id(s.key) === m.id)?.habitat === record.habitat));
    const map = candidates[0] ?? observatory;
    const at = nearest(map, { x: map.width - 4, y: 4 + i }, connected(map), true);
    const tid = troop(`희귀 몬스터 · ${record.name}`, `legendary_${i}`, [sid], levels.endgame(55), false);
    const caught = `mx_legendary_${i}_encountered`;
    event(map, `legendary_${i}`, at, [{ kind: "fork", condition: condition("mx_ending"), then: [{ kind: "fork", condition: condition(caught), then: [text("별빛의 흔적이 남아 있다. 이 몬스터는 주변 서식지에서도 아주 드물게 나타난다.")], else: [text(`${withJosa(record.name, "이/가")} 별빛을 따라 모습을 드러냈다!`),
      { kind: "battleProcessing", troopId: tid, canEscape: true, canLose: true, branchOnResult: true,
        victoryBranch: [sw(caught), text("별빛의 만남을 도감에 기록했다.")], defeatBranch: [{ kind: "recoverAll" }, transfer(townMaps.get("home")!, entries.get(id("home"))!)], escapeBranch: [text("희귀 몬스터가 당신을 기다리고 있다.")] } ] }], else: [text("빛을 잃은 별무늬가 새겨져 있다. 섬의 등불이 모두 돌아온 뒤 다시 와 보자.")] }], { below: true, graphic: marker("star") });
    map.encounterTable ??= [];
    map.encounterTable.push({ troopId: tid, weight: 1, conditions: { switchId: "mx_ending" } });
    map.encounterRate ||= 12;
  }

  const hometown = townMaps.get("home")!;
  const start = nearest(hometown, { x: 10, y: 10 }, connected(hometown), true);
  project.startMapId = hometown.id; project.startPos = start;
  project.mapTree = { mapId: hometown.id, children: Object.values(project.maps).filter(m => m.id !== hometown.id).map(m => ({ mapId: m.id, children: [] })) };
  project.system.monsterCampaign = { id: "starlight-islands", name: "별빛섬 몬스터 원정", speciesIds: EXPEDITION_SPECIES.map(s => s.id),
    speciesNotes: Object.fromEntries(EXPEDITION_SPECIES.map(s => [s.id, s.description])),
    badges: gymPersonas.map((g, i) => ({ id: `badge_${i + 1}`, name: g.badge, switchId: `mx_badge_${i + 1}`, cityMapId: id(g.town), iconResourceId: badgeIconResourceId(gymType(i, g)) })),
    locations: [...towns.map(t => ({ mapId: id(t.key), name: lookTown(t).name, x: t.x, y: t.y, kind: "town" as const })),
      ...routes.map((r, i) => ({ mapId: id(r.key), name: r.name, x: (towns[i]!.x + towns[i + 1]!.x) / 2, y: (towns[i]!.y + towns[i + 1]!.y) / 2, kind: "route" as const })),
      { mapId: observatory.id, name: observatory.name, x: 4, y: 2, kind: "dungeon" }, ...(league[0] ? [{ mapId: league[0].id, name: "별빛 리그", x: 4, y: 0, kind: "league" as const }] : [])],
    objectives: [{ id: "starter", title: "별싹 마을 북동쪽 연구소에서 천문박사와 첫 동료를 만나라.", switchId: "mx_starter" },
      ...gymPersonas.flatMap((g, i) => [ ...(i === 4 ? [{ id: "rescue", title: "프리즘 시티의 별빛 연구소에서 갇힌 몬스터를 구하라.", switchId: "mx_story_rescue", requiresSwitchId: "mx_badge_4" }] : []),
        { id: `gym_${i + 1}`, title: `${lookTown(towns[i + 1]!).name}의 ${g.name}에서 ${g.badge}를 받아라.`, switchId: `mx_badge_${i + 1}`, requiresSwitchId: i === 0 ? "mx_starter" : i === 4 ? "mx_story_rescue" : `mx_badge_${i}` } ]),
      { id: "beacon", title: `${finalName}의 옛 별 관측탑에서 밤막회사를 막고 등대를 복구하라.`, switchId: "mx_story_beacon", requiresSwitchId: gate("mx_badge_8")! },
      ...(league[0] ? [{ id: "league", title: "별빛 리그의 사천왕과 챔피언 나루에게 도전하라.", switchId: "mx_ending", requiresSwitchId: "mx_story_beacon" }] : [])] };
  project.endings = [{ id: "mx_ending_starlight", name: gymCount >= FULL_GYMS ? "여덟 빛의 약속" : gymCount > 0 ? `${gymWord(gymCount)} 빛의 약속` : "별빛섬의 등대", conditions: [condition("mx_ending")], priority: 100,
    presentation: { tone: "warm", musicResourceId: audio.ending, credits: "별빛섬 몬스터 원정\n기획·맵·이벤트: OPRN Studio\n몬스터·타일·음악: 오리지널 좌표 도트와 작곡\n함께 걸어 준 모든 동료에게" } }];
  // 야생에게 지면 원작처럼 마지막으로 들른 회복 센터(직원의 checkpointSave)에서 깨어난다. 들른 적이 없으면 집.
  // 마지막 체크포인트는 불러오기 뒤에 사라지고 센터에 들른 적도 없을 수 있다 — 그때 「센터에서 쉬었다」인데 시작 길로 가지 않도록
  // 첫 마을 회복 센터 직원 앞을 물러날 자리로 둔다(D31). 체크포인트가 있으면 그쪽이 먼저다.
  const firstCenter = project.maps[id(`${towns[0]!.key}_center`)];
  const firstNurse = firstCenter?.events.find(e => /_center_nurse$/.test(e.id));
  project.system.gameOver = { outcome: "recover", presentation: "blackout", goldLossPercent: 50, title: "다시 시작할 수 있어", message: "소지금의 절반을 잃었지만, 동료들과 함께 회복 센터에서 쉬었다.",
    ...(firstCenter && firstNurse ? { recoveryFallback: { mapId: firstCenter.id, x: firstNurse.x, y: firstNurse.y + 1 } } : {}) };
  project.system.startActorIds = [DEFAULT_ACTOR_ID];
  project.session.partyActorIds = [DEFAULT_ACTOR_ID];
  project.system.sellPrices = [...(project.system.sellPrices ?? []).filter(p => p.itemId !== "item_capture_orb"), { itemId: "item_capture_orb", price: 0 }];
  project.session.inventory = {}; project.session.gold = 1600;
  project.session.switches = Object.fromEntries(project.switches.map(s => [s.id, false]));
  const allSwitches = new Set<string>(["mx_starter", "mx_story_rescue", "mx_story_beacon", "mx_ending", ...towns.map(t => `mx_visit_${t.key}`),
    ...gymPersonas.flatMap((_, i) => [`mx_badge_${i + 1}`, `mx_gym_${i + 1}_puzzle`]), ...manifest.battles.flatMap(b => b.victorySwitch ? [b.victorySwitch] : [])]);
  for (const sid of allSwitches) if (!project.switches.some(s => s.id === sid)) project.switches.push({ id: sid, name: sid });
  event(hometown, "opening", start, [],
    { trigger: "auto", below: true, pages: [{ id: "mx_intro_page", name: "여행의 시작", conditions: [{ kind: "switch", switchId: "mx_intro", value: false }], graphic: invisible,
      trigger: { kind: "auto" }, priority: "below", movement: fixed, commands: [text("별빛섬의 등대가 빛을 잃어 간다. 오늘은 너와 몬스터의 첫 모험이 시작되는 날."), text("북동쪽 연구소에서 천문박사를 만나자. 방향키로 이동, Z/Enter로 대화, X/Esc로 메뉴를 열 수 있다."), sw("mx_intro")] }] });
  const visitSwitches = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visitSwitches); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === "switchId" || key === "requiresSwitchId") && typeof child === "string") allSwitches.add(child);
      else visitSwitches(child);
    }
  };
  visitSwitches(project.maps); visitSwitches(project.system.monsterCampaign);
  for (const sid of allSwitches) if (!project.switches.some(s => s.id === sid)) project.switches.push({ id: sid, name: sid });
  project.session.switches = Object.fromEntries(project.switches.map(s => [s.id, false]));
  // 키 큰 풀 칸(칩셋 지형 태그 5)이 충분한 길은 풀 칸에서만 야생이 나온다(포켓몬식 — 길·맨땅·문 앞은 안전). 지형은 칠이 모두 끝난 뒤에 센다.
  // 풀 칸이 모자란 던전·곁길은 서식지 사각형 전체 그대로(조우가 영영 없는 맵이 되지 않게).
  ensureGrassTerrainRecord(project.database.terrains ??= []);
  for (const map of Object.values(project.maps)) {
    const wildEntries = (map.encounterTable ?? []).filter(e => e.conditions?.locationId === `${map.id}_habitat`);
    if (!wildEntries.length) continue;
    let grassCells = 0;
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (terrainRecordAt(project, { mapId: map.id, x, y })?.record.id === GRASS_TERRAIN_ID) grassCells++;
    if (grassCells < 16) continue;
    for (const e of wildEntries) e.conditions = { ...e.conditions!, terrainId: GRASS_TERRAIN_ID };
  }
  // 낚시: 물이 가장 넓은 길 한 곳에 낚시 구역을 열고, 그 물가의 낚시꾼이 낚싯대를 준다(낚싯대가 있어야 낚는다).
  const pond = configureExpeditionFishing(project);
  if (pond) {
    const map = project.maps[pond.mapId]!;
    npc(map, "angler", "낚시꾼", "물가를 바라보고 조사 버튼을 누르면 낚시를 해. 무엇이 걸릴지는 물에게 물어봐야 알지!",
      { x: pond.area.x - 1, y: pond.area.y + (pond.area.h >> 1) },
      [{ kind: "fork", condition: { kind: "item", itemId: EXPEDITION_FISHING_ROD_ID, present: false }, then: [gain(EXPEDITION_FISHING_ROD_ID, 1), text("낚싯대를 받았다! 물가를 바라보고 조사하면 낚시를 할 수 있다.")], else: [text("낚싯대는 이미 가지고 있구나. 물가에서 마음껏 써 봐.")] }], 6);
  }
  repairExpeditionNpcLayout(project);
  repairExpeditionResidents(project, lookOf);
  repairExpeditionShopPrices(project);
  // 마을 빈터를 쓰임으로 채운다(kitAreaFurnish — 편집기 furnish_outdoor_area 와 같은 코드). 판(townLayouts)은 건물·길·큰 표식만 깔고
  // 남은 풀밭·눈밭·모래가 휑했다(2026-10-14 탐침: 마을 맨땅 14%). 문 앞·이벤트 둘레·주민 산책길·시작 위치는 비우고, 닿던 이벤트는 그대로 닿는다.
  for (const t of towns) {
    const map = townMaps.get(t.key)!;
    const keep = map.id === project.startMapId ? [project.startPos.y * map.width + project.startPos.x] : [];
    fillAreaByUse(project, map, { x: 0, y: 0, w: map.width, h: map.height }, { seed: map.id.length * 31 + map.width, keep, maxLots: 10 });
  }
  return manifest;
}
