import { canMove, isPassable } from "@/project/collision";
import {
  auditIceGrandExpanseMaterial,
  ICE_GRAND_EXPANSE_BFS_TARGETS,
  ICE_GRAND_EXPANSE_CYCLES,
  ICE_GRAND_EXPANSE_NODES,
  ICE_GRAND_EXPANSE_REGIONS,
  ICE_GRAND_EXPANSE_ROUTE_EDGES,
  type IceGrandExpanseBfsTargetId,
  type IceGrandExpanseMaterialAudit,
  type IceGrandExpanseNodeId,
  type IceGrandExpansePoint,
  type IceGrandExpanseRouteEdgeId,
} from "@/project/defaults/iceGrandExpanseMap";
import {
  ICE_GRAND_EXPANSE_BOSS,
  ICE_GRAND_EXPANSE_HEIGHT,
  ICE_GRAND_EXPANSE_START,
  ICE_GRAND_EXPANSE_WIDTH,
} from "@/project/defaults/iceGrandExpansePlan";
import type { GameMap, Project } from "@/project/types";

export { ICE_GRAND_EXPANSE_BFS_TARGETS, ICE_GRAND_EXPANSE_CYCLES, ICE_GRAND_EXPANSE_NODES, ICE_GRAND_EXPANSE_REGIONS, ICE_GRAND_EXPANSE_ROUTE_EDGES, ICE_GRAND_EXPANSE_SHORTCUTS, shortcutDestination } from "@/project/defaults/iceGrandExpanseMap";
export type { IceGrandExpanseBfsTargetId, IceGrandExpanseBridgeAudit, IceGrandExpanseMaterialAudit, IceGrandExpanseNodeId, IceGrandExpansePoint, IceGrandExpanseRouteEdgeId, IceGrandExpanseShortcutId, IceGrandExpanseShortcutState } from "@/project/defaults/iceGrandExpanseMap";
export type IceGrandExpanseTopologyErrorCode = "ANCHOR_BLOCKED" | "ROUTE_UNREACHABLE";

export class IceGrandExpanseTopologyError extends Error {
  readonly name = "IceGrandExpanseTopologyError";
  constructor(
    readonly code: IceGrandExpanseTopologyErrorCode,
    readonly x: number,
    readonly y: number,
    readonly reason: string,
    readonly routeId?: string,
  ) {
    super(`${code}:${x},${y}:${reason}${routeId === undefined ? "" : `:${routeId}`}`);
  }
}

export type IceGrandExpanseEdgePath = { readonly id: IceGrandExpanseRouteEdgeId; readonly from: IceGrandExpanseNodeId; readonly to: IceGrandExpanseNodeId; readonly cells: readonly IceGrandExpansePoint[] };

export type IceGrandExpanseTopology = { readonly routeEdgeMask: Uint16Array; readonly nodeCellIds: readonly (IceGrandExpanseNodeId | null)[]; readonly edgePaths: readonly IceGrandExpanseEdgePath[] };

function appendSegment(cells: IceGrandExpansePoint[], from: readonly [number, number], to: readonly [number, number]): void {
  const [fromX, fromY] = from;
  const [toX, toY] = to;
  if (fromX !== toX && fromY !== toY) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", fromX, fromY, "NON_ORTHOGONAL_ROUTE");
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  const distance = Math.abs(toX - fromX) + Math.abs(toY - fromY);
  for (let step = cells.length === 0 ? 0 : 1; step <= distance; step += 1) cells.push({ x: fromX + dx * step, y: fromY + dy * step });
}

function routeCells(waypoints: readonly (readonly [number, number])[]): readonly IceGrandExpansePoint[] {
  const cells: IceGrandExpansePoint[] = [];
  for (let index = 1; index < waypoints.length; index += 1) {
    const from = waypoints[index - 1];
    const to = waypoints[index];
    if (from === undefined || to === undefined) continue;
    appendSegment(cells, from, to);
  }
  return cells;
}

