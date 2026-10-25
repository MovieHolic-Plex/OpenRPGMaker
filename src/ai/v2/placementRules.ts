// 조수 v2 사람·조사 이벤트 놓기 규칙 — 놓을 때(people.ts·add_people)와 끝맺음 검사(gameChecks.ts)가 같이 쓴다.
//
// 왜(2026-10-25 판정):
//  J5  마을 동쪽 외길 출구 옆에 선 농부가 배회하다 출구 한 칸을 막았다 — 길막 검사는 «선 칸»만 보고, 배회가 닿는 칸과 출구 외길은 안 봤다.
//  J6  무기점 주인이 카운터 앞(손님 쪽)에 서서 빈 바닥 너머로 말했다 — 「카운터 앞」이 «주인 자리»로 풀렸다. 카운터는 북쪽 = 주인, 남쪽 = 손님.
//  J40 옷장 숨기 이벤트가 옷장 그림 아래 칸이 아니라 옷장 앞에 놓인 상자 위에 있었다 — 조사 이벤트가 말하는 물건 위에 있지 않았다.
//  사용자 규칙(2026-10-25): 사람은 차도·선로 한가운데 서서 말하지 않는다. 보도·가게 안·벤치·카운터·문 앞에 선다.
// 순수 함수 — 칩셋 이름표·태그(라벨)로 판정한다.
import { canMove, isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";

type Cell = { readonly x: number; readonly y: number };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

type Meta = { label?: string; tags?: readonly string[] } | undefined;
function metaOf(project: Project, map: GameMap, tile: number | undefined): Meta {
  if (typeof tile !== "number" || tile < 0) return undefined;
  return (project.tilesets[map.tilesetId]?.tileMeta as unknown as Meta[] | undefined)?.[tile];
}
function layerTiles(map: GameMap, i: number): (number | undefined)[] {
  const m = map as unknown as { lowerTiles?: ArrayLike<number>; lowerOverlayTiles?: ArrayLike<number>; upperTiles?: ArrayLike<number>; upperOverlayTiles?: ArrayLike<number> };
  return [m.lowerTiles?.[i], m.lowerOverlayTiles?.[i], m.upperTiles?.[i], m.upperOverlayTiles?.[i]];
}

// ───────────── 차도·선로 ─────────────

/** 차가 다니는 칸(차도·차선·아스팔트·횡단보도)과 선로 — 사람이 서서 말하는 자리가 아니다. 보도·인도·광장·흙길·참배길·생활도로는 걷는 길이다. */
const LANE_WORD = /차도|차선|아스팔트|횡단보도|중앙선|도로 구간|도로 위쪽|도로 아래쪽|도로 중앙|교차로|선로|철도|레일|\b(roadway|carriageway|asphalt|crosswalk|rail|railway|track)\b/iu;
const LANE_TAG = /^(차도|차선|아스팔트|횡단보도|선로|철도|레일|crosswalk|rail|railway|asphalt|roadway)$/iu;
/** 걷는 길(보도 등) — 라벨에 «도로»가 섞여도 사람이 서도 되는 칸. */
const WALK_WORD = /보도|인도|연석|광장|참배길|생활도로|흙길|산책길|공원 ?길|정류장 유도|sidewalk|pavement|plaza|walk/iu;

function isLaneMeta(m: Meta): boolean {
  if (!m) return false;
  const label = m.label ?? "";
  const tags = m.tags ?? [];
  if (WALK_WORD.test(label) || tags.some((t) => WALK_WORD.test(t))) return false;
  if (LANE_WORD.test(label) || tags.some((t) => LANE_TAG.test(t))) return true;
  // 현대 칩셋의 «road» 태그는 차도다(jp_city 생활도로·버들항 포석 길은 위 WALK/아래 규칙으로 걸러진다).
  return tags.includes("road") && /modern-city|jp-city|시타마치/u.test(tags.join(" ")) && !tags.includes("lane") && !tags.includes("sidewalk");
}

/** 차도·선로 칸 집합(바닥 두 층의 이름표로). 실내·판타지 맵은 보통 비어 있다. */
export function laneCells(project: Project, map: GameMap): Set<number> {
  const out = new Set<number>();
  const cache = new Map<number, boolean>();
  const test = (t: number | undefined): boolean => {
    if (typeof t !== "number" || t < 0) return false;
    let hit = cache.get(t);
    if (hit === undefined) { hit = isLaneMeta(metaOf(project, map, t)); cache.set(t, hit); }
    return hit;
  };
  const m = map as unknown as { lowerTiles?: ArrayLike<number>; lowerOverlayTiles?: ArrayLike<number> };
  for (let i = 0; i < map.width * map.height; i++) if (test(m.lowerTiles?.[i]) || test(m.lowerOverlayTiles?.[i])) out.add(i);
  return out;
}

// ───────────── 사람 이벤트 ─────────────

function hasTransfer(ev: GameEvent): boolean {
  const lists: unknown[][] = [ev.commands ?? [], ...((ev.pages ?? []).map((p) => p.commands ?? []))];
  return lists.some((cmds) => cmds.some((c) => (c as { kind?: string }).kind === "transfer"));
}
/** 그림이 있는 사람(걷기 칩) 이벤트. */
export function isPersonEvent(ev: GameEvent): boolean {
  if (hasTransfer(ev)) return false;
  return (ev.pages ?? []).some((p) => { const g = p.graphic as { sprite?: unknown; appearanceId?: unknown } | undefined; return !!(g && (g.sprite || g.appearanceId)); });
}
/** 이 사람이 배회하는가(어느 페이지든 random). */
export function wanders(ev: GameEvent): boolean {
  return (ev.pages ?? []).some((p) => (p.movement as { type?: string } | undefined)?.type === "random");
}

/** from 에서 걸어 닿는 칸(막는 칸 제외). */
function reachFrom(project: Project, map: GameMap, from: Cell, blocked: ReadonlySet<number>, limit = Infinity): Map<number, number> {
  const w = map.width;
  const dist = new Map<number, number>();
  const s = from.y * w + from.x;
  if (!isPassable(project, map, from.x, from.y)) return dist;
  dist.set(s, 0);
  const q = [s];
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const d = dist.get(i)!;
    if (d >= limit) continue;
    const x = i % w, y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (dist.has(j) || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      dist.set(j, d + 1);
      q.push(j);
    }
  }
  return dist;
}

