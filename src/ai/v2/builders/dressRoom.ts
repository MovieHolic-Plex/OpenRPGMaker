// 조수 v2 — 이미 지어진 손 도트 실내의 «방 하나»를 그 방 쓰임의 가구로 채운다(dress_room).
//
// 왜(2026-10-26 hf2-school-claude-j80): 화면 검수가 「교장실 가운데가 비었다」를 세 판 내내 짚었는데 고치기 차례는
// stamp_object 로 소파·화분을 한 점씩 찍다 겹침 거부를 받고 멈췄다(결함 2→1→1, 맨바닥 57%). edit_place{dressing} 은 있었지만
// 그 「한 벌」이 손 도트 v5 부품 id(pew·desk 1x1 …)라 modern_city 같은 다른 실내 칩셋에서는 하나도 맞지 않아 아무것도 안 찍으면서
// 「한 벌을 덧찍었다」고 답했다. 그래서: 방 쓰임 낱말 → 그 칩셋의 방 종류 견본 가구·부품 이름표에서 가구 목록을 고르고,
// 방 안의 가장 빈 곳부터 한 점씩 놓되 놓을 때마다 도달 검사를 다시 하고(막으면 되돌림), 방의 빈 바닥이 목표 아래로 내려가면 멈춘다.
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { startCell } from "../checks";
import { terrainReachability } from "@/project/terrainReachability";
import type { BuildRun } from "../types";

const HAND_LAYOUT_ROOM_TAG = "hand-layout-room";
/**
 * 방 빈 바닥 목표(방 바닥 칸 대비 2×2 맨바닥 덩이 %). 15% 였을 때는 같은 방을 여러 번 부를 때마다 바 의자·벤치·식탁을 빈 곳마다 메워
 * 「가구를 늘어놓은 전시장」이 됐다(2026-10-28 interior 장부: 여관 홀·마법학교 홀·할머니 집). 걸어 다닐 바닥은 남긴다 — 방이 너무 넓으면
 * 메우지 말고 방을 줄인다(짓기 쪽 SHRINK_BARE_PCT).
 */
export const DRESS_ROOM_TARGET = 30;
/** 한 번 부를 때 놓는 서는 가구 상한 — 방 하나를 한 번에 가득 채우지 않는다. */
const MAX_ITEMS = 6;
/** 바닥 깔개는 방에 하나(넓은 방 120칸 이상은 둘) — 이미 깔린 깔개도 센다. 같은 빨강·파랑 사각 러그가 줄지어 「타일 견본」처럼 보였다(2026-10-28 마법학교 홀). */
const decorCap = (room: RoomRect): number => ((room.x1 - room.x0 + 1) * (room.y1 - room.y0 + 1) >= 120 ? 2 : 1);
/** 같은 가구는 한 방에 3점까지(이미 놓인 것까지 센다 — 여러 번 불러 바 의자 열둘이 됐다). */
const PER_ITEM_CAP = 3;
const RUG_WORD = /깔개|러그|rug|carpet|카펫|양탄자|매트|mat\b/iu;

