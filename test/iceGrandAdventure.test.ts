import { describe, expect, it } from "vitest";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import {
  ICE_GRAND_ADVENTURE_ENCOUNTERS,
  ICE_GRAND_ADVENTURE_MAP_ID,
  ICE_GRAND_ADVENTURE_START,
  installIceGrandAdventure,
} from "@/project/defaults/iceGrandAdventure";
import {
  ICE_DIAGONAL_CANONICAL_SOURCE,
  stampCanonicalIceRidge,
  validateIceDiagonalTerrain,
} from "@/project/defaults/iceDiagonalTerrain";
import type { Command, GameMap, Project } from "@/project/types";

function canonicalReferenceFixture(): GameMap {
  const width = 55;
  const height = 55;
  let lower = new Array<number>(width * height).fill(67);
  for (const origin of [{ x: 7, y: 8 }, { x: 31, y: 9 }, { x: 36, y: 35 }]) {
    const stamped = stampCanonicalIceRidge({ width, height, lower }, origin);
    if (!stamped.ok) throw new Error(stamped.issues.map((issue) => issue.code).join(","));
    lower = [...stamped.lower];
  }
  return {
    id: ICE_DIAGONAL_CANONICAL_SOURCE.mapId,
    name: ICE_DIAGONAL_CANONICAL_SOURCE.name,
    width,
    height,
    tilesetId: "easyrpg_chipset_dungeon",
    tileSize: 16,
    lowerTiles: lower,
    upperTiles: new Array<number>(width * height).fill(-1),
    events: [],
  };
}

function projectWithCanonicalReference(): Project {
  const project = createBlankProject();
  const reference = canonicalReferenceFixture();
  project.maps[reference.id] = reference;
  project.mapTree.children.push({ mapId: reference.id, children: [] });
  return project;
}

function flatten(commands: readonly Command[]): Command[] {
  return commands.flatMap((command) => command.kind === "fork"
    ? [command, ...flatten(command.then), ...flatten(command.else ?? [])]
    : [command]);
}

function canReachAnyNeighbor(project: Project, map: GameMap, target: { x: number; y: number }): boolean {
  const startKey = `${ICE_GRAND_ADVENTURE_START.x},${ICE_GRAND_ADVENTURE_START.y}`;
  const queue: { x: number; y: number }[] = [{ ...ICE_GRAND_ADVENTURE_START }];
  const seen = new Set([startKey]);
  const targetNeighbors = new Set([
    `${target.x - 1},${target.y}`,
    `${target.x + 1},${target.y}`,
    `${target.x},${target.y - 1}`,
    `${target.x},${target.y + 1}`,
  ]);
  while (queue.length > 0) {
    const point = queue.shift()!;
    if (targetNeighbors.has(`${point.x},${point.y}`)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = point.x + dx;
      const y = point.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || !isPassable(project, map, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return false;
}

describe("ice grand adventure", () => {
  it("installs a distinct 55x55 derivative without mutating the canonical map", () => {
    const project = projectWithCanonicalReference();
    const canonicalBefore = structuredClone(project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId]);
    const startBefore = { mapId: project.startMapId, pos: structuredClone(project.startPos) };

    const result = installIceGrandAdventure(project);
    const map = project.maps[ICE_GRAND_ADVENTURE_MAP_ID];

    expect(result.mapId).toBe(ICE_GRAND_ADVENTURE_MAP_ID);
    expect(map).toBeDefined();
    expect({ width: map.width, height: map.height }).toEqual({ width: 55, height: 55 });
    expect(project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId]).toEqual(canonicalBefore);
    expect({ mapId: project.startMapId, pos: project.startPos }).toEqual(startBefore);
    expect(map.lowerTiles).not.toEqual(canonicalBefore.lowerTiles);
    expect(validateIceDiagonalTerrain({ width: map.width, height: map.height, lower: map.lowerTiles })).toEqual([]);
  });

  it("wires seven visible monsters to real troops and persistent clear pages", () => {
    const project = projectWithCanonicalReference();
    installIceGrandAdventure(project);
    const map = project.maps[ICE_GRAND_ADVENTURE_MAP_ID];
    const troopsById = new Map(project.database.troops.map((troop) => [troop.id, troop]));
    const clearSwitchIds = new Set<string>();

    expect(ICE_GRAND_ADVENTURE_ENCOUNTERS).toHaveLength(7);
    for (const encounter of ICE_GRAND_ADVENTURE_ENCOUNTERS) {
      const event = map.events.find((candidate) => candidate.id === encounter.eventId);
      expect(event, encounter.eventId).toBeDefined();
      const commands = flatten(event!.pages?.[0]?.commands ?? []);
      const battle = commands.find((command) => command.kind === "battleProcessing");
      expect(battle).toMatchObject({ kind: "battleProcessing", troopId: encounter.troopId });
      expect(troopsById.get(encounter.troopId)?.previewBackgroundResourceId).toBe("scarloxy-backdrop-ice");
      const clear = commands.find((command) => command.kind === "setSwitch" && command.value === true);
      expect(clear?.kind).toBe("setSwitch");
      if (clear?.kind === "setSwitch") clearSwitchIds.add(clear.switchId);
      expect(event!.pages?.[1]?.graphic.transparent).toBe(true);
      expect(canReachAnyNeighbor(project, map, encounter)).toBe(true);
    }
    expect(clearSwitchIds.size).toBe(ICE_GRAND_ADVENTURE_ENCOUNTERS.length);
  });

  it("adds two rewards, a recovery checkpoint, and one map-tree node idempotently", () => {
    const project = projectWithCanonicalReference();
    installIceGrandAdventure(project);
    installIceGrandAdventure(project);
    const map = project.maps[ICE_GRAND_ADVENTURE_MAP_ID];

    expect(map.events.filter((event) => event.id.startsWith("ev_ice_reward_"))).toHaveLength(2);
    expect(map.events.some((event) => flatten(event.pages?.[0]?.commands ?? []).some((command) => command.kind === "checkpointSave"))).toBe(true);
    expect(JSON.stringify(project.mapTree).match(new RegExp(ICE_GRAND_ADVENTURE_MAP_ID, "g"))).toHaveLength(1);
    expect(new Set(project.database.enemies.map((enemy) => enemy.id)).size).toBe(project.database.enemies.length);
    expect(new Set(project.database.troops.map((troop) => troop.id)).size).toBe(project.database.troops.length);
  });
});
