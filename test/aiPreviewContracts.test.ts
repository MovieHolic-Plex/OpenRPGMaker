import { describe, expect, it } from "vitest";
import {
  AI_PREVIEW_DEFERRED_COMMAND_CONTRACT,
  AI_PREVIEW_THEME_REQUIREMENTS,
  AI_PREVIEW_THEME_METADATA_PACKS,
  type AiPreviewGrammarEvidence,
  evaluateChipsetEligibility,
  evaluateThemeEligibility,
  missingPreviewClarification,
  selectHighConfidenceCharsetCandidate,
} from "@/project/aiPreviewContracts";
import { defaultTileset, defaultTilesets } from "@/project/defaults/defaultAssets";
import { DEFAULT_TILESET_ID, DEFAULT_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";

function firstNonDefaultTileset() {
  const tilesets = defaultTilesets();
  const tileset = Object.values(tilesets).find((candidate) => candidate.id !== DEFAULT_TILESET_ID);
  if (!tileset) throw new Error("expected bundled non-default EasyRPG tileset fixture");
  return tileset;
}

describe("AI preview contracts", () => {
  it("accepts the combined-town/default harness as the high-confidence ChipSet happy path", () => {
    const result = evaluateChipsetEligibility(defaultTileset());

    expect(result.eligible).toBe(true);
    if (!result.eligible) throw new Error("expected eligible default tileset");
    expect(result.candidate.confidence).toBe("high");
    expect(result.candidate.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(result.candidate.semanticGroups.map((group) => group.role)).toEqual(
      expect.arrayContaining(["terrain", "water", "wall", "building"])
    );
    expect(result.missingEvidence).toEqual([]);
    expect(result.clarificationQuestion).toBeNull();
  });

  it("fails closed for renderable non-default EasyRPG ChipSets with unknown metadata", () => {
    const result = evaluateChipsetEligibility(firstNonDefaultTileset());

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected non-default tileset to fail closed");
    expect(result.candidate).toBeNull();
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("missing_semantic_groups");
    expect(result.clarificationQuestion).toContain("타일셋 의미 태그");
  });

  it("rejects semantic groups when referenced tiles lack high-confidence metadata", () => {
    const tileset = defaultTileset();
    const roadGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!roadGroup) throw new Error("expected terrain group");
    const tile = roadGroup.tileIds[0];
    tileset.tileMeta![tile] = { label: "", description: "", source: "unknown", confidence: "low" };

    const result = evaluateChipsetEligibility(tileset);

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected low-confidence tile metadata to fail");
    expect(result.missingEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tile_metadata_not_high_confidence",
          tileIds: expect.arrayContaining([tile]),
        }),
      ])
    );
  });

  it("rejects out-of-range semantic group tile ids", () => {
    const tileset = defaultTileset();
    const terrainGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!terrainGroup) throw new Error("expected terrain group");
    tileset.tileGroups = [
      ...(tileset.tileGroups ?? []).filter((group) => group.id !== terrainGroup.id),
      { ...terrainGroup, tileIds: [...terrainGroup.tileIds, tileset.count + 10] },
    ];

    const result = evaluateChipsetEligibility(tileset);

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected out-of-range tile id to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("tile_out_of_range");
  });
  it("rejects sparse or invalid runtime arrays even when array lengths cover the tile count", () => {
    const sparse = defaultTileset();
    delete sparse.passability[0];

    const invalidPriority = defaultTileset();
    invalidPriority.priority[0] = undefined as unknown as "lower";

    expect(evaluateChipsetEligibility(sparse).eligible).toBe(false);
    expect(evaluateChipsetEligibility(invalidPriority).eligible).toBe(false);
    expect(evaluateChipsetEligibility(sparse).missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
    expect(evaluateChipsetEligibility(invalidPriority).missingEvidence.map((evidence) => evidence.code)).toContain("incomplete_runtime_arrays");
  });

  it("selects renderable high-confidence EasyRPG CharSet candidates", () => {
    const candidate = selectHighConfidenceCharsetCandidate("작은 항구 마을 NPC", "People");

    expect(candidate).toEqual(expect.objectContaining({
      confidence: "high",
      direction: "down",
      pattern: 1,
    }));
    expect(candidate?.assetId).toContain("easyrpg-charset-people");
    expect(candidate?.textureKey).toContain("tex_easyrpg_charset_people");
  });

  it("ranks Korean town goals to a high-confidence People CharSet without an explicit group", () => {
    const candidate = selectHighConfidenceCharsetCandidate("작은 항구 마을 NPC");

    expect(candidate).toEqual(expect.objectContaining({
      confidence: "high",
      assetId: expect.stringContaining("easyrpg-charset-people"),
    }));
  });

  it("fails closed instead of falling back to an unrelated CharSet candidate", () => {
    const candidate = selectHighConfidenceCharsetCandidate("작은 항구 마을 NPC", "MissingGroup");

    expect(candidate).toBeNull();
  });

  it("asks for an NPC CharSet when no high-confidence charset candidate exists", () => {
    const clarification = missingPreviewClarification([
      { code: "charset_not_high_confidence", detail: "no matching CharSet group" },
    ]);

    expect(clarification.question).toContain("NPC CharSet");
    expect(clarification.missingEvidence).toHaveLength(1);
  });

  it("builds one clarification question from missing evidence", () => {
    const clarification = missingPreviewClarification([
      { code: "missing_semantic_groups", detail: "terrain tags missing" },
      { code: "tile_metadata_not_high_confidence", detail: "low confidence" },
    ]);

    expect(clarification.question).toContain("타일셋 의미 태그");
    expect(clarification.missingEvidence).toHaveLength(2);
  });
});