export type RoomRect = { readonly name: string; readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

/** 쓰임 낱말을 칩셋 이름표에 있을 법한 낱말로 넓힌다(교장실 → 사무실·응접 …). */
const ALIASES: readonly [RegExp, readonly string[], RegExp?][] = [
  [/교장실|원장실|이사장실|principal|headmaster/iu, ["사무실", "응접", "office", "책상", "소파", "책장", "화분"], /침대|bed|카운터|계산대/iu],
  [/교무실|사무실|직원실|staff ?room|office/iu, ["사무실", "office", "책상", "화분"], /침대|bed/iu],
  [/교실|강의실|classroom/iu, ["교실", "학교", "책상", "school"], /침대|bed|소파|sofa|냉장고/iu],
  [/음악실|밴드|music/iu, ["음악", "피아노", "악기", "music"]],
  [/복도|corridor/iu, ["복도", "벤치", "사물함", "화분", "게시판", "대기 의자"], /카운터|접수|reception|소파|sofa|탁자|연설|lectern|골대|hoop|침대|체육|매트|뜀틀|객석|관람석|코트|강당|gym/iu],
  [/현관|로비|대기|lobby|entrance/iu, ["로비", "대기", "벤치", "화분", "신발장"], /침대|bed/iu],
  [/도서|서고|library/iu, ["도서", "책장", "library"]],
  [/보건실|양호실|병실|infirmary|ward/iu, ["병원", "침대", "병실"]],
  [/회의|meeting/iu, ["회의", "meeting"]],
  [/창고|storage|warehouse/iu, ["창고", "상자", "선반"]],
  [/카페|cafe/iu, ["카페", "cafe"]],
];

/** 이 방 쓰임에 맞는 놓을 수 있는 가구(서는 것·바닥 것, 4×3 이하) — 무게(견본 개수) 순. */
export function dressPalette(spec: HandInteriorSpec, purpose: string): { id: string; weight: number }[] {
  // 「학교」「방」 같은 넓은 낱말은 뺀다 — 「학교 복도」가 학교 태그의 체육 매트·객석을 끌어왔다.
  const words = new Set(purpose.toLowerCase().split(/[\s,·/()]+/u).filter((w) => w.length >= 2 && !/^(학교|방|공간|구역|건물|room|school|space|area)$/u.test(w)));
  const deny: RegExp[] = [];
  for (const [re, more, no] of ALIASES) if (re.test(purpose)) { for (const w of more) words.add(w.toLowerCase()); if (no) deny.push(no); }
  const usable = (id: string): boolean => {
    const o = spec.objects[id];
    if (!o || !o.cells?.length || (o.kind !== "floor" && o.kind !== "flat") || o.stairs || o.w > 4 || o.h > 3) return false;
    if (deny.some((re) => re.test(`${id} ${o.ko} ${(o.tags ?? []).join(" ")}`))) return false;
    return !(o.use ?? []).some((u) => ["gate", "trap", "key", "seal", "save", "travel"].includes(u));
  };
  const weight = new Map<string, number>();
  const add = (id: string, n: number) => { if (usable(id)) weight.set(id, (weight.get(id) ?? 0) + n); };
  // 1) 방 종류 견본: 종류 id·이름·별칭에 쓰임 낱말이 든 종류의 견본 가구.
  const table = spec.rooms;
  if (table) {
    const kinds = Object.entries(table.kinds).filter(([id, k]) => [...words].some((w) => `${id} ${k.ko} ${k.alias.join(" ")}`.toLowerCase().includes(w))).map(([id]) => id);
    for (const ex of table.examples) if (kinds.includes(ex[2])) for (const [id, n] of ex[3]) add(id, 2 * n);
  }
  // 2) 부품 이름표: 이름·태그·종류에 쓰임 낱말이 든 가구.
  for (const [id, o] of Object.entries(spec.objects)) {
    const hay = `${id} ${o.ko} ${o.category_ko} ${(o.tags ?? []).join(" ")}`.toLowerCase();
    const hits = [...words].filter((w) => hay.includes(w)).length;
    if (hits) add(id, hits);
  }
  const ranked = [...weight.entries()].map(([id, w]) => ({ id, weight: w })).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  // 낱말 하나 스친 것(무게 1)은 우연이 많다(복도에 농구 골대·연설대) — 무게 2 이상이 셋 넘게 있으면 그것만, 많아도 8개까지.
  const strong = ranked.filter((r) => r.weight >= 2);
  return (strong.length >= 3 ? strong : ranked).slice(0, 8);
}

/** 걸어 지나가는 바닥 장식(깔개·매트·바닥 무늬) — 막지 않으니 길 가운데에도 둔다. 쓰임에 맞는 것만. */
const DECOR_RULES: readonly [RegExp, RegExp][] = [
  // 깔개는 사람이 머무는 방·복도에 — 교실·체육관·창고·화장실에는 깔지 않는다(2026-10-26 프로브: 교실에 거실 깔개 7장).
  [/깔개|러그|rug|carpet|카펫/iu, /^(?!.*(교실|강의실|체육|강당|창고|화장실|부엌|주방|classroom|gym|storage|toilet|kitchen)).*(교장|원장|사무|교무|응접|거실|음악|도서|로비|현관|대기|회의|침실|복도|보건|상담|서재|office|living|music|library|lobby|meeting|bedroom|corridor|hall|study)/iu],
  [/매트|mat/iu, /유치원|놀이|체육|kinder|gym|play/iu],
  [/체크|checker/iu, /카페|식당|부엌|주방|화장실|cafe|kitchen|diner/iu],
  [/점자|tactile/iu, /역|승강장|지하철|station|platform|subway/iu],
  [/다다미|방석|이불|tatami|zabuton|futon|화로/iu, /다다미|와실|일본|다실|화실|tatami|japanese/iu],
  [/코트|court|센터 서클/iu, /체육|강당|gym|court/iu],
];
export function decorPalette(spec: HandInteriorSpec, purpose: string): string[] {
  const out: string[] = [];
  for (const [id, o] of Object.entries(spec.objects)) {
    if (o.kind !== "flat" || !o.cells?.length || o.w > 4 || o.h > 4 || (o.use ?? []).some((u) => ["gate", "trap", "key", "seal", "save", "travel"].includes(u))) continue;
    const hay = `${id} ${o.ko} ${(o.tags ?? []).join(" ")}`;
    if (DECOR_RULES.some(([what, where]) => what.test(hay) && where.test(purpose))) out.push(id);
  }
  return out.sort((a, b) => spec.objects[b]!.w * spec.objects[b]!.h - spec.objects[a]!.w * spec.objects[a]!.h);
}

/** 방 = 손 도트 방 구획(location). at 칸이 든 것, 없으면 undefined. */
export function roomAt(map: GameMap, at: { x: number; y: number }): RoomRect | undefined {
  const hit = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG))
    .filter((l) => at.x >= l.x && at.x < l.x + l.w && at.y >= l.y && at.y < l.y + l.h)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  return hit ? { name: hit.name, x0: hit.x, y0: hit.y, x1: hit.x + hit.w - 1, y1: hit.y + hit.h - 1 } : undefined;
}

