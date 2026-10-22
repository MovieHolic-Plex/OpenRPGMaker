// expand_jrpg_campaign_volume — 마을 하나에 JRPG 한 고장 분량을 덧붙인다(jrpg-loop-4 R6 「게임 볼륨을 넓혀라」).
//   1) 마을 집 문(구조 키트 parts.door) ↔ 손 도트 실내(atlas_biome_interior): 여관(숙박)·무기점(상점)·장로의 집(대화+상자)
//   2) 마을 가장자리 ↔ 가도(author_wild_route): 순찰하는 보이는 적·필드 조우·길가 상자, 시대 모습(look)이면 땅·숲·조명까지 그 시대로
//   3) 가도 끝 ↔ 던전(author_dungeon): 계획된 자리의 보이는 적·상자, 보스 직전 방의 중간 보스, 보스방의 수호자
// 새 규칙을 만들지 않는다 — 자리·착지·봉쇄 검사는 create_transfer_pair, 실내는 build_hand_interior_room, 적은 place_field_enemy 가 한다.
// 이 파일은 그 도구들을 순서대로 부르고, 이벤트가 길을 막지 않는 칸(지워도 닿는 칸 수가 하나만 주는 칸)만 고른다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { applyVariantLook, VARIANT_LOOKS, type VariantLook } from "./mapVariantLook";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export type Cell = { readonly x: number; readonly y: number };
type Role = "inn" | "shop" | "elder";
export type Room = { readonly id: string; readonly kind: string; readonly from: string | null; readonly spots: Cell[] };

// 하위 도구의 data 는 unknown 이다 — 쓰는 필드만 좁혀 읽는다.
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
export const field = (v: unknown, k: string): unknown => (isRec(v) ? v[k] : undefined);
export const list = (v: unknown, k: string): unknown[] => { const got = field(v, k); return Array.isArray(got) ? got : []; };
export const text = (v: unknown, k: string): string | undefined => { const got = field(v, k); return typeof got === "string" ? got : undefined; };
export const num = (v: unknown, k: string): number | undefined => { const got = field(v, k); return typeof got === "number" ? got : undefined; };
export function asCell(v: unknown): Cell | undefined {
  const x = num(v, "x"), y = num(v, "y");
  return x === undefined || y === undefined ? undefined : { x, y };
}
export function asRoom(v: unknown): Room | undefined {
  const id = text(v, "id"), kind = text(v, "kind");
  if (!id || !kind) return undefined;
  return { id, kind, from: text(v, "from") ?? null, spots: list(v, "spots").map(asCell).filter((c): c is Cell => !!c) };
}
const isLook = (v: unknown): v is VariantLook => typeof v === "string" && (VARIANT_LOOKS as readonly string[]).includes(v);

// toolRegistry 가 이 파일을 모으므로 레지스트리를 직접 import 하면 순환이다 — 레지스트리가 만들어진 뒤 조회 함수를 꽂는다(themeScenes 와 같은 방식).
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindJrpgVolumeToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

export function nested(draft: Project, name: string, args: Record<string, unknown>): ToolExecResult {
  const tool = lookup(name);
  if (!tool) throw new ToolError(`${name} 도구를 찾을 수 없습니다.`, { code: "tool-missing" });
  return tool.run(draft, args);
}

/** 순찰하는 보이는 적 — 그 자리에 왕복할 직선 통로가 어느 축에도 없으면(unsafe-patrol) 제자리 적으로 둔다. */
export function placeRoamer(draft: Project, args: Record<string, unknown>, vertical: boolean): void {
  for (const axis of vertical ? ["vertical", "horizontal"] : ["horizontal", "vertical"]) {
    try { nested(draft, "place_field_enemy", { ...args, patrol: { length: 2, axis } }); return; }
    catch (error) { if (!(error instanceof ToolError) || error.code !== "unsafe-patrol") throw error; }
  }
  nested(draft, "place_field_enemy", { ...args, behavior: "stationary" });
}

