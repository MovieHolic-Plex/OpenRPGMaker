import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassableLanding } from "@/project/collision";
import { slideRuleAt } from "@/project/slideTiles";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel } from "@/project/monsterCollection";
import { charsetGraphic, demoEnemy, demoTroop } from "@/project/defaults/scarloxyDemoGame";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { EXPEDITION_AUDIO as audio } from "./audio";
import { EXPEDITION_SPECIES, EXPEDITION_STARTERS, EXPEDITION_LEGENDARIES } from "./roster";
import { EXPEDITION_TOWNS as towns, EXPEDITION_GYMS as gyms, EXPEDITION_ROUTES as routes, EXPEDITION_SIDE_AREAS as sides } from "./worldPlan";
import markerAssets from "./markers.json";
import templateData from "./mapTemplates.json";
import { expeditionEnemyActions } from "./enemyActions";
import { repairExpeditionShopPrices } from './shopPrices';
import { repairExpeditionResidents } from './residents';
import { repairExpeditionNpcLayout } from "./npcLayout";

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

export interface ExpeditionManifest {
  maps: { id: string; name: string; template: string; entry: Point; role: string }[];
  links: { from: string; to: string; eventId: string; source: Point; destination: Point; required?: string }[];
  battles: { mapId: string; eventId: string; troopId: string; level: number; victorySwitch?: string }[];
  devices: { mapId: string; eventId: string; switchId: string; cells: number }[];
}