function nodeCells(map: GameMap): readonly (IceGrandExpanseNodeId | null)[] {
  const ids: (IceGrandExpanseNodeId | null)[] = new Array<IceGrandExpanseNodeId | null>(map.width * map.height).fill(null);
  for (const node of ICE_GRAND_EXPANSE_NODES) {
    for (let y = node.bounds.y; y < node.bounds.y + node.bounds.height; y += 1) {
      for (let x = node.bounds.x; x < node.bounds.x + node.bounds.width; x += 1) {
        const index = y * map.width + x;
        ids[index] = node.id;
      }
    }
  }
  return ids;
}

export function createIceGrandExpanseTopology(map: GameMap): IceGrandExpanseTopology {
  const nodeCellIds = nodeCells(map);
  const routeEdgeMask = new Uint16Array(map.width * map.height);
  const edgePaths = ICE_GRAND_EXPANSE_ROUTE_EDGES.map((edge, edgeIndex): IceGrandExpanseEdgePath => {
    const cells = routeCells(edge.waypoints);
    for (const cell of cells) {
      const index = cell.y * map.width + cell.x;
      const previous = routeEdgeMask[index] ?? 0;
      if (previous !== 0 && nodeCellIds[index] === null) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", cell.x, cell.y, "ROUTE_MASK_CONFLICT", edge.id);
      routeEdgeMask[index] = previous | (1 << edgeIndex);
    }
    return { id: edge.id, from: edge.from, to: edge.to, cells };
  });
  return { routeEdgeMask, nodeCellIds, edgePaths };
}

export type IceGrandExpanseContract = {
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly componentCount: number;
  readonly cyclomaticNumber: number;
  readonly cycleSignatures: readonly (readonly IceGrandExpanseNodeId[])[];
};

function neighboringIndexes(index: number): readonly number[] {
  const x = index % ICE_GRAND_EXPANSE_WIDTH;
  const y = Math.floor(index / ICE_GRAND_EXPANSE_WIDTH);
  const neighbors: number[] = [];
  if (x > 0) neighbors.push(index - 1);
  if (x + 1 < ICE_GRAND_EXPANSE_WIDTH) neighbors.push(index + 1);
  if (y > 0) neighbors.push(index - ICE_GRAND_EXPANSE_WIDTH);
  if (y + 1 < ICE_GRAND_EXPANSE_HEIGHT) neighbors.push(index + ICE_GRAND_EXPANSE_WIDTH);
  return neighbors;
}

