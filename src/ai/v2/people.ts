// 조수 v2 — 사람(NPC) 빌더.
//
// 모델은 «누가·어디쯤·무슨 말»만 쓴다(PersonSpec). 칸 번호는 이 파일이 정한다:
//  - 자리 낱말(입구·광장·문 앞·…)을 실제로 걸어 닿는 칸으로 옮기고,
//  - 막힌 칸·문(이동) 칸·외길을 막는 칸은 후보에서 뺀 뒤,
//  - 놓은 칸을 막힌 칸으로 두고 길찾기를 다시 돌려 «전에 닿던 칸에 아직 다 닿는지» 확인한다.
// 놓기는 v1 place_npc, 그림은 graphic.query, 대사는 페이지(첫 만남 / 두 번째부터).
import type { Dir, GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { sharedCharsetRow } from "@/project/sharedCharacterFaceResolver";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { genreLockCharsetCatalogFilter } from "@/project/genreLockCharsets";
import type { BuildRun, ContentBuildResult, PersonSpec } from "./types";
import { counterSide, exitThroats, isCounterArt, isShopkeeperName, laneCells, wanderReach } from "./placementRules";

export const PEOPLE_CARD =
  "사람(people) 명세: {role,name?,where?,at?,looks?,firstTalk?,laterTalk?,movement?,mapId?}. " +
  "role=문지기·촌장·상인 같은 역할(그림 고르기에도 쓴다 — 마을 사람에게 몬스터·해골 그림은 안 쓰고 짝 얼굴 있는 칩을 먼저 고른다). looks=외형 낱말(경비병·노인·소녀·old woman). " +
  "where 낱말: 입구·성문(길이 맵 밖으로 나가는 곳의 길가, 길 쪽을 봄) / 광장·가운데 / 문 앞 / «X 옆·앞·뒤»(카운터·바·벽난로·우물 — 칩셋 이름표로 찾음) / " +
  "한쪽·벽 쪽 / 북쪽 벽(남·동·서) / 구석 / 창가 — 방 낱말(홀·부엌·침실)을 붙이면 그 방 안(«홀 한쪽», «부엌 화덕 옆») / 생략(시작 지점 근처). " +
  "at:{x,y} 는 정말 필요할 때만 — 막힌 칸이면 가까운 걸어 닿는 칸으로 옮긴다. " +
  "firstTalk=처음 말 걸 때 대사(배열), laterTalk=그 뒤 두 번째부터 대사(배열, 생략하면 같은 말 반복). " +
  "movement: still(기본, 제자리) · wander(배회 — 출구 길목·차도 가까이면 제자리로 바꾼다) · patrol(제자리로 처리). " +
  "빌더가 길을 막지 않는 자리만 고르고, 놓은 뒤 길찾기로 확인한다. 사람은 차도·선로 한가운데에 세우지 않는다 — 보도·가게 안·벤치·카운터 뒤·문 앞에 선다. " +
  "가게 주인·점원은 where 를 «카운터 뒤»로 — 카운터 북쪽(주인 쪽)에 세운다(카운터 앞은 손님 자리).";

type Cell = { x: number; y: number };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

// ───────────────────────── 공간 도우미 (events.ts 도 쓴다) ─────────────────────────

export function findMap(project: Project, mapId: string): GameMap | undefined {
  const maps = project.maps as unknown as Record<string, GameMap> | GameMap[];
  return Array.isArray(maps) ? maps.find((m) => m.id === mapId) : maps[mapId];
}

export function eventsOf(map: GameMap): GameEvent[] {
  return Object.values((map.events ?? []) as unknown as Record<string, GameEvent>);
}

function hasTransfer(ev: GameEvent): boolean {
  const lists: unknown[][] = [ev.commands ?? [], ...((ev.pages ?? []).map((p) => p.commands ?? []))];
  return lists.some((cmds) => cmds.some((c) => (c as { kind?: string }).kind === "transfer"));
}

/** 이동(문) 칸. */
export function transferCells(map: GameMap): Cell[] {
  return eventsOf(map).filter(hasTransfer).map((e) => ({ x: e.x, y: e.y }));
}

/** 사람이 서서 막는 칸: 이동 칸이 아닌 이벤트 칸 전부(그림 있는 이벤트·기존 NPC). */
/**
 * 큰 몸(page.footprint)을 가진 이벤트가 덮는 칸 전부(앵커 칸 제외) — 키운 보스(3×2)처럼 그림이 여러 칸을 덮는다.
 * 그 칸에 조사 칸을 두면 보스 그림 밑에 묻혀 보스를 쓰러뜨리기 전에는 조사할 수 없었다(2026-10-29 vm1 deepseek 「동굴 입구의 봉인」).
 */
export function eventBodyCells(map: GameMap): Set<number> {
  const set = new Set<number>();
  for (const e of eventsOf(map)) for (const p of e.pages ?? []) {
    const fp = (p as { footprint?: { width?: number; height?: number } }).footprint;
    const fw = Math.max(1, Math.floor(fp?.width ?? 1)), fh = Math.max(1, Math.floor(fp?.height ?? 1));
    if (fw === 1 && fh === 1) continue;
    const left = e.x - Math.floor((fw - 1) / 2);
    for (let y = e.y - (fh - 1); y <= e.y; y++) for (let x = left; x < left + fw; x++) if (x >= 0 && y >= 0 && x < map.width && y < map.height && !(x === e.x && y === e.y)) set.add(y * map.width + x);
  }
  return set;
}

export function eventBlockers(map: GameMap): Set<number> {
  const set = new Set<number>();
  for (const e of eventsOf(map)) if (!hasTransfer(e)) set.add(e.y * map.width + e.x);
  return set;
}

/** 길찾기: from 에서 걸어 닿는 칸 집합. blocked 칸은 서 있는 사람이라 못 지난다. */
export function walkReach(project: Project, map: GameMap, from: Cell, blocked: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  if (blocked.has(from.y * w + from.x) || !isPassable(project, map, from.x, from.y)) return seen;
  const q: number[] = [from.y * w + from.x];
  seen[q[0]!] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j)) continue;
      if (!canMove(project, map, x, y, nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** 걷기 시작점: 시작 맵이면 startPos, 아니면 가장 큰 덩어리의 한 칸. */
export function walkStart(project: Project, map: GameMap): Cell {
  if (map.id === project.startMapId && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return { x: project.startPos.x, y: project.startPos.y };
  }
  const w = map.width;
  const done = new Uint8Array(w * map.height);
  let best: { cell: Cell; n: number } | null = null;
  const none = new Set<number>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if (done[y * w + x] || !isPassable(project, map, x, y)) continue;
      const r = walkReach(project, map, { x, y }, none);
      let n = 0;
      for (let i = 0; i < r.length; i++) if (r[i]) { n++; done[i] = 1; }
      if (!best || n > best.n) best = { cell: { x, y }, n };
    }
  }
  return best?.cell ?? { x: project.startPos.x, y: project.startPos.y };
}

export function dist(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function shortestPathCells(project: Project, map: GameMap, from: Cell, to: Cell, blocked: ReadonlySet<number>): Set<number> {
  const w = map.width;
  const prev = new Int32Array(w * map.height).fill(-2);
  const q: number[] = [from.y * w + from.x];
  prev[q[0]!] = -1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    if (x === to.x && y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (prev[j] !== -2 || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  const out = new Set<number>();
  let cur = to.y * w + to.x;
  if (prev[cur] === -2) return out;
  while (cur >= 0) { out.add(cur); cur = prev[cur]!; }
  return out;
}

/** 이 칸을 막아도 («막기 전에 닿던 칸» − 이 칸) 전부에 아직 닿는가. */
export function keepsMapConnected(project: Project, map: GameMap, start: Cell, cell: Cell, baseBlocked: ReadonlySet<number>): boolean {
  const w = map.width;
  const before = walkReach(project, map, start, baseBlocked);
  const ci = cell.y * w + cell.x;
  if (start.x === cell.x && start.y === cell.y) return false;
  const blocked = new Set(baseBlocked);
  blocked.add(ci);
  const after = walkReach(project, map, start, blocked);
  for (let i = 0; i < before.length; i++) {
    if (before[i] && i !== ci && !after[i]) return false;
  }
  return true;
}

function openness(reach: Uint8Array, map: GameMap, c: Cell, r = 2): number {
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) n++;
    }
  }
  return n;
}

