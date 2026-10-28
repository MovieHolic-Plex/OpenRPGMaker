// 조사 이벤트가 «걸어 가서 말을 걸 수 있는 자리»에 있나 — 퍼즐 고리·청사진 경로 빌더가 놓은 뒤 확인하고, 아니면 옮긴다.
//
// 왜(2026-10-28 mt2 deepseek 방탈출 「서재의 네 자리」): author_puzzle_chain 이 모델이 준 칸에 이벤트를 그대로 두었다.
// 「책상 서랍의 쪽지」(4,7)가 서재 서쪽 반으로 가는 한 칸 통로를 막아, 그 너머의 「문 옆 자물쇠」(4,9)에 영영 못 갔다 —
// 3맵·3턴 112분을 짓고도 엔딩 불가. 규칙(자동 플레이·런타임과 같은 충돌):
//  - 플레이어 시작점·이 맵으로 들어오는 착지점에서 BFS(같은 높이 이벤트는 못 지난다)로 닿는 칸 옆에 있어야 조사할 수 있다.
//  - 놓은 이벤트가 길목을 막아 닿던 칸을 잃게 하면 안 된다(자기 칸 하나만 빼고).
//  - 이름이 문(탈출 문·현관…)이면 그림 「문」 칸에 붙인다 — 그 칸이 길목을 막는 것은 잠긴 문이라 괜찮지만 다른 조사 이벤트를 잃게 하면 안 된다.
// 옮길 때는 원래 자리에서 가장 가까운, 가구 앞(옆이 못 지나는 물건 칸) 빈 바닥을 고른다.
import { canMove, isPassable } from "@/project/collision";
import { playerAnchors } from "@/editor/tools/transferReachability";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { objectAt, tileLabel } from "./people";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const TOUCH = new Set(["playerTouch", "touch", "eventTouch"]);

/** 길을 막는 이벤트인가 — 어느 페이지든 같은 높이·겹침 금지거나 접촉 발동이면 막는 것으로 본다(보수적으로). */
export function eventBlocks(ev: GameEvent): boolean {
  const pages = ev.pages ?? [];
  if (!pages.length) return false;
  return pages.some((p) => {
    const trig = typeof p.trigger === "string" ? p.trigger : p.trigger?.kind;
    return TOUCH.has(String(trig ?? "")) || ((p.priority ?? "same") === "same" && (p as { overlapForbidden?: boolean }).overlapForbidden !== false);
  });
}

/** 시작 맵은 시작점 하나(다른 맵에서 돌아오는 착지점은 잠긴 문 너머일 수 있다), 그 밖의 맵은 들어오는 착지점들. */
function anchorsOf(project: Project, map: GameMap): Cell[] {
  const start = project.startMapId === map.id && project.startPos && isPassable(project, map, project.startPos.x, project.startPos.y) ? [{ x: project.startPos.x, y: project.startPos.y }] : [];
  return start.length ? start : playerAnchors(project, map).filter((a) => isPassable(project, map, a.x, a.y));
}

