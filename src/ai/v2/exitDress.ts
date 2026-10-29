// 실내 맵의 출구·빈 칸 마감 — 화면 검수 장부의 빌더 결함(2026-10-28 06-vqa-classify: builder-exit 5 · builder-tiles 4)을 결정적으로 고친다.
//
// 1) 막다른 남쪽 출구: 방 짓기(handInterior)는 남쪽 바깥벽에 한 칸 틈을 내고 그 아래로 맵 밖까지 통로 목을 그린다. 맵 하나짜리
//    방탈출(mt2 argon·terra·flash)은 그 틈에 이동 칸이 없어서 «문 없이 어두운 빈 통로로 이어진 출구»로 보였다. terra 는 모델이
//    잠긴 나무 문을 틈에 세웠는데 남쪽 틈 속 문은 «사다리·어두운 구멍»으로 읽혔다.
//    → 틈에 이동(transfer)이 없고 맵에 문 이름 이벤트(탈출 문·출구 문)가 있으면: 틈을 벽(천장 띠)으로 메우고, 문 이벤트를 북쪽 벽
//      발치로 옮겨 칩셋의 문 그림(손 도트 실내 = 잠긴 나무 문 + 둥근 아치 문틀, 현대·학교·일본 실내 = 벽 문)을 그 칸에 세운다.
//      뒷문(builders/interior.ts addBackDoor)과 같은 «벽에 난 문» 모양이다. 이미 문 그림 위에 선 문 이벤트는 옮기지 않고 틈만 메운다.
// 2) 빈 공허 칸: 두 방 높이가 다르면 짧은 방 위가 «실내 공허» 칸으로 남는다 — 현대 칩셋은 그 그림이 남색이라 맵에 구멍이 난 것처럼
//    보였다(flash «밀실 탈출실» 오른쪽 위). → 방들이 차지한 범위(+1칸) 안의 공허 칸을 천장 띠로 이어 칠한다(handInteriorStructure 와 같은 이웃 규칙).
// 방 크기·가구는 건드리지 않는다(실내 담당 영역).
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { canMove, isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isDoorName, reachableCells, repairEventReach, unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";
import { CODE_STEP_WORDS, isEscapeBlueprint } from "./blueprint";

type Cell = { x: number; y: number };
type Layer = 1 | 2 | 3 | 4;

function hasTransfer(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTransfer);
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer") return true;
  return Object.values(r).some((v) => v && typeof v === "object" && hasTransfer(v));
}

interface Kit {
  readonly S: HandInteriorSpec;
  readonly band: Set<number>;
  readonly ceil: readonly number[];
  readonly corners?: Readonly<Record<string, number>>;
  readonly faces: Set<number>;
}

function kitOf(project: Project, map: GameMap): Kit | undefined {
  const S = roomSpecOf(project.tilesets[map.tilesetId]);
  if (!S) return undefined;
  const band = new Set<number>();
  for (const list of Object.values(S.ceilings)) for (const t of list) band.add(t);
  for (const c of Object.values(S.ceilingCorners ?? {})) for (const t of Object.values(c)) band.add(t);
  // 이 맵이 쓴 천장 종류 — 띠 칸이 가장 많이 맞는 것.
  const lower = map.lowerTiles;
  let best = "default", hits = -1;
  for (const [name, list] of Object.entries(S.ceilings)) {
    const set = new Set([...list, ...Object.values(S.ceilingCorners?.[name] ?? {})]);
    let n = 0;
    for (const t of lower) if (set.has(t)) n++;
    if (n > hits) { hits = n; best = name; }
  }
  const faces = new Set<number>();
  for (const w of Object.values(S.walls)) for (const t of w.tiles) faces.add(t);
  return { S, band, ceil: S.ceilings[best] ?? [], ...(S.ceilingCorners?.[best] ? { corners: S.ceilingCorners[best] } : {}), faces };
}

/** 천장 띠·공허가 아닌 칸 = 방 안(바닥·벽면·모르는 칸). */
const innerOf = (k: Kit, map: GameMap) => (x: number, y: number) => {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const t = map.lowerTiles[y * map.width + x]!;
  return t !== k.S.void && t !== k.S.blank && !k.band.has(t);
};

/** region 안의 방 밖 칸을 천장 띠로 다시 칠한다(handInteriorStructure 의 top 칸 규칙, top = region). 바꾼 칸 수. */
function reband(k: Kit, map: GameMap, region: (x: number, y: number) => boolean): number {
  const inn = innerOf(k, map);
  const top = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && !inn(x, y) && region(x, y);
  const next: [number, number][] = [];
  for (let cy = 0; cy < map.height; cy++) for (let cx = 0; cx < map.width; cx++) {
    if (!top(cx, cy)) continue;
    const nv = cy === 0 ? 1 : (inn(cx, cy - 1) || top(cx, cy - 1) ? 0 : 1);
    const oS = inn(cx, cy + 1), oN = inn(cx, cy - 1), oW = inn(cx - 1, cy), oE = inn(cx + 1, cy);
    const b = (oS ? 1 : 0) | (oN ? 2 : 0) | (oW ? 4 : 0) | (oE ? 8 : 0) | (16 * nv);
    const d = (!oS && !oW && inn(cx - 1, cy + 1) ? 1 : 0) | (!oS && !oE && inn(cx + 1, cy + 1) ? 2 : 0)
      | (!oN && !oW && inn(cx - 1, cy - 1) ? 4 : 0) | (!oN && !oE && inn(cx + 1, cy - 1) ? 8 : 0);
    const tile = (d ? k.corners?.[`${b}:${d}`] : undefined) ?? k.ceil[b];
    if (tile !== undefined && tile !== map.lowerTiles[cy * map.width + cx]) next.push([cy * map.width + cx, tile]);
  }
  for (const [i, t] of next) map.lowerTiles[i] = t;
  return next.length;
}

