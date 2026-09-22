import { inBounds, isPassable } from "../collision";
import { eventAtPoint } from "../eventFootprintQuery";
import type { Command, GameEvent, GameMap, Project } from "../types";
import type { LintIssue } from "../lint/projectLint";
import {
  isPointRef,
  isRectRef,
  isSideRef,
  normalizeProjectWorldGraph,
} from "./guards";
import type {
  WorldGraph,
  WorldGraphBoundary,
  WorldGraphEntry,
  WorldGraphSide,
} from "./types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

interface BoundaryProfile {
  readonly side: WorldGraphSide;
  readonly cells: readonly { readonly x: number; readonly y: number; readonly passable: boolean }[];
}

export function lintWorldGraph(project: Project): LintIssue[] {
  let graph: WorldGraph;
  try {
    graph = normalizeProjectWorldGraph(project);
  } catch (cause) {
    return [{
      severity: "error",
      code: "world-graph-schema",
      message: `월드 그래프 스키마 오류: ${cause instanceof Error ? cause.message : String(cause)}`,
    }];
  }
  const issues: LintIssue[] = [];
  checkMissingMaps(project, graph, issues);
  for (const edge of graph.edges) {
    if (edge.kind === "adjacent") checkAdjacentEdge(project, edge, issues);
    else checkTransferEdge(project, edge, issues);
  }
  return issues;
}

function checkMissingMaps(project: Project, graph: WorldGraph, issues: LintIssue[]): void {
  for (const node of graph.nodes) {
    if (project.maps[node.mapId]) continue;
    issues.push({
      severity: "warning",
      code: "world-graph-map-missing",
      mapId: node.mapId,
      message: `월드 그래프 노드가 아직 생성되지 않은 맵을 가리킵니다: ${node.mapId}`,
    });
  }
}

function checkTransferEdge(project: Project, edge: WorldGraph["edges"][number], issues: LintIssue[]): void {
  const fromMap = project.maps[edge.from.mapId];
  const toMap = project.maps[edge.to.mapId];
  if (!fromMap || !toMap) return;

  const transfers = transferCommandsFromMap(fromMap).filter((command) => command.mapId === toMap.id);
  if (transfers.length === 0) {
    const entry = isPointRef(edge.to.entry) ? edge.to.entry : undefined;
    if (entry) validateTransferDestination(project, toMap, entry.x, entry.y, "world-transfer-entry", issues);
    issues.push({
      severity: "warning",
      code: "world-transfer-missing",
      mapId: fromMap.id,
      message: `월드 그래프 transfer edge에 대응하는 실제 transfer 이벤트가 없습니다: ${fromMap.id} -> ${toMap.id}`,
    });
    return;
  }

  for (const command of transfers) validateTransferDestination(project, toMap, command.x, command.y, "world-transfer-command", issues);
  const entry = isPointRef(edge.to.entry) ? edge.to.entry : undefined;
  if (entry && !transfers.some((command) => command.x === entry.x && command.y === entry.y)) {
    issues.push({
      severity: "warning",
      code: "world-transfer-entry-mismatch",
      mapId: toMap.id,
      x: entry.x,
      y: entry.y,
      message: `월드 그래프 entry와 실제 transfer 착지 좌표가 다릅니다: ${fromMap.id} -> ${toMap.id} (${entry.x}, ${entry.y})`,
    });
  }
}

function validateTransferDestination(
  project: Project,
  map: GameMap,
  x: number,
  y: number,
  codePrefix: string,
  issues: LintIssue[]
): void {
  if (!inBounds(map, x, y)) {
    issues.push({
      severity: "error",
      code: `${codePrefix}-bounds`,
      mapId: map.id,
      x,
      y,
      message: `월드 그래프 transfer 목적지가 맵 밖입니다: ${map.id} (${x}, ${y})`,
    });
    return;
  }
  if (!isPassable(project, map, x, y)) {
    issues.push({
      severity: "error",
      code: `${codePrefix}-impassable`,
      mapId: map.id,
      x,
      y,
      message: `월드 그래프 transfer 목적지가 통행 불가입니다: ${map.id} (${x}, ${y})`,
    });
  }
  // 몸 사각으로 본다 — 2x2 이벤트의 비앵커 칸에 워프를 꽂아도 착지가 몸과 겹친다.
  const overlap = eventAtPoint(map, x, y);
  if (overlap) {
    issues.push({
      severity: "error",
      code: "world-transfer-event-overlap",
      mapId: map.id,
      x,
      y,
      message: `월드 그래프 transfer 목적지에 이벤트가 겹칩니다: ${map.id} (${x}, ${y}) — ${overlap.id}`,
    });
  }
}

