import { COMBINED_TOWN_TILESET_ID } from "./defaults/constants";
import { autotileNeighborMask, autotileVariantForMask } from "./defaults/autotileEngine";
import { autotileGroupsForTileset } from "./defaults/autotileGroups";
import type { AutotileGroup, Project } from "./types";

export interface CombinedTownAutotileFinding {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly mapId: string;
  readonly mapName: string;
  readonly x: number;
  readonly y: number;
  readonly groupId: string;
  readonly actual: number;
  readonly expected: number;
  readonly reason: "stale-variant";
}

export interface CombinedTownAutotileAudit {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly maps: number;
  readonly lowerCells: number;
  readonly memberCells: number;
  readonly effectiveGroupIds: readonly string[];
  readonly perGroup: Readonly<Record<string, number>>;
  readonly findings: readonly CombinedTownAutotileFinding[];
}

export interface CombinedTownAutotileRepair {
  readonly project: Project;
  readonly changedCells: number;
  readonly changedMaps: readonly string[];
}

function connectedTiles(group: AutotileGroup): ReadonlySet<number> {
  return new Set(group.connectTileIds ?? group.memberTileIds);
}

export function auditCombinedTownAutotiles(project: Project, projectId: string): CombinedTownAutotileAudit {
  const findings: CombinedTownAutotileFinding[] = [];
  const effectiveGroupIds = new Set<string>();
  const perGroup: Record<string, number> = {};
  let maps = 0;
  let lowerCells = 0;
  let memberCells = 0;

  for (const map of Object.values(project.maps)) {
    if (map.tilesetId !== COMBINED_TOWN_TILESET_ID) continue;
    maps += 1;
    const groups = autotileGroupsForTileset(project.tilesets[map.tilesetId]);
    const membersByGroup = groups.map((group) => ({
      group,
      members: new Set(group.memberTileIds),
      connected: connectedTiles(group),
    }));
    for (const group of groups) effectiveGroupIds.add(group.id);

    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      lowerCells += 1;
      const actual = map.lowerTiles[index];
      if (typeof actual !== "number") continue;
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      for (const entry of membersByGroup) {
        if (!entry.members.has(actual)) continue;
        memberCells += 1;
        perGroup[entry.group.id] = (perGroup[entry.group.id] ?? 0) + 1;
        const mask = autotileNeighborMask(
          map,
          x,
          y,
          (tile) => entry.connected.has(tile),
          entry.group.neighborhood ?? 4,
        );
        const expected = autotileVariantForMask(entry.group, mask);
        if (typeof expected === "number" && expected !== actual) {
          findings.push({ projectId, projectTitle: project.meta.title, mapId: map.id, mapName: map.name, x, y,
            groupId: entry.group.id, actual, expected, reason: "stale-variant" });
        }
      }
    }
  }

  return { projectId, projectTitle: project.meta.title, maps, lowerCells, memberCells,
    effectiveGroupIds: [...effectiveGroupIds].sort(), perGroup, findings };
}

export function repairCombinedTownAutotiles(project: Project): Project {
  return repairCombinedTownAutotilesWithSummary(project).project;
}

export function repairCombinedTownAutotilesWithSummary(project: Project): CombinedTownAutotileRepair {
  const repaired = structuredClone(project);
  const changedMaps = new Set<string>();
  let changedCells = 0;
  for (const map of Object.values(repaired.maps)) {
    if (map.tilesetId !== COMBINED_TOWN_TILESET_ID) continue;
    const groups = autotileGroupsForTileset(repaired.tilesets[map.tilesetId]);
    const source = project.maps[map.id]!;
    for (const group of groups) {
      const members = new Set(group.memberTileIds);
      const connected = connectedTiles(group);
      for (let index = 0; index < source.lowerTiles.length; index += 1) {
        const actual = source.lowerTiles[index];
        if (typeof actual !== "number" || !members.has(actual)) continue;
        const x = index % source.width;
        const y = Math.floor(index / source.width);
        const mask = autotileNeighborMask(
          source,
          x,
          y,
          (tile) => connected.has(tile),
          group.neighborhood ?? 4,
        );
        const expected = autotileVariantForMask(group, mask);
        if (typeof expected !== "number" || expected === actual) continue;
        map.lowerTiles[index] = expected;
        changedCells += 1;
        changedMaps.add(map.id);
      }
    }
  }
  return { project: repaired, changedCells, changedMaps: [...changedMaps].sort() };
}
