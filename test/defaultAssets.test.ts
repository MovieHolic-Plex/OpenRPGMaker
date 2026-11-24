import { describe, expect, it, afterEach } from "vitest";
import { AI_PREVIEW_DEFERRED_COMMAND_CONTRACT, AI_PREVIEW_THEME_REQUIREMENTS, AI_PREVIEW_THEME_METADATA_PACKS, type AiPreviewGrammarEvidence, evaluateChipsetEligibility, evaluateThemeEligibility, missingPreviewClarification, selectHighConfidenceCharsetCandidate } from "@/project/aiPreviewContracts";
import { combinedTownTileset as defaultTileset, defaultTilesets, bundledTilesetById, ensureBundledTilesets, bundledTilesetIdForAssetForTest, defaultResourceProfiles } from "@/project/defaults/defaultAssets";
import { COMBINED_TOWN_TILESET_ID, COMBINED_TOWN_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { roleCapabilities } from "@/project/tileRoles";
import { createBlankProject } from "@/project/defaults";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { BUNDLED_TILESET_DIFF, bundledTilesetDiffForTest, setBundledTilesetDiffWriting } from "@/project/bundledTilesetDiff";
import { jsonEqual } from "@/util/structuralJson";
import type { Project, TilesetDef, StructureKitDef } from "@/project/types";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { DESERT_EAST_ID, createDesertEastTileset, ensureDesertEastTileset } from "@/project/defaults/desertEast";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import spec from "../tiledata/desert-east/objects/spec.json";
import ask from "../tiledata/desert-east/objects/ask.json";
import { CHIPSET_SLICING, EASYRPG_CHARSET_ASSETS, EASYRPG_RTP_CATEGORY_SLICING, EASYRPG_RTP_ASSETS, FACESET_FACE_HEIGHT, FACESET_FACE_WIDTH, FACESET_SLICING, LEGACY_FACESET_SHEET_ASSETS, charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS, GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { FACE_IMAGE_SIZE, RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { buildGroupSample, type GroupSampleInput } from "@/ai/groupSampleBuilder";
import { isolateTimers } from "./mergedTeardown";

describe("aiPreviewContracts", () => {
  isolateTimers();
  function firstNonDefaultTileset() {
    const tilesets = defaultTilesets();
    const tileset = Object.values(tilesets).find((candidate) => candidate.id !== COMBINED_TOWN_TILESET_ID);
    if (!tileset) throw new Error("expected bundled non-default EasyRPG tileset fixture");
    return tileset;
  }
  function terrainGroups(tileset: ReturnType<typeof defaultTileset>) {
    return tileset.tileGroups?.filter((group) => group.role === "terrain") ?? [];
  }
  describe("AI preview contracts", () => {
    it("accepts the combined-town/default harness as the high-confidence ChipSet happy path", () => {
      const result = evaluateChipsetEligibility(defaultTileset());

      expect(result.eligible).toBe(true);
      if (!result.eligible) throw new Error("expected eligible default tileset");
      expect(result.candidate.confidence).toBe("high");
      expect(result.candidate.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
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
      if (terrainGroups(tileset).length === 0) throw new Error("expected terrain groups");
      tileset.tileGroups = (tileset.tileGroups ?? []).map((group) => group.role === "terrain"
        ? {
            ...group,
            role: "prop" as const,
            description: "walkableFloor terrain dungeon floor exact words should not count",
            placementRules: "walkable floor lower terrain",
          }
        : group);

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
      if (terrainGroups(tileset).length === 0) throw new Error("expected terrain groups");
      tileset.tileGroups = (tileset.tileGroups ?? []).map((group) => group.role === "terrain"
        ? { ...group, patternGrammar: undefined }
        : group);

      const result = evaluateThemeEligibility(tileset, "combined-town");

      expect(result.eligible).toBe(false);
      if (result.eligible) throw new Error("expected missing required pattern grammar to fail");
      expect(result.evidence.missingCapabilities).toContain("walkableFloor");
    });

    it("requires passable floor capability metadata for walkableFloor", () => {
      const tileset = defaultTileset();
      const groups = terrainGroups(tileset);
      if (groups.length === 0) throw new Error("expected terrain groups");
      for (const group of groups) {
        for (const tile of group.tileIds) {
          tileset.tileMeta![tile] = { ...tileset.tileMeta![tile], passage: "solid" };
        }
      }

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
      tileset.name = "합본 마을 · EasyRPG (CC0)";
      const result = evaluateThemeEligibility(tileset, "combined-town");

      expect(result.eligible).toBe(false);
      if (result.eligible) throw new Error("expected exact texture mismatch to fail");
      expect(result.missingEvidence.map((evidence) => evidence.code)).toContain("unsupported_theme");
    });

    it("rejects uploaded images even when their id collides with a bundled pack texture id", () => {
      const tileset = defaultTileset();
      tileset.image = { type: "uploaded", id: COMBINED_TOWN_TILESET_TEXTURE_KEY };

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

      // 신뢰 팩은 지운 EasyRPG 던전·실내 시트의 정확한 텍스처를 요구한다 — 그 정의를 들고 있는 옛 저장본처럼 되살린다.
      const { tilesets } = withRetiredEasyRpgTilesets({ tilesets: defaultTilesets() });
      const dungeon = evaluateThemeEligibility(tilesets.easyrpg_chipset_dungeon, "dungeon");
      const interior = evaluateThemeEligibility(tilesets.easyrpg_chipset_interior, "interior-house");

      expect(dungeon.eligible).toBe(true);
      expect(interior.eligible).toBe(true);
      if (!dungeon.eligible || !interior.eligible) throw new Error("expected trusted packs to be eligible");
      expect(dungeon.evidence.metadataPack.metadataPackId).toBe("dungeon-v1");
      expect(interior.evidence.metadataPack.metadataPackId).toBe("interior-house-v1");
    });
  });
});

describe("aiPreviewPatternGrammarRequirement", () => {
  isolateTimers();
  /** 주어진 역할의 그룹에서만 patternGrammar 를 떼고 적격성을 재평가한다. */
  function eligibilityWithoutGrammarFor(role: string) {
    const tileset = defaultTileset();
    tileset.tileGroups = (tileset.tileGroups ?? []).map((group) =>
      group.role === role ? { ...group, patternGrammar: undefined } : group
    );
    return evaluateChipsetEligibility(tileset);
  }
  describe("패턴 문법 필수 역할 (특성화)", () => {
    it("terrain·water·wall 만 패턴 문법을 요구한다", () => {
      const tileset = defaultTileset();
      const required = ["terrain", "water", "wall"];
      const notRequired = ["building", "castle", "fence", "roof", "prop"];
      for (const role of required) {
        expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(true);
      }
      for (const role of notRequired) {
        expect(roleCapabilities(tileset, role).requiresPatternGrammar, role).toBe(false);
      }
    });

    // 위 테스트는 능력 표만 본다 — needsPatternGrammar 를 한 번도 부르지 않는다.
    // 아래는 그 분기를 양방향으로 통과시켜, 판정이 항상 true/false 로 굳는 변이를 잡는다.
    it("문법을 잃은 wall 그룹은 후보에서 빠지고, 문법 없는 building 그룹은 남는다", () => {
      // wall: requiresPatternGrammar=true → 문법이 없어지면 의미 그룹이 사라진다.
      const wall = eligibilityWithoutGrammarFor("wall");
      expect(wall.eligible).toBe(false);
      const missing = wall.missingEvidence.find((evidence) => evidence.code === "missing_semantic_groups");
      expect(missing?.detail).toContain("wall");

      // building: requiresPatternGrammar=false → 문법이 없어도 적격을 유지한다.
      expect(eligibilityWithoutGrammarFor("building").eligible).toBe(true);
    });
  });
});

describe("bundledTilesetDiff", () => {
  isolateTimers();
  // 2026-10-27: 빈 새 프로젝트 serialize 가 6,420만 자였고 95% 가 모든 프로젝트에 복사된 번들 타일셋 정의였다.
  // 저장본은 번들 정의와의 차이만 싣고 읽을 때 되돌린다. 저자 편집은 한 칸도 잃지 않아야 한다.

  type Wire = { tilesets: Record<string, Record<string, unknown>> };
  function blank(): Project {
    const project = createBlankProject() as Project;
    ensureBundledTilesets(project);
    return project;
  }
  afterEach(() => setBundledTilesetDiffWriting(true));
  describe("bundled tilesets are stored as diffs against the bundle", () => {
    it("a blank project serializes small and round-trips every tileset byte for byte", () => {
      const project = blank();
      const text = serialize(project);
      const full = serialize(project, { inlineBundledTilesets: true });
      expect(text.length).toBeLessThan(full.length / 5);
      const wire = JSON.parse(text) as Wire;
      for (const tileset of Object.values(wire.tilesets)) {
        if (tileset[BUNDLED_TILESET_DIFF]) expect(tileset.tileMeta).toBeUndefined();
      }
      const reloaded = deserialize(text);
      for (const [id, tileset] of Object.entries(project.tilesets)) {
        expect(JSON.stringify(reloaded.tilesets[id])).toBe(JSON.stringify(tileset));
      }
    });

    it("keeps author edits: changed tiles, appended tiles, added kits, changed and deleted fields, key order", () => {
      const project = blank();
      const id = "jp_city";
      const source = project.tilesets[id]!;
      const edited = structuredClone(source) as TilesetDef & Record<string, unknown>;
      edited.name = "저자 이름";
      edited.tileMeta = edited.tileMeta!.map((meta, index) => (index === 7 ? { ...meta, label: "저자 칸" } : meta));
      edited.passability[3] = { up: false, down: false, left: false, right: false };
      edited.count += 2;
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) {
        const list = edited[key] as unknown[];
        list.push(structuredClone(list[0]), structuredClone(list[1]));
      }
      edited.structureKits = [...(edited.structureKits ?? []), { id: "author-kit", name: "내 킷" } as never];
      delete (edited as Record<string, unknown>).roomKit;
      edited.authorNote = { text: "새 필드" };
      project.tilesets[id] = edited;

      const text = serialize(project);
      const view = (JSON.parse(text) as Wire).tilesets[id]!;
      expect(view[BUNDLED_TILESET_DIFF]).toBeDefined();
      expect(JSON.stringify(view).length).toBeLessThan(JSON.stringify(edited).length / 20);
      expect(JSON.stringify(deserialize(text).tilesets[id])).toBe(JSON.stringify(edited));
    });

    it("rebases onto a different bundle version without losing author tiles", () => {
      const current = bundledTilesetById("jp_city")! as TilesetDef & Record<string, unknown>;
      // 옛 판 흉내: 칸 64개와 킷 하나가 적은 번들.
      const old = structuredClone(current);
      old.count -= 64;
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (old as Record<string, unknown>)[key] = (old[key] as unknown[]).slice(0, old.count);
      old.structureKits = old.structureKits!.slice(0, -1);
      const copy = structuredClone(old);
      copy.tileMeta![5] = { ...copy.tileMeta![5]!, label: "저자 칸" };
      copy.structureKits!.push({ id: "author-kit", name: "내 킷" } as never);
      copy.count += 1;
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (copy[key] as unknown[]).push(structuredClone((copy[key] as unknown[])[0]));

      const view = bundledTilesetDiffForTest.diff(copy, old)!;
      const sameVersion = bundledTilesetDiffForTest.restore("jp_city", JSON.parse(JSON.stringify(view)), structuredClone(old));
      expect(JSON.stringify(sameVersion.tileset)).toBe(JSON.stringify(copy));

      const rebased = bundledTilesetDiffForTest.restore("jp_city", JSON.parse(JSON.stringify(view)), bundledTilesetById("jp_city")!).tileset as unknown as TilesetDef;
      expect(rebased.count).toBe(copy.count);
      expect(rebased.tileMeta!.length).toBe(copy.count);
      expect(rebased.tileMeta![5]!.label).toBe("저자 칸");
      expect(jsonEqual(rebased.tileMeta![copy.count - 1], copy.tileMeta![copy.count - 1])).toBe(true);
      expect(rebased.structureKits!.some((kit) => kit.id === "author-kit")).toBe(true);
    });

    it("refuses a diff for a bundle this app does not have", () => {
      const wire = JSON.parse(serialize(blank())) as Wire;
      const [id, view] = Object.entries(wire.tilesets).find(([, tileset]) => tileset[BUNDLED_TILESET_DIFF])!;
      delete wire.tilesets[id];
      wire.tilesets["no_such_bundle"] = { ...view, id: "no_such_bundle" };
      expect(() => deserialize(JSON.stringify(wire))).toThrow(ProjectFormatError);
    });

    it("the rollback switch writes full definitions again", () => {
      setBundledTilesetDiffWriting(false);
      const wire = JSON.parse(serialize(blank())) as Wire;
      expect(Object.values(wire.tilesets).some((tileset) => tileset[BUNDLED_TILESET_DIFF])).toBe(false);
    });
  });
  it("applies a legacy list delta by position, including a moved category in its tail", () => {
    const base = bundledTilesetById("beodeul_city")!;
    const docs = base.referenceDocuments!;
    const moved = docs[docs.length - 2]!;
    const edited = { ...base, referenceDocuments: [...docs.filter(doc => doc.id !== moved.id), { ...moved, name: "편집한 항목" }, { ...moved, id: "author", name: "새 항목" }] };
    const view = bundledTilesetDiffForTest.diff(edited, base)!;
    const saved = JSON.parse(JSON.stringify(view));
    delete saved.bundledTilesetDiff.arrays.referenceDocuments.ids;
    const restored = bundledTilesetDiffForTest.restore(base.id, saved, base).tileset;
    expect(restored.referenceDocuments).toEqual(edited.referenceDocuments);
  });
  it("rebases a changed page by ID when a later bundle reorders the same number of categories", () => {
    const base = bundledTilesetById("beodeul_city")!;
    const docs = base.referenceDocuments!;
    const edited = { ...base, referenceDocuments: docs.map((doc, index) => index === 0 ? { ...doc, name: "내 편집" } : doc) };
    const view = bundledTilesetDiffForTest.diff(edited, base)!;
    const later = { ...base, referenceDocuments: [...docs.slice(1), docs[0]!] };
    const restored = bundledTilesetDiffForTest.restore(base.id, view, later).tileset as unknown as TilesetDef;
    expect(restored.referenceDocuments!.map(doc => doc.id)).toEqual(later.referenceDocuments.map(doc => doc.id));
    expect(restored.referenceDocuments!.at(-1)?.name).toBe("내 편집");
  });
  it.each([false, true])("preserves a saved deletion when rebasing reordered categories (new category: %s)", (added) => {
    const bundle = bundledTilesetById("beodeul_city")!;
    const docs = bundle.referenceDocuments!.slice(0, 3);
    const base = { ...bundle, referenceDocuments: docs };
    const edited = { ...base, referenceDocuments: docs.slice(1) };
    const view = bundledTilesetDiffForTest.diff(edited, base)!;
    const reordered = [docs[2]!, docs[0]!, docs[1]!];
    if (added) reordered.splice(2, 0, { ...docs[0]!, id: "added-by-bundle" });
    const later = { ...base, referenceDocuments: reordered };
    const restored = bundledTilesetDiffForTest.restore(base.id, view, later).tileset;

    expect(restored.referenceDocuments).toEqual(reordered.filter(doc => doc.id !== docs[0]!.id));
  });
});

describe("bundledTilesetIdParity", () => {
  isolateTimers();
  /**
   * `ensureBundledTilesets` 는 무거운 생성자를 부르기 전에 id 로 존재를 확인한다. 그 id 계산이
   * 생성자 결과와 어긋나면 타일셋이 중복 생성되거나 참고문서 보강이 조용히 건너뛰어진다 —
   * 실패가 화면에 안 뜨는 종류라 계약으로 못박는다.
   * (숲마을·성채·Slates·EasyRPG 시트는 2026-10-07 저작권 정리로 번들에서 빠졌다.)
   */
  describe("bundled tileset id parity", () => {
    it("단독 생성자가 있는 특수 타일셋의 id 가 일치한다", async () => {
      const { createJoseonBaramTileset } = await import("@/project/defaults/joseonBaram");
      const { createModernCityTileset } = await import("@/project/defaults/modernCity");
      const { createJpCityTileset } = await import("@/project/defaults/jpCity");
      const { createWizardingWorldTileset } = await import("@/project/defaults/wizardingWorld");
      const { createSengokuEdoTileset } = await import("@/project/defaults/sengokuEdo");
      const { createSkyIslandTileset } = await import("@/project/defaults/skyIsland");
      const { createSteampunkCityTileset } = await import("@/project/defaults/steampunkCity");
      const { createModernCampusTileset } = await import("@/project/defaults/modernCampus");
      const { createPrehistoricTileset } = await import("@/project/defaults/prehistoric");
      const { createDesertEastTileset } = await import("@/project/defaults/desertEast");
      const { createSnowNorthTileset } = await import("@/project/defaults/snowNorth");
      const { createWastelandRuinsTileset } = await import("@/project/defaults/wastelandRuins");
      const { createBeodeulMassingTileset } = await import("@/project/defaults/beodeulMassing");

      const creators: Record<string, () => { id: string }> = {
        tex_joseon_baram: createJoseonBaramTileset,
        tex_modern_city: createModernCityTileset,
        tex_jp_city: createJpCityTileset,
        tex_wizarding_world: createWizardingWorldTileset,
        tex_sengoku_edo: createSengokuEdoTileset,
        tex_sky_island: createSkyIslandTileset,
        tex_steampunk_city: createSteampunkCityTileset,
        tex_modern_campus: createModernCampusTileset,
        tex_prehistoric: createPrehistoricTileset,
        tex_desert_east: createDesertEastTileset,
        tex_snow_north: createSnowNorthTileset,
        tex_wasteland_ruins: createWastelandRuinsTileset,
        tex_beodeul_massing: createBeodeulMassingTileset,
      };
      const byKey = new Map(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => [a.textureKey, a]));
      for (const [textureKey, creator] of Object.entries(creators)) {
        const asset = byKey.get(textureKey);
        expect(asset, textureKey).toBeDefined();
        expect(bundledTilesetIdForAssetForTest(asset!), textureKey).toBe(creator().id);
      }
    });

    it("지운 시트는 번들 목록에 없다", () => {
      const keys = new Set<string>(BUNDLED_EASYRPG_CHIPSET_ASSETS.map((a) => a.textureKey));
      for (const key of ["tex_forest_harmony", "tex_opengameart_castle", "tex_slates_32", "tex_easyrpg_chipset_dungeon", "tex_tibo_interior_expanded"]) {
        expect(keys.has(key), key).toBe(false);
      }
    });
  });
});

// desert_east 이야기 기물 8종(de-seal-altar … de-inscription-stone, 시트 928~949): 새 사본이 킷을 갖고 칸 표가 선언(막힘·★·바닥 그림)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 다른 칩셋 그림을 끝에 붙여 쓰던(이식 칸) 옛 사본도 킷을 받는지(이식 꼬리를 새 번들 끝 뒤로 민다),
// 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/desert-east/bake_de.py, 목록 tiledata/desert-east/objects/spec.json).
describe("desertEastObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][] };
  const ITEMS = spec.items as Item[];
  const IDS = new Set(ITEMS.map((item) => `de-${item.id}`));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 928;   // 이 묶음이 덧붙기 전 시트 끝

  describe("desert_east 이야기 기물", () => {
    it("새 사본은 8종 킷을 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸·바닥 그림)", () => {
      const ts = createDesertEastTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => `de-${item.id}`));
      let next = FIRST;
      for (const item of ITEMS) {
        const kit = kits.find((k) => k.id === `de-${item.id}`)!;
        expect([kit.width, kit.height]).toEqual([item.w, item.h]);
        expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
        expect(kit.ai?.tags).toContain(item.place);
        kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 928 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        }));
      }
      expect(next).toBe(950); // 이 묶음의 끝. 그 뒤(950~)는 첫 판 늘리기 칸(test/desertEastVariety.test.ts)
      expect(ts.count).toBeGreaterThanOrEqual(next);
      expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "de-objects"))).toBe(true);
    });

    it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
      const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
      const sheet = read("public/assets/desert-east/desert-east-chipset.png");
      const ts = createDesertEastTileset();
      for (const item of ITEMS) {
        const piece = read(`tiledata/desert-east/objects/pieces/${item.src}`);
        expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
        const kit = own(ts.structureKits).find((k) => k.id === `de-${item.id}`)!;
        kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
          const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
          for (let y = 0; y < 16; y += 1) {
            const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
            expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
          }
        }));
      }
    });

    it("다른 칩셋 그림을 끝에 붙여 쓰던 옛 사본: 이식 칸이 새 번들 끝 뒤로 밀리고(맵 번호도) 킷을 받는다 — 다시 불러도 그대로", () => {
      const made = { project: createBlankProject() as Project, currentMapId: "" };
      expect(runTool(made, "create_map", { id: "old", name: "옛 사막", width: 20, height: 15, tilesetId: DESERT_EAST_ID }).ok).toBe(true);
      const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
      const ts = project.tilesets[DESERT_EAST_ID]!;
      // 928칸 때 저장한 사본을 흉내 낸다: 번들 칸 표는 928 까지, 그 바로 뒤에 다른 칩셋 그림 두 칸(이식)과 그 킷
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, FIRST);
      // 928 뒤에 구운 킷(이야기 기물 8종 + 첫 판 늘리기)은 그때 없었다
      ts.structureKits = ts.structureKits!.filter((kit) => !kit.rows.some((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])].some((tile) => tile >= FIRST)));
      ts.tileGroups = ts.tileGroups!.filter((group) => !group.tileIds.some((tile) => tile >= FIRST));
      ts.passability.push({ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false });
      ts.priority.push("upper", "lower"); ts.terrain.push(0, 0);
      ts.tileMeta!.push({ label: "빌린 표지판 (1,1)", description: "" }, { label: "빌린 표지판 (1,2)", description: "" });
      ts.tileGrafts = [{ targetTile: FIRST, sourceChipset: "tex_wasteland_ruins", sourceTile: 10 }, { targetTile: FIRST + 1, sourceChipset: "tex_wasteland_ruins", sourceTile: 58 }];
      ts.structureKits.push({ id: "borrowed-sign", kind: "section", name: "빌린 표지판", width: 1, height: 2, tileSize: 16, rows: [{ tiles: [-1], upperTiles: [FIRST] }, { tiles: [-1], upperTiles: [FIRST + 1] }] } as StructureKitDef);
      ts.count = FIRST + 2;
      const map = project.maps.old!;
      map.upperTiles[3 * map.width + 4] = FIRST; map.upperTiles[4 * map.width + 4] = FIRST + 1;

      expect(ensureBundledTilesets(project)).toBe(true);
      const bundle = createDesertEastTileset();
      const start = Math.min(...ts.tileGrafts!.map((graft) => graft.targetTile));
      expect(start).toBeGreaterThanOrEqual(bundle.count);
      expect(start % ts.tilesPerRow).toBe(FIRST % ts.tilesPerRow); // 한 줄 폭 배수만큼 밀린다
      expect(map.upperTiles[3 * map.width + 4]).toBe(start);
      expect(map.upperTiles[4 * map.width + 4]).toBe(start + 1);
      expect(ts.structureKits!.find((kit) => kit.id === "borrowed-sign")!.rows.map((row) => row.upperTiles)).toEqual([[start], [start + 1]]);
      expect(ts.tileMeta![start]!.label).toBe("빌린 표지판 (1,1)");
      expect(isPassable(project, map, 4, 4)).toBe(false);
      expect(own(ts.structureKits)).toHaveLength(ITEMS.length);
      expect(ts.passability.slice(0, bundle.count)).toEqual(bundle.passability);
      expect(ts.tileMeta!.slice(0, bundle.count)).toEqual(bundle.tileMeta);
      for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((ts as unknown as Record<string, unknown[]>)[key]).toHaveLength(ts.count);
      const settled = JSON.stringify([ts, map.upperTiles]);
      ensureBundledTilesets(project);
      expect(JSON.stringify([ts, map.upperTiles])).toBe(settled);
      // 프로젝트 없이 부르면(맵 번호를 같이 고칠 수 없다) 겹치는 사본은 손대지 않는다
      const lone = structuredClone(ts);
      lone.tileGrafts = [{ targetTile: FIRST, sourceChipset: "tex_wasteland_ruins", sourceTile: 10 }];
      const before = JSON.stringify(lone);
      expect(ensureDesertEastTileset(lone)).toBe(false);
      expect(JSON.stringify(lone)).toBe(before);
    });

    it("게임이 바란 낱말이 그 킷을 첫째로 짚는다", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[DESERT_EAST_ID]!;
      for (const [id, words] of Object.entries(ask.items)) for (const word of words) expect([word, existingMatches(project, ts, word)[0]?.id]).toEqual([word, `de-${id}`]);
    });

    it("실제 놓기 도구로 놓으면 막힌 칸만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "sand", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "sand", name: "모래밭", width: 20, height: 15, tilesetId: DESERT_EAST_ID }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-spring", base: { x: 3, y: 6 } }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-seal-altar", base: { x: 8, y: 6 } }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId: "sand", objectId: "de-note", base: { x: 12, y: 6 } }).ok).toBe(true);
      const map = ctx.project.maps.sand!;
      // 샘 3×3 은 아홉 칸 모두 막힘, 제단 2×2 는 아랫줄만 막히고 윗줄은 사람 위에 그려지는 걸음 칸, 쪽지는 밟고 지나간다
      for (let y = 4; y <= 6; y += 1) for (let x = 3; x <= 5; x += 1) expect(isPassable(ctx.project, map, x, y)).toBe(false);
      for (const [x, y] of [[8, 6], [9, 6]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(false);
      for (const [x, y] of [[8, 5], [9, 5], [12, 6]] as const) expect(isPassable(ctx.project, map, x, y)).toBe(true);
    });
  });
});