/** 맵 밖으로 나가는 이동 칸(문·가장자리 출구) — 이동 이벤트가 있는 칸. */
export function exitCells(map: GameMap): Cell[] {
  return (map.events ?? []).filter(hasTransfer).map((e) => ({ x: e.x, y: e.y }));
}

/**
 * 출구 목: 출구 칸에서 걸어 들어가는 길이 한 칸 폭인 구간(출구 칸 포함, 최대 depth 칸). 여기에 사람이 서거나 배회해 들어오면 길이 막힌다.
 * 한 칸 폭 = 그 칸을 막으면 출구 칸이 맵 안쪽 큰 땅과 끊긴다.
 */
export function exitThroats(project: Project, map: GameMap, depth = 4): Set<number> {
  const w = map.width;
  const out = new Set<number>();
  const others = new Set<number>();
  for (const e of map.events ?? []) if (!hasTransfer(e)) others.add(e.y * w + e.x);
  for (const exit of exitCells(map)) {
    if (!isPassable(project, map, exit.x, exit.y)) continue;
    const all = reachFrom(project, map, exit, new Set());
    if (all.size < 8) continue;
    const near = reachFrom(project, map, exit, new Set(), depth);
    for (const [i] of near) {
      // 이 칸을 막으면 출구에서 닿는 칸이 크게 준다(출구 쪽만 남는다) → 목.
      const blocked = new Set([i]);
      const after = i === exit.y * w + exit.x ? 0 : reachFrom(project, map, exit, blocked).size;
      if (after < all.size * 0.5) out.add(i);
    }
    out.add(exit.y * w + exit.x);
    // 출구 바로 앞 칸(맵 안쪽으로 한 칸): 여기 선 사람은 문·가장자리 길을 몸으로 막는다(J5 — 동쪽 문 바로 앞 농부).
    // 안쪽 = 가장 가까운 맵 가장자리의 반대쪽. 좁은 출구(들어서는 이웃이 둘 이하)는 이웃 칸 전부.
    const ways = DIRS.map(([dx, dy]) => ({ x: exit.x + dx, y: exit.y + dy })).filter((n) => n.x >= 0 && n.y >= 0 && n.x < w && n.y < map.height && canMove(project, map, n.x, n.y, exit.x, exit.y));
    const edges = [[exit.x, 1, 0], [w - 1 - exit.x, -1, 0], [exit.y, 0, 1], [map.height - 1 - exit.y, 0, -1]] as const;
    const [, ix, iy] = [...edges].sort((a, b) => a[0] - b[0])[0]!;
    for (const n of ways) if (ways.length <= 2 || (n.x === exit.x + ix && n.y === exit.y + iy)) out.add(n.y * w + n.x);
  }
  return out;
}