function checkAdjacentEdge(project: Project, edge: WorldGraph["edges"][number], issues: LintIssue[]): void {
  const fromMap = project.maps[edge.from.mapId];
  const toMap = project.maps[edge.to.mapId];
  if (!fromMap || !toMap) return;

  const fromProfile = boundaryProfile(project, fromMap, edge.from.exit, undefined);
  if (!fromProfile) {
    issues.push({
      severity: "warning",
      code: "world-adjacent-boundary-missing",
      mapId: fromMap.id,
      message: `adjacent edge의 from.exit 경계를 해석할 수 없습니다: ${fromMap.id} -> ${toMap.id}`,
    });
    return;
  }
  const toProfile = boundaryProfile(project, toMap, edge.to.entry, oppositeSide(fromProfile.side));
  if (!toProfile) {
    issues.push({
      severity: "warning",
      code: "world-adjacent-boundary-missing",
      mapId: toMap.id,
      message: `adjacent edge의 to.entry 경계를 해석할 수 없습니다: ${fromMap.id} -> ${toMap.id}`,
    });
    return;
  }
  if (toProfile.side !== oppositeSide(fromProfile.side)) {
    issues.push({
      severity: "warning",
      code: "world-adjacent-side-mismatch",
      mapId: toMap.id,
      message: `adjacent edge의 변 방향이 맞지 않습니다: ${fromMap.id}.${fromProfile.side} -> ${toMap.id}.${toProfile.side}`,
    });
  }
  if (fromProfile.cells.length !== toProfile.cells.length) {
    issues.push({
      severity: "warning",
      code: "world-adjacent-size-mismatch",
      mapId: toMap.id,
      message: `adjacent edge 경계 길이가 다릅니다: ${fromMap.id} ${fromProfile.cells.length}칸, ${toMap.id} ${toProfile.cells.length}칸`,
    });
  }

  for (let index = 0; index < fromProfile.cells.length; index += 1) {
    const fromCell = fromProfile.cells[index];
    const toCell = toProfile.cells[index];
    if (!fromCell?.passable) continue;
    if (toCell?.passable) continue;
    issues.push({
      severity: "warning",
      code: "world-adjacent-passability-break",
      mapId: toMap.id,
      x: toCell?.x,
      y: toCell?.y,
      message: `adjacent 경계가 이어지지 않습니다: ${fromMap.id}.${fromProfile.side} offset ${index}는 통행 가능하지만 ${toMap.id}.${toProfile.side}가 막혀 있습니다.`,
    });
  }
}

function boundaryProfile(
  project: Project,
  map: GameMap,
  ref: WorldGraphBoundary | WorldGraphEntry | undefined,
  fallbackSide: WorldGraphSide | undefined
): BoundaryProfile | null {
  if (!ref && fallbackSide) return sideProfile(project, map, fallbackSide);
  if (!ref) return null;
  if (isSideRef(ref)) return sideProfile(project, map, ref.side);
  if (isRectRef(ref)) return rectProfile(project, map, ref);
  if (isPointRef(ref)) return pointProfile(project, map, ref);
  return null;
}

function sideProfile(project: Project, map: GameMap, side: WorldGraphSide): BoundaryProfile {
  const cells: { readonly x: number; readonly y: number; readonly passable: boolean }[] = [];
  if (side === "north" || side === "south") {
    const y = side === "north" ? 0 : map.height - 1;
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y, passable: isPassable(project, map, x, y) });
  } else {
    const x = side === "west" ? 0 : map.width - 1;
    for (let y = 0; y < map.height; y += 1) cells.push({ x, y, passable: isPassable(project, map, x, y) });
  }
  return { side, cells };
}

function rectProfile(project: Project, map: GameMap, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): BoundaryProfile | null {
  const side = sideForRect(map, rect);
  if (!side) return null;
  const cells: { readonly x: number; readonly y: number; readonly passable: boolean }[] = [];
  if (side === "north" || side === "south") {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) cells.push({ x, y: rect.y, passable: isPassable(project, map, x, rect.y) });
  } else {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) cells.push({ x: rect.x, y, passable: isPassable(project, map, rect.x, y) });
  }
  return { side, cells };
}

function pointProfile(project: Project, map: GameMap, point: { readonly x: number; readonly y: number }): BoundaryProfile | null {
  const side = sideForPoint(map, point);
  if (!side) return null;
  return { side, cells: [{ x: point.x, y: point.y, passable: isPassable(project, map, point.x, point.y) }] };
}

function sideForRect(map: GameMap, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): WorldGraphSide | null {
  if (rect.h === 1 && rect.y === 0) return "north";
  if (rect.h === 1 && rect.y + rect.h === map.height) return "south";
  if (rect.w === 1 && rect.x === 0) return "west";
  if (rect.w === 1 && rect.x + rect.w === map.width) return "east";
  return null;
}

function sideForPoint(map: GameMap, point: { readonly x: number; readonly y: number }): WorldGraphSide | null {
  if (point.y === 0) return "north";
  if (point.y === map.height - 1) return "south";
  if (point.x === 0) return "west";
  if (point.x === map.width - 1) return "east";
  return null;
}

function oppositeSide(side: WorldGraphSide): WorldGraphSide {
  switch (side) {
    case "north": return "south";
    case "south": return "north";
    case "east": return "west";
    case "west": return "east";
  }
}

function transferCommandsFromMap(map: GameMap): Extract<Command, { kind: "transfer" }>[] {
  const transfers: Extract<Command, { kind: "transfer" }>[] = [];
  for (const event of map.events) {
    for (const command of eventCommands(event)) collectTransfers(command, transfers);
  }
  return transfers;
}

function eventCommands(event: GameEvent): readonly Command[] {
  return [
    ...event.commands,
    ...(event.pages ?? []).flatMap((page) => page.commands),
  ];
}

function collectTransfers(command: Command, out: Extract<Command, { kind: "transfer" }>[]): void {
  if (command.kind === "transfer") out.push(command);
  if (command.kind === "choices") {
    for (const option of command.options) for (const child of option.branch) collectTransfers(child, out);
    for (const child of command.cancelBranch ?? []) collectTransfers(child, out);
  } else if (command.kind === "presentItem") {
    for (const branch of presentItemBranchLists(command)) for (const child of branch) collectTransfers(child, out);
  } else if (command.kind === "fork") {
    for (const child of command.then) collectTransfers(child, out);
    for (const child of command.else ?? []) collectTransfers(child, out);
  } else if (command.kind === "loop") {
    for (const child of command.body) collectTransfers(child, out);
  }
}
