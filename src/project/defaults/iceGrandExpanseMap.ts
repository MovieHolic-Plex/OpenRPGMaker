import { canMove, isPassable } from "@/project/collision";
import { iceDiagonalRole } from "@/project/defaults/iceDiagonalTerrain";
import {
  ICE_GRAND_EXPANSE_BOSS,
  ICE_GRAND_EXPANSE_HEIGHT,
  ICE_GRAND_EXPANSE_MAP_ID,
  ICE_GRAND_EXPANSE_MAP_NAME,
  ICE_GRAND_EXPANSE_REGION_BASES,
  ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN,
  ICE_GRAND_EXPANSE_WIDTH,
} from "@/project/defaults/iceGrandExpansePlan";
import { buildIceGrandExpanseTerrain } from "@/project/defaults/iceGrandExpanseTerrain";
import type { GameMap, Project, TilesetId } from "@/project/types";

export type IceGrandExpansePoint = { readonly x: number; readonly y: number };
type NodeBounds = IceGrandExpansePoint & { readonly width: number; readonly height: number };

export const ICE_GRAND_EXPANSE_REGIONS = [
  { id: "south-camp", label: "남쪽 원정 기지", anchor: { x: 64, y: 119 } },
  { id: "twin-fang", label: "쌍아 능선", anchor: { x: 64, y: 106 } },
  { id: "central-gate", label: "중앙 빙문", anchor: { x: 64, y: 92 } },
  { id: "west-mine", label: "서쪽 수정 광맥", anchor: { x: 40, y: 82 } },
  { id: "mirror-lake", label: "거울 호수", anchor: { x: 64, y: 71 } },
  { id: "east-cliff", label: "동쪽 빙절벽", anchor: { x: 98, y: 58 } },
  { id: "crown-switchbacks", label: "왕관 굽잇길", anchor: { x: 64, y: 50 } },
  { id: "dragon-altar", label: "빙룡 제단", anchor: { x: 64, y: 21 } },
] as const;

export const ICE_GRAND_EXPANSE_NODES = [
  { id: "camp", anchor: { x: 64, y: 117 }, bounds: { x: 60, y: 114, width: 9, height: 7 } },
  { id: "west-fork", anchor: { x: 44, y: 96 }, bounds: { x: 41, y: 93, width: 7, height: 7 } },
  { id: "gate-hub", anchor: { x: 64, y: 84 }, bounds: { x: 60, y: 81, width: 9, height: 7 } },
  { id: "east-fork", anchor: { x: 79, y: 96 }, bounds: { x: 76, y: 93, width: 7, height: 7 } },
  { id: "west-seal", anchor: { x: 28, y: 63 }, bounds: { x: 25, y: 60, width: 7, height: 7 } },
  { id: "lake-north", anchor: { x: 64, y: 49 }, bounds: { x: 60, y: 43, width: 9, height: 10 } },
  { id: "east-seal", anchor: { x: 100, y: 62 }, bounds: { x: 97, y: 59, width: 7, height: 7 } },
  { id: "crown-west", anchor: { x: 40, y: 38 }, bounds: { x: 37, y: 35, width: 7, height: 7 } },
  { id: "summit-checkpoint", anchor: { x: 64, y: 25 }, bounds: { x: 60, y: 22, width: 9, height: 7 } },
  { id: "crown-east", anchor: { x: 88, y: 38 }, bounds: { x: 85, y: 35, width: 7, height: 7 } },
] as const satisfies readonly { readonly id: string; readonly anchor: IceGrandExpansePoint; readonly bounds: NodeBounds }[];

export type IceGrandExpanseNodeId = (typeof ICE_GRAND_EXPANSE_NODES)[number]["id"];

export const ICE_GRAND_EXPANSE_BFS_TARGETS = [
  ...ICE_GRAND_EXPANSE_NODES.map((node) => ({ id: node.id, anchor: node.anchor })),
  { id: "boss", anchor: ICE_GRAND_EXPANSE_BOSS },
] as const;

export type IceGrandExpanseBfsTargetId = (typeof ICE_GRAND_EXPANSE_BFS_TARGETS)[number]["id"];

