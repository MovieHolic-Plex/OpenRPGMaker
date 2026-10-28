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
import { isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isDoorName, reachableCells, unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";

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

/** 북쪽 벽 발치의 문 칸 후보 D: D 는 걷는 바닥, 위 두 칸은 벽면, 아래 칸은 걸어 닿는 빈 바닥. */
function northDoorCells(project: Project, map: GameMap, k: Kit, reach: Uint8Array, events: readonly GameEvent[]): Cell[] {
  const w = map.width;
  const taken = new Set(events.filter((e) => !silent(e)).map((e) => e.y * w + e.x));
  const out: Cell[] = [];
  for (let y = 2; y < map.height - 1; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!isPassable(project, map, x, y) || !reach[i] || taken.has(i) || taken.has(i + w)) continue;
    if (!k.faces.has(map.lowerTiles[i - w]!) || !k.faces.has(map.lowerTiles[i - 2 * w]!)) continue;
    if (!isPassable(project, map, x, y + 1) || !reach[i + w]) continue;
    // 그 칸·벽면에 이미 그림(가구·걸이)이 있으면 쓰지 않는다.
    if (!free(map, 3, i) || !free(map, 3, i - w) || !free(map, 3, i - 2 * w) || !free(map, 2, i)) continue;
    out.push({ x, y });
  }
  return out;
}

export interface ExitDressResult { readonly notes: string[] }

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
  const door = events.find((e) => isDoorName(String((e as { name?: string }).name ?? "")) && !hasTransfer(e.pages ?? e.commands))
    ?? events.find((e) => endsGame(e) && !visible(e) && !hasTransfer(e.pages ?? e.commands));
  if (dead && door) {
    const S = k.S;
    const locked = (door.pages ?? []).some((p) => (p.conditions ?? []).length > 0) || (door.pages ?? []).length > 1;
    const piece = doorPiece(S, locked);
    const tileLabel = (t: number) => String(((project0.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[])[t]?.label ?? "");
    const onDoorArt = (() => { const t = layerTileAt(map, 3, door.y * w + door.x); return t >= 0 && /문/u.test(tileLabel(t)) && door.y < map.height - 2; })();
    // 문 자리를 먼저 정한다.
    let at: Cell | undefined;
    if (piece && !onDoorArt) {
      const probe = structuredClone(map);
      for (const g of gaps) probe.lowerTiles[g.y * w + g.x] = S.void;
      const probeProject = { ...project0, maps: { ...project0.maps, [mapId]: probe } } as Project;
      const reach = reachableCells(probeProject, probe);
      const others = events.filter((e) => e.id !== door.id);
      const cands = reach ? northDoorCells(probeProject, probe, k, reach, others) : [];
      cands.sort((a, b) => (Math.abs(a.x - door.x) + Math.abs(a.y - door.y)) - (Math.abs(b.x - door.x) + Math.abs(b.y - door.y)) || a.y - b.y || a.x - b.x);
      // 문이 그 칸에 서도 다른 이벤트에 여전히 걸어 가 말을 걸 수 있어야 한다(2026-10-28 mt3: 문이 «조사 시작»으로 가는 유일한 칸을 막았다).
      const before = new Set(unreachableEvents(probeProject, mapId));
      const keepsReach = (c: Cell) => {
        const trial = { ...probe, events: probe.events.map((e) => e.id === door.id ? { ...e, x: c.x, y: c.y } : e) } as GameMap;
        return unreachableEvents({ ...probeProject, maps: { ...probeProject.maps, [mapId]: trial } } as Project, mapId).every((id) => before.has(id) || id === door.id);
      };
      at = cands.find((c) => piece.cells.every(([dx, dy, , layer]) => { const i = (c.y + piece.anchorDy + dy!) * w + c.x + dx!; return i >= 0 && free(map, (layer === 2 ? 2 : 3) as Layer, i); }) && keepsReach(c));
    }
    // 문 자리가 없어도, 아무 데로도 이어지지 않는 틈 위에 아무것도(이벤트·시작 칸) 없으면 벽으로 메운다 — 어둠으로 뻗은 막다른 통로보다 닫힌 벽이 낫다
    // (2026-10-28 mt3 flash: 빈 시작 맵을 치운 뒤 밀실 남쪽 틈이 막다른 길이 됐고, 북벽 발치는 가구와 «조사 시작»으로 가는 길뿐이었다).
    const start = project0.startMapId === mapId ? project0.startPos : undefined;
    const closable = gaps.every((g) => !events.some((e) => e.x === g.x && e.y === g.y) && !(start && start.x === g.x && start.y === g.y));
    if (!at && !onDoorArt) notes.push(!piece ? "이 칩셋에 벽에 세울 문 그림이 없다" : `문 「${door.name ?? door.id}」: 북벽 발치에 문 그림을 세울 자리가 없다(가구·다른 이벤트로 가는 길)`);
    if (!at && !onDoorArt && !closable) notes.push("남쪽 틈 위에 이벤트·시작 칸이 있어 틈은 그대로 둠");
    if (at || onDoorArt || closable) {
      // 틈을 메운다: 틈 칸과 그 바로 위 칸에 걸친 그림(모델이 틈에 세운 문 등)을 걷고, 틈을 공허로 바꾼 뒤 둘레 띠를 다시 칠한다.
      for (const g of gaps) {
        const i = g.y * w + g.x, up = i - w;
        const below = layerTileAt(map0, 3, i);
        for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, i, -1);
        const base = (t: number) => tileLabel(t).replace(/\s*\([^)]*\)\s*$/u, "");
        if (below >= 0 && layerTileAt(map, 3, up) >= 0 && base(layerTileAt(map, 3, up)) === base(below)) setLayerTileAt(map, 3, up, -1);
        map.lowerTiles[i] = S.void;
      }
      reband(k, map, (x, y) => gaps.some((g) => Math.abs(g.x - x) <= 1 && Math.abs(g.y - y) <= 1));
      changed = true;
      notes.push(`막다른 남쪽 출구 ${gaps.map((g) => `(${g.x},${g.y})`).join("")}를 벽으로 메움(이동 칸이 없는 틈)`);
    }
    if (at && piece) {
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
      run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: map } } as Project;
      // 그 칸에 있던 조용한 이벤트(시작 목표 등)는 문이 있던 자리로 비켜 둔다(먼저 비키고, 문이 옮긴 뒤 그 자리로 — move_event 는 찬 칸이면 옆 칸으로 민다).
      const sitters = events.filter((e) => e.id !== door.id && e.x === at!.x && e.y === at!.y && silent(e));
      for (const e of sitters) run.call("move_event", { mapId, eventId: e.id, x: door.x, y: door.y });
      const res = run.call("move_event", { mapId, eventId: door.id, x: at.x, y: at.y });
      if (res.ok) for (const e of sitters) run.call("move_event", { mapId, eventId: e.id, x: door.x, y: door.y });
      notes.push(res.ok ? `문 「${door.name ?? door.id}」 (${door.x},${door.y})→(${at.x},${at.y}) 북벽 발치에 ${piece.id} 그림` : `문 옮기기 실패: ${String(res.summary).slice(0, 100)}`);
      return { notes };
    }
  }
  if (changed) run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: map } } as Project;
  return { notes };
}
