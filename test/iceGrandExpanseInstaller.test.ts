import { describe, expect, it } from "vitest";

import { createBlankProject } from "@/project/defaults";
import {
  ICE_GRAND_EXPANSE_OWNED_EVENT_IDS,
  ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS,
  IceGrandExpanseInstallError,
  assertIceGrandExpanseOwnedPatch,
  hashIceGrandExpanseMap,
  installIceGrandExpanse,
  stripOwnedArtifacts,
} from "@/project/defaults/iceGrandExpanse";
import { ICE_GRAND_ADVENTURE_MAP_ID } from "@/project/defaults/iceGrandAdventure";
import { ICE_DIAGONAL_CANONICAL_SOURCE } from "@/project/defaults/iceDiagonalTerrain";
import { ICE_GRAND_EXPANSE_MAP_ID } from "@/project/defaults/iceGrandExpansePlan";
import type { GameMap, MapTreeNode, Project } from "@/project/types";
import { parseBuildIceGrandExpanseArgs } from "../scripts/build-ice-grand-expanse.mjs";

function mapFixture(id: string, tile: number): GameMap {
  const width = 55;
  const height = 55;
  return {
    id,
    name: id,
    width,
    height,
    tilesetId: "easyrpg_chipset_dungeon",
    tileSize: 16,
    lowerTiles: Array.from({ length: width * height }, () => tile),
    upperTiles: Array.from({ length: width * height }, () => -1),
    events: [],
  };
}

function baseProject(): Project {
  const project = createBlankProject();
  const canonical = mapFixture(ICE_DIAGONAL_CANONICAL_SOURCE.mapId, 67);
  const adventure = mapFixture(ICE_GRAND_ADVENTURE_MAP_ID, 68);
  project.maps[canonical.id] = canonical;
  project.maps[adventure.id] = adventure;
  project.mapTree.children.push({
    mapId: canonical.id,
    children: [{ mapId: adventure.id, children: [] }, { mapId: "unrelated_sibling", children: [] }],
  });
  project.maps.unrelated_sibling = mapFixture("unrelated_sibling", 69);
  return project;
}

async function install(project: Project) {
  const canonical = project.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
  if (canonical === undefined) throw new RangeError("canonical fixture missing");
  return installIceGrandExpanse(project, { expectedCanonicalMapHash: await hashIceGrandExpanseMap(canonical) });
}

function treeOccurrences(node: MapTreeNode, mapId: string): number {
  return (node.mapId === mapId ? 1 : 0)
    + node.children.reduce((count, child) => count + treeOccurrences(child, mapId), 0);
}

