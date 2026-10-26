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
export const DRESS_ROOM_TARGET = 15;
const MAX_ITEMS = 24;
/** 같은 가구는 한 방에 4점까지(드럼 세트만 여섯 놓지 않게). */
const PER_ITEM_CAP = 4;

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

/** 걸어서 닿는 정도: 닿지 못하는 걸을 칸 수 + 손이 닿지 않게 된 이벤트 수. 놓기 전보다 늘면 그 가구는 되돌린다. */
function access(project: Project, mapId: string): { stranded: number; cutOff: number } {
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
  const room = roomAt(map0, at);
  if (!room) return { ok: false, summary: `(${at.x},${at.y}) 는 손 도트 방 구획 안이 아니다 — inspect 로 방 안의 바닥 칸을 골라 다시 부른다`, placed: [], before: 0, after: 0 };
  const palette = dressPalette(spec, purpose);
  const map = () => run.ctx.project.maps[mapId]!;
  const before = roomBarePct(run.ctx.project, map(), room);
  if (!palette.length) return { ok: false, summary: `«${purpose}» 에 맞는 가구를 ${map0.tilesetId} 칩셋에서 찾지 못했다 — 쓰임을 다른 낱말(예: 사무실·교실·복도·창고)로 다시 부른다`, placed: [], before, after: before };
  const tilesetId = map0.tilesetId;
  const placed: string[] = [];
  const failedAt = new Set<string>();
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
    const cap = area >= 6 ? 1 : area >= 2 ? 2 : PER_ITEM_CAP;
    if (placed.filter((p) => p.startsWith(`${spec.objects[id]!.ko}(`)).length >= cap) continue;
    const o = spec.objects[id]!;
    const rows = Math.max(1, o.h) + (o.kind === "flat" ? 0 : 1);
    // 가장 빈 곳: 둘레 한 칸까지 비어 있고, 둘레 5칸 창의 빈 칸이 가장 많은 자리.
    let best: { x: number; y: number; score: number } | undefined;
    for (let y = room.y0 + 1; y + rows - 1 <= room.y1; y++) for (let x = room.x0; x + o.w - 1 <= room.x1; x++) {
      if (failedAt.has(`${id}@${x},${y}`)) continue;
      let ok = true;
      for (let j = 0; j < rows && ok; j++) for (let i = 0; i < o.w && ok; i++) if (!freeFloor(run.ctx.project, map(), x + i, y + j)) ok = false;
      if (!ok) continue;
      let score = 0;
      for (let j = -2; j < rows + 2; j++) for (let i = -2; i < o.w + 2; i++) if (freeFloor(run.ctx.project, map(), x + i, y + j)) score++;
      // 벽을 등진 자리를 먼저(방 둘레를 따라 가구를 두고 가운데는 비워 길로 쓴다 — 사람 방의 모양). 북벽 발치·옆벽 붙이기.
      const wallN = Array.from({ length: o.w }, (_, i) => !floorCell(run.ctx.project, map(), x + i, y - 1)).every(Boolean);
      const wallW = Array.from({ length: rows }, (_, j) => !floorCell(run.ctx.project, map(), x - 1, y + j)).every(Boolean);
      const wallE = Array.from({ length: rows }, (_, j) => !floorCell(run.ctx.project, map(), x + o.w, y + j)).every(Boolean);
      if (wallN || wallW || wallE) score += 30;
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
  const after = roomBarePct(run.ctx.project, map(), room);
  const reached = after <= target;
  return {
    ok: placed.length > 0,
    placed, before, after,
    summary: placed.length
      ? `«${room.name}» 방을 «${purpose}» 가구 ${placed.length}점으로 채웠다 — 방 빈 바닥 ${before}% → ${after}%${reached ? "" : `(목표 ${target}% 에 못 닿음 — 더 놓을 빈 자리가 길을 막는다)`}. 놓은 것: ${placed.slice(0, 12).join(", ")}${placed.length > 12 ? " …" : ""}`
      : `«${room.name}» 방에 놓을 수 있는 «${purpose}» 가구 자리가 없었다(빈 바닥 ${before}%) — 놓으면 길을 막거나 겹친다`,
  };
}
