// create_transfer_pair 의 도달성 보정.
//
// 왜 필요한가(몬스터 수집 도그푸딩 실측): 모델은 숲마을 위 가장자리 한가운데 (32,0) 에 1번 도로 문을
// 달았다. 그 칸 자체는 통행 가능했지만 마을 쪽에서는 숲에 막혀 닿지 않았다 — 위 가장자리에서
// 걸어 닿는 칸은 x 2~8, 51~63 뿐. 도구는 조용히 성공했고 게임은 첫 마을에서 끝났다.
// 맵에 이미 「플레이어가 서는 칸」(시작 위치, 다른 맵에서 들어오는 착지점)이 있으면 거기서 걸어
// 닿는 칸만 출입구로 인정하고, 아니면 같은 가장자리(가장자리가 아니면 반경 8)의 가장 가까운
// 닿는 칸으로 옮긴다.
//
// 2026-09-24 추격 호러 r8 보강: 도달성 앵커 검사로도 못 잡는 봉쇄가 있다 — 이웃 문(playerTouch)을
// 밟지 않으면 닿을 수 없는 「주머니」에 문이 갇힌 경우(복도 (5,3): 벽·가구·이웃 게이트가 사방).
// 자동 플레이와 플레이어 어느 쪽에서도 그 문을 밟지 못해 엔딩이 실질적으로 잠겼다. touch 문 칸을
// 차단으로 보고 가장 큰 통행 묶음에 문이 실제로 접하는지 본다(→ transferGatesStayApproachable).
import { canMove, isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { inMapBounds, type Point } from "./mapHelpers";
import { handInteriorMapExits } from '@/editor/handInterior/exits';
import { ToolError } from './types';

const NON_EDGE_RADIUS = 8;

/** doorAt는 한 칸 문 그림의 하단이다. 넓게 열린 실내를 그 문에 연결해 성공시키지 않는다. */
export function assertDoorExitWidths(project: Project, a: GameMap, gateA: Point, b: GameMap, gateB: Point, doorA?: Point, doorB?: Point): void {
  if (!doorA && !doorB) return;
  const width = (map: GameMap, gate: Point, door?: Point): number | undefined => {
    if (door) return 1;
    if (map.tilesetId !== 'atlas_biome_interior' && !(map.tilesetId === 'jp_city' && map.climate?.mode === 'indoor')) return undefined;
    if (gate.y !== map.height - 1) return undefined;
    return handInteriorMapExits(project, map).find(span => gate.x >= span.x && gate.x < span.x + span.width)?.width;
  };
  const wa = width(a, gateA, doorA), wb = width(b, gateB, doorB);
  if (wa !== undefined && wb !== undefined && wa !== wb) throw new ToolError(`문과 실내 출구의 가로 폭이 다릅니다: ${a.name} ${wa}칸 ↔ ${b.name} ${wb}칸. 한 칸 문이면 실내 남쪽 출구도 한 칸만 열고 다시 연결하세요.`, { code: 'transfer-door-width' });
}

const TOUCH_TRIGGERS = new Set(["playerTouch", "touch", "eventTouch"]);

function triggerKind(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { kind?: unknown }).kind === "string") {
    return (value as { kind: string }).kind;
  }
  return "";
}

/** 밟으면 순간이동·사망하는 칸(문·함정) — 그 위로는 걸어 지나갈 수 없다고 본다. */
export function touchBlockedCells(map: GameMap): Set<string> {
  const blocked = new Set<string>();
  for (const event of map.events ?? []) {
    const touch = TOUCH_TRIGGERS.has(triggerKind(event.trigger))
      || (event.pages ?? []).some((page) => TOUCH_TRIGGERS.has(triggerKind(page.trigger)));
    if (touch) blocked.add(`${event.x},${event.y}`);
  }
  return blocked;
}

function isTransferGateEvent(event: GameEvent): boolean {
  const touch = TOUCH_TRIGGERS.has(triggerKind(event.trigger))
    || (event.pages ?? []).some((page) => TOUCH_TRIGGERS.has(triggerKind(page.trigger)));
  if (!touch) return false;
  return (event.pages ?? []).some((page) => (page.commands ?? []).some((command) => command?.kind === "transfer"));
}