/**
 * 맵 가장자리에서 걸어 닿는 칸 중 «길로 보이는» 칸. 가장자리 바닥 그림 중 가장 흔한 것(풀밭)이 아닌 칸을 길로 본다.
 * 그런 칸이 없으면 닿는 가장자리 칸 전부.
 */
export function edgeExitCells(map: GameMap, reach: Uint8Array): Cell[] {
  const w = map.width;
  const edge: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if ((x === 0 || y === 0 || x === w - 1 || y === map.height - 1) && reach[y * w + x]) edge.push({ x, y });
    }
  }
  const lower = (map as unknown as { lowerTiles?: ArrayLike<number> }).lowerTiles;
  if (!lower || edge.length === 0) return edge;
  const count = new Map<number, number>();
  for (const c of edge) count.set(lower[c.y * w + c.x], (count.get(lower[c.y * w + c.x]) ?? 0) + 1);
  let common = -1;
  let top = 0;
  for (const [k, n] of count) if (n > top) { top = n; common = k; }
  const odd = edge.filter((c) => lower[c.y * w + c.x] !== common);
  return odd.length > 0 && odd.length < edge.length ? odd : edge;
}

export interface WhereResolution {
  /** 사람이 설 칸 — 물건(footprint)이면 발밑 맨 아래 줄의 왼쪽 칸(generate_missing_object·stamp_tileset_object 의 base). */
  readonly cell: Cell;
  /** 낱말을 못 알아듣거나 못 찾아 기본 자리로 갔을 때의 한 줄. */
  readonly note?: string;
  /** 그 낱말이 가리킨 기준점(입구면 길이 나가는 가장자리 칸, 문 앞이면 문 칸, «바 옆»이면 바 칸). */
  readonly anchor?: Cell;
  /** 무엇으로 풀었나 한 줄(보고용): 「홀(tavern) 서쪽 벽 앞」「카운터 옆」. */
  readonly how?: string;
  /** 그 자리에서 볼 방향(문지기는 길 쪽). */
  readonly face?: Dir;
  /** 물건이면 발밑(막히는) 칸들. */
  readonly cells?: readonly Cell[];
}

/** 물건 크기: 가로 w 칸, 발밑(막힘) foot 줄, 그 위로 캐릭터 위에 그려지는 over 줄. base = 발밑 맨 아래 줄 왼쪽 칸. */
export interface Footprint {
  readonly w: number;
  readonly foot: number;
  readonly over: number;
}

type Side = "north" | "south" | "east" | "west";
interface RoomRect { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
interface WhereIntent {
  readonly kind: "entrance" | "plaza" | "door" | "near" | "side" | "wall" | "corner" | "window" | "center" | "default";
  readonly room?: RoomRect;
  readonly roomWord?: string;
  readonly object?: string;
  readonly relation?: "side" | "front" | "back" | "near";
  readonly wall?: Side;
}

/** 방 낱말 → 손 도트 실내 방 이름(layout kind). */
const ROOM_WORDS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/홀|주점|선술집|술집|본관|로비|접객|손님방 ?말고|hall|tavern|lobby|main ?room|bar ?room/i, ["tavern", "hall", "inn_hall", "lobby", "main", "dining", "shop", "pub"]],
  [/부엌|주방|조리실|kitchen/i, ["kitchen"]],
  [/침실|객실|손님방|bedroom|guest ?room/i, ["bedroom", "inn_room", "guest"]],
  [/서재|도서|study|library/i, ["study", "library"]],
  [/창고|저장고|storage|cellar|warehouse/i, ["storage", "cellar", "warehouse"]],
  [/천문|관측|observatory/i, ["observatory"]],
  [/가게|상점|매장|shop|store/i, ["shop", "store"]],
];

/** 물건 낱말 → 타일 이름표에서 찾을 말. */
const OBJECT_ALIASES: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/^바$|바 ?카운터|^bar$|bar counter/i, ["카운터", "counter"]],
  [/카운터|계산대|counter/i, ["카운터", "계산대", "counter"]],
  [/벽난로|난로|fireplace|hearth/i, ["벽난로", "난로", "fireplace"]],
  [/화덕|레인지|오븐|stove|oven/i, ["화덕", "레인지", "오븐", "stove"]],
  [/침대|bed/i, ["침대", "bed"]],
  [/책장|서가|bookshelf|bookcase/i, ["책장", "서가", "bookshelf"]],
  [/우물|well/i, ["우물", "well"]],
  [/분수|fountain/i, ["분수", "fountain"]],
  [/게시판|알림판|notice/i, ["게시판", "알림판", "notice"]],
  [/계단|stair/i, ["계단", "stair"]],
  [/탁자|테이블|식탁|table/i, ["탁자", "식탁", "테이블", "table"]],
  [/술통|barrel|keg/i, ["술통", "barrel", "keg"]],
  [/창문|창$|window/i, ["창문", "창 ", "window"]],
];

const SEAT_LABEL = /의자|스툴|걸상|벤치|chair|stool|bench|탁자|식탁|테이블|table/i;
const STAIR_LABEL = /계단|사다리|stair|ladder/i;
const WALL_LABEL = /벽|wall/i;
const WINDOW_LABEL = /창문|창틀|유리창|window/i;
const ROAD_LABEL = /길|도로|포석|보도|road|street|path|pavement|asphalt|cobble/i;

export function tileLabel(project: Project, map: GameMap, tile: number | undefined): string {
  if (typeof tile !== "number" || tile < 0) return "";
  const meta = (project.tilesets[map.tilesetId]?.tileMeta as unknown as ({ label?: string; tags?: readonly string[] } | undefined)[] | undefined)?.[tile];
  return meta?.label ?? "";
}

function tileTags(project: Project, map: GameMap, tile: number | undefined): readonly string[] {
  if (typeof tile !== "number" || tile < 0) return [];
  return (project.tilesets[map.tilesetId]?.tileMeta as unknown as ({ tags?: readonly string[] } | undefined)[] | undefined)?.[tile]?.tags ?? [];
}

type Layer = ArrayLike<number> | undefined;
function layers(map: GameMap): { lower: Layer; lowerOverlay: Layer; upper: Layer; upperOverlay: Layer } {
  const m = map as unknown as { lowerTiles?: Layer; lowerOverlayTiles?: Layer; upperTiles?: Layer; upperOverlayTiles?: Layer };
  return { lower: m.lowerTiles, lowerOverlay: m.lowerOverlayTiles, upper: m.upperTiles, upperOverlay: m.upperOverlayTiles };
}

/** 이 칸에 사람·물건이 «위에 놓인» 그림(가구·소품·지붕 끝)이 있는가 — 맨바닥이 아니다. */
export function objectAt(map: GameMap, c: Cell): boolean {
  const i = c.y * map.width + c.x;
  const { upper, upperOverlay } = layers(map);
  return (upper?.[i] ?? -1) >= 0 || (upperOverlay?.[i] ?? -1) >= 0;
}

