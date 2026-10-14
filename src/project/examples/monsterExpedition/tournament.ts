import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassableLanding } from "@/project/collision";
import { slideRuleAt } from "@/project/slideTiles";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel } from "@/project/monsterCollection";
import { charsetGraphic, demoEnemy, demoTroop } from "@/project/defaults/scarloxyDemoGame";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { EXPEDITION_AUDIO as audio } from "./audio";
import { EXPEDITION_SPECIES, EXPEDITION_STARTERS } from "./roster";
import markerAssets from "./markers.json";
import templateData from "./mapTemplates.json";
import { composeTown, START_ROUTES, START_TOWNS, TOWN_SKETCHES, type StartTheme } from "./townLayouts";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { expeditionEnemyActions } from "./enemyActions";
import { repairExpeditionShopPrices } from "./shopPrices";
import { repairExpeditionResidents } from "./residents";
import { repairExpeditionNpcLayout } from "./npcLayout";
import { fillAreaByUse } from "@/project/kitAreaFurnish";

type Point = { x: number; y: number };
type Template = { width: number; height: number; lower: number[]; upper: number[]; tilesetId: string; run: string;
  names: Record<string, number>; buildings: { name: string; width: number; height: number; rowsLower: number[][]; rowsUpper: number[][] }[];
  marks?: Record<string, number[][]>; leader?: number[] };
const templates = templateData as unknown as Record<string, Template>;
const fixed = { type: "fixed", speed: 3, frequency: 3 } as const;
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

export interface TournamentManifest {
  maps: { id: string; name: string; template: string; entry: Point; role: string }[];
  links: { from: string; to: string; eventId: string; source: Point; destination: Point; required?: string }[];
  battles: { mapId: string; eventId: string; troopId: string; level: number; victorySwitch?: string }[];
  rounds: number;
}
export interface TournamentNames { readonly region?: string; readonly startTown?: string; readonly registrar?: string; readonly rival?: string; readonly champion?: string; readonly arena?: string }
export interface TournamentOptions {
  readonly rounds?: number; readonly startTheme?: StartTheme; readonly names?: TournamentNames;
}

export const TOURNAMENT_MIN_ROUNDS = 2;
export const TOURNAMENT_MAX_ROUNDS = 8;
export const clampRounds = (n: unknown): number => Math.max(TOURNAMENT_MIN_ROUNDS, Math.min(TOURNAMENT_MAX_ROUNDS, typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 4));
// 1회전 상대의 타입 — 앞은 상성이 단순한 셋, 뒤로 갈수록 까다로운 타입. 그 레벨에 그 타입 종이 없으면 타입 없이 고른다.
const START_HABITAT: Readonly<Record<StartTheme, string>> = { desert: "desert", snow: "snow", coast: "coast", volcano: "volcano" };
const ROUND_TYPES = ["water", "fire", "grass", "electric", "ghost", "fighting", "ice", "dragon"] as const;
const ROUND_ARENAS = ["rooms/league_ice", "rooms/league_ghost", "rooms/league_dark", "rooms/league_dragon"] as const;
const ROUND_NAMES = ["신예 조련사 하람", "물길 조련사 소담", "불꽃 조련사 단아", "번개 조련사 도하", "그림자 조련사 은율", "기백 조련사 태양", "서리 조련사 서린", "용 조련사 세찬"] as const;
const ROUND_LINES = ["첫 경기부터 긴장되네. 서로 전력으로 가자!", "상성만 믿으면 지는 거 알지? 기술 횟수도 지켜봐.", "나는 뜨겁게 밀어붙이는 쪽이야. 버텨 봐!", "번개처럼 끝낼게. 눈 깜짝할 새야.", "조용히 이기는 게 내 방식이야.", "몸으로 부딪혀 보자. 기백은 속이지 못해!", "서두르지 않아. 차갑게 끝까지 가는 쪽이 이기지.", "여기까지 올라왔구나. 이제부터는 진짜 승부야."] as const;


