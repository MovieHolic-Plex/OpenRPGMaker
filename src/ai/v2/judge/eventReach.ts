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
import { playerAnchors, sameMapPassages } from "@/editor/tools/transferReachability";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { tileLabel } from "../place/cells";
import { eventBodyRect, eventPassageRect } from "@/project/eventFootprintQuery";

export type Cell = { x: number; y: number };
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
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
export function anchorsOf(project: Project, map: GameMap): Cell[] {
  const start = project.startMapId === map.id && project.startPos && isPassable(project, map, project.startPos.x, project.startPos.y) ? [{ x: project.startPos.x, y: project.startPos.y }] : [];
  return start.length ? start : playerAnchors(project, map).filter((a) => isPassable(project, map, a.x, a.y));
}

/** 앵커에서 걸어 닿는 칸(blocked 는 못 지난다). 같은 맵 안 이동 이벤트 옆에 닿으면 그 도착 칸에서도 이어 걷는다. */
export function reachFrom(project: Project, map: GameMap, anchors: readonly Cell[], blocked: ReadonlySet<number>, passageList?: readonly { at: Cell; to: Cell[] }[]): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  const q: number[] = [];
  // 앵커 칸 자체는 막는 이벤트가 있어도 연다 — 플레이어가 그 칸에 서서 시작한다. 시작점이 층 이동 출입구(밟으면 옮기는 칸) 위면 막는 칸으로
  // 셈되어 맵 전체가 「닿지 못함」이 되고, 사람 옮기기(spreadCrowdedPeople)가 후보 0 으로 아무도 못 옮겼다(2026-10-29 vm4 argon mystery:
  // 여관 주인·악사가 양탄자 통로에 위아래로 붙어 섰다).
  for (const a of anchors) { const i = a.y * w + a.x; if (!seen[i]) { seen[i] = 1; q.push(i); } }
  const passages = passageList ?? sameMapPassages(map);
  const used = new Set<number>();
  for (let k = 0; ; k++) {
    if (k >= q.length) {
      // 닿은 칸 곁(또는 위)의 같은 맵 이동 이벤트 — 그 도착 칸을 새 앵커로.
      let grew = false;
      passages.forEach((p, n) => {
        if (used.has(n)) return;
        const on = !!seen[p.at.y * w + p.at.x];
        if (!on && !DIRS.some(([dx, dy]) => { const x = p.at.x + dx, y = p.at.y + dy; return x >= 0 && y >= 0 && x < w && y < map.height && !!seen[y * w + x]; })) return;
        used.add(n);
        for (const t of p.to) { const i = t.y * w + t.x; if (!seen[i] && !blocked.has(i)) { seen[i] = 1; q.push(i); grew = true; } }
      });
      if (!grew) break;
    }
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

/**
 * 막는 이벤트가 차지하는 칸 — 앵커 칸과 몸 사각의 통행 줄(런타임 passRect 와 같은 eventPassageRect) 전부.
 * 왜(2026-10-29 vm4 deepseek 탈출): 가구 전체 조사(settleFurnitureSpots)로 1×2 몸이 된 「촛대 선반」 윗칸이 방 오른쪽으로 가는 유일한 목을
 * 막았는데, 앵커 칸만 막힘으로 세어 사람 떼기가 하녀를 남은 목(13,6)에 세웠고 자동 플레이가 탈출문 쪽에 갇혔다.
 */
export function blockersOf(map: GameMap, except?: string): Set<number> {
  const out = new Set<number>();
  for (const ev of map.events ?? []) {
    if (ev.id === except || !eventBlocks(ev)) continue;
    out.add(ev.y * map.width + ev.x);
    const rect = eventPassageRect(ev);
    for (let y = Math.max(0, rect.top); y <= Math.min(map.height - 1, rect.bottom); y++) {
      for (let x = Math.max(0, rect.left); x <= Math.min(map.width - 1, rect.right); x++) out.add(y * map.width + x);
    }
  }
  return out;
}

/** 이벤트 몸 사각의 어느 칸이든 걸어 닿는 칸 곁(또는 위)인가. 1×1 이면 앵커 곁과 같다. */
export function bodyReached(map: GameMap, reach: Uint8Array, ev: GameEvent): boolean {
  const rect = eventBodyRect(ev);
  for (let y = rect.top; y <= rect.bottom; y++) for (let x = rect.left; x <= rect.right; x++) {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (reach[y * map.width + x] || nextTo(map, reach, { x, y })) return true;
  }
  return false;
}

export const nextTo = (map: GameMap, reach: Uint8Array, c: Cell) => DIRS.some(([dx, dy]) => {
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
  return (map.events ?? []).filter((ev) => (!eventIds || eventIds.includes(ev.id)) && !bodyReached(map, reach, ev)).map((ev) => ev.id);
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
function doorArtAt(project: Project, map: GameMap): (x: number, y: number) => boolean {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => {
    const label = tileLabel(project, map, m[k]?.[y * map.width + x]);
    return !!label && isDoorArtLabel(label);
  });
}

export function doorArtCells(project: Project, map: GameMap): Cell[] {
  const hit = doorArtAt(project, map);
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
export const baseLabel = (label: string) => label.replace(/\s*\((?:-?\d+,\s*-?\d+|프레임[^)]*)\)/gu, "").trim();

/** 이 이름이 가리키는 물건의 이름표 낱말 목록들(앞선 것부터 시도). */
export function hostWords(name: string): string[][] {
  const hits: { at: number; words: readonly string[] }[] = [];
  for (const [re, words] of HOSTS) { const m = re.exec(name); if (m) hits.push({ at: m.index, words }); }
  hits.sort((a, b) => a.at - b.at);
  const out = hits.map((h) => [...h.words]);
  for (const [re, hosts] of ITEMS) if (re.test(name)) out.push(...hosts.map((h) => [h]));
  return out;
}
/** 글 속 물건 낱말(HOSTS) — 나온 자리 순. 대사가 가리키는 물건을 읽을 때 쓴다(clueObjects.ts). */
export function hostMentions(text: string): { at: number; word: string; words: readonly string[] }[] {
  const out: { at: number; word: string; words: readonly string[] }[] = [];
  for (const [re, words] of HOSTS) {
    const g = new RegExp(re.source, `${re.flags.replace("g", "")}g`);
    for (const m of text.matchAll(g)) out.push({ at: m.index ?? 0, word: m[0], words });
  }
  return out.sort((a, b) => a.at - b.at);
}
export const objectBaseName = (label: string) => baseLabel(label);
export function itemTileWords(name: string): string[] {
  for (const [re, , tiles] of ITEMS) if (re.test(name)) return [...tiles];
  for (const [re, words] of HOSTS) if (re.test(name)) return [...words];
  return [];
}

const LAYER_KEYS = ["upperOverlayTiles", "upperTiles", "lowerOverlayTiles", "lowerTiles"] as const;
/** 이름표가 words 중 하나를 품은 물건 칸들(바닥·벽·천장 제외). */
export function objectCells(project: Project, map: GameMap, words: readonly string[]): Set<number> {
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
export function singleTileObject(project: Project, map: GameMap, words: readonly string[]): { tile: number; label: string } | undefined {
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
export function invisibleEvent(ev: GameEvent): boolean {
  return (ev.pages ?? []).every((p) => { const g = (p.graphic ?? {}) as { sprite?: unknown; transparent?: boolean; tileId?: number }; return g.transparent === true || (!g.sprite && !(typeof g.tileId === "number" && g.tileId > 0)); });
}