/** 길(포석·도로) 칸 — 칩셋 이름표·태그로 판정. */
export function roadCellSet(project: Project, map: GameMap): Set<number> {
  const out = new Set<number>();
  const { lower, lowerOverlay } = layers(map);
  const cache = new Map<number, boolean>();
  const isRoad = (t: number | undefined): boolean => {
    if (typeof t !== "number" || t < 0) return false;
    let hit = cache.get(t);
    if (hit === undefined) {
      const tags = tileTags(project, map, t).map((x) => x.toLowerCase());
      const label = tileLabel(project, map, t);
      hit = tags.includes("road") || tags.includes("street") || tags.includes("path") || tags.includes("길") || (ROAD_LABEL.test(label) && !/풀|잔디|grass/i.test(label));
      cache.set(t, hit);
    }
    return hit;
  };
  for (let i = 0; i < map.width * map.height; i++) if (isRoad(lower?.[i]) || isRoad(lowerOverlay?.[i])) out.add(i);
  return out;
}

function roomsOf(map: GameMap): RoomRect[] {
  const locs = (map.locations ?? []) as unknown as { name?: string; x?: number; y?: number; w?: number; h?: number; tags?: string[] }[];
  return locs
    .filter((l) => typeof l.x === "number" && typeof l.y === "number" && typeof l.w === "number" && typeof l.h === "number" && (l.tags ?? []).includes("hand-layout-room"))
    .map((l) => ({ name: String(l.name ?? ""), x: l.x!, y: l.y!, w: l.w!, h: l.h! }));
}

function inRoom(room: RoomRect, c: Cell, pad = 0): boolean {
  return c.x >= room.x - pad && c.y >= room.y - pad && c.x < room.x + room.w + pad && c.y < room.y + room.h + pad;
}

function parseWhere(map: GameMap, word: string | undefined): WhereIntent {
  const w = (word ?? "").trim().toLowerCase();
  if (!w) return { kind: "default" };
  const rooms = roomsOf(map);
  let room: RoomRect | undefined;
  let roomWord: string | undefined;
  for (const [re, names] of ROOM_WORDS) {
    const m = re.exec(w);
    if (!m) continue;
    roomWord = m[0];
    room = rooms.find((r) => names.some((n) => r.name.toLowerCase().includes(n)));
    // «홀» 은 이름이 달라도 가장 큰 방(손님을 받는 방)이다.
    if (!room && names.includes("tavern") && rooms.length) room = [...rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    break;
  }
  const base = { ...(room ? { room } : {}), ...(roomWord ? { roomWord } : {}) };
  if (/문 ?앞|문앞|현관|doorway|front door/.test(w)) return { kind: "door", ...base };
  const rel = /^(.*?)\s*(?:의\s*)?(옆|곁|근처|가까이|주변|앞|뒤|beside|next to|near|in front of|behind)/u.exec(w);
  if (rel) {
    let obj = rel[1]!.trim();
    if (roomWord) obj = obj.replace(roomWord, "").trim();
    obj = obj.replace(/^(그|저|이)\s+/u, "").split(/\s+/u).filter(Boolean).slice(-2).join(" ");
    const relation = /앞|in front/.test(rel[2]!) ? "front" : /뒤|behind/.test(rel[2]!) ? "back" : /옆|곁|beside|next/.test(rel[2]!) ? "side" : "near";
    if (obj && /^(입구|출입구|정문|entrance|gate)$/.test(obj)) return { kind: "entrance", ...base };
    if (obj && /^(창|창문|창가|window)$/.test(obj)) return { kind: "window", ...base };
    if (obj && !/^(벽|wall)$/.test(obj)) return { kind: "near", object: obj, relation, ...base };
  }
  if (/입구|성문|정문|출입구|마을 ?어귀|어귀|entrance|gate|entry/.test(w)) return { kind: "entrance", ...base };
  const wall = /(북|남|동|서)\s*쪽?\s*벽|(north|south|east|west)(?:ern)?\s+wall/u.exec(w);
  if (wall) {
    const d = wall[1] ?? wall[2]!;
    const side: Side = /북|north/.test(d) ? "north" : /남|south/.test(d) ? "south" : /동|east/.test(d) ? "east" : "west";
    return { kind: "wall", wall: side, ...base };
  }
  if (/구석|모퉁이|corner/.test(w)) return { kind: "corner", ...base };
  if (/창가|창문|window/.test(w)) return { kind: "window", ...base };
  if (/한\s*쪽|한\s*켠|가장자리|벽\s*쪽|벽가|벽\s*앞|벽\s*옆|\bside\b|edge|along the wall/.test(w)) return { kind: "side", ...base };
  if (/가운데|중앙|한가운데|center|centre|middle/.test(w)) return room ? { kind: "center", ...base } : { kind: "plaza", ...base };
  if (/광장|plaza|square/.test(w)) return { kind: "plaza", ...base };
  if (room) return { kind: "center", ...base };
  return { kind: "default" };
}

function objectAliases(word: string): string[] {
  const out: string[] = [];
  for (const [re, names] of OBJECT_ALIASES) if (re.test(word)) out.push(...names);
  return out.length ? out : [word];
}

/** 이름표에 그 물건 낱말이 들어간 칸들의 덩이(가장 그럴듯한 하나). */
function findObjectBox(project: Project, map: GameMap, word: string, room: RoomRect | undefined, near: Cell): { x0: number; y0: number; x1: number; y1: number; label: string } | undefined {
  const aliases = objectAliases(word).map((a) => a.toLowerCase());
  const { lower, lowerOverlay, upper, upperOverlay } = layers(map);
  const hit = new Uint8Array(map.width * map.height);
  const labels = new Map<number, string>();
  const labelCache = new Map<number, boolean>();
  const matches = (t: number | undefined): string | undefined => {
    if (typeof t !== "number" || t < 0) return undefined;
    const label = tileLabel(project, map, t);
    let ok = labelCache.get(t);
    if (ok === undefined) { ok = !!label && aliases.some((a) => label.toLowerCase().includes(a)) && !/바닥|floor/i.test(label); labelCache.set(t, ok); }
    return ok ? label : undefined;
  };
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (room && !inRoom(room, { x, y }, 1)) continue;
    const i = y * map.width + x;
    const label = matches(upperOverlay?.[i]) ?? matches(upper?.[i]) ?? matches(lowerOverlay?.[i]) ?? matches(lower?.[i]);
    if (label) { hit[i] = 1; labels.set(i, label); }
  }
  // 8방향 덩이.
  const seen = new Uint8Array(hit.length);
  let best: { x0: number; y0: number; x1: number; y1: number; label: string; score: number } | undefined;
  for (let i = 0; i < hit.length; i++) {
    if (!hit[i] || seen[i]) continue;
    const q = [i];
    seen[i] = 1;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let k = 0; k < q.length; k++) {
      const j = q[k]!;
      const x = j % map.width, y = (j - x) / map.width;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
        const n = ny * map.width + nx;
        if (hit[n] && !seen[n]) { seen[n] = 1; q.push(n); }
      }
    }
    const score = q.length * 2 - dist({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, near) * 0.3;
    if (!best || score > best.score) best = { x0, y0, x1, y1, label: labels.get(i) ?? word, score };
  }
  return best;
}

/**
 * 자리 낱말 → 실제로 걸어 닿는 빈 칸(물건이면 발밑 칸들이 다 비고, 막아도 길이 끊기지 않는 base). 못 찾으면 기본 자리(시작 근처) + note.
 * 알아듣는 낱말: 입구·성문 / 광장·가운데 / 문 앞 / «X 옆·앞·뒤»(카운터·바·벽난로·우물… 칩셋 이름표로 찾는다) /
 * 한쪽·벽 쪽 / 북쪽 벽(남·동·서) / 구석 / 창가 — 방 낱말(홀·부엌·침실…)이 같이 오면 손 도트 실내의 그 방 안에서.
 * avoid: 이미 쓴 칸(다른 사람·컷신 자리).
 */