describe("easyrpgRtpAssets", () => {
  isolateTimers();
  type FsLike = {
    readonly existsSync: (path: string) => boolean;
  };
  const loadFs = async (): Promise<FsLike> => {
    const moduleName = "node:fs";
    return (await import(moduleName)) as FsLike;
  };
  describe("EasyRPG RTP asset manifest", () => {
    it("lists the inspected EasyRPG RTP asset categories when the scoped RTP import is generated", () => {
      const categories = new Set(EASYRPG_RTP_ASSETS.map((asset) => asset.category));

      // 전투 배경·전투·무기·칩셋·게임오버·몬스터·그림·시스템·타이틀은 2026-10-07 저작권 정리로 지웠다 — 남은 네 갈래만 목록에 있다.
      expect(categories).toEqual(new Set(["charset", "faceset", "music", "sound"]));
      expect(EASYRPG_RTP_ASSETS.filter((asset) => (asset.category as string) === "chipset")).toEqual([]);
      expect(EASYRPG_CHARSET_ASSETS.length).toBeGreaterThanOrEqual(17);
    });

    it("exports EasyRPG RTP category slicing from the shared resource ontology", () => {
      expect(EASYRPG_RTP_CATEGORY_SLICING.chipset).toBe(RESOURCE_SLICING.chipset);
      expect(EASYRPG_RTP_CATEGORY_SLICING.faceset).toBe(RESOURCE_SLICING.faceset);
      expect(EASYRPG_RTP_CATEGORY_SLICING.title).toBe(RESOURCE_SLICING.title);
      expect(CHIPSET_SLICING).toMatchObject({ cellWidth: 16, cellHeight: 16, columns: 30, rows: 16 });
      expect(FACESET_SLICING).toEqual({ kind: "whole-image", unit: "image" });
      expect(FACESET_FACE_WIDTH).toBe(FACE_IMAGE_SIZE);
      expect(FACESET_FACE_HEIGHT).toBe(FACE_IMAGE_SIZE);
    });

    it("keeps the 5 pre-split faceset sheets registered as legacy resources", () => {
      expect(LEGACY_FACESET_SHEET_ASSETS.map((asset) => asset.id)).toEqual([
        "easyrpg-faceset-actor1",
        "easyrpg-faceset-actor2",
        "easyrpg-faceset-monster",
        "easyrpg-faceset-people1",
        "easyrpg-faceset-people2",
      ]);
    });

    it("keeps every RTP manifest entry as a bundled file, and every entry except the legacy faceset sheets as a resource profile", async () => {
      const fs = await loadFs();
      // 정리 전 188 → 캐릭터 17 + 얼굴 시트 5 + 음악 30 + 효과음 96.
      expect(EASYRPG_RTP_ASSETS.length).toBe(148);

      const missingFiles = EASYRPG_RTP_ASSETS
        .filter((asset) => !fs.existsSync(`public/${asset.path}`))
        .map((asset) => `${asset.id}:${asset.path}`);

      expect(missingFiles).toEqual([]);

      // 얼굴 시트는 번들 파일로는 남기고(v3 저장본 해석용) 저자가 고르는 리소스에서만 뺀다.
      // 이 제약이 없으면 리소스 관리자 얼굴 목록이 낱장 112장 대신 192×192 시트 5장만
      // 보여준다 — 사용자 신고 2026-08-27.
      const legacySheetIds = new Set(LEGACY_FACESET_SHEET_ASSETS.map((asset) => asset.id));
      const profiles = defaultResourceProfiles();
      const profileAssetIds = new Set(profiles.map((profile) => profile.assetId));
      const missingProfiles = EASYRPG_RTP_ASSETS
        .filter((asset) => !legacySheetIds.has(asset.id) && !profileAssetIds.has(asset.id))
        .map((asset) => `${asset.id}:${asset.category}`);

      expect(missingProfiles).toEqual([]);
      expect([...legacySheetIds].filter((id) => profileAssetIds.has(id))).toEqual([]);

      const faceProfiles = profiles.filter((profile) => profile.kind === "faceset");
      // 생성 시리즈(hero-XX-face) 낱장은 저장본 호환 등록만 남기고 저작 목록에는 올리지 않는다.
      expect(faceProfiles).toHaveLength(AUTHORABLE_FACESET_FACE_ASSETS.length);
      expect(faceProfiles.filter((profile) => GENERATED_FACESET_FACE_IDS.has(profile.assetId ?? ""))).toEqual([]);
      expect(faceProfiles.every((profile) => profile.imageWidth === FACE_IMAGE_SIZE)).toBe(true);
    });

    it("maps RPG Maker 2000 CharSet character selections to 24x32 spritesheet frame indexes", () => {
      expect(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 })).toBe(25);
      expect(charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 })).toBe(28);
      expect(charsetFrameIndex({ characterIndex: 4, direction: "down", pattern: 1 })).toBe(73);
      expect(charsetFrameIndex({ characterIndex: 4, direction: "up", pattern: 2 })).toBe(50);
    });

    it("decodes frame indexes back into NPC picker selections", () => {
      expect(decodeCharsetFrameIndex(73)).toEqual({
        characterIndex: 4,
        direction: "down",
        pattern: 1,
      });
    });
  });
});

