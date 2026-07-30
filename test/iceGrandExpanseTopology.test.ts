import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canMove, isPassable } from "@/project/collision";
import { iceDiagonalRole } from "@/project/defaults/iceDiagonalTerrain";
import { createBlankProject } from "@/project/defaults";
import {
  buildIceGrandExpanseMap,
  type IceGrandExpanseReference,
} from "@/project/defaults/iceGrandExpanseMap";
import {
  contractIceGrandExpanseTopology,
  createIceGrandExpanseTopology,
  ICE_GRAND_EXPANSE_CYCLES,
  ICE_GRAND_EXPANSE_NODES,
  ICE_GRAND_EXPANSE_REGIONS,
  ICE_GRAND_EXPANSE_ROUTE_EDGES,
  ICE_GRAND_EXPANSE_SHORTCUTS,
  IceGrandExpanseTopologyError,
  reachableIceGrandExpanseCells,
  shortcutDestination,
  validateIceGrandExpanseTopology,
} from "@/project/defaults/iceGrandExpanseTopology";
import {
  ICE_GRAND_EXPANSE_BOSS,
  ICE_GRAND_EXPANSE_GATE_GEOMETRY,
  ICE_GRAND_EXPANSE_MAP_ID,
  ICE_GRAND_EXPANSE_MAP_NAME,
  ICE_GRAND_EXPANSE_START,
  ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN,
} from "@/project/defaults/iceGrandExpansePlan";
import { buildIceGrandExpanseTerrain } from "@/project/defaults/iceGrandExpanseTerrain";
import type { GameMap, Project } from "@/project/types";

const sha256 = (value: object): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function referenceFixture(): IceGrandExpanseReference {
  return { tilesetId: "easyrpg_chipset_dungeon", tileSize: 16 };
}

function geometryFixture(): { readonly map: GameMap; readonly project: Project } {
  const project = createBlankProject();
  const map = buildIceGrandExpanseMap(referenceFixture());
  project.maps[map.id] = map;
  return { map, project };
}

function expectTopologyError(
  action: () => void,
  expected: { readonly code: IceGrandExpanseTopologyError["code"]; readonly x: number; readonly y: number; readonly reason: string },
): void {
  try {
    action();
    throw new Error(`Expected ${expected.code}`);
  } catch (error) {
    if (!(error instanceof IceGrandExpanseTopologyError)) throw error;
    expect({ code: error.code, x: error.x, y: error.y, reason: error.reason }).toEqual(expected);
    expect(error.message.length).toBeLessThan(180);
  }
}

function nonNodeCrossLabelContacts(topology: ReturnType<typeof createIceGrandExpanseTopology>): readonly string[] {
  const contacts: string[] = [];
  for (let index = 0; index < topology.routeEdgeMask.length; index += 1) {
    const mask = topology.routeEdgeMask[index] ?? 0;
    if (mask === 0) continue;
    const x = index % 128;
    const y = Math.floor(index / 128);
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const neighborIndex = (y + dy) * 128 + x + dx;
      const neighborMask = topology.routeEdgeMask[neighborIndex] ?? 0;
      if (neighborMask === 0 || (mask & neighborMask) !== 0) continue;
      const nodeId = topology.nodeCellIds[index] ?? null;
      const neighborNodeId = topology.nodeCellIds[neighborIndex] ?? null;
      if (nodeId !== null && nodeId === neighborNodeId) continue;
      contacts.push(`${x},${y}:${mask}|${x + dx},${y + dy}:${neighborMask}`);
    }
  }
  return contacts;
}