/** 앵커에서 걸어 닿는 칸(blocked 는 못 지난다). */
function reachFrom(project: Project, map: GameMap, anchors: readonly Cell[], blocked: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  const q: number[] = [];
  for (const a of anchors) { const i = a.y * w + a.x; if (!seen[i] && !blocked.has(i)) { seen[i] = 1; q.push(i); } }
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

function blockersOf(map: GameMap, except?: string): Set<number> {
  const out = new Set<number>();
  for (const ev of map.events ?? []) if (ev.id !== except && eventBlocks(ev)) out.add(ev.y * map.width + ev.x);
  return out;
}

const nextTo = (map: GameMap, reach: Uint8Array, c: Cell) => DIRS.some(([dx, dy]) => {
  const x = c.x + dx, y = c.y + dy;
  return x >= 0 && y >= 0 && x < map.width && y < map.height && !!reach[y * map.width + x];
});

/** 시작점·착지점에서 걸어 닿는 칸(막는 이벤트는 못 지난다). 앵커가 없으면 undefined. */
export function reachableCells(project: Project, map: GameMap): Uint8Array | undefined {
  const anchors = anchorsOf(project, map);
  return anchors.length ? reachFrom(project, map, anchors, blockersOf(map)) : undefined;
}

/** 이 맵에서 걸어 가 말을 걸 수 없는 이벤트 id(앵커가 없는 맵은 판단하지 않는다). */
export function unreachableEvents(project: Project, mapId: string, eventIds?: readonly string[]): string[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const anchors = anchorsOf(project, map);
  if (!anchors.length) return [];
  const reach = reachFrom(project, map, anchors, blockersOf(map));
  return (map.events ?? []).filter((ev) => (!eventIds || eventIds.includes(ev.id)) && !nextTo(map, reach, ev) && !reach[ev.y * map.width + ev.x]).map((ev) => ev.id);
}

const DOOR_NAME = /문|door|출구|현관|exit|gate/iu;
const NOT_DOOR_NAME = /금고|창문|서랍|문서|문양|문장|주문|질문|자물쇠|문지기|문하생|천문|lock|safe|window/iu;
// 문 그림 이름표: 괄호를 뗀 이름이 「…문」「…문 통로」「…문칸」으로 끝나야 한다 — 「천문대 둥근 지붕」「큰 굴절 망원경(… 천문대 중심)」
// 「고문대」가 문으로 잡혀 관측실 망원경 칸을 문으로 썼다(2026-10-28 task 5 조사).
const DOOR_ART = /(?:문|문 ?통로|문칸|door|gate)$/iu;
const NOT_DOOR_ART = /금고|창문|창틀|문양|문장|포문|뚜껑문|수문|천문|window|safe|hatch/iu;
/** 이름표가 문 그림인가(괄호·「버들항 · 」 같은 앞머리를 떼고 본다). */
export const isDoorArtLabel = (label: string): boolean => {
  const base = label.replace(/\s*\([^)]*\)/gu, "").replace(/^.*·\s*/u, "").trim();
  return !!base && DOOR_ART.test(base) && !NOT_DOOR_ART.test(base);
};
/** 이름이 문인 이벤트(탈출 문·현관문) — 문 옆 자물쇠·금고문은 아니다. */
export const isDoorName = (name: string) => DOOR_NAME.test(name) && !NOT_DOOR_NAME.test(name);

/** 그림 「문」 칸들(맨 아래 줄 — 사람이 서서 여는 칸). */
export function doorArtCells(project: Project, map: GameMap): Cell[] {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const hit = (x: number, y: number) => ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => {
    const label = tileLabel(project, map, m[k]?.[y * map.width + x]);
    return !!label && isDoorArtLabel(label);
  });
  const out: Cell[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (hit(x, y) && !(y + 1 < map.height && hit(x, y + 1))) out.push({ x, y });
  // 문 그림이 세로로 두 칸이면 아래 칸이 바닥 쪽이다. 아래가 통행 칸이 아니면(벽 줄에 붙은 문) 위 칸도 후보로 둔다.
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (hit(x, y) && y + 1 < map.height && hit(x, y + 1) && !isPassable(project, map, x, y + 1)) out.push({ x, y });
  return out;
}

// ── 이름이 가리키는 물건 ─────────────────────────────────────────────────────────
// 2026-10-28 mt2: 「책상 서랍의 쪽지」가 빈 바닥에 떠 있고(deepseek), 「낡은 기록」은 책장 앞 맨바닥 투명 칸이었다(terra),
// VQA 「책상 위 일기장이 그림으로 안 보인다」(standin). 이벤트 이름의 명사를 칩셋 이름표와 맞춰 그 물건 칸 위에 이벤트를 둔다
// (플레이어는 그 앞에 서서 조사한다). 맞는 물건이 맵에 없으면 그 명사의 1칸 물건 그림을 칩셋에서 골라 이벤트 칸에 깐다(새 도트 없음).