describe("AI preview theme contracts", () => {
  it("defines the locked v2 theme tranche and non-executable deferred command contract", () => {
    expect(Object.keys(AI_PREVIEW_THEME_REQUIREMENTS).sort()).toEqual(["combined-town", "dungeon", "interior-house"]);
    expect(AI_PREVIEW_DEFERRED_COMMAND_CONTRACT).toEqual({
      status: "deferred",
      reason: "event-dialogue-generation-not-in-v2",
      allowedFutureScopes: ["dialogue", "eventCommands"],
    });
    expect(Object.keys(AI_PREVIEW_DEFERRED_COMMAND_CONTRACT)).toEqual(["status", "reason", "allowedFutureScopes"]);
  });

  it("defines a non-executable grammar evidence shape for later theme generators", () => {
    const evidence = {
      themeId: "combined-town",
      grammarId: "combined-town-compatible",
      grammarVersion: "1",
      deterministic: true,
      selectedCapabilities: ["walkableFloor", "wallFace"],
    } satisfies AiPreviewGrammarEvidence;

    expect(Object.keys(evidence)).toEqual([
      "themeId",
      "grammarId",
      "grammarVersion",
      "deterministic",
      "selectedCapabilities",
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/commands|dialogue|moveRoute|switch|transfer|actionPayload/i);
  });

  it("accepts combined-town through typed capabilities and exact metadata-pack texture evidence", () => {
    const result = evaluateThemeEligibility(defaultTileset(), "combined-town");

    expect(result.eligible).toBe(true);
    if (!result.eligible) throw new Error("expected combined-town to satisfy theme eligibility");
    expect(result.evidence.themeId).toBe("combined-town");
    expect(result.evidence.metadataPack).toEqual({
      metadataPackId: "combined-town-default-v1",
      metadataPackVersion: "1",
      bundledTextureIds: ["tex_easyrpg_chipset_combined_town"],
    });
    expect(result.evidence.satisfiedCapabilities).toEqual(
      expect.arrayContaining(["walkableFloor", "waterOrHazard", "wallFace", "buildingShell"])
    );
    expect(result.evidence.missingCapabilities).toEqual([]);
  });

  it("fails closed when a required typed capability is missing even if descriptive text matches", () => {
    const tileset = defaultTileset();
    const terrainGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!terrainGroup) throw new Error("expected terrain group");
    tileset.tileGroups = [
      ...(tileset.tileGroups ?? []).filter((group) => group.id !== terrainGroup.id),
      {
        ...terrainGroup,
        role: "prop",
        description: "walkableFloor terrain dungeon floor exact words should not count",
        placementRules: "walkable floor lower terrain",
      },
    ];

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected missing typed capability to fail closed");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("missing_theme_capability");
    expect(result.evidence.missingCapabilities).toContain("walkableFloor");
  });

  it("does not let weak optional capability evidence block required theme eligibility", () => {
    const tileset = defaultTileset();
    const optionalGroups = tileset.tileGroups?.filter((group) => ["prop", "fence", "roof"].includes(group.role)) ?? [];
    if (optionalGroups.length === 0) throw new Error("expected optional groups");
    for (const group of optionalGroups) {
      for (const tile of group.tileIds) {
        tileset.tileMeta![tile] = { label: "", description: "", source: "unknown", confidence: "low" };
      }
    }

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(true);
    if (!result.eligible) throw new Error("expected optional weak evidence not to block required capabilities");
    expect(result.evidence.satisfiedCapabilities).not.toContain("decorProp");
    expect(result.missingEvidence).toEqual([]);
  });

  it("honors per-theme pattern grammar requirements from the typed requirement table", () => {
    const tileset = defaultTileset();
    const terrainGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!terrainGroup) throw new Error("expected terrain group");
    tileset.tileGroups = [
      ...(tileset.tileGroups ?? []).filter((group) => group.id !== terrainGroup.id),
      { ...terrainGroup, patternGrammar: undefined },
    ];

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected missing required pattern grammar to fail");
    expect(result.evidence.missingCapabilities).toContain("walkableFloor");
  });

  it("requires passable floor capability metadata for walkableFloor", () => {
    const tileset = defaultTileset();
    const terrainGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
    if (!terrainGroup) throw new Error("expected terrain group");
    const tile = terrainGroup.tileIds[0];
    tileset.tileMeta![tile] = { ...tileset.tileMeta![tile], passage: "solid" };

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected solid floor metadata to fail walkableFloor");
    expect(result.evidence.missingCapabilities).toContain("walkableFloor");
  });

  it("requires solid wall capability metadata for wallFace", () => {
    const tileset = defaultTileset();
    const wallGroups = tileset.tileGroups?.filter((group) => group.role === "wall") ?? [];
    if (wallGroups.length === 0) throw new Error("expected wall groups");
    for (const group of wallGroups) {
      for (const tile of group.tileIds) {
        tileset.tileMeta![tile] = { ...tileset.tileMeta![tile], passage: "passable" };
      }
    }

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected passable wall metadata to fail wallFace");
    expect(result.evidence.missingCapabilities).toContain("wallFace");
  });

  it("rejects filename/display-name/renderability-only eligibility without exact metadata-pack texture match", () => {
    const tileset = firstNonDefaultTileset();
    tileset.name = "EasyRPG RTP Combined Town ChipSet";
    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected exact texture mismatch to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
  });

  it("rejects uploaded images even when their id collides with a bundled pack texture id", () => {
    const tileset = defaultTileset();
    tileset.image = { type: "uploaded", id: DEFAULT_TILESET_TEXTURE_KEY };

    const result = evaluateThemeEligibility(tileset, "combined-town");

    expect(result.eligible).toBe(false);
    if (result.eligible) throw new Error("expected uploaded texture collision to fail");
    expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
  });

  it("keeps world and ship outside the closed v2 theme contract", () => {
    expect("world" in AI_PREVIEW_THEME_REQUIREMENTS).toBe(false);
    expect("ship" in AI_PREVIEW_THEME_REQUIREMENTS).toBe(false);
  });

  it("accepts trusted exact-match dungeon and interior metadata packs", () => {
    expect(AI_PREVIEW_THEME_METADATA_PACKS.dungeon.bundledTextureIds).toEqual(["tex_easyrpg_chipset_dungeon"]);
    expect(AI_PREVIEW_THEME_METADATA_PACKS["interior-house"].bundledTextureIds).toEqual(["tex_easyrpg_chipset_interior"]);

    const tilesets = defaultTilesets();
    const dungeon = evaluateThemeEligibility(tilesets.easyrpg_chipset_dungeon, "dungeon");
    const interior = evaluateThemeEligibility(tilesets.easyrpg_chipset_interior, "interior-house");

    expect(dungeon.eligible).toBe(true);
    expect(interior.eligible).toBe(true);
    if (!dungeon.eligible || !interior.eligible) throw new Error("expected trusted packs to be eligible");
    expect(dungeon.evidence.metadataPack.metadataPackId).toBe("dungeon-v1");
    expect(interior.evidence.metadataPack.metadataPackId).toBe("interior-house-v1");
  });
});
