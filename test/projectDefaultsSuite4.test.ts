import { describe, expect, it, afterEach, beforeAll, beforeEach } from "vitest";
import { buildFieldBattleMonsterEvent, buildComplexEnemy, buildComplexTroop, buildComplexMonsterBundle, layoutTroopMembers, seedHomeDungeonComplexTroops } from "@/project/defaults/complexMonsterAuthoring";
import { evalCondition, startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";
import type { Command, Project, TilesetDef, StructureKitDef } from "@/project/types";
import { resolveAssetResourceUrl, builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { CURRENT_MONSTER_STAND_IN } from "@/project/defaults/currentMonsterStandIns";
import { isolateTimers } from "./mergedTeardown";
import { AI_PREVIEW_DEFERRED_COMMAND_CONTRACT, AI_PREVIEW_THEME_REQUIREMENTS, AI_PREVIEW_THEME_METADATA_PACKS, type AiPreviewGrammarEvidence, evaluateChipsetEligibility, evaluateThemeEligibility, missingPreviewClarification, selectHighConfidenceCharsetCandidate } from "@/project/aiPreviewContracts";
import { combinedTownTileset as defaultTileset, defaultTilesets, bundledTilesetById, ensureBundledTilesets, bundledTilesetIdForAssetForTest, defaultResourceProfiles } from "@/project/defaults/defaultAssets";
import { COMBINED_TOWN_TILESET_ID, COMBINED_TOWN_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { roleCapabilities } from "@/project/tileRoles";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { BUNDLED_TILESET_DIFF, bundledTilesetDiffForTest, setBundledTilesetDiffWriting } from "@/project/bundledTilesetDiff";
import { jsonEqual } from "@/util/structuralJson";
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
import { computeSwingDamage } from "@/battle/action/combatMath";
import { normalizeEnemyActionProfile } from "@/project/actionCombat";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { readFileSync, existsSync } from "node:fs";
import { PIXEL_ENEMY_SHEETS, pixelEnemyCell } from "@/assets/pixelEnemySheets";
import { pixelEnemyGridDims } from "@/assets/pixelEnemyGrid";
import { pixelEnemyPortraitPath } from "@/assets/pixelEnemyPortraits";
import { actorBattlers } from "@/battle/battleBattlers";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { ensureBundledBattleAnimations } from "@/project/defaults/defaultDatabase";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { normalizeEquipmentRecord, normalizeItemRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { renderItemRecordForm, itemEffectStory } from "@/editor/panels/databaseItemRecordView";
import { renderEquipmentRecordForm, equipmentEffectStory } from "@/editor/panels/databaseEquipmentRecordView";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { useItemFromMenu } from "@/player/playerItemUse";
import { itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import { transitionItemState } from "@/project/itemTransitions";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { elementMultiplierFor } from "@/battle/battlePredict";
import { affinitySentences, nextAffinityGrade } from "@/editor/panels/databaseElementAffinity";
import { applyDefaultElementAffinities } from "@/project/defaults/defaultElementAffinities";

describe("complexMonsterAuthoring", () => {
  isolateTimers();
  describe("battleResultErasePattern", () => {
    isolateTimers();
    function flatten(commands: readonly Command[]): Command[] {
      const out: Command[] = [];
      for (const command of commands) {
        out.push(command);
        if (command.kind === "fork") {
          out.push(...flatten(command.then));
          if (command.else) out.push(...flatten(command.else));
        }
      }
      return out;
    }
    describe("field monster victory erase pattern", () => {
      it("builds battle then victory-only erase + clear switch", () => {
        const event = buildFieldBattleMonsterEvent({
          id: "monster_test",
          name: "시험체",
          x: 5,
          y: 6,
          troopId: "troop_test_boss",
          intro: "싸운다!",
          victory: "이겼다!",
          spriteId: "tex_easyrpg_charset_monster1",
          characterIndex: 0,
          clearSwitch: "sw_0099",
        });
        const live = event.pages[0]!;
        const flat = flatten(live.commands);
        expect(flat.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
        expect(
          flat.some(
            (c) =>
              c.kind === "m2Command" &&
              c.commandId === "m2-086-erase-event"
          )
        ).toBe(true);
        expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);

        const victoryFork = live.commands.find((c) => c.kind === "fork");
        expect(victoryFork).toMatchObject({
          kind: "fork",
          condition: { kind: "battleResult", result: "victory" },
        });
      });

      it("battleResult condition evaluates session battle outcome", () => {
        const project = createBlankProject();
        const session = startSession(project);
        expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(false);
        session.battleResult = "victory";
        expect(evalCondition(session, { kind: "battleResult", result: "victory" })).toBe(true);
        expect(evalCondition(session, { kind: "battleResult", result: "escape" })).toBe(false);
      });
    });
  });
  describe("complexMonsterAuthoring", () => {
    isolateTimers();
    describe("complexMonsterAuthoring", () => {
      it("layouts multi-member troops with distinct x positions", () => {
        const members = layoutTroopMembers([
          { enemyId: "a" },
          { enemyId: "b" },
          { enemyId: "c" },
        ]);
        expect(members).toHaveLength(3);
        expect(members[0]!.x).toBeLessThan(members[1]!.x);
        expect(members[1]!.x).toBeLessThan(members[2]!.x);
        expect(new Set(members.map((m) => m.enemyId)).size).toBe(3);
      });

      it("builds enemy with actions and troop with multi members + intro battle page", () => {
        const enemy = buildComplexEnemy({
          id: "enemy_test_boss",
          name: "테스트 보스",
          monsterResourceId: "generated-enemy-dragon-01",
          stats: { maxHp: 80, attack: 20, defense: 15 },
          skillIds: ["skill_fire"],
        });
        expect(enemy.id).toBe("enemy_test_boss");
        expect(enemy.monsterResourceId).toBe("generated-enemy-dragon-01");
        expect(enemy.stats.maxHp).toBe(80);
        expect(enemy.actions.length).toBeGreaterThanOrEqual(2);

        const troop = buildComplexTroop({
          id: "troop_test_boss",
          name: "테스트 트룹",
          members: [
            { enemyId: enemy.id },
            { enemyId: enemy.id },
          ],
          previewBackgroundResourceId: "easyrpg-backdrop-sunset1",
          introMessage: "보스가 등장했다!",
          uncapturable: true,
        });
        expect(troop.members).toHaveLength(2);
        expect(troop.enemyIds).toEqual([enemy.id, enemy.id]);
        expect(troop.uncapturable).toBe(true);
        expect(troop.battleEventPages.length).toBeGreaterThanOrEqual(1);
        expect(troop.battleEventPages[0]!.commands.some((c) => c.kind === "text")).toBe(true);
        // sky panoramas may be rewritten; still has some background
        expect(troop.previewBackgroundResourceId).toBeTruthy();
      });

      it("builds field battle monster with live/defeated pages", () => {
        const event = buildFieldBattleMonsterEvent({
          id: "monster_test",
          name: "시험체",
          x: 5,
          y: 6,
          troopId: "troop_test_boss",
          intro: "싸운다!",
          victory: "이겼다!",
          spriteId: "tex_easyrpg_charset_monster1",
          characterIndex: 0,
          clearSwitch: "sw_0099",
        });
        expect(event.pages).toHaveLength(2);
        const live = event.pages[0]!;
        expect(live.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: false }]);
        expect(live.commands.some((c) => c.kind === "battleProcessing" && c.troopId === "troop_test_boss")).toBe(true);
        const flat = live.commands.flatMap((c) =>
          c.kind === "fork" ? [c, ...c.then, ...(c.else ?? [])] : [c]
        );
        expect(flat.some((c) => c.kind === "setSwitch" && c.switchId === "sw_0099" && c.value === true)).toBe(true);
        expect(flat.some((c) => c.kind === "m2Command" && c.commandId === "m2-086-erase-event")).toBe(true);
        const gone = event.pages[1]!;
        expect(gone.conditions).toEqual([{ kind: "switch", switchId: "sw_0099", value: true }]);
      });

      it("bundle + home dungeon seed upsert multi-enemy themed troops", () => {
        const project = createBlankProject();
        const beforeTroops = project.database.troops.length;
        const beforeEnemies = project.database.enemies.length;
        const seeded = seedHomeDungeonComplexTroops(project);
        expect(seeded.enemies.length).toBeGreaterThanOrEqual(6);
        expect(seeded.troops.length).toBeGreaterThanOrEqual(6);
        expect(project.database.enemies.length).toBeGreaterThanOrEqual(beforeEnemies + 6);
        expect(project.database.troops.length).toBeGreaterThanOrEqual(beforeTroops + 6);

        const lavaBoss = project.database.troops.find((t) => t.id === "troop_lava_ember_pack");
        expect(lavaBoss).toBeTruthy();
        expect((lavaBoss!.members?.length ?? 0)).toBeGreaterThanOrEqual(3);
        expect(lavaBoss!.battleEventPages.length).toBeGreaterThanOrEqual(1);

        const iceDrake = project.database.troops.find((t) => t.id === "troop_ice_azure_drake");
        expect(iceDrake?.uncapturable).toBe(true);
        expect(iceDrake?.members?.[0]?.enemyId).toBe("enemy_ice_azure_drake");

        const bundle = buildComplexMonsterBundle({
          enemySeeds: [
            {
              id: "enemy_bundle_a",
              name: "A",
              monsterResourceId: "generated-enemy-slime-01",
              stats: { maxHp: 20, attack: 8 },
            },
          ],
          troop: {
            id: "troop_bundle",
            name: "번들",
            members: [{ enemyId: "enemy_bundle_a" }, { enemyId: "enemy_bundle_a" }],
          },
          field: {
            id: "monster_bundle",
            name: "번들몹",
            x: 1,
            y: 1,
            troopId: "troop_bundle",
            intro: "i",
            victory: "v",
            spriteId: "tex_easyrpg_charset_monster2",
            characterIndex: 1,
            clearSwitch: "sw_0001",
          },
        });
        expect(bundle.enemies).toHaveLength(1);
        expect(bundle.troop.members).toHaveLength(2);
        expect(bundle.fieldEvent.id).toBe("monster_bundle");
      });
    });
  });
  describe("dbImageMatching", () => {
    isolateTimers();
    describe("database image matching", () => {
      it("assigns unique matching monster graphics for default enemies and species", () => {
        const project = createBlankProject();
        // qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적은 모두 현행 20칸 세트 그림이다.
        // 현행 그림이 없던 종은 대역 표(currentMonsterStandIns)의 가장 가까운 종 그림을 나눠 쓴다 — 그 밖의 공유는 실패.
        const monsterIds = project.database.enemies.map((enemy) => enemy.monsterResourceId);
        const generatedIds = monsterIds.filter((id) => id?.startsWith("generated-enemy-"));
        expect(generatedIds.length).toBe(monsterIds.length);
        expect(generatedIds.length).toBeGreaterThanOrEqual(100);
        expect(monsterIds.filter((id) => !isCurrentMonsterArt(id))).toEqual([]);
        for (const enemy of project.database.enemies) {
          const owners = project.database.enemies.filter((other) => other.monsterResourceId === enemy.monsterResourceId);
          if (owners.length === 1) continue;
          const tails = owners.map((other) => CURRENT_MONSTER_STAND_IN[other.id.replace(/^enemy_/u, "")] ?? other.id.replace(/^enemy_/u, ""));
          expect(new Set(tails).size, `${enemy.monsterResourceId}: ${owners.map((o) => o.id).join(", ")}`).toBe(1);
        }
        for (const id of monsterIds) {
          expect(resolveAssetResourceUrl(id), id).toBeTruthy();
        }

        const bySpecies = Object.fromEntries(
          (project.database.monsterSpecies ?? []).map((species) => [species.id, species.graphic.monsterResourceId]),
        );
        expect(Object.keys(bySpecies).sort()).toEqual([
          "species_aqualing", "species_cave_bat", "species_ember_drake", "species_forest_hornet",
          "species_king_slime", "species_leafling", "species_mine_skeleton", "species_sparkit",
          "species_stone_golem", "species_wild_slime",
        ]);
        expect(bySpecies.species_wild_slime).toBe("generated-enemy-slime-green");
        expect(bySpecies.species_king_slime).toBe("generated-enemy-slime-green");
        expect(bySpecies.species_cave_bat).toBe("generated-enemy-bat-cave");
        expect(bySpecies.species_stone_golem).toBe("generated-enemy-golem-stone");
        expect(bySpecies.species_ember_drake).toBe("generated-enemy-dragon-blue");
        expect(bySpecies.species_leafling).toBe("generated-enemy-leafling-01");
        expect(bySpecies.species_forest_hornet).toBe("generated-enemy-bee-giant");
        expect(bySpecies.species_sparkit).toBe("generated-enemy-sparkit-fire");
        expect(bySpecies.species_aqualing).toBe("generated-enemy-spirit-water");
        expect(bySpecies.species_mine_skeleton).toBe("generated-enemy-ghost-pale");
        for (const id of ["species_leafling", "species_sparkit", "species_aqualing"]) {
          expect(project.database.monsterSpecies?.find((species) => species.id === id)?.graphic.graphicHue).toBe(0);
        }
        expect(project.database.monsterSpecies?.find((species) => species.id === "species_sparkit")?.types).toEqual(["fire"]);
        for (const id of Object.values(bySpecies)) {
          expect(resolveAssetResourceUrl(id), id).toBeTruthy();
        }
      });

      it("uses distinct item and equipment icons for similar gear tiers", () => {
        const project = createBlankProject();
        const iron = project.database.equipment.find((entry) => entry.id === "equip_iron_sword");
        const steel = project.database.equipment.find((entry) => entry.id === "equip_steel_sword");
        const bronze = project.database.equipment.find((entry) => entry.id === "equip_sword");
        expect(bronze?.iconResourceId).toBe("cc0-jetrel-bronze-sword");
        expect(iron?.iconResourceId).toBe("cc0-jetrel-iron-sword");
        expect(steel?.iconResourceId).toBe("cc0-jetrel-steel-sword");

        const capture = project.database.items.find((item) => item.id === "item_capture_orb");
        const hiPotion = project.database.items.find((item) => item.id === "item_hi_potion");
        const elixir = project.database.items.find((item) => item.id === "item_elixir");
        const panacea = project.database.items.find((item) => item.id === "item_panacea");
        expect(capture?.iconResourceId).toBe("cc0-jetrel-capture-orb");
        expect(hiPotion?.iconResourceId).toBe("cc0-jetrel-hi-potion");
        expect(elixir?.iconResourceId).toBe("cc0-jetrel-elixir");
        expect(panacea?.iconResourceId).toBe("cc0-jetrel-panacea");

        for (const id of [
          bronze?.iconResourceId,
          iron?.iconResourceId,
          steel?.iconResourceId,
          capture?.iconResourceId,
          hiPotion?.iconResourceId,
          elixir?.iconResourceId,
          panacea?.iconResourceId,
        ]) {
          expect(resolveAssetResourceUrl(id), String(id)).toBeTruthy();
        }
      });

      it("seeds dungeon bone guards with bundled ghost-pale art instead of bat art", () => {
        const project = createBlankProject();
        const { enemies } = seedHomeDungeonComplexTroops(project);
        const bone = enemies.find((enemy) => enemy.id === "enemy_stone_bone_guard");
        expect(bone?.monsterResourceId).toBe("generated-enemy-ghost-pale");
        expect(resolveAssetResourceUrl("generated-enemy-ghost-pale")).toBe(
          "/assets/generated/pixel-enemy-portraits/ghost-pale.png",
        );
      });
    });
  });
});

describe("defaultAssets", () => {
  isolateTimers();
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
});

describe("defaultDatabaseBattleRecords", () => {
  isolateTimers();
  describe("actionEnemyAuthoring", () => {
    isolateTimers();
    // 광산 1층(map_mine_1f)이 스폰하는 적 + 원거리 적의 액션 프로필 저작 계약.
    // 정규화를 통과한 레코드가 의도한 공격 kind 와 0 이상의 데미지를 유지하고,
    // 기본 주인공(공격력 45, 보너스 0)의 조준 스윙으로 죽이려면 3~8방이 필요해야 한다.
    // rand = () => 0.5 는 variance 1.0 (분산 없음) 이므로 계산이 결정적이다.

    const NO_VARIANCE = () => 0.5;
    const DEFAULT_PLAYER_ATTACK = 45;
    const SWING_BONUS = 0;
    function findEnemy(id: string) {
      const enemy = defaultBattleRecords().enemies.find((e) => e.id === id);
      expect(enemy, `${id} 레코드가 기본 DB 에 있어야 한다`).toBeTruthy();
      return enemy!;
    }
    function swingsToKill(maxHp: number, defense: number): number {
      let hp = maxHp;
      let swings = 0;
      while (hp > 0 && swings < 1000) {
        hp -= computeSwingDamage({
          attackerAttack: DEFAULT_PLAYER_ATTACK,
          defenderDefense: defense,
          bonus: SWING_BONUS,
          rand: NO_VARIANCE,
        });
        swings += 1;
      }
      return swings;
    }
    describe("광산 적 액션 프로필 저작", () => {
      it("동굴 박쥐 — 빠른 근접 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
        const raw = findEnemy("enemy_cave_bat");
        expect(raw.stats.maxHp).toBeGreaterThan(25); // 리밸런스: 원래 25 는 한방 컷이었다
        const profile = normalizeEnemyActionProfile(raw.actionProfile);
        expect(profile).toBeTruthy();
        expect(profile!.attack!.kind).toBe("melee");
        expect(profile!.attack!.damage).toBeGreaterThan(0);
        // 빠른 근접: 짧은 선딜
        expect(profile!.attack!.windupMs).toBeLessThan(500);
        expect(profile!.contactDamage).toBeGreaterThan(0);
        expect(profile!.aggroRange).toBeGreaterThan(0);
        expect(profile!.moveIntervalMs).toBeGreaterThan(0);
        expect(profile!.knockbackResist).toBeGreaterThanOrEqual(0);

        const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
        expect(swings).toBeGreaterThanOrEqual(3);
        expect(swings).toBeLessThanOrEqual(8);
      });

      it("돌 골렘 — 무거운 근접 공격(긴 선딜/높은 데미지) 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
        const raw = findEnemy("enemy_stone_golem");
        expect(raw.stats.maxHp).toBeGreaterThan(30); // 리밸런스: 원래 30
        const profile = normalizeEnemyActionProfile(raw.actionProfile);
        expect(profile).toBeTruthy();
        expect(profile!.attack!.kind).toBe("melee");
        expect(profile!.attack!.damage).toBeGreaterThan(0);
        // 무거운 근접: 긴 선딜(텔레그래프) + 박쥐보다 높은 데미지
        expect(profile!.attack!.windupMs).toBeGreaterThanOrEqual(900);
        expect(profile!.attack!.damage).toBeGreaterThan(14);
        expect(profile!.contactDamage).toBeGreaterThan(0);
        expect(profile!.knockbackResist).toBeGreaterThan(0); // 무거워서 밀리지 않는다

        const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
        expect(swings).toBeGreaterThanOrEqual(3);
        expect(swings).toBeLessThanOrEqual(8);
      });

      it("광산 해골 궁수 — 투사체 공격 프로필이 정규화를 통과하고 3~8방에 죽는다", () => {
        const raw = findEnemy("enemy_mine_skel_archer");
        const profile = normalizeEnemyActionProfile(raw.actionProfile);
        expect(profile).toBeTruthy();
        expect(profile!.attack!.kind).toBe("projectile");
        expect(profile!.attack!.damage).toBeGreaterThan(0);
        expect(profile!.attack!.range).toBeGreaterThan(1); // 근접 부채꼴보다 먼 사거리
        expect(profile!.contactDamage).toBeGreaterThan(0);
        expect(profile!.aggroRange).toBeGreaterThan(0);
        expect(profile!.moveIntervalMs).toBeGreaterThan(0);

        const swings = swingsToKill(raw.stats.maxHp, raw.stats.defense);
        expect(swings).toBeGreaterThanOrEqual(3);
        expect(swings).toBeLessThanOrEqual(8);
      });

      it("적 타격 데미지가 기본 주인공(maxHp 514)에게 의미 있어야 한다 — 안 피하면 60초 안에 죽는다", () => {
        // 순수 산수 검증: 각 적의 (공격 사이클 데미지)가 유의미한 비중이어야 한다.
        const bat = normalizeEnemyActionProfile(findEnemy("enemy_cave_bat").actionProfile)!;
        const golem = normalizeEnemyActionProfile(findEnemy("enemy_stone_golem").actionProfile)!;
        const archer = normalizeEnemyActionProfile(findEnemy("enemy_mine_skel_archer").actionProfile)!;
        // 박쥐 사이클: windup+recover+cooldown 동안 damage 한 방.
        const batDps = (bat.attack!.damage + bat.contactDamage!) / ((bat.attack!.windupMs + bat.attack!.recoverMs + bat.attack!.cooldownMs!) / 1000);
        // 골렘은 텔레그래프가 길지만 한 방이 무겁다.
        const golemDps = (golem.attack!.damage + golem.contactDamage!) / ((golem.attack!.windupMs + golem.attack!.recoverMs + golem.attack!.cooldownMs!) / 1000);
        // 궁수는 원거리에서 사격.
        const archerDps = (archer.attack!.damage + archer.contactDamage!) / ((archer.attack!.windupMs + archer.attack!.recoverMs + archer.attack!.cooldownMs!) / 1000);
        // 어떤 적이든 계속 붙어 있으면 60초 안에 514 를 깎을 수 있어야 한다 → 평균 DPS >= 9.
        expect(batDps).toBeGreaterThanOrEqual(9);
        expect(golemDps).toBeGreaterThanOrEqual(9);
        expect(archerDps).toBeGreaterThanOrEqual(9);
      });
    });
  });
  describe("generatedEnemyBattlers", () => {
    isolateTimers();
    /** 알파 0 화소의 RGB 를 0 으로 맞춘 사본 — 투명 칸에 남은 RGB 찌꺼기를 비교에서 뺀다. */
    function visibleBytes(rgba: Buffer): Buffer {
      const out = Buffer.from(rgba);
      for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out.fill(0, i, i + 3);
      return out;
    }
    describe("native enemy battler files", () => {
      it("resolves every registered generated enemy to an existing public image", () => {
        const ids = builtinGeneratedResourceIds().filter((id) => id.startsWith("generated-enemy-"));
        expect(ids.length).toBeGreaterThanOrEqual(44);
        for (const id of ids) {
          const url = resolveAssetResourceUrl(id);
          expect(url, id).not.toBeNull();
          expect(existsSync(`public${url}`), `${id} -> ${url}`).toBe(true);
          expect(url).not.toContain("/starter/monster-");
          expect(url).not.toContain("/generated/monsters/");
        }
      });

      it("uses one exact idle cell for whole-image consumers rather than exposing a pose grid", () => {
        for (const sheet of PIXEL_ENEMY_SHEETS) {
          const cell = pixelEnemyCell(sheet);
          const { cols, rows } = pixelEnemyGridDims(sheet.grid);
          const source = PNG.sync.read(readFileSync(`public/${sheet.path}`));
          const portraitPath = pixelEnemyPortraitPath(sheet);
          const portrait = PNG.sync.read(readFileSync(`public/${portraitPath}`));
          expect(resolveAssetResourceUrl(sheet.resourceId)).toBe(`/${portraitPath}`);
          expect([source.width, source.height]).toEqual([cell * cols, cell * rows]);
          expect([portrait.width, portrait.height]).toEqual([cell, cell]);
          // 완전 투명 칸의 RGB 는 그림이 아니다 — 보이는 화소만 같아야 한다.
          for (let y = 0; y < cell; y++) {
            expect(visibleBytes(portrait.data.subarray(y * cell * 4, (y + 1) * cell * 4)).equals(
              visibleBytes(source.data.subarray(y * source.width * 4, (y * source.width + cell) * 4)),
            ), sheet.resourceId).toBe(true);
          }
        }
      });

      it("retains named saved-project aliases without recreating the numeric filler pool", () => {
        expect(resolveAssetResourceUrl("generated-enemy-zombie-01-enemy_extra_016")).toBe(resolveAssetResourceUrl("generated-enemy-zombie-01"));
        expect(resolveAssetResourceUrl("generated-enemy-skeleton-01-enemy_extra_038")).toBe(resolveAssetResourceUrl("generated-enemy-skeleton-01"));
        expect(resolveAssetResourceUrl("enemy_extra_016")).toBeNull();
        expect(defaultBattleRecords().enemies.filter((enemy) => /^enemy_extra_\d+$/.test(enemy.id))).toEqual([]);
      });

      it("gives every common default enemy a resolvable bundled resource", () => {
        const missing = defaultBattleRecords().enemies
          .filter((enemy) => enemy.monsterResourceId && !resolveAssetResourceUrl(enemy.monsterResourceId))
          .map((enemy) => `${enemy.id} -> ${enemy.monsterResourceId}`);
        expect(missing).toEqual([]);
      });

      it("uses the already selected collect-species sprite for sparkit-fire", () => {
        expect(resolveAssetResourceUrl("generated-enemy-sparkit-fire")).toBe("/assets/harnesses/monster-collect-species/sparkit/front.png");
      });
    });
  });
  describe("monsterRebalanceBands", () => {
    isolateTimers();
    // 106종 권장 레벨 기준 TTK/TTD 밴드 회귀 — 전투 공식 변경 시 가장 먼저 깨진다.
    // 영웅 스탯은 런타임 배틀러(액터 곡선 + 초기 장비)에서 읽는다. 클래스 곡선만 보면
    // L1 HP 40 / 공격 22로 실제(HP 514 / 공격 53)와 달라 밴드가 무의미해진다.
    const project = createBlankProject();
    function heroAt(level: number): { atk: number; def: number; hp: number; agi: number } {
      const hero = actorBattlers(project, { levels: { actor_hero: level }, partyActorIds: ["actor_hero"] })[0]!;
      return { atk: hero.attackPower, def: hero.defense, hp: hero.maxHp, agi: hero.agility };
    }
    // 적이 기본 부대에서 몇 마리 묶음으로 나오는지 — 무리 적은 개체 HP를 나눠 가진다.
    const groupSize = new Map<string, number>();
    beforeAll(() => {
      for (const troop of project.database.troops) {
        for (const id of troop.enemyIds) groupSize.set(id, Math.max(groupSize.get(id) ?? 0, troop.enemyIds.length));
      }
    });
    const basicDamage = (atk: number, def: number): number =>
      Math.max(1, Math.round(atk + Math.floor(atk / 2)) - Math.floor(def / 2));
    describe("monster rebalance bands", () => {
      it("106종 전원이 권장 레벨 기준 TTK/TTD 밴드 안에 있다", () => {
        const battle = defaultBattleRecords();
        expect(battle.enemies).toHaveLength(106);
        const violations: string[] = [];
        for (const enemy of battle.enemies) {
          const level = enemy.level ?? 1;
          const hero = heroAt(Math.min(50, Math.max(1, level)));
          const group = groupSize.get(enemy.id) ?? 1;
          // 부대 전체를 평타로 지우는 데 드는 타수, 부대 전체가 영웅을 쓰러뜨리는 데 드는 타수.
          const ttk = (enemy.stats.maxHp * group) / Math.max(1, basicDamage(hero.atk, enemy.stats.defense));
          const ttd = hero.hp / Math.max(1, basicDamage(enemy.stats.attack, hero.def) * group);
          const boss = enemy.rewards.exp >= 200;
          const ttkOk = boss ? ttk >= 6 && ttk <= 12 : ttk >= 3 && ttk <= 8; // 상한 8: 무리 속 탱커(돌 골렘)
          const ttdOk = boss ? ttd >= 4 && ttd <= 8 : ttd >= 3 && ttd <= 14;
          if (!ttkOk || !ttdOk) {
            violations.push(`${enemy.id} L${level} TTK ${ttk.toFixed(1)} TTD ${ttd.toFixed(1)}`);
          }
        }
        expect(violations, `밴드 이탈: ${violations.join(", ")}`).toEqual([]);
      });

      it("적 민첩은 같은 레벨 영웅의 70~80%라 게이지 턴을 실제로 받는다", () => {
        const odd = defaultBattleRecords()
          .enemies.map((e) => ({ id: e.id, ratio: e.stats.agility / heroAt(Math.max(1, e.level ?? 1)).agi }))
          .filter((r) => r.ratio < 0.7 || r.ratio > 0.8)
          .map((r) => `${r.id}(${r.ratio.toFixed(2)})`);
        expect(odd).toEqual([]);
      });

      it("mind = attack 규약이 106종 전체에 성립한다", () => {
        const odd = defaultBattleRecords()
          .enemies.filter((e) => e.stats.mind !== e.stats.attack)
          .map((e) => e.id);
        expect(odd).toEqual([]);
      });

      it("레벨이 1..99 안에 있고 역전은 수생→보스 경계 1건뿐이다", () => {
        const enemies = defaultBattleRecords().enemies;
        expect(enemies.every((e) => (e.level ?? 1) >= 1 && (e.level ?? 1) <= 99)).toBe(true);
        const sliced = enemies.slice(6);
        const inversions: string[] = [];
        sliced.forEach((enemy, i) => {
          if (i > 0 && (enemy.level ?? 1) < (sliced[i - 1]?.level ?? 1)) {
            inversions.push(`${enemy.id} L${enemy.level ?? 1}`);
          }
        });
        expect(inversions).toEqual(["enemy_dragon_whelp L36"]);
      });

      it("보상은 처치 코스트(HP)에 비례한다 — exp/hp 비율이 밴드 안에 있다", () => {
        const odd = defaultBattleRecords()
          .enemies.map((e) => ({ id: e.id, ratio: e.rewards.exp / Math.max(1, e.stats.maxHp) }))
          .filter((r) => r.ratio < 0.3 || r.ratio > 0.55)
          .map((r) => `${r.id}(${r.ratio.toFixed(2)})`);
        expect(odd).toEqual([]);
      });
    });
  });
});

describe("defaultDatabaseIconResources", () => {
  isolateTimers();
  // test/bootNormalizerReferenceSafety.test.ts
  // 계약: 부팅 정규화기는 프로젝트의 참조 무결성을 깨지 않는다.
  //
  // 현재 계약(2026-09-05): 기존 행의 이미지 연결만 보정하고 삭제한 카탈로그는 복구하지 않는다.
  // 과거 결함 근거(2026-08-30): `ensureDefaultDatabaseIconResources` 는 이름과 달리 기본 아이템 카탈로그
  // 187종을 프로젝트에 밀어넣는다. 그 아이템들은 기본 스킬·상태를 참조하므로, 자기 스킬·상태 세트가
  // 더 작은 프로젝트(예제 어드벤처 = 이슬 장터: items 21 / skills 21 / states 5)에 아이템만 넣으면
  // 참조 위반이 82건 생겼다. 그 상태에서 AI 런의 run_lint 가 레이어 검증을 3회 연속 실패시켜 런이
  // 죽었고, 에이전트가 고아 레코드를 지우려 하면 커밋 게이트가 같은 왕복 오류로 거부해 청소가
  // 불가능한 교착이 됐다.
  describe("bootNormalizerReferenceSafety", () => {
    isolateTimers();
    /** store.normalizeCurrentProject 가 부팅마다 도는 두 DB 정규화기(선언 순서 그대로). */
    function runBootDatabaseNormalizers(project: ReturnType<typeof createBlankProject>): void {
      ensureDefaultDatabaseIconResources(project);
      ensureBundledBattleAnimations(project);
    }
    describe("boot normalizers keep reference integrity", () => {
      it("빈 프로젝트도 정규화 후 참조 위반 0건 (기본 세트 자체는 자기충족적이다)", () => {
        const project = createBlankProject();
        runBootDatabaseNormalizers(project);
        expect(collectProjectReferenceIssues(project)).toEqual([]);
      });

      it("아이콘 보정은 삭제한 카탈로그 행이나 그 의존성을 재주입하지 않는다", () => {
        const project = createBlankProject();
        project.database.items = [];
        project.database.equipment = [];
        project.database.skills = [];
        project.database.states = [];

        expect(ensureDefaultDatabaseIconResources(project)).toBe(false);

        expect(project.database.items).toEqual([]);
        expect(project.database.equipment).toEqual([]);
        expect(project.database.skills).toEqual([]);
        expect(project.database.states).toEqual([]);
      });

      it("기존 아이템의 스킬·상태 참조를 유지한다", () => {
        const project = createScarloxyDemoProject();
        // 아이콘 연결만 보정한 뒤에도 모든 기존 효과 참조가 유효하다.
        ensureDefaultDatabaseIconResources(project);
        const skillIds = new Set(project.database.skills.map((skill) => skill.id));
        const stateIds = new Set([...project.database.states.map((state) => state.id), "state_death"]);
        for (const item of project.database.items) {
          for (const id of [item.skillId, item.learnedSkillId, item.activateSkillId]) {
            if (typeof id === "string" && id !== "") expect(skillIds.has(id)).toBe(true);
          }
          for (const effect of item.stateEffects) expect(stateIds.has(effect.stateId)).toBe(true);
          for (const id of item.healStateIds) expect(stateIds.has(id)).toBe(true);
        }
      });
    });
  });
  describe("defaultEquipmentBackfill", () => {
    isolateTimers();
    describe("default equipment backfill", () => {
      it("preserves the existing equipment catalog without adding missing defaults", () => {
        const project = createScarloxyDemoProject();
        const existingEquipment = project.database.equipment[0];
        if (existingEquipment === undefined) throw new Error("sample project has no equipment");
        existingEquipment.name = "사용자 편집 장비";

        const before = project.database.equipment.map((entry) => entry.id);
        ensureDefaultDatabaseIconResources(project);
        expect(project.database.equipment.find((equipment) => equipment.id === existingEquipment.id)?.name).toBe(
          "사용자 편집 장비",
        );

        expect(project.database.equipment.map((entry) => entry.id)).toEqual(before);
      });
    });
  });
  describe("itemEquipmentAuthoringTrust", () => {
    isolateTimers();
    let restore: () => void;
    beforeEach(() => { restore = installFakeDom(); store.replace(createBlankProject()); });
    afterEach(() => restore());
    const item = () => store.getCurrent().database.items[0]!;
    function form() {
      const node = document.createElement("section") as unknown as FakeElement;
      renderItemRecordForm(node as unknown as HTMLElement, item(), () => undefined);
      return node;
    }
    function field(node: FakeElement, id: string) {
      const result = findByTestId(node, id);
      if (!result) throw new Error(`Missing ${id}`);
      return result;
    }
    function select(node: FakeElement, id: string, value: string) {
      const control = field(node, id);
      control.value = value;
      control.dispatchEvent(new Event("change"));
    }
    it("uses one occasion control and restores field+battle after a field-only edit", () => {
      const node = form();
      select(node, "db-field-item-occasion", "field");
      expect(itemAllowsMenu(item())).toBe(true);
      expect(itemAllowsBattle(item())).toBe(false);
      select(node, "db-field-item-occasion", "always");
      expect(item()).toMatchObject({ occasionField: true, occasionBattle: true, onlyUsableInMenu: false });
      expect(itemAllowsBattle(item())).toBe(true);
      expect(field(node, "db-item-story-occasion").textContent).toContain("전투");
    });
    it("preserves inactive book settings through serialization without teaching a skill as medicine", () => {
      const skill = store.getCurrent().database.skills[0]!;
      updateDatabaseRecord("items", item().id, { type: "book", learnedSkillId: skill.id, skillId: skill.id, usableActorIds: [], usableClassIds: [], hpRecovery: { flat: 50, percentMax: 0 } });
      select(form(), "db-field-item-type", "medicine");
      const project = deserialize(serialize(store.getCurrent()));
      const saved = project.database.items.find((entry) => entry.id === item().id)!;
      const actor = project.database.actors[0]!;
      const session = startSession(project);
      session.inventory[saved.id] = 2;
      session.actorSkillIds = { [actor.id]: [] };
      session.actorVitals[actor.id]!.hp = 1;
      expect(saved.learnedSkillId).toBe(skill.id);
      expect(useItemFromMenu(project, session, saved.id, actor.id).kind).toBe("used");
      expect(session.actorSkillIds[actor.id]).toEqual([]);
      expect(session.actorVitals[actor.id]!.hp).toBe(51);
      expect(itemEffectStory(project, saved).effects.some((effect) => effect.includes("스킬 습득"))).toBe(false);
    });
    it("inactive recovery and seed settings cannot be used by a normal good", () => {
      select(form(), "db-field-item-type", "normalGoods");
      const project = store.getCurrent(), actor = project.database.actors[0]!;
      const session = startSession(project);
      session.inventory[item().id] = 1;
      session.actorVitals[actor.id]!.hp = 1;
      expect(useItemFromMenu(project, session, item().id, actor.id).kind).toBe("unusable");
      expect(session.inventory[item().id]).toBe(1);
    });
    it("infers legacy skill items without overriding an explicitly authored ordinary-good kind", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      const legacy = normalizeItemRecord({ id: "legacy_skill_item", name: "이전 스킬 물품", skillId });
      expect(legacy.type).toBe("special");
      const project = store.getCurrent();
      project.database.items.push(legacy);
      expect(deserialize(serialize(project)).database.items.find((entry) => entry.id === legacy.id)?.type).toBe("special");
      const explicit = normalizeItemRecord({ ...legacy, type: "normalGoods" });
      expect(explicit.type).toBe("normalGoods");
      expect(itemEffectStory(project, explicit).effects).toEqual(["직접 효과 없음"]);
    });
    it("preserves deleted default rows through save/load and the boot normalizer", () => {
      const project = createBlankProject();
      const deletedItem = project.database.items.pop()!, deletedEquipment = project.database.equipment.pop()!;
      const reloaded = deserialize(serialize(project));
      ensureDefaultDatabaseIconResources(reloaded);
      expect(reloaded.database.items.some((entry) => entry.id === deletedItem.id)).toBe(false);
      expect(reloaded.database.equipment.some((entry) => entry.id === deletedEquipment.id)).toBe(false);
    });
    it("has a single special-item skill selector and refreshes scope immediately", () => {
      updateDatabaseRecord("items", item().id, { type: "special", scope: "ally" });
      const node = form(), skill = store.getCurrent().database.skills[1]!;
      expect(findByTestId(node, "db-picker-skill")).toBeNull();
      expect(findByTestId(node, "db-item-card-usable")).toBeNull();
      expect(findByTestId(node, "db-field-item-usage-message")).toBeNull();
      select(node, "db-picker-item-activate-skill", skill.id);
      expect(item()).toMatchObject({ skillId: skill.id, activateSkillId: skill.id });
      select(node, "db-field-scope", "enemy");
      expect(field(node, "db-item-story-target").textContent).toContain("적");
    });
    it("makes reusable/finite/single use explicit and the runtime respects them", () => {
      const node = form();
      expect(field(node, "db-field-item-consumption-limit").textContent).not.toContain("제한 없음");
      select(node, "db-field-item-consumption-limit", "reusable");
      expect(transitionItemState({ inventory: { [item().id]: 2 } }, [item()], { kind: "successfulUse", itemId: item().id }).inventory[item().id]).toBe(2);
      select(node, "db-field-item-consumption-limit", "2");
      const once = transitionItemState({ inventory: { [item().id]: 2 } }, [item()], { kind: "successfulUse", itemId: item().id });
      expect(once.inventory[item().id]).toBe(2);
      expect(transitionItemState(once, [item()], { kind: "successfulUse", itemId: item().id }).inventory[item().id]).toBe(1);
    });
    it("capture mode hides the saved skill effect and does not hide medicine controls after a type change", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      updateDatabaseRecord("items", item().id, { type: "special", activateSkillId: skillId, skillId, captureProfile: { multiplier: 2 } });
      const node = form();
      expect(findByTestId(node, "db-picker-item-activate-skill")).toBeNull();
      expect(itemEffectStory(store.getCurrent(), item()).effects).toEqual(["포획 배율 ×2"]);
      select(node, "db-field-item-type", "medicine");
      expect(item().captureProfile).toEqual({ multiplier: 2 });
      expect(findByTestId(form(), "db-item-card-state-effects")).not.toBeNull();
      expect(itemEffectStory(store.getCurrent(), item()).effects).not.toContain("포획 배율 ×2");
    });
    it("does not offer new equipment types in Items", () => {
      const choices = field(form(), "db-field-item-type").children.map((option) => option.attrs.value);
      expect(choices).not.toContain("weapon");
      expect(choices).not.toContain("shield");
    });
    it("does not advertise unsupported flags and keeps one attack element input", () => {
      const record = store.getCurrent().database.equipment[0]!;
      // halfMpCost 는 전투 MP 소모 계산이 소비하므로 저작 가능한 플래그다(mgL3HalfMpCost 테스트).
      // 여전히 런타임에 없는 플래그(선제 공격)는 토글 없이 「적용되지 않는 효과」 안내로만 남는다.
      record.effectFlags.halfMpCost = true;
      record.effectFlags.preemptive = true;
      const node = document.createElement("section") as unknown as FakeElement;
      renderEquipmentRecordForm(node as unknown as HTMLElement, record);
      expect(findByTestId(node, "db-field-equipment-effect-half-mp")).not.toBeNull();
      expect(findByTestId(node, "db-field-equipment-effect-preemptive")).toBeNull();
      expect(field(node, "db-equipment-unsupported-effects").textContent).toContain("선제 공격");
      expect(field(node, "db-equipment-unsupported-effects").textContent).not.toContain("MP 소모 절반");
      expect(equipmentEffectStory(store.getCurrent(), record).effects).toContain("MP 소모 절반");
      expect(equipmentEffectStory(store.getCurrent(), record).effects).not.toContain("선제 공격");
      expect(findByTestId(node, "db-picker-skill")).toBeNull();
      select(node, "db-field-equipment-attack-element", "fire");
      expect(store.getCurrent().database.equipment[0]!.attackElementIds).toEqual(["fire"]);
    });
    it("a legacy inflict record cannot disable another equipment's state resistance", () => {
      const project = store.getCurrent(), actor = project.database.actors[0]!;
      const shield = normalizeEquipmentRecord({ id: "audit_shield", name: "방어", slot: "shield", equippableActorIds: [actor.id], stateDefenseIds: ["state_poison"], stateDefenseMode: "resist", stateResistanceChance: 100 });
      const weapon = normalizeEquipmentRecord({ id: "audit_weapon", name: "이전 장비", slot: "weapon", equippableActorIds: [actor.id], stateDefenseIds: ["state_sleep"], stateDefenseMode: "inflict", stateResistanceChance: 100 });
      project.database.equipment.push(shield, weapon);
      actor.initialEquipment = { weapon: weapon.id, shield: shield.id };
      const effects = actorBattlers(project, { partyActorIds: [actor.id] })[0]!.equipmentEffects;
      expect(effects.stateDefenseMode).toBe("resist");
      expect(effects.stateDefenseIds).toEqual(["state_poison"]);
    });
  });
});