/** 이름 낱말 → 그 물건 이름표 낱말. 위에서부터가 아니라 이름에서 먼저 나온 낱말이 이긴다(「벽난로 위의 그림」 → 벽난로). */
const HOSTS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/책상|desk/iu, ["책상", "desk"]],
  [/책장|서가|책꽂이|bookshelf|bookcase/iu, ["책장", "서가", "bookshelf"]],
  [/벽난로|난로|fireplace|hearth/iu, ["벽난로", "난로", "fireplace"]],
  [/금고|safe\b/iu, ["금고", "safe", "상자"]],
  [/액자|초상화|그림|painting|portrait/iu, ["액자", "초상", "그림", "painting"]],
  [/서랍|drawer/iu, ["서랍", "협탁", "책상", "drawer"]],
  [/궤짝|상자|chest|crate|box/iu, ["상자", "궤짝", "chest", "crate"]],
  [/탁자|테이블|식탁|table/iu, ["탁자", "식탁", "테이블", "table"]],
  [/침대|bed\b/iu, ["침대", "bed"]],
  [/옷장|wardrobe/iu, ["옷장", "wardrobe"]],
  [/시계|clock/iu, ["시계", "clock"]],
  [/지구본|지구의|globe/iu, ["지구본", "지구의", "globe"]],
  [/촛대|candle/iu, ["촛대", "candle"]],
  [/화분|plant/iu, ["화분", "plant"]],
  [/화이트보드|칠판|게시판|board/iu, ["화이트보드", "칠판", "게시판"]],
  [/선반|shelf/iu, ["선반", "shelf"]],
  [/망원경|telescope/iu, ["망원경", "telescope"]],
];
/** 들고 다니는 작은 물건 — 이름에 물건 낱말이 없을 때 놓일 법한 가구, 그것도 없으면 깔 1칸 그림 낱말. */
const ITEMS: readonly (readonly [RegExp, readonly string[], readonly string[]])[] = [
  [/일기|일지|기록|장부|책|노트|diary|journal|book|record/iu, ["책장", "서가", "책 더미", "책상", "탁자"], ["책 더미", "책", "두루마리"]],
  [/쪽지|메모|편지|종이|서류|문서|note|memo|letter|paper/iu, ["책상", "탁자", "서류", "서랍"], ["서류", "종이", "편지", "책 더미"]],
  [/열쇠|key\b/iu, ["서랍", "상자", "책상"], ["상자"]],
  [/보석|반지|목걸이|gem|ring/iu, ["상자", "서랍"], ["상자", "보석"]],
];
const NOT_OBJECT_LABEL = /바닥|벽면|천장|깔개|그림자|공허|floor|wall|ceiling|rug/iu;
const baseLabel = (label: string) => label.replace(/\s*\((?:-?\d+,\s*-?\d+|프레임[^)]*)\)/gu, "").trim();

/** 이 이름이 가리키는 물건의 이름표 낱말 목록들(앞선 것부터 시도). */
function hostWords(name: string): string[][] {
  const hits: { at: number; words: readonly string[] }[] = [];
  for (const [re, words] of HOSTS) { const m = re.exec(name); if (m) hits.push({ at: m.index, words }); }
  hits.sort((a, b) => a.at - b.at);
  const out = hits.map((h) => [...h.words]);
  for (const [re, hosts] of ITEMS) if (re.test(name)) out.push(...hosts.map((h) => [h]));
  return out;
}
function itemTileWords(name: string): string[] {
  for (const [re, , tiles] of ITEMS) if (re.test(name)) return [...tiles];
  for (const [re, words] of HOSTS) if (re.test(name)) return [...words];
  return [];
}