/** Build one ordinary editor project. No game-specific gameplay engine is hidden here. */
export function authorExpeditionWorld(project: Project): ExpeditionManifest {
  for (const [aid, asset] of Object.entries(markerAssets)) project.assets.uploaded[aid] = structuredClone(asset) as Project["assets"]["uploaded"][string];
  project.maps = {};
  project.mapConnections = [];
  const manifest: ExpeditionManifest = { maps: [], links: [], battles: [], devices: [] };
  const sources = new Map<string, Template>();
  const entries = new Map<string, Point>();
  const reserved = new Map<string, Set<string>>();
  const speciesById = new Map((project.database.monsterSpecies ?? []).map(s => [s.id, s]));
  const coord = (p: Point) => `${p.x},${p.y}`;
  const reserve = (map: GameMap, p: Point) => reserved.get(map.id)!.add(coord(p));

  function make(key: string, name: string, source: string, track: keyof typeof audio, role: "town" | "field" | "interior" | "dungeon"): GameMap {
    const t = templates[source];
    if (!t) throw Error(`Missing reviewed map ingredient ${source}`);
    const map: GameMap = { id: id(key), name, width: t.width, height: t.height, tilesetId: t.tilesetId, tileSize: 16,
      lowerTiles: [...t.lower], upperTiles: [...t.upper], events: [], encounterRate: 0,
      mapRole: role, bgm: { mode: "custom", resourceId: audio[track], fadeInMs: 350 }, battleBackground: undefined };
    if (key === "ember" || key === "frost") {
      const oldWidth = map.width, insert = 6;
      const lower: number[] = [], upper: number[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < oldWidth + insert; x++) {
        if (x >= 2 && x < 2 + insert) {
          lower.push(y === 0 || y === map.height - 1 ? t.lower[y * oldWidth]! : t.names[key === "frost" ? "snow0" : "ash0"]!);
          upper.push(-1);
        } else {
          const cell = y * oldWidth + (x < 2 ? x : x - insert);
          lower.push(t.lower[cell]!); upper.push(t.upper[cell]!);
        }
      }
      map.width += insert; map.lowerTiles = lower; map.upperTiles = upper;
      stamp(map, t.buildings.find(b => b.name === "mart")!, 3, 4);
    }
    if (["grove", "dune", "moon"].includes(key)) {
      const alternatives = key === "grove" ? ["house_b", "house_e"] : key === "dune" ? ["house_d", "house_f"] : ["house_g", "house_c"];
      stamp(map, t.buildings.find(b => b.name === alternatives[0])!, 4, 3);
      stamp(map, t.buildings.find(b => b.name === alternatives[1])!, 14, 3);
    }
    project.maps[map.id] = map;
    sources.set(map.id, t);
    reserved.set(map.id, new Set());
    const gymStart = source.startsWith("gyms/") ? { x: ["grass", "ice", "dojo", "ghost"].some(k => source.endsWith(k)) ? 8 : 9, y: source.endsWith("grass") || source.endsWith("ice") ? 19 : source.endsWith("dojo") ? 18 : 17 } : undefined;
    const p = gymStart ?? nearest(map, { x: map.width >> 1, y: map.height - 2 });
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

  function connect(a: GameMap, b: GameMap, required?: string): void {
    const ca = connected(a), cb = connected(b);
    const harborExit = a.id === id("harbor") ? ({ mx_map_river: { x: 15, y: 9 }, mx_map_ship_deck: { x: 16, y: 9 }, mx_map_beach: { x: 8, y: 10 }, mx_map_sea_cave: { x: 23, y: 10 } }[b.id]) : undefined;
    const atA = harborExit ?? nearest(a, { x: a.width >> 1, y: 2 }, ca, true);
    const atB = nearest(b, { x: b.width >> 1, y: b.height - 2 }, cb, true);
    reserve(a, atA); reserve(b, atB);
    const landA = harborExit ? { x: harborExit.x, y: harborExit.y + (b.id === id("river") ? 1 : -1) } : nearest(a, { x: atA.x, y: atA.y + 1 }, ca, true);
    reserve(a, landA);
    const landB = nearest(b, { x: atB.x, y: atB.y - 1 }, cb, true);
    reserve(b, landB);
    portal(a, b, atA, landB, required); portal(b, a, atB, landA);
    // Visible, inspectable signposts explain interior route entrances.
    npc(a, `sign_${b.id}`, "길 안내", `북쪽 길: ${b.name}`, { x: atA.x + 1, y: atA.y + 1 }, [], 4);
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

  function pickSpecies(habitat: string, level: number, type?: string, count = 3): string[] {
    let pool = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && (!type || s.types.includes(type)) && (!habitat || s.habitat === habitat));
    if (!pool.length) pool = EXPEDITION_SPECIES.filter(s => s.stage > 0 && minimumLevel(s.id) <= level && (!type || s.types.includes(type)));
    if (!pool.length) throw Error(`No roster habitat/type ${habitat}/${type}`);
    const representatives = [...pool].sort((a, b) => b.stage - a.stage).filter((s, i, all) => all.findIndex(other => other.family === s.family) === i);
    return Array.from({ length: count }, (_, i) => representatives[i % representatives.length]!.id);
  }

  // 스타터 계통은 초반 풀숲에 나오지 않는다 — 1번길에서 풀 스타터가 같은 풀 스타터를 만나 반감 기술로 서로 2씩 깎다 졌다(2026-10-06).
  const starterFamilies = new Set(EXPEDITION_SPECIES.filter(s => (EXPEDITION_STARTERS as readonly string[]).includes(s.id)).map(s => s.family));
  const neighbourHabitat: Record<string, string> = { grass: "forest", coast: "swamp" };

  function wild(map: GameMap, habitat: string, level: number): void {
    const fits = (s: (typeof EXPEDITION_SPECIES)[number]) => s.stage > 0 && minimumLevel(s.id) <= level - 2 && (level >= 20 || !starterFamilies.has(s.family));
    let pool = EXPEDITION_SPECIES.filter(s => s.habitat === habitat && fits(s)).map(s => s.id);
    // 스타터를 빼고 한 종만 남으면 이웃 서식지의 첫 단계 종을 빌려 온다(풀숲에 벌레가 섞이듯).
    if (pool.length < 2 && neighbourHabitat[habitat]) pool = [...pool, ...EXPEDITION_SPECIES.filter(s => s.habitat === neighbourHabitat[habitat] && s.stage === 1 && fits(s)).map(s => s.id)];
    map.encounterRate = 14;
    // Named habitats prevent encounters on the transport/entry row and indoor surfaces.
    map.locations = [{ id: `${map.id}_habitat`, name: "몬스터 서식지", x: 1, y: 3, w: map.width - 2, h: map.height - 6 }];
    // 첫 길은 Lv5 스타터 한 마리로 걸어 나가는 곳이라 야생을 두세 레벨 아래로 둔다.
    // 첫 종만 Lv3, 나머지는 Lv2 — Lv3 벌레는 벌레 기술을 배워 풀 스타터를 두 배로 때린다.
    const wildLevel = (i: number) => level <= 6 ? Math.max(2, level - (i === 0 ? 1 : 2)) : Math.max(3, level - i % 3);
    map.encounterTable = pool.map((speciesId, i) => ({ troopId: troop(`야생의 ${speciesById.get(speciesId)!.name}`, `${map.id}_wild_${i}`, [speciesId], wildLevel(i), false),
      weight: i < 3 ? 5 : 2, conditions: { locationId: `${map.id}_habitat`, switchId: "mx_starter" } }));
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

  function townFor(map: GameMap): string {
    return towns.find(t => map.id.startsWith(id(t.key)))?.key ?? routes.find(r => id(r.key) === map.id)?.from ?? sides.find(s => id(s.key) === map.id)?.town ?? ({ mx_map_hideout: "prism", mx_map_observatory: "summit", mx_map_lab: "home", mx_map_museum: "prism", mx_map_school: "home" }[map.id] ?? (map.id.startsWith("mx_map_league_") ? "summit" : "home"));
  }

  const townMaps = new Map(towns.map(t => [t.key, make(t.key, t.name, t.template, t.music, "town")]));
  const gymMaps = new Map(gyms.map(g => [g.town, make(`${g.town}_gym`, g.name, `gyms/gym_${g.key}`, "gym", "interior")]));
  const lab = make("lab", "천문박사의 연구소", "rooms/lab", "town", "interior");
  const museum = make("museum", "별의 역사 박물관", "rooms/museum", "town", "interior");
  const school = make("school", "조련사 학교", "rooms/school", "town", "interior");
  const hideout = make("hideout", "밤막회사 · 별빛 연구소", "dungeon/hideout", "cave", "dungeon");
  const observatory = make("observatory", "옛 별 관측탑", "dungeon/ruins", "league", "dungeon");
  const leagueKeys = ["ice", "ghost", "dark", "dragon", "champ"] as const;
  const league = leagueKeys.map((key, i) => make(`league_${i}`, i < 4 ? `별빛 리그 · 사천왕 ${i + 1}` : "별빛 리그 · 챔피언", `rooms/league_${key}`, "league", "interior"));

  for (const [i, t] of towns.entries()) {
    const map = townMaps.get(t.key)!;
    const center = make(`${t.key}_center`, `${t.name} · 회복 센터`, "overworld/room-center", "town", "interior");
    const mart = make(`${t.key}_mart`, `${t.name} · 도구점`, "overworld/room-mart", "town", "interior");
    const home = make(`${t.key}_house`, `${t.name} · 주민의 집`, "overworld/room-house", "town", "interior");
    const doors = doorways(map);
    const centerDoor = doors.find(d => /center|centre/.test(d.name));
    const martDoor = doors.find(d => /mart|shop/.test(d.name));
    const residential = doors.filter(d => d !== centerDoor && d !== martDoor);
    if (!centerDoor || !martDoor || residential.length < 2) throw Error(`Current references lack four public building entrances in ${map.id}: ${JSON.stringify(doors)}`);
    attachRoom(map, center, centerDoor); attachRoom(map, mart, martDoor);
    attachRoom(map, home, residential[0]!); attachRoom(map, i === 0 ? lab : gymMaps.get(t.key as Exclude<typeof t.key, "home">)!, residential[1]!);
    npc(center, "nurse", "센터 직원", "수고했어요. 몬스터의 체력·상태·기술 횟수를 모두 회복해 드릴게요.", { x: center.width >> 1, y: 5 },
      [{ kind: "recoverAll" }, { kind: "checkpointSave", label: `${t.name} 회복 센터` }, text("회복 완료! 메뉴에서 파티와 보관함을 관리할 수 있어요.")], 3);
    npc(mart, "shop", "도구점 주인", "포획구슬과 회복 도구를 챙겨 가세요. 약은 메뉴에서 몬스터를 골라 사용할 수 있어요.", { x: mart.width >> 1, y: 5 },
      [{ kind: "shop", itemIds: ["item_capture_orb", "item_potion", "item_hi_potion", "item_ether", "item_antidote", "item_wake_herb"], allowSell: true, quantityMode: "select", shopUiPreset: "pixel" }], 1);
    npc(home, "resident", i === 0 ? "엄마" : "마을 주민", i === 0 ? "모험에서 가장 중요한 건 무사히 돌아오는 일이야. 언제든 쉬어 가렴." : t.flavor, { x: 6, y: 5 },
      [{ kind: "recoverAll" }, { kind: "fork", condition: { kind: "item", itemId: "item_capture_orb", present: false }, then: [gain("item_capture_orb", 3), text("구슬을 다 썼구나. 다시 시작할 수 있게 세 개를 챙겨 줄게.")] }], 2);
    npc(map, "guide", "여행 안내원", `${t.name}에 온 걸 환영해요. ${i === 0 ? "북동쪽 집이 천문박사의 연구소예요." : "북동쪽 건물에서 지역의 관장에게 도전할 수 있어요."} 북쪽의 안내원이 다음 길을 알려 줍니다.`, mid(map), [], 4);
    npc(map, "local", "마을 주민", t.flavor, { x: 3, y: 10 }, [], i % 8);
    // Return travel is earned by reaching a town, with no permanent progress rollback.
    event(map, "visit", entries.get(map.id)!, [sw(`mx_visit_${t.key}`)], { trigger: "auto", below: true,
      pages: [{ id: `${map.id}_visit_done`, name: "방문 기록", conditions: [{ kind: "switch", switchId: `mx_visit_${t.key}`, value: false }], graphic: invisible, movement: fixed, priority: "below", trigger: { kind: "auto" }, commands: [sw(`mx_visit_${t.key}`)] }] });
  }

  for (const r of routes) {
    const map = make(r.key, r.name, r.template, r.music, "field");
    wild(map, r.habitat, r.level);
    connect(townMaps.get(r.from)!, map, r.required);
    connect(map, townMaps.get(r.to)!);
    for (let i = 0; i < 3; i++) {
      const at = nearest(map, { x: 3 + i * 7, y: 6 + i * 8 }, connected(map), true);
      battle(map, `trainer_${i}`, ["산책하는 소년", "연구원", "길을 걷는 조련사"][i]!, at, pickSpecies(r.habitat, r.level + 1, undefined, i === 2 ? 2 : 1), r.level + i,
        `${map.id}_trainer_${i}_won`, ["우리 동료들이 자라는 모습을 봐 줘!", "타입 상성만큼 기술 횟수도 중요하지.", "먼 길을 걸었으니 서로 실력을 확인하자."][i]!, [gain("item_potion", 1), text("여행에 쓰라고 회복약 하나를 건네받았다.")]);
    }
    npc(map, "trail_sign", "지역 안내", `${r.name}. 야생 몬스터는 포획할 수 있지만 조련사의 몬스터는 포획할 수 없습니다. 길을 걷기 전에 체력과 기술 PP를 확인하세요.`, { x: 3, y: map.height - 4 }, [], 4);
  }

  for (const s of sides) {
    const map = make(s.key, s.name, s.template, s.music, "dungeon");
    wild(map, s.habitat, s.level);
    connect(townMaps.get(s.town)!, map, "mx_starter");
    npc(map, "researcher", "서식지 연구원", `${s.name}에는 길에서 만나기 힘든 몬스터가 살아요. 도감에 빈칸이 있다면 천천히 탐색해 보세요.`, s.key === "beach" ? { x: 14, y: 32 } : { x: 2, y: map.height - 4 }, [], 5);
    const at = nearest(map, { x: map.width - 4, y: 5 }, connected(map), true);
    const flag = `${map.id}_treasure`;
    event(map, "treasure", at, [{ kind: "fork", condition: condition(flag), then: [text("빈 보관함이다.")], else: [gain("item_capture_orb", 3), gain("item_hi_potion", 1), sw(flag), text("포획구슬 세 개와 고급 회복약을 찾았다!")] }], { below: true, graphic: marker("chest") });
  }

  connect(townMaps.get("home")!, school);
  connect(townMaps.get("prism")!, museum, "mx_badge_3");
  connect(townMaps.get("prism")!, hideout, "mx_badge_4");
  connect(townMaps.get("summit")!, observatory, "mx_badge_8");
  connect(townMaps.get("summit")!, league[0]!, "mx_story_beacon");

  const starterCommands: Command[] = [{ kind: "choices", prompt: "첫 동료를 선택하자", options: EXPEDITION_STARTERS.map(sid => ({ text: speciesById.get(sid)!.name,
    branch: [{ kind: "giveMonster", speciesId: sid, level: 5 }, sw("mx_starter"), sw(`mx_starter_${sid}`), gain("item_capture_orb", 10), gain("item_potion", 5),
      text("첫 동료와 만났다! 야생 전투에서는 「가방」의 포획구슬을 사용해 보렴.", "천문박사"), text("여덟 지역의 약속을 모아, 빛을 잃어 가는 별의 등대를 다시 밝혀 주었으면 한단다.", "천문박사")] })), cancelBehavior: "disallow" }];
  npc(lab, "professor", "천문박사", "몬스터들은 오래전부터 별빛섬의 여덟 등불을 지켜 왔단다. 밤막회사가 빛을 가져가면서 섬의 균형이 무너지고 있어.", { x: 7, y: 5 },
    [{ kind: "fork", condition: condition("mx_starter"), then: [text("메뉴의 「도감」에서 만난 동료를, 「배지」에서 현재 목표를 볼 수 있단다. 여덟 관장의 약속을 모아 보렴.", "천문박사")], else: starterCommands }], 5);
  npc(school, "teacher", "선생님", "싸운다 → 기술 선택 → 상대 선택. 몬스터가 쓰러지면 교체해야 해요. 포획은 상대 체력을 낮춘 뒤 시도해 보세요. 메뉴의 몬스터 화면에서는 보관함 이동과 새 기술 교체도 할 수 있어요.", { x: 7, y: 5 }, [{ kind: "fork", condition: condition("mx_school_gift"), then: [], else: [gain("item_potion", 1), sw("mx_school_gift")] }], 5);
  npc(museum, "curator", "학예사", "별빛은 섬의 생명을 빼앗아 만드는 에너지가 아니에요. 여덟 지역이 서로 돌볼 때 생겨나는 빛이지요. 밤막회사는 그 뜻을 잊었습니다.", { x: 9, y: 5 }, [], 5);

  for (const [key, level, count, required] of [["lab", 5, 1, "mx_starter"], ["prism", 24, 3, "mx_badge_3"], ["summit", 46, 4, "mx_badge_7"]] as const) {
    const map = project.maps[id(key)]!;
    battle(map, "rival", "나루", nearest(map, { x: map.width - 5, y: map.height - 5 }, connected(map), true), pickSpecies("", level, undefined, count), level,
      `mx_rival_${key}`, key === "lab" ? "우리도 같은 날 출발하는구나! 첫 동료와 짧게 겨뤄 볼래?" : "다른 길을 걸었어도 같은 별을 보고 있었네. 지금의 우리를 확인하자!",
      [text("리그에서 다시 만나자. 서로 끝까지 동료들을 지키는 거야.", "나루"), gain("item_capture_orb", 3)], required);
  }

  // All gym devices mutate real map tiles. Their switch journals survive save/load.
  for (const [i, g] of gyms.entries()) {
    const map = gymMaps.get(g.town)!;
    const base = sources.get(map.id)!;
    const done = templates[`gyms/gym_${g.key}_after`];
    const puzzleSwitch = `mx_gym_${i + 1}_puzzle`;
    const changes: Command[] = [];
    if (!["psychic", "ice"].includes(g.key) && !done) throw Error(`Missing authored device state ${g.key}`);
    if (done) for (let cell = 0; cell < map.width * map.height; cell++) for (const layer of ["lower", "upper"] as const) {
      if (base[layer][cell] !== done[layer][cell]) changes.push({ kind: "changeTile", mapId: map.id, layer, x: cell % map.width, y: Math.floor(cell / map.width), tile: done[layer][cell]! });
    }
    if (g.key === "psychic") {
      for (const digit of "12345678") {
        const pair = base.marks![digit]!;
        for (const [j, cell] of pair.entries()) {
          const target = pair[1 - j]!;
          event(map, `warp_${digit}_${j}`, { x: cell[0]!, y: cell[1]! }, [sw(puzzleSwitch), { kind: "transfer", mapId: map.id, x: target[0]!, y: target[1]!, fade: "black" }], { trigger: "playerTouch", below: true });
        }
      }
    } else if (g.key === "ice") {
      for (const [j, cell] of (base.marks?.x ?? []).entries()) event(map, `crack_${j}`, { x: cell[0]!, y: cell[1]! },
        [text("얼음이 갈라졌다! 입구에서 다시 발판을 살펴보자."), transfer(map, entries.get(map.id)!)], { trigger: "playerTouch", below: true });
      // The engine's authored slideTiles implements the ice travel itself.
    } else {
      if (!changes.length) throw Error(`Empty authored device state ${g.key}`);
      type Device = { key: string; at: Point; title: string; question: string; yes: string; no: string; changes: Command[] };
      const at = (x: number, y: number) => ({ x, y });
      const split = (predicate: (c: Command) => boolean) => changes.filter(predicate);
      const devices: Device[] = g.key === "grass" ? [
        // Keep the operator south of the cells that become the rotating barrier.
        { key: "pivot", at: at(8,17), title: "회전 손잡이", question: "손잡이를 돌려 회전문의 방향을 바꿀까?", yes: "돌린다", no: "그대로 둔다", changes: split(c => c.kind === "changeTile" && c.y > 10) },
        { key: "cut", at: at(12,6), title: "얽힌 가지", question: "비치된 정원 가위로 길을 덮은 가지를 정리할까?", yes: "가지를 정리한다", no: "나중에", changes: split(c => c.kind === "changeTile" && c.y <= 10) }
      ] : g.key === "fire" ? [
        { key: "quiz_1", at: at(7,15), title: "화로 퀴즈 1", question: "물 타입 기술은 불꽃 타입에게 효과적인가?", yes: "효과적이다", no: "효과가 없다", changes: split(c => c.kind === "changeTile" && c.x < 10) },
        { key: "quiz_2", at: at(9,9), title: "화로 퀴즈 2", question: "풀 타입 동료가 불꽃 기술을 맞으면 피해가 커지는가?", yes: "피해가 커진다", no: "피해가 줄어든다", changes: split(c => c.kind === "changeTile" && c.x >= 10) }
      ] : g.key === "dragon" ? [
        { key: "boulder_1", at: at(9,8), title: "둥근 바위", question: "북쪽 틈으로 바위를 밀어 발판을 만들까?", yes: "북쪽으로 민다", no: "기다린다", changes: split(c => c.kind === "changeTile" && c.x < 11) },
        { key: "boulder_2", at: at(13,9), title: "두 번째 바위", question: "서쪽 틈으로 바위를 밀어 발판을 만들까?", yes: "서쪽으로 민다", no: "기다린다", changes: split(c => c.kind === "changeTile" && c.x >= 11) }
      ] : [{ key: "main", at: g.key === "water" ? at(1,10) : g.key === "ghost" ? at(1,2) : at(6,15),
        title: g.key === "water" ? "수로 밸브" : g.key === "ghost" ? "기억의 문양" : "격파 수련판",
        question: g.key === "water" ? "밸브를 열어 징검돌을 띄울까?" : g.key === "ghost" ? "문양에 등불을 놓아 숨은 다리를 밝힐까?" : "동료와 함께 수련판을 격파할까?",
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
    if (g.key === "fire") {
      // Lower vent mouths are falls; the upper steam plume is only artwork.
      for (const [j, cell] of (base.marks?.v ?? []).entries()) event(map, `vent_${j}`, { x: cell[0]!, y: cell[1]! },
        [text("증기 구멍으로 미끄러졌다! 입구에서 안전한 발판을 찾아보자."), transfer(map, entries.get(map.id)!)], { trigger: "playerTouch", below: true });
    }
    const leader = { x: base.leader![0]!, y: base.leader![1]! };
    if (g.key === "ice") event(map, "ice_reached", { x: leader.x, y: leader.y + 1 }, [sw(puzzleSwitch)], { trigger: "playerTouch", below: true });
    battle(map, "leader", g.leader, leader, pickSpecies("", g.level, g.type, i < 3 ? 2 : 3), g.level, `mx_badge_${i + 1}`, g.before,
      [text(g.after, g.leader), { kind: "changeGold", op: "+=", amount: (i + 1) * 600 }, gain("item_hi_potion", 2), text(`${g.badge}를 받았다! 다음 길이 열렸다.`)], puzzleSwitch, audio.trainerBattle);
    const leaderEvent = map.events.find(e => e.id.endsWith("_leader"))!;
    const previous = i === 0 ? "mx_starter" : `mx_badge_${i}`;
    const body = leaderEvent.pages![0]!.commands;
    leaderEvent.pages![0]!.commands = [{ kind: "fork", condition: condition(previous), then: body, else: [text("먼저 앞 지역 관장의 약속을 받아 와 주세요.", g.leader)] }];
    npc(map, "gym_guide", "체육관 안내원", g.key === "psychic" ? "같은 무늬의 워프 판은 서로 이어집니다. 돌아온 방의 다른 판을 찾아보세요." : g.key === "ice" ? "얼음 위에서는 벽이나 바위에 닿을 때까지 미끄러집니다. 금 간 얼음은 피하세요." : g.key === "fire" ? "퀴즈 기계 둘을 풀면 셔터가 열립니다. 증기 구멍을 밟으면 입구로 돌아가니 벽돌 발판으로 돌아가세요." : "장치를 조작하면 관장에게 가는 길이 열립니다. 밸브, 문양, 수련판, 바위 앞에서 확인 버튼을 누르세요.", { x: 2, y: map.height - 3 }, [], 4);
  }

  for (const [i, wanted] of [{ x: 4, y: hideout.height - 5 }, { x: hideout.width - 5, y: 7 }].entries()) {
    battle(hideout, `company_${i}`, "밤막회사 연구원", nearest(hideout, wanted, connected(hideout), true), pickSpecies("ruins", 24, undefined, 2), 24,
      `mx_company_${i}`, "허가받지 않은 출입은 금지다. 회사의 실험을 방해하지 마라!", [text("저들은 몬스터들을 자원으로만 보고 있어… 위쪽 실험실에서 장치를 멈추자.")], i === 0 ? "mx_badge_4" : "mx_company_0");
  }
  const rescueAt = nearest(hideout, { x: hideout.width >> 1, y: 3 }, connected(hideout), true);
  battle(hideout, "boss", "밤막회사 지부장 · 서준", rescueAt, pickSpecies("ruins", 26, undefined, 3), 26, "mx_story_rescue",
    "섬의 빛은 효율적인 자원이야. 몬스터들의 마음 같은 건 계산에 넣지 않아!",
    [text("연구 장치의 전원을 끄자 갇힌 몬스터들이 풀려났다. 박사의 연구 기록도 되찾았다."), gain("item_capture_orb", 10), text("이제 프리즘 시티의 서쪽, 유리모래 사막으로 갈 수 있다.")], "mx_company_1");
  const finaleAt = nearest(observatory, { x: observatory.width >> 1, y: 3 }, connected(observatory), true);
  battle(observatory, "boss", "밤막회사 대표 · 무영", finaleAt, pickSpecies("", 50, undefined, 4), 50, "mx_story_beacon",
    "세상이 흔들려도 빛만 모으면 내가 질서를 만들 수 있어. 그 여덟 약속으로 나를 막아 보아라!",
    [text("여덟 배지의 빛과 동료들의 울음이 하나로 모였다. 오래된 등대가 다시 별빛섬을 비추기 시작했다."), text("빛은 누군가의 소유가 아니었어. 이제… 나도 섬을 다시 배워야겠군.", "무영"), { kind: "recoverAll" }, text("별빛 리그의 문이 열렸다. 용마루 시티에서 마지막 도전을 시작하자.")], "mx_badge_8", audio.league);

  for (const [i, map] of league.entries()) {
    const type = ["ice", "ghost", "fighting", "dragon", undefined][i];
    const at = nearest(map, { x: map.width >> 1, y: 4 }, connected(map), true);
    const won = `mx_league_${i + 1}`;
    const reward: Command[] = [text(i < 4 ? "다음 방에서 더 큰 도전이 기다리고 있다." : "끝까지 동료들을 믿었구나. 이제 별빛섬의 챔피언은 너야!", i === 4 ? "나루" : "사천왕")];
    if (i === 4) reward.push(sw("mx_ending"), { kind: "checkpointSave", label: "별빛섬 챔피언" }, music(audio.ending), { kind: "triggerEnding", endingId: "mx_ending_starlight" });
    battle(map, "league_challenge", ["사천왕 · 서리", "사천왕 · 등불", "사천왕 · 기백", "사천왕 · 용빛", "챔피언 · 나루"][i]!, at,
      pickSpecies("", 50 + i * 2, type, i === 4 ? 6 : 4), 50 + i * 2, won, i === 4 ? "같은 마을에서 출발한 우리가 여기서 다시 만났네. 마지막 한 번, 온 마음으로 싸우자!" : "여덟 지역의 약속을 지닌 여행자여, 리그의 시련을 받아라!", reward,
      i === 0 ? "mx_story_beacon" : `mx_league_${i}`, audio.league);
    if (i < league.length - 1) connect(map, league[i + 1]!, won);
    else npc(map, "return_home", "리그 안내원", "챔피언이 되어도 모험은 계속됩니다. 고향으로 돌아가 희귀 몬스터와 도감을 탐험해 보세요.", { x: 3, y: map.height - 4 },
      [{ kind: "fork", condition: condition("mx_ending"), then: [transfer(townMaps.get("home")!, entries.get(id("home"))!)], else: [text("먼저 챔피언에게 도전해 주세요.")] }], 4);
  }

  const deck = make("ship_deck", "별바람호 · 갑판", "rooms/ship_deck", "coast", "interior");
  const corridor = make("ship_corridor", "별바람호 · 복도", "rooms/ship_corridor", "coast", "interior");
  const cabin = make("ship_cabin", "별바람호 · 선실", "rooms/ship_cabin", "coast", "interior");
  connect(townMaps.get("harbor")!, deck, "mx_badge_2"); connect(deck, corridor); connect(corridor, cabin);
  npc(cabin, "captain", "별바람호 선장", "한 번 방문한 마을로 데려다줄게. 돌아가는 길에서도 새 친구를 만날 수 있지.", { x: 4, y: 4 },
    [{ kind: "choices", prompt: "어디로 갈까?", options: [{ text: "서쪽 지역", branch: [{ kind: "choices", options: towns.slice(0, 5).map(t => ({ text: t.name, branch: [{ kind: "fork", condition: condition(`mx_visit_${t.key}`),
      then: [transfer(townMaps.get(t.key)!, entries.get(id(t.key))!)], else: [text("아직 방문하지 않은 마을이야. 먼저 육로로 길을 열어 줘.", "선장")] }] })), cancelBehavior: "branch", cancelBranch: [] }] }, { text: "동쪽 지역", branch: [{ kind: "choices", options: towns.slice(5).map(t => ({ text: t.name, branch: [{ kind: "fork", condition: condition(`mx_visit_${t.key}`), then: [transfer(townMaps.get(t.key)!, entries.get(id(t.key))!)], else: [text("아직 방문하지 않은 마을이야.", "선장")] }] })), cancelBehavior: "branch", cancelBranch: [] }] }], cancelBehavior: "branch", cancelBranch: [] }], 7);

  for (const [i, sid] of EXPEDITION_LEGENDARIES.entries()) {
    const record = EXPEDITION_SPECIES.find(s => s.id === sid)!;
    const candidates = Object.values(project.maps).filter(m => sources.get(m.id)?.tilesetId && (sides.find(s => id(s.key) === m.id)?.habitat === record.habitat));
    const map = candidates[0] ?? observatory;
    const at = nearest(map, { x: map.width - 4, y: 4 + i }, connected(map), true);
    const tid = troop(`희귀 몬스터 · ${record.name}`, `legendary_${i}`, [sid], 55, false);
    const caught = `mx_legendary_${i}_encountered`;
    event(map, `legendary_${i}`, at, [{ kind: "fork", condition: condition("mx_ending"), then: [{ kind: "fork", condition: condition(caught), then: [text("별빛의 흔적이 남아 있다. 이 몬스터는 주변 서식지에서도 아주 드물게 나타난다.")], else: [text(`${record.name}이 별빛을 따라 모습을 드러냈다!`),
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
    badges: gyms.map((g, i) => ({ id: `badge_${i + 1}`, name: g.badge, switchId: `mx_badge_${i + 1}`, cityMapId: id(g.town) })),
    locations: [...towns.map(t => ({ mapId: id(t.key), name: t.name, x: t.x, y: t.y, kind: "town" as const })),
      ...routes.map((r, i) => ({ mapId: id(r.key), name: r.name, x: (towns[i]!.x + towns[i + 1]!.x) / 2, y: (towns[i]!.y + towns[i + 1]!.y) / 2, kind: "route" as const })),
      { mapId: observatory.id, name: observatory.name, x: 4, y: 2, kind: "dungeon" }, { mapId: league[0]!.id, name: "별빛 리그", x: 4, y: 0, kind: "league" }],
    objectives: [{ id: "starter", title: "별싹 마을 북동쪽 연구소에서 천문박사와 첫 동료를 만나라.", switchId: "mx_starter" },
      ...gyms.flatMap((g, i) => [ ...(i === 4 ? [{ id: "rescue", title: "프리즘 시티의 별빛 연구소에서 갇힌 몬스터를 구하라.", switchId: "mx_story_rescue", requiresSwitchId: "mx_badge_4" }] : []),
        { id: `gym_${i + 1}`, title: `${towns[i + 1]!.name}의 ${g.name}에서 ${g.badge}를 받아라.`, switchId: `mx_badge_${i + 1}`, requiresSwitchId: i === 0 ? "mx_starter" : i === 4 ? "mx_story_rescue" : `mx_badge_${i}` } ]),
      { id: "beacon", title: "용마루 시티의 옛 별 관측탑에서 밤막회사를 막고 등대를 복구하라.", switchId: "mx_story_beacon", requiresSwitchId: "mx_badge_8" },
      { id: "league", title: "별빛 리그의 사천왕과 챔피언 나루에게 도전하라.", switchId: "mx_ending", requiresSwitchId: "mx_story_beacon" }] };
  project.endings = [{ id: "mx_ending_starlight", name: "여덟 빛의 약속", conditions: [condition("mx_ending")], priority: 100,
    presentation: { tone: "warm", musicResourceId: audio.ending, credits: "별빛섬 몬스터 원정\n기획·맵·이벤트: OPRN Studio\n몬스터·타일·음악: 오리지널 좌표 도트와 작곡\n함께 걸어 준 모든 동료에게" } }];
  // 야생에게 지면 원작처럼 마지막으로 들른 회복 센터(직원의 checkpointSave)에서 깨어난다. 들른 적이 없으면 집.
  project.system.gameOver = { outcome: "recover", presentation: "blackout", title: "다시 시작할 수 있어", message: "동료들과 함께 회복 센터에서 쉬었다." };
  project.system.startActorIds = [DEFAULT_ACTOR_ID];
  project.session.partyActorIds = [DEFAULT_ACTOR_ID];
  project.system.sellPrices = [...(project.system.sellPrices ?? []).filter(p => p.itemId !== "item_capture_orb"), { itemId: "item_capture_orb", price: 0 }];
  project.session.inventory = {}; project.session.gold = 1600;
  project.session.switches = Object.fromEntries(project.switches.map(s => [s.id, false]));
  const allSwitches = new Set<string>(["mx_starter", "mx_story_rescue", "mx_story_beacon", "mx_ending", ...towns.map(t => `mx_visit_${t.key}`),
    ...gyms.flatMap((_, i) => [`mx_badge_${i + 1}`, `mx_gym_${i + 1}_puzzle`]), ...manifest.battles.flatMap(b => b.victorySwitch ? [b.victorySwitch] : [])]);
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
  repairExpeditionNpcLayout(project);
  repairExpeditionResidents(project);
  repairExpeditionShopPrices(project);
  return manifest;
}
