// create_transfer_pair 의 도달성 보정.
//
// 왜 필요한가(몬스터 수집 도그푸딩 실측): 모델은 숲마을 위 가장자리 한가운데 (32,0) 에 1번 도로 문을
// 달았다. 그 칸 자체는 통행 가능했지만 마을 쪽에서는 숲에 막혀 닿지 않았다 — 위 가장자리에서
// 걸어 닿는 칸은 x 2~8, 51~63 뿐. 도구는 조용히 성공했고 게임은 첫 마을에서 끝났다.
// 맵에 이미 「플레이어가 서는 칸」(시작 위치, 다른 맵에서 들어오는 착지점)이 있으면 거기서 걸어
// 닿는 칸만 출입구로 인정하고, 아니면 같은 가장자리(가장자리가 아니면 반경 8)의 가장 가까운
// 닿는 칸으로 옮긴다.
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";

const NON_EDGE_RADIUS = 8;

/** 이 맵에서 플레이어가 확실히 서는 칸 — 시작 위치와 다른 맵에서 이 맵으로 들어오는 transfer 착지점. */
export function playerAnchors(project: Project, map: GameMap): Point[] {
  const anchors: Point[] = [];
  if (project.startMapId === map.id && project.startPos) anchors.push({ x: project.startPos.x, y: project.startPos.y });
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "transfer" && record.mapId === map.id && typeof record.x === "number" && typeof record.y === "number") {
      anchors.push({ x: record.x, y: record.y });
    }
    for (const value of Object.values(record)) if (value && typeof value === "object") visit(value);
  };
  for (const other of Object.values(project.maps)) {
    if (other.id === map.id) continue;
    for (const event of other.events) visit(event.pages ?? event.commands);
  }
  for (const common of project.commonEvents ?? []) visit(common);
  return anchors.filter((point) => inMapBounds(map, point.x, point.y));
}

/** 앵커에서 걸어 닿는 칸 집합(y*width+x). 앵커가 없으면 null — 판단할 근거가 없다. */
export function walkableFromAnchors(project: Project, map: GameMap): Set<number> | null {
  const anchors = playerAnchors(project, map);
  if (anchors.length === 0) return null;
  const seen = new Set<number>();
  const queue: Point[] = [];
  for (const anchor of anchors) {
    const key = anchor.y * map.width + anchor.x;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(anchor);
  }
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (!inMapBounds(map, x, y)) continue;
      const key = y * map.width + x;
      if (seen.has(key) || !canMove(project, map, cell.x, cell.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

/**
 * 요청 좌표 대신 시도할 후보 칸들 — 앵커에서 닿는 칸 중 같은 가장자리(가장자리 요청일 때) 또는
 * 반경 NON_EDGE_RADIUS 안, 가까운 순.
 */
export function reachableGateCandidates(map: GameMap, reach: Set<number>, requested: Point): Point[] {
  const onLeft = requested.x <= 0;
  const onRight = requested.x >= map.width - 1;
  const onTop = requested.y <= 0;
  const onBottom = requested.y >= map.height - 1;
  const onEdge = onLeft || onRight || onTop || onBottom;
  const out: Array<Point & { d: number }> = [];
  for (const key of reach) {
    const x = key % map.width;
    const y = Math.floor(key / map.width);
    const d = Math.abs(x - requested.x) + Math.abs(y - requested.y);
    if (onEdge) {
      const sameEdge = (onLeft && x === 0) || (onRight && x === map.width - 1) || (onTop && y === 0) || (onBottom && y === map.height - 1);
      if (!sameEdge) continue;
    } else if (d > NON_EDGE_RADIUS) continue;
    out.push({ x, y, d });
  }
  out.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  return out.map(({ x, y }) => ({ x, y }));
}