const ROLE_PROGRAM: Record<Role, string> = { inn: "inn", shop: "smithy", elder: "scholar" };
const ROLE_LABEL: Record<Role, string> = { inn: "여관", shop: "무기·도구점", elder: "장로의 집" };
const ROLE_NPC: Record<Role, { readonly name: string; readonly query: string }> = {
  inn: { name: "여관 주인", query: "젊은 여성" },
  shop: { name: "무기점 주인", query: "중년 남성 주민" },
  elder: { name: "장로", query: "대머리 남성 주민" },
};
const DUNGEON_BY_LOOK: Record<VariantLook | "none", string> = { none: "cave", past: "temple", ruin: "catacomb", future: "castle" };

const key = (c: Cell): string => `${c.x},${c.y}`;
const inside = (map: GameMap, c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
const NEIGHBORS: readonly Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

function eventCells(map: GameMap): Set<string> {
  return new Set((map.events ?? []).map((e) => key(e)));
}

/** origin 에서 걸어서 닿는 칸 → 걸음 수. blocked 칸(이벤트·새로 고른 칸)은 밟지 않는다. */
function distances(project: Project, map: GameMap, origin: Cell, blocked: ReadonlySet<string>): Map<string, number> {
  const dist = new Map<string, number>([[key(origin), 0]]);
  const queue: Cell[] = [origin];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    const d = dist.get(key(at))!;
    for (const n of NEIGHBORS) {
      const next = { x: at.x + n.x, y: at.y + n.y };
      const k = key(next);
      if (!inside(map, next) || dist.has(k) || blocked.has(k) || !isPassable(project, map, next.x, next.y)) continue;
      dist.set(k, d + 1);
      queue.push(next);
    }
  }
  return dist;
}

/**
 * origin 에서 닿는 칸 중 rank(0=가까움, 1=가장 먼 곳) 근처의, 막아도 다른 칸이 끊기지 않는 칸.
 * 문·출입구 이벤트 옆, 맵 가장자리는 고르지 않는다.
 */
export function pickSpot(project: Project, map: GameMap, origin: Cell, taken: Set<string>, rank: number, minDist = 2): Cell | undefined {
  const blocked = new Set([...eventCells(map), ...taken]);
  const dist = distances(project, map, origin, blocked);
  const base = dist.size;
  const nearEvent = (c: Cell): boolean => (map.events ?? []).some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1);
  const candidates = [...dist.entries()]
    .map(([k, d]) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y!, d }; })
    .filter((c) => c.d >= minDist && c.x > 0 && c.y > 0 && c.x < map.width - 1 && c.y < map.height - 1 && !nearEvent(c))
    .sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  if (!candidates.length) return undefined;
  const start = Math.min(candidates.length - 1, Math.round(rank * (candidates.length - 1)));
  // start 에서 바깥쪽으로 번갈아 훑는다.
  for (let step = 0; step < candidates.length; step++) {
    const index = step % 2 === 0 ? start + step / 2 : start - (step + 1) / 2;
    const c = candidates[index];
    if (!c) continue;
    const trial = new Set([...blocked, key(c)]);
    if (distances(project, map, origin, trial).size !== base - 1) continue;
    taken.add(key(c));
    return { x: c.x, y: c.y };
  }
  return undefined;
}

/** 맵에서 가장 큰 걸음 덩이(시작·착지가 있는 마을 본체). */
export function mainComponent(project: Project, map: GameMap): Set<string> {
  const seen = new Set<string>();
  let best = new Set<string>();
  const blocked = eventCells(map);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const k = key({ x, y });
      if (seen.has(k) || blocked.has(k) || !isPassable(project, map, x, y)) continue;
      const part = new Set(distances(project, map, { x, y }, blocked).keys());
      for (const p of part) seen.add(p);
      if (part.size > best.size) best = part;
    }
  }
  return best;
}