describe("groupSampleRoleCapability", () => {
  isolateTimers();
  describe("buildGroupSample — 역할별 샘플 모양 (특성화)", () => {
    it("wall 은 문법이 없어도 나인슬라이스 크기로 나온다", () => {
      const sample = buildGroupSample(defaultTileset(), {
        role: "wall",
        tileIds: [15, 16, 17, 45, 46, 47, 75, 76, 77],
      });
      expect(sample.w).toBe(3);
      expect(sample.h).toBe(3);
    });

    it("문법 없는 prop 은 정확히 2타일일 때만 세로 쌍이다", () => {
      const tileset = defaultTileset();
      // verticalSample 은 침엽수 3그루를 한 칸씩 띄워 늘어놓는다 → 5x2.
      const pair = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292] });
      expect(pair.w).toBe(5);
      expect(pair.h).toBe(2);

      // 3개 이상은 세로로 묶지 않는다 (소품 가방 방어, groupSampleBuilder.ts:58 주석).
      // fallbackSample 로 떨어져 한 줄(h=1)이 된다 — 세로 쌍이면 h=2 가 됐을 것이다.
      const bag = buildGroupSample(tileset, { role: "prop", tileIds: [262, 292, 289] });
      expect(bag.w).toBe(3);
      expect(bag.h).toBe(1);
    });

    it("roof 는 전용 샘플 경로를 탄다", () => {
      // 5타일을 준다. roofSample 은 폭을 4로 자르고 남는 타일을 둘째 줄로 접어 4x2 를 만든다
      // (groupSampleBuilder.ts:128-129). fallbackSample 은 같은 입력에 5x1 을 준다(:141).
      // 2타일(w=2,h=1)로는 두 경로의 답이 같아 이 테스트가 아무것도 증명하지 못한다 —
      // sampleAs:"roof" 를 표에서 지워도 통과했다. 5타일에서만 w·h 가 둘 다 갈린다.
      const sample = buildGroupSample(defaultTileset(), { role: "roof", tileIds: [404, 405, 406, 407, 408] });
      expect(sample.w).toBe(4);
      expect(sample.h).toBe(2);
    });
  });
  describe("buildGroupSample — 레이어·배경 (특성화)", () => {
    it("prop 타일은 상위 레이어에 놓인다", () => {
      const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
      const placedUpper = sample.upper.some((tile) => tile === 289);
      expect(placedUpper).toBe(true);
    });

    it("prop 샘플은 배경에 잔디가 깔린다", () => {
      const sample = buildGroupSample(defaultTileset(), { role: "prop", tileIds: [289] });
      // backdropTile 이 defaultGrassTile 을 깔면 lower 에 잔디가 있다.
      expect(sample.lower.some((tile) => tile >= 0)).toBe(true);
    });

    it("terrain 샘플은 배경을 깔지 않는다", () => {
      // 배경은 emptySample 의 lowerTile 로 들어가므로 **lower** 를 봐야 한다.
      // upper 를 보면 terrain 타일이 애초에 lower 로 가기 때문에 무조건 통과한다.
      //
      // 그리고 배경이 보이는 칸이 있어야 한다. fallbackSample 은 w = tileIds.length 라
      // 모든 칸이 타일로 덮여 배경을 가린다. horizontal_expandable 문법은 w=5 를 만들고
      // 양 끝에만 캡을 놓으므로(groupSampleBuilder.ts:107-116) 가운데 3칸이 배경 그대로 남는다.
      const tileset = defaultTileset();
      // parts 가 비어 있으면 repeatBody 가 없어 가운데가 EMPTY 로 채워진다(:187-189).
      // preserveCaps·repeat 는 groupSampleBuilder 가 읽지 않지만 타입상 필수다.
      const grammar: NonNullable<GroupSampleInput["patternGrammar"]> = {
        kind: "horizontal_expandable",
        parts: [],
        preserveCaps: true,
        repeat: "body",
      };
      const terrain = buildGroupSample(tileset, { role: "terrain", tileIds: [303, 304], patternGrammar: grammar });
      expect(terrain.w).toBe(5);
      // needsBackdrop 이 terrain 에 켜지면 이 세 칸이 잔디(240)로 채워져 실패한다.
      expect([terrain.lower[1], terrain.lower[2], terrain.lower[3]].every((tile) => tile < 0)).toBe(true);

      // 대조군 — needsBackdrop:true 인 prop 은 같은 문법에서 가운데가 잔디로 채워진다.
      const prop = buildGroupSample(tileset, { role: "prop", tileIds: [303, 304], patternGrammar: grammar });
      expect([prop.lower[1], prop.lower[2], prop.lower[3]].every((tile) => tile >= 0)).toBe(true);
    });
  });
});