const LAYER_KEYS = ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles", "lowerTiles"] as const;
/** 이름표가 words 중 하나를 품은 물건 칸들(바닥·벽·천장 제외). */
function objectCells(project: Project, map: GameMap, words: readonly string[]): Set<number> {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const lw = words.map((x) => x.toLowerCase());
  const cache = new Map<number, boolean>();
  const ok = (t: number | undefined) => {
    if (typeof t !== "number" || t < 0) return false;
    let hit = cache.get(t);
    if (hit === undefined) { const label = baseLabel(tileLabel(project, map, t)).toLowerCase(); hit = !!label && !NOT_OBJECT_LABEL.test(label) && lw.some((x) => label.includes(x)); cache.set(t, hit); }
    return hit;
  };
  const out = new Set<number>();
  for (let i = 0; i < map.width * map.height; i++) if (LAYER_KEYS.some((k) => ok(m[k]?.[i]))) out.add(i);
  return out;
}

/** 칩셋에서 words 낱말의 1칸 물건 그림 하나(이름표가 (0,0) 하나뿐인 것). */
function singleTileObject(project: Project, map: GameMap, words: readonly string[]): { tile: number; label: string } | undefined {
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const parts = new Map<string, { tile: number; coords: Set<string> }>();
  meta.forEach((t, i) => {
    const label = t?.label;
    if (!label || NOT_OBJECT_LABEL.test(label) || /프레임/u.test(label)) return;
    const base = baseLabel(label);
    const coord = /\((-?\d+,\s*-?\d+)\)/u.exec(label)?.[1]?.replace(/\s/gu, "") ?? "0,0";
    const entry = parts.get(base) ?? { tile: -1, coords: new Set<string>() };
    entry.coords.add(coord);
    if (coord === "0,0" && entry.tile < 0) entry.tile = i;
    parts.set(base, entry);
  });
  for (const word of words) {
    for (const [base, entry] of parts) if (entry.tile >= 0 && entry.coords.size === 1 && base.includes(word)) return { tile: entry.tile, label: base };
  }
  return undefined;
}

/** 그림 없는(투명) 이벤트인가 — 모든 페이지에 그림이 없다. */
function invisibleEvent(ev: GameEvent): boolean {
  return (ev.pages ?? []).every((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; transparent?: boolean; tileId?: number }; return g.transparent === true || (!g.sprite && !(typeof g.tileId === "number" && g.tileId > 0)); });
}

export interface ReachRepair { readonly moved: string[]; readonly stuck: string[] }

/**
 * 이벤트들(순서 = 고리 순서)을 걸어 가 말을 걸 수 있게 고친다.
 *  1) 문 이름 이벤트는 그림 문 칸으로.
 *  2) 이름이 가리키는 물건(책상·책장·벽난로·금고·그림·서랍·상자…)이 맵에 있으면 그 물건 칸 위로 — 앞(아래)에 설 칸이 있는 칸이 먼저.
 *  3) 그래도 막혔거나 길목을 막으면 가까운 닿는 빈 바닥으로(물건 옆 우선).
 *  4) 맞는 물건이 없고 그림 없는 이벤트면 그 명사의 1칸 물건 그림을 칩셋에서 골라 이벤트 칸에 깐다.
 * 다른 이벤트(목록 밖 포함)를 못 닿게 만드는 자리는 고르지 않는다.
 */