function freeFloor(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  return isPassable(project, map, x, y) && (map.lowerOverlayTiles?.[i] ?? -1) < 0 && (map.upperTiles[i] ?? -1) < 0
    && (map.upperOverlayTiles?.[i] ?? -1) < 0 && !(map.events ?? []).some((e) => e.x === x && e.y === y);
}

/** 그 칸에 다른 물체(3·4층 그림)가 없나 — 맵 밖은 «있다». */
function noObjectAt(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const i = y * map.width + x;
  return (map.upperTiles[i] ?? -1) < 0 && (map.upperOverlayTiles?.[i] ?? -1) < 0;
}

/** 방 빈 바닥 % — 2×2 이상 맨바닥 덩이에 드는 칸 ÷ 방 바닥 칸(bareFloor.ts 와 같은 눈, 방 하나만). */
export function roomBarePct(project: Project, map: GameMap, room: RoomRect): number {
  const w = room.x1 - room.x0 + 1, h = room.y1 - room.y0 + 1;
  const free = (x: number, y: number) => freeFloor(project, map, room.x0 + x, room.y0 + y);
  const tileset = project.tilesets[map.tilesetId];
  let floor = 0;
  const bare = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lower = map.lowerTiles[(room.y0 + y) * map.width + room.x0 + x] ?? -1;
    const pass = lower >= 0 ? tileset?.passability?.[lower] : undefined;
    if (pass && (pass.up || pass.down || pass.left || pass.right)) floor++;
  }
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
    if (free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1)) bare[y * w + x] = bare[y * w + x + 1] = bare[(y + 1) * w + x] = bare[(y + 1) * w + x + 1] = 1;
  }
  let n = 0;
  for (const b of bare) n += b;
  return floor ? Math.round((100 * n) / floor) : 0;
}