/** 방들이 차지한 범위(+1칸) 안의 공허 칸을 천장 띠로. */
function fillVoid(k: Kit, map: GameMap): number {
  const inn = innerOf(k, map);
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (inn(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) return 0;
  const inBox = (x: number, y: number) => x >= x0 - 1 && x <= x1 + 1 && y >= y0 - 1 && y <= y1 + 1;
  let voids = 0;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (inBox(x, y) && map.lowerTiles[y * map.width + x] === k.S.void) voids++;
  if (!voids) return 0;
  reband(k, map, inBox);
  return voids;
}

/** 남쪽 바깥 줄의 방 칸(출구 목) — 위에 문 그림을 세워 막아 둔 틈도 센다(terra: 틈 속 잠긴 나무 문). */
function southGaps(k: Kit, map: GameMap): Cell[] {
  const y = map.height - 1;
  const inn = innerOf(k, map);
  const out: Cell[] = [];
  for (let x = 0; x < map.width; x++) if (inn(x, y)) out.push({ x, y });
  return out;
}

/** 칩셋의 «벽에 난 문» 그림: 바닥에 서는 문(위로 한 칸 솟음) 또는 벽면 두 줄 + 문턱 칸(door). 잠긴 방이면 잠긴 문을 먼저. */
function doorPiece(S: HandInteriorSpec, locked: boolean): { id: string; cells: readonly (readonly number[])[]; anchorDy: number } | undefined {
  const entries = Object.entries(S.objects);
  const pref = locked ? [/locked door/u, /door-steel|vault-door/u, /door-wood|classroom-door|door-open-western|fusuma/u, /door/u] : [/door-wood|classroom-door|door-open-western|fusuma/u, /locked door/u, /door/u];
  for (const re of pref) {
    for (const [id, d] of entries) {
      if (!re.test(id) || /side|train|elev|psd|gate|mat|round|toilet|security|ticket/u.test(id)) continue;
      const dys = d.cells.map((c) => c[1]!);
      if (d.kind === "door" && d.w === 1 && Math.min(...dys) === 0 && Math.max(...dys) === 2) return { id, cells: d.cells, anchorDy: -2 };
      if (d.kind === "floor" && d.w === 1 && Math.min(...dys) === -1 && Math.max(...dys) === 0) return { id, cells: d.cells, anchorDy: 0 };
    }
  }
  return undefined;
}

function free(map: GameMap, layer: Layer, i: number): boolean { return layerTileAt(map, layer as 1 | 2 | 3 | 4, i) < 0; }

/** 자리를 차지하지 않는 이벤트(그림 없고 페이지가 자동·병렬이거나 빈 것 — 시작 목표 같은 것). 문 칸을 막지 않는다. */
function silent(e: GameEvent): boolean {
  return (e.pages ?? []).length > 0 && (e.pages ?? []).every((p) => {
    const t = p.trigger as unknown; const kind = typeof t === "string" ? t : (t as { kind?: string } | undefined)?.kind;
    return (kind === "auto" || kind === "parallel" || !(p.commands ?? []).length) && !(p.graphic && !p.graphic.transparent && (p.graphic.sprite || p.graphic.appearanceId));
  });
}

/** 북쪽 벽 발치의 문 칸 후보 D: D 는 걷는 바닥, 위 두 칸은 벽면, 아래 칸은 걸어 닿는 빈 바닥.
 *  wallDecor 를 주면 벽면 두 칸에 걸린 걸이(창·액자 — D 바닥까지 내려오지 않는 그림)가 있는 칸도 후보로 내고, 걷어 낼 칸을 clear 에 담는다
 *  (2026-10-29 mt3 flash 밀실: 북벽 발치가 책장·벽난로·괘종시계와 둥근 창뿐이라 문 자리가 없었다 — 창 하나를 문으로 바꾼다). 깨끗한 칸이 먼저다. */
function northDoorCells(project: Project, map: GameMap, k: Kit, reach: Uint8Array, events: readonly GameEvent[], wallDecor?: (i: number) => number[] | undefined): (Cell & { clear?: number[] })[] {
  const w = map.width;
  // 옮길 수 있는 이벤트(movable — 그림 없는 조사 칸)는 events 에서 빼고 넘긴다: 그 칸도 후보가 되고, 문을 세운 뒤 닿는 칸으로 옮긴다.
  const taken = new Set(events.filter((e) => !silent(e)).map((e) => e.y * w + e.x));
  const clean: (Cell & { clear?: number[] })[] = [], decorated: (Cell & { clear?: number[] })[] = [];
  for (let y = 2; y < map.height - 1; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!isPassable(project, map, x, y) || !reach[i] || taken.has(i) || taken.has(i + w)) continue;
    if (!k.faces.has(map.lowerTiles[i - w]!) || !k.faces.has(map.lowerTiles[i - 2 * w]!)) continue;
    if (!isPassable(project, map, x, y + 1) || !reach[i + w]) continue;
    // 문 칸(바닥)에 그림(가구)이 있으면 쓰지 않는다.
    if (!free(map, 3, i) || !free(map, 2, i)) continue;
    if (free(map, 3, i - w) && free(map, 3, i - 2 * w)) { clean.push({ x, y }); continue; }
    // 벽면에만 걸린 걸이면 걷어 내고 쓴다.
    const clear = wallDecor ? [...new Set([...(free(map, 3, i - w) ? [] : wallDecor(i - w) ?? [-1]), ...(free(map, 3, i - 2 * w) ? [] : wallDecor(i - 2 * w) ?? [-1])])] : [-1];
    if (!clear.includes(-1)) decorated.push({ x, y, clear });
  }
  return [...clean, ...decorated];
}

/** 벽면 칸 i 에 걸린 걸이 그림 전체(같은 이름 조각이 벽면 위에서 이어진 칸들). 벽면 밖(바닥·천장)으로 이어지면 걸이가 아니다(서 있는 가구) — undefined. */
function wallDecorCells(map: GameMap, k: Kit, base: (t: number) => string, i: number): number[] | undefined {
  const w = map.width;
  const name = base(layerTileAt(map, 3, i));
  if (!name) return undefined;
  const seen = new Set<number>([i]);
  const queue = [i];
  for (let q = 0; q < queue.length; q += 1) {
    const c = queue[q]!, cx = c % w, cy = Math.floor(c / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cx + dx, y = cy + dy, n = y * w + x;
      if (x < 0 || y < 0 || x >= w || y >= map.height || seen.has(n)) continue;
      if (layerTileAt(map, 3, n) < 0 || base(layerTileAt(map, 3, n)) !== name) continue;
      if (!k.faces.has(map.lowerTiles[n]!)) return undefined;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen.size <= 6 ? [...seen] : undefined;
}

/**
 * 칸막이 방 사이 1칸 통로(북쪽 벽면 두 줄을 뚫은 틈)에 칩셋의 둥근 아치 문틀을 건다 — 벽면 사이 나무 바닥 한 줄이 «벽에 그린 무늬»로 읽혀
 * 판정자가 입구를 못 찾았다(2026-10-29 standin magic 서고 옆 연구실·memory 할머니 집 부엌). 기존 문틀 그림만 쓴다(새 그림 없음).
 * 틈 칸 (x,y)·(x,y+1) 이 걷는 바닥이고 양옆 네 칸이 벽면일 때. 여섯 칸 윗층이 비면 문틀(건 뒤 틈이 막히면 되돌림), 아니면 양쪽 입구 바닥에 발깔개.
 */
function archInnerDoorways(project: Project, map: GameMap, k: Kit): { arches: number; mats: number } {
  const arch = k.S.objects["round arch"];
  const mat = k.S.objects["doormat"];
  const w = map.width;
  const face = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < map.height && k.faces.has(map.lowerTiles[y * w + x]!);
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < map.height && !face(x, y) && isPassable(project, map, x, y);
  const open = (x: number, y: number) => floor(x, y) && free(map, 2, y * w + x) && free(map, 3, y * w + x);
  let arches = 0, mats = 0;
  /** 통로 입구 바닥에 발깔개(2칸, 밟는 납작 그림) — 통로 칸 x 를 덮는 자리. */
  const putMat = (x: number, y: number): boolean => {
    if (!mat || mat.w !== 2) return false;
    for (const left of [x, x - 1]) {
      if (!open(left, y) || !open(left + 1, y)) continue;
      for (const [dx, , tile, layer] of mat.cells) setLayerTileAt(map, (layer === 3 ? 3 : 2) as Layer, y * w + left + dx!, tile!);
      return true;
    }
    return false;
  };
  for (let y = 1; y < map.height - 2; y++) for (let x = 1; x < w - 1; x++) {
    if (!floor(x, y) || !floor(x, y + 1) || !floor(x, y + 2) || face(x, y - 1)) continue;
    if (!face(x - 1, y) || !face(x + 1, y) || !face(x - 1, y + 1) || !face(x + 1, y + 1)) continue;
    // ① 문틀이 들어가면 문틀.
    if (arch && arch.w === 3 && arch.cells.length === 6) {
      const cells = arch.cells.map(([dx, dy, tile]) => ({ i: (y + dy!) * w + x - 1 + dx!, tile: tile! }));
      if (cells.every((c) => free(map, 3, c.i))) {
        for (const c of cells) setLayerTileAt(map, 3, c.i, c.tile);
        const probe = { ...project, maps: { ...project.maps, [map.id]: map } } as Project;
        if (isPassable(probe, map, x, y) && isPassable(probe, map, x, y + 1)) { arches += 1; continue; }
        for (const c of cells) setLayerTileAt(map, 3, c.i, -1);
      }
    }
    // ② 벽 옆에 가구·걸이가 붙어 문틀이 안 들어가면(대부분 — 책장·괘종시계가 틈 바로 옆) 통로 양쪽 입구 바닥에 발깔개를 깐다.
    //    위쪽 입구: 틈 바로 위가 트인 칸이면 그 칸, 위쪽도 한 칸 목(천장 띠 틈)이면 그 위 칸.
    const upY = floor(x - 1, y - 1) || floor(x + 1, y - 1) ? y - 1 : y - 2;
    const placed = Number(putMat(x, y + 2)) + Number(floor(x, upY) ? putMat(x, upY) : false);
    if (placed) mats += 1;
  }
  return { arches, mats };
}

export interface ExitDressResult { readonly notes: string[] }

/**
 * 문 노릇 이벤트(이름이 문·출구, 이동 없음)가 하나이고 그 이벤트가 칩셋 문 그림 칸에 서 있는데, 이벤트 없는 같은 종류 문 그림이 또 있으면
 * 그 가짜 문(과 둘레 문틀)을 걷는다. 이벤트 그림이 옛 EasyRPG 칩(철창 등)이면 투명으로 — 칸의 문 그림이 보이게.
 * 왜(2026-10-29 vm2 deepseek 방탈출): 이벤트 「잠긴 나무 문」은 (3,3) 문 그림 위에 철창 칩으로 서 있고, 문틀 두른 같은 나무 문이 (5,3)에
 * 이벤트 없이 또 있었다. 목표 「북쪽 나무 문을 열고」를 보고 (5,3)을 조사한 판정자는 무반응이라 열쇠를 들고도 「문이 안 열린다」고 했다.
 */
function clearDecoyDoorArt(project: Project, map: GameMap, k: Kit): string[] {
  const w = map.width;
  const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const base = (t: number) => (t >= 0 ? String(meta[t]?.label ?? "").replace(/\s*\([^)]*\)\s*$/u, "").trim() : "");
  const doorish = (name: string) => /문|door/iu.test(name) && !/문틀|문패|문양|창문|문서|arch|frame/iu.test(name);
  const events = map.events ?? [];
  const doors = events.filter((e) => isDoorName(String((e as { name?: string }).name ?? "")) && !hasTransfer(e.pages ?? e.commands));
  if (doors.length !== 1) return [];
  const door = doors[0]!;
  const artName = base(layerTileAt(map, 3, door.y * w + door.x));
  if (!doorish(artName) || k.faces.has(map.lowerTiles[door.y * w + door.x]!)) return [];
  const notes: string[] = [];
  for (let i = 0; i < w * map.height; i += 1) {
    const x = i % w, y = Math.floor(i / w);
    if (i === door.y * w + door.x || base(layerTileAt(map, 3, i)) !== artName || k.faces.has(map.lowerTiles[i]!)) continue;
    if (events.some((e) => e.x === x && e.y === y)) continue;
    // 문 칸과 그 위로 이어진 같은 문 조각, 둘레(좌우 한 칸·위 세 칸)의 문틀을 걷는다.
    const cleared: number[] = [];
    for (let yy = y; yy >= Math.max(0, y - 2); yy -= 1) {
      const j = yy * w + x;
      if (base(layerTileAt(map, 3, j)) !== artName && base(layerTileAt(map, 4, j)) !== artName) break;
      for (const L of [3, 4] as const) if (base(layerTileAt(map, L, j)) === artName) { setLayerTileAt(map, L, j, -1); cleared.push(j); }
    }
    for (let yy = Math.max(0, y - 3); yy < y; yy += 1) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx += 1) {
      const j = yy * w + xx;
      for (const L of [3, 4] as const) if (/문틀|arch/iu.test(base(layerTileAt(map, L, j)))) { setLayerTileAt(map, L, j, -1); cleared.push(j); }
    }
    if (cleared.length) notes.push(`이벤트 없는 같은 문 그림 「${artName}」 (${x},${y})(문틀 포함 ${cleared.length}칸)을 걷음 — 진짜 문 「${String((door as { name?: string }).name ?? door.id)}」은 (${door.x},${door.y})`);
  }
  // 문 그림 위에 선 옛 EasyRPG 칩은 투명으로(칸의 문 그림이 보이게).
  const retro = (door.pages ?? []).some((p) => { const sprite = p.graphic?.sprite as { id?: string } | undefined; return typeof sprite?.id === "string" && sprite.id.startsWith("tex_easyrpg_"); });
  if (retro) {
    map.events = events.map((e) => e.id !== door.id ? e : { ...e, pages: (e.pages ?? []).map((p) => { const sprite = p.graphic?.sprite as { id?: string } | undefined; return typeof sprite?.id === "string" && sprite.id.startsWith("tex_easyrpg_") ? { ...p, graphic: { transparent: true } } : p; }) } as GameEvent);
    notes.push(`문 「${String((door as { name?: string }).name ?? door.id)}」의 옛 칩 그림을 걷고 칸의 문 그림을 보이게 함`);
  }
  return notes;
}