/** 배회하는 사람이 닿을 수 있는 칸(제자리에서 radius 걸음, 다른 사람 칸 제외). 런타임 배회는 범위 제한이 없어 넉넉히 본다. */
export function wanderReach(project: Project, map: GameMap, ev: GameEvent, radius = 6): Set<number> {
  const w = map.width;
  const blocked = new Set<number>();
  for (const e of map.events ?? []) if (e.id !== ev.id && !hasTransfer(e)) blocked.add(e.y * w + e.x);
  return new Set(reachFrom(project, map, { x: ev.x, y: ev.y }, blocked, radius).keys());
}

// ───────────── 카운터 ─────────────

const COUNTER_LABEL = /카운터|계산대|접수대|창구|counter|register|reception/iu;
/** 칸에 카운터 그림이 있는가(덮개·바닥 층 어디든). */
export function isCounterArt(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return layerTiles(map, y * map.width + x).some((t) => { const m = metaOf(project, map, t); return !!m && COUNTER_LABEL.test(m.label ?? "") && !/의자|stool|chair/iu.test(m.label ?? ""); });
}
const SHOPKEEPER = /주인|점원|상인|가게|점장|판매|계산|직원|바텐더|접수|카운터|여관|shop ?keeper|clerk|merchant|vendor|cashier|bartender|innkeeper|receptionist/iu;
export function isShopkeeperName(name: string | undefined): boolean {
  return SHOPKEEPER.test(name ?? "");
}
/**
 * 카운터 옆 사람의 쪽: 바로 남쪽(아래)이 카운터면 «주인 쪽(behind)», 바로 북쪽(위)이 카운터면 «손님 쪽(front)».
 * 카운터 그림은 북쪽에 주인, 남쪽에 손님이 서게 그려졌다(부품 설명 「북쪽=주인, 남쪽=손님」).
 */
export function counterSide(project: Project, map: GameMap, c: Cell): "behind" | "front" | "beside" | undefined {
  if (isCounterArt(project, map, c.x, c.y + 1)) return "behind";
  if (isCounterArt(project, map, c.x, c.y - 1)) return "front";
  // 대각선(카운터 모서리 옆) — 무기점 주인이 카운터 오른쪽 아래 칸에 섰다(J6).
  const below = isCounterArt(project, map, c.x - 1, c.y + 1) || isCounterArt(project, map, c.x + 1, c.y + 1);
  const above = isCounterArt(project, map, c.x - 1, c.y - 1) || isCounterArt(project, map, c.x + 1, c.y - 1);
  if (below && !above) return "behind";
  if (above && !below) return "front";
  if (isCounterArt(project, map, c.x - 1, c.y) || isCounterArt(project, map, c.x + 1, c.y)) return "beside";
  return undefined;
}