export function repairEventReach(run: BuildRun, mapId: string, eventIds: readonly string[]): ReachRepair {
  const moved: string[] = [];
  const stuck: string[] = [];
  // 두 바퀴 — 앞 이벤트가 옮겨 가야 뒤 이벤트의 물건 앞이 열리기도 한다(deepseek: 책장 앞 일기장이 벽난로 앞 구석을 막았다).
  for (const pass of [0, 1]) for (const id of eventIds) {
    if (pass === 1) stuck.length = 0;
    const project = run.ctx.project;
    const map = project.maps[mapId];
    const ev = map?.events.find((e) => e.id === id);
    if (!map || !ev) continue;
    const anchors = anchorsOf(project, map);
    if (!anchors.length) continue;
    const w = map.width;
    const othersBlocked = blockersOf(map, id);
    const free = reachFrom(project, map, anchors, othersBlocked);
    const others = (map.events ?? []).filter((e) => e.id !== id);
    const othersOk = (reach: Uint8Array) => others.every((o) => !free[o.y * w + o.x] && !nextTo(map, free, o) ? true : nextTo(map, reach, o) || !!reach[o.y * w + o.x]);
    // 길목을 막아 잃는 칸이 있어도 그 안에 이벤트가 없으면 괜찮다(막다른 구석 앞 책장) — 다른 이벤트를 못 닿게 하면 안 된다.
    const judge = (c: Cell): boolean => {
      const i = c.y * w + c.x;
      const blocked = new Set(othersBlocked);
      if (eventBlocks(ev)) blocked.add(i);
      const reach = reachFrom(project, map, anchors, blocked);
      if (!nextTo(map, reach, c) && !reach[i]) return false;
      return othersOk(reach);
    };
    const name = String((ev as { name?: string }).name ?? "");
    const here = { x: ev.x, y: ev.y };
    const taken = new Set(others.map((e) => e.y * w + e.x));
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    const dist = (c: Cell) => Math.abs(c.x - ev.x) + Math.abs(c.y - ev.y);
    const usable = (c: Cell) => !taken.has(c.y * w + c.x) && !anchorSet.has(c.y * w + c.x);
    let target: Cell | undefined;
    let why = "";
    // 1) 문
    const door = isDoorName(name);
    const doors = door ? doorArtCells(project, map) : [];
    if (door && doors.length) {
      if (doors.some((d) => d.x === ev.x && d.y === ev.y) && judge(here)) continue;
      target = [...doors].sort((a, b) => dist(a) - dist(b)).find((c) => usable(c) && judge(c));
      if (target) why = " 문 그림 칸";
    }
    // 2) 이름이 가리키는 물건
    let host = false;
    if (!target && !door) {
      for (const words of hostWords(name)) {
        const cells = objectCells(project, map, words);
        if (!cells.size) continue;
        host = true;
        if (cells.has(ev.y * w + ev.x) && judge(here)) break; // 이미 그 물건 위
        // 물건 칸마다: 앞(아래) 칸에 닿으면 0, 옆 1, 뒤 2 + 원래 자리와의 거리.
        const ranked: { c: Cell; s: number }[] = [];
        for (const i of cells) {
          const c = { x: i % w, y: Math.floor(i / w) };
          if (!usable(c)) continue;
          const side = (dx: number, dy: number) => { const x = c.x + dx, y = c.y + dy; return x >= 0 && y >= 0 && x < w && y < map.height && !!free[y * w + x] && !cells.has(y * w + x); };
          const face = side(0, 1) ? 0 : side(-1, 0) || side(1, 0) ? 1 : side(0, -1) ? 2 : -1;
          if (face < 0) continue;
          ranked.push({ c, s: face * 4 + dist(c) * 0.2 });
        }
        ranked.sort((a, b) => a.s - b.s);
        target = ranked.slice(0, 60).find(({ c }) => judge(c))?.c;
        if (target) { why = ` ${baseLabel(tileLabel(project, map, (map as unknown as Record<string, ArrayLike<number>>).upperTiles?.[target.y * w + target.x]) || tileLabel(project, map, (map as unknown as Record<string, ArrayLike<number>>).upperOverlayTiles?.[target.y * w + target.x])) || words[0]} 위`; break; }
      }
      if (host && !target && judge(here)) continue;
    }
    // 3) 막혔거나 길목 — 가까운 닿는 빈 바닥(물건 옆 우선).
    if (!target && !judge(here)) {
      const cands: { c: Cell; s: number }[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!free[i] || !usable({ x, y })) continue;
        const besideThing = DIRS.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < map.height && (!isPassable(project, map, nx, ny) || objectAt(map, { x: nx, y: ny })); });
        cands.push({ c: { x, y }, s: dist({ x, y }) + (besideThing ? 0 : 3) });
      }
      cands.sort((a, b) => a.s - b.s);
      target = cands.slice(0, 80).find(({ c }) => judge(c))?.c;
      if (!target) { stuck.push(`${name || id}(${ev.x},${ev.y})`); continue; }
    }
    if (target) {
      const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
      if (res.ok) moved.push(`${name || id} (${ev.x},${ev.y})→(${target.x},${target.y})${why}`);
      else { stuck.push(`${name || id}: ${String(res.summary).slice(0, 120)}`); continue; }
    }
    // 4) 맞는 물건이 맵에 없고 그림도 없으면 — 그 명사의 1칸 물건 그림을 이벤트 칸(빈 바닥)에 깐다.
    if (!host && !door) {
      const now = run.ctx.project.maps[mapId]!.events.find((e) => e.id === id)!;
      const cellMap = run.ctx.project.maps[mapId]!;
      const words = itemTileWords(name);
      if (words.length && invisibleEvent(now) && !objectAt(cellMap, now) && isPassable(run.ctx.project, cellMap, now.x, now.y)) {
        const art = singleTileObject(run.ctx.project, cellMap, words);
        if (art) {
          const copy = structuredClone(cellMap);
          (copy.upperTiles as number[])[now.y * copy.width + now.x] = art.tile;
          run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: copy } } as Project;
          moved.push(`${name || id} (${now.x},${now.y})에 「${art.label}」 그림`);
        }
      }
    }
  }
  return { moved, stuck };
}

