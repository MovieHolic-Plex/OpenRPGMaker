// 조수 v2 — 자리 고르기: 자리 낱말(입구·문 앞·«X 옆»…)이나 칸을 «실제로 걸어 닿고 길을 막지 않는 칸»으로 옮긴다. 사람·사건·물건·옮기기가 이 규칙 하나를 쓴다.
import type { Dir, GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import { counterSide, exitThroats, isCounterArt, isShopkeeperName, laneCells } from "./placementRules";
import { Cell, DIRS, eventsOf, transferCells, eventBodyCells, eventBlockers, walkReach, walkStart, dist, shortestPathCells, openness, edgeExitCells, SEAT_LABEL, STAIR_LABEL, WALL_LABEL, WINDOW_LABEL, tileLabel, layers, objectAt } from "./cells";
import { roadCells } from "./surface";
import { personSpotContext, personSpotCost } from "./personSpot";

export interface WhereResolution {
  /** 사람이 설 칸 — 물건(footprint)이면 발밑 맨 아래 줄의 왼쪽 칸(generate_missing_object·stamp_tileset_object 의 base). */
  readonly cell: Cell;
  /** 낱말을 못 알아듣거나 못 찾아 기본 자리로 갔을 때의 한 줄. */
  readonly note?: string;
  /** 낱말이 가리킨 자리가 아니라 기본 자리(방 안·시작 근처)로 갔다 — 부르는 쪽이 note 글을 읽지 않고 가른다. */
  readonly fallback?: true;
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
  [/표지판|팻말|이정표|안내판|sign ?post|^sign$/i, ["표지판", "팻말", "이정표", "안내판", "signpost", "sign"]],
  [/비석|묘비|gravestone|tombstone/i, ["비석", "묘비", "gravestone", "tombstone"]],
  [/계단|stair/i, ["계단", "stair"]],
  [/탁자|테이블|식탁|table/i, ["탁자", "식탁", "테이블", "table"]],
  [/술통|barrel|keg/i, ["술통", "barrel", "keg"]],
  [/창문|창$|window/i, ["창문", "창 ", "window"]],
];

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
  // 바깥 맵의 「광장 한쪽」 은 광장이다 — 「한쪽」 이 먼저 잡히면 맵 테두리(벽 없음)에 붙는다(2026-10-31 jb1a terra: 촌장이 (0,20) 서쪽 끝 한 칸에 서서 판정자가 한참 찾았다).
  if (!room && /광장|plaza|square/.test(w)) return { kind: "plaza", ...base };
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

/** 이름으로 찾은 물건의 칸(덩이 맨 아랫줄 가운데 — 플레이어가 마주 보는 칸). 조사 지점처럼 이벤트를 물건 위에 올릴 때 쓴다. */
export function objectCellByName(project: Project, map: GameMap, word: string): { cell: Cell; label: string } | undefined {
  const name = word.trim();
  if (!name) return undefined;
  const box = findObjectBox(project, map, name, undefined, walkStart(project, map)) ?? findEventBox(map, name, undefined, walkStart(project, map), undefined);
  return box ? { cell: { x: Math.floor((box.x0 + box.x1) / 2), y: box.y1 }, label: box.label } : undefined;
}

/** 다른 맵(또는 같은 맵 다른 칸)에서 mapId 로 오는 이동 명령의 도착 칸들. */
export function incomingLandings(project: Project, mapId: string): Cell[] {
  const out: Cell[] = [];
  const seen = new Set<string>();
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== "object") return;
    const o = n as { kind?: unknown; mapId?: unknown; x?: unknown; y?: unknown };
    if (o.kind === "transfer" && o.mapId === mapId && typeof o.x === "number" && typeof o.y === "number" && !seen.has(`${o.x},${o.y}`)) { seen.add(`${o.x},${o.y}`); out.push({ x: o.x, y: o.y }); }
    for (const v of Object.values(n)) if (v && typeof v === "object") walk(v);
  };
  for (const m of Object.values(project.maps)) for (const ev of m.events ?? []) walk(ev.pages ?? []);
  return out;
}

/** «촌장 옆»처럼 물건이 아니라 사람·사건 이름을 가리킬 때: 이름에 그 낱말이 든 이벤트의 칸(방 안 것, 기준점에 가까운 것 먼저). */
function findEventBox(map: GameMap, word: string, room: RoomRect | undefined, near: Cell, exceptId: string | undefined): { x0: number; y0: number; x1: number; y1: number; label: string } | undefined {
  const want = word.toLowerCase();
  const hit = eventsOf(map)
    .filter((e) => e.id !== exceptId && (e.id.toLowerCase() === want || (e.name ?? "").toLowerCase().includes(want)) && (!room || inRoom(room, e, 1)))
    .sort((a, b) => dist(a, near) - dist(b, near))[0];
  return hit ? { x0: hit.x, y0: hit.y, x1: hit.x, y1: hit.y, label: hit.name ?? hit.id } : undefined;
}

/**
 * 자리 낱말 → 실제로 걸어 닿는 빈 칸(물건이면 발밑 칸들이 다 비고, 막아도 길이 끊기지 않는 base). 못 찾으면 기본 자리(시작 근처) + note.
 * 알아듣는 낱말: 입구·성문 / 광장·가운데 / 문 앞 / «X 옆·앞·뒤»(카운터·바·벽난로·우물… 칩셋 이름표로 찾는다) /
 * 한쪽·벽 쪽 / 북쪽 벽(남·동·서) / 구석 / 창가 — 방 낱말(홀·부엌·침실…)이 같이 오면 손 도트 실내의 그 방 안에서.
 * avoid: 이미 쓴 칸(다른 사람·컷신 자리). exceptId: 옮기는 이벤트 자신.
 */