// ───────────── 조사 이벤트와 물건 ─────────────

/** 물건 낱말 → 이름표에서 찾을 말(사람이 흔히 쓰는 말 포함). */
const OBJECT_WORDS: readonly [RegExp, RegExp][] = [
  [/옷장|wardrobe|closet/iu, /옷장|wardrobe/iu],
  [/괘종시계|시계|clock/iu, /시계|clock/iu],
  [/책장|서가|bookshelf|bookcase/iu, /책장|서가|bookshelf/iu],
  [/금고|safe|vault/iu, /금고|safe|vault/iu],
  [/피아노|piano/iu, /피아노|piano/iu],
  [/거울|mirror/iu, /거울|mirror/iu],
  [/침대|bed\b/iu, /침대|bed/iu],
  [/상자|궤짝|chest|crate/iu, /상자|궤짝|chest|crate/iu],
  [/그림|초상화|액자|painting|portrait|picture/iu, /그림|초상화|액자|portrait|picture/iu],
  [/벽난로|fireplace/iu, /벽난로|fireplace/iu],
  [/서랍|cupboard|drawer/iu, /서랍|cupboard|drawer/iu],
  [/일기|diary/iu, /일기|diary/iu],
  [/석상|조각상|statue/iu, /석상|조각상|흉상|statue|bust/iu],
  [/오르골|music box/iu, /오르골|music box/iu],
];
/** 이벤트 이름에서 그 이벤트가 말하는 물건(이름표 정규식). 모르면 undefined. */
export function objectWordOf(name: string): RegExp | undefined {
  for (const [said, label] of OBJECT_WORDS) if (said.test(name)) return label;
  return undefined;
}
function labelsAt(project: Project, map: GameMap, x: number, y: number): string[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  return layerTiles(map, y * map.width + x).map((t) => metaOf(project, map, t)?.label ?? "").filter(Boolean);
}
/** 덮개 층(물건 층)에 그림이 있는 칸인가 — 바닥 무늬(양탄자 등 아래 덮개)는 물건으로 치지 않는다. */
function upperObjectAt(project: Project, map: GameMap, x: number, y: number): boolean {
  const i = y * map.width + x;
  const m = map as unknown as { upperTiles?: ArrayLike<number>; upperOverlayTiles?: ArrayLike<number> };
  return [m.upperTiles?.[i], m.upperOverlayTiles?.[i]].some((t) => !!metaOf(project, map, t)?.label);
}
/**
 * 조사 이벤트가 그 물건 «위·앞»에 있는가: 이벤트 칸이나 바로 위 칸(키 큰 가구의 앞면)이 그 물건 그림이어야 한다.
 * 아니면 가장 가까운 그 물건 칸(앞면 칸)을 돌려준다(반경 6). 물건 낱말을 모르면 undefined(판단하지 않는다).
 */
export function objectEventFit(project: Project, map: GameMap, ev: { name?: string; x: number; y: number }): { ok: boolean; label: RegExp; onLabel: string; nearest?: Cell } | undefined {
  const label = objectWordOf(ev.name ?? "");
  if (!label) return undefined;
  const own = labelsAt(project, map, ev.x, ev.y);
  if (own.some((l) => label.test(l))) return { ok: true, label, onLabel: own.find((l) => label.test(l)) ?? "" };
  // 바로 위 칸이 그 물건이면 앞 칸에 선 것으로 친다 — 그 칸 덮개 층에 «다른 물건»(옷장 앞 상자)이 없을 때만(J40).
  const above = labelsAt(project, map, ev.x, ev.y - 1).find((l) => label.test(l));
  if (above && !upperObjectAt(project, map, ev.x, ev.y)) return { ok: true, label, onLabel: above };
  let nearest: Cell | undefined, best = Infinity;
  for (let y = Math.max(0, ev.y - 6); y <= Math.min(map.height - 1, ev.y + 6); y++) for (let x = Math.max(0, ev.x - 6); x <= Math.min(map.width - 1, ev.x + 6); x++) {
    if (!labelsAt(project, map, x, y).some((l) => label.test(l))) continue;
    // 그 물건의 맨 아래(앞면) 칸 — 아래 칸도 같은 물건이면 내려간다.
    let by = y;
    while (by + 1 < map.height && labelsAt(project, map, x, by + 1).some((l) => label.test(l))) by++;
    const d = Math.abs(x - ev.x) + Math.abs(by - ev.y);
    if (d < best) { best = d; nearest = { x, y: by }; }
  }
  const onLabel = labelsAt(project, map, ev.x, ev.y).map((l) => l.replace(/\s*\([^)]*\)\s*$/u, "")).join("·");
  return { ok: false, label, onLabel, ...(nearest ? { nearest } : {}) };
}