// ── 이동 칸 앞 비우기 ─────────────────────────────────────────────────────────────
// 2026-10-28 standin jrpg 「버들마을과 마왕의 동굴」: 시작 컷신에서 소녀가 주인공에게 다가와(approach @player) 동굴 입구 착지 칸 (9,7)
// 바로 앞 (9,8)에 섰다. 자동 플레이는 동굴 입구까지 걷다 그 NPC 에 막혀 엔딩에 못 갔다. 규칙:
//  - 이 맵으로 들어오는 착지 칸과 그 둘레 한 칸, 이 맵의 이동 이벤트(문·입구) 둘레 한 칸에는 막는 이벤트가 서 있으면 안 된다.
//  - 컷신에서 주인공에게 다가가는 이벤트는 «다가간 끝 칸»도 같은 규칙을 따른다(끝 칸은 BFS 최단 거리의 주인공 옆 칸들).
// 어기면 그 이벤트의 자리를 가장 가까운, 위 칸들이 아닌 닿는 빈 바닥으로 옮긴다(다른 이벤트를 못 닿게 하는 자리는 고르지 않는다).

function hasTransfer(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTransfer);
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer") return true;
  return Object.values(r).some((v) => v && typeof v === "object" && hasTransfer(v));
}

/** 이 맵 이벤트들의 이동 명령 중 «id 가 주인공에게 다가가기»가 있나. */
function approachesPlayer(map: GameMap, id: string): boolean {
  let hit = false;
  const visit = (node: unknown): void => {
    if (hit || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    const r = node as Record<string, unknown>;
    if (r.kind === "moveEvent" && r.eventId === id) {
      const moves = ((r.route as { moves?: unknown[] } | undefined)?.moves ?? []) as Record<string, unknown>[];
      if (moves.some((m) => m.kind === "approach" && (m.target === "@player" || m.target === "player"))) { hit = true; return; }
    }
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v);
  };
  for (const ev of map.events ?? []) visit(ev.pages ?? ev.commands);
  return hit;
}

/** from 에서 걸어 player 옆에 닿는 최단 칸들(못 닿으면 빈 목록). */
function approachEnds(project: Project, map: GameMap, from: Cell, player: Cell): Cell[] {
  const w = map.width;
  const near = new Set(DIRS.map(([dx, dy]) => (player.y + dy) * w + player.x + dx).filter((i) => i >= 0 && i < w * map.height));
  const dist = new Int32Array(w * map.height).fill(-1);
  const pIdx = player.y * w + player.x;
  const q = [from.y * w + from.x];
  dist[q[0]!] = 0;
  let best = -1;
  const out: Cell[] = [];
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i - x) / w;
    if (best >= 0 && dist[i]! > best) break;
    if (near.has(i)) { best = dist[i]!; out.push({ x, y }); continue; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (dist[j]! >= 0 || j === pIdx || !canMove(project, map, x, y, nx, ny)) continue;
      dist[j] = dist[i]! + 1;
      q.push(j);
    }
  }
  return out;
}