/** 맵 하나의 출구·공허 마감. 실내 방 짓기 칩셋(roomKit)이 아닌 맵은 건드리지 않는다. */
export function dressInteriorExits(run: BuildRun, mapId: string): ExitDressResult {
  const notes: string[] = [];
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  if (!map0) return { notes };
  const k = kitOf(project0, map0);
  if (!k) return { notes };
  const map = structuredClone(map0);
  let changed = false;
  // 2) 공허 칸.
  const voids = fillVoid(k, map);
  if (voids) { changed = true; notes.push(`빈 공허 칸 ${voids}개를 천장 띠로 이어 칠함`); }
  // 3) 칸막이 방 사이 통로 문틀.
  const doorways = archInnerDoorways(project0, map, k);
  if (doorways.arches || doorways.mats) { changed = true; notes.push(`칸막이 방 사이 통로 입구 표시: 둥근 아치 문틀 ${doorways.arches}곳 · 발깔개 ${doorways.mats}곳`); }
  // 4) 겹친 문 그림 — 문 이벤트가 선 문 그림 말고 이벤트 없는 같은 문 그림이 또 있으면 그쪽은 조사해도 무반응인 가짜 문이다.
  const decoys = clearDecoyDoorArt(project0, map, k);
  if (decoys.length) { changed = true; notes.push(...decoys); }
  // 1) 막다른 남쪽 출구.
  const w = map.width;
  const gaps = southGaps(k, map);
  const events = map.events ?? [];
  const exitEvents = events.filter((e) => hasTransfer(e.pages ?? e.commands));
  const landings = new Set<number>();
  for (const m of Object.values(project0.maps)) for (const e of m.events ?? []) {
    const visit = (n: unknown): void => { if (Array.isArray(n)) { n.forEach(visit); return; } if (!n || typeof n !== "object") return; const r = n as Record<string, unknown>; if (r.kind === "transfer" && r.mapId === mapId && typeof r.x === "number" && typeof r.y === "number") landings.add(r.y * w + r.x); for (const v of Object.values(r)) if (v && typeof v === "object") visit(v); };
    visit(e.pages ?? e.commands);
  }
  const usedGap = (g: Cell) => exitEvents.some((e) => Math.abs(e.x - g.x) + Math.abs(e.y - g.y) <= 1) || landings.has(g.y * w + g.x) || landings.has((g.y - 1) * w + g.x);
  const dead = gaps.length > 0 && !gaps.some(usedGap);
  // 문 노릇을 할 이벤트: 이름이 문인 것, 없으면 이 맵에서 엔딩을 부르는 그림 없는 장치(방탈출의 «비밀번호 입력» — 잠긴 문 그림 위로 옮기면 그 문이 자물쇠가 된다).
  const visible = (e: GameEvent) => (e.pages ?? []).some((p) => { const g = p.graphic; return Boolean(g && !g.transparent && (g.sprite || g.appearanceId)); });
  const endsGame = (e: GameEvent) => JSON.stringify(e.pages ?? []).includes('"triggerEnding"');
  // 엔딩 장치를 문으로 쓰는 것은 갇힌 방 게임(청사진이 방탈출·밀실류)이거나 이름이 자물쇠·번호 장치일 때만 — 아니면 그 장치는 문이 아니다
  // (2026-10-29 standin memory: 할머니 집 «장롱 편지»(엔딩을 부르는 투명 조사 칸)를 잠긴 문 그림 위로 옮겼다).
  const lockish = (e: GameEvent) => CODE_STEP_WORDS.test(String((e as { name?: string }).name ?? "")) || /자물쇠|잠금|lock/iu.test(String((e as { name?: string }).name ?? ""));
  const escapeGame = project0.gameBlueprint ? isEscapeBlueprint(project0.gameBlueprint) : false;
  const door = events.find((e) => isDoorName(String((e as { name?: string }).name ?? "")) && !hasTransfer(e.pages ?? e.commands))
    ?? events.find((e) => endsGame(e) && !visible(e) && !hasTransfer(e.pages ?? e.commands) && (escapeGame || lockish(e)));
  const tileLabel = (t: number) => String(((project0.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[])[t]?.label ?? "");
  const start = project0.startMapId === mapId ? project0.startPos : undefined;
  const closable = gaps.every((g) => !events.some((e) => e.x === g.x && e.y === g.y) && !(start && start.x === g.x && start.y === g.y));
  let movedStart: Cell | undefined;
  const withStart = (project: Project): Project => movedStart ? { ...project, startPos: movedStart } as Project : project;
  /** 막다른 남쪽 틈을 메운다: 틈 칸과 그 바로 위 칸에 걸친 그림(모델이 틈에 세운 문 등)을 걷고, 틈을 공허로 바꾼 뒤 둘레 띠를 다시 칠한다. */
  const closeGaps = () => {
    // 틈을 메운다: 틈 칸과 그 바로 위 칸에 걸친 그림(모델이 틈에 세운 문 등)을 걷고, 틈을 공허로 바꾼 뒤 둘레 띠를 다시 칠한다.
    for (const g of gaps) {
      const i = g.y * w + g.x, up = i - w;
      const below = layerTileAt(map0, 3, i);
      for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, i, -1);
      const base = (t: number) => tileLabel(t).replace(/\s*\([^)]*\)\s*$/u, "");
      if (below >= 0 && layerTileAt(map, 3, up) >= 0 && base(layerTileAt(map, 3, up)) === base(below)) setLayerTileAt(map, 3, up, -1);
      map.lowerTiles[i] = k.S.void;
    }
    reband(k, map, (x, y) => gaps.some((g) => Math.abs(g.x - x) <= 1 && Math.abs(g.y - y) <= 1));
    // 시작 칸이 틈 위였으면(2026-10-29 vm1 terra 방탈출: 문 자리를 찾아 틈을 메우자 시작 칸 (3,7)이 벽이 됐다) 틈에서 가장 가까운 걸을 수 있는 칸으로 옮긴다.
    if (start && gaps.some((g) => g.x === start.x && g.y === start.y)) {
      const probe = { ...project0, maps: { ...project0.maps, [mapId]: map } } as Project;
      const taken = new Set(events.map((e) => `${e.x},${e.y}`));
      let best: Cell | undefined;
      for (let y = 0; y < map.height; y += 1) for (let x = 0; x < w; x += 1) {
        if (taken.has(`${x},${y}`) || gaps.some((g) => g.x === x && g.y === y) || !isPassable(probe, map, x, y)) continue;
        const d = Math.abs(x - start.x) + Math.abs(y - start.y), bd = best ? Math.abs(best.x - start.x) + Math.abs(best.y - start.y) : Infinity;
        if (d < bd || (d === bd && best && (y < best.y || (y === best.y && x < best.x)))) best = { x, y };
      }
      if (best) { movedStart = best; notes.push(`시작 칸 (${start.x},${start.y})이 메운 틈 위라 (${best.x},${best.y})로 옮김`); }
    }
    changed = true;
    notes.push(`막다른 남쪽 출구 ${gaps.map((g) => `(${g.x},${g.y})`).join("")}를 벽으로 메움(이동 칸이 없는 틈)`);
  };
  /** 남쪽 벽에 출구 틈을 두고 문 이벤트를 거기로 옮긴다(방탈출, 북벽 문 자리가 없을 때). 성공하면 메모, 못 하면 undefined(맵은 그대로). */
  const southExitDoor = (door: GameEvent): string[] | undefined => {
    const work = structuredClone(map);
    const inn = innerOf(k, work);
    const y = work.height - 1;
    const occupied = (x: number, yy: number) => events.some((e) => e.id !== door.id && !silent(e) && e.x === x && e.y === yy);
    const probe0 = { ...project0, maps: { ...project0.maps, [mapId]: work } } as Project;
    const reach0 = reachableCells(probe0, work);
    // 틈 앞 칸: 걸어 닿는 바닥(밟는 깔개는 괜찮다), 자리를 차지한 이벤트 없음.
    const front = (x: number) => isPassable(probe0, work, x, y - 1) && !k.faces.has(work.lowerTiles[(y - 1) * w + x]!) && !occupied(x, y - 1) && !!reach0?.[(y - 1) * w + x];
    let g: Cell | undefined;
    let carved = false;
    if (gaps.length) {
      const mid = gaps[Math.floor(gaps.length / 2)]!;
      if (gaps.length === 1 && front(mid.x) && !occupied(mid.x, mid.y)) g = mid;
    } else {
      const cx = (w - 1) / 2;
      const xs = [...Array(w).keys()].filter((x) => x > 0 && x < w - 1 && !inn(x, y) && inn(x, y - 1) && !inn(x - 1, y) && !inn(x + 1, y) && front(x))
        .sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx) || a - b);
      for (const x of xs) {
        const trial = structuredClone(work);
        trial.lowerTiles[y * w + x] = trial.lowerTiles[(y - 1) * w + x]!;
        for (const L of [2, 3, 4] as const) setLayerTileAt(trial, L, y * w + x, -1);
        reband(k, trial, (xx, yy) => Math.abs(xx - x) <= 1 && Math.abs(yy - y) <= 1);
        const tp = { ...project0, maps: { ...project0.maps, [mapId]: trial } } as Project;
        if (!isPassable(tp, trial, x, y)) continue;
        for (const key of Object.keys(trial) as (keyof GameMap)[]) (work as unknown as Record<string, unknown>)[key] = trial[key];
        g = { x, y };
        carved = true;
        break;
      }
    }
    if (!g) return undefined;
    const gate = g;
    const out: string[] = [];
    // 발깔개(칩셋에 있으면) — 틈 앞 바닥 두 칸.
    const mat = k.S.objects["doormat"];
    if (mat && mat.w === 2) {
      for (const left of [gate.x, gate.x - 1]) {
        const ok = [left, left + 1].every((x) => x >= 0 && x < w && inn(x, gate.y - 1) && !k.faces.has(work.lowerTiles[(gate.y - 1) * w + x]!) && free(work, 2, (gate.y - 1) * w + x) && free(work, 3, (gate.y - 1) * w + x));
        if (!ok) continue;
        for (const [dx, , tile, layer] of mat.cells) setLayerTileAt(work, (layer === 3 ? 3 : 2) as Layer, (gate.y - 1) * w + left + dx!, tile!);
        out.push(`출구 앞 발깔개 (${left},${gate.y - 1})`);
        break;
      }
    }
    // 틈 칸의 조용한 이벤트(시작 목표)는 문이 있던 자리로, 시작 칸이 틈이면 틈 앞으로.
    const sitters = new Set(events.filter((e) => e.id !== door.id && silent(e) && e.x === gate.x && e.y === gate.y).map((e) => e.id));
    const moved = { ...work, events: work.events.map((e) => e.id === door.id ? { ...e, x: gate.x, y: gate.y } : sitters.has(e.id) ? { ...e, x: door.x, y: door.y } : e) } as GameMap;
    const newStart = start && start.x === gate.x && start.y === gate.y ? { x: gate.x, y: gate.y - 1 } : undefined;
    let next = { ...project0, maps: { ...project0.maps, [mapId]: moved } } as Project;
    if (newStart) next = { ...next, startPos: newStart } as Project;
    else if (movedStart) next = { ...next, startPos: movedStart } as Project;
    // 문을 옮겨도 다른 조사 칸에 여전히 닿아야 하고, 문에도 닿아야 한다.
    const was = new Set(unreachableEvents(project0, mapId));
    const now = unreachableEvents(next, mapId);
    if (now.some((id) => !was.has(id) || id === door.id)) return undefined;
    run.ctx.project = { ...run.ctx.project, ...(next.startPos !== project0.startPos ? { startPos: next.startPos } : {}), maps: { ...run.ctx.project.maps, [mapId]: moved } } as Project;
    out.unshift(`문 「${door.name ?? door.id}」 (${door.x},${door.y})→(${gate.x},${gate.y}) 남쪽 벽 ${carved ? "새로 튼 틈" : "틈"}을 출구로(북벽 발치는 가구로 참)`);
    if (newStart) out.push(`시작 칸 (${start!.x},${start!.y})→(${newStart.x},${newStart.y})`);
    return out;
  };
  // 방탈출의 출구가 안 보이면(그림 없는 «잠긴 출구» 조사 칸, 또는 벽이 아닌 바닥 가운데 선 문 그림) 남쪽 틈이 없어도 북벽 발치에 문을 세운다
  // (2026-10-29 VQA 트리아지 B: VM terra 「멈춘 시계의 방」 네 벽 어디에도 문이 없음, mt3 terra 잠긴 나무 문이 선반 아래 바닥에 서서 수납장처럼 읽힘).
  const onDoorArt = door ? (() => { const t = layerTileAt(map, 3, door.y * w + door.x); return t >= 0 && /문/u.test(tileLabel(t)) && door.y < map.height - 2; })() : false;
  const artAtWall = door ? onDoorArt && k.faces.has(map.lowerTiles[(door.y - 1) * w + door.x]!) : false;
  const doorShown = door ? (onDoorArt ? artAtWall : visible(door)) : false;
  if (door && (dead || (escapeGame && !doorShown))) {
    const S = k.S;
    const locked = (door.pages ?? []).some((p) => (p.conditions ?? []).length > 0) || (door.pages ?? []).length > 1;
    const piece = doorPiece(S, locked);
    const keepArt = onDoorArt && artAtWall;
    // 문 자리를 먼저 정한다.
    let at: (Cell & { clear?: number[]; relocate?: { from: number; to: number; tile: number; name: string } }) | undefined;
    let evicting = false;
    if (piece && !keepArt) {
      const probe = structuredClone(map);
      if (dead) for (const g of gaps) probe.lowerTiles[g.y * w + g.x] = S.void;
      const probeProject = { ...project0, maps: { ...project0.maps, [mapId]: probe } } as Project;
      const reach = reachableCells(probeProject, probe);
      const others = events.filter((e) => e.id !== door.id);
      // 그림 없는 조사 칸(청사진·퍼즐 고리의 반짝이 자리)은 옮길 수 있다 — 문 자리가 모자라면 비켜 세운다(mt3 flash 밀실: 북벽 발치 빈 두 칸 중
      // 한 칸에 «조사 시작»이 있어 남은 칸에 문을 세우면 그 칸이 막혔다).
      const movable = new Set(others.filter((e) => !silent(e) && !visible(e) && !hasTransfer(e.pages ?? e.commands)).map((e) => e.id));
      const base = (t: number) => (t >= 0 ? tileLabel(t).replace(/\s*\([^)]*\)\s*$/u, "") : "");
      const decor = (i: number) => wallDecorCells(probe, k, base, i);
      const near = (a: Cell, b: Cell) => (Math.abs(a.x - door.x) + Math.abs(a.y - door.y)) - (Math.abs(b.x - door.x) + Math.abs(b.y - door.y)) || a.y - b.y || a.x - b.x;
      const order = (list: (Cell & { clear?: number[] })[]) => list.sort((a, b) => Number(!!a.clear) - Number(!!b.clear) || near(a, b));
      const strict = reach ? order(northDoorCells(probeProject, probe, k, reach, others, decor)) : [];
      const probeFree = { ...probe, events: probe.events.filter((e) => !movable.has(e.id)) } as GameMap;
      const probeFreeProject = { ...probeProject, maps: { ...probeProject.maps, [mapId]: probeFree } } as Project;
      const reachFree = movable.size ? reachableCells(probeFreeProject, probeFree) : reach;
      const lenient = reachFree ? order(northDoorCells(probeFreeProject, probeFree, k, reachFree, others.filter((e) => !movable.has(e.id)), decor)) : [];
      // 문이 그 칸에 서도 다른 이벤트에 여전히 걸어 가 말을 걸 수 있어야 한다(2026-10-28 mt3: 문이 «조사 시작»으로 가는 유일한 칸을 막았다).
      // lenient: 옮길 수 있는 이벤트는 셈하지 않는다(문을 세운 뒤 닿는 칸으로 옮긴다).
      const before = new Set(unreachableEvents(probeProject, mapId));
      const keepsReach = (c: Cell, lenientMode: boolean, base0: GameMap = probe) => {
        const trial = { ...base0, events: base0.events.filter((e) => !(lenientMode && movable.has(e.id) && e.x === c.x && e.y === c.y)).map((e) => e.id === door.id ? { ...e, x: c.x, y: c.y } : e) } as GameMap;
        return unreachableEvents({ ...probeProject, maps: { ...probeProject.maps, [mapId]: trial } } as Project, mapId).every((id) => before.has(id) || id === door.id || (lenientMode && movable.has(id)));
      };
      const fits = (c: Cell & { clear?: number[] }, on: GameMap = map) => piece.cells.every(([dx, dy, , layer]) => { const i = (c.y + piece.anchorDy + dy!) * w + c.x + dx!; return i >= 0 && (free(on, (layer === 2 ? 2 : 3) as Layer, i) || !!c.clear?.includes(i)); });
      at = strict.find((c) => fits(c) && keepsReach(c, false));
      if (!at) { at = lenient.find((c) => fits(c) && keepsReach(c, true)); if (at) evicting = true; }
      // 방탈출 출구가 안 보이는데 북벽 발치가 모두 차 있으면: 발치의 한 칸짜리 소품(1×1 책상·상자 — 같은 이름 이웃 없음, 이벤트 없음) 하나를
      // 출구가 있던 칸으로 옮기고 그 자리에 문을 세운다(2026-10-29 mt3 terra 잠긴 방: 발치 다섯 칸이 책장·책상·두루마리 선반이었다). 큰 가구는 옮기지 않는다.
      if (!at && escapeGame && !dead) {
        const to = door.y * w + door.x;
        const strayArt = onDoorArt && !artAtWall;
        const stripArt = (m: GameMap) => {
          const name = base(layerTileAt(m, 3, to));
          for (let y = door.y; y >= Math.max(0, door.y - 2); y--) { const t = layerTileAt(m, 3, y * w + door.x); if (t < 0 || base(t) !== name) break; setLayerTileAt(m, 3, y * w + door.x, -1); }
        };
        if ((free(map, 3, to) || strayArt) && free(map, 2, to)) {
          for (let y = 2; y < map.height - 1 && !at; y++) for (let x = 0; x < w && !at; x++) {
            const i = y * w + x;
            if (!k.faces.has(map.lowerTiles[i - w]!) || !k.faces.has(map.lowerTiles[i - 2 * w]!) || !free(map, 2, i)) continue;
            const t = layerTileAt(map, 3, i);
            const name = base(t);
            if (t < 0 || !name || events.some((e) => e.x === x && e.y === y)) continue;
            const lone = !([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < map.height && base(layerTileAt(map, 3, ny * w + nx)) === name; });
            if (!lone || !free(map, 3, i - w) || !free(map, 3, i - 2 * w)) continue;
            const p2 = structuredClone(probe);
            if (strayArt) stripArt(p2);
            setLayerTileAt(p2, 3, i, -1);
            setLayerTileAt(p2, 3, to, t);
            const p2Project = { ...probeProject, maps: { ...probeProject.maps, [mapId]: p2 } } as Project;
            const reach2 = reachableCells(p2Project, p2);
            const cell = reach2 ? northDoorCells(p2Project, p2, k, reach2, others).find((c) => c.x === x && c.y === y && !c.clear) : undefined;
            if (cell && fits(cell, p2) && keepsReach(cell, false, p2)) { at = { ...cell, relocate: { from: i, to, tile: t, name } }; }
          }
        }
      }
    }
    // 문 자리가 없어도, 아무 데로도 이어지지 않는 틈 위에 아무것도(이벤트·시작 칸) 없으면 벽으로 메운다 — 어둠으로 뻗은 막다른 통로보다 닫힌 벽이 낫다
    // (2026-10-28 mt3 flash: 빈 시작 맵을 치운 뒤 밀실 남쪽 틈이 막다른 길이 됐고, 북벽 발치는 가구와 «조사 시작»으로 가는 길뿐이었다).
    // 북벽 발치에 문을 못 세운 방탈출(가구로 꽉 찬 북벽): 출구를 남쪽 벽 틈으로 낸다 — 남쪽 틈이 있으면 그 틈, 없으면 바닥과 맞닿은
    // 남쪽 띠 한 칸을 바닥으로 튼다. 문 이벤트를 틈 칸에 두고(그 앞에서 아래를 보고 조사), 칩셋에 발깔개가 있으면 틈 앞 바닥에 깐다.
    // 왜(2026-10-29 vm2 판정): terra 「멈춘 시계의 방」은 잠긴 출구가 그림 없는 서쪽 구석 칸이고 남쪽 틈은 시작 칸이라, 판정자가
    // 「출구처럼 보이는 아래 통로가 무반응·출구 위치가 어디에도 없다」고 했다. flash 「잠긴 방」은 문이 방 한가운데 보이지 않는 칸이었다.
    if (!at && !keepArt && escapeGame && !visible(door) && door.y !== map.height - 1) {
      const south = southExitDoor(door);
      if (south) return { notes: [...notes, ...south] };
    }
    if (!at && !keepArt) notes.push(!piece ? "이 칩셋에 벽에 세울 문 그림이 없다" : `문 「${door.name ?? door.id}」: 북벽 발치에 문 그림을 세울 자리가 없다(가구·다른 이벤트로 가는 길)`);
    if (dead && !at && !keepArt && !closable) notes.push("남쪽 틈 위에 이벤트·시작 칸이 있어 틈은 그대로 둠");
    if (dead && (at || keepArt || closable)) closeGaps();
    if (at && piece) {
      const mapBeforeDoor = structuredClone(map);
      // 벽이 아닌 자리에 선 옛 문 그림(바닥 가운데 «잠긴 나무 문»)은 걷는다 — 문이 둘로 보이지 않게.
      if (onDoorArt && !artAtWall) {
        const base = (t: number) => tileLabel(t).replace(/\s*\([^)]*\)\s*$/u, "");
        const name = base(layerTileAt(map, 3, door.y * w + door.x));
        for (let y = door.y; y >= Math.max(0, door.y - 2); y--) {
          const t = layerTileAt(map, 3, y * w + door.x);
          if (t < 0 || base(t) !== name) break;
          setLayerTileAt(map, 3, y * w + door.x, -1);
        }
        notes.push(`벽이 아닌 바닥에 서 있던 문 그림 「${name}」 (${door.x},${door.y})을 걷음`);
      }
      if (at.relocate) {
        setLayerTileAt(map, 3, at.relocate.from, -1);
        setLayerTileAt(map, 3, at.relocate.to, at.relocate.tile);
        notes.push(`북벽 발치의 한 칸 소품 「${at.relocate.name}」을 출구가 있던 칸 (${door.x},${door.y})으로 옮기고 그 자리에 문을 세움`);
      }
      // 걸이(창·액자)를 걷어 낸 자리에 문을 세운다.
      const cleared = at.clear ?? [];
      const clearedName = cleared.length ? tileLabel(layerTileAt(map, 3, cleared[0]!)).replace(/\s*\([^)]*\)\s*$/u, "") : "";
      for (const i of cleared) setLayerTileAt(map, 3, i, -1);
      if (cleared.length) notes.push(`북벽 발치가 가구로 차서 벽 걸이 「${clearedName}」 ${cleared.length}칸을 걷고 그 자리에 문을 세움`);
      for (const [dx, dy, tile, layer] of piece.cells) setLayerTileAt(map, (layer === 2 ? 2 : 3) as Layer, (at.y + piece.anchorDy + dy!) * w + at.x + dx!, tile!);
      // 손 도트 실내의 바닥에 선 문은 벽면에 아치 문틀을 같이 건다(뒷문과 같은 모양 — 문만이면 «바닥에 선 벽장»으로 읽혔다).
      const arch = piece.anchorDy === 0 ? S.objects["round arch"] : undefined;
      if (arch && arch.w === 3) {
        const ok = arch.cells.every(([dx, dy]) => { const x = at!.x - 1 + dx!, y = at!.y - 2 + dy!; return x >= 0 && x < w && k.faces.has(map.lowerTiles[y * w + x]!) && (x === at!.x && y === at!.y - 1 ? true : free(map, 3, y * w + x)); });
        if (ok) for (const [dx, dy, tile] of arch.cells) {
          const x = at.x - 1 + dx!, y = at.y - 2 + dy!, i = y * w + x;
          if (x === at.x && y === at.y - 1) { const doorTop = layerTileAt(map, 3, i); setLayerTileAt(map, 3, i, tile!); setLayerTileAt(map, 4, i, doorTop); }
          else setLayerTileAt(map, 3, i, tile!);
        }
      }
      run.ctx.project = withStart({ ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: map } } as Project);
      // 그 칸에 있던 조용한 이벤트(시작 목표 등)는 문이 있던 자리로 비켜 둔다(먼저 비키고, 문이 옮긴 뒤 그 자리로 — move_event 는 찬 칸이면 옆 칸으로 민다).
      const sitters = events.filter((e) => e.id !== door.id && e.x === at!.x && e.y === at!.y && (silent(e) || (evicting && !visible(e) && !hasTransfer(e.pages ?? e.commands))));
      // 문과 그 칸의 이벤트를 자리 바꿈한다(한 번에 — move_event 로 차례로 옮기면 찬 칸에서 옆 칸으로 밀려 문이 가구 칸에 섰다).
      const sitterIds = new Set(sitters.map((e) => e.id));
      const placed = run.ctx.project.maps[mapId]!;
      const swapped = { ...placed, events: placed.events.map((e) => e.id === door.id ? { ...e, x: at!.x, y: at!.y } : sitterIds.has(e.id) ? { ...e, x: door.x, y: door.y } : e) } as GameMap;
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: swapped } } as Project;
      notes.push(`문 「${door.name ?? door.id}」 (${door.x},${door.y})→(${at.x},${at.y}) 북벽 발치에 ${piece.id} 그림`);
      if (evicting) {
        // 문 때문에 닿지 않게 된 조사 칸을 닿는 칸으로 옮긴다(eventReach 정본 규칙).
        const was = new Set(unreachableEvents(project0, mapId));
        const cut = unreachableEvents(run.ctx.project, mapId).filter((id) => !was.has(id) && id !== door.id);
        if (cut.length) {
          const fixed = repairEventReach(run, mapId, cut);
          if (fixed.moved.length) notes.push(`문 자리 때문에 막힌 조사 칸을 옮김: ${fixed.moved.join(", ")}`);
          // 옮길 곳이 없으면 문을 세우지 않는다 — 조사 칸에 못 가면 게임이 끝나지 않는다(2026-10-29 mt3 argon 6×7 서재 재생: 문이 «책장»으로 가는
          // 유일한 칸 (2,3)에 서고, 옮길 빈 칸이 없어 자동 플레이가 막혔다). 틈 메우기는 남긴다.
          if (fixed.stuck.length) {
            run.ctx.project = { ...project0, maps: { ...project0.maps, [mapId]: dead && !keepArt && !closable ? map0 : mapBeforeDoor } } as Project;
            const kept = notes.filter((note) => !/^문 「|^문 자리 때문에|^벽이 아닌 바닥에|^북벽 발치/u.test(note) && !(dead && !keepArt && !closable && /^막다른 남쪽/u.test(note)));
            notes.length = 0;
            notes.push(...kept);
            notes.push(`문 「${door.name ?? door.id}」: 북벽 발치 (${at.x},${at.y})에 세우면 조사 칸(${fixed.stuck.join(", ")})으로 가는 길이 막혀 문을 세우지 않음`);
          }
        }
      }
      return { notes };
    }
  }
  // 문 노릇 이벤트가 없어도 아무 데로도 이어지지 않는 틈은 메운다(2026-10-29 standin memory 할머니 집: 엔딩 장치를 문으로 쓰지 않게 하자
  // 남쪽 틈이 어둠으로 뻗은 막다른 통로로 남았다).
  // 틈은 벽에 난 좁은 목(3칸 이하, 붙어 있음)만 — 남쪽 줄 전체가 바닥인 바깥 거리(standin errand «동네 거리»)는 틈이 아니다.
  const narrow = gaps.length > 0 && gaps.length <= 3 && gaps.every((g, i) => i === 0 || g.x === gaps[i - 1]!.x + 1);
  if (dead && !door && closable && narrow) closeGaps();
  if (changed) run.ctx.project = withStart({ ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: map } } as Project);
  return { notes };
}