/** 1층이 걸을 수 있는 바닥인가(가구가 서 있어도 바닥). 벽·천장·방 밖은 아니다. */
function floorCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const lower = map.lowerTiles[y * map.width + x] ?? -1;
  const pass = lower >= 0 ? project.tilesets[map.tilesetId]?.passability?.[lower] : undefined;
  return !!pass && (pass.up || pass.down || pass.left || pass.right);
}

/**
 * 손 도트 부품 id → 그 칩셋의 킷 id. 칩셋마다 머리가 다르다: 손 도트 v5 는 hand-interior:<id>, modern_city 는 mc-in-<id>
 * (또는 mc-in-opus-<id>). 예전 덧찍기는 hand-interior: 만 써서 modern_city 방에는 아무것도 못 찍었다.
 */
export function handObjectKitId(project: Project, tilesetId: string, id: string): string | undefined {
  const kits = project.tilesets[tilesetId]?.structureKits ?? [];
  for (const k of [`hand-interior:${id}`, `mc-in-${id}`, `mc-in-opus-${id}`, id]) if (kits.some((kit) => kit.id === k)) return k;
  return kits.filter((kit) => kit.id.endsWith(`:${id}`) || kit.id.endsWith(`-${id}`)).sort((a, b) => a.id.length - b.id.length)[0]?.id;
}

/** 그 칸의 네 층 타일. */
function layerTiles(map: GameMap, x: number, y: number): number[] {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return [];
  const i = y * map.width + x;
  return [map.lowerTiles[i] ?? -1, map.lowerOverlayTiles?.[i] ?? -1, map.upperTiles[i] ?? -1, map.upperOverlayTiles?.[i] ?? -1];
}

/** 방 안(둘레 2칸 포함)에 이미 놓인 그 가구의 자리들 — 그림 칸이 전부 맞는 원점. */
export function placedInRoom(spec: HandInteriorSpec, map: GameMap, room: RoomRect, id: string): { x: number; y: number }[] {
  const o = spec.objects[id];
  if (!o?.cells?.length) return [];
  const out: { x: number; y: number }[] = [];
  const [dx0, dy0, t0] = o.cells[0]!;
  for (let y = room.y0 - 2; y <= room.y1 + 2; y++) for (let x = room.x0 - 2; x <= room.x1 + 2; x++) {
    if (!layerTiles(map, x + dx0, y + dy0).includes(t0)) continue;
    if (o.cells.every(([dx, dy, t]) => layerTiles(map, x + dx, y + dy).includes(t))) out.push({ x, y });
  }
  return out;
}

/** 방 안에 이미 깔린 깔개 사각형들(칩셋의 깔개 그림과 맞는 것). */
function rugsInRoom(spec: HandInteriorSpec, map: GameMap, room: RoomRect): { x0: number; y0: number; x1: number; y1: number }[] {
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (const [id, o] of Object.entries(spec.objects)) {
    if (o.kind !== "flat" || o.stairs || !RUG_WORD.test(`${id} ${o.ko}`)) continue;
    for (const at of placedInRoom(spec, map, room, id)) out.push({ x0: at.x, y0: at.y, x1: at.x + o.w - 1, y1: at.y + Math.max(1, o.h) - 1 });
  }
  return out;
}