/** 착지 칸·그 둘레, 이동 이벤트 둘레 — 막는 이벤트가 서면 안 되는 칸들. */
export function transferLaneCells(project: Project, map: GameMap): Set<number> {
  const w = map.width;
  const out = new Set<number>();
  const around = (c: Cell, self: boolean) => {
    if (self) out.add(c.y * w + c.x);
    for (const [dx, dy] of DIRS) { const x = c.x + dx, y = c.y + dy; if (x >= 0 && y >= 0 && x < w && y < map.height && isPassable(project, map, x, y)) out.add(y * w + x); }
  };
  const start = project.startMapId === map.id ? project.startPos : undefined;
  for (const a of playerAnchors(project, map)) if (!(start && a.x === start.x && a.y === start.y)) around(a, true);
  for (const ev of map.events ?? []) if (hasTransfer(ev.pages ?? ev.commands)) around(ev, false);
  return out;
}

/** 이동 칸 앞을 막는(또는 컷신에서 다가가 막게 되는) 이벤트를 옆으로 옮긴다. */
export function clearTransferLanes(run: BuildRun, mapId: string): ReachRepair {
  const moved: string[] = [];
  const stuck: string[] = [];
  const first = run.ctx.project.maps[mapId];
  if (!first) return { moved, stuck };
  for (const id of first.events.map((e) => e.id)) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === id);
    if (!ev || !eventBlocks(ev) || hasTransfer(ev.pages ?? ev.commands)) continue;
    const lanes = transferLaneCells(project, map);
    if (!lanes.size) continue;
    const w = map.width;
    const start = project.startMapId === mapId && project.startPos ? { x: project.startPos.x, y: project.startPos.y } : undefined;
    const approach = !!start && approachesPlayer(map, id);
    const bad = (c: Cell) => lanes.has(c.y * w + c.x) || (approach && approachEnds(project, map, c, start!).some((e) => lanes.has(e.y * w + e.x)));
    if (!bad(ev)) continue;
    const anchors = anchorsOf(project, map);
    const othersBlocked = blockersOf(map, id);
    const free = reachFrom(project, map, anchors, othersBlocked);
    const others = map.events.filter((e) => e.id !== id);
    const taken = new Set(others.map((e) => e.y * w + e.x));
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    const okOthers = (reach: Uint8Array) => others.every((o) => (!free[o.y * w + o.x] && !nextTo(map, free, o)) || nextTo(map, reach, o) || !!reach[o.y * w + o.x]);
    const cands: { c: Cell; s: number }[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!free[i] || taken.has(i) || anchorSet.has(i) || lanes.has(i)) continue;
      cands.push({ c: { x, y }, s: Math.abs(x - ev.x) + Math.abs(y - ev.y) });
    }
    cands.sort((a, b) => a.s - b.s);
    const target = cands.slice(0, 120).find(({ c }) => {
      if (bad(c)) return false;
      const blocked = new Set(othersBlocked);
      blocked.add(c.y * w + c.x);
      return okOthers(reachFrom(project, map, anchors, blocked));
    })?.c;
    const name = String((ev as { name?: string }).name ?? id);
    if (!target) { stuck.push(`${name}(${ev.x},${ev.y})`); continue; }
    const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
    if (res.ok) moved.push(`${name} (${ev.x},${ev.y})→(${target.x},${target.y}) 이동 칸 앞 비움${approach ? "(컷신에서 다가가는 끝 칸 포함)" : ""}`);
    else stuck.push(`${name}: ${String(res.summary).slice(0, 120)}`);
  }
  return { moved, stuck };
}