// ── 바닥 한가운데 이동 칸 → 벽에 난 문 ─────────────────────────────────────────
// 2026-10-29 vm3 deepseek 탈출 판정(major): 「방 이동은 바닥의 희미한 빛 위를 걷는 방식이라 출입구인지 알기 어렵다」 — 현관 홀 남쪽 바닥
// (17,8)(20,8)(23,8)에 응접실·서재·지하실로 가는 투명 접촉 칸이 카펫·의자 옆에 나란히 있었다(벽·문 그림 없음).
// 규칙(실내 방 짓기 칩셋 맵만): 다른 맵으로 가는 투명 접촉 이동 칸이 문 그림·남쪽 틈 위가 아니면, 가장 가까운 외벽에 문을 낸다.
//  - 북쪽 벽: 벽 발치 칸 D(위 두 칸이 벽면)에 칩셋 문 그림(+아치 문틀)을 세우고 이동 칸을 문 앞(D 아래)으로 — 뒷문(builders/interior.addBackDoor)과 같은 모양.
//  - 남쪽 벽: 바닥과 맞닿은 남쪽 띠 한 칸을 틈으로 터서 이동 칸을 틈에 두고, 칩셋에 발깔개가 있으면 틈 앞에 깐다 — 방 짓기의 남쪽 출구와 같은 모양.
//  - 층을 오가는 이동(지하실·2층…)이고 맵에 쓰지 않은 계단 그림이 있으면 그 계단 칸으로(8칸 안). 문·틈은 4칸 안의 벽만 — 멀면 그대로 둔다.
//  - 같은 벽의 문·틈끼리는 한 칸 이상 띄운다. 도착 맵에서 이 맵으로 돌아오는 이동은 새 문 앞 칸으로 맞춘다(짝).
//  - 옮긴 뒤 못 닿는 이벤트가 늘거나 새 이동 칸·착지 칸에 못 닿으면 그 맵을 되돌린다.
// 새 그림은 그리지 않는다(칩셋의 문·문틀·발깔개 조각만).