/** 쓰임 낱말 → 방 종류 이름(손 도트 방 구획 이름). 모델이 at 을 다른 방에 찍어도(여관 홀을 채우라며 객실 칸) 쓰임에 맞는 방을 채운다. */
const PURPOSE_ROOM: readonly [RegExp, RegExp][] = [
  [/선술집|주점|술집|여관 ?홀|tavern|pub|\bbar\b/iu, /^(tavern|dining|great_hall)/u],
  [/부엌|주방|kitchen/iu, /^(kitchen|prep)/u],
  [/창고|저장|storeroom|pantry/iu, /^(storeroom|pantry|cellar)/u],
  [/침실|객실|안방|bed ?room|inn ?room/iu, /^(bedroom|inn_room|master_bedroom)/u],
  [/서재|study/iu, /^(study|library)/u],
  [/도서|서고|library/iu, /^(library|study)/u],
  [/거실|living/iu, /^(living|dining)/u],
  [/현관|입구|entrance|로비|lobby/iu, /^(entrance|genkan|lobby|hall)/u],
];
function roomForPurpose(map: GameMap, here: RoomRect, purpose: string): RoomRect {
  const rule = PURPOSE_ROOM.find(([re]) => re.test(purpose));
  if (!rule || rule[1].test(here.name)) return here;
  const hit = (map.locations ?? []).filter((l) => (l.tags ?? []).includes(HAND_LAYOUT_ROOM_TAG) && rule[1].test(l.name)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  return hit ? { name: hit.name, x0: hit.x, y0: hit.y, x1: hit.x + hit.w - 1, y1: hit.y + hit.h - 1 } : here;
}

/** 걸어서 닿는 정도: 닿지 못하는 걸을 칸 수 + 손이 닿지 않게 된 이벤트 수. 놓기 전보다 늘면 그 가구는 되돌린다. */
export function access(project: Project, mapId: string): { stranded: number; cutOff: number } {
  const map = project.maps[mapId]!;
  const start = startCell(project, map);
  if (!start) return { stranded: Infinity, cutOff: Infinity };
  const reach = terrainReachability(project, map, start);
  let stranded = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y) && !reach[y * map.width + x]) stranded++;
  const touch = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !!reach[y * map.width + x];
  const cutOff = (map.events ?? []).filter((e) => !touch(e.x, e.y) && !touch(e.x + 1, e.y) && !touch(e.x - 1, e.y) && !touch(e.x, e.y + 1) && !touch(e.x, e.y - 1)).length;
  return { stranded, cutOff };
}

export interface DressRoomResult { readonly ok: boolean; readonly summary: string; readonly placed: readonly string[]; readonly before: number; readonly after: number }