/** 집 키트의 문(parts kind entrance) 중 문 앞이 마을 본체로 이어지고 비어 있는 것 — 마을 가운데에서 가까운 순. */
export function houseDoors(project: Project, map: GameMap, main: ReadonlySet<string>): Array<{ door: Cell; front: Cell }> {
  const tileset = project.tilesets[map.tilesetId];
  const kits = new Map((tileset?.structureKits ?? []).map((kit) => [kit.id, kit]));
  const events = eventCells(map);
  const out: Array<{ door: Cell; front: Cell }> = [];
  for (const placement of map.structurePlacements ?? []) {
    const kit = kits.get(placement.kitId);
    const part = kit?.parts?.find((p) => p.kind === "entrance");
    if (!part) continue;
    const door = { x: placement.x + part.dx + Math.floor((part.w - 1) / 2), y: placement.y + part.dy + part.h - 1 };
    const front = { x: door.x, y: door.y + 1 };
    if (!inside(map, front) || !main.has(key(front)) || events.has(key(door)) || events.has(key(front))) continue;
    if ((map.events ?? []).some((e) => Math.abs(e.x - front.x) + Math.abs(e.y - front.y) <= 1)) continue;
    out.push({ door, front });
  }
  const cx = map.width / 2, cy = map.height / 2;
  return out.sort((a, b) => Math.hypot(a.door.x - cx, a.door.y - cy) - Math.hypot(b.door.x - cx, b.door.y - cy));
}

/** 마을 본체에 붙은 가장자리 칸 — 모서리를 피하고, 이미 있는 출입구에서 8칸 넘게 떨어진 칸 중 변 가운데에 가까운 쪽. */
export function edgeGate(map: GameMap, main: ReadonlySet<string>): Cell | undefined {
  const gates = (map.events ?? []).map((e) => ({ x: e.x, y: e.y }));
  const edge = [...main]
    .map((k) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; })
    .filter((c) => c.x === 0 || c.y === 0 || c.x === map.width - 1 || c.y === map.height - 1)
    .filter((c) => (c.x === 0 || c.x === map.width - 1 ? c.y >= 4 && c.y <= map.height - 5 : c.x >= 4 && c.x <= map.width - 5));
  const far = (c: Cell): number => gates.length ? Math.min(...gates.map((g) => Math.abs(g.x - c.x) + Math.abs(g.y - c.y))) : Infinity;
  const clear = edge.filter((c) => far(c) > 8);
  const pool = clear.length ? clear : edge.filter((c) => far(c) > 2);
  const offMid = (c: Cell): number => (c.x === 0 || c.x === map.width - 1 ? Math.abs(c.y - map.height / 2) : Math.abs(c.x - map.width / 2));
  return pool.sort((a, b) => offMid(a) - offMid(b) || far(b) - far(a))[0];
}

/** 이 가장자리 칸이 놓인 변의 반대쪽에서 가도로 들어오게 가도 쪽 출입구를 정한다. */
function routeExits(gate: Cell, hub: GameMap, w: number, h: number): [Cell, Cell] {
  if (gate.x === 0) return [{ x: w - 1, y: Math.floor(h / 2) }, { x: 0, y: Math.floor(h / 3) }];
  if (gate.x === hub.width - 1) return [{ x: 0, y: Math.floor(h / 2) }, { x: w - 1, y: Math.floor(h / 3) }];
  if (gate.y === 0) return [{ x: Math.floor(w / 2), y: h - 1 }, { x: Math.floor(w / 3), y: 0 }];
  return [{ x: Math.floor(w / 2), y: 0 }, { x: Math.floor((2 * w) / 3), y: h - 1 }];
}

function troopStrength(project: Project, troopId: string): number {
  const troop = project.database.troops.find((t) => t.id === troopId);
  return (troop?.members ?? []).reduce((sum, m) => {
    const enemy = project.database.enemies.find((e) => e.id === m.enemyId);
    return sum + (enemy?.stats?.maxHp ?? 0) + 4 * (enemy?.stats?.attack ?? 0);
  }, 0);
}