function deriveMaskEdge(topology: IceGrandExpanseTopology, masks: Uint16Array, edgeIndex: number): (typeof ICE_GRAND_EXPANSE_ROUTE_EDGES)[number] {
  const edge = ICE_GRAND_EXPANSE_ROUTE_EDGES[edgeIndex];
  if (edge === undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", 0, 0, "EDGE_LABEL_MISSING");
  const bit = 1 << edgeIndex;
  const cells: number[] = [];
  for (let index = 0; index < masks.length; index += 1) if (((masks[index] ?? 0) & bit) !== 0) cells.push(index);
  const first = cells[0];
  if (first === undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", 0, 0, "CORRIDOR_LABEL_EMPTY", edge.id);
  const seen = new Set<number>([first]);
  const queue = [first];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (current === undefined) continue;
    for (const neighbor of neighboringIndexes(current)) if (!seen.has(neighbor) && ((masks[neighbor] ?? 0) & bit) !== 0) { seen.add(neighbor); queue.push(neighbor); }
  }
  const nodeIds = new Set<IceGrandExpanseNodeId>();
  for (const cell of cells) {
    const nodeId = topology.nodeCellIds[cell] ?? null;
    if (nodeId !== null) nodeIds.add(nodeId);
    else if ((masks[cell] ?? 0) !== bit || neighboringIndexes(cell).filter((neighbor) => ((masks[neighbor] ?? 0) & bit) !== 0).length !== 2) {
      throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", cell % ICE_GRAND_EXPANSE_WIDTH, Math.floor(cell / ICE_GRAND_EXPANSE_WIDTH), "CORRIDOR_NOT_MAXIMAL", edge.id);
    }
  }
  if (seen.size !== cells.length || nodeIds.size !== 2 || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
    throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", first % ICE_GRAND_EXPANSE_WIDTH, Math.floor(first / ICE_GRAND_EXPANSE_WIDTH), "CORRIDOR_ENDPOINT_MISMATCH", edge.id);
  }
  return edge;
}

function graphComponentCount(edges: readonly (typeof ICE_GRAND_EXPANSE_ROUTE_EDGES)[number][]): number {
  const unseen = new Set<IceGrandExpanseNodeId>(edges.flatMap((edge) => [edge.from, edge.to]));
  let count = 0;
  while (unseen.size > 0) {
    const start = unseen.values().next().value;
    if (start === undefined) break;
    count += 1;
    const stack: IceGrandExpanseNodeId[] = [start];
    unseen.delete(start);
    for (let index = 0; index < stack.length; index += 1) for (const edge of edges) {
      const node = stack[index];
      const neighbor = edge.from === node ? edge.to : edge.to === node ? edge.from : null;
      if (neighbor !== null && unseen.delete(neighbor)) stack.push(neighbor);
    }
  }
  return count;
}

export function contractIceGrandExpanseTopology(
  topology: IceGrandExpanseTopology,
  omittedEdgeId?: IceGrandExpanseRouteEdgeId,
): IceGrandExpanseContract {
  const omittedIndex = ICE_GRAND_EXPANSE_ROUTE_EDGES.findIndex((edge) => edge.id === omittedEdgeId);
  const omittedBit = omittedIndex < 0 ? 0 : 1 << omittedIndex;
  const masks = topology.routeEdgeMask.map((mask) => mask & ~omittedBit);
  for (let index = 0; index < masks.length; index += 1) {
    const mask = masks[index] ?? 0;
    if (mask === 0) continue;
    for (const neighbor of neighboringIndexes(index).filter((candidate) => candidate > index)) {
      const neighborMask = masks[neighbor] ?? 0;
      if (neighborMask === 0 || (mask & neighborMask) !== 0) continue;
      const nodeId = topology.nodeCellIds[index] ?? null;
      if (nodeId === null || nodeId !== (topology.nodeCellIds[neighbor] ?? null)) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", index % ICE_GRAND_EXPANSE_WIDTH, Math.floor(index / ICE_GRAND_EXPANSE_WIDTH), "CROSS_LABEL_CONTACT");
    }
  }
  const edges = ICE_GRAND_EXPANSE_ROUTE_EDGES.filter((edge) => edge.id !== omittedEdgeId).map((edge) => deriveMaskEdge(topology, masks, ICE_GRAND_EXPANSE_ROUTE_EDGES.indexOf(edge)));
  const vertexIds = new Set<IceGrandExpanseNodeId>(edges.flatMap((edge) => [edge.from, edge.to]));
  const componentCount = graphComponentCount(edges);
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const cycleSignatures = ICE_GRAND_EXPANSE_CYCLES
    .filter((cycle) => cycle.edgeIds.every((edgeId) => edgeIds.has(edgeId)))
    .map((cycle) => cycle.signature);
  return {
    vertexCount: vertexIds.size,
    edgeCount: edges.length,
    componentCount, cyclomaticNumber: edges.length - vertexIds.size + componentCount,
    cycleSignatures,
  };
}

function assertPassableAnchor(project: Project, map: GameMap, point: IceGrandExpansePoint, reason: string): void {
  if (!isPassable(project, map, point.x, point.y)) throw new IceGrandExpanseTopologyError("ANCHOR_BLOCKED", point.x, point.y, reason);
}

export function reachableIceGrandExpanseCells(project: Project, map: GameMap): ReadonlySet<number> {
  const startIndex = ICE_GRAND_EXPANSE_START.y * map.width + ICE_GRAND_EXPANSE_START.x;
  const seen = new Set<number>([startIndex]);
  const queue: IceGrandExpansePoint[] = [{ ...ICE_GRAND_EXPANSE_START }];
  for (let head = 0; head < queue.length; head += 1) {
    const point = queue[head];
    if (point === undefined) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      const index = next.y * map.width + next.x;
      if (seen.has(index) || !canMove(project, map, point.x, point.y, next.x, next.y)) continue;
      seen.add(index);
      queue.push(next);
    }
  }
  return seen;
}