function transferCmds(ev: GameEvent): { page: number; idx: number; cmd: Record<string, unknown> }[] {
  const out: { page: number; idx: number; cmd: Record<string, unknown> }[] = [];
  (ev.pages ?? []).forEach((p, pi) => (p.commands ?? []).forEach((c, ci) => { const r = c as unknown as Record<string, unknown>; if (r.kind === "transfer") out.push({ page: pi, idx: ci, cmd: r }); }));
  return out;
}

const touchTrigger = (ev: GameEvent) => (ev.pages ?? []).every((p) => { const t = p.trigger as unknown; const kind = typeof t === "string" ? t : (t as { kind?: string } | undefined)?.kind; return kind === "playerTouch" || kind === "touch"; });
const transparentEvent = (ev: GameEvent) => (ev.pages ?? []).every((p) => { const g = p.graphic; return !g || g.transparent === true || (!g.sprite && !g.appearanceId); });

/**
 * 들어설 수 없는 칸(가구·벽 밑)에 묻힌 접촉 이동 — 네 곁 어디서도 걸어 들어갈 수 없고 부딪혀 발동하지도 않는(우선순위 same 아님) 다른 맵 이동 칸.
 * 같은 맵에 같은 목적지로 가는, 걸어 들어갈 수 있는 이동 칸이 따로 있으면 묻힌 칸을 지운다(남은 문이 그 길을 맡는다).
 * 왜(2026-10-29 vm4 argon 추리): 「2층 객실」 (4,3) 서랍장 밑의 「→ 여관 홀」 이동을 자동 플레이가 골라 (4,4)→(4,3) 이동 불가로 멈췄다 — 남쪽 틈 (5,8)이 같은 홀로 갔다.
 */