/** 이야기 이벤트(조사·자동 실행 — 닿으면 싸우는 보이는 적 eventTouch 는 빼고)가 이미 부르는 적 그룹 — 새 보스는 이것과 겹치지 않게 고른다. */
function storyTroops(project: Project): Set<string> {
  const used = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const page of (map.events ?? []).flatMap((e) => e.pages ?? [])) {
      if (page.trigger?.kind === "eventTouch") continue;
      for (const match of JSON.stringify(page.commands ?? []).matchAll(/"troopId":"([^"]+)"/gu)) used.add(match[1]!);
    }
  }
  return used;
}

export function pickTroops(project: Project, given: unknown): { field: string[]; midBoss?: string; boss?: string } {
  const all = project.database.troops.map((t) => t.id).sort((a, b) => troopStrength(project, a) - troopStrength(project, b));
  const known = (id: unknown): id is string => typeof id === "string" && all.includes(id);
  const givenField = list(given, "field").filter(known);
  const givenMid = text(given, "midBoss"), givenBoss = text(given, "boss");
  const story = storyTroops(project);
  const fresh = all.filter((id) => !story.has(id));
  const pool = fresh.length >= 3 ? fresh : all;
  // 잡몹은 가장 약한 3분의 1 — 단 이 게임 맵들이 이미 쓰는 무작위 조우 적 그룹(생성기가 Lv1 파티에 맞춘 세기)보다 약한 무리는 뺀다.
  // 바닥 없이 끌어오면 피해를 한 번도 못 주는 무리(ff2 광산 해골 궁수)가 섞였다(R6 qa-game 경고).
  const weakest = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3)));
  const tuned = Object.values(project.maps).flatMap((m) => (m.encounterTable ?? []).map((e) => e.troopId)).filter((id) => all.includes(id));
  const floor = Math.min(...tuned.map((id) => troopStrength(project, id)));
  const sturdy = weakest.filter((id) => troopStrength(project, id) >= floor);
  const field = givenField.length ? givenField : sturdy.length ? sturdy : weakest;
  const strong = pool.filter((id) => !weakest.includes(id));
  return {
    field,
    midBoss: known(givenMid) ? givenMid : strong[Math.floor(strong.length * 0.4)] ?? pool[pool.length - 1],
    boss: known(givenBoss) ? givenBoss : strong[strong.length - 1] ?? pool[pool.length - 1],
  };
}

function shopGoods(project: Project, given: unknown): string[] {
  if (Array.isArray(given)) return given.filter((id): id is string => typeof id === "string");
  const priced = <T extends { id: string; price?: number }>(list: readonly T[]): T[] => list.filter((e) => (e.price ?? 0) > 0).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const gear = priced(project.database.equipment ?? []);
  const slots = new Map<string, string>();
  for (const e of gear) if (!slots.has(e.slot)) slots.set(e.slot, e.id);
  const items = priced(project.database.items ?? []).filter((i) => i.type === "medicine").slice(0, 3).map((i) => i.id);
  return [...items, ...slots.values()].slice(0, 8);
}

export function chestLoot(project: Project, salt: number): { itemId?: string; gold?: number } {
  const items = (project.database.items ?? []).filter((i) => (i.price ?? 0) > 0 && (i.type === "medicine" || i.type === "normalGoods")).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const pick = items[Math.min(items.length - 1, 1 + (salt * 3) % Math.max(1, Math.min(items.length, 12)))];
  return pick && salt % 3 !== 2 ? { itemId: pick.id } : { gold: 150 + 50 * salt };
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-z0-9_]+/giu, "_").replace(/^_+|_+$/gu, "").toLowerCase();
}