describe("legacyStairEntranceCleanup", () => {
  isolateTimers();
  const guide = { id: "stair-entrance-guide", name: "계단 입구 — atlas_biome_interior", markdown: "# 옛 안내" };
  const bundledImage = { id: "s1", name: "01", caption: "", dataUrl: "/assets/old/01.png" };
  describe("legacy stair-entrance references", () => {
    it("drops the bundled category from a saved tileset copy", () => {
      const p = createBlankProject();
      const city = p.tilesets.atlas_biome_interior!;
      city.referenceDocuments = [...city.referenceDocuments!, { id: "stair-entrance", name: "계단 입구", description: "", documents: [guide], images: [bundledImage] }];
      expect(ensureBundledTilesets(p)).toBe(true);
      expect(p.tilesets.atlas_biome_interior!.referenceDocuments!.some((c) => c.id === "stair-entrance")).toBe(false);
    });

    it("keeps author pages and uploads left in that category", () => {
      const p = createBlankProject();
      const city = p.tilesets.atlas_biome_interior!;
      const note = { id: "author-note", name: "내 메모", markdown: "계단은 북쪽" };
      const upload = { id: "u1", name: "내 그림", caption: "", dataUrl: "data:image/png;base64,AAAA" };
      city.referenceDocuments = [...city.referenceDocuments!, { id: "stair-entrance", name: "계단 입구", description: "", documents: [guide, note], images: [bundledImage, upload] }];
      ensureBundledTilesets(p);
      const kept = p.tilesets.atlas_biome_interior!.referenceDocuments!.find((c) => c.id === "stair-entrance")!;
      expect(kept.documents).toEqual([note]);
      expect(kept.images).toEqual([upload]);
    });
  });
});