export function resolveWhere(
  project: Project,
  map: GameMap,
  word: string | undefined,
  opts: { at?: Cell; avoid?: readonly Cell[]; keepFree?: readonly Cell[]; footprint?: Footprint; role?: string } = {},
): WhereResolution {
  const w = map.width;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  const bodies = eventBodyCells(map);
  const reach = terrainReachability(project, map, start);
  const transferList = transferCells(map);
  const transfers = new Set(transferList.map((c) => c.y * w + c.x));
  const avoid = new Set((opts.avoid ?? []).map((c) => c.y * w + c.x));
  for (const c of opts.keepFree ?? []) avoid.add(c.y * w + c.x);
  const playerStart = project.startMapId === map.id ? project.startPos : null;
  const fp = opts.footprint;
  const isObject = !!fp;
  const indoor = (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor" || roomsOf(map).length > 0;
  const { lower } = layers(map);
  const labelAt = (c: Cell): string => tileLabel(project, map, layers(map).upper?.[c.y * w + c.x]) || tileLabel(project, map, layers(map).upperOverlay?.[c.y * w + c.x]);

  const inside = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < w && c.y < map.height;
  // 사람은 차도·선로 칸과 하나뿐인 출구 길목에 서지 않는다(2026-10-25 사용자 규칙·J5). 물건(footprint)도 차도에 놓지 않는다.
  const lanes = laneCells(project, map);
  const throats = fp ? new Set<number>() : exitThroats(project, map);
  const usableCell = (c: Cell): boolean => {
    if (!inside(c)) return false;
    const i = c.y * w + c.x;
    if (!reach[i] || blockers.has(i) || bodies.has(i) || transfers.has(i) || avoid.has(i) || lanes.has(i) || throats.has(i)) return false;
    if (playerStart && c.x === playerStart.x && c.y === playerStart.y) return false;
    // 사람은 시작 칸 바로 위·아래에 세우지 않는다 — 3/4 시점에서 주인공 머리 위에 다른 사람이 올라탄 것처럼 겹쳤다(2026-10-29 야외 VQA vm2 terra jrpg 319·350).
    if (!fp && playerStart && c.x === playerStart.x && Math.abs(c.y - playerStart.y) === 1) return false;
    if ((isObject || indoor) && objectAt(map, c)) return false; // 가구·소품 칸 위에 서거나 놓지 않는다
    return true;
  };
  const footCells = (b: Cell): Cell[] => {
    if (!fp) return [b];
    const out: Cell[] = [];
    for (let dy = 0; dy < fp.foot; dy++) for (let dx = 0; dx < fp.w; dx++) out.push({ x: b.x + dx, y: b.y - dy });
    return out;
  };
  const overCells = (b: Cell): Cell[] => {
    if (!fp) return [];
    const out: Cell[] = [];
    for (let dy = 0; dy < fp.over; dy++) for (let dx = 0; dx < fp.w; dx++) out.push({ x: b.x + dx, y: b.y - fp.foot - dy });
    return out;
  };
  const fits = (b: Cell): boolean => {
    if (!footCells(b).every(usableCell)) return false;
    // 위로 솟은 줄: 맵 안이고 다른 가구 위로 겹치지 않는다(벽 앞이면 벽 면에 걸치는 것은 괜찮다).
    return overCells(b).every((c) => inside(c) && !objectAt(map, c) && !transfers.has(c.y * w + c.x) && !blockers.has(c.y * w + c.x));
  };
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) if (fits({ x, y })) cells.push({ x, y });

  const before = walkReach(project, map, start, blockers);
  const connectedWithout = (block: readonly Cell[]): boolean => {
    if (block.some((c) => c.x === start.x && c.y === start.y)) return false;
    const blocked = new Set(blockers);
    for (const c of block) blocked.add(c.y * w + c.x);
    const after = walkReach(project, map, start, blocked);
    for (let i = 0; i < before.length; i++) if (before[i] && !blocked.has(i) && !after[i]) return false;
    // 물건은 다른 가구(탁자·의자·카운터) 앞의 쓰는 칸을 막지 않는다 — 그 가구 둘레에 걸어 닿는 칸이 하나는 남아야 한다.
    return true;
  };
  // 바깥 맵의 사람은 길 위가 아니라 길가에 선다(2026-10-23 3차 몬스터 마을: 주민 둘이 큰길 한가운데 서서 길을 좁혔다).
  const outdoorRoads = !fp && !indoor ? roadCellSet(project, map) : undefined;
  const roadCost = (c: Cell): number => (outdoorRoads?.has(c.y * w + c.x) ? 8 : 0);
  const pick = (score: (c: Cell) => number): Cell | undefined => {
    const ranked = cells.map((c) => ({ c, s: score(c) + roadCost(c) })).filter((r) => Number.isFinite(r.s)).sort((a, b) => a.s - b.s);
    let tries = 0;
    for (const { c } of ranked) {
      if (++tries > 80) break;
      if (connectedWithout(footCells(c))) return c;
    }
    return undefined;
  };
  const done = (cell: Cell, extra: Omit<WhereResolution, "cell" | "cells">): WhereResolution => ({ cell, ...extra, ...(fp ? { cells: footCells(cell) } : {}) });

  // 칸을 직접 줬으면 가장 가까운 쓸 수 있는 칸.
  if (opts.at) {
    const at = opts.at;
    const c = pick((q) => dist(q, at));
    if (c) {
      const moved = c.x !== at.x || c.y !== at.y;
      return done(c, { ...(moved ? { note: `at (${at.x},${at.y}) 은 ${fp ? `${fp.w}×${fp.foot + fp.over} 물건을 놓을 수 없는` : "못 서는"} 칸이라 (${c.x},${c.y}) 로 옮겼다.` } : {}), how: `칸 (${c.x},${c.y})` });
    }
  }

  // 도움 함수: 방 안 칸의 벽 쪽(이웃이 방 밖이거나, 가구 아닌 못 가는 칸·벽 그림).
  const wallish = (x: number, y: number, room: RoomRect | undefined): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= map.height) return true;
    if (room && !inRoom(room, { x, y })) return true;
    const c = { x, y };
    if (isPassable(project, map, x, y)) return false;
    return !objectAt(map, c) || WALL_LABEL.test(tileLabel(project, map, lower?.[y * w + x]));
  };
  const wallSides = (b: Cell, room: RoomRect | undefined): Set<Side> => {
    const out = new Set<Side>();
    for (const c of footCells(b)) {
      if (wallish(c.x - 1, c.y, room)) out.add("west");
      if (wallish(c.x + 1, c.y, room)) out.add("east");
      if (wallish(c.x, c.y + 1, room)) out.add("south");
    }
    // 북쪽: 발밑 맨 윗줄(물건이면 위로 솟은 줄 위) 바로 위가 벽.
    const topY = fp ? b.y - fp.foot - fp.over + 1 : b.y;
    for (let dx = 0; dx < (fp?.w ?? 1); dx++) if (wallish(b.x + dx, topY - 1, room) || (fp && fp.over > 0 && wallish(b.x + dx, b.y - fp.foot, room))) out.add("north");
    return out;
  };
  const doors = [...transferList, ...(indoor ? edgeExitCells(map, reach) : [])];
  const doorDist = (b: Cell): number => Math.min(99, ...doors.map((d) => Math.min(...footCells(b).map((c) => dist(c, d)))));
  const touchesLabel = (b: Cell, re: RegExp): boolean => footCells(b).some((c) => DIRS.some(([dx, dy]) => {
    const n = { x: c.x + dx, y: c.y + dy };
    return inside(n) && re.test(labelAt(n));
  }));

  const intent = parseWhere(map, word);
  const room = intent.room;
  const roomName = room ? `${intent.roomWord ?? room.name}(${room.name})` : "";
  const roomOk = (b: Cell): boolean => !room || footCells(b).every((c) => inRoom(room, c));
  if (intent.roomWord && !room) {
    // 방 낱말을 알아들었지만 이 맵에 그 방 기록이 없다 — 맵 전체에서 푼다.
  }
  const sideName: Record<Side, string> = { north: "북쪽 벽", south: "남쪽 벽", east: "동쪽 벽", west: "서쪽 벽" };

  // 가게 주인은 카운터 뒤(북쪽)에 선다 — 「카운터 앞」이라 써도 손님 자리(남쪽)에 세우지 않는다(2026-10-25 J6: 무기점 주인이 빈 바닥 너머로 말했다).
  const keeper = !fp && isShopkeeperName(`${opts.role ?? ""}`);
  if (keeper && intent.kind !== "near" && intent.kind !== "entrance" && intent.kind !== "door" && indoor) {
    const behind = cells.filter((c) => counterSide(project, map, c) === "behind" && (!room || inRoom(room, c)));
    const c = behind.length ? pick((q) => (counterSide(project, map, q) === "behind" && (!room || inRoom(room, q)) ? dist(q, start) * 0.05 : Infinity)) : undefined;
    if (c) return done(c, { how: "카운터 뒤(주인 쪽)", face: "down" });
  }
  if (intent.kind === "near" && intent.object) {
    const centre = room ? { x: room.x + room.w / 2, y: room.y + room.h / 2 } : start;
    const box = findObjectBox(project, map, intent.object, room, centre);
    if (box) {
      const cx = (box.x0 + box.x1) / 2;
      const counterBox = isCounterArt(project, map, box.x0, box.y1);
      let rel = keeper && counterBox ? "back" : intent.relation ?? "near";
      const score = (b: Cell): number => {
        if (!roomOk(b)) return Infinity;
        const feet = footCells(b);
        const fx0 = Math.min(...feet.map((f) => f.x)), fx1 = Math.max(...feet.map((f) => f.x));
        const fy0 = Math.min(...feet.map((f) => f.y)), fy1 = Math.max(...feet.map((f) => f.y));
        const gapX = fx1 < box.x0 ? box.x0 - fx1 : fx0 > box.x1 ? fx0 - box.x1 : 0;
        const gapY = fy1 < box.y0 ? box.y0 - fy1 : fy0 > box.y1 ? fy0 - box.y1 : 0;
        let s: number;
        if (rel === "side") s = gapX === 0 || gapY > 1 ? Infinity : (gapX - 1) * 2 + Math.abs(fy1 - box.y1) * 0.5;
        else if (rel === "front") s = fy0 <= box.y1 || gapX > 1 ? Infinity : (fy0 - box.y1 - 1) * 1.5 + Math.abs((fx0 + fx1) / 2 - cx) * 0.3;
        else if (rel === "back") s = fy1 >= box.y0 || gapX > 1 ? Infinity : (box.y0 - fy1 - 1) * 1.5 + Math.abs((fx0 + fx1) / 2 - cx) * 0.3;
        else s = Math.max(gapX, gapY) === 0 ? Infinity : Math.max(gapX, gapY) - 1 + (gapX && gapY ? 0.5 : 0);
        if (!Number.isFinite(s) || Math.max(gapX, gapY) > 3) return Infinity;
        return s + (doorDist(b) < 3 ? 6 : 0) + (isObject && touchesLabel(b, SEAT_LABEL) ? 2 : 0) + (touchesLabel(b, STAIR_LABEL) ? 4 : 0);
      };
      let c = pick(score);
      // 그 쪽(옆·앞·뒤)이 벽·가구로 막혔으면 둘레 아무 쪽(근처)으로 — 부엌 화덕은 옆이 다 조리대다.
      if (!c && rel !== "near") { rel = "near"; c = pick(score); }
      const relWord = rel === "side" ? "옆" : rel === "front" ? "앞" : rel === "back" ? "뒤" : "근처";
      if (c) return done(c, { anchor: { x: box.x0, y: box.y0 }, how: `${roomName ? `${roomName} ` : ""}${box.label}(${box.x0},${box.y0}) ${relWord}`,
        face: dirTowardCell(c, { x: Math.round(cx), y: Math.round((box.y0 + box.y1) / 2) }) });
    }
    // 물건을 못 찾으면 방 낱말만으로(아래).
  }

  if (intent.kind === "entrance") {
    // 길이 맵 밖으로 나가는 곳: 가장자리에서 걸어 닿는 길 칸(없으면 가장자리 칸) — 시작에서 가장 가까운 것.
    const roads = roadCellSet(project, map);
    const edge = edgeExitCells(map, reach);
    const roadEdge = edge.filter((c) => roads.has(c.y * w + c.x));
    const exit = (roadEdge.length ? roadEdge : edge).sort((a, b) => dist(a, start) - dist(b, start))[0];
    if (exit) {
      const onRoad = shortestPathCells(project, map, exit, start, blockers);
      const adjRoad = (q: Cell): Cell | undefined => DIRS.map(([dx, dy]) => ({ x: q.x + dx, y: q.y + dy })).find((n) => inside(n) && (roads.size ? roads.has(n.y * w + n.x) : onRoad.has(n.y * w + n.x)));
      const c = pick((q) => {
        if (fp && !roomOk(q)) return Infinity;
        const d = dist(q, exit);
        const i = q.y * w + q.x;
        const isRoad = roads.has(i) || onRoad.has(i);
        const beside = !!adjRoad(q);
        const onEdge = q.x === 0 || q.y === 0 || q.x === w - 1 || q.y === map.height - 1;
        return Math.abs(d - 2.5) + (isRoad ? 8 : 0) + (beside ? 0 : 4) + (onEdge ? 2 : 0) + (objectAt(map, q) ? 3 : 0) - Math.min(openness(reach, map, q), 14) * 0.05;
      });
      if (c) {
        // 길을 따라 마을 안쪽을 본다(들어오는 길 옆에 서서 안쪽 길을 지킨다): 입구에서 길로 5칸쯤 들어간 칸 쪽.
        const inner = [...onRoad].map((i) => ({ x: i % w, y: Math.floor(i / w) })).sort((a, b) => Math.abs(dist(a, exit) - 5) - Math.abs(dist(b, exit) - 5))[0];
        const face = inner && (inner.x !== exit.x || inner.y !== exit.y) ? dirTowardCell(exit, inner) : adjRoad(c) ? dirTowardCell(c, adjRoad(c)!) : undefined;
        return done(c, { anchor: exit, how: `입구 — 길이 맵 밖으로 나가는 (${exit.x},${exit.y}) 곁 길가, 마을 안쪽을 봄`, ...(face ? { face } : {}) });
      }
    }
  } else if (intent.kind === "plaza") {
    const centre = { x: Math.floor(w / 2), y: Math.floor(map.height / 2) };
    const c = pick((q) => -openness(reach, map, q, 2) + dist(q, centre) * 0.4);
    if (c) return done(c, { anchor: centre, how: "광장(트인 한가운데)" });
  } else if (intent.kind === "door") {
    const doorList = (indoor ? doors : transferList).filter((d) => reach[d.y * w + d.x]).sort((a, b) => dist(a, start) - dist(b, start));
    const door = doorList[0];
    if (door) {
      const c = pick((q) => {
        const d = dist(q, door);
        const inFront = q.x === door.x && (q.y === door.y + 1 || q.y === door.y - 1);
        return Math.abs(d - 2) + (inFront ? 5 : 0) + (d > 4 ? 20 : 0);
      });
      if (c) return done(c, { anchor: door, how: `문 (${door.x},${door.y}) 앞` });
    }
  } else if (intent.kind === "side" || intent.kind === "wall" || intent.kind === "corner" || intent.kind === "window") {
    const want = intent.wall;
    const midY = room ? room.y + room.h / 2 : map.height / 2;
    const midX = room ? room.x + room.w / 2 : w / 2;
    const span = room ? Math.max(room.w, room.h) : Math.max(w, map.height);
    const c = pick((b) => {
      if (!roomOk(b)) return Infinity;
      const sides = wallSides(b, room);
      let s: number;
      if (intent.kind === "wall") s = sides.has(want!) ? 0 : Infinity;
      else if (intent.kind === "corner") s = (sides.has("west") || sides.has("east")) && (sides.has("north") || sides.has("south")) ? (sides.has("south") ? 2 : 0) : Infinity;
      else if (intent.kind === "window") s = touchesLabel(b, WINDOW_LABEL) || footCells(b).some((f) => WINDOW_LABEL.test(labelAt({ x: f.x, y: f.y - 1 }))) ? 0 : sides.size ? 5 : Infinity;
      // 한쪽: 옆벽(동·서)이 먼저, 북벽은 다음, 문이 있는 남벽은 마지막.
      else s = sides.has("west") || sides.has("east") ? 0 : sides.has("north") ? 1.5 : sides.has("south") ? 4 : Infinity;
      if (!Number.isFinite(s)) return Infinity;
      const along = intent.kind === "wall" && (want === "north" || want === "south") ? Math.abs(b.x + (fp?.w ?? 1) / 2 - midX) : Math.abs(b.y - midY);
      return s + (doorDist(b) < 4 ? 8 : 0) + (touchesLabel(b, SEAT_LABEL) ? 3 : 0) + (touchesLabel(b, STAIR_LABEL) ? 5 : 0) + (along / span) * 2;
    });
    if (c) {
      const sides = [...wallSides(c, room)].filter((s) => s !== "south" || intent.wall === "south");
      const label = intent.kind === "wall" ? sideName[want!] : intent.kind === "corner" ? "구석" : intent.kind === "window" ? "창가" : `한쪽(${sides.map((s) => sideName[s]).join("·") || "벽"} 앞)`;
      const face: Dir | undefined = sides.includes("west") ? "right" : sides.includes("east") ? "left" : sides.includes("north") ? "down" : undefined;
      return done(c, { how: `${roomName ? `${roomName} ` : ""}${label}`, ...(face ? { face } : {}) });
    }
  } else if (intent.kind === "center" && room) {
    const centre = { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
    const c = pick((b) => (roomOk(b) ? dist(b, centre) - Math.min(openness(reach, map, b), 14) * 0.05 + (doorDist(b) < 3 ? 6 : 0) : Infinity));
    if (c) return done(c, { anchor: centre, how: `${roomName} 가운데` });
  }

  // 방 낱말만 알아들은 경우: 그 방 안에서 기본(벽 쪽·문에서 먼 곳).
  if (room) {
    const centre = { x: Math.floor(room.x + room.w / 2), y: Math.floor(room.y + room.h / 2) };
    const c = pick((b) => (roomOk(b) ? (wallSides(b, room).size ? 0 : 2) + (doorDist(b) < 4 ? 8 : 0) + dist(b, centre) * 0.1 : Infinity));
    if (c) return done(c, { how: `${roomName} 안`, note: intent.kind === "default" || intent.kind === "center" ? undefined : `'${word}' 의 자리를 ${roomName} 에서 못 찾아 그 방 안 (${c.x},${c.y}) 에 두었다.` });
  }

  // 기본: 시작 근처(3~4칸), 트인 곳.
  const c = pick((q) => Math.abs(dist(q, start) - 3.5) - Math.min(openness(reach, map, q), 14) * 0.05 + (objectAt(map, q) ? 3 : 0));
  if (c) {
    const miss = intent.kind === "default" ? (word ? `자리 낱말 '${word}' 을 몰라` : undefined) : `'${word}' 자리를 이 맵에서 못 찾아`;
    return done(c, { how: "시작 근처", ...(miss ? { note: `${miss} 시작 지점 근처 (${c.x},${c.y}) 에 두었다.` } : {}) });
  }
  return done(start, { note: fp ? `${fp.w}×${fp.foot + fp.over} 물건을 길을 막지 않고 놓을 빈 바닥을 못 찾았다.` : "걸어 닿는 빈 칸을 못 찾았다." });
}