const expandJrpgCampaignVolume: ToolDefinition = {
  name: "expand_jrpg_campaign_volume",
  description:
    "JRPG 마을 하나에 한 고장 분량(맵 2~5장)을 덧붙인다 — 「게임 볼륨을 넓혀줘·마을에 여관/상점/장로 집·가도·던전을 붙여줘」. "
    + "{hubMapId, prefix?, interiors?:[inn|shop|elder…], route?:false, routeName?, dungeon?:false, dungeonName?, dungeonType?, look?:ruin|past|future, troops?:{field?,midBoss?,boss?}, shopItemIds?, seed?} "
    + "① 마을 집 문 ↔ 손 도트 실내(build_hand_interior_room): inn=여관 주인(숙박 inn 명령), shop=무기·도구점 주인(shop 명령), elder=장로(대화) + 실내마다 보물상자. "
    + "② 마을 가장자리 ↔ 가도(author_wild_route 40×30): 순찰하는 보이는 적 3·필드 조우(맵 전체)·상자 2. look 을 주면 가도 땅·숲·조명까지 그 시대(derive_map_variant 와 같은 모습)로 바꾼다. "
    + "③ 가도 끝 ↔ 던전(author_dungeon, look 별 기본 cave/temple/catacomb/castle): 계획된 자리의 보이는 적·상자 + 보스 직전 방 중간 보스 + 보스방 수호자(도망 불가). "
    + "적 그룹은 생략하면 DB 의 적 그룹을 세기로 나눠 고른다(이야기 이벤트가 이미 부르는 보스 그룹은 피한다). 이벤트는 길을 끊지 않는 칸에만 놓는다. "
    + "붕괴 후·과거 시대 마을(집이 철거된 변형)은 interiors:[] 로 가도·던전만 붙인다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      hubMapId: { type: "string", description: "넓힐 마을 맵 id" },
      prefix: { type: "string", description: "새 맵 id 접두(기본 hubMapId)" },
      interiors: { type: "array", items: { type: "string", enum: ["inn", "shop", "elder"] }, description: "집 문에 이을 실내 역할(기본 [inn, shop, elder]). 빈 배열이면 실내 없음" },
      route: { type: "boolean", description: "가도(기본 true). false 면 가도·던전 둘 다 없음" },
      routeName: { type: "string" },
      dungeon: { type: "boolean", description: "가도 끝 던전(기본 true)" },
      dungeonName: { type: "string" },
      dungeonType: { type: "string", description: "author_dungeon type(기본 look 별 cave/temple/catacomb/castle)" },
      look: { type: "string", enum: [...VARIANT_LOOKS], description: "가도·던전 시대 모습(ruin=붕괴 후·폐허, past=고대, future=미래)" },
      troops: {
        type: "object",
        properties: { field: { type: "array", items: { type: "string" } }, midBoss: { type: "string" }, boss: { type: "string" } },
        additionalProperties: false,
      },
      shopItemIds: { type: "array", items: { type: "string" }, description: "상점 물건(아이템·장비 id). 생략 시 싼 회복약 + 부위별 가장 싼 장비" },
      seed: { type: "integer" },
    },
    required: ["hubMapId"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const hub = requireMap(draft, String(args.hubMapId ?? ""));
    const prefix = sanitizeId(typeof args.prefix === "string" && args.prefix.trim() ? args.prefix : hub.id);
    // 씨앗을 생략하면 마을 id·이름에서 뽑는다 — 고정값이면 게임마다 여관·가도·던전이 칸 하나까지 똑같이 나왔다(R6 적대 검수).
    const seed = Number.isInteger(args.seed) ? Number(args.seed) : [...`${hub.id}:${hub.name}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 9973;
    const look = isLook(args.look) ? args.look : undefined;
    const roles: Role[] = Array.isArray(args.interiors)
      ? args.interiors.filter((r): r is Role => r === "inn" || r === "shop" || r === "elder")
      : ["inn", "shop", "elder"];
    const wantRoute = args.route !== false;
    const wantDungeon = wantRoute && args.dungeon !== false;
    const routeNameArg = text(args, "routeName")?.trim();
    const dungeonNameArg = text(args, "dungeonName")?.trim();
    const dungeonTypeArg = text(args, "dungeonType")?.trim();
    const troops = pickTroops(draft, args.troops);
    const warnings: string[] = [];
    const lines: string[] = [];
    const newMaps: string[] = [];
    const freshId = (base: string): string => {
      let id = base, n = 2;
      while (draft.maps[id]) id = `${base}_${n++}`;
      return id;
    };
    let chestSalt = seed;

    // ① 실내
    const main = mainComponent(draft, hub);
    const doors = houseDoors(draft, hub, main);
    if (roles.length > doors.length) warnings.push(`${hub.name} 에 문 앞이 비어 이어 붙일 수 있는 집이 ${doors.length}채라 실내 ${roles.length - doors.length}곳은 짓지 않았다.`);
    const interiors: Array<{ role: Role; mapId: string; door: Cell }> = [];
    roles.slice(0, doors.length).forEach((role, i) => {
      const { door, front } = doors[i]!;
      const mapId = freshId(`${prefix}_${role}`);
      const name = `${hub.name.replace(/\s*\(.*\)\s*$/u, "")} ${ROLE_LABEL[role]}`;
      // 견본 배치는 점수 1등을 고르므로 씨앗만 바꾸면 장로 집·무기점이 네 게임에서 칸 하나까지 같았다(R6 적대 검수) — 화풍 변형(A~D)·배치 후보도 씨앗에서 고른다.
      const style = "ABCD"[(seed + i) % 4];
      const built = nested(draft, "build_hand_interior_room", { mapId, name, layout: { program: ROLE_PROGRAM[role], seed: seed + i, styleVariant: style, variant: Math.floor(seed / 4) % 2 } });
      const exitRaw = list(built.data, "exits")[0];
      const exit = asCell(exitRaw);
      const room = draft.maps[mapId];
      if (!exit || !room) { warnings.push(`${name}: 출입구가 없는 실내라 잇지 못했다`); return; }
      const exitCell = { x: exit.x + Math.floor(((num(exitRaw, "width") ?? 1) - 1) / 2), y: exit.y };
      nested(draft, "create_transfer_pair", { a: { mapId: hub.id, x: front.x, y: front.y, doorAt: door }, b: { mapId, x: exitCell.x, y: exitCell.y } });
      const origin = { x: exitCell.x, y: exitCell.y - 1 };
      const taken = new Set<string>();
      const npcAt = pickSpot(draft, room, origin, taken, 0.55, 3);
      const npc = ROLE_NPC[role];
      if (npcAt) {
        const commands = role === "inn"
          ? [{ kind: "inn", price: 30 }]
          : role === "shop" ? [{ kind: "shop", shopType: "normal", itemIds: shopGoods(draft, args.shopItemIds), allowSell: true }] : [];
        const talk = role === "inn"
          ? ["어서 오세요, 길손. 하룻밤 30골드면 푹 쉬어 갈 수 있지요."]
          : role === "shop" ? ["먼 길 떠나기 전에 장비부터 챙기게. 맨몸으로 가도에 나섰다간 돌아오지 못해."]
            : [`${hub.name.replace(/\s*\(.*\)\s*$/u, "")}에 온 것을 환영하네.`, "마을 밖 가도를 따라가면 오래된 던전이 있다네. 그 깊은 곳의 수호자를 조심하게."];
        nested(draft, "place_npc", {
          mapId, x: npcAt.x, y: npcAt.y, name: npc.name, id: `ev_${mapId}_keeper`,
          graphic: { query: npc.query },
          pages: [{ name: `${npc.name} · 기본`, lines: talk, commands }],
        });
      } else warnings.push(`${name}: 주인이 설 빈 칸이 없다`);
      const chestAt = pickSpot(draft, room, origin, taken, 1, 3);
      if (chestAt) nested(draft, "place_chest", { mapId, x: chestAt.x, y: chestAt.y, id: `ev_${mapId}_chest`, name: `${ROLE_LABEL[role]} 상자`, contents: chestLoot(draft, chestSalt++) });
      interiors.push({ role, mapId, door });
      newMaps.push(mapId);
      lines.push(`${ROLE_LABEL[role]} ${mapId} ← 문 (${door.x},${door.y})${npcAt ? ` · ${npc.name} (${npcAt.x},${npcAt.y})` : ""}${chestAt ? ` · 상자 (${chestAt.x},${chestAt.y})` : ""}`);
    });

    // ② 가도
    let routeId: string | undefined;
    let routeFar: Cell | undefined;
    if (wantRoute) {
      const gate = edgeGate(hub, mainComponent(draft, hub));
      if (!gate) throw new ToolError(`${hub.name} 의 가장자리에 마을 본체와 이어진 빈 칸이 없어 가도를 이을 수 없다`, { code: "no-edge-gate", mapId: hub.id });
      const w = 40, h = 30;
      const [near, far] = routeExits(gate, hub, w, h);
      routeId = freshId(`${prefix}_route`);
      const routeName = routeNameArg || `${hub.name.replace(/\s*\(.*\)\s*$/u, "")} 가도`;
      nested(draft, "create_map", { id: routeId, name: routeName, width: w, height: h, tilesetId: hub.tilesetId });
      const route = draft.maps[routeId]!;
      const encounters = troops.field.map((troopId) => ({ troopId, weight: 10 }));
      const wild = nested(draft, "author_wild_route", { mapId: routeId, exits: [near, far], grassPatches: 3, seed, encounters, encounterRate: 24 });
      if (look) applyVariantLook(draft, route, look, warnings, routeName);
      nested(draft, "create_transfer_pair", { a: { mapId: hub.id, x: gate.x, y: gate.y }, b: { mapId: routeId, x: near.x, y: near.y } });
      const patches = list(wild.data, "grassPatches").length;
      const taken = new Set<string>();
      const foes: string[] = [];
      for (let i = 0; i < 3 && troops.field.length; i++) {
        const at = pickSpot(draft, route, near, taken, 0.3 + 0.25 * i, 4);
        if (!at) break;
        const vertical = (seed + i) % 2 === 1;
        placeRoamer(draft, { mapId: routeId, x: at.x, y: at.y, troopId: troops.field[i % troops.field.length], behavior: i === 2 ? "chase" : "patrol", sightRange: 4, id: `ev_${routeId}_foe${i + 1}` }, vertical);
        foes.push(`(${at.x},${at.y})`);
      }
      const chests: string[] = [];
      for (const rank of [0.65, 0.95]) {
        const at = pickSpot(draft, route, near, taken, rank, 3);
        if (!at) continue;
        nested(draft, "place_chest", { mapId: routeId, x: at.x, y: at.y, id: `ev_${routeId}_chest${chests.length + 1}`, name: "길가 상자", contents: chestLoot(draft, chestSalt++) });
        chests.push(`(${at.x},${at.y})`);
      }
      routeFar = far;
      newMaps.push(routeId);
      lines.push(`가도 ${routeId} ← ${hub.id} (${gate.x},${gate.y}) · 풀숲 ${patches}곳 · 보이는 적 ${foes.join(" ")} · 상자 ${chests.join(" ")}${look ? ` · 모습 ${look}` : ""}`);
    }

    // ③ 던전
    let dungeonId: string | undefined;
    if (wantDungeon && routeId && routeFar) {
      dungeonId = freshId(`${prefix}_dungeon`);
      const type = dungeonTypeArg || DUNGEON_BY_LOOK[look ?? "none"];
      const name = dungeonNameArg || `${hub.name.replace(/\s*\(.*\)\s*$/u, "")} 너머의 ${type === "temple" ? "고대 신전" : type === "catacomb" ? "무너진 지하묘지" : type === "castle" ? "마도 연구소" : "동굴"}`;
      const made = nested(draft, "author_dungeon", { id: dungeonId, name, type, size: "medium", genre: "rpg", seed, entrance: { fromMapId: routeId, x: routeFar.x, y: routeFar.y } });
      const rooms = list(made.data, "rooms").map(asRoom).filter((r): r is Room => !!r);
      const bossId = text(field(made.data, "anchors"), "boss");
      const population = field(made.data, "population");
      const planned = (k: string): Array<Cell & { room?: string }> => list(population, k).flatMap((v) => {
        const c = asCell(v);
        if (!c) return [];
        const room = text(v, "room");
        return [room ? { ...c, room } : c];
      });
      const dungeon = draft.maps[dungeonId]!;
      const bossRoom = rooms.find((r) => r.id === bossId);
      const midRoom = bossRoom ? rooms.find((r) => r.id === bossRoom.from && r.kind !== "entrance") : undefined;
      const free = (c: Cell): boolean => isPassable(draft, dungeon, c.x, c.y) && !(dungeon.events ?? []).some((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y) <= 1);
      const placed: string[] = [];
      planned("enemies").filter((e) => e.room !== bossRoom?.id && e.room !== midRoom?.id).slice(0, 4).forEach((e, i) => {
        if (!free(e) || !troops.field.length) return;
        placeRoamer(draft, { mapId: dungeonId, x: e.x, y: e.y, troopId: troops.field[(i + 1) % troops.field.length], behavior: "patrol", id: `ev_${dungeonId}_foe${i + 1}` }, i % 2 === 1);
        placed.push(`(${e.x},${e.y})`);
      });
      const chests: string[] = [];
      planned("chests").slice(0, 3).forEach((c) => {
        if (!free(c)) return;
        nested(draft, "place_chest", { mapId: dungeonId, x: c.x, y: c.y, id: `ev_${dungeonId}_chest${chests.length + 1}`, name: "던전 상자", contents: chestLoot(draft, chestSalt++) });
        chests.push(`(${c.x},${c.y})`);
      });
      const guard = (room: Room | undefined, troopId: string | undefined, id: string, label: string): string => {
        const at = room?.spots.find(free);
        if (!at || !troopId) { warnings.push(`${name}: ${label} 자리를 찾지 못했다`); return ""; }
        nested(draft, "place_field_enemy", { mapId: dungeonId, x: at.x, y: at.y, troopId, behavior: "stationary", canEscape: false, alert: "anger", id });
        return ` · ${label} ${troopId} (${at.x},${at.y})`;
      };
      const mid = guard(midRoom, troops.midBoss, `ev_${dungeonId}_midboss`, "중간 보스");
      const boss = guard(bossRoom, troops.boss, `ev_${dungeonId}_boss`, "수호자");
      newMaps.push(dungeonId);
      lines.push(`던전 ${dungeonId} (${type}, ${dungeon.width}×${dungeon.height}) ← 가도 끝 (${routeFar.x},${routeFar.y}) · 보이는 적 ${placed.join(" ") || "없음"} · 상자 ${chests.join(" ") || "없음"}${mid}${boss}`);
    }

    if (!newMaps.length) throw new ToolError(`${hub.name} 에 덧붙인 맵이 없다 — interiors 를 주거나 route 를 켠다`, { code: "nothing-built", mapId: hub.id });
    return {
      summary: `${hub.name} 볼륨 확장 — 새 맵 ${newMaps.length}장: ${lines.join(" / ")}`,
      data: { hubMapId: hub.id, maps: newMaps, interiors, routeMapId: routeId, dungeonMapId: dungeonId, troops },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const JRPG_VOLUME_TOOLS: readonly ToolDefinition[] = [expandJrpgCampaignVolume];
