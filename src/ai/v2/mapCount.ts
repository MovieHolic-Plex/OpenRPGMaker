// 「세는 맵」 — 완성도 척도(scripts/fs-scale/score.mjs countedContent)의 맵 규칙을 조수 하네스 안으로 옮긴 것이다.
// 척도와 같아야 한다: 시작 맵에서 transfer(·쓰이는 공통 이벤트의 transfer)·엔딩 이어가기로 닿고, 100칸 이상, 타일 6종 이상,
// 명령 있는 이벤트 1개 이상, 다른 센 맵과 배치(타일 층)가 다르다. test/aiV2MapCount.test.ts 가 같은 입력에서 척도와 같은 맵을 세는지 겨룬다.
// 해시 대신 배치 문자열을 그대로 Set 에 넣는다 — 같은 배치는 복사한 맵이라 세지 않는다.
import type { Project } from "@/project/types";

/** score.mjs MIN_TILE_KINDS · MIN_MAP_CELLS 와 같은 숫자. */
export const MIN_TILE_KINDS = 6;
export const MIN_MAP_CELLS = 100;
/** 끝맺음 관문이 강제하는 세는 맵 수(2026-11-10 오너: 「맵을 가장 우선」). 한 번에 한 단계씩 올린다 — 6, 8 … */
export const MIN_COUNTED_MAPS = 4;
/** 단계 1 권장(강제 아님): 척도 단계 1 목표. 모자라면 최종 보고에 «N장 부족» 한 줄로만 낸다. */
export const RECOMMENDED_MAPS = 15;

type Obj = Record<string, unknown>;

export type UncountedReason = "unreachable" | "small" | "few-tiles" | "no-event" | "copy";
export interface MapCountResult {
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