export function dropBuriedTransfers(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const map = run.ctx.project.maps[mapId];
  if (!map) return notes;
  const project = run.ctx.project;
  const destOf = (e: GameEvent) => transferCmds(e).map((t) => t.cmd.mapId).find((m): m is string => typeof m === "string" && m !== mapId);
  const sameLayer = (e: GameEvent) => (e.pages ?? []).some((p) => (p.priority ?? "same") === "same");
  const enterable = (e: GameEvent) => sameLayer(e) || [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
    const x = e.x + dx!, y = e.y + dy!;
    return x >= 0 && y >= 0 && x < map.width && y < map.height && canMove(project, map, x, y, e.x, e.y);
  });
  const gates = (map.events ?? []).filter((e) => touchTrigger(e) && destOf(e));
  for (const ev of gates) {
    if (enterable(ev)) continue;
    const dest = destOf(ev)!;
    const twin = gates.find((o) => o.id !== ev.id && destOf(o) === dest && enterable(o));
    if (!twin) continue;
    const r = run.call("remove_event", { mapId, eventId: ev.id });
    if (r.ok) notes.push(`들어설 수 없는 칸 (${ev.x},${ev.y})의 → ${project.maps[dest]?.name ?? dest} 이동을 지움(같은 곳으로 가는 (${twin.x},${twin.y}) 가 맡음)`);
  }
  return notes;
}