describe("ice grand expanse installer", () => {
  it("keeps the build CLI local-only until Todo 8", () => {
    expect(parseBuildIceGrandExpanseArgs(["--project-json", "project.json"])).toEqual({ projectJson: "project.json" });
    expect(() => parseBuildIceGrandExpanseArgs(["--save", "true"])).toThrowError(
      expect.objectContaining({ code: "REMOTE_MUTATION_NOT_IMPLEMENTED" }),
    );
  });

  it("installs one exact owned patch after the canonical adventure sibling", async () => {
    const base = baseProject();
    const before = structuredClone(base);
    const result = await install(base);
    const map = result.project.maps[ICE_GRAND_EXPANSE_MAP_ID];
    const canonicalNode = result.project.mapTree.children.find((node) => node.mapId === ICE_DIAGONAL_CANONICAL_SOURCE.mapId);

    expect(result.kind).toBe("installed");
    expect(base).toEqual(before);
    expect(map).toBeDefined();
    expect(result.manifest).toEqual({
      mapId: ICE_GRAND_EXPANSE_MAP_ID,
      tree: { parentMapId: ICE_DIAGONAL_CANONICAL_SOURCE.mapId, index: 1 },
      fieldSpawnIds: map?.fieldSpawns?.map((spawn) => spawn.id),
      eventIds: ICE_GRAND_EXPANSE_OWNED_EVENT_IDS,
      switchIds: ICE_GRAND_EXPANSE_OWNED_SWITCH_IDS,
      databaseRecordIds: [],
      globalStartIds: [],
      resourceIds: [],
      worldGraphIds: [],
    });
    expect(canonicalNode?.children.map((node) => node.mapId)).toEqual([
      ICE_GRAND_ADVENTURE_MAP_ID,
      ICE_GRAND_EXPANSE_MAP_ID,
      "unrelated_sibling",
    ]);
    const stripped = stripOwnedArtifacts(result.project, result.manifest);
    expect(stripped).toEqual(before);
    expect(JSON.stringify(stripped)).toBe(JSON.stringify(before));
    expect(() => assertIceGrandExpanseOwnedPatch(before, result.project, result.manifest)).not.toThrow();
  });

  it("is a full-map-hash no-op and byte-identical on reinstall", async () => {
    const first = await install(baseProject());
    const second = await install(first.project);

    expect(second.kind).toBe("noop");
    expect(second.mapHash).toBe(first.mapHash);
    expect(JSON.stringify(second.project)).toBe(JSON.stringify(first.project));
    expect(treeOccurrences(second.project.mapTree, ICE_GRAND_EXPANSE_MAP_ID)).toBe(1);
  });

  it("uses the canonical child count when the adventure sibling is absent", async () => {
    const base = baseProject();
    const parent = base.mapTree.children.find((node) => node.mapId === ICE_DIAGONAL_CANONICAL_SOURCE.mapId);
    if (parent === undefined) throw new RangeError("canonical tree fixture missing");
    parent.children = parent.children.filter((node) => node.mapId !== ICE_GRAND_ADVENTURE_MAP_ID);
    delete base.maps[ICE_GRAND_ADVENTURE_MAP_ID];
    const result = await install(base);

    expect(result.manifest.tree.index).toBe(1);
    expect(parent.children.map((node) => node.mapId)).toEqual(["unrelated_sibling"]);
    expect(result.project.mapTree.children.find((node) => node.mapId === ICE_DIAGONAL_CANONICAL_SOURCE.mapId)?.children.at(-1)?.mapId).toBe(ICE_GRAND_EXPANSE_MAP_ID);
  });

  it("fails closed on canonical drift before returning a project", async () => {
    const base = baseProject();
    const canonical = base.maps[ICE_DIAGONAL_CANONICAL_SOURCE.mapId];
    if (canonical === undefined) throw new RangeError("canonical fixture missing");
    const expectedCanonicalMapHash = await hashIceGrandExpanseMap(canonical);
    canonical.lowerTiles[0] = 999;

    await expect(installIceGrandExpanse(base, { expectedCanonicalMapHash })).rejects.toMatchObject({ code: "CANONICAL_DRIFT" });
    expect(base.maps[ICE_GRAND_EXPANSE_MAP_ID]).toBeUndefined();
  });

  it.each([
    { name: "conflicting full map hash", mutate: (project: Project) => { project.maps[ICE_GRAND_EXPANSE_MAP_ID] = mapFixture(ICE_GRAND_EXPANSE_MAP_ID, 3); } },
    { name: "orphan derived tree node", mutate: (project: Project) => { project.mapTree.children.push({ mapId: ICE_GRAND_EXPANSE_MAP_ID, children: [] }); } },
    { name: "duplicate derived tree nodes", mutate: (project: Project) => {
      const parent = project.mapTree.children.find((node) => node.mapId === ICE_DIAGONAL_CANONICAL_SOURCE.mapId);
      parent?.children.push({ mapId: ICE_GRAND_EXPANSE_MAP_ID, children: [] }, { mapId: ICE_GRAND_EXPANSE_MAP_ID, children: [] });
    } },
  ])("rejects $name as DERIVED_ID_CONFLICT", async ({ mutate }) => {
    const base = baseProject();
    mutate(base);
    const before = structuredClone(base);

    await expect(install(base)).rejects.toMatchObject({ code: "DERIVED_ID_CONFLICT" });
    expect(base).toEqual(before);
  });

  it("rejects exact derived bytes at the wrong tree placement", async () => {
    const first = await install(baseProject());
    const parent = first.project.mapTree.children.find((node) => node.mapId === ICE_DIAGONAL_CANONICAL_SOURCE.mapId);
    if (parent === undefined) throw new RangeError("canonical tree fixture missing");
    const derived = parent.children.splice(1, 1)[0];
    if (derived === undefined) throw new RangeError("derived tree fixture missing");
    parent.children.push(derived);

    await expect(install(first.project)).rejects.toMatchObject({ code: "DERIVED_ID_CONFLICT" });
  });

  it("rejects unrelated-data mutation under the owned-patch verifier", async () => {
    const base = baseProject();
    const installed = await install(base);
    installed.project.meta.title = "mutated unrelated title";

    expect(() => assertIceGrandExpanseOwnedPatch(base, installed.project, installed.manifest)).toThrowError(
      expect.objectContaining({ code: "UNRELATED_DATA_MUTATION" }),
    );
  });

  it("exports a typed conflict error", () => {
    const error = new IceGrandExpanseInstallError("DERIVED_ID_CONFLICT", "conflict");
    expect(error).toMatchObject({ code: "DERIVED_ID_CONFLICT", message: "conflict" });
  });
});
