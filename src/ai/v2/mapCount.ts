// 「세는 맵」 — 완성도 척도(scripts/fs-scale/score.mjs countedContent)의 맵 규칙을 조수 하네스 안으로 옮긴 것이다.
// 척도와 같아야 한다: 시작 맵에서 transfer(·쓰이는 공통 이벤트의 transfer)·엔딩 이어가기로 닿고, 100칸 이상, 타일 6종 이상,
// 명령 있는 이벤트 1개 이상, 다른 센 맵과 배치(타일 층)가 다르다. test/aiV2MapCount.test.ts 가 같은 입력에서 척도와 같은 맵을 세는지 겨룬다.
// 해시 대신 배치 문자열을 그대로 Set 에 넣는다 — 같은 배치는 복사한 맵이라 세지 않는다.
// 순회 순서가 척도(도달한 순서)와 달라, 배치가 같은 맵이 여럿이면 어느 id 를 세는지는 다를 수 있다 — 세는 개수는 같다(관문은 개수만 쓴다).
import type { GameMap, Project } from "@/project/types";
import { isPassableLanding } from "@/project/collision";

/** score.mjs MIN_TILE_KINDS · MIN_MAP_CELLS 와 같은 숫자. */
export const MIN_TILE_KINDS = 6;
export const MIN_MAP_CELLS = 100;
/** 끝맺음 관문이 강제하는 세는 맵 수(2026-11-10 오너: 「맵을 가장 우선」). 한 번에 한 단계씩 올린다 — 6, 8 … */
export const MIN_COUNTED_MAPS = 6;
/** 단계 1 권장(강제 아님): 척도 단계 1 목표. 모자라면 최종 보고에 «N장 부족» 한 줄로만 낸다. */
export const RECOMMENDED_MAPS = 15;

type Obj = Record<string, unknown>;

type UncountedReason = "unreachable" | "small" | "few-tiles" | "no-event" | "copy";
interface MapCountResult {
  readonly counted: readonly string[];
  readonly uncounted: readonly { readonly id: string; readonly name: string; readonly reason: UncountedReason; readonly detail: string }[];
}

function walk(node: unknown, visit: (n: Obj) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (node && typeof node === "object") { visit(node as Obj); for (const key of Object.keys(node as Obj)) walk((node as Obj)[key], visit); }
}
function collectStrings(node: unknown, into: Set<string>): void {
  if (typeof node === "string") into.add(node);
  else if (Array.isArray(node)) for (const item of node) collectStrings(item, into);
  else if (node && typeof node === "object") for (const key of Object.keys(node as Obj)) collectStrings((node as Obj)[key], into);
}
const pagesOf = (event: Obj): Obj[] => (Array.isArray(event.pages) ? (event.pages as Obj[]) : []);
function commandCount(event: Obj): number {
  let count = 0;
  walk([event.commands, ...pagesOf(event).map((page) => page.commands)], (node) => { if (typeof node.kind === "string") count += 1; });
  return count;
}
function transferTargets(node: unknown): Set<string> {
  const targets = new Set<string>();
  walk(node, (item) => { if (item.kind === "transfer" && typeof item.mapId === "string") targets.add(item.mapId); });
  return targets;
}
function tileKinds(map: Obj): Set<unknown> {
  const kinds = new Set<unknown>();
  for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"]) {
    const layer = map[key];
    if (Array.isArray(layer)) for (const tile of layer) if (tile !== -1 && tile != null) kinds.add(tile);
  }
  return kinds;
}
const layoutKey = (map: Obj): string => [map.width, map.height, map.lowerTiles, map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles]
  .map((part) => (Array.isArray(part) ? part.join(",") : String(part ?? ""))).join("|");

function reachable(doc: Obj): Set<string> {
  const maps = (doc.maps ?? {}) as Record<string, Obj>;
  const commonEvents = (Array.isArray(doc.commonEvents) ? doc.commonEvents : []) as Obj[];
  const seen = new Set<string>(); const queue: string[] = [];
  const reach = (id: unknown) => { if (typeof id === "string" && maps[id] && !seen.has(id)) { seen.add(id); queue.push(id); } };
  reach(doc.startMapId);
  for (const ending of (Array.isArray(doc.endings) ? doc.endings : []) as Obj[]) reach(((ending?.continueTo ?? {}) as Obj).mapId);
  const usedCommon = new Set<string>();
  while (queue.length > 0) {
    const mapId = queue.pop()!;
    const events = (maps[mapId]!.events ?? []) as unknown[];
    for (const id of transferTargets(events)) reach(id);
    const strings = new Set<string>(); collectStrings(events, strings);
    for (const common of commonEvents) {
      if (typeof common?.id === "string" && strings.has(common.id) && !usedCommon.has(common.id)) { usedCommon.add(common.id); for (const id of transferTargets(common)) reach(id); }
    }
  }
  return seen;
}