export function dirTowardCell(from: Cell, to: Cell): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? "right" : "left";
  return dy < 0 ? "up" : "down";
}

// ───────────────────────── 그림 고르기 ─────────────────────────

// v1 charset 검색은 «경비병·문지기·촌장» 같은 역할 낱말을 모른다. 역할·외형 낱말을 아는 질의로 바꾸고, 후보 중에서
// 마을 사람에게 맞지 않는 그림(몬스터·언데드·해골 투구)을 빼고, 검토된 짝 얼굴이 있는 그림을 먼저 고른다
// (2026-10-23 v1/v2 눈가림 비교: v2 문지기가 해골 투구 갑옷(적처럼 읽힘)에 얼굴 없음).
const ROLE_LOOKS: ReadonlyArray<readonly [RegExp, readonly string[], ("male" | "female")?]> = [
  [/경비|문지기|수문장|파수|위병|보초|병사|군인|초병|guard|sentry|gatekeeper|soldier|watchman/i, ["병사", "guard"], "male"],
  [/촌장|이장|장로|원로|마을 ?어른|elder|chief|headman|mayor/i, ["할아버지", "노인"], "male"],
  // 청사진 단계 이름의 직함(2026-10-28 standin joseon·magic: 포졸·주모·종사관·교수·사서가 전부 「중년 남성 주민」이 됐다).
  [/포졸|포교|나졸|군졸|순라/i, ["병사", "guard"], "male"],
  [/종사관|사또|대감|양반|관원|나리|선비|영주|귀족|noble|lord/i, ["귀족", "노학자"], "male"],
  [/주모|여주인|안주인|주인댁/i, ["아줌마", "여관 주인"], "female"],
  [/교장|학장|headmaster|principal/i, ["교수", "노학자"]],
  [/교수|박사|학자|연구원|professor|scholar|researcher/i, ["교수", "노학자", "박사"]],
  [/사서|librarian/i, ["사서", "노학자"]],
  [/선생|교사|스승|teacher|tutor/i, ["선생", "교수"]],
  [/의사|doctor|medic/i, ["박사", "연구원"]],
  [/할머니|노파|old woman|grandma/i, ["할머니", "노인"], "female"],
  [/할아버지|노인|영감|old man|grandpa/i, ["할아버지", "노인"], "male"],
  [/여관|바텐더|술집 ?주인|주점 ?주인|innkeeper|bartender|barkeep/i, ["여관 주인", "상인"]],
  [/상인|장사|점원|가게|행상|merchant|shopkeeper|vendor|clerk|peddler/i, ["상인", "여관 주인"]],
  [/소녀|여자아이|girl/i, ["소녀", "아이"], "female"],
  [/소년|남자아이|boy/i, ["소년", "아이"], "male"],
  [/아이|꼬마|어린이|child|kid/i, ["아이"]],
  [/기사|knight|paladin/i, ["기사", "병사"]],
  [/마법사|마녀|wizard|mage|witch/i, ["마법사"]],
  [/신부|사제|수녀|성직자|priest|monk|nun|cleric/i, ["사제", "priest"]],
  [/왕|king/i, ["king"], "male"],
  [/농부|농사|farmer/i, ["아저씨", "주민"]],
  [/아주머니|아줌마|부인|여성|woman/i, ["아줌마", "여성"], "female"],
  [/아저씨|남성|man\b/i, ["아저씨", "남성"], "male"],
];
const HOSTILE = /몬스터|언데드|해골|스켈레톤|좀비|유령|악마|뱀파이어|오크|고블린|슬라임|마물|monster|undead|skeleton|zombie|ghost|demon|vampire|orc|goblin|slime/i;

