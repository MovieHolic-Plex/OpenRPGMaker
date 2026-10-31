// 조수 v2 make_game — 「작은 게임 하나」(맵 5~8장 + 잇기 + 사람 + 이야기)를 계획 한 번으로 짓는다.
//
// 왜(2026-10-24): v2 동사는 장소 하나씩이라 여러 맵 게임은 모델이 make_place 를 맵마다 부르고 문을 따로 이어야 했다(턴이 길고 잇기가 빠졌다).
// 모델은 계획(장소 목록·어디서 어디로·시작·사람·사건)을 한 번 쓰고, 이 파일이:
//  1) 장소를 빌더로 짓고(시작 장소가 빈 시작 맵을 쓰고, 나머지는 새 맵 — 실내가 지금 맵을 덮어쓰지 않게),
//  2) 부모-자식으로 잇고(마을 집 문 ↔ 실내 입구 · 바깥 맵 가장자리 ↔ 가장자리 · 던전은 짓을 때 부모와 이어진다),
//  3) 시작에서 모든 맵에 갔다가 돌아올 수 있는지 기계로 걸어 본다.
// 비평가는 verbs.ts 의 see 를 맵마다 함께(병렬) 부른다.
import type { GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";
import type { EventSpec, PersonSpec, PlaceBuildResult, PlaceSpec } from "./types";
import { walkReach, walkStart } from "./people";

export interface GamePlace {
  /** 계획 안의 짧은 이름(잇기·사람·사건이 가리킨다). */
  readonly key: string;
  readonly spec: PlaceSpec;
  /** 어디서 들어오나 — 부모 장소 key. 시작 장소는 비운다. */
  readonly from?: string;
  /** 바깥끼리 잇는 쪽(부모에서 본 방향). 실내·던전은 무시. */
  readonly side?: "north" | "south" | "east" | "west";
}
export interface GameSpec {
  readonly title?: string;
  readonly places: readonly GamePlace[];
  readonly start?: string;
  readonly people?: readonly (PersonSpec & { readonly place: string })[];
  readonly events?: readonly (EventSpec & { readonly place: string })[];
}

export const MAKE_GAME_CARD = [
  "[One small game — make_game] When the request asks for several maps (village, house interior, shop, forest, dungeon…) with the roads and doors between them, people and a story, hand the plan over in one make_game call (do not call make_place per map).",
  "- places: [{key, spec (same spec as make_place), from?:parent key, side?:north|south|east|west}] — 5–8 places. The first place (or start) is the start. Interiors and house insides connect to a house door in the from village, dungeons get an entrance on the from map, and outdoor maps link at the side edge.",
  "- people: [{place:key, …people spec}] · events: [{place:key, …event spec (same as add_event)}] — the opening cutscene, the client, lines before the boss, etc.",
  "- Result: per map a 1x picture, machine checks and critique, plus a start→each map→back path check. Add fixes with edit_place, add_people, add_event, and game elements (quests, items, battles) with the game tools.",
].join("\n");

export const MAKE_GAME_WORDS = /게임\s*(하나|한\s*판|을|를)?\s*(만들|짓)|작은\s*게임|짧은\s*게임|맵\s*[5-8]\s*(장|개)|[5-8]\s*개의?\s*맵|마을.*(던전|동굴|숲).*(보스|이야기)|이야기가\s*있는|퀘스트\s*라인|챕터/iu;
/** make_game 을 싣는가 — 비교 측정 중에는 환경 변수로만 켠다(다른 시험의 도구 목록을 바꾸지 않게). */
export function makeGameOn(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPRN_V2_MAKE_GAME === "1";
}
export function wantsMakeGame(task: string): boolean {
  return MAKE_GAME_WORDS.test(task);
}

/** 바깥 맵(문·가장자리로 잇는 쪽)인가. */
export const isOutdoor = (spec: PlaceSpec): boolean => spec.type === "village" || spec.type === "street";
export const isInside = (spec: PlaceSpec): boolean => spec.type === "interior" || spec.type === "house";

type Door = { x: number; y: number; kit?: string };
/** 마을 빌더가 남긴 집 문 앞 칸 목록. */
export function villageDoors(result: PlaceBuildResult): Door[] {
  const doors = (result.state as { doors?: unknown } | undefined)?.doors;
  return Array.isArray(doors) ? (doors as Door[]).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y)) : [];
}