export const ICE_GRAND_EXPANSE_ROUTE_EDGES = [
  { id: "c1-camp-west-fork", from: "camp", to: "west-fork", waypoints: [[64, 117], [60, 117], [47, 117], [47, 96], [44, 96]] },
  { id: "c1-west-fork-gate-hub", from: "west-fork", to: "gate-hub", waypoints: [[44, 96], [41, 96], [40, 96], [40, 85], [60, 85], [64, 85], [64, 84]] },
  { id: "c1-gate-hub-east-fork", from: "gate-hub", to: "east-fork", waypoints: [[64, 84], [64, 85], [68, 85], [90, 85], [90, 96], [82, 96], [79, 96]] },
  { id: "c1-east-fork-camp", from: "east-fork", to: "camp", waypoints: [[79, 96], [79, 114], [68, 114], [68, 117], [64, 117]] },
  { id: "c2-gate-hub-west-seal", from: "gate-hub", to: "west-seal", waypoints: [[64, 84], [64, 73], [24, 73], [24, 63], [28, 63]] },
  { id: "c2-west-seal-lake-north", from: "west-seal", to: "lake-north", waypoints: [[28, 63], [28, 60], [23, 60], [23, 49], [60, 49], [64, 49]] },
  { id: "c2-lake-north-east-seal", from: "lake-north", to: "east-seal", waypoints: [[64, 49], [68, 49], [100, 49], [100, 62]] },
  { id: "c2-east-seal-gate-hub", from: "east-seal", to: "gate-hub", waypoints: [[100, 62], [104, 62], [104, 71], [68, 71], [68, 84], [64, 84]] },
  { id: "c3-lake-north-crown-west", from: "lake-north", to: "crown-west", waypoints: [[64, 49], [64, 43], [40, 43], [40, 38]] },
  { id: "c3-crown-west-summit", from: "crown-west", to: "summit-checkpoint", waypoints: [[40, 38], [43, 38], [56, 38], [56, 25], [60, 25], [64, 25]] },
  { id: "c3-summit-crown-east", from: "summit-checkpoint", to: "crown-east", waypoints: [[64, 25], [68, 25], [71, 25], [71, 38], [84, 38], [88, 38]] },
  { id: "c3-crown-east-lake-north", from: "crown-east", to: "lake-north", waypoints: [[88, 38], [88, 40], [73, 40], [73, 43], [64, 43], [64, 49]] },
] as const satisfies readonly { readonly id: string; readonly from: IceGrandExpanseNodeId; readonly to: IceGrandExpanseNodeId; readonly waypoints: readonly (readonly [number, number])[] }[];

export type IceGrandExpanseRouteEdgeId = (typeof ICE_GRAND_EXPANSE_ROUTE_EDGES)[number]["id"];

export const ICE_GRAND_EXPANSE_CYCLES = [
  { id: "south-loop", edgeIds: ["c1-camp-west-fork", "c1-west-fork-gate-hub", "c1-gate-hub-east-fork", "c1-east-fork-camp"], signature: ["camp", "west-fork", "gate-hub", "east-fork", "camp"] },
  { id: "lake-loop", edgeIds: ["c2-gate-hub-west-seal", "c2-west-seal-lake-north", "c2-lake-north-east-seal", "c2-east-seal-gate-hub"], signature: ["gate-hub", "west-seal", "lake-north", "east-seal", "gate-hub"] },
  { id: "crown-loop", edgeIds: ["c3-lake-north-crown-west", "c3-crown-west-summit", "c3-summit-crown-east", "c3-crown-east-lake-north"], signature: ["lake-north", "crown-west", "summit-checkpoint", "crown-east", "lake-north"] },
] as const satisfies readonly { readonly id: string; readonly edgeIds: readonly IceGrandExpanseRouteEdgeId[]; readonly signature: readonly IceGrandExpanseNodeId[] }[];

export const ICE_GRAND_EXPANSE_SHORTCUTS = [
  { id: "lake-shortcut", a: { x: 45, y: 60 }, b: { x: 79, y: 60 }, unlock: "both-seals" },
  { id: "crown-shortcut", a: { x: 60, y: 38 }, b: { x: 76, y: 37 }, unlock: "summit-checkpoint" },
] as const;

export type IceGrandExpanseShortcutId = (typeof ICE_GRAND_EXPANSE_SHORTCUTS)[number]["id"];

export type IceGrandExpanseShortcutState = { readonly bothSealsOpen: boolean; readonly summitCheckpointActive: boolean };

export function shortcutDestination(id: IceGrandExpanseShortcutId, from: IceGrandExpansePoint, state: IceGrandExpanseShortcutState): IceGrandExpansePoint | null {
  const shortcut = ICE_GRAND_EXPANSE_SHORTCUTS.find((candidate) => candidate.id === id);
  if (shortcut === undefined) return null;
  const unlocked = shortcut.unlock === "both-seals" ? state.bothSealsOpen : state.summitCheckpointActive;
  if (!unlocked) return null;
  if (from.x === shortcut.a.x && from.y === shortcut.a.y) return shortcut.b;
  if (from.x === shortcut.b.x && from.y === shortcut.b.y) return shortcut.a;
  return null;
}

export type IceGrandExpanseReference = {
  readonly tilesetId: TilesetId;
  readonly tileSize: number;
};