const ODD_LOOK = /이국|터번|닌자|요정|난쟁이|수녀|해적|광대|ninja|fairy|dwarf|nun|pirate|clown/i;

export interface PersonGraphic {
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly faceResourceId?: string;
  readonly query: string;
}

/** 역할·외형 낱말 → v1 이 알아듣는 질의 순서(중복 제거, 마지막은 주민). */
export function graphicQueries(looks: string | undefined, role: string | undefined): string[] {
  const out: string[] = [];
  const add = (q: string | undefined): void => {
    const t = (q ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const word of [looks, role]) {
    add(word);
    for (const [re, alts] of ROLE_LOOKS) if (word && re.test(word)) for (const a of alts) add(a);
  }
  add("villager");
  return out;
}

function wantedGender(looks: string | undefined, role: string | undefined): "male" | "female" | undefined {
  for (const word of [looks, role]) for (const [re, , g] of ROLE_LOOKS) if (word && g && re.test(word)) return g;
  return undefined;
}

/** 이 맵 화풍에 맞는 칩 계열인가 — 판타지(버들항·손 도트 실내) 맵에는 EasyRPG 사람 칩, 현대 맵에는 현대 칩. */
function familyFits(map: GameMap, textureKey: string): boolean {
  const modern = /jp_|modern|city_modern|campus|school|office/i.test(map.tilesetId);
  const fantasyChip = /^tex_easyrpg_charset_(people|actor)|^tex_(oprn_charset_)?scarloxy_(charset_)?people/i.test(textureKey);
  return modern ? !fantasyChip : fantasyChip;
}

/**
 * 역할·외형에 맞는 «우호적인 사람» 칩 하나. 몬스터·언데드는 역할 자체가 그것일 때만, 짝 얼굴 있는 칩 먼저, 맵 화풍 계열 먼저,
 * 같은 맵에 이미 쓴 칩은 뒤로.
 */
export function pickPersonGraphic(project: Project, map: GameMap, role: string | undefined, looks: string | undefined): PersonGraphic | undefined {
  const asked = `${role ?? ""} ${looks ?? ""}`;
  const hostileOk = HOSTILE.test(asked);
  const gender = wantedGender(looks, role);
  const used = new Set<string>();
  for (const e of eventsOf(map)) {
    const g = e.pages?.[0]?.graphic as { sprite?: { id?: string }; pattern?: number } | undefined;
    if (g?.sprite?.id && typeof g.pattern === "number" && g.pattern >= 3) used.add(`${g.sprite.id}#${decodeCharsetFrameIndex(g.pattern).characterIndex}`);
  }
  // 주인공(시작 파티) 칩은 NPC 에 쓰지 않는다 — 2026-10-29 vm mystery: 용의자 「마부 한스」가 탐정 주인공과 같은 칩으로 서 있었다.
  const resKey = (s: string) => s.replace(/^tex_/u, "").replace(/[_-]/gu, "").toLowerCase();
  const heroes = new Set((project.system?.startActorIds ?? []).flatMap((id) => {
    const actor = project.database.actors.find((a) => a.id === id) as { characterResourceId?: string; characterIndex?: number } | undefined;
    return actor?.characterResourceId ? [`${resKey(actor.characterResourceId)}#${actor.characterIndex ?? 0}`] : [];
  }));
  const overrides = (project as unknown as { charsetLabels?: Parameters<typeof queryNpcGraphics>[2] }).charsetLabels;
  let best: (PersonGraphic & { score: number }) | undefined;
  // 장르 잠금(몬스터 수집·현대 연애)이 강제 중이면 허용 칩만 — 막힌 칩을 골라 place_npc 가 거부하던 길을 미리 막는다.
  const allowed = genreLockCharsetCatalogFilter(project);
  const queries = graphicQueries(looks, role);
  queries.forEach((q, qi) => {
    queryNpcGraphics(q, 30, overrides).forEach((m, rank) => {
      const e = m.entry;
      const text = `${e.label} ${e.tags.join(" ")} ${e.textureKey}`;
      // 「몬스터 수집」 장르 꼬리표가 붙은 사람 칩(Scarloxy 트레이너·주민)은 적이 아니다 — 그 낱말을 빼고 적 낱말을 본다.
      const hostileText = text.replace(/몬스터 ?수집|monster[- ]?collect(ion|ing)?/giu, "");
      if (!hostileOk && (HOSTILE.test(hostileText) || /monster/i.test(e.textureKey))) return;
      if (allowed && !allowed(e)) return;
      const row = sharedCharsetRow(e.textureKey, e.characterIndex);
      const face = row?.status === "mapped" && row.faceResourceId ? row.faceResourceId : undefined;
      const key = `${e.textureKey}#${e.characterIndex}`;
      const score = qi * 100 + rank + (face ? 0 : 70) + (familyFits(map, e.textureKey) ? 0 : 45)
        + (gender && e.gender && e.gender !== "none" && e.gender !== gender ? 25 : 0) + (used.has(key) ? 15 : 0)
        + (heroes.has(`${resKey(e.textureKey)}#${e.characterIndex}`) ? 300 : 0)
        // 특이한 차림(이국 터번·닌자·요정·난쟁이·수녀)은 그렇게 말했을 때만 — 마을 촌장이 터번 노인으로 나왔다.
        + (ODD_LOOK.test(text) && !ODD_LOOK.test(asked) ? 20 : 0);
      if (!best || score < best.score) best = { textureKey: e.textureKey, characterIndex: e.characterIndex, label: e.label, query: q, score, ...(face ? { faceResourceId: face } : {}) };
    });
  });
  if (!best) return undefined;
  const { score: _score, ...pick } = best;
  return pick;
}

/** 놓은 NPC 의 모든 페이지 그림을 그 방향으로 돌려 세운다(문지기는 길 쪽을 본다). */
export function faceNpc(run: BuildRun, mapId: string, eventId: string, dir: Dir): void {
  const map = findMap(run.ctx.project, mapId);
  const event = map ? eventsOf(map).find((e) => e.id === eventId) : undefined;
  (event?.pages ?? []).forEach((page, pageIndex) => {
    const g = page.graphic as { sprite?: unknown; pattern?: number; direction?: Dir } | undefined;
    if (!g?.sprite) return;
    const characterIndex = typeof g.pattern === "number" && g.pattern >= 3 ? decodeCharsetFrameIndex(g.pattern).characterIndex : 0;
    run.call("patch_event_page", { mapId, eventId, pageIndex, set: { graphic: { ...g, direction: dir, pattern: charsetFrameIndex({ characterIndex, direction: dir, pattern: 1 }) } } });
  });
}

// ───────────────────────── 사람 놓기 ─────────────────────────

function cleanLines(lines: readonly string[] | undefined): string[] {
  return (lines ?? []).map((s) => String(s).trim()).filter(Boolean);
}

/**
 * place_npc 한 번: 역할·외형에 맞는 우호적 사람 칩(짝 얼굴 우선)을 골라 {textureKey,characterIndex} 로 놓는다 — 대사가 있으면
 * place_npc 가 그 칩의 검토된 짝 얼굴을 대사 앞에 붙인다. 고른 칩으로 실패하면 질의 낱말 → 도구 기본 그림 순서로 물러난다.
 */
export function placeNpcWithGraphic(run: BuildRun, map: GameMap, baseArgs: Record<string, unknown>, role: string | undefined, looks: string | undefined, label: string, warnings: string[]): { result: ReturnType<BuildRun["call"]>; graphic?: PersonGraphic } {
  const graphic = pickPersonGraphic(run.ctx.project, map, role, looks);
  if (graphic) {
    const result = run.call("place_npc", { ...baseArgs, graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex } });
    if (result.ok) {
      if (!graphic.faceResourceId) warnings.push(`${label}: 고른 그림 '${graphic.label}' 에 검토된 짝 얼굴이 없어 대화창에 얼굴이 안 나온다.`);
      return { result, graphic };
    }
  } else warnings.push(`${label}: 역할·외형(${[role, looks].filter(Boolean).join("·")})에 맞는 사람 그림을 못 찾았다.`);
  let result: ReturnType<BuildRun["call"]> | undefined;
  for (const q of graphicQueries(looks, role)) {
    result = run.call("place_npc", { ...baseArgs, graphic: { query: q } });
    if (result.ok) { warnings.push(`${label}: 그림을 질의 '${q}' 로 놓았다(직접 고르기 실패).`); return { result }; }
  }
  result = run.call("place_npc", baseArgs);
  if (result.ok) warnings.push(`${label}: 그림을 못 골라 도구 기본 그림으로 놓았다.`);
  return { result };
}