/** 방 하나를 쓰임 가구로 채운다. 칸 하나 놓을 때마다 도달 검사 — 막으면 되돌린다. */
export function dressRoom(run: BuildRun, mapId: string, at: { x: number; y: number }, purpose: string, target = DRESS_ROOM_TARGET): DressRoomResult {
  const map0 = run.ctx.project.maps[mapId];
  const spec = map0 ? roomSpecOf(run.ctx.project.tilesets[map0.tilesetId]) : undefined;
  if (!map0 || !spec) return { ok: false, summary: `${mapId} 는 손 도트 실내가 아니다 — dress_room 은 손 도트 실내 방만 채운다`, placed: [], before: 0, after: 0 };
  const atRoom = roomAt(map0, at);
  const room = atRoom ? roomForPurpose(map0, atRoom, purpose) : undefined;
  if (!room) return { ok: false, summary: `(${at.x},${at.y}) 는 손 도트 방 구획 안이 아니다 — inspect 로 방 안의 바닥 칸을 골라 다시 부른다`, placed: [], before: 0, after: 0 };
  const palette = dressPalette(spec, purpose);
  const map = () => run.ctx.project.maps[mapId]!;
  const before = roomBarePct(run.ctx.project, map(), room);
  if (!palette.length) return { ok: false, summary: `«${purpose}» 에 맞는 가구를 ${map0.tilesetId} 칩셋에서 찾지 못했다 — 쓰임을 다른 낱말(예: 사무실·교실·복도·창고)로 다시 부른다`, placed: [], before, after: before };
  const tilesetId = map0.tilesetId;
  const placed: string[] = [];
  const failedAt = new Set<string>();
  const existing = new Map<string, number>();
  let turn = 0;
  let base = access(run.ctx.project, mapId);
  // 시작 칸이 없으면 도달을 잴 수 없다 — 재지 못하면 놓지 않는다(Infinity > Infinity 는 거짓이라 막는 가구를 못 거른다).
  if (!Number.isFinite(base.stranded)) return { ok: false, summary: `${mapId} 에서 걸어 닿는 정도를 잴 시작 칸이 없어 방을 채우지 않았다`, placed: [], before: roomBarePct(run.ctx.project, map(), room), after: roomBarePct(run.ctx.project, map(), room) };
  for (let attempt = 0; attempt < MAX_ITEMS * 3 && placed.length < MAX_ITEMS; attempt++) {
    if (roomBarePct(run.ctx.project, map(), room) <= target) break;
    // 무게대로 돌아가며 고른다(같은 것만 줄지어 놓지 않게 — 앞 3개를 두 번씩, 나머지는 한 번씩).
    const order = palette.flatMap((p, i) => (i < 3 ? [p.id, p.id] : [p.id]));
    const id = order[turn++ % order.length]!;
    const area = spec.objects[id]!.w * Math.max(1, spec.objects[id]!.h);
    // 큰 가구(피아노·드럼 세트·소파)는 한 방에 하나, 중간 것은 둘 — 같은 큰 가구 다섯이 줄지으면 창고로 읽힌다.
    const label = `${id} ${spec.objects[id]!.ko}`;
    // 교실의 책상은 줄지어 여럿, 교탁·칠판·피아노 같은 «하나뿐인 것»은 하나.
    const cap = /교실|강의실|classroom/iu.test(purpose) && /책상|desk/iu.test(label) && !/교탁|교사|teacher|lectern/iu.test(label) ? 8
      : /교탁|lectern|칠판|blackboard|피아노|piano|금고|safe/iu.test(label) ? 1
      : area >= 6 ? 1 : area >= 2 ? 2 : PER_ITEM_CAP;
    // 이미 그 방에 놓인 것까지 센다 — 같은 방을 여러 번 채우면 바 의자·벤치가 열 넘게 쌓였다.
    const already = existing.get(id) ?? (existing.set(id, placedInRoom(spec, map(), room, id).length), existing.get(id)!);
    if (already + placed.filter((p) => p.startsWith(`${spec.objects[id]!.ko}(`)).length >= cap) continue;
    const o = spec.objects[id]!;
    const rows = Math.max(1, o.h) + (o.kind === "flat" ? 0 : 1);
    // 가장 빈 곳: 둘레 한 칸까지 비어 있고, 둘레 5칸 창의 빈 칸이 가장 많은 자리.
    let best: { x: number; y: number; score: number } | undefined;
    for (let y = room.y0 + 1; y + rows - 1 <= room.y1; y++) for (let x = room.x0; x + o.w - 1 <= room.x1; x++) {
      if (failedAt.has(`${id}@${x},${y}`)) continue;
      let ok = true;
      for (let j = 0; j < rows && ok; j++) for (let i = 0; i < o.w && ok; i++) if (!freeFloor(run.ctx.project, map(), x + i, y + j)) ok = false;
      // 그림이 발 위로 솟은 칸(교탁·책상 윗면)도 다른 물체와 겹치면 안 된다 — stamp_object 가 거부한다(2026-10-26 프로브: 시도 대부분이 이것).
      if (ok && !o.cells.every(([cx, cy]) => noObjectAt(map(), x + cx, y + cy))) ok = false;
      if (!ok) continue;
      let score = 0;
      for (let j = -2; j < rows + 2; j++) for (let i = -2; i < o.w + 2; i++) if (freeFloor(run.ctx.project, map(), x + i, y + j)) score++;
      // 벽을 등진 자리를 먼저(방 둘레를 따라 가구를 두고 가운데는 비워 길로 쓴다 — 사람 방의 모양). 북벽 발치·옆벽 붙이기.
      const wallN = Array.from({ length: o.w }, (_, i) => !floorCell(run.ctx.project, map(), x + i, y - 1)).every(Boolean);
      const wallW = Array.from({ length: rows }, (_, j) => !floorCell(run.ctx.project, map(), x - 1, y + j)).every(Boolean);
      const wallE = Array.from({ length: rows }, (_, j) => !floorCell(run.ctx.project, map(), x + o.w, y + j)).every(Boolean);
      // 서는 가구는 벽을 등진 자리에만 둔다 — 가운데 빈 곳마다 책상·의자·바 의자를 흩뿌리면 「산재」로 읽혔다(2026-10-28). 가운데는 길로 남긴다.
      // 예외: 책상·장의자·탁자 줄(교실·예배당·서고 열람석)은 그 방의 쓰임 자체라 가운데에 줄지어 선다 — 같은 가구와 같은 줄·같은 열에 맞춘다.
      const rowPiece = /desk|pew|table|책상|장의자|탁자|식탁/iu.test(label) && !/side|협탁|벽/iu.test(label);
      if (!(wallN || wallW || wallE || rowPiece)) continue;
      if (rowPiece && !(wallN || wallW || wallE)) {
        const same = placedInRoom(spec, map(), room, id);
        if (same.some((p) => p.y === y || p.x === x)) score += 12;
      }
      // 이웃 가구와 맞붙지 않게: 좌우 한 칸 틈(벽 따라 줄짓는 같은 가구는 허용) — 장작 더미가 안락의자 등받이에 얹힌 듯 붙었다.
      const sideBusy = [-1, o.w].some((i) => Array.from({ length: rows }, (_, j) => j).some((j) => !noObjectAt(map(), x + i, y + j) && floorCell(run.ctx.project, map(), x + i, y + j)));
      if (sideBusy) score -= 20;
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) continue;
    const snapshot = run.ctx.project;
    const minDx = Math.min(...o.cells.map((c) => c[0])), minDy = Math.min(...o.cells.map((c) => c[1]));
    const kitId = handObjectKitId(run.ctx.project, tilesetId, id);
    if (!kitId) { failedAt.add(`${id}@${best.x},${best.y}`); continue; }
    const res = run.call("stamp_object", { objectId: `kit:${tilesetId}/${kitId}`, mapId, x: best.x + minDx, y: best.y + minDy });
    const now = res.ok ? access(run.ctx.project, mapId) : undefined;
    if (!res.ok || !now || now.stranded > base.stranded || now.cutOff > base.cutOff) { run.ctx.project = snapshot; failedAt.add(`${id}@${best.x},${best.y}`); continue; }
    base = now!;
    placed.push(`${o.ko}(${best.x},${best.y})`);
  }
  // 2) 서는 가구로 더 채우면 길을 막는다 — 남은 빈 바닥 덩이에 밟고 지나가는 바닥 장식(깔개·매트)을 깐다.
  //    (2026-10-26 j81: 가구만으로는 교장실 42%·복도 79%에서 멈췄다.) 막지 않으니 도달 검사가 필요 없고, 서로 한 칸 띄운다.
  const decor = decorPalette(spec, purpose);
  const laid: string[] = [];
  // 이미 깔린 깔개도 센다 — 두 깔개가 겹치거나(초록 사각 깔개가 파란 둥근 깔개를 덮음) 같은 깔개가 줄지어 깔렸다(2026-10-28).
  const decorRects: { x0: number; y0: number; x1: number; y1: number }[] = rugsInRoom(spec, map(), room);
  for (let k = decorRects.length; k < decorCap(room) && decor.length && roomBarePct(run.ctx.project, map(), room) > target; k++) {
    let best: { id: string; x: number; y: number; score: number } | undefined;
    for (const id of decor) {
      const o = spec.objects[id]!;
      for (let y = room.y0 + 1; y + o.h - 1 <= room.y1; y++) for (let x = room.x0; x + o.w - 1 <= room.x1; x++) {
        if (failedAt.has(`${id}@${x},${y}`)) continue;
        if (decorRects.some((r) => x <= r.x1 + 2 && x + o.w - 1 >= r.x0 - 2 && y <= r.y1 + 2 && y + o.h - 1 >= r.y0 - 2)) continue;
        let ok = true;
        for (let j = 0; j < o.h && ok; j++) for (let i = 0; i < o.w && ok; i++) if (!freeFloor(run.ctx.project, map(), x + i, y + j)) ok = false;
        if (ok && !o.cells.every(([cx, cy]) => noObjectAt(map(), x + cx, y + cy))) ok = false;
        if (!ok) continue;
        // 덮는 칸 + 둘레가 빈 바닥인 정도(덩이 가운데일수록 좋다).
        let score = o.w * o.h * 4;
        for (let j = -1; j <= o.h; j++) for (let i = -1; i <= o.w; i++) if (freeFloor(run.ctx.project, map(), x + i, y + j)) score++;
        if (!best || score > best.score) best = { id, x, y, score };
      }
    }
    if (!best) break;
    const o = spec.objects[best.id]!;
    const kitId = handObjectKitId(run.ctx.project, tilesetId, best.id);
    const minDx = Math.min(...o.cells.map((c) => c[0])), minDy = Math.min(...o.cells.map((c) => c[1]));
    const snapshot = run.ctx.project;
    const res = kitId ? run.call("stamp_object", { objectId: `kit:${tilesetId}/${kitId}`, mapId, x: best.x + minDx, y: best.y + minDy }) : { ok: false };
    const now = res.ok ? access(run.ctx.project, mapId) : undefined;
    if (!res.ok || !now || now.stranded > base.stranded || now.cutOff > base.cutOff) { run.ctx.project = snapshot; failedAt.add(`${best.id}@${best.x},${best.y}`); continue; }
    decorRects.push({ x0: best.x, y0: best.y, x1: best.x + o.w - 1, y1: best.y + o.h - 1 });
    laid.push(`${o.ko}(${best.x},${best.y})`);
  }
  if (laid.length) placed.push(...laid);
  const after = roomBarePct(run.ctx.project, map(), room);
  const reached = after <= target;
  return {
    // 이미 걸을 바닥만 남은 방은 «다 됐다»로 알린다 — 실패로 알리면 모델이 같은 방을 몇 번이고 다시 채우려 했다.
    ok: placed.length > 0 || before <= target,
    placed, before, after,
    summary: placed.length
      ? `«${room.name}» 방을 «${purpose}» 가구 ${placed.length - laid.length}점${laid.length ? `·바닥 깔개 ${laid.length}점` : ""}으로 채웠다 — 방 빈 바닥 ${before}% → ${after}%${reached ? "" : `(목표 ${target}% 에 못 닿음 — 더 놓을 빈 자리가 길을 막는다)`}. 놓은 것: ${placed.slice(0, 12).join(", ")}${placed.length > 12 ? " …" : ""}`
      : before <= target
        ? `«${room.name}» 방은 이미 가구가 충분하다(빈 바닥 ${before}% ≤ ${target}%) — 걸어 다닐 바닥은 남겨 두므로 더 놓지 않았다. 이 방은 더 채우지 않는다.`
        : `«${room.name}» 방에 «${purpose}» 가구를 더 놓을 벽 쪽 자리가 없었다(빈 바닥 ${before}%) — 가운데에 흩어 놓지 않는다. 방이 휑하면 방이 너무 큰 것이다(edit_place 로 size 를 줄인다).`,
  };
}