export function resolveWhere(
  project: Project,
  map: GameMap,
  word: string | undefined,
  opts: { at?: Cell; avoid?: readonly Cell[]; keepFree?: readonly Cell[]; footprint?: Footprint; role?: string; exceptId?: string } = {},
): WhereResolution {
  const w = map.width;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map, opts.exceptId);
  const bodies = eventBodyCells(map, opts.exceptId);
  const reach = terrainReachability(project, map, start);
  const transferList = transferCells(map);
  const transfers = new Set(transferList.map((c) => c.y * w + c.x));
  const avoid = new Set((opts.avoid ?? []).map((c) => c.y * w + c.x));
  for (const c of opts.keepFree ?? []) avoid.add(c.y * w + c.x);
  // 다른 맵에서 이 맵으로 오는 이동의 도착 칸에는 이벤트를 두지 않는다 — 커밋이 «월드 그래프 transfer 목적지에 이벤트가 겹칩니다»로 거절한다
  // (2026-10-30 omo-unfinished terra boss-room: 「입구」 컷신 add_event 가 보스 방 도착 칸 (9,21)에 서서 한 번 실패).
  for (const c of incomingLandings(project, map.id)) avoid.add(c.y * w + c.x);
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
  const outdoorRoads = !fp && !indoor ? roadCells(project, map) : undefined;
  const roadCost = (c: Cell): number => (outdoorRoads?.has(c.y * w + c.x) ? 8 : 0);
  // 실내 사람은 문 곁·가구의 하나뿐인 접근 칸·다른 사람 바로 위아래·양탄자 가운데를 피한다(personSpotCost).
  const spotCtx = !fp && indoor ? personSpotContext(project, map, opts.exceptId) : undefined;
  const spotCost = (c: Cell): number => (spotCtx ? personSpotCost(project, map, c, spotCtx) : 0);
  const pick = (score: (c: Cell) => number): Cell | undefined => {
    const ranked = cells.map((c) => ({ c, s: score(c) + roadCost(c) + spotCost(c) })).filter((r) => Number.isFinite(r.s)).sort((a, b) => a.s - b.s);
    let tries = 0;
    for (const { c } of ranked) {
      if (++tries > 80) break;
      if (connectedWithout(footCells(c))) return c;
    }
    return undefined;
  };
  const done = (cell: Cell, extra: Omit<WhereResolution, "cell" | "cells">): WhereResolution => ({ cell, ...extra, ...(fp ? { cells: footCells(cell) } : {}) });

  // 칸을 직접 줬으면 가장 가까운 쓸 수 있는 칸. 자리 낱말과 함께 온 (0,0) 은 정한 칸이 아니라 선택 칸을 기본값으로 채운 것이다
  // (GPT 계열 — 「벽난로 앞」 과 at:{0,0} 이 같이 와 낱말을 버리고 맵 모서리 근처에 섰다). 모서리를 가리키려면 낱말 없이 at 만 준다.
  const givenAt = opts.at && !(opts.at.x === 0 && opts.at.y === 0 && word?.trim()) ? opts.at : undefined;
  if (givenAt) {
    const at = givenAt;
    const c = pick((q) => dist(q, at));
    if (c) {
      const moved = c.x !== at.x || c.y !== at.y;
      return done(c, { ...(moved ? { note: `at (${at.x},${at.y}) 은 ${fp ? `${fp.w}×${fp.foot + fp.over} 물건을 놓을 수 없는` : "못 서는"} 칸이라 (${c.x},${c.y}) 로 옮겼다.` } : {}), how: `칸 (${c.x},${c.y})` });
    }
  }

  // 도움 함수: 방 안 칸의 벽 쪽(이웃이 방 밖이거나, 가구 아닌 못 가는 칸·벽 그림).
  const wallish = (x: number, y: number, room: RoomRect | undefined): boolean => {
    // 바깥 맵의 테두리는 벽이 아니다 — 맵 끝 한 칸에 사람을 세우면 한쪽에서만 말을 걸 수 있고 화면 끝에 숨는다(jb1a terra 촌장 (0,20)).
    if (x < 0 || y < 0 || x >= w || y >= map.height) return indoor || !!room;
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
    const box = findObjectBox(project, map, intent.object, room, centre) ?? findEventBox(map, intent.object, room, centre, opts.exceptId);
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
    const roads = roadCells(project, map);
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
    if (c) {
      const missed = intent.kind !== "default" && intent.kind !== "center";
      return done(c, { how: `${roomName} 안`, ...(missed ? { note: `'${word}' 의 자리를 ${roomName} 에서 못 찾아 그 방 안 (${c.x},${c.y}) 에 두었다.`, fallback: true as const } : {}) });
    }
  }

  // 기본: 시작 근처(3~4칸), 트인 곳.
  const c = pick((q) => Math.abs(dist(q, start) - 3.5) - Math.min(openness(reach, map, q), 14) * 0.05 + (objectAt(map, q) ? 3 : 0));
  if (c) {
    const miss = intent.kind === "default" ? (word ? `자리 낱말 '${word}' 을 몰라` : undefined) : `'${word}' 자리를 이 맵에서 못 찾아`;
    return done(c, { how: "시작 근처", ...(miss ? { note: `${miss} 시작 지점 근처 (${c.x},${c.y}) 에 두었다.`, fallback: true as const } : {}) });
  }
  return done(start, { note: fp ? `${fp.w}×${fp.foot + fp.over} 물건을 길을 막지 않고 놓을 빈 바닥을 못 찾았다.` : "걸어 닿는 빈 칸을 못 찾았다.", fallback: true });
}

function dirTowardCell(from: Cell, to: Cell): Dir {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? "right" : "left";
  return dy < 0 ? "up" : "down";
}