const KIT_WORDS: readonly [RegExp, RegExp][] = [
  [/여관|inn|tavern|선술집|주점/iu, /inn|tavern/iu], [/대장간|smith|forge|무기/iu, /smith|forge/iu], [/가게|상점|shop|store|도구점|잡화/iu, /shop|store|market/iu],
  [/교회|성당|church|chapel|신전/iu, /church|chapel|temple/iu], [/촌장|mayor|저택|manor/iu, /manor|mayor|hall|large/iu], [/방앗간|mill/iu, /mill/iu],
];
/** 실내 이름에 맞는 집 문(여관 → inn 킷)을 먼저, 없으면 아직 안 쓴 문 중 마을 가운데에 가까운 것. */
export function pickDoor(doors: readonly Door[], childName: string, used: ReadonlySet<string>, map: GameMap): Door | undefined {
  const free = doors.filter((d) => !used.has(`${d.x},${d.y}`));
  for (const [want, kit] of KIT_WORDS) if (want.test(childName)) { const hit = free.find((d) => kit.test(d.kit ?? "")); if (hit) return hit; }
  const cx = map.width / 2, cy = map.height / 2;
  return [...free].sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)))[0];
}

const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" } as const;
export const oppositeSide = (side: keyof typeof OPPOSITE) => OPPOSITE[side];

/** 바깥 맵에서 그 쪽 가장자리에 가장 가까운, 시작에서 걸어 닿는 칸(가장자리 잇기가 실패할 때 문 자리). */
export function edgeCell(project: Project, map: GameMap, side: keyof typeof OPPOSITE): { x: number; y: number } | undefined {
  const reach = walkReach(project, map, walkStart(project, map), new Set());
  let best: { x: number; y: number; d: number } | undefined;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!reach[y * map.width + x]) continue;
    if ((map.events ?? []).some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1)) continue;
    const d = side === "north" ? y : side === "south" ? map.height - 1 - y : side === "west" ? x : map.width - 1 - x;
    const mid = side === "north" || side === "south" ? Math.abs(x - map.width / 2) : Math.abs(y - map.height / 2);
    const score = d * 4 + mid;
    if (!best || score < best.d) best = { x, y, d: score };
  }
  return best ? { x: best.x, y: best.y } : undefined;
}

/** 이벤트의 이동 목적지(조건 분기 안까지). */
function transfersOf(ev: GameEvent): { mapId: string; x: number; y: number }[] {
  const out: { mapId: string; x: number; y: number }[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    if (!node || typeof node !== "object") return;
    const t = node as { kind?: string; mapId?: string; x?: number; y?: number };
    if (t.kind === "transfer" && typeof t.mapId === "string") { out.push({ mapId: t.mapId, x: Number(t.x ?? 0), y: Number(t.y ?? 0) }); return; }
    for (const v of Object.values(node)) walk(v);
  };
  walk(ev.commands ?? []);
  walk(ev.pages ?? []);
  return out;
}

export interface GamePathReport {
  readonly reached: readonly string[];
  readonly unreached: readonly string[];
  /** 갔지만 들어온 맵으로 돌아가는 문이 걸어 닿는 곳에 없는 맵. */
  readonly noWayBack: readonly string[];
  readonly lines: readonly string[];
}