describe("defaultElementAffinities", () => {
  isolateTimers();
  describe("기본 적 예시 상성 (qa1124 8-2·8-3)", () => {
    it("새 프로젝트 기본 적에 약점이 생기고 골렘은 타격 2배다", () => {
      const project = createBlankProject();
      expect(project.database.enemies.some((enemy) => Object.values(enemy.elementRates ?? {}).some((grade) => grade !== "C"))).toBe(false);
      const changed = applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
      expect(changed).toBeGreaterThan(0);
      const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
      expect(golem.elementRates?.hit).toBe("A");
      expect(elementMultiplierFor(project, "hit", golem.id)).toBe(2);
      expect(affinitySentences(project, "hit").length).toBeGreaterThan(0);
    });

    it("작가가 정한 등급은 덮지 않는다", () => {
      const project = createBlankProject();
      const golem = project.database.enemies.find((enemy) => enemy.id === "enemy_stone_golem")!;
      golem.elementRates = { ...golem.elementRates, hit: "E" };
      applyDefaultElementAffinities(project.database.enemies, project.database.elements ?? []);
      expect(golem.elementRates.hit).toBe("E");
    });

    it("한 번 누르면 보통 → 2배 → 1.5배 → 절반 → 무효 → 보통", () => {
      expect(["C", "A", "B", "D", "E"].map((grade) => nextAffinityGrade(grade as never))).toEqual(["A", "B", "D", "E", "C"]);
    });
  });
});