export function doorFloorTransfers(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const first = run.ctx.project.maps[mapId];
  if (!first) return notes;
  const ids = (first.events ?? []).filter((e) => touchTrigger(e) && transparentEvent(e) && transferCmds(e).some((t) => typeof t.cmd.mapId === "string" && t.cmd.mapId !== mapId)).map((e) => e.id);
  for (const id of ids) {
    const project0 = run.ctx.project;
    const map0 = project0.maps[mapId]!;
    const k = kitOf(project0, map0);
    if (!k) return notes;
    const ev = map0.events.find((e) => e.id === id);
    if (!ev) continue;
    const w = map0.width, H = map0.height;
    const meta = (project0.tilesets[map0.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
    const label = (t: number) => (t >= 0 ? String(meta[t]?.label ?? "") : "");
    const doorArtAt = (m: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < w && y < H && [3, 4].some((L) => /문|door|arch/iu.test(label(layerTileAt(m, L as Layer, y * w + x))) && !/창문|문양|문서|window/iu.test(label(layerTileAt(m, L as Layer, y * w + x))));
    const inn = innerOf(k, map0);
    // 이미 문 그림 위·옆이거나 남쪽 틈(방 짓기 출구)이면 그대로.
    if (ev.y === H - 1 && inn(ev.x, ev.y)) continue;
    if ([[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => doorArtAt(map0, ev.x + dx!, ev.y + dy!))) continue;
    // 맵 가장자리 이동(바깥 거리 끝)은 문이 아니다.
    if (ev.x === 0 || ev.y === 0 || ev.x === w - 1) continue;
    const target = transferCmds(ev).find((t) => typeof t.cmd.mapId === "string" && t.cmd.mapId !== mapId)!;
    const destId = String(target.cmd.mapId);
    // 같은 벽에서 한 칸 띄우기: 이미 있는 문 그림 열·남쪽 틈 열·다른 이동 칸.
    const otherGates = map0.events.filter((e) => e.id !== id && transferCmds(e).length);
    const tooClose = (x: number, y: number) => otherGates.some((e) => e.y === y && Math.abs(e.x - x) <= 1) || [-1, 0, 1].some((dx) => doorArtAt(map0, x + dx, y) || doorArtAt(map0, x + dx, y - 1));
    const reach = reachableCells(project0, map0);
    if (!reach) continue;
    const others = map0.events.filter((e) => e.id !== id);
    type Plan = { kind: "north" | "south" | "stairs"; gate: Cell; landing: Cell; dir: "up" | "down"; apply: (m: GameMap) => boolean; d: number };
    const plans: Plan[] = [];
    // 북쪽 벽 문.
    const piece = doorPiece(k.S, false);
    if (piece) {
      for (const D of northDoorCells(project0, map0, k, reach, others)) {
        if (D.clear) continue;
        const gate = { x: D.x, y: D.y + 1 }, landing = { x: D.x, y: D.y + 2 };
        if (landing.y >= H || !isPassable(project0, map0, landing.x, landing.y) || !reach[landing.y * w + landing.x]) continue;
        if (others.some((e) => (e.x === gate.x && e.y === gate.y) || (e.x === landing.x && e.y === landing.y))) continue;
        if (tooClose(D.x, D.y)) continue;
        const fits = piece.cells.every(([dx, dy, , layer]) => { const i = (D.y + piece.anchorDy + dy!) * w + D.x + dx!; return i >= 0 && free(map0, (layer === 2 ? 2 : 3) as Layer, i); });
        if (!fits) continue;
        plans.push({ kind: "north", gate, landing, dir: "down", d: Math.abs(gate.x - ev.x) + Math.abs(gate.y - ev.y), apply: (m) => {
          for (const [dx, dy, tile, layer] of piece.cells) setLayerTileAt(m, (layer === 2 ? 2 : 3) as Layer, (D.y + piece.anchorDy + dy!) * w + D.x + dx!, tile!);
          const arch = piece.anchorDy === 0 ? k.S.objects["round arch"] : undefined;
          if (arch && arch.w === 3 && arch.cells.every(([dx, dy]) => { const x = D.x - 1 + dx!, y = D.y - 2 + dy!; return x >= 0 && x < w && y >= 0 && k.faces.has(m.lowerTiles[y * w + x]!) && (x === D.x && y === D.y - 1 ? true : free(m, 3, y * w + x)); })) {
            for (const [dx, dy, tile] of arch.cells) {
              const x = D.x - 1 + dx!, y = D.y - 2 + dy!, i = y * w + x;
              if (x === D.x && y === D.y - 1) { const top = layerTileAt(m, 3, i); setLayerTileAt(m, 3, i, tile!); setLayerTileAt(m, 4, i, top); } else setLayerTileAt(m, 3, i, tile!);
            }
          }
          return true;
        } });
      }
    }
    // 남쪽 벽 틈.
    {
      const y = H - 1;
      for (let x = 1; x < w - 1; x++) {
        if (inn(x, y) || !inn(x, y - 1) || inn(x - 1, y) || inn(x + 1, y)) continue;
        if (!isPassable(project0, map0, x, y - 1) || k.faces.has(map0.lowerTiles[(y - 1) * w + x]!) || !reach[(y - 1) * w + x]) continue;
        if (others.some((e) => e.x === x && (e.y === y - 1 || e.y === y))) continue;
        if (otherGates.some((e) => e.y >= y - 1 && Math.abs(e.x - x) <= 1)) continue;
        plans.push({ kind: "south", gate: { x, y }, landing: { x, y: y - 1 }, dir: "up", d: Math.abs(x - ev.x) + Math.abs(y - ev.y), apply: (m) => {
          m.lowerTiles[y * w + x] = m.lowerTiles[(y - 1) * w + x]!;
          for (const L of [2, 3, 4] as const) setLayerTileAt(m, L, y * w + x, -1);
          reband(k, m, (xx, yy) => Math.abs(xx - x) <= 1 && Math.abs(yy - y) <= 1);
          const mat = k.S.objects["doormat"];
          if (mat && mat.w === 2) for (const left of [x, x - 1]) {
            const ok = [left, left + 1].every((xx) => xx >= 0 && xx < w && innerOf(k, m)(xx, y - 1) && !k.faces.has(m.lowerTiles[(y - 1) * w + xx]!) && free(m, 2, (y - 1) * w + xx) && free(m, 3, (y - 1) * w + xx));
            if (!ok) continue;
            for (const [dx, , tile, layer] of mat.cells) setLayerTileAt(m, (layer === 3 ? 3 : 2) as Layer, (y - 1) * w + left + dx!, tile!);
            break;
          }
          return true;
        } });
      }
    }
    // 층을 오가는 이동(지하실·2층·다락…)이고 맵에 쓰이지 않은 계단 그림이 있으면 그 계단이 먼저다(현관 홀의 「가는 계단통」 → 지하실).
    const FLOOR_WORDS = /지하|층|다락|계단|basement|cellar|attic|upstairs|downstairs|floor/iu;
    if (FLOOR_WORDS.test(String(project0.maps[destId]?.name ?? "")) || FLOOR_WORDS.test(String(map0.name ?? ""))) {
      const stairCell = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < H && [3, 4].some((L) => /계단|stair/iu.test(label(layerTileAt(map0, L as Layer, y * w + x))) && !/난간|rail/iu.test(label(layerTileAt(map0, L as Layer, y * w + x))));
      const seen = new Set<number>();
      for (let i = 0; i < w * H; i++) {
        if (seen.has(i) || !stairCell(i % w, Math.floor(i / w))) continue;
        const cluster: number[] = [];
        const q = [i]; seen.add(i);
        for (let n = 0; n < q.length; n++) { const c = q[n]!; cluster.push(c); const cx = c % w, cy = Math.floor(c / w); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, ny = cy + dy, j = ny * w + nx; if (!seen.has(j) && stairCell(nx, ny)) { seen.add(j); q.push(j); } } }
        const xs = cluster.map((c) => c % w), ys = cluster.map((c) => Math.floor(c / w));
        const bottom = Math.max(...ys), cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
        if (otherGates.some((e) => cluster.includes(e.y * w + e.x) || (e.x >= Math.min(...xs) && e.x <= Math.max(...xs) && e.y === bottom + 1))) continue;
        const onStair = isPassable(project0, map0, cx, bottom) && !!reach[bottom * w + cx];
        const gate = onStair ? { x: cx, y: bottom } : { x: cx, y: bottom + 1 }, landing = { x: cx, y: gate.y + 1 };
        if (landing.y >= H || others.some((e) => (e.x === gate.x && e.y === gate.y) || (e.x === landing.x && e.y === landing.y))) continue;
        plans.push({ kind: "stairs", gate, landing, dir: "down", d: -1, apply: () => true });
      }
    }
    // 멀리 옮기지 않는다 — 방 반대편 벽으로 끌고 가면 원래 동선(대사·목표 «남동쪽 → …»)과 어긋난다. 가까운 벽이 없으면 그대로 두고 런타임 목적지 글자에 맡긴다.
    const far = (p: Plan) => Math.abs(p.gate.x - ev.x) + Math.abs(p.gate.y - ev.y) > (p.kind === "stairs" ? 8 : 4);
    for (let i = plans.length - 1; i >= 0; i--) if (far(plans[i]!)) plans.splice(i, 1);
    plans.sort((a, b) => a.d - b.d || (a.kind === "south" ? 1 : 0) - (b.kind === "south" ? 1 : 0));
    const before = new Set(unreachableEvents(project0, mapId));
    let done = false;
    for (const plan of plans.slice(0, 12)) {
      const m = structuredClone(map0);
      if (!plan.apply(m)) continue;
      m.events = m.events.map((e) => e.id === id ? { ...e, x: plan.gate.x, y: plan.gate.y } : e);
      let next = { ...project0, maps: { ...project0.maps, [mapId]: m } } as Project;
      if (!isPassable(next, m, plan.gate.x, plan.gate.y) || !isPassable(next, m, plan.landing.x, plan.landing.y)) continue;
      const r2 = reachableCells(next, m);
      if (!r2?.[plan.landing.y * w + plan.landing.x]) continue;
      if (unreachableEvents(next, mapId).some((u) => !before.has(u))) continue;
      // 짝: 도착 맵에서 이 맵으로 돌아오는 이동(옛 이동 칸 둘레 2칸 안에 내리던 것)을 새 문 앞으로.
      const dest = next.maps[destId];
      const paired: string[] = [];
      if (dest) {
        const destEvents = dest.events.map((de) => {
          let touched = false;
          const pages = (de.pages ?? []).map((p) => ({ ...p, commands: (p.commands ?? []).map((c) => {
            const r = c as unknown as Record<string, unknown>;
            if (r.kind !== "transfer" || r.mapId !== mapId || typeof r.x !== "number" || typeof r.y !== "number") return c;
            if (Math.abs(r.x - ev.x) + Math.abs(r.y - ev.y) > 2) return c;
            touched = true;
            return { ...r, x: plan.landing.x, y: plan.landing.y, direction: plan.dir } as unknown as typeof c;
          }) }));
          if (touched) paired.push(`${dest.name ?? destId} (${de.x},${de.y})`);
          return touched ? { ...de, pages } as GameEvent : de;
        });
        next = { ...next, maps: { ...next.maps, [destId]: { ...dest, events: destEvents } } } as Project;
      }
      // 이 이동이 내려 주는 칸은 그대로(도착 맵 쪽 문은 그 맵 규칙이 맡는다).
      run.ctx.project = next;
      notes.push(`이동 칸 「→ ${project0.maps[destId]?.name ?? destId}」 (${ev.x},${ev.y})→(${plan.gate.x},${plan.gate.y}) ${plan.kind === "north" ? `북쪽 벽 발치 (${plan.gate.x},${plan.gate.y - 1})에 ${piece?.id} 문` : plan.kind === "stairs" ? "계단 그림 아래" : "남쪽 벽에 틈"}${paired.length ? ` · 되돌아오는 이동 ${paired.join(", ")} 착지 → (${plan.landing.x},${plan.landing.y})` : ""}`);
      done = true;
      break;
    }
    if (!done && plans.length) notes.push(`이동 칸 (${ev.x},${ev.y}): 문을 낼 벽 자리가 길을 막아 그대로 둠`);
  }
  return notes;
}