/** 차단 칸을 뺀 지도에서 가장 큰 통행 묶음 — 「방 바닥」의 기준. */
export function largestWalkGroup(project: Project, map: GameMap, blocked: ReadonlySet<string>): Set<number> {
  const visited = new Set<number>();
  let best: number[] = [];
  const width = map.width;
  const total = map.width * map.height;
  for (let start = 0; start < total; start += 1) {
    if (visited.has(start)) continue;
    const sx = start % width;
    const sy = Math.floor(start / width);
    if (blocked.has(`${sx},${sy}`) || !isPassable(project, map, sx, sy)) {
      visited.add(start);
      continue;
    }
    const group: number[] = [start];
    visited.add(start);
    const queue: Point[] = [{ x: sx, y: sy }];
    for (let i = 0; i < queue.length; i += 1) {
      const cell = queue[i]!;
      for (const [dx, dy] of CARDINAL_STEPS) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        if (!inMapBounds(map, nx, ny)) continue;
        const key = ny * width + nx;
        if (visited.has(key) || blocked.has(`${nx},${ny}`)) continue;
        if (!canMove(project, map, cell.x, cell.y, nx, ny)) continue;
        visited.add(key);
        group.push(key);
        queue.push({ x: nx, y: ny });
      }
    }
    if (group.length > best.length) best = group;
  }
  return new Set(best);
}

function gateTouchesGroup(project: Project, map: GameMap, gate: Point, group: ReadonlySet<number>): boolean {
  return CARDINAL_STEPS.some(([dx, dy]) => {
    const x = gate.x + dx, y = gate.y + dy;
    return inMapBounds(map, x, y) && group.has(y * map.width + x)
      && canMove(project, map, x, y, gate.x, gate.y);
  });
}

/**
 * 이 맵에 newGate 를 넣어도(넣은 뒤에도) 모든 transfer 문이 방 바닥(가장 큰 묶음)으로
 * 실제로 열려 있는가. 닿지 않는 문은 밟아도 아무 데도 못 가는 죽은 장치다.
 */
export function transferGatesStayApproachable(
  project: Project,
  map: GameMap,
  newGate?: Point,
): { readonly ok: boolean; readonly sealed: readonly string[]; readonly group: ReadonlySet<number> } {
  const blocked = touchBlockedCells(map);
  if (newGate) blocked.add(`${newGate.x},${newGate.y}`);
  const group = largestWalkGroup(project, map, blocked);
  const sealed: string[] = [];
  for (const event of map.events ?? []) {
    if (!isTransferGateEvent(event)) continue;
    if (newGate && event.x === newGate.x && event.y === newGate.y) continue;
    if (!gateTouchesGroup(project, map, event, group)) sealed.push(`${event.id}(${event.x},${event.y})`);
  }
  if (newGate && !gateTouchesGroup(project, map, newGate, group)) sealed.push(`새 출입구(${newGate.x},${newGate.y})`);
  return { ok: sealed.length === 0, sealed, group };
}

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

const CARDINAL_STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * 이 칸을 빼면 이웃 통행 칸이 둘 이상의 묶음으로 갈라지는가.
 * 막다른 칸(이웃 1)은 아니다 — 출입구로 써도 옆 방이 안 막힌다.
 * 복도 한 칸·문간처럼 양쪽을 잇는 유일한 칸에 playerTouch 문을 놓으면
 * 밟는 즉시 다른 맵으로 나가 같은 맵 너머에는 영영 못 간다
 * (2026-09-24 연애 도그푸딩: 라디오 부스 콘솔이 출구 문 뒤에 갇힘).
 */
export function transferTileSeversWalk(project: Project, map: GameMap, x: number, y: number): boolean {
  const neighbors: Point[] = [];
  for (const [dx, dy] of CARDINAL_STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inMapBounds(map, nx, ny)) continue;
    if (!canMove(project, map, x, y, nx, ny) && !canMove(project, map, nx, ny, x, y)) continue;
    neighbors.push({ x: nx, y: ny });
  }
  if (neighbors.length <= 1) return false;
  const blocked = y * map.width + x;
  const start = neighbors[0]!;
  const seen = new Set<number>([start.y * map.width + start.x]);
  const queue: Point[] = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index]!;
    for (const [dx, dy] of CARDINAL_STEPS) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      if (!inMapBounds(map, nx, ny)) continue;
      const key = ny * map.width + nx;
      if (key === blocked || seen.has(key)) continue;
      if (!canMove(project, map, cell.x, cell.y, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return neighbors.slice(1).some((neighbor) => !seen.has(neighbor.y * map.width + neighbor.x));
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