// ───────────── 맵 하나 검사(끝맺음 관문) ─────────────

export interface PlacementProblem { readonly kind: "npc-lane" | "npc-exit" | "npc-counter" | "event-object"; readonly eventId: string; readonly name: string; readonly at: Cell; readonly detail: string }

export function placementProblems(project: Project, map: GameMap, eventIds?: ReadonlySet<string>): PlacementProblem[] {
  const out: PlacementProblem[] = [];
  const w = map.width;
  const lanes = laneCells(project, map);
  let throats: Set<number> | undefined;
  for (const ev of map.events ?? []) {
    if (eventIds && !eventIds.has(ev.id)) continue;
    const name = ev.name ?? ev.id;
    const i = ev.y * w + ev.x;
    if (isPersonEvent(ev)) {
      const roam = wanders(ev) ? wanderReach(project, map, ev) : new Set([i]);
      if (lanes.size) {
        const onLane = lanes.has(i) ? i : [...roam].find((j) => lanes.has(j));
        if (onLane !== undefined) out.push({ kind: "npc-lane", eventId: ev.id, name, at: { x: ev.x, y: ev.y }, detail: lanes.has(i) ? `차도·선로 칸 (${ev.x},${ev.y}) 한가운데 서 있다` : `배회하다 차도·선로 칸 (${onLane % w},${Math.floor(onLane / w)})으로 걸어 들어간다` });
      }
      throats ??= exitThroats(project, map);
      const inThroat = throats.has(i) ? i : wanders(ev) ? [...roam].find((j) => throats!.has(j)) : undefined;
      if (inThroat !== undefined) out.push({ kind: "npc-exit", eventId: ev.id, name, at: { x: ev.x, y: ev.y }, detail: throats.has(i) ? `출구 길목·문 바로 앞 (${ev.x},${ev.y})에 서서 길을 막는다` : `배회하다 출구 길목·문 바로 앞 (${inThroat % w},${Math.floor(inThroat / w)})으로 들어가 길을 막는다` });
      if (isShopkeeperName(name) && counterSide(project, map, ev) === "front") out.push({ kind: "npc-counter", eventId: ev.id, name, at: { x: ev.x, y: ev.y }, detail: `카운터 앞 손님 쪽 (${ev.x},${ev.y})에 서 있다 — 카운터는 북쪽이 주인 자리다` });
      continue;
    }
    // 조사 이벤트(결정 키, 그림 없음) — 이름이 말하는 물건 위에 있어야 한다.
    const action = (ev.pages ?? []).some((p) => (p.trigger as { kind?: string } | undefined)?.kind === "action");
    if (!action || hasTransfer(ev)) continue;
    const fit = objectEventFit(project, map, ev);
    if (fit && !fit.ok && fit.nearest) out.push({ kind: "event-object", eventId: ev.id, name, at: { x: ev.x, y: ev.y }, detail: `이름이 말하는 물건이 이 칸(${ev.x},${ev.y}${fit.onLabel ? `, 그림 「${fit.onLabel}」` : ""})에 없다 — 그 물건은 (${fit.nearest.x},${fit.nearest.y})에 있다` });
  }
  return out;
}