export type IceGrandExpanseTopologyValidation = IceGrandExpanseMaterialAudit & { readonly start: IceGrandExpansePoint; readonly passableCells: number; readonly reachablePassableCells: number; readonly reachablePassableRatio: number; readonly reachedNodeIds: readonly IceGrandExpanseNodeId[]; readonly reachedRegionIds: readonly (typeof ICE_GRAND_EXPANSE_REGIONS)[number]["id"][]; readonly reachedTargetIds: readonly IceGrandExpanseBfsTargetId[]; readonly bossReached: boolean; readonly contract: IceGrandExpanseContract };

export function validateIceGrandExpanseTopology(project: Project, map: GameMap, topology: IceGrandExpanseTopology): IceGrandExpanseTopologyValidation {
  assertPassableAnchor(project, map, ICE_GRAND_EXPANSE_START, "START_NOT_PASSABLE");
  for (const node of ICE_GRAND_EXPANSE_NODES) assertPassableAnchor(project, map, node.anchor, `NODE_NOT_PASSABLE:${node.id}`);
  for (const region of ICE_GRAND_EXPANSE_REGIONS) assertPassableAnchor(project, map, region.anchor, `REGION_NOT_PASSABLE:${region.id}`);
  const reachable = reachableIceGrandExpanseCells(project, map);
  const reachedNodeIds = ICE_GRAND_EXPANSE_NODES.filter((node) => reachable.has(node.anchor.y * map.width + node.anchor.x)).map((node) => node.id);
  const reachedRegionIds = ICE_GRAND_EXPANSE_REGIONS.filter((region) => reachable.has(region.anchor.y * map.width + region.anchor.x)).map((region) => region.id);
  const reachedTargetIds = ICE_GRAND_EXPANSE_BFS_TARGETS.filter((target) => reachable.has(target.anchor.y * map.width + target.anchor.x)).map((target) => target.id);
  const bossReached = reachedTargetIds.includes("boss");
  const missingNode = ICE_GRAND_EXPANSE_NODES.find((node) => !reachedNodeIds.includes(node.id));
  if (missingNode !== undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", missingNode.anchor.x, missingNode.anchor.y, `NODE_NOT_REACHED:${missingNode.id}`);
  const missingRegion = ICE_GRAND_EXPANSE_REGIONS.find((region) => !reachedRegionIds.includes(region.id));
  if (missingRegion !== undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", missingRegion.anchor.x, missingRegion.anchor.y, `REGION_NOT_REACHED:${missingRegion.id}`);
  if (!bossReached) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", ICE_GRAND_EXPANSE_BOSS.x, ICE_GRAND_EXPANSE_BOSS.y, "BOSS_NOT_REACHED");
  const materialAudit = auditIceGrandExpanseMaterial(project, map, topology.routeEdgeMask);
  const weakRoute = materialAudit.routeMaterialCoverage.find((coverage) => coverage.materialRatio < 0.9);
  if (weakRoute !== undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", 0, 0, "ROUTE_MATERIAL_COVERAGE", weakRoute.id);
  const blockedBridge = materialAudit.bridgeAudits.find((audit) => audit.bridgeCells === 0 || audit.traversableBridgeCells !== audit.bridgeCells);
  if (blockedBridge !== undefined) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", 64, blockedBridge.ridgeId === "r03-central-gate" ? 84 : 10, `BRIDGE_COLLISION:${blockedBridge.ridgeId}`);
  if (materialAudit.passableCellsOutsideDesignBuffer !== 0) throw new IceGrandExpanseTopologyError("ROUTE_UNREACHABLE", 0, 0, "PASSABLE_SPACE_OUTSIDE_DESIGN_BUFFER");
  let passableCells = 0;
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) if (isPassable(project, map, x, y)) passableCells += 1;
  return {
    start: ICE_GRAND_EXPANSE_START,
    passableCells,
    reachablePassableCells: reachable.size,
    reachablePassableRatio: reachable.size / passableCells,
    reachedNodeIds,
    reachedRegionIds,
    reachedTargetIds,
    bossReached,
    ...materialAudit,
    contract: contractIceGrandExpanseTopology(topology),
  };
}

export const ICE_GRAND_EXPANSE_TOPOLOGY_SIZE = { width: ICE_GRAND_EXPANSE_WIDTH, height: ICE_GRAND_EXPANSE_HEIGHT } as const;