describe("ice grand expanse geometry topology", () => {
  it("freezes the map, eight regions, ten graph nodes, twelve directed edges, and three cycles", () => {
    // Given / When
    const map = buildIceGrandExpanseMap(referenceFixture());

    // Then
    expect({ id: map.id, name: map.name, width: map.width, height: map.height }).toEqual({
      id: ICE_GRAND_EXPANSE_MAP_ID,
      name: ICE_GRAND_EXPANSE_MAP_NAME,
      width: 128,
      height: 128,
    });
    expect(ICE_GRAND_EXPANSE_REGIONS.map((region) => [region.id, region.anchor])).toEqual([
      ["south-camp", { x: 64, y: 119 }],
      ["twin-fang", { x: 64, y: 106 }],
      ["central-gate", { x: 64, y: 92 }],
      ["west-mine", { x: 40, y: 82 }],
      ["mirror-lake", { x: 64, y: 71 }],
      ["east-cliff", { x: 98, y: 58 }],
      ["crown-switchbacks", { x: 64, y: 50 }],
      ["dragon-altar", { x: 64, y: 21 }],
    ]);
    expect(ICE_GRAND_EXPANSE_NODES.map((node) => [node.id, node.anchor])).toEqual([
      ["camp", { x: 64, y: 117 }],
      ["west-fork", { x: 44, y: 96 }],
      ["gate-hub", { x: 64, y: 84 }],
      ["east-fork", { x: 79, y: 96 }],
      ["west-seal", { x: 28, y: 63 }],
      ["lake-north", { x: 64, y: 49 }],
      ["east-seal", { x: 100, y: 62 }],
      ["crown-west", { x: 40, y: 38 }],
      ["summit-checkpoint", { x: 64, y: 25 }],
      ["crown-east", { x: 88, y: 38 }],
    ]);
    expect(ICE_GRAND_EXPANSE_NODES.map((node) => ({ id: node.id, ...node.bounds }))).toEqual(
      ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.nodes,
    );
    expect(ICE_GRAND_EXPANSE_ROUTE_EDGES.map((edge) => [edge.id, edge.from, edge.to])).toEqual([
      ["c1-camp-west-fork", "camp", "west-fork"],
      ["c1-west-fork-gate-hub", "west-fork", "gate-hub"],
      ["c1-gate-hub-east-fork", "gate-hub", "east-fork"],
      ["c1-east-fork-camp", "east-fork", "camp"],
      ["c2-gate-hub-west-seal", "gate-hub", "west-seal"],
      ["c2-west-seal-lake-north", "west-seal", "lake-north"],
      ["c2-lake-north-east-seal", "lake-north", "east-seal"],
      ["c2-east-seal-gate-hub", "east-seal", "gate-hub"],
      ["c3-lake-north-crown-west", "lake-north", "crown-west"],
      ["c3-crown-west-summit", "crown-west", "summit-checkpoint"],
      ["c3-summit-crown-east", "summit-checkpoint", "crown-east"],
      ["c3-crown-east-lake-north", "crown-east", "lake-north"],
    ]);
    expect(ICE_GRAND_EXPANSE_CYCLES.map((cycle) => cycle.signature)).toEqual([
      ["camp", "west-fork", "gate-hub", "east-fork", "camp"],
      ["gate-hub", "west-seal", "lake-north", "east-seal", "gate-hub"],
      ["lake-north", "crown-west", "summit-checkpoint", "crown-east", "lake-north"],
    ]);
    const roadAnchors = map.layoutPlan?.roadAnchors ?? [];
    expect(map.layoutPlan?.regions).toHaveLength(8);
    expect(roadAnchors).toHaveLength(11);
    expect(roadAnchors.at(-1)).toEqual({ id: "boss", ...ICE_GRAND_EXPANSE_BOSS });
  });

  it("contracts the canonical route mask into exactly V10 E12 and three independent cycles", () => {
    // Given
    const { map, project } = geometryFixture();

    // When
    const topology = createIceGrandExpanseTopology(map);
    const contract = contractIceGrandExpanseTopology(topology);

    // Then
    expect(topology.routeEdgeMask).toHaveLength(16_384);
    expect(contract).toMatchObject({ vertexCount: 10, edgeCount: 12, componentCount: 1, cyclomaticNumber: 3 });
    expect(contract.cycleSignatures).toEqual(ICE_GRAND_EXPANSE_CYCLES.map((cycle) => cycle.signature));
    for (let index = 0; index < topology.routeEdgeMask.length; index += 1) {
      const mask = topology.routeEdgeMask[index] ?? 0;
      if (mask === 0 || topology.nodeCellIds[index] !== null) continue;
      expect(mask & (mask - 1), `non-node route overlap at ${index}`).toBe(0);
    }
    for (const edge of ICE_GRAND_EXPANSE_ROUTE_EDGES) {
      const withoutEdge = contractIceGrandExpanseTopology(topology, edge.id);
      const declaredCycle = ICE_GRAND_EXPANSE_CYCLES.find((cycle) => cycle.edgeIds.some((edgeId) => edgeId === edge.id));
      if (declaredCycle === undefined) throw new Error(`Missing cycle for ${edge.id}`);
      expect(withoutEdge.componentCount).toBe(1);
      expect(withoutEdge.cyclomaticNumber).toBe(2);
      expect(withoutEdge.cycleSignatures).toEqual(
        ICE_GRAND_EXPANSE_CYCLES.filter((cycle) => cycle.id !== declaredCycle.id).map((cycle) => cycle.signature),
      );
    }
    expect(validateIceGrandExpanseTopology(project, map, topology).contract).toEqual(contract);
  });

  it("derives contraction from routeEdgeMask rather than trusting declared edge paths", () => {
    // Given
    const map = buildIceGrandExpanseMap(referenceFixture());
    const topology = createIceGrandExpanseTopology(map);

    // When
    const contract = contractIceGrandExpanseTopology({ ...topology, edgePaths: [] });

    // Then
    expect(contract).toMatchObject({ vertexCount: 10, edgeCount: 12, componentCount: 1, cyclomaticNumber: 3 });
    expect(contract.cycleSignatures).toEqual(ICE_GRAND_EXPANSE_CYCLES.map((cycle) => cycle.signature));
  });

  it("has no cross-label orthogonal adjacency outside a shared named node", () => {
    // Given
    const map = buildIceGrandExpanseMap(referenceFixture());

    // When
    const contacts = nonNodeCrossLabelContacts(createIceGrandExpanseTopology(map));

    // Then
    expect(contacts, "c2 y82 must not touch c3 y83 or unrelated corridors").toEqual([]);
  });

  it("audits actual material, collision buffer, and every BFS target in the all-open geometry", () => {
    // Given
    const { map, project } = geometryFixture();
    const topology = createIceGrandExpanseTopology(map);

    // When
    const result = validateIceGrandExpanseTopology(project, map, topology);

    // Then
    expect(result.start).toEqual(ICE_GRAND_EXPANSE_START);
    expect(result.reachedNodeIds).toEqual(ICE_GRAND_EXPANSE_NODES.map((node) => node.id));
    expect(result.reachedRegionIds).toEqual(ICE_GRAND_EXPANSE_REGIONS.map((region) => region.id));
    expect(result.reachedTargetIds).toEqual([...ICE_GRAND_EXPANSE_NODES.map((node) => node.id), "boss"]);
    expect(result.bossReached).toBe(true);
    expect(result.routeMaterialCoverage).toHaveLength(12);
    for (const coverage of result.routeMaterialCoverage) {
      expect(coverage.materialRatio, `${coverage.id}:material`).toBeGreaterThanOrEqual(0.9);
      expect(coverage.collisionRatio, `${coverage.id}:collision`).toBeGreaterThan(0);
      expect(coverage.collisionRatio, `${coverage.id}:collision`).toBeLessThanOrEqual(1);
    }
    expect(result.routeMaterialCoverage.find((coverage) => coverage.id === "c1-west-fork-gate-hub")?.collisionRatio).toBe(1);
    expect(result.passableCellsOutsideDesignBuffer).toBe(0);
    expect(result.bridgeAudits.map((audit) => audit.ridgeId)).toEqual(["r03-central-gate", "r14-altar-ring"]);
    for (const audit of result.bridgeAudits) {
      expect(audit.bridgeCells, `${audit.ridgeId}:bridge cells`).toBeGreaterThan(0);
      expect(audit.traversableBridgeCells).toBe(audit.bridgeCells);
    }
    expect(result.reachablePassableRatio).toBeGreaterThanOrEqual(0.9);
    expect(isPassable(project, map, ICE_GRAND_EXPANSE_START.x, ICE_GRAND_EXPANSE_START.y)).toBe(true);
  });

  it("uses real upper-tile collision for the r03 and r14 bridge openings", () => {
    // Given
    const { map, project } = geometryFixture();
    const bridgeConnectors = [["r03-central-gate", "central-gate-connector"], ["r14-altar-ring", "summit-boss-connector"]] as const;

    // When / Then
    for (const [ridgeId, connectorId] of bridgeConnectors) {
      const connector = ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.connectors.find((candidate) => candidate.id === connectorId);
      if (connector === undefined) throw new Error(`Missing ${connectorId}`);
      const bridged = Array.from({ length: connector.height }, (_, offset) => connector.y + offset)
        .filter((y) => iceDiagonalRole(map.lowerTiles[y * map.width + connector.x] ?? -1) !== null);
      expect(bridged.length, ridgeId).toBeGreaterThan(0);
      for (const y of bridged) {
        expect(map.upperTiles[y * map.width + connector.x], `${ridgeId}:${y}:upper`).not.toBe(-1);
        expect(isPassable(project, map, connector.x, y), `${ridgeId}:${y}:passable`).toBe(true);
        expect(canMove(project, map, connector.x, y - 1, connector.x, y), `${ridgeId}:${y}:enter`).toBe(true);
        expect(canMove(project, map, connector.x, y, connector.x, y + 1), `${ridgeId}:${y}:exit`).toBe(true);
      }
    }
  });

  it("keeps both seals south of the locked crown gate and opens the full north route", () => {
    // Given
    const { map, project } = geometryFixture();
    const gateIndex = ICE_GRAND_EXPANSE_GATE_GEOMETRY.event.y * map.width + ICE_GRAND_EXPANSE_GATE_GEOMETRY.event.x;
    const openLower = map.lowerTiles[gateIndex];
    const openUpper = map.upperTiles[gateIndex];
    map.lowerTiles[gateIndex] = 372;
    map.upperTiles[gateIndex] = -1;

    // When
    const closed = reachableIceGrandExpanseCells(project, map);
    map.lowerTiles[gateIndex] = openLower ?? 67;
    map.upperTiles[gateIndex] = openUpper ?? -1;
    const opened = reachableIceGrandExpanseCells(project, map);

    // Then
    const targets = {
      westSeal: [28, 63], lakeNorth: [64, 49], eastSeal: [100, 62],
      crownWest: [40, 38], summit: [64, 25], crownEast: [88, 38], boss: [64, 11],
    } as const;
    const has = (cells: ReadonlySet<number>, point: readonly [number, number]): boolean => cells.has(point[1] * map.width + point[0]);
    expect(has(closed, targets.westSeal)).toBe(true);
    expect(has(closed, targets.lakeNorth)).toBe(true);
    expect(has(closed, targets.eastSeal)).toBe(true);
    expect(has(closed, targets.crownWest)).toBe(false);
    expect(has(closed, targets.summit)).toBe(false);
    expect(has(closed, targets.crownEast)).toBe(false);
    expect(has(closed, targets.boss)).toBe(false);
    for (const point of Object.values(targets)) expect(has(opened, point), point.join(",")).toBe(true);
    expect(closed.size).toBe(7_319);
    expect(opened.size).toBe(10_399);
  });

  it("rejects an all-open geometry whose boss BFS target is blocked", () => {
    // Given
    const { map, project } = geometryFixture();
    const topology = createIceGrandExpanseTopology(map);
    const bossIndex = ICE_GRAND_EXPANSE_BOSS.y * map.width + ICE_GRAND_EXPANSE_BOSS.x;
    map.lowerTiles[bossIndex] = 372;
    map.upperTiles[bossIndex] = -1;

    // When / Then
    expectTopologyError(
      () => validateIceGrandExpanseTopology(project, map, topology),
      { code: "ROUTE_UNREACHABLE", x: 64, y: 11, reason: "BOSS_NOT_REACHED" },
    );
  });

  it("keeps both same-map shortcuts closed until their exact unlock state", () => {
    // Given
    expect(ICE_GRAND_EXPANSE_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut.a, shortcut.b])).toEqual([
      ["lake-shortcut", { x: 45, y: 60 }, { x: 79, y: 60 }],
      ["crown-shortcut", { x: 60, y: 38 }, { x: 76, y: 37 }],
    ]);

    // When / Then
    expect(shortcutDestination("lake-shortcut", { x: 45, y: 60 }, { bothSealsOpen: false, summitCheckpointActive: false })).toBeNull();
    expect(shortcutDestination("lake-shortcut", { x: 45, y: 60 }, { bothSealsOpen: true, summitCheckpointActive: false })).toEqual({ x: 79, y: 60 });
    expect(shortcutDestination("crown-shortcut", { x: 60, y: 38 }, { bothSealsOpen: true, summitCheckpointActive: false })).toBeNull();
    expect(shortcutDestination("crown-shortcut", { x: 76, y: 37 }, { bothSealsOpen: false, summitCheckpointActive: true })).toEqual({ x: 60, y: 38 });
  });

  it("rejects a solid anchor with bounded ANCHOR_BLOCKED evidence", () => {
    // Given
    const { map, project } = geometryFixture();
    const topology = createIceGrandExpanseTopology(map);
    map.lowerTiles[ICE_GRAND_EXPANSE_START.y * map.width + ICE_GRAND_EXPANSE_START.x] = 372;

    // When / Then
    expectTopologyError(
      () => validateIceGrandExpanseTopology(project, map, topology),
      { code: "ANCHOR_BLOCKED", x: 64, y: 120, reason: "START_NOT_PASSABLE" },
    );
  });

  it("keeps route-mask and real-collision evidence aligned after moving the progression wall north", () => {
    // Given
    const { map, project } = geometryFixture();
    const topology = createIceGrandExpanseTopology(map);

    // When
    const result = validateIceGrandExpanseTopology(project, map, topology);
    const westGate = result.routeMaterialCoverage.find((coverage) => coverage.id === "c1-west-fork-gate-hub");

    // Then
    expect(westGate?.materialRatio).toBe(1);
    expect(westGate?.collisionRatio).toBe(1);
    expect(result.contract).toMatchObject({ vertexCount: 10, edgeCount: 12, componentCount: 1, cyclomaticNumber: 3 });
    expect(result.bossReached).toBe(true);
  });

  it("is deterministic without mutating terrain or canonical reference data", () => {
    // Given
    const reference = referenceFixture();
    const referenceBefore = structuredClone(reference);
    const terrainBefore = buildIceGrandExpanseTerrain();
    const terrainHash = sha256([terrainBefore.lowerTiles, terrainBefore.upperTiles, [...terrainBefore.ceilingMask]]);

    // When
    const first = buildIceGrandExpanseMap(reference);
    const second = buildIceGrandExpanseMap(reference);
    const firstTopology = createIceGrandExpanseTopology(first);
    const secondTopology = createIceGrandExpanseTopology(second);

    // Then
    expect(first).toEqual(second);
    expect(firstTopology).toEqual(secondTopology);
    expect(reference).toEqual(referenceBefore);
    expect(sha256([terrainBefore.lowerTiles, terrainBefore.upperTiles, [...terrainBefore.ceilingMask]])).toBe(terrainHash);
    // 지형 해시 — 심연 428 → 광석 암반 285 치회(2,800칸) · 평지 립 343 도입 ·
    // 절뱽 페이스 조각 선택을 `index % 3` 에서 가로 연속 기반으로 교정한 뒤의 값이다.
    // 새 값은 연속 3회 밀드에서 동일함을 확인했다.
    expect(terrainHash).toBe("624a469b91c1a0f676eeec7fba91cac4a0dad826fb90af12b7ca0cf26fdc8a91");
  });
});