export type IceGrandExpanseRouteMaterialCoverage = { readonly id: IceGrandExpanseRouteEdgeId; readonly labelledCells: number; readonly materialRatio: number; readonly collisionRatio: number };
export type IceGrandExpanseBridgeAudit = { readonly ridgeId: "r03-central-gate" | "r14-altar-ring"; readonly bridgeCells: number; readonly traversableBridgeCells: number };
export type IceGrandExpanseMaterialAudit = { readonly routeMaterialCoverage: readonly IceGrandExpanseRouteMaterialCoverage[]; readonly passableCellsOutsideDesignBuffer: number; readonly bridgeAudits: readonly IceGrandExpanseBridgeAudit[] };

const BRIDGE_AUDIT_CONNECTORS = [
  { ridgeId: "r03-central-gate", connectorId: "central-gate-connector" },
  { ridgeId: "r14-altar-ring", connectorId: "summit-boss-connector" },
] as const;

export function auditIceGrandExpanseMaterial(project: Project, map: GameMap, routeEdgeMask: Uint16Array): IceGrandExpanseMaterialAudit {
  const terrain = buildIceGrandExpanseTerrain();
  const routeMaterialCoverage = ICE_GRAND_EXPANSE_ROUTE_EDGES.map((edge, edgeIndex): IceGrandExpanseRouteMaterialCoverage => {
    const bit = 1 << edgeIndex;
    let labelledCells = 0;
    let materialCells = 0;
    let collisionCells = 0;
    for (let index = 0; index < routeEdgeMask.length; index += 1) if (((routeEdgeMask[index] ?? 0) & bit) !== 0) {
      labelledCells += 1;
      if (terrain.routeMaterialMask[index] === 1) materialCells += 1;
      if (isPassable(project, map, index % map.width, Math.floor(index / map.width))) collisionCells += 1;
    }
    return { id: edge.id, labelledCells, materialRatio: labelledCells === 0 ? 0 : materialCells / labelledCells, collisionRatio: labelledCells === 0 ? 0 : collisionCells / labelledCells };
  });
  let passableCellsOutsideDesignBuffer = 0;
  for (let index = 0; index < routeEdgeMask.length; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const designed = terrain.passableMaterialMask[index] === 1 || terrain.routeMaterialMask[index] === 1 || terrain.nodeMaterialMask[index] === 1 || terrain.regionMaterialMask[index] === 1 || terrain.basinMaterialMask[index] === 1;
    if (!designed && isPassable(project, map, x, y)) passableCellsOutsideDesignBuffer += 1;
  }
  const bridgeAudits = BRIDGE_AUDIT_CONNECTORS.map(({ ridgeId, connectorId }): IceGrandExpanseBridgeAudit => {
    const connector = ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.connectors.find((candidate) => candidate.id === connectorId);
    if (connector === undefined) return { ridgeId, bridgeCells: 0, traversableBridgeCells: 0 };
    let bridgeCells = 0;
    let traversableBridgeCells = 0;
    for (let y = connector.y; y < connector.y + connector.height; y += 1) {
      const index = y * map.width + connector.x;
      if (iceDiagonalRole(map.lowerTiles[index] ?? -1) === null) continue;
      bridgeCells += 1;
      if ((map.upperTiles[index] ?? -1) !== -1 && isPassable(project, map, connector.x, y) && canMove(project, map, connector.x, y - 1, connector.x, y) && canMove(project, map, connector.x, y, connector.x, y + 1)) traversableBridgeCells += 1;
    }
    return { ridgeId, bridgeCells, traversableBridgeCells };
  });
  return { routeMaterialCoverage, passableCellsOutsideDesignBuffer, bridgeAudits };
}

export function buildIceGrandExpanseMap(reference: IceGrandExpanseReference): GameMap {
  const terrain = buildIceGrandExpanseTerrain();
  return {
    id: ICE_GRAND_EXPANSE_MAP_ID,
    name: ICE_GRAND_EXPANSE_MAP_NAME,
    width: ICE_GRAND_EXPANSE_WIDTH,
    height: ICE_GRAND_EXPANSE_HEIGHT,
    tilesetId: reference.tilesetId,
    tileSize: reference.tileSize,
    lowerTiles: [...terrain.lowerTiles],
    upperTiles: [...terrain.upperTiles],
    events: [],
    encounterRate: 0,
    layoutPlan: {
      version: 1,
      kind: "ice-grand-expanse",
      seed: 20260722,
      regions: ICE_GRAND_EXPANSE_REGION_BASES.map((base, index) => ({
        id: base.id,
        role: index === ICE_GRAND_EXPANSE_REGION_BASES.length - 1 ? "boss" : "expedition-region",
        label: ICE_GRAND_EXPANSE_REGIONS[index]?.label ?? base.id,
        x: base.x,
        y: base.y,
        w: base.width,
        h: base.height,
      })),
      roadAnchors: ICE_GRAND_EXPANSE_BFS_TARGETS.map((target) => ({ id: target.id, ...target.anchor })),
      notes: "map_g_ice_grand의 정본 대각 빙벽을 열네 능선과 세 순환 원정로로 확장한 128×128 빙결 던전.",
    },
  };
}