/** 포획이 없는 대회형(트레이너 대전) 게임. 몬스터를 데리고 싸우는 파티 전투이며, 포획 구슬은 어디에도 없다. */
export function authorTournamentWorld(project: Project, options: TournamentOptions = {}): TournamentManifest {
  const expedition = options.format === "expedition";
  const rounds = expedition ? Math.max(2, Math.min(5, typeof options.rounds === "number" && Number.isFinite(options.rounds) ? Math.round(options.rounds) : 4)) : clampRounds(options.rounds);
  const names = options.names ?? {};
  const regionName = names.region ?? (expedition ? "별빛 사냥터" : "별빛 대회");
  const registrarName = names.registrar ?? (expedition ? "도감 박사 라온" : "접수 담당 라온");
  const rivalName = names.rival ?? "나루";
  const championName = names.champion ?? rivalName;
  const arenaName = names.arena ?? (expedition ? regionName : `${regionName} 본선`);
  for (const [aid, asset] of Object.entries(markerAssets)) project.assets.uploaded[aid] = structuredClone(asset) as Project["assets"]["uploaded"][string];
  project.maps = {};
  project.mapConnections = [];
  const manifest: TournamentManifest = { maps: [], links: [], battles: [], rounds };
  const sources = new Map<string, Template>();
  const entries = new Map<string, Point>();
  const reserved = new Map<string, Set<string>>();
  const doorSpots = new Map<string, Point>();
  const exitHints = new Map<string, Point>();
  const speciesById = new Map((project.database.monsterSpecies ?? []).map(s => [s.id, s]));
  const coord = (p: Point) => `${p.x},${p.y}`;
  const reserve = (map: GameMap, p: Point) => reserved.get(map.id)!.add(coord(p));

  function drawnExit(map: GameMap, t: Template): Point | undefined {
    const exits = new Set(Object.entries(t.names).filter(([n]) => /_exit$|_mat(_|$)/.test(n) && !/edge_mat/.test(n)).map(([, v]) => v));
    for (let y = map.height - 1; y >= map.height - 3; y--) for (let x = 0; x < map.width; x++) {
      if (exits.has(map.lowerTiles[y * map.width + x]!)) return { x, y };
    }
    return undefined;
  }

  function make(key: string, name: string, source: string, track: keyof typeof audio, role: "town" | "field" | "interior" | "dungeon", sketched: false | "hub" | "route" = false): GameMap {
    const t = templates[source];
    if (!t) throw Error(`Missing reviewed map ingredient ${source}`);
    const map: GameMap = { id: id(key), name, width: t.width, height: t.height, tilesetId: t.tilesetId, tileSize: 16,
      lowerTiles: [...t.lower], upperTiles: [...t.upper], events: [], encounterRate: 0,
      mapRole: role, bgm: { mode: "custom", resourceId: audio[track], fadeInMs: 350 }, battleBackground: undefined };
    if (sketched) {
      const sketch = sketched === "hub" ? (options.startTheme ? START_TOWNS[options.startTheme].sketch : TOWN_SKETCHES.home) : options.startTheme ? START_ROUTES[options.startTheme]?.sketch : undefined;
      if (sketch) composeTown(project, map, t, sketch, templates);
    }
    // 1번길 템플릿은 길 끝 다섯 줄이 모래 띠였다 — 길로 이어 깐다(world.ts 와 같은 보정).
    if (source === "overworld/route") {
      const clearing = autotileGroupsForTileset(project.tilesets[map.tilesetId]).find(g => g.id === "clearing")!;
      const sand = new Set(Object.entries(t.names).filter(([n]) => n.startsWith("sand_at")).map(([, v]) => v));
      const changed: Point[] = [];
      map.lowerTiles.forEach((tile, i) => { if (sand.has(tile)) { map.lowerTiles[i] = clearing.variantMap["255"]!; changed.push({ x: i % map.width, y: Math.floor(i / map.width) }); } });
      shapeAllAutotileGroupsAround(map, [clearing], changed);
    }
    // 8번길 유적 템플릿은 출구 위 모래에 돌바닥 두 칸이 덩그러니 떠 있었다 — 모래로 덮는다(world.ts 와 같은 보정).
    if (source === "dungeon/ruins") {
      const stone = new Set(["ru_fl2", "ru_fl3"].map(n => t.names[n]));
      for (let x = 0; x < map.width; x++) {
        const cell = (map.height - 3) * map.width + x;
        if (stone.has(map.lowerTiles[cell]!)) map.lowerTiles[cell] = t.names[x % 2 ? "ru_sand1" : "ru_sand2"]!;
      }
    }
    project.maps[map.id] = map;
    sources.set(map.id, t);
    reserved.set(map.id, new Set());
    const drawn = drawnExit(map, t);
    if (drawn) exitHints.set(map.id, drawn);
    const p = anchor(map, drawn ?? { x: map.width >> 1, y: map.height - 2 });
    entries.set(map.id, p);
    reserve(map, p);
    manifest.maps.push({ id: map.id, name, template: source, entry: p, role });
    return map;
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

  function portal(map: GameMap, target: GameMap, at: Point, landing: Point, required?: string, label = target.name): void {
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
  function standSpot(map: GameMap, wanted: Point): Point {
    const meta = project.tilesets[map.tilesetId]?.tileMeta ?? [];
    const busy = (tile: number | undefined) => tile !== undefined && tile >= 0 && /키 큰 풀|계단|stairs|턱|출구|매트|mat\(/i.test(meta[tile]?.label ?? "");
    const doors = map.events.filter(e => e.id.includes("_to_"));
    const before = walkable(map).size;
    const fits = (p: Point) => !busy(map.lowerTiles[p.y * map.width + p.x]) && !busy(map.upperTiles[p.y * map.width + p.x])
      && doors.every(d => Math.max(Math.abs(d.x - p.x), Math.abs(d.y - p.y)) > 2)
      && !reserved.get(map.id)!.has(coord(p)) && !map.events.some(e => e.x === p.x && e.y === p.y);
    const candidates = connected(map).filter(fits)
      .sort((a, b) => Math.abs(a.x - wanted.x) + Math.abs(a.y - wanted.y) - Math.abs(b.x - wanted.x) - Math.abs(b.y - wanted.y));
    return candidates.find(p => walkable(map, p).size === before - 1) ?? nearest(map, wanted, connected(map), true);
  }

  function connect(a: GameMap, b: GameMap, required?: string): void {
    // 이미 선 표지판·사람 뒤로 문을 두지 않는다 — 새순·달그림자 마을에서 둘째 북쪽 문이 첫 표지판에 막혔다(2026-10-06).
    const reachA = walkable(a);
    const ca = connected(a).filter(p => reachA.has(coord(p))), cb = connected(b);
    const harborExit = a.id === id("harbor") ? ({ mx_map_river: { x: 15, y: 9 }, mx_map_ship_deck: { x: 16, y: 9 }, mx_map_beach: { x: 8, y: 10 }, mx_map_sea_cave: { x: 23, y: 10 } }[b.id]) : undefined;
    const atA = harborExit ?? anchor(a, { x: a.width >> 1, y: 2 }, ca);
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
  function troop(name: string, key: string, speciesIds: readonly string[], level: number, trainer: boolean): string {
    const enemyIds = speciesIds.map((speciesId, i) => {
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
    return Array.from({ length: count }, (_, i) => roster[i % roster.length]!.id);
  }

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
    map.encounterTable = pool.map((speciesId, i) => ({ troopId: troop(`야생의 ${speciesById.get(speciesId)!.name}`, `${map.id}_wild_${i}`, [speciesId], wildLevel(i), false),
      weight: i < 3 ? 5 : 2, conditions: { locationId: `${map.id}_habitat`, switchId: "mx_starter" } }));
    return pool;
  }

  function battle(map: GameMap, suffix: string, name: string, at: Point, ids: string[], level: number, winSwitch: string | undefined, before: string, win: Command[], required?: string, track: string = audio.trainerBattle): GameEvent {
    const tid = troop(name, `${map.id}_${suffix}`, ids, level, true);
    const intro = [text(before, name), battleMusic(track)];
    const fight: Command = { kind: "battleProcessing", troopId: tid, canEscape: false, canLose: true, branchOnResult: true,
      victoryBranch: [battleMusic(), ...(winSwitch ? [sw(winSwitch)] : []), ...win, music(map.bgm!.resourceId!)],
      defeatBranch: [battleMusic(), text("동료들이 지쳤다. 회복 센터에서 다시 준비하자."), { kind: "recoverAll" },
        transfer(project.maps[id(`${townFor(map)}_center`)] ?? project.maps[id("home_center")]!, centerLanding(project.maps[id(`${townFor(map)}_center`)] ? `${townFor(map)}_center` : "home_center"))],
      escapeBranch: [battleMusic(), text("다시 준비해서 돌아오자.")] };
    let commands: Command[] = [...intro, fight];
    if (required) commands = [{ kind: "fork", condition: condition(required), then: commands, else: [text("먼저 이곳의 장치와 이전 약속을 마쳐야 한다.", name)] }];
    if (winSwitch) commands = [{ kind: "fork", condition: condition(winSwitch), then: [text("다시 만나 반가워. 동료들과 모험은 잘 되어 가니?", name),
      { kind: "choices", prompt: "재대결할까?", options: [{ text: "다시 겨룬다", branch: [...intro, { ...fight, victoryBranch: [battleMusic(), text("멋진 재대결이었다!", name), music(map.bgm!.resourceId!)] }] }, { text: "다음에", branch: [] }], cancelBehavior: "branch", cancelBranch: [] }], else: commands }];
    const e = event(map, suffix, at, commands, { graphic: charsetGraphic("tex_easyrpg_charset_people1", 6) });
    manifest.battles.push({ mapId: map.id, eventId: e.id, troopId: tid, level, ...(winSwitch ? { victorySwitch: winSwitch } : {}) });
    return e;
  }
  // 패배하면 원작처럼 직원 앞에서 다시 선다 — 출입문 칸 위로 옮기면 다음 걸음에 문이 발동하지 않아 헤맨다.
  function centerLanding(centerKey: string): Point {
    const room = project.maps[id(centerKey)]!;
    const exit = entries.get(room.id)!;
    return nearest(room, { x: exit.x, y: exit.y - 1 }, connected(room).filter(p => coord(p) !== coord(exit)), true);
  }

  const townFor = (_map: GameMap): string => "home";


  /** 두 형식 공통 마무리 — 스위치 등록, NPC 배치 보정, 마을 빈터 채우기. */
  function finishWorld(allSwitches: Set<string>): void {
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
    repairExpeditionNpcLayout(project);
    repairExpeditionResidents(project, key => key);
    repairExpeditionShopPrices(project);
    const keep = [project.startPos.y * hub.width + project.startPos.x];
    fillAreaByUse(project, hub, { x: 0, y: 0, w: hub.width, h: hub.height }, { seed: hub.id.length * 31 + hub.width, keep, maxLots: 10 });
  }

  // ── 사냥터 탐험(체육관 없음, 포획 있음): 사냥터 N곳을 순서대로 — 야생 + 트레이너 둘, 중간에 라이벌, 마지막 사냥터에 보스.
  function authorHuntingGrounds(): void {
    const habitats = ["grass", "forest", "coast", "mountain", "ruins"] as const;
    const templatesBy = ["overworld/route", "wild/forest_maze", "wild/river", "wild/mountain", "dungeon/ruins"] as const;
    const groundNames = ["1번 사냥터 · 들판", "2번 사냥터 · 숲", "3번 사냥터 · 계곡", "4번 사냥터 · 고개", "마지막 사냥터 · 옛 별자리길"] as const;
    const musics = ["route", "forest", "coast", "route", "cave"] as const;
    const picks = Array.from({ length: rounds }, (_, i) => (i === rounds - 1 ? 4 : i));
    const levelOf = (i: number) => 4 + i * 8;
    const grounds = picks.map((k, i) => {
      const source = i === 0 && options.startTheme ? START_ROUTES[options.startTheme]?.template ?? templatesBy[k]! : templatesBy[k]!;
      return make(`ground_${i + 1}`, groundNames[k]!, source, musics[k]!, i === rounds - 1 ? "dungeon" : "field", i === 0 ? "route" : false);
    });
    const pools: string[][] = [];
    grounds.forEach((map, i) => {
      const k = picks[i]!;
      const accent = i === 0 && options.startTheme ? START_HABITAT[options.startTheme] : undefined;
      pools.push(wild(map, habitats[k]!, levelOf(i), accent));
    });
    connect(hub, grounds[0]!, "mx_starter");
    for (let i = 0; i < rounds - 1; i++) connect(grounds[i]!, grounds[i + 1]!, i === rounds - 2 ? "mx_rival_2" : `mx_ground_${i + 1}`);
    grounds.forEach((map, i) => {
      const k = picks[i]!;
      const last = i === rounds - 1;
      for (let t = 0; t < (last ? 0 : 2); t++) {
        const at = standSpot(map, { x: 3 + t * 7, y: 6 + t * 8 });
        const first = i === 0;
        const team = first ? [pools[0]![t % pools[0]!.length]!] : pickSpecies(habitats[k]!, levelOf(i) + 1, undefined, 1 + t);
        const win = t === 1 ? `mx_ground_${i + 1}` : `${map.id}_trainer_${t}_won`;
        battle(map, `trainer_${t}`, ["야생 조련사 도현", "사냥터 지킴이 서연"][t]!, at, team, first ? 3 + t : levelOf(i) + t, win,
          ["이 사냥터는 처음이야? 같이 몸 풀자!", "여기까지 왔구나. 다음 사냥터로 가려면 나를 넘어야 해."][t]!, [gain("item_potion", 1), text("조련사가 회복약 하나를 건넸다.")]);
      }
      if (!last) npc(map, "ranger", "사냥터 안내원", `${map.name}. 야생 몬스터는 포획할 수 있고 조련사의 몬스터는 포획할 수 없어요. 도감을 채워 보세요.`, { x: 3, y: map.height - 4 }, [], 4);
    });
    // 라이벌은 한 명 — 연구소에서 한 번, 마지막 사냥터 바로 앞 사냥터에서 한 번.
    const rivalGround = grounds[Math.max(0, rounds - 2)]!;
    const rivalLevel = levelOf(rounds - 2) + 1;
    battle(rivalGround, "rival", rivalName, standSpot(rivalGround, { x: rivalGround.width >> 1, y: 4 }), pickSpecies("", rivalLevel, undefined, 2), rivalLevel,
      "mx_rival_2", "여기서 또 만났네! 도감은 얼마나 채웠어? 마지막 사냥터 가기 전에 우리 실력을 확인하자!",
      [text("그래, 마지막 사냥터는 네 몫이야. 나도 곧 따라갈게.", rivalName), gain("item_hi_potion", 2)], rounds >= 3 ? `mx_ground_${rounds - 2}` : "mx_starter");
    const last = grounds[rounds - 1]!;
    const bossLevel = levelOf(rounds - 1) + 1;
    battle(last, "boss", "사냥터의 주인", nearest(last, { x: last.width >> 1, y: 3 }, connected(last), true), pickSpecies("", bossLevel, undefined, 3), bossLevel,
      "mx_boss", "이 사냥터의 모든 몬스터는 내 친구들이야. 네가 정말 함께 걸을 자격이 있는지 보여 줘!",
      [text("사냥터의 주인이 고개를 끄덕였다. 도감에 이 땅의 모든 이야기가 기록되었다."), sw("mx_ending"), { kind: "checkpointSave", label: `${regionName} 완주` }, music(audio.ending), { kind: "triggerEnding", endingId: "mx_ending_hunt" }], "mx_rival_2", audio.league);
    npc(last, "return_home", "사냥터 안내원", "탐험을 마쳐도 사냥터는 그대로예요. 마을로 돌아가 도감을 더 채워 보세요.", { x: last.width - 8, y: last.height - 3 },
      [{ kind: "fork", condition: condition("mx_ending"), then: [transfer(hub, entries.get(hub.id)!)], else: [text("먼저 사냥터의 주인을 만나 주세요.")] }], 4);
    const starter: Command[] = [{ kind: "choices", prompt: "첫 동료를 선택하자", options: EXPEDITION_STARTERS.map(sid => ({ text: speciesById.get(sid)!.name,
      branch: [{ kind: "giveMonster", speciesId: sid, level: 5 }, sw("mx_starter"), sw(`mx_starter_${sid}`), gain("item_capture_orb", 10), gain("item_potion", 5),
        text("첫 동료와 만났다! 야생 전투에서는 「가방」의 포획구슬을 사용해 도감을 채워 보렴.", registrarName)] })), cancelBehavior: "disallow" }];
    npc(lab, "professor", registrarName, `${regionName}의 몬스터를 도감에 모두 기록하는 게 내 오랜 꿈이란다. 체육관은 없어 — 사냥터를 따라 걸으며 만나고, 잡고, 기록하렴.`, { x: 7, y: 5 },
      [{ kind: "fork", condition: condition("mx_starter"), then: [text("메뉴의 「도감」에서 만난 몬스터와 잡은 몬스터를 볼 수 있단다. 마지막 사냥터의 주인이 기다리고 있어.", registrarName)], else: starter }], 5);
    battle(lab, "rival_start", rivalName, nearest(lab, { x: lab.width - 5, y: lab.height - 5 }, connected(lab), true), pickSpecies("", 5, undefined, 1), 5,
      "mx_rival_1", "나도 오늘 출발이야! 첫 동료끼리 가볍게 겨뤄 볼래?", [text("사냥터에서 다시 만나자. 도감은 내가 먼저 채울 거야!", rivalName), gain("item_potion", 2)], "mx_starter");
    const start = nearest(hub, { x: 10, y: 10 }, connected(hub), true);
    project.startMapId = hub.id; project.startPos = start;
    project.mapTree = { mapId: hub.id, children: Object.values(project.maps).filter(m => m.id !== hub.id).map(m => ({ mapId: m.id, children: [] })) };
    project.system.monsterCampaign = { id: "monster-hunting-grounds", name: regionName, speciesIds: EXPEDITION_SPECIES.map(s => s.id),
      speciesNotes: Object.fromEntries(EXPEDITION_SPECIES.map(s => [s.id, s.description])), badges: [],
      locations: [{ mapId: hub.id, name: hubName, x: 1, y: 6, kind: "town" }, ...grounds.map((m, i) => ({ mapId: m.id, name: m.name, x: 2 + i, y: 5 - (i & 1), kind: (i === rounds - 1 ? "dungeon" : "route") as "dungeon" | "route" }))],
      objectives: [{ id: "starter", title: `${arenaName}의 ${registrarName}에게서 첫 동료를 받아라.`, switchId: "mx_starter" },
        ...grounds.slice(0, -1).map((m, i) => ({ id: `ground_${i + 1}`, title: `${m.name}을 지나 다음 사냥터로 가는 길을 열어라.`, switchId: `mx_ground_${i + 1}`, requiresSwitchId: i === 0 ? "mx_starter" : `mx_ground_${i}` })),
        { id: "rival", title: `${rivalName}과 겨뤄라.`, switchId: "mx_rival_2", requiresSwitchId: rounds >= 3 ? `mx_ground_${rounds - 2}` : "mx_starter" },
        { id: "boss", title: "마지막 사냥터의 주인을 만나 도감 탐험을 마쳐라.", switchId: "mx_ending", requiresSwitchId: "mx_rival_2" }] };
    project.endings = [{ id: "mx_ending_hunt", name: `${regionName} 도감 탐험`, conditions: [condition("mx_ending")], priority: 100,
      presentation: { tone: "warm", musicResourceId: audio.ending, credits: `${regionName}\n기획·맵·이벤트: OPRN Studio\n함께 걸어 준 모든 동료에게` } }];
    project.system.gameOver = { outcome: "recover", presentation: "blackout", title: "다시 시작할 수 있어", message: "동료들과 함께 회복 센터에서 쉬었다." };
    project.system.startActorIds = [DEFAULT_ACTOR_ID];
    project.session.partyActorIds = [DEFAULT_ACTOR_ID];
    project.session.inventory = {}; project.session.gold = 1200;
    event(hub, "opening", start, [],
      { trigger: "auto", below: true, pages: [{ id: "mx_intro_page", name: "탐험의 시작", conditions: [{ kind: "switch", switchId: "mx_intro", value: false }], graphic: invisible,
        trigger: { kind: "auto" }, priority: "below", movement: fixed, commands: [text(`${regionName}의 도감은 아직 비어 있다. 오늘은 너와 몬스터의 첫 탐험이 시작되는 날.`), text("북동쪽 연구소에서 첫 동료를 받자. 방향키로 이동, Z/Enter로 대화, X/Esc로 메뉴를 열 수 있다."), sw("mx_intro")] }] });
    finishWorld(new Set<string>(["mx_starter", "mx_rival_1", "mx_rival_2", "mx_boss", "mx_ending", ...grounds.slice(0, -1).map((_, i) => `mx_ground_${i + 1}`), ...manifest.battles.flatMap(b => b.victorySwitch ? [b.victorySwitch] : [])]));
  }

  // ── 마을: 접수 마을 하나. 회복 센터·도구점·주민의 집·접수처(연구소 방).
  const hubTemplate = options.startTheme ? START_TOWNS[options.startTheme].template : "overworld/map";
  const hubName = names.startTown ?? "접수 마을";
  const hub = make("home", hubName, hubTemplate, "town", "town", "hub");
  const lab = make("lab", expedition ? "도감 연구소" : `${arenaName} 접수처`, "rooms/lab", "town", "interior");
  const center = make("home_center", `${hubName} · 회복 센터`, "overworld/room-center", "town", "interior");
  const mart = make("home_mart", `${hubName} · 도구점`, "overworld/room-mart", "town", "interior");
  const house = make("home_house", `${hubName} · 주민의 집`, "overworld/room-house", "town", "interior");
  const doors = doorways(hub);
  const centerDoor = doors.find(d => /center|centre/.test(d.name));
  const martDoor = doors.find(d => /mart|shop/.test(d.name));
  const others = doors.filter(d => d !== centerDoor && d !== martDoor);
  const gymDoor = others.find(d => /^gym_/.test(d.name)) ?? others[1];
  const residential = [others.find(d => d !== gymDoor), gymDoor].filter((d): d is NonNullable<typeof d> => d !== undefined);
  if (!centerDoor || !martDoor || residential.length < 2) throw Error(`Hub lacks four public building entrances: ${JSON.stringify(doors)}`);
  attachRoom(hub, center, centerDoor); attachRoom(hub, mart, martDoor);
  attachRoom(hub, house, residential[0]!); attachRoom(hub, lab, residential[1]!);
  npc(center, "nurse", "센터 직원", "수고했어요. 몬스터의 체력·상태·기술 횟수를 모두 회복해 드릴게요.", { x: center.width >> 1, y: 5 },
    [{ kind: "recoverAll" }, { kind: "checkpointSave", label: `${hubName} 회복 센터` }, text("회복 완료! 메뉴에서 파티를 확인하세요.")], 3);
  npc(mart, "shop", "도구점 주인", expedition ? "포획구슬과 회복 도구를 챙겨 가세요." : "대회에서는 회복 도구가 큰 힘이 돼요. 필요한 만큼 챙겨 가세요.", { x: mart.width >> 1, y: 5 },
    [{ kind: "shop", itemIds: [...(expedition ? ["item_capture_orb"] : []), "item_potion", "item_hi_potion", "item_ether", "item_antidote", "item_wake_herb"], allowSell: true, quantityMode: "select", shopUiPreset: "pixel" }], 1);
  npc(house, "resident", "엄마", expedition ? "탐험에서 가장 중요한 건 무사히 돌아오는 일이야. 언제든 쉬어 가렴." : "경기에서 가장 중요한 건 동료들이 무사한 거야. 언제든 쉬어 가렴.", { x: 6, y: 5 }, [{ kind: "recoverAll" }], 2);
  npc(hub, "guide", expedition ? "여행 안내원" : "대회 안내원", expedition ? `${regionName}에 온 걸 환영해요. 북동쪽 건물이 연구소예요. 체육관은 없고, 북쪽 사냥터를 따라 걸으며 도감을 채우는 탐험이에요.` : `${arenaName}에 온 걸 환영해요. 북동쪽 건물에서 접수를 하고, 북쪽 연습장 길 끝이 경기장이에요. 포획은 없어요 — 가진 동료로 승부를 봅니다.`, mid(hub), [], 4);
  npc(hub, "local", "마을 주민", expedition ? "사냥터에는 마을 밖에서만 만날 수 있는 몬스터가 많대. 구슬을 넉넉히 챙겨 가렴." : "이 대회는 몬스터와 조련사가 함께 서는 무대야. 연습장에서 몸을 풀고 가렴.", { x: 3, y: 10 }, [], 1);

  if (expedition) {
    authorHuntingGrounds();
    return manifest;
  }

  // ── 연습장: 야생 몬스터와 조련사. 이긴 경험치로 대회 전에 레벨을 올린다(포획은 없다).
  const practice = make("practice", "연습장", options.startTheme ? START_ROUTES[options.startTheme]?.template ?? "overworld/route" : "overworld/route", "route", "field", "route");
  // 레벨 4 길 — 시작 동료(Lv5) 한 마리로 걸어 나가는 곳이라 야생은 Lv2~3, 연습 상대는 Lv3~4(캠페인 1번길과 같은 곡선).
  const wildPool = wild(practice, "grass", 4, options.startTheme ? START_HABITAT[options.startTheme] : undefined);
  connect(hub, practice, "mx_starter");
  for (let i = 0; i < 2; i++) {
    const at = standSpot(practice, { x: 4 + i * 8, y: 6 + i * 6 });
    const team = [wildPool[i % wildPool.length]!];
    battle(practice, `sparring_${i}`, ["연습 상대 보람", "연습 상대 가온"][i]!, at, team, 3 + i, `${practice.id}_sparring_${i}_won`,
      ["가볍게 몸 푸는 거니까 부담 갖지 마!", "본선 전에 한 번 더 맞춰 보자."][i]!, [gain("item_potion", 1), text("연습 상대가 회복약 하나를 건넸다.")]);
  }
  npc(practice, "coach", "연습장 코치", "야생 몬스터와 싸워도 경험치를 얻어요. 하지만 포획은 대회 규정상 쓰지 않습니다.", { x: 3, y: practice.height - 4 }, [{ kind: "recoverAll" }], 5);

  // ── 본선 경기장: 회전마다 방 하나. 이기면 다음 방 문이 열린다.
  const arenas = Array.from({ length: rounds }, (_, i) => make(`round_${i + 1}`,
    i === rounds - 1 ? `${arenaName} · 결승` : `${arenaName} · ${i + 1}회전`,
    i === rounds - 1 ? "rooms/league_champ" : ROUND_ARENAS[i % ROUND_ARENAS.length]!, "league", "interior"));
  const levelAt = (i: number): number => 8 + i * 4 + (i === rounds - 1 ? 2 : 0);
  const teamSize = (i: number): number => i < 2 ? 1 : i === rounds - 1 ? 3 : 2;
  connect(practice, arenas[0]!, "mx_registered");

  // ── 접수처: 박사가 아니라 접수 담당이 첫 동료를 건넨다. 구슬도 없다.
  const starterCommands: Command[] = [{ kind: "choices", prompt: "대회에 함께할 첫 동료를 고르자", options: EXPEDITION_STARTERS.map(sid => ({ text: speciesById.get(sid)!.name,
    branch: [{ kind: "giveMonster", speciesId: sid, level: 5 }, sw("mx_starter"), sw(`mx_starter_${sid}`), gain("item_potion", 5),
      text("첫 동료와 함께하게 됐다! 먼저 연습장에서 몸을 풀고, 준비가 되면 접수를 마치자.", registrarName)] })), cancelBehavior: "disallow" }];
  npc(lab, "registrar", registrarName, `${arenaName}에 온 걸 환영해요! 이 대회는 포획 없이, 데려온 동료로만 승부하는 토너먼트예요. 모두 ${rounds}번 이기면 우승입니다.`, { x: 7, y: 5 },
    [{ kind: "fork", condition: condition("mx_starter"), then: [{ kind: "fork", condition: condition("mx_registered"), then: [text("접수는 끝났어요. 북쪽 경기장으로 가세요!", registrarName)],
      else: [text("참가 접수를 마쳤어요. 연습장 길 끝 경기장에서 1회전이 열려요.", registrarName), sw("mx_registered")] }], else: starterCommands }], 5);
  battle(lab, "rival", rivalName, nearest(lab, { x: lab.width - 5, y: lab.height - 5 }, connected(lab), true), pickSpecies("", 5, undefined, 1), 5,
    "mx_rival_spar", "너도 참가자구나! 본선 전에 우리 첫 동료끼리 가볍게 겨뤄 볼래?",
    [text("결승에서 다시 만나자. 서로 끝까지 올라가는 거야.", rivalName), gain("item_potion", 2)], "mx_starter");

  for (const [i, map] of arenas.entries()) {
    const last = i === rounds - 1;
    const level = levelAt(i);
    const at = nearest(map, { x: map.width >> 1, y: 4 }, connected(map), true);
    const won = `mx_round_${i + 1}`;
    const type = ROUND_TYPES[i % ROUND_TYPES.length]!;
    let team: string[];
    try { team = pickSpecies("", level, last ? undefined : type, teamSize(i)); } catch { team = pickSpecies("", level, undefined, teamSize(i)); }
    const reward: Command[] = last
      ? [text("끝까지 동료들을 믿었구나. 이번 대회의 챔피언은 너야!", championName), { kind: "changeGold", op: "+=", amount: 3000 }, sw("mx_ending"), { kind: "checkpointSave", label: `${regionName} 우승` }, music(audio.ending), { kind: "triggerEnding", endingId: "mx_ending_tournament" }]
      : [text(`${i + 1}회전 승리! 다음 방에서 ${i + 2}회전이 열린다.`, "심판"), { kind: "changeGold", op: "+=", amount: 300 * (i + 1) }, gain("item_hi_potion", 1)];
    battle(map, "round", last ? `결승 · ${championName}` : ROUND_NAMES[i % ROUND_NAMES.length]!, at, team, level, won,
      last ? "같은 날 접수한 우리가 결승에서 만났네. 마지막 한 번, 온 마음으로 싸우자!" : ROUND_LINES[i % ROUND_LINES.length]!, reward,
      i === 0 ? "mx_registered" : `mx_round_${i}`, audio.league);
    npc(map, "waiting", "대기실 직원", i === 0 ? "경기 전에 동료들을 가다듬어 드릴게요." : "다음 경기 전에 동료들을 가다듬어 드릴게요.", { x: 3, y: map.height - 4 },
      [{ kind: "recoverAll" }, { kind: "checkpointSave", label: `${i + 1}회전 대기실` }, text("회복 완료! 행운을 빌어요.")], 3);
    if (!last) connect(map, arenas[i + 1]!, won);
    else npc(map, "return_home", "대회 안내원", "우승해도 마을은 그대로예요. 연습장에서 몸을 풀며 다음 대회를 기다려 보세요.", { x: map.width - 4, y: map.height - 4 },
      [{ kind: "fork", condition: condition("mx_ending"), then: [transfer(hub, entries.get(hub.id)!)], else: [text("먼저 결승을 치러 주세요.")] }], 4);
  }

  const start = nearest(hub, { x: 10, y: 10 }, connected(hub), true);
  project.startMapId = hub.id; project.startPos = start;
  project.mapTree = { mapId: hub.id, children: Object.values(project.maps).filter(m => m.id !== hub.id).map(m => ({ mapId: m.id, children: [] })) };
  project.system.monsterCampaign = { id: "monster-tournament", name: regionName, speciesIds: EXPEDITION_SPECIES.map(s => s.id),
    speciesNotes: Object.fromEntries(EXPEDITION_SPECIES.map(s => [s.id, s.description])),
    badges: arenas.map((_, i) => ({ id: `round_${i + 1}`, name: i === rounds - 1 ? "우승 트로피" : `${i + 1}회전 승리`, switchId: `mx_round_${i + 1}`, cityMapId: hub.id })),
    locations: [{ mapId: hub.id, name: hubName, x: 1, y: 6, kind: "town" }, { mapId: practice.id, name: practice.name, x: 2, y: 5, kind: "route" },
      ...arenas.map((m, i) => ({ mapId: m.id, name: m.name, x: 3 + i, y: 4, kind: "league" as const }))],
    objectives: [{ id: "starter", title: `${arenaName} 접수처에서 첫 동료를 받아라.`, switchId: "mx_starter" },
      { id: "register", title: "연습장에서 몸을 풀고 접수를 마쳐라.", switchId: "mx_registered", requiresSwitchId: "mx_starter" },
      ...arenas.map((_, i) => ({ id: `round_${i + 1}`, title: i === rounds - 1 ? "결승에서 챔피언에게 도전하라." : `${i + 1}회전에서 승리하라.`, switchId: `mx_round_${i + 1}`, requiresSwitchId: i === 0 ? "mx_registered" : `mx_round_${i}` })),
      { id: "champion", title: `${arenaName} 우승을 완성하라.`, switchId: "mx_ending", requiresSwitchId: `mx_round_${rounds}` }] };
  project.endings = [{ id: "mx_ending_tournament", name: `${regionName} 우승`, conditions: [condition("mx_ending")], priority: 100,
    presentation: { tone: "warm", musicResourceId: audio.ending, credits: `${regionName}\n기획·맵·이벤트: OPRN Studio\n함께 싸운 모든 동료에게` } }];
  project.system.gameOver = { outcome: "recover", presentation: "blackout", title: "다시 준비하자", message: "동료들과 함께 회복 센터에서 쉬었다." };
  project.system.startActorIds = [DEFAULT_ACTOR_ID];
  project.session.partyActorIds = [DEFAULT_ACTOR_ID];
  project.session.inventory = {}; project.session.gold = 800;
  const allSwitches = new Set<string>(["mx_starter", "mx_registered", "mx_ending", "mx_rival_spar", ...arenas.map((_, i) => `mx_round_${i + 1}`), ...manifest.battles.flatMap(b => b.victorySwitch ? [b.victorySwitch] : [])]);
  event(hub, "opening", start, [],
    { trigger: "auto", below: true, pages: [{ id: "mx_intro_page", name: "대회의 시작", conditions: [{ kind: "switch", switchId: "mx_intro", value: false }], graphic: invisible,
      trigger: { kind: "auto" }, priority: "below", movement: fixed, commands: [text(`${arenaName}가 열린다. 몬스터와 함께 토너먼트를 올라가는 날이다.`), text("북동쪽 건물에서 접수하고 첫 동료를 받자. 방향키로 이동, Z/Enter로 대화, X/Esc로 메뉴를 열 수 있다."), sw("mx_intro")] }] });
  finishWorld(allSwitches);
  return manifest;
}