export function buildPeople(run: BuildRun, people: readonly PersonSpec[], mapId?: string): ContentBuildResult {
  const warnings: string[] = [];
  const eventIds: { mapId: string; eventId: string }[] = [];
  const mapIds = new Set<string>();
  const used: Cell[] = [];
  const notes: string[] = [];
  const firstCall = run.calls.length;
  let failed = 0;

  for (const person of people) {
    const targetMapId = person.mapId ?? mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
    const label = person.name ?? person.role;
    const map = findMap(run.ctx.project, targetMapId);
    if (!map) {
      warnings.push(`${label}: 맵 '${targetMapId}' 이 없다.`);
      failed++;
      continue;
    }
    // 이미 이 맵에 같은 이름의 NPC 가 있으면 새로 세우지 않는다(2026-10-24 스위트: 대장장이 그림이 바뀌고 촌장이 둘이 됐다).
    //   그림·얼굴·자리는 그대로 두고, 대사를 준 경우에만 첫 페이지의 대사를 바꾼다(얼굴 명령은 남김).
    const existing = person.name ? eventsOf(map).find((e) => (e.name ?? "").trim().toLowerCase() === person.name!.trim().toLowerCase()) : undefined;
    if (existing && existing.pages?.length) {
      const lines = [...cleanLines(person.firstTalk), ...cleanLines(person.laterTalk)];
      if (lines.length) {
        const p0 = existing.pages[0]!;
        const keep = (p0.commands ?? []).filter((c) => (c as { kind?: string }).kind !== "text");
        const firstPage = { ...structuredClone(p0), commands: [...structuredClone(keep), ...lines.map((body) => ({ kind: "text", speaker: existing.name, body }))] };
        const up = run.call("upsert_event", { mapId: targetMapId, replacePages: true, event: { id: existing.id, pages: [firstPage, ...existing.pages.slice(1).map((pg) => structuredClone(pg))] } });
        if (!up.ok) warnings.push(`${label}: 기존 NPC 대사 고치기 실패 — ${String(up.summary).slice(0, 160)}`);
      }
      eventIds.push({ mapId: targetMapId, eventId: existing.id });
      mapIds.add(targetMapId);
      notes.push(`${label} — 이미 있는 NPC(${existing.id}) 를 그대로 씀(그림·자리 유지${lines.length ? ", 대사만 바꿈" : ""})`);
      continue;
    }
    // 바깥 맵에서는 같은 부름의 사람끼리 바로 옆에 붙여 세우지 않는다(마을 광장에 둘이 겹쳐 선 줄처럼 보였다) — 실내는 바 앞 손님처럼 붙어도 된다.
    const outdoor = (map as unknown as { climate?: { mode?: string } }).climate?.mode !== "indoor";
    const avoid = outdoor ? used.flatMap((c) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: c.x + dx, y: c.y + dy })))) : used;
    const where = resolveWhere(run.ctx.project, map, person.where, { at: person.at, avoid, role: `${person.role} ${person.name ?? ""}` });
    if (where.note) warnings.push(`${label}: ${where.note}`);
    const cell = where.cell;

    const first = cleanLines(person.firstTalk);
    const later = cleanLines(person.laterTalk);
    const pages: Record<string, unknown>[] = [];
    if (first.length > 0 && later.length > 0) {
      pages.push({ name: "첫 만남", lines: first, commands: [{ kind: "setSelfSwitch", key: "A", value: true }] });
      pages.push({ name: "다시 말 걸면", lines: later, conditions: [{ kind: "selfSwitch", key: "A", value: true }] });
    } else if (first.length > 0 || later.length > 0) {
      pages.push({ name: "대화", lines: first.length > 0 ? first : later });
    }

    let movement = person.movement === "wander" ? "random" : "fixed";
    if (movement === "random") {
      // 배회가 닿는 칸에 하나뿐인 출구 길목·차도가 있으면 제자리로 — 마을 동쪽 외길 출구에서 농부가 배회해 길을 막았다(2026-10-25 J5).
      const roam = wanderReach(run.ctx.project, map, { id: "__new__", x: cell.x, y: cell.y, pages: [] } as unknown as GameEvent);
      const throats = exitThroats(run.ctx.project, map);
      const lanes = laneCells(run.ctx.project, map);
      const hit = [...roam].find((i) => throats.has(i) || lanes.has(i));
      if (hit !== undefined) {
        movement = "fixed";
        warnings.push(`${label}: 배회하면 ${throats.has(hit) ? "하나뿐인 출구 길목" : "차도·선로"} (${hit % map.width},${Math.floor(hit / map.width)})까지 걸어가 길을 막을 수 있어 제자리(still)로 두었다.`);
      } else warnings.push(`${label}: wander 는 걸어 다니다 길목에 설 수 있어 «길을 막지 않는다» 보장이 약해진다.`);
    }
    if (person.movement === "patrol") warnings.push(`${label}: patrol 은 v1 에 순찰 경로 도구가 없어 제자리(fixed)로 두었다.`);

    const baseArgs: Record<string, unknown> = { mapId: targetMapId, name: label, x: cell.x, y: cell.y, movement };
    if (pages.length > 0) baseArgs.pages = pages;
    const placedNpc = placeNpcWithGraphic(run, map, baseArgs, person.role, person.looks, label, warnings);
    const result = placedNpc.result;
    if (!result.ok) {
      warnings.push(`${label}: 놓기 실패 — ${String(result.summary).slice(0, 160)}`);
      failed++;
      continue;
    }
    for (const w of result.warnings ?? []) warnings.push(`${label}: ${w}`);
    const data = (result.data ?? {}) as { eventId?: string; x?: number; y?: number; adjusted?: boolean };
    const placed = { x: data.x ?? cell.x, y: data.y ?? cell.y };
    used.push(placed);
    mapIds.add(targetMapId);
    if (data.eventId) eventIds.push({ mapId: targetMapId, eventId: data.eventId });
    if (data.eventId && where.face) faceNpc(run, targetMapId, data.eventId, where.face);
    notes.push(`${label} (${placed.x},${placed.y})${where.how ? ` ${where.how}` : ""} · 그림 ${placedNpc.graphic ? `${placedNpc.graphic.label}${placedNpc.graphic.faceResourceId ? "+얼굴" : "(짝 얼굴 없음)"}` : "도구 기본"}${where.face ? ` · ${where.face} 를 봄` : ""}`);

    // 놓은 뒤 확인: 이 NPC 칸을 막고도 전에 닿던 칸에 다 닿는가.
    const after = findMap(run.ctx.project, targetMapId);
    if (after && movement === "fixed") {
      const blockers = eventBlockers(after);
      blockers.delete(placed.y * after.width + placed.x);
      const start = walkStart(run.ctx.project, after);
      if (!keepsMapConnected(run.ctx.project, after, start, placed, blockers)) {
        warnings.push(`${label}: (${placed.x},${placed.y}) 에 놓고 보니 길을 막는다 — 도구가 칸을 옮겼을 수 있다. 자리를 다시 정해야 한다.`);
      }
    }
  }

  const ok = failed === 0 && eventIds.length > 0;
  return {
    ok,
    mapIds: [...mapIds],
    summary: ok
      ? `사람 ${eventIds.length}명 놓음: ${notes.join(" / ")}`
      : `사람 ${people.length}명 중 ${failed}명 실패`,
    warnings,
    missingArt: [],
    calls: run.calls.slice(firstCall),
    eventIds,
  };
}
