import { describe, expect, it } from "vitest";
import { createAiPreviewProject, validateAiPreviewProject } from "@/project/aiPreviewGenerator";
import { createBlankProject, defaultTilesets, TILE } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";

function firstUnsupportedTilesetId(): string {
  const id = Object.keys(defaultTilesets()).find((candidate) => candidate.includes("ship") || candidate.includes("world"));
  if (!id) throw new Error("expected unsupported bundled EasyRPG tileset");
  return id;
}

describe("AI preview generator", () => {
  it("creates a separate valid preview project without mutating the source project", () => {
    const source = createBlankProject();
    const before = structuredClone(source);

    const result = createAiPreviewProject({
      goal: "작은 항구 마을",
      sourceProject: source,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    expect(source).toEqual(before);
    expect(result.project).not.toBe(source);
    expect(result.project.startMapId).toBe(result.map.id);
    expect(result.project.maps[result.map.id]).toEqual(result.map);
    expect(result.project.mapTree.children.some((node) => node.mapId === result.map.id)).toBe(true);
    expect(result.evidence.validation).toEqual({
      validTilesetId: true,
      validLayerLengths: true,
      inRangeTileIds: true,
      passabilityCovered: true,
      priorityCovered: true,
      terrainCovered: true,
      validStartPosition: true,
      boundaryCollisionChecked: true,
      reachableNpcEvents: true,
    });
  });

  it("routes dungeon goals through deterministic dungeon grammar evidence", () => {
    const source = createBlankProject();
    const result = createAiPreviewProject({
      goal: "어두운 던전과 NPC",
      sourceProject: source,
      charsetGroup: "Monster",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    expect(result.map.tilesetId).toBe("easyrpg_chipset_dungeon");
    expect(result.evidence.themeEligibility?.themeId).toBe("dungeon");
    expect(result.evidence.grammarEvidence).toEqual(expect.objectContaining({
      themeId: "dungeon",
      grammarId: "dungeon-room-corridor",
      grammarVersion: "1",
      deterministic: true,
    }));
    const wallIds = new Set(result.project.tilesets[result.map.tilesetId].tileGroups?.find((group) => group.role === "wall")?.tileIds ?? []);
    const interiorWallCount = result.map.lowerTiles.filter((tile, index) => {
      const x = index % result.map.width;
      const y = Math.floor(index / result.map.width);
      return x > 0 && y > 0 && x < result.map.width - 1 && y < result.map.height - 1 && wallIds.has(tile);
    }).length;
    expect(interiorWallCount).toBeGreaterThan(0);
    expect(result.map.events[0]?.commands).toEqual([]);
    expect(result.map.events[0]?.pages?.[0]?.commands).toEqual([]);
  });

  it("routes interior goals through deterministic interior-house grammar evidence", () => {
    const result = createAiPreviewProject({
      goal: "작은 집 실내와 NPC",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    expect(result.map.tilesetId).toBe("easyrpg_chipset_interior");
    expect(result.evidence.themeEligibility?.themeId).toBe("interior-house");
    expect(result.evidence.grammarEvidence).toEqual(expect.objectContaining({
      themeId: "interior-house",
      grammarId: "interior-house-room",
      deterministic: true,
    }));
    expect(result.evidence.deferredCommandContract).toEqual({
      status: "deferred",
      reason: "event-dialogue-generation-not-in-v2",
      allowedFutureScopes: ["dialogue", "eventCommands"],
    });
  });

  it("does not reject supported themes because of unsupported substrings", () => {
    const underworldDungeon = createAiPreviewProject({
      goal: "underworld dungeon",
      sourceProject: createBlankProject(),
      charsetGroup: "Monster",
    });
    const townshipVillage = createAiPreviewProject({
      goal: "township village",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });

    expect(underworldDungeon.ok).toBe(true);
    expect(townshipVillage.ok).toBe(true);
    if (!underworldDungeon.ok || !townshipVillage.ok) throw new Error("expected supported substring prompts to route successfully");
    expect(underworldDungeon.evidence.themeEligibility?.themeId).toBe("dungeon");
    expect(townshipVillage.evidence.themeEligibility?.themeId).toBe("combined-town");
  });
  it("chooses a collision-free default preview map id when the source already has a preview map", () => {
    const source = createBlankProject();
    const first = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.clarificationQuestion);

    const second = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: first.project });

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.clarificationQuestion);
    expect(second.map.id).toBe("ai-preview-map-2");
    expect(second.project.maps["ai-preview-map"]).toEqual(first.map);
    expect(second.project.maps["ai-preview-map-2"]).toEqual(second.map);
  });

  it("fails closed when an explicit preview map id would overwrite an existing map", () => {
    const source = createBlankProject();
    const first = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });

    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.clarificationQuestion);

    const collision = createAiPreviewProject({
      goal: "작은 항구 마을",
      sourceProject: first.project,
      mapId: "ai-preview-map",
    });

    expect(collision.ok).toBe(false);
    if (collision.ok) throw new Error("expected collision to fail");
    expect(collision.missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
  });


  it("creates inert reachable NPC GameEvents with typed preview evidence", () => {
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: createBlankProject() });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    const npc = result.map.events[0];
    expect(npc).toEqual(expect.objectContaining({
      id: result.evidence.npcMetadata[0]?.eventId,
      commands: [],
      sprite: expect.objectContaining({ type: "bundled" }),
    }));
    expect(npc?.pages?.[0]).toEqual(expect.objectContaining({
      name: "항구 안내인",
      commands: [],
      graphic: expect.objectContaining({ direction: "down", pattern: 1 }),
    }));
    expect(result.evidence.npcMetadata[0]).toEqual(expect.objectContaining({
      displayName: "항구 안내인",
      role: "preview-guide",
      confidence: "high",
      sourceGoal: "작은 항구 마을",
    }));
    expect(result.evidence.npcMetadata[0]?.charsetAssetId).toBe(result.evidence.charsetCandidates[0]?.assetId);
  });

  it("fails closed for non-default EasyRPG ChipSets with unknown metadata", () => {
    const source = createBlankProject();
    const tilesetId = firstUnsupportedTilesetId();
    source.maps[source.startMapId].tilesetId = tilesetId;

    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source, tilesetId });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail-closed result");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
    expect(result.clarificationQuestion).toContain("보완");
  });

  it("fails closed for deferred world and ship preview themes", () => {
    const result = createAiPreviewProject({
      goal: "world ship map",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected world/ship to fail closed");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
  });

  it("fails closed when unsupported world or ship tokens are mixed with supported themes", () => {
    const worldTown = createAiPreviewProject({
      goal: "world town map",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });
    const shipInterior = createAiPreviewProject({
      goal: "ship interior",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });

    expect(worldTown.ok).toBe(false);
    expect(shipInterior.ok).toBe(false);
    if (worldTown.ok || shipInterior.ok) throw new Error("expected mixed unsupported themes to fail closed");
    expect(worldTown.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
    expect(shipInterior.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
  });

  it("fails closed for Korean ship tokens without rejecting placement words", () => {
    const shipTown = createAiPreviewProject({
      goal: "배를 배치한 항구 마을",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });
    const backgroundTown = createAiPreviewProject({
      goal: "배경이 예쁜 항구 마을",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });
    const bareShipTown = createAiPreviewProject({
      goal: "큰 배 항구 마을",
      sourceProject: createBlankProject(),
      charsetGroup: "People",
    });

    expect(shipTown.ok).toBe(false);
    if (shipTown.ok) throw new Error("expected Korean ship token to fail closed");
    expect(shipTown.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
    expect(bareShipTown.ok).toBe(false);
    if (bareShipTown.ok) throw new Error("expected bare Korean ship token to fail closed");
    expect(bareShipTown.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
    expect(backgroundTown.ok).toBe(true);
  });

  it("fails closed when no high-confidence CharSet group matches", () => {
    const result = createAiPreviewProject({
      goal: "작은 항구 마을",
      sourceProject: createBlankProject(),
      charsetGroup: "MissingGroup",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail-closed charset result");
    expect(result.missingEvidence).toEqual([
      expect.objectContaining({ code: "charset_not_high_confidence" }),
    ]);
    expect(result.clarificationQuestion).toContain("NPC CharSet");
  });

  it("fails closed when no CharSet group is supplied and the goal has no group evidence", () => {
    const result = createAiPreviewProject({
      goal: "추상적인 분위기",
      sourceProject: createBlankProject(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail-closed charset result");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("charset_not_high_confidence");
  });

  it("fails closed before generating unsafe small theme dimensions", () => {
    const result = createAiPreviewProject({
      goal: "어두운 던전",
      sourceProject: createBlankProject(),
      charsetGroup: "Monster",
      width: 6,
      height: 5,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected small theme dimensions to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
  });

  it("validator rejects broken layer lengths and out-of-range tile ids", () => {
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: createBlankProject() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    result.map.lowerTiles = result.map.lowerTiles.slice(1);
    result.map.upperTiles[0] = 999_999;

    const validation = validateAiPreviewProject(result.project, result.map.id);

    expect(validation.validLayerLengths).toBe(false);
    expect(validation.inRangeTileIds).toBe(false);
  });
  it("validator rejects sparse runtime arrays even when lengths still cover the tile count", () => {
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: createBlankProject() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);

    delete result.project.tilesets[result.map.tilesetId].passability[0];

    const validation = validateAiPreviewProject(result.project, result.map.id);

    expect(validation.passabilityCovered).toBe(false);
    expect(validation.priorityCovered).toBe(false);
    expect(validation.terrainCovered).toBe(false);
  });

  it("fails closed before allocation for invalid preview dimensions", () => {
    const result = createAiPreviewProject({
      goal: "작은 항구 마을",
      sourceProject: createBlankProject(),
      width: 2,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid dimensions to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
  });

  it("validator rejects blocked start positions and unreachable NPCs", () => {
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: createBlankProject() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    result.project.startPos = { x: 0, y: 0 };
    const npcIndex = result.map.events[0]!.y * result.map.width + result.map.events[0]!.x;
    result.map.lowerTiles[npcIndex] = TILE.WATER;

    const validation = validateAiPreviewProject(result.project, result.map.id);

    expect(validation.validStartPosition).toBe(false);
    expect(validation.reachableNpcEvents).toBe(false);
  });
  it("fails closed before allocating oversized preview dimensions", () => {
    const result = createAiPreviewProject({
      goal: "작은 항구 마을",
      sourceProject: createBlankProject(),
      width: 100,
      height: 100,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected oversized dimensions to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
  });

  it("validator uses directional movement for NPC reachability", () => {
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: createBlankProject() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    const interiorTile = result.map.lowerTiles[result.project.startPos.y * result.map.width + result.project.startPos.x]!;
    result.project.tilesets[result.map.tilesetId].passability[interiorTile] = { up: true, down: false, left: false, right: false };

    const validation = validateAiPreviewProject(result.project, result.map.id);

    expect(validation.validStartPosition).toBe(true);
    expect(validation.reachableNpcEvents).toBe(false);
  });

  it("returns preview evidence detached from source tile group metadata", () => {
    const source = createBlankProject();
    const originalTile = source.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0]?.tileIds[0];
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);
    const evidenceGroup = result.evidence.tileGroups[0] as { tileIds: number[] };
    evidenceGroup.tileIds[0] = 999_999;

    expect(source.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0]?.tileIds[0]).toBe(originalTile);
  });
});