/** 센 맵과 못 센 맵(이유 포함). 이유 순서는 척도의 걸러내는 차례와 같다. */
export function countMaps(project: Project): MapCountResult {
  const doc = project as unknown as Obj;
  const maps = (doc.maps ?? {}) as Record<string, Obj>;
  const reached = reachable(doc);
  const layouts = new Set<string>();
  const counted: string[] = []; const uncounted: MapCountResult["uncounted"][number][] = [];
  const nameOf = (id: string) => String(maps[id]?.name ?? id);
  for (const [id, map] of Object.entries(maps)) {
    if (!map || typeof map !== "object") continue; // 깨진 항목은 세지도 이유로 적지도 않는다
    if (!reached.has(id)) { uncounted.push({ id, name: nameOf(id), reason: "unreachable", detail: "시작 맵에서 문(transfer)으로 닿지 않는다" }); continue; }
    const cells = Number(map.width) * Number(map.height);
    if (!(cells >= MIN_MAP_CELLS)) { uncounted.push({ id, name: nameOf(id), reason: "small", detail: `넓이 ${Number.isFinite(cells) ? cells : 0}칸<${MIN_MAP_CELLS}` }); continue; }
    const kinds = tileKinds(map).size;
    if (kinds < MIN_TILE_KINDS) { uncounted.push({ id, name: nameOf(id), reason: "few-tiles", detail: `타일 ${kinds}종<${MIN_TILE_KINDS}` }); continue; }
    if (!((map.events ?? []) as Obj[]).some((event) => commandCount(event) > 0)) { uncounted.push({ id, name: nameOf(id), reason: "no-event", detail: "명령이 든 이벤트가 없다" }); continue; }
    const key = layoutKey(map);
    if (layouts.has(key)) { uncounted.push({ id, name: nameOf(id), reason: "copy", detail: "다른 맵과 배치가 같다" }); continue; }
    layouts.add(key); counted.push(id);
  }
  return { counted, uncounted };
}

/** 시작 맵에서 안 닿는 맵 무리(서로 문으로 이어진 맵끼리 한 무리) — 무리마다 하나만 이으면 무리 전체가 닿는다. */
interface IsolatedGroup {
  /** 이을 대표 맵(무리에서 가장 넓은 맵). */
  readonly mapId: string;
  readonly mapName: string;
  readonly size: number;
  /** 대표 맵 가장자리에 가까운 걸을 수 있는 빈 바닥 칸 — create_transfer_pair 가 받아 주는 칸(없으면 null). */
  readonly cell: { readonly x: number; readonly y: number } | null;
}
export interface LinkPlan {
  /** 이을 곳(닿는 맵): 센 시작 맵을 먼저, 아니면 닿는 맵 중 가장 넓은 것. */
  readonly from: { readonly mapId: string; readonly mapName: string; readonly cell: { readonly x: number; readonly y: number } } | null;
  readonly groups: readonly IsolatedGroup[];
}

/** 맵 가장자리에서 가장 가까운(같으면 남쪽 가장자리 먼저) 걸을 수 있는 빈 바닥 칸. */
function edgeFloorCell(project: Project, map: GameMap): { x: number; y: number } | null {
  const taken = new Set<string>(); for (const e of map.events ?? []) taken.add(`${e.x},${e.y}`);
  let best: { x: number; y: number; d: number; south: number } | null = null;
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) {
    if (taken.has(`${x},${y}`) || !isPassableLanding(project, map, x, y)) continue;
    const d = Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
    if (d < 1) continue; // 맨 가장자리 칸은 문이 벽 칸 위로 밀려 실패하기 쉽다 — 한 칸 안쪽부터
    const south = map.height - 1 - y;
    if (!best || d < best.d || (d === best.d && south < best.south)) best = { x, y, d, south };
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** 못 닿는 맵 무리와 이을 곳을 계획한다(순수 함수 — 호출 문구는 shipChecks 가 만든다). */
export function planLinks(project: Project, counted: readonly string[] = countMaps(project).counted): LinkPlan {
  const doc = project as unknown as Obj;
  const maps = (doc.maps ?? {}) as Record<string, GameMap>;
  const reached = reachable(doc);
  const links = new Map<string, Set<string>>();
  for (const [id, map] of Object.entries(maps)) {
    if (!map || typeof map !== "object") continue;
    for (const to of transferTargets((map.events ?? []) as unknown[])) {
      if (!maps[to]) continue;
      if (!links.has(id)) links.set(id, new Set()); if (!links.has(to)) links.set(to, new Set());
      links.get(id)!.add(to); links.get(to)!.add(id);
    }
  }
  const area = (id: string) => Number(maps[id]?.width) * Number(maps[id]?.height) || 0;
  const isolated = Object.keys(maps).filter((id) => maps[id] && typeof maps[id] === "object" && !reached.has(id));
  const seen = new Set<string>(); const groups: IsolatedGroup[] = [];
  for (const id of isolated) {
    if (seen.has(id)) continue;
    const comp: string[] = []; const stack = [id]; seen.add(id);
    while (stack.length > 0) { const cur = stack.pop()!; comp.push(cur); for (const n of links.get(cur) ?? []) if (!seen.has(n) && !reached.has(n) && maps[n]) { seen.add(n); stack.push(n); } }
    const rep = comp.sort((a, b) => area(b) - area(a) || a.localeCompare(b))[0]!;
    groups.push({ mapId: rep, mapName: String(maps[rep]!.name ?? rep), size: comp.length, cell: edgeFloorCell(project, maps[rep]!) });
  }
  groups.sort((a, b) => b.size - a.size || area(b.mapId) - area(a.mapId));
  const startId = String(doc.startMapId ?? "");
  const fromId = counted.includes(startId) ? startId : [...reached].filter((id) => maps[id]).sort((a, b) => area(b) - area(a))[0];
  const fromCell = fromId ? edgeFloorCell(project, maps[fromId]!) : null;
  return { from: fromId && fromCell ? { mapId: fromId, mapName: String(maps[fromId]!.name ?? fromId), cell: fromCell } : null, groups };
}