/** 시작 맵 시작 칸에서 걸어서 문(이동 이벤트)을 타고 맵들을 돌아본다. 문 칸이나 그 옆 칸에 닿으면 탄 것으로 본다. */
export function walkGame(project: Project, mapIds: readonly string[]): GamePathReport {
  const want = new Set(mapIds);
  const start = project.startMapId;
  const reachedFrom = new Map<string, { x: number; y: number }>();
  const parents = new Map<string, string>();
  const queue: { mapId: string; at: { x: number; y: number } }[] = [{ mapId: start, at: project.startPos }];
  const exitsOf = new Map<string, Set<string>>();
  reachedFrom.set(start, project.startPos);
  for (let k = 0; k < queue.length && k < 400; k++) {
    const { mapId, at } = queue[k]!;
    const map = project.maps[mapId];
    if (!map) continue;
    const from = isPassable(project, map, at.x, at.y) ? at : walkStart(project, map);
    const reach = walkReach(project, map, from, new Set());
    const touch = (x: number, y: number) => [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
      const nx = x + dx!, ny = y + dy!;
      return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && reach[ny * map.width + nx] === 1 && (dx === 0 && dy === 0 ? true : canMove(project, map, nx, ny, x, y) || !isPassable(project, map, x, y));
    });
    const exits = new Set<string>();
    for (const ev of map.events ?? []) {
      if (!touch(ev.x, ev.y)) continue;
      for (const t of transfersOf(ev)) {
        exits.add(t.mapId);
        if (!reachedFrom.has(t.mapId) && project.maps[t.mapId]) { reachedFrom.set(t.mapId, { x: t.x, y: t.y }); parents.set(t.mapId, mapId); queue.push({ mapId: t.mapId, at: { x: t.x, y: t.y } }); }
      }
    }
    exitsOf.set(mapId, exits);
  }
  const reached = mapIds.filter((id) => reachedFrom.has(id));
  const unreached = mapIds.filter((id) => !reachedFrom.has(id));
  const noWayBack = reached.filter((id) => id !== start && parents.has(id) && !(exitsOf.get(id)?.has(parents.get(id)!)));
  const name = (id: string) => `${project.maps[id]?.name ?? id}`;
  const lines = [
    `시작 「${name(start)}」에서 걸어서 ${reached.length}/${want.size}곳에 닿는다.`,
    ...unreached.map((id) => `닿지 않음: ${name(id)}(${id}) — 문·길이 없다`),
    ...noWayBack.map((id) => `돌아가는 문 없음: ${name(id)} → ${name(parents.get(id)!)}`),
  ];
  return { reached, unreached, noWayBack, lines };
}

/** 사건 명세의 자리 낱말 'x,y' → 칸(add_event 와 같다). */
export function eventBeats(event: EventSpec): EventSpec["beats"] {
  return event.beats.map((b) => {
    const raw = b as unknown as Record<string, unknown>;
    const asPoint = (v: unknown) => typeof v === "string" && /^\s*\d+\s*,\s*\d+\s*$/u.test(v) ? { x: Number(v.split(",")[0]), y: Number(v.split(",")[1]) } : v;
    return { ...raw, ...(raw.to !== undefined ? { to: asPoint(raw.to) } : {}), ...(raw.where !== undefined ? { where: asPoint(raw.where) } : {}) } as unknown as EventSpec["beats"][number];
  });
}

/** 계획 바로잡기: key 중복·없는 부모·고리를 걸러 짓는 순서(부모 먼저)로. 시작 장소가 맨 앞. */
export function orderPlaces(spec: GameSpec): { order: GamePlace[]; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const places = spec.places.filter((p) => { if (!p.key || seen.has(p.key)) { warnings.push(`장소 key 「${p.key}」가 비었거나 겹쳐 뺐다`); return false; } seen.add(p.key); return true; });
  const startKey = spec.start && seen.has(spec.start) ? spec.start : places.find((p) => !p.from)?.key ?? places[0]?.key;
  const order: GamePlace[] = [];
  const done = new Set<string>();
  const startPlace = places.find((p) => p.key === startKey);
  if (startPlace) { order.push({ ...startPlace, from: undefined }); done.add(startPlace.key); }
  for (const p of places) if (p.from && !seen.has(p.from)) warnings.push(`${p.key}: 부모 「${p.from}」가 계획에 없어 시작 장소에 이었다`);
  for (let pass = 0; pass < places.length + 1; pass++) {
    for (const p of places) {
      if (done.has(p.key)) continue;
      const parent = p.from && seen.has(p.from) && p.from !== p.key ? p.from : startKey;
      if (parent && done.has(parent)) { order.push({ ...p, from: parent }); done.add(p.key); }
    }
  }
  // 고리(서로를 부모로)라 남은 장소는 시작 장소에 잇는다.
  for (const p of places) if (!done.has(p.key) && startKey) { warnings.push(`${p.key}: 부모 고리라 시작 장소에 이었다`); order.push({ ...p, from: startKey }); done.add(p.key); }
  return { order, warnings };
}
