import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { recordConnections } from "@/editor/databaseRecordConnections";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { databaseRecordNameById, diffDatabaseRecords } from "@/project/databaseRecordDiff";
import type { Project, DatabaseRecords, EventPage, GameEvent, ProjectFactions, EnemyActionCondition, FarmAnimalBuildingDefinition, FarmAnimalSpeciesRecord, GameMap, AutotileGroup, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { type DatabaseCollection, updateDatabaseRecord } from "@/editor/databaseActions";
import { FakeElement, installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { getDatabaseActiveTab, renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetRecordViewSessionState, selectedRecordIdForSession, setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { getSelectedMonsterSpeciesId, setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { deriveSkillComposerModel } from "@/editor/panels/databaseSkillComposerModel";
import { store } from "@/project/store";
import { renderTerrainTab } from "@/editor/panels/databaseUtilityRecordViews";
import { getMapEditHistoryEntries, resetMapEditHistory, getMapEditHistoryState, undoMapEdit } from "@/editor/mapEditHistory";
import { renderSystemTab, parseEmotionCycle } from "@/editor/panels/databaseSystemView";
import { normalizeTypeChart, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { renderSwitchesTab, renderTermsTab, renderVariablesTab } from "@/editor/panels/databaseUtilityViews";
import { editorState } from "@/editor/editorState";
import { renderEventEditor, syncMountedEventSelection } from "@/editor/panels/eventEditor";
import { requestEditorCameraFocus, subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { applyFactionsFromWorldPlan, combatFactionIdFromWorldEntityId, planFactionsFromWorld, WORLD_ALLY_STANCE, WORLD_COMBAT_FACTION_ID_PATTERN, WORLD_ENEMY_STANCE } from "@/project/factionsFromWorld";
import { renameFaction } from "@/editor/panels/databaseFactionModel";
import { factionStance, normalizeProjectFactions, resolveFactionTable } from "@/project/factions";
import { deserialize, serialize } from "@/project/io";
import type { ProjectWorld, WorldEntity } from "@/project/world";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { troopIntentPanel } from "@/editor/panels/databaseTroopIntentPanel";
import fixture from "./fixtures/projects/battle-v3.json";
import { itemFields } from "@/editor/panels/databaseBasicRecordFields";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderTroopRecordForm } from "@/editor/panels/databaseTroopRecordView";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { IMAGE_GENERATION_MODEL, IMAGE_GENERATION_PROVIDER_ID, ImageGenerationError, generateAiImage, imageGenerationEndpoint, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { IMAGE_CHATGPT_LOGIN_REQUIRED, RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { defaultAiConfig } from "@/ai/llmClient";
import { closestLibraryPictures, imageFailureNextStep, isImageCredentialFailure } from "@/editor/imageGenerationFallback";
import { generateOpeningStill } from "@/editor/openingImageGeneration";
import { generateTitleArt } from "@/editor/titleArtGeneration";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { getTool } from "@/editor/tools";
import { IMAGE_GENERATION_UNAVAILABLE_CODE, imageGenerationFailureCode, imageGenerationUnavailableError, imageGenerationUnavailableInstruction, imageUnavailableGateNotice } from "@/editor/imageGenerationNotice";
import { isImageGenerationUnavailableResult, reportImageGenerationUnavailable } from "@/editor/panels/imageGenerationGate";
import { searchProject } from "@/editor/panels/mapEventSearchModel";
import { mapAiBadges } from "@/editor/panels/mapTreeAiBadges";
import { createMapRunQueue, type MapRunTicket } from "@/editor/aiMapRunQueue";
import { createAiThreadList, groupThreads, threadStates, type ThreadState } from "@/editor/aiThreadList";
import type { ConversationArchiveSummary } from "@/ai/conversationStore";
import type { OpenAssistantDecision } from "@/editor/panels/aiDecisionPrompt";
import type { Presence } from "@/editor/panels/aiPresence";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { collectProjectReferenceIssues, repairProjectReferences, validateProjectReferences } from "@/project/io/references";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { resetToastsForTest } from "@/util/toast";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, resolveSpatialBuildSource, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { listSpatialGalleryCards } from "../src/editor/panels/spatialCatalog";
import { own, spatialId, occurrenceOrigin } from "../src/project/spatial/domain";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { designUsage, matchesUsageFilter, usageSummary } from "@/editor/panels/spatialUsage";
import { instancesFixture } from "./support/spatialInstancesFixture";
import { renderCommitHistoryButton, renderIdentityTopbarControl, openLoginModalIfNeeded, openMockLoginModal, openCommitHistoryPanel, openIdentityMenu } from "@/editor/teamWorkflowUi";
import { listEditorCommands } from "@/editor/commandRegistry";
import { renderTopbar } from "@/editor/panels/menu";
import { setOwnerLabel } from "@/project/editorIdentity";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { setTilesetMetadataEditMode } from "@/editor/panels/tilesetMetadataEditor";
import { setChipsetGridEditing } from "@/editor/panels/tilesetChipsetPreview";
import { setTileBackingOverride, userTileBackingOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { autotilePaintTile, classifyTerrainChip, paletteCatalogFor, paletteHasSmartCatalog, prefabChips, prefabThumbTiles, searchPaletteCatalog } from "@/editor/panels/tilePaletteCatalog";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "@/project/defaults/joseonBaram";
import { autotileRepresentativeTile, buildCustomPaletteModel, buildGridPaletteModel, CUSTOM_PALETTE_MIN_CELL_SIZE, makeCustomPalette, makeGridPalette, GRID_PALETTE_COLUMNS, gridPaletteDisplayTile } from "@/editor/panels/tilePaletteGrid";
import { createPaletteStampFromDisplayDrag, createPaletteStampFromDrag, paletteStampIncludesTile } from "@/editor/tilePaletteStamp";

describe("editorPanelsSuite21", () => {
  isolateTimers();
  describe("databaseRecord", () => {
    isolateTimers();
    describe("databaseRecordConnections", () => {
      isolateTimers();
      describe("자료집 연결 칸 — 쓰는 곳·확인할 것", () => {
        it("직업을 쓰는 주인공을 전부 목록으로 낸다(삭제 메시지처럼 첫 건만이 아니다)", () => {
          const project = createBlankProject();
          const classId = project.database.classes[0]!.id;
          const users = project.database.actors.filter((actor) => actor.classId === classId);
          const { uses } = recordConnections(project, "classes", classId);
          const actorUses = uses.filter((use) => use.kind === "주인공");
          expect(actorUses.map((use) => use.target?.id)).toEqual(users.map((actor) => actor.id));
          for (const use of actorUses) expect(use.target?.collection).toBe("actors");
        });

        it("시작 파티 주인공은 시스템이 쓰는 곳으로 잡힌다", () => {
          const project = createBlankProject();
          const actorId = project.system.startActorIds[0]!;
          const { uses, checks } = recordConnections(project, "actors", actorId);
          expect(uses).toContainEqual({ kind: "시스템", name: "시작 파티" });
          expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
        });

        it("아무도 안 쓰는 몬스터는 확인할 것에 오른다", () => {
          const project = createBlankProject();
          const enemy = project.database.enemies[0]!;
          project.database.troops = project.database.troops.filter((troop) =>
            !troop.enemyIds.includes(enemy.id) && !troop.members?.some((member) => member.enemyId === enemy.id));
          const { uses, checks } = recordConnections(project, "enemies", enemy.id);
          expect(uses).toEqual([]);
          expect(checks).toContain("아직 아무 데서도 쓰지 않아요");
        });

        it("목록이 못 잡는 참조도 삭제 차단 검사가 찾으면 한 줄로 보인다", () => {
          const project = createBlankProject();
          const item = project.database.items[0]!;
          project.system.sellPrices = [{ itemId: item.id, price: 1 } as never];
          const { uses, checks } = recordConnections(project, "items", item.id);
          expect(uses.some((use) => use.kind === "다른 곳" && use.name.includes("판매 가격"))).toBe(true);
          expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
        });

        it("연결 칸 밖의 컬렉션은 빈 결과다", () => {
          const project = createBlankProject();
          expect(recordConnections(project, "battleAnimations", "anything")).toEqual({ uses: [], checks: [] });
        });
      });
    });
    describe("databaseRecordDiff", () => {
      isolateTimers();
      type Mutable<T> = { -readonly [K in keyof T]: T[K] };
      function withEnemy(project: Project, patch: Record<string, unknown>): Project {
        const next = structuredClone(project) as Mutable<Project>;
        const database = next.database as unknown as Record<string, unknown[]>;
        database.enemies = [
          {
            id: "enemy_imp", name: "임프", graphicHue: 0, transparent: false, flying: false,
            monsterResourceId: "generated-enemy-slime-01",
            stats: { maxHp: 64, maxMp: 0, attack: 12, defense: 8, mind: 4, agility: 9 },
            rewards: { exp: 5, gold: 3, dropRatePercent: 0 },
            skillIds: [], actions: [], stateRates: {}, elementRates: {},
            ...patch,
          },
        ];
        return next;
      }
      describe("diffDatabaseRecords — 레코드 단위 구조 diff", () => {
        it("중첩 능력치는 점 경로로 펴고 수치 델타를 계산한다", () => {
          const before = withEnemy(createBlankProject(), {});
          const after = withEnemy(createBlankProject(), {
            stats: { maxHp: 300, maxMp: 0, attack: 28, defense: 8, mind: 4, agility: 9 },
            rewards: { exp: 40, gold: 3, dropRatePercent: 5, dropItemId: "item_sword" },
          });
          const changes = diffDatabaseRecords(before, after);
          const imp = changes.find((change) => change.id === "enemy_imp");
          expect(imp).toBeDefined();
          expect(imp?.change).toBe("changed");
          expect(imp?.collection).toBe("enemies");
          expect(imp?.areaLabel).toBe("적");
          const byPath = new Map(imp!.fields.map((field) => [field.path, field]));
          expect(byPath.get("stats.maxHp")).toMatchObject({ label: "최대 HP", before: 64, after: 300, delta: 236 });
          expect(byPath.get("stats.attack")).toMatchObject({ label: "공격", delta: 16 });
          expect(byPath.get("rewards.exp")).toMatchObject({ label: "경험치", delta: 35 });
          expect(byPath.get("rewards.dropItemId")).toMatchObject({ label: "드롭 아이템", before: undefined, after: "item_sword", delta: null });
          expect(byPath.has("stats.defense")).toBe(false);
        });

        it("리소스 id 필드는 graphic 으로 표시한다", () => {
          const before = withEnemy(createBlankProject(), {});
          const after = withEnemy(createBlankProject(), { monsterResourceId: "generated-enemy-bat-01" });
          const [imp] = diffDatabaseRecords(before, after);
          expect(imp?.fields).toEqual([
            expect.objectContaining({ path: "monsterResourceId", label: "몬스터 그림", graphic: true, before: "generated-enemy-slime-01", after: "generated-enemy-bat-01" }),
          ]);
        });

        it("추가·삭제 레코드를 구분하고 삭제는 필드 없이 신원만 남긴다", () => {
          const before = withEnemy(createBlankProject(), {});
          const after = structuredClone(before) as Mutable<Project>;
          const database = after.database as unknown as Record<string, unknown[]>;
          database.enemies = [];
          database.items = [...(database.items ?? []), { id: "item_sword", name: "동검", price: 120, iconResourceId: "cc0-jetrel-wake-herb" }];
          const changes = diffDatabaseRecords(before, after);
          const removed = changes.find((change) => change.change === "removed");
          const added = changes.find((change) => change.change === "added");
          expect(removed).toMatchObject({ collection: "enemies", id: "enemy_imp", name: "임프", fields: [], after: null });
          expect(added).toMatchObject({ collection: "items", id: "item_sword", name: "동검", before: null });
          expect(added?.fields.map((field) => field.path)).toEqual(expect.arrayContaining(["price", "iconResourceId"]));
          // 이름은 카드 머리가 말하므로 필드 행에서 뺀다.
          expect(added?.fields.some((field) => field.path === "name")).toBe(false);
          expect(added?.fields.find((field) => field.path === "iconResourceId")?.graphic).toBe(true);
        });

        it("같은 프로젝트면 빈 목록이고 필드 상한을 넘으면 접힌 수를 알린다", () => {
          const project = withEnemy(createBlankProject(), {});
          expect(diffDatabaseRecords(project, project)).toEqual([]);
          const many = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`extra${index}`, index]));
          const after = withEnemy(createBlankProject(), many);
          const [imp] = diffDatabaseRecords(project, after, { maxFieldsPerRecord: 4 });
          expect(imp?.fields).toHaveLength(4);
          expect(imp?.hiddenFieldCount).toBe(2);
        });

        it("databaseRecordNameById 는 어느 컬렉션의 id 든 이름으로 바꾼다", () => {
          const project = withEnemy(createBlankProject(), {});
          expect(databaseRecordNameById(project, "enemy_imp")).toBe("임프");
          expect(databaseRecordNameById(project, "nope")).toBeNull();
        });
      });
    });
    describe("databaseRecordThumbnails", () => {
      isolateTimers();
      let restoreDom: (() => void) | undefined;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = undefined;
      });
      describe("database record list thumbnails", () => {
        it("returns collection-specific thumbnail slots for visual database records", () => {
          const project = createBlankProject();

          const actor = thumb("actors", project.database.actors[0], project);
          expect(actor.className).toContain("db-list-thumb");
          expect(actor.className).toContain("db-list-thumb-crop");
          expect(actor.style.backgroundImage).toContain("/assets/easyrpg/faceset/");

          const enemy = thumb("enemies", project.database.enemies[0], project);
          expect(enemy.className).toContain("db-list-thumb-image");
          expect(enemy.querySelector("img")?.attrs.src).toContain("/assets/");

          const item = thumb("items", project.database.items[0], project);
          expect(item.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

          const equipment = thumb("equipment", project.database.equipment[0], project);
          expect(equipment.querySelector("img")?.attrs.src).toContain("/assets/cc0/");

          const skill = thumb("skills", project.database.skills[0], project);
          expect(skill.className).toContain("db-list-thumb-animation");
          expect(skill.style.backgroundImage).toContain("/assets/generated/effects/");

          const animation = thumb("battleAnimations", project.database.battleAnimations[0], project);
          expect(animation.className).toContain("db-list-thumb-animation");
          // EasyRPG 전투 애니메이션 시트는 2026-10-07 저작권 정리로 지웠다 — 기본 애니메이션은 생성 효과 시트를 쓴다.
          expect(animation.style.backgroundImage).toContain("/assets/generated/effects/");
        });

        it("returns visual thumbnails for classes, troops, and states", () => {
          const project = createBlankProject();

          const klass = thumb("classes", project.database.classes[0], project);
          expect(klass.className).toContain("db-list-thumb");

          const troop = thumb("troops", project.database.troops[0], project);
          expect(troop.className).toContain("db-list-thumb");

          const state = thumb("states", project.database.states[0], project);
          expect(state.className).toContain("db-list-thumb-state");
          expect(state.style.backgroundColor).toMatch(/^#|rgb/i);
        });

        it("returns empty slots for missing supported resources", () => {
          const project = createBlankProject();
          const actor = { ...project.database.actors[0], faceResourceId: undefined };
          const empty = recordListThumbnail("actors", actor, project);
          expect(empty?.className).toContain("db-list-thumb");
          expect(empty?.className).toContain("empty");
        });

        // 얼굴 한 칸 = 파일 한 장 — 시트 오프셋이 아니라 그림 한 장이 슬롯을 채운다.
        it("renders the actor face image whole, with no sheet offset", () => {
          const project = createBlankProject();
          const actor = { ...project.database.actors[0] };
          const node = thumb("actors", actor, project);
          expect(node.style.backgroundPosition).toBe("center");
          expect(node.style.backgroundSize).toBe("32px 32px");
        });

        it("parameterized size scales the thumbnail while the default stays at 32px", () => {
          const project = createBlankProject();
          const actor = { ...project.database.actors[0] };

          // 기본(size 미지정)은 기존 32px 크롭과 동일하다 — 기존 호출부 계약 유지.
          const defaultNode = thumb("actors", actor, project);
          const explicit32 = recordListThumbnail("actors", actor, project, 32);
          if (!(explicit32 instanceof FakeElement)) throw new Error("expected fake element");
          expect(explicit32.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

          // 48px 은 배율 1.5 로 표시 크기가 커진다 (backgroundSize 첫 숫자 = 표시 크기).
          const large = recordListThumbnail("actors", actor, project, 48);
          if (!(large instanceof FakeElement)) throw new Error("expected fake element");
          expect(large.style.backgroundSize).not.toBe(defaultNode.style.backgroundSize);
          expect(firstPx(large.style.backgroundSize) / firstPx(defaultNode.style.backgroundSize)).toBeCloseTo(1.5);

          // 손상된 size(0/음수)는 32px 기본으로 폴백한다.
          const broken = recordListThumbnail("actors", actor, project, 0);
          if (!(broken instanceof FakeElement)) throw new Error("expected fake element");
          expect(broken.style.backgroundSize).toBe(defaultNode.style.backgroundSize);

          // 애니메이션 크롭도 size 를 따른다 (같은 1.5 배율).
          const animationDefault = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project);
          const animation = recordListThumbnail("battleAnimations", project.database.battleAnimations[0], project, 48);
          if (!(animation instanceof FakeElement) || !(animationDefault instanceof FakeElement)) throw new Error("expected fake element");
          expect(animation.style.backgroundSize).not.toBe(animationDefault.style.backgroundSize);
          expect(firstPx(animation.style.backgroundSize) / firstPx(animationDefault.style.backgroundSize)).toBeCloseTo(1.5);
        });
      });
      function thumb<C extends DatabaseCollection>(
        collection: C,
        record: DatabaseRecords[C][number] | undefined,
        project: ReturnType<typeof createBlankProject>
      ): FakeElement {
        if (!record) throw new Error(`Missing ${collection} record`);
        const node = recordListThumbnail(collection, record, project);
        if (node instanceof FakeElement) return node;
        throw new Error(`Expected ${collection} thumbnail`);
      }
      function firstPx(backgroundSize: string): number {
        return Number.parseFloat(backgroundSize) || 0;
      }
    });
  });
  describe("databaseSkillComposer", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    let previousImage: typeof Image | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousImage = globalThis.Image;
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: class {
          addEventListener(): void {
            // Thumbnail chroma-key loading is outside this DOM contract.
          }
        },
      });
      resetRecordViewSessionState();
      setSelectedMonsterSpeciesId(undefined);

      const project = createBlankProject();
      const skill = project.database.skills[0];
      const actor = project.database.actors[0];
      const klass = project.database.classes[0];
      const item = project.database.items[0];
      const equipment = project.database.equipment[0];
      if (!skill || !actor || !klass || !item || !equipment) throw new Error("missing database composer fixture");

      for (const entry of project.database.actors) entry.learnedSkills = [];
      for (const entry of project.database.classes) {
        entry.learnedSkills = [];
        entry.skillIds = [];
        entry.battleCommands = [];
      }
      for (const entry of project.database.items) {
        entry.skillId = undefined;
        entry.learnedSkillId = undefined;
        entry.activateSkillId = undefined;
      }
      for (const entry of project.database.equipment) {
        entry.skillId = undefined;
        entry.usableAsItemSkillId = undefined;
      }
      for (const entry of project.database.enemies) {
        entry.skillIds = [];
        entry.actions = [];
      }
      for (const entry of project.database.monsterSpecies ?? []) entry.skillsByLevel = [];

      skill.scope = "allEnemies";
      skill.type = "normal";
      skill.power = 42;
      skill.mpCost = { flat: 8, percentMax: 12 };
      skill.effect = { kind: "damage", statistic: "mind", affects: "hp" };
      skill.successRate = 90;
      skill.hitRate = 80;
      if (!project.database.elements?.[0] || !project.database.states[0] || !project.database.battleAnimations[0]) {
        throw new Error("missing skill summary fixture records");
      }
      project.database.elements[0].name = "불";
      project.database.states[0].name = "독";
      project.database.battleAnimations[0].name = "화염 폭발";
      skill.elementId = project.database.elements[0].id;
      skill.stateEffects = [
        { stateId: project.database.states[0]!.id, chance: 35, operation: "add" },
      ];
      skill.animationId = project.database.battleAnimations[0]?.id;

      actor.learnedSkills = [{ level: 3, skillId: skill.id }];
      klass.learnedSkills = [{ level: 5, skillId: skill.id }];
      klass.skillIds = [skill.id];
      item.skillId = undefined;
      item.activateSkillId = skill.id;
      equipment.skillId = undefined;
      equipment.usableAsItemSkillId = skill.id;
      const enemy = project.database.enemies[1];
      const species = project.database.monsterSpecies?.[1];
      if (!enemy || !species) throw new Error("missing non-first skill backlink fixtures");
      enemy.name = "두 번째 몬스터";
      enemy.skillIds = [skill.id];
      enemy.actions = [{
        skillId: skill.id,
        priority: 7,
        condition: { kind: "turn", start: 2, interval: 3 },
        switchOnAfterAction: { enabled: false },
        switchOffAfterAction: { enabled: false },
      }];
      species.name = "두 번째 종족";
      species.skillsByLevel = [{ level: 9, skillId: skill.id }];

      store.replace(project);
      setSelectedRecordId("skills", skill.id);
      setDatabaseActiveTab("skills");
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
      if (previousImage === undefined) Reflect.deleteProperty(globalThis, "Image");
      else Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
      previousImage = undefined;
    });
    describe("database skill ability composer", () => {
      it("derives readable chips and ordered effect summaries from existing fields", () => {
        // Break named: exposing raw enum/id values makes the composer another database ledger.
        const project = store.getCurrent();
        const skill = project.database.skills[0]!;
        const model = deriveSkillComposerModel(project, skill);

        expect(model.chips.map((chip) => chip.label)).toEqual([
          "일반 스킬",
          "적 전체",
          "MP 8 + 최대 MP 12%",
        ]);
        expect(model.effectBlocks.map((block) => [block.kind, block.summary])).toEqual([
          ["primary", "HP 피해 · 마력 기반 · 위력 42 · 성공 90% · 명중 80%"],
          ["element", "불"],
          ["states", "독 부여 35%"],
          ["animation", "화염 폭발"],
        ]);
      });

      it("finds every supported backlink field once and explains the relationship", () => {
        // Break named: checking only legacy skillId fields hides real learned/activated/command references.
        const project = store.getCurrent();
        const skill = project.database.skills[0]!;
        const klass = project.database.classes[0]!;
        const item = project.database.items[0]!;
        const equipment = project.database.equipment[0]!;
        const enemy = project.database.enemies[1]!;
        const species = project.database.monsterSpecies?.[1]!;

        klass.battleCommands = [
          { id: "command-skill", name: "전용기", kind: "skill", skillId: skill.id },
        ];
        item.skillId = skill.id;
        item.learnedSkillId = skill.id;
        item.activateSkillId = skill.id;
        equipment.skillId = skill.id;
        equipment.usableAsItemSkillId = skill.id;

        const model = deriveSkillComposerModel(project, skill);
        expect(model.backlinks.map(({ collection, id, relationship }) => ({ collection, id, relationship }))).toEqual([
          { collection: "actors", id: project.database.actors[0]!.id, relationship: "Lv 3 습득" },
          { collection: "classes", id: klass.id, relationship: "Lv 5 습득 · 전투 명령" },
          { collection: "items", id: item.id, relationship: "스킬 습득 · 스킬 발동" },
          { collection: "equipment", id: equipment.id, relationship: "장비 스킬 · 사용 스킬" },
          { collection: "enemies", id: enemy.id, relationship: "스킬 목록 · 행동 1" },
          { collection: "monsterSpecies", id: species.id, relationship: "Lv 9 습득" },
        ]);
      });

      it("states zero cost and empty optional effects without adding new runtime behavior", () => {
        // Break named: synthetic defaults can falsely imply an element, state, animation, or MP cost.
        const project = store.getCurrent();
        const skill = {
          ...project.database.skills[0]!,
          mpCost: { flat: 0, percentMax: 0 },
          elementId: undefined,
          stateEffects: [],
          animationId: undefined,
        };
        const model = deriveSkillComposerModel(project, skill);

        expect(model.chips.find((chip) => chip.kind === "cost")?.label).toBe("MP 소모 없음");
        expect(model.effectBlocks.slice(1).map((block) => block.summary)).toEqual([
          "무속성",
          "상태 변화 없음",
          "애니메이션 없음",
        ]);
      });

      it("shows activation, target, and cost chips with ordered authored effect blocks", () => {
        // Break named: removing the ability-composer projection leaves the skill detail as a raw field ledger.
        const panel = renderPanel();
        const composer = byTestId(panel, "db-skill-composer");

        expect(byTestId(composer, "db-skill-chip-activation").dataset.chipKind).toBe("activation");
        expect(byTestId(composer, "db-skill-chip-target").dataset.chipKind).toBe("target");
        expect(byTestId(composer, "db-skill-chip-cost").dataset.chipKind).toBe("cost");

        const blocks = composer.querySelectorAll(".db-skill-effect-block");
        expect(blocks.map((block) => block.dataset.effectKind)).toEqual([
          "primary",
          "element",
          "states",
          "animation",
        ]);
      });

      it("lists actor, class, item, and equipment backlinks that navigate inside the current modal", () => {
        // Break named: a backlink that reopens Database loses the current modal/session instead of selecting in place.
        const panel = renderPanel();
        const bodyBefore = panel.querySelector(".db-body");
        const project = store.getCurrent();
        const actor = project.database.actors[0]!;
        const klass = project.database.classes[0]!;
        const item = project.database.items[0]!;
        const equipment = project.database.equipment[0]!;

        expect(findByTestId(panel, `db-skill-backlink-actors-${actor.id}`)).not.toBeNull();
        expect(findByTestId(panel, `db-skill-backlink-classes-${klass.id}`)).not.toBeNull();
        expect(findByTestId(panel, `db-skill-backlink-items-${item.id}`)).not.toBeNull();
        expect(findByTestId(panel, `db-skill-backlink-equipment-${equipment.id}`)).not.toBeNull();

        byTestId(panel, `db-skill-backlink-actors-${actor.id}`).click();

        expect(getDatabaseActiveTab()).toBe("actors");
        expect(selectedRecordIdForSession("actors")).toBe(actor.id);
        expect(panel.querySelector(".db-body")).toBe(bodyBefore);
        expect(findByTestId(panel, `db-record-row-${actor.id}`)?.classList.contains("active")).toBe(true);
      });

      it("selects the exact non-first enemy through its rendered backlink", () => {
        // Break named: omitting enemy skillIds/actions either hides the backlink or falls back to the first enemy on navigation.
        const panel = renderPanel();
        const bodyBefore = panel.querySelector(".db-body");
        const enemy = store.getCurrent().database.enemies[1]!;
        const backlink = byTestId(panel, `db-skill-backlink-enemies-${enemy.id}`);

        expect(backlink.querySelector(".db-skill-backlink-kind")?.textContent).toBe("몬스터");
        backlink.click();

        expect(getDatabaseActiveTab()).toBe("enemies");
        expect(selectedRecordIdForSession("enemies")).toBe(enemy.id);
        expect(panel.querySelector(".db-body")).toBe(bodyBefore);
        expect(findByTestId(panel, `db-record-row-${enemy.id}`)?.classList.contains("active")).toBe(true);
      });

      it("selects the exact non-first monster species through its rendered backlink", () => {
        // Break named: treating monsterSpecies as a DatabaseCollection cannot set its dedicated selection before switching tabs.
        const panel = renderPanel();
        const bodyBefore = panel.querySelector(".db-body");
        const species = store.getCurrent().database.monsterSpecies?.[1];
        if (!species) throw new Error("missing non-first monster species fixture");
        const backlink = byTestId(panel, `db-skill-backlink-monsterSpecies-${species.id}`);

        expect(backlink.querySelector(".db-skill-backlink-kind")?.textContent).toBe("종족");
        backlink.click();

        expect(getDatabaseActiveTab()).toBe("monsterSpecies");
        expect(getSelectedMonsterSpeciesId()).toBe(species.id);
        expect(panel.querySelector(".db-body")).toBe(bodyBefore);
        expect(findByTestId(panel, `db-monster-species-row-${species.id}`)?.classList.contains("active")).toBe(true);
      });
    });
    function renderPanel(): FakeElement {
      const panel = document.createElement("div") as unknown as FakeElement;
      panel.className = "database-modal-body";
      renderDatabasePanel(panel as unknown as HTMLElement);
      return panel;
    }
    function byTestId(root: FakeElement, testid: string): FakeElement {
      const element = findByTestId(root, testid);
      if (!element) throw new Error(`missing test id ${testid}`);
      return element;
    }
  });
  describe("databaseTerrainTab", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    describe("terrain tab copy and pickers", () => {
      it("drops RM2003 path copy and keeps backdrop/footstep field testids with pickers", () => {
        const host = document.createElement("div") as unknown as FakeElement;
        renderTerrainTab(host as unknown as HTMLElement);
        const form = findByTestId(host, "db-detail-form");
        if (!form) throw new Error("missing terrain form");

        expect(form.textContent).not.toContain("RM2003");
        expect(form.textContent).not.toContain("database.terrains");
        expect(findByTestId(form, "db-field-terrain-backdrop-0")).not.toBeNull();
        expect(findByTestId(form, "db-field-terrain-footstep-0")).not.toBeNull();
        expect(findByTestId(form, "db-field-terrain-backdrop-0-set")).not.toBeNull();
        expect(findByTestId(form, "db-field-terrain-footstep-0-set")).not.toBeNull();
        expect(form.querySelector(".db-resource-picker-inline-name")).not.toBeNull();
        expect(findByTestId(form, "db-field-terrain-backdrop-0")?.className).toContain("db-authoring-id");
      });
    });
  });
  describe("databaseTypeChipMatrix", () => {
    isolateTimers();
    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    function chip(host: FakeElement, attacker: string, defender: string): FakeElement {
      const node = findByTestId(host, `db-type-chart-${attacker}-${defender}`);
      if (!node) throw new Error(`missing chip ${attacker}->${defender}`);
      return node;
    }
    function multiplier(attacker: string, defender: string): number | undefined {
      return store.getCurrent().system.typeChart?.multipliers?.[attacker]?.[defender];
    }
    describe("database type chart chip matrix", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
        store.update((draft) => {
          draft.system.typeChart = normalizeTypeChart({ types: ["fire", "water", "grass"], multipliers: {} });
        });
        resetMapEditHistory();
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
        vi.unstubAllGlobals();
      });

      it("chip click cycles 0→0.25→0.5→1→1.5→2→3→4→0 with normalized writes and no rerender storm", () => {
        store.update((draft) => {
          draft.system.typeChart = normalizeTypeChart({
            types: ["fire", "water", "grass"],
            multipliers: { fire: { water: 0 } },
          });
        });
        const host = renderSystem();
        const fireWater = chip(host, "fire", "water");
        expect(fireWater.tagName).toBe("BUTTON");
        expect(fireWater.dataset.attacker).toBe("fire");
        expect(fireWater.dataset.defender).toBe("water");
        expect(fireWater.dataset.value).toBe("0");
        expect(fireWater.dataset.state).toBe("down");

        const historyBefore = getMapEditHistoryEntries().length;
        const expected = [0.25, 0.5, 1, 1.5, 2, 3, 4, 0];
        for (const value of expected) {
          fireWater.click();
          // store 에 정규화된 승수가 기록된다.
          expect(multiplier("fire", "water")).toBe(value);
          // 칩 dataset 도 같은 값으로 로컬 갱신된다.
          expect(fireWater.dataset.value).toBe(String(value));
          expect(fireWater.dataset.state).toBe(value > 1 ? "up" : value < 1 ? "down" : "neutral");
        }

        // 같은 DOM 노드 — 클릭이 전체 재렌더(호스트 재구축)를 유발하지 않는다.
        expect(chip(host, "fire", "water")).toBe(fireWater);
        // 클릭 1회 = 스냅샷 1개(updateTypeChartCell 경로), 8회 클릭 = 8개.
        expect(getMapEditHistoryEntries().length).toBe(historyBefore + expected.length);
        // 4→0 wrap 후 라벨도 갱신된다.
        expect(fireWater.textContent).toBe("0");
      });

      it("preview shows 'fire → grass 2.0x' after interacting with the fire→grass cell", () => {
        const host = renderSystem();
        const preview = findByTestId(host, "db-type-preview");
        if (!preview) throw new Error("missing preview");

        const fireGrass = chip(host, "fire", "grass");
        fireGrass.click(); // 1 → 1.5
        fireGrass.click(); // 1.5 → 2
        expect(multiplier("fire", "grass")).toBe(2);
        expect(preview.textContent).toContain("공격→방어");
        expect(preview.textContent).toContain("fire → grass 2.0x");

        // hover(마우스 진입)도 미리보기를 갱신한다.
        const fireWater = chip(host, "fire", "water");
        fireWater.dispatchEvent(new Event("mouseenter"));
        expect(preview.textContent).toContain("fire → water 1.0x");
      });

      it("contextmenu popover clamps 7→4 and -1→0, keeps 1.25, and Escape closes without writing", () => {
        const host = renderSystem();
        const fireWater = chip(host, "fire", "water");
        const popover = findByTestId(host, "db-type-chart-popover");
        const input = findByTestId(host, "db-type-chart-popover-input");
        const confirm = findByTestId(host, "db-type-chart-popover-confirm");
        if (!popover || !input || !confirm) throw new Error("missing popover nodes");

        fireWater.dispatchEvent(new Event("contextmenu"));
        expect(popover.hidden).toBe(false);
        input.value = "7";
        confirm.click();
        expect(multiplier("fire", "water")).toBe(4);
        expect(fireWater.dataset.value).toBe("4");
        expect(popover.hidden).toBe(true);

        fireWater.dispatchEvent(new Event("contextmenu"));
        input.value = "-1";
        confirm.click();
        expect(multiplier("fire", "water")).toBe(0);
        expect(fireWater.dataset.value).toBe("0");
        expect(popover.hidden).toBe(true);

        fireWater.dispatchEvent(new Event("contextmenu"));
        input.value = "1.25";
        confirm.click();
        expect(multiplier("fire", "water")).toBe(1.25);
        expect(fireWater.dataset.value).toBe("1.25");
        expect(popover.hidden).toBe(true);

        // Escape 는 쓰지 않고 닫는다.
        fireWater.dispatchEvent(new Event("contextmenu"));
        input.value = "2";
        const escapeEvent = new Event("keydown");
        Object.defineProperty(escapeEvent, "key", { configurable: true, value: "Escape" });
        // fakeDom does not bubble keyboard events. The browser regression exercises
        // the native input-to-editor path; this unit invokes the editor's handler.
        popover.dispatchEvent(escapeEvent);
        expect(popover.hidden).toBe(true);
        expect(multiplier("fire", "water")).toBe(1.25);
        expect(document.activeElement).toBe(fireWater);
      });

      it("blank type list still deletes system.typeChart after confirm", () => {
        const confirm = vi.fn(() => true);
        vi.stubGlobal("confirm", confirm);
        const host = renderSystem();
        expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
        expect(findByTestId(host, "db-type-chart-direct-edit")).not.toBeNull();

        const types = findByTestId(host, "db-field-system-type-chart-types");
        if (!types) throw new Error("missing types input");
        types.value = "";
        types.dispatchEvent(new Event("change"));

        expect(confirm).toHaveBeenCalled();
        expect(store.getCurrent().system.typeChart).toBeUndefined();
        expect(findByTestId(host, "db-type-chart-matrix")).toBeNull();
        vi.unstubAllGlobals();
      });

      it("canceling the empty-list confirm keeps the type chart", () => {
        const confirm = vi.fn(() => false);
        vi.stubGlobal("confirm", confirm);
        const host = renderSystem();
        const types = findByTestId(host, "db-field-system-type-chart-types");
        if (!types) throw new Error("missing types input");
        types.value = "";
        types.dispatchEvent(new Event("change"));

        expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water", "grass"]);
        expect(findByTestId(host, "db-type-chart-matrix")).not.toBeNull();
        expect(types.value).toBe("fire, water, grass");
        vi.unstubAllGlobals();
      });

      it("diagonal cells are disabled and dimmed, and clicks on them do not write", () => {
        const host = renderSystem();
        const diagonal = chip(host, "fire", "fire");
        expect(diagonal.disabled).toBe(true);
        expect(diagonal.dataset.state).toBe("diag");

        diagonal.click();
        expect(multiplier("fire", "fire")).toBe(1);
        // diagonal 칩에는 contextmenu 리스너가 없다 — 팝오버가 열리지 않는다.
        diagonal.dispatchEvent(new Event("contextmenu"));
        const popover = findByTestId(host, "db-type-chart-popover");
        if (!popover) throw new Error("missing popover");
        expect(popover.hidden).toBe(true);
      });
    });
  });
  describe("databaseUtilityViews", () => {
    isolateTimers();
    function namedSwitches(): { id: string; name: string }[] {
      return store.getCurrent().switches.filter((record) => record.name.trim().length > 0);
    }
    function namedVariables(): { id: string; name: string }[] {
      return store.getCurrent().variables.filter((record) => record.name.trim().length > 0);
    }
    function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        render(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    let previousWindow: typeof globalThis.window | undefined;
    function stubWindowTimers(): void {
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
          clearTimeout,
        },
      });
    }
    function restoreWindow(): void {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
    describe("database utility views", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        stubWindowTimers();
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
        restoreWindow();
      });

      it("switch add button creates the next numbered switch and focuses name input", () => {
        const host = renderUtility(renderSwitchesTab);
        // #777: 기본 카탈로그의 기동석 아이템이 스위치를 선언하므로 빈 프로젝트도 목록이 비지 않는다.
        // 이 테스트가 보는 것은 "개수 슬롯 추가/포커스" 흐름이다.
        expect(store.getCurrent().switches.some((entry) => entry.name.trim().length > 0)).toBe(true);
        expect(host.querySelectorAll(".db-empty-row")).toHaveLength(0);

        findByTestId(host, "db-add-switch")?.click();
        const input = findByTestId(host, "db-utility-selected-name");
        if (!input) throw new Error("missing selected switch input");
        input.value = "문 열림";
        input.dispatchEvent(new Event("input"));

        expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "문 열림" });
        expect(document.activeElement).toBe(input);
      });

      it("variable add button creates the next numbered variable and supports rename", () => {
        const host = renderUtility(renderVariablesTab);

        findByTestId(host, "db-add-variable")?.click();
        const input = findByTestId(host, "db-utility-selected-name");
        if (!input) throw new Error("missing selected variable input");
        input.value = "퍼즐 점수";
        input.dispatchEvent(new Event("input"));

        expect(namedVariables()).toEqual([{ id: "var_0001", name: "퍼즐 점수" }]);
        expect(document.activeElement).toBe(input);
      });

      // fix(db): 스위치/변수 삭제에 2단계 확인이 없었다(qa-system-report.md Minor) — 다른 DB
      // 탭과 동일하게 첫 클릭은 무장만 하고, 확인 창 안의 두 번째 클릭이 실제 삭제를 확정한다.
      it("row delete button requires a second click to confirm before removing the switch", () => {
        const host = renderUtility(renderSwitchesTab);
        findByTestId(host, "db-add-switch")?.click();

        const deleteButton = findByTestId(host, "db-delete-sw_0001");
        if (!deleteButton) throw new Error("missing delete button");

        deleteButton.click();
        expect(deleteButton.textContent).toBe("정말 삭제?");
        expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });

        deleteButton.click();
        expect(namedSwitches().some((entry) => entry.id === "sw_0001")).toBe(false);
      });

      // fix(db): deleteSwitch/deleteVariable이 session.switches[id]/variables[id] 값을 정리하지
      // 않아, 삭제된 슬롯을 "+ 추가"로 재사용하면 이전 값(true)을 그대로 물려받는 위험이 있었다
      // (qa-system-report.md). ensureSwitchVariableSlots가 매 store.update마다 결측 세션 값을
      // 기본값으로 채워 넣으므로, 삭제 후 세션 값을 지우면 다음 update에서 기본값(false)으로
      // 리셋된다는 것을 검증한다.
      it("clears the stale runtime session value when a switch is deleted", () => {
        const host = renderUtility(renderSwitchesTab);
        findByTestId(host, "db-add-switch")?.click();
        store.update((project) => {
          project.session.switches.sw_0001 = true;
        });
        expect(store.getCurrent().session.switches.sw_0001).toBe(true);

        const deleteButton = findByTestId(host, "db-delete-sw_0001");
        deleteButton?.click();
        deleteButton?.click();

        expect(store.getCurrent().session.switches.sw_0001).toBe(false);
      });

      it("shows story flags in a read-only section instead of decorating switch rows", () => {
        store.update((project) => {
          const first = project.switches.find((record) => record.id === "sw_0001");
          if (!first) throw new Error("missing sw_0001");
          first.name = "시장 만남";
          project.storyFlags = [{
            id: "met-mayor",
            kind: "switch",
            targetId: "sw_0001",
            description: "촌장을 만남",
          }];
        });

        const host = renderUtility(renderSwitchesTab);
        const row = host.querySelector(".db-utility-row");
        const storyFlags = host.querySelector(".db-story-flag-list");

        expect(row?.textContent).toContain("시장 만남");
        expect(row?.textContent).not.toContain("met-mayor");
        expect(storyFlags?.textContent).toContain("스토리 플래그 (읽기 전용)");
        expect(storyFlags?.textContent).toContain("met-mayor");
      });

      // fix(db): 스위치/변수 이름 입력란이 키 입력마다 recordProjectSnapshot(비-코얼레스)을
      // 부르는 renameSwitch/renameVariable을 직접 호출해, 5글자 타이핑을 되돌리려면 Ctrl+Z를
      // 5번 눌러야 했다(qa-system-report.md). terms 필드와 동일한 recordCoalescedSnapshot으로
      // 맞춰 키 입력 스트림 전체가 undo 1스텝으로 병합돼야 한다.
      it("coalesces keystroke-by-keystroke switch renames into a single undo snapshot", () => {
        const host = renderUtility(renderSwitchesTab);
        findByTestId(host, "db-add-switch")?.click();
        resetMapEditHistory(); // isolate the rename snapshot count from the add snapshot

        const input = findByTestId(host, "db-utility-selected-name");
        if (!input) throw new Error("missing selected switch input");
        for (const next of ["H", "HE", "HEL", "HELL", "HELLO"]) {
          input.value = next;
          input.dispatchEvent(new Event("input"));
        }
        expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "HELLO" });

        const undone = undoMapEdit();
        expect(undone).toBe(true);
        // one snapshot for the whole keystroke stream — reverts straight back to the
        // pre-typing name ("새 스위치"), not one letter at a time.
        expect(namedSwitches()).toContainEqual({ id: "sw_0001", name: "새 스위치" });
        expect(getMapEditHistoryState().canUndo).toBe(false);
      });

      // fix(db): 용어 탭의 직행 store.update가 undo 스냅샷을 안 남겼다 — 다른 유틸리티 뷰
      // 필드는 Ctrl+Z가 되는데 용어만 안 되는 비일관 상태였다.
      it("records an undo snapshot when a term field changes, and undo restores the previous value", () => {
        expect(getMapEditHistoryState().canUndo).toBe(false);
        const host = renderUtility(renderTermsTab);
        const before = store.getCurrent().meta.terms.skill;

        const skillTerm = findByTestId(host, "db-field-skill-term");
        if (!skillTerm) throw new Error("missing skill term field");
        skillTerm.value = "Arts";
        skillTerm.dispatchEvent(new Event("input"));

        expect(store.getCurrent().meta.terms.skill).toBe("Arts");
        expect(getMapEditHistoryState().canUndo).toBe(true);

        const undone = undoMapEdit();

        expect(undone).toBe(true);
        expect(store.getCurrent().meta.terms.skill).toBe(before);
      });
    });
  });
});

describe("editorPanelsSuite23", () => {
  isolateTimers();
  describe("eventListCameraFocus", () => {
    isolateTimers();
    let restoreFakeDom: () => void = () => undefined;
    function fakeContainer(): HTMLElement {
      return new FakeElement("div") as unknown as HTMLElement;
    }
    function page(): EventPage {
      return {
        id: "page-1",
        name: "EV001",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
    }
    function event(): GameEvent {
      return { id: "event-1", x: 7, y: 4, trigger: { kind: "action" }, commands: [], pages: [page()] };
    }
    describe("event list → editor camera focus", () => {
      beforeEach(() => {
        _resetEventDraftVaultForTest();
        restoreFakeDom = installFakeDom();
        const project = createBlankProject();
        project.maps[project.startMapId].events = [event()];
        store.replace(project);
        editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
      });

      afterEach(() => {
        document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
        _resetEventDraftVaultForTest();
        restoreFakeDom();
      });

      it("pub/sub delivers focus target to subscribers", () => {
        const received: CameraFocusTarget[] = [];
        const unsub = subscribeEditorCameraFocus((target) => received.push(target));
        requestEditorCameraFocus({ mapId: "m1", tileX: 3, tileY: 5 });
        unsub();
        // After unsubscribe, further requests must not arrive.
        requestEditorCameraFocus({ mapId: "m1", tileX: 1, tileY: 1 });
        expect(received).toEqual([{ mapId: "m1", tileX: 3, tileY: 5 }]);
      });

      it("clicking a map-event list row requests camera focus on that event tile", () => {
        const project = store.getCurrent();
        const mapId = project.startMapId;

        const received: CameraFocusTarget[] = [];
        const unsub = subscribeEditorCameraFocus((target) => received.push(target));

        const sidebar = fakeContainer();
        renderEventEditor(sidebar);

        const row = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-1"]');
        expect(row).not.toBeNull();
        row?.click();

        unsub();

        // Selection (existing behavior) still updates editorState.
        expect(editorState.get().selectedEventId).toBe("event-1");
        expect(editorState.get().tool).toBe("event");
        expect(editorState.get().layer).toBe("event");

        // New behavior: exactly one focus request at the event's tile on this map.
        expect(received).toEqual([{ mapId, tileX: 7, tileY: 4 }]);
      });
    });
  });
  describe("eventListSelectionSync", () => {
    isolateTimers();
    let restoreFakeDom: () => void = () => undefined;
    function page(id: string): EventPage {
      return {
        id,
        name: "EV001",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
    }
    function event(id: string, name: string, x: number): GameEvent {
      return { id, name, x, y: 2, trigger: { kind: "action" }, commands: [], pages: [page(`${id}-page`)] };
    }
    describe("event list selection stays in place", () => {
      beforeEach(() => {
        _resetEventDraftVaultForTest();
        restoreFakeDom = installFakeDom();
        const project = createBlankProject();
        project.maps[project.startMapId].events = [
          event("event-1", "문지기", 1),
          event("event-2", "상인", 4),
          event("event-3", "아이", 8),
        ];
        store.replace(project);
        editorState.set({
          currentMapId: project.startMapId,
          layer: "event",
          tool: "event",
          selectedEventId: "event-1",
          selectedEventPageId: "event-1-page",
          pendingEventCoordinate: null,
        });
      });

      afterEach(() => {
        document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
        _resetEventDraftVaultForTest();
        restoreFakeDom();
      });

      it("moves the highlight and summary without rebuilding rows or resetting scroll", () => {
        const sidebar = new FakeElement("div") as unknown as HTMLElement;
        document.body.append(sidebar);
        renderEventEditor(sidebar);
        const rows = sidebar.querySelector<HTMLElement>(".event-list-rows")!;
        const kept = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-3"]')!;
        rows.scrollTop = 180;

        editorState.set({ selectedEventId: "event-3", selectedEventPageId: "event-3-page" });
        expect(syncMountedEventSelection()).toBe(true);

        expect(sidebar.querySelector('[data-testid="event-list-row-event-3"]')).toBe(kept);
        expect(rows.scrollTop).toBe(180);
        expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')?.classList.contains("active")).toBe(false);
        expect(kept.classList.contains("active")).toBe(true);
        expect(sidebar.querySelector(".event-editor-launch-title")?.textContent).toBe("아이");
        expect(sidebar.querySelector<HTMLElement>('[data-testid="event-editor-launch"]')?.dataset.eventId).toBe("event-3");
      });

      it("keeps the same summary when only the page id changes", () => {
        const sidebar = new FakeElement("div") as unknown as HTMLElement;
        document.body.append(sidebar);
        renderEventEditor(sidebar);
        const launch = sidebar.querySelector('[data-testid="event-editor-launch"]');
        editorState.set({ selectedEventPageId: "event-1-page" });
        expect(syncMountedEventSelection()).toBe(true);
        expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBe(launch);
      });

      it("clears the highlight when the selection is dropped", () => {
        const sidebar = new FakeElement("div") as unknown as HTMLElement;
        document.body.append(sidebar);
        renderEventEditor(sidebar);
        editorState.set({ selectedEventId: null, selectedEventPageId: null });
        expect(syncMountedEventSelection()).toBe(true);
        const rows = [...sidebar.querySelectorAll<HTMLElement>(".event-list-row")];
        expect(rows.length).toBe(3);
        expect(rows.every((row) => !row.classList.contains("active"))).toBe(true);
        expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBeNull();
      });

      it("leaves the mounted list alone when the selected event is not in it", () => {
        const sidebar = new FakeElement("div") as unknown as HTMLElement;
        document.body.append(sidebar);
        renderEventEditor(sidebar);
        const row = sidebar.querySelector('[data-testid="event-list-row-event-1"]');
        editorState.set({ selectedEventId: "missing" });
        expect(syncMountedEventSelection()).toBe(false);
        expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')).toBe(row);
        expect(row?.classList.contains("active")).toBe(true);
      });
    });
  });
  describe("factionsFromWorld", () => {
    isolateTimers();
    function faction(id: string, name = id): WorldEntity {
      return { id, type: "faction", name, summary: `${name} 설명`, origin: "user" };
    }
    function world(
      entities: readonly WorldEntity[],
      relations: ProjectWorld["relations"] = [],
    ): ProjectWorld {
      return { entities, relations };
    }
    describe("world faction materialization", () => {
      it("maps each lore faction to a stable combat def with conservative aggression", () => {
        const input = world([faction("w_iron_hand", "철의 손"), faction("w_watch", "도시 경비대")]);

        const plan = planFactionsFromWorld(input, undefined);

        expect(plan.diff.defs.added).toEqual([
          { id: "w_iron_hand", name: "철의 손", aggression: 1, worldEntityId: "w_iron_hand" },
          { id: "w_watch", name: "도시 경비대", aggression: 1, worldEntityId: "w_watch" },
        ]);
        expect(plan.diff.defs.changed).toEqual([]);
        expect(plan.diff.defs.removed).toEqual([]);
        expect(plan.diff.defs.conflicts).toEqual([]);
        expect(plan.result?.defs).toEqual(plan.diff.defs.added);
      });

      it("maps enemyOf to enemy and allyOf to full alliance while unrelated pairs remain neutral", () => {
        const input = world(
          [faction("w_iron"), faction("w_watch"), faction("w_merchants")],
          [
            { a: "w_iron", b: "w_watch", kind: "enemyOf" },
            { a: "w_watch", b: "w_merchants", kind: "allyOf" },
          ],
        );

        const plan = planFactionsFromWorld(input, undefined);
        const table = resolveFactionTable(plan.result);

        expect(WORLD_ENEMY_STANCE).toBe(-1);
        expect(WORLD_ALLY_STANCE).toBe(2);
        expect(factionStance(table, "w_iron", "w_watch")).toBe(-1);
        expect(factionStance(table, "w_watch", "w_merchants")).toBe(2);
        expect(factionStance(table, "w_iron", "w_merchants")).toBe(0);
      });

      it("keeps the more-hostile interpretation when lore declares both alliance and hostility", () => {
        const input = world(
          [faction("w_iron"), faction("w_watch")],
          [
            { a: "w_iron", b: "w_watch", kind: "allyOf" },
            { a: "w_watch", b: "w_iron", kind: "enemyOf" },
          ],
        );

        const plan = planFactionsFromWorld(input, undefined);

        expect(plan.diff.relations.added).toEqual([{ a: "w_watch", b: "w_iron", stance: -1 }]);
        expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-1);
      });

      it("is idempotent after applying the first plan", () => {
        const input = world(
          [faction("w_iron"), faction("w_watch")],
          [{ a: "w_iron", b: "w_watch", kind: "enemyOf" }],
        );
        const first = planFactionsFromWorld(input, undefined);
        const applied = applyFactionsFromWorldPlan(first);

        const second = planFactionsFromWorld(input, applied);

        expect(first.hasChanges).toBe(true);
        expect(second.hasChanges).toBe(false);
        expect(second.diff.defs.added).toEqual([]);
        expect(second.diff.relations.added).toEqual([]);
        expect(second.result).toEqual(applied);
      });

      it("keeps a materialized world faction linked after its combat id is renamed", () => {
        const input = world([faction("w_iron", "철의 손")]);
        const materialized = normalizeProjectFactions(
          applyFactionsFromWorldPlan(planFactionsFromWorld(input, undefined)),
        );
        const project = createBlankProject();
        project.world = input;
        project.factions = materialized;

        const renamed = renameFaction(project, "w_iron", "ironhand");
        expect(renamed.ok).toBe(true);
        if (!renamed.ok) return;
        const persisted = deserialize(serialize(renamed.project));
        const defsBeforeReplan = persisted.factions?.defs.length;

        const replanned = planFactionsFromWorld(input, persisted.factions);

        expect(replanned.mapping).toContainEqual(expect.objectContaining({
          worldEntityId: "w_iron",
          combatFactionId: "ironhand",
          status: "existing",
        }));
        expect(replanned.diff.defs.added).toEqual([]);
        expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
      });

      it.each([
        ["original first", [
          { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
          { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
        ]],
        ["copy first", [
          { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
          { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
        ]],
      ] as const)("chooses the same provenance owner when duplicate claims are %s", (_label, defs) => {
        const existing: ProjectFactions = { defs: [...defs], relations: [] };

        const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), existing);

        expect(plan.mapping[0]).toEqual(expect.objectContaining({
          combatFactionId: "w_iron",
          status: "existing",
        }));
        expect(plan.hasChanges).toBe(false);
      });

      it("backfills provenance on a legacy materialized def so a later rename keeps the link", () => {
        const input = world([faction("w_iron", "철의 손")]);
        // 출처 필드가 없던 구버전 구체화 산출물 그대로의 행.
        const legacy: ProjectFactions = {
          defs: [{ id: "w_iron", name: "철의 손", aggression: 1 }],
          relations: [],
        };

        const backfill = planFactionsFromWorld(input, legacy);

        expect(backfill.hasChanges).toBe(true);
        expect(backfill.diff.defs.added).toEqual([]);
        expect(backfill.diff.defs.changed).toEqual([{
          before: { id: "w_iron", name: "철의 손", aggression: 1 },
          after: { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
        }]);

        const project = createBlankProject();
        project.world = input;
        project.factions = normalizeProjectFactions(applyFactionsFromWorldPlan(backfill));

        const renamed = renameFaction(project, "w_iron", "ironhand");
        expect(renamed.ok).toBe(true);
        if (!renamed.ok) return;
        const persisted = deserialize(serialize(renamed.project));
        const defsBeforeReplan = persisted.factions?.defs.length;

        const replanned = planFactionsFromWorld(input, persisted.factions);

        expect(replanned.hasChanges).toBe(false);
        expect(replanned.diff.defs.added).toEqual([]);
        expect(replanned.diff.defs.changed).toEqual([]);
        expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
        expect(replanned.mapping).toContainEqual(expect.objectContaining({
          worldEntityId: "w_iron",
          combatFactionId: "ironhand",
          status: "existing",
        }));
      });

      it("preserves hand-authored metadata, relations, and player-kill policy while surfacing conflicts", () => {
        const authored: ProjectFactions = {
          defs: [
            { id: "w_iron", name: "철의 손", color: "#123456", aggression: 1, protectedFromNpcs: true },
            { id: "w_watch", name: "도시 경비대", aggression: 3 },
          ],
          relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
          playerKillReputation: { weight: 0.75 },
        };
        const input = world(
          [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
          [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
        );

        const plan = planFactionsFromWorld(input, authored);

        // 상호 호환인 w_iron 은 출처만 보정되고, 사람이 적은 색·보호·평판 설정은 그대로 남는다.
        expect(plan.diff.defs.added).toEqual([]);
        expect(plan.diff.defs.changed).toEqual([{
          before: authored.defs[0],
          after: { ...authored.defs[0], worldEntityId: "w_iron" },
        }]);
        expect(plan.result).toEqual({
          ...authored,
          defs: [{ ...authored.defs[0], worldEntityId: "w_iron" }, authored.defs[1]],
        });
        expect(plan.diff.defs.conflicts).toEqual([
          expect.objectContaining({ worldEntityId: "w_watch", existing: authored.defs[1] }),
        ]);
        expect(plan.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({ code: "id-collision", severity: "conflict", worldEntityId: "w_watch" }),
          expect.objectContaining({ code: "relation-endpoint-blocked", severity: "conflict" }),
        ]));
        expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-2);
      });

      it("does not overwrite a hand-authored stance that disagrees with lore", () => {
        const authored: ProjectFactions = {
          defs: [
            { id: "w_iron", name: "철의 손", aggression: 1 },
            { id: "w_watch", name: "도시 경비대", aggression: 1 },
          ],
          relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
        };
        const input = world(
          [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
          [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
        );

        const plan = planFactionsFromWorld(input, authored);

        expect(plan.diff.relations.added).toEqual([]);
        expect(plan.diff.relations.conflicts).toEqual([
          { existing: authored.relations, implied: { a: "w_iron", b: "w_watch", stance: 2 } },
        ]);
        expect(plan.result?.relations).toEqual(authored.relations);
        expect(plan.issues).toContainEqual(expect.objectContaining({ code: "relation-conflict" }));
      });

      it.each(["player", "enemy"])("remaps reserved world id %s without redefining the reserved faction", (id) => {
        const plan = planFactionsFromWorld(world([faction(id, `세계관 ${id}`)]), undefined);
        const mapped = plan.mapping[0]!;

        expect(mapped.combatFactionId).not.toBe(id);
        expect(mapped.combatFactionId).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
        expect(plan.diff.defs.added[0]?.id).toBe(mapped.combatFactionId);
        expect(plan.issues).toContainEqual(expect.objectContaining({ code: "reserved-id-remapped" }));
      });

      it("remaps invalid lore ids deterministically", () => {
        const id = "w_철의 손 guild!";
        const first = combatFactionIdFromWorldEntityId(id);
        const second = combatFactionIdFromWorldEntityId(id);

        expect(first).toBe(second);
        expect(first).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
        expect(planFactionsFromWorld(world([faction(id)]), undefined).issues)
          .toContainEqual(expect.objectContaining({ code: "invalid-id-remapped" }));
      });

      it("keeps a same-name hand-authored faction separate and reports the collision", () => {
        const authored: ProjectFactions = {
          defs: [{ id: "hand_iron", name: "철의 손", color: "#654321", aggression: 2 }],
          relations: [],
        };

        const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

        expect(plan.diff.defs.added).toEqual([
          { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
        ]);
        expect(plan.result?.defs).toEqual([
          authored.defs[0],
          { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
        ]);
        expect(plan.issues).toContainEqual(expect.objectContaining({ code: "name-collision", severity: "warning" }));
      });

      it("blocks an incompatible exact-id collision instead of overwriting it", () => {
        const authored: ProjectFactions = {
          defs: [{ id: "w_iron", name: "수기 철갑단", aggression: 2 }],
          relations: [],
        };

        const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

        expect(plan.hasChanges).toBe(false);
        expect(plan.result).toEqual(authored);
        expect(plan.mapping[0]?.status).toBe("blocked");
        expect(plan.issues).toContainEqual(expect.objectContaining({ code: "id-collision", severity: "conflict" }));
      });
    });
  });
  describe("feature16BattleUiAuthoring", () => {
    isolateTimers();
    function setup() {
      const project = deserialize(JSON.stringify(fixture));
      project.switches.push({ id: "sw_keep", name: "행동 후 스위치" });
      const troop = project.database.troops.find(t => t.id === "troop_slime")!;
      const enemy = project.database.enemies.find(e => e.id === "enemy_slime")!;
      const skill = project.database.skills[0]!;
      skill.mpCost = { flat: 5, percentMax: 0 };
      enemy.stats.maxMp = 10;
      enemy.actions = [{ skillId: skill.id, priority: 42, condition: { kind: "turn", start: 2, interval: 2 }, switchOnAfterAction: { enabled: true, switchId: "sw_keep" }, switchOffAfterAction: { enabled: false } }];
      project.database.elements = [{ id: "authored", name: "불", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 50, B: 200, C: 100, D: 0, E: -100 } }];
      enemy.elementRates = { authored: "A" };
      return { project, troop, enemy };
    }
    const input = { memberIndex: 0, actorId: "actor_hero", turn: 1, mpPercent: 100, row: "front" as const };
    describe("feature16 troop authoring what-if", () => {
      it("uses authored turns, MP rules and actual multipliers without mutating project", () => {
        const { project, troop } = setup();
        const before = JSON.stringify(project);
        expect(troopAuthoringPreview(project, troop, input)!.actions[0]!.reason).toBe("턴 조건 불일치");
        expect(troopAuthoringPreview(project, troop, { ...input, turn: 2, mpPercent: 0 })!.actions[0]!.reason).toContain("MP 부족");
        expect(troopAuthoringPreview(project, troop, { ...input, turn: 2 })!.actions[0]!.reason).toBeUndefined();
        expect(troopAuthoringPreview(project, troop, input)!.elements[0]!.multiplier).toBe(0.5); // A can be authored resistance.
        expect(JSON.stringify(project)).toBe(before);
      });
    });
    let cleanup: () => void;
    let oldWindow: typeof window;
    beforeEach(() => {
      cleanup = installFakeDom(); oldWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
    });
    afterEach(() => {
      cleanup();
      if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
    });
    it("edits existing enemy records through visible controls and preserves unrelated action fields on save/load", () => {
      const { project, troop, enemy } = setup();
      store.replace(project);
      const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
      const select = (id: string, value: string) => {
        const control = findByTestId(panel, id)!;
        expect(control).toBeTruthy(); control.value = value; control.dispatchEvent(new Event("change", { bubbles: true }));
      };
      for (const [id, value] of [["feature16-intent-start-0", "3"], ["feature16-intent-interval-0", "4"]]) {
        const control = findByTestId(panel, id!)!;
        control.value = value!; control.dispatchEvent(new Event("input"));
      }
      expect(store.getCurrent().database.enemies.find(e => e.id === enemy.id)!.actions[0]!.condition).toEqual({ kind: "turn", start: 3, interval: 4 });
      select("feature16-intent-condition-0", "always");
      select("feature16-intent-element-authored", "B");
      const restored = deserialize(serialize(store.getCurrent()));
      const changed = restored.database.enemies.find(e => e.id === enemy.id)!;
      expect(changed.actions[0]!.condition).toEqual({ kind: "always" });
      expect(changed.actions[0]!.switchOnAfterAction).toEqual({ enabled: true, switchId: "sw_keep" });
      expect(changed.elementRates.authored).toBe("B");
      expect(findByTestId(panel, "feature16-intent-prediction-0")).toBeTruthy();
    });
    describe("integrated combat condition preview", () => {
      const cases: { condition: EnemyActionCondition; matches: boolean }[] = [
        { condition: { kind: "always" }, matches: true },
        { condition: { kind: "turn", start: 2, interval: 3 }, matches: true },
        { condition: { kind: "turn", start: 3, interval: 3 }, matches: false },
        { condition: { kind: "hp", minPercent: 25, maxPercent: 25 }, matches: true },
        { condition: { kind: "hp", minPercent: 26, maxPercent: 100 }, matches: false },
        { condition: { kind: "mp", minPercent: 60, maxPercent: 60 }, matches: true },
        { condition: { kind: "mp", minPercent: 0, maxPercent: 59 }, matches: false },
        { condition: { kind: "status", stateId: "state_poison", present: false }, matches: true },
        { condition: { kind: "status", stateId: "state_poison", present: true }, matches: false },
        { condition: { kind: "allies", min: 1, max: 1 }, matches: true },
        { condition: { kind: "allies", min: 2, max: 3 }, matches: false },
        { condition: { kind: "switch", switchId: "preview-on", value: true }, matches: true },
        { condition: { kind: "switch", switchId: "preview-on", value: false }, matches: false },
        { condition: { kind: "switch", switchId: "preview-off", value: false }, matches: true },
        { condition: { kind: "switch", switchId: "legacy-preview", value: true }, matches: true },
      ];
      it.each(cases)("evaluates $condition with initial context: $matches", ({ condition, matches }) => {
        const { project, troop, enemy } = setup();
        enemy.stats.maxHp = enemy.stats.maxMp = 100;
        enemy.actions = [{ ...enemy.actions[0]!, skillId: "", condition }];
        troop.members = [
          { enemyId: enemy.id, x: 40, y: 40 },
          { enemyId: enemy.id, x: 60, y: 40 },
          { enemyId: enemy.id, x: 80, y: 40, hidden: true },
        ];
        project.switches.push({ id: "preview-on", name: "초기 ON" }, { id: "preview-off", name: "초기 OFF" });
        project.session.switches = { ...project.session.switches, "preview-on": true };
        project.flags["preview-off"] = true; // Declared switch initial value takes precedence over legacy flags.
        project.flags["legacy-preview"] = true;
        const before = JSON.stringify(project);
        const preview = troopAuthoringPreview(project, troop, { ...input, turn: 5, hpPercent: 25, mpPercent: 60 })!;
        expect(preview.actions[0]!.reason === undefined).toBe(matches);
        expect(preview).toMatchObject({ hp: 25, mp: 60, livingAllies: 1 });
        expect(JSON.stringify(project)).toBe(before);
      });
    });
    it.each<EnemyActionCondition>([
      { kind: "hp", minPercent: 10, maxPercent: 40 },
      { kind: "mp", minPercent: 20, maxPercent: 70 },
      { kind: "status", stateId: "state_poison", present: false },
      { kind: "allies", min: 1, max: 2 },
      { kind: "switch", switchId: "preview-switch", value: false },
    ])("shows and preserves authored $kind conditions through unrelated edits and save/load", condition => {
      const { project, troop, enemy } = setup();
      project.switches.push({ id: "preview-switch", name: "미리보기 스위치" });
      if (condition.kind === "status") condition = { ...condition, stateId: project.database.states[0]!.id };
      enemy.actions[0]!.condition = condition;
      store.replace(project);
      const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
      expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe(condition.kind);
      expect(findByTestId(panel, "feature16-intent-context-note")!.textContent).toContain("관측한 결과가 아닙니다");
      const priority = findByTestId(panel, "feature16-intent-priority-0")!;
      priority.value = "53"; priority.dispatchEvent(new Event("input"));
      const restored = deserialize(serialize(store.getCurrent()));
      expect(restored.database.enemies.find(e => e.id === enemy.id)!.actions[0]).toMatchObject({ condition, priority: 53 });
    });
    it("edits HP assumptions and retains legacy turn capture selectors after switching condition kind", () => {
      const { project, troop, enemy } = setup();
      enemy.stats.maxHp = 100;
      enemy.actions[0] = { ...enemy.actions[0]!, skillId: "", condition: { kind: "hp", minPercent: 0, maxPercent: 50 } };
      store.replace(project);
      const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
      expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 불일치");
      const hp = findByTestId(panel, "feature16-intent-hp")!;
      hp.value = "25"; hp.dispatchEvent(new Event("input"));
      expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 통과");
      const kind = findByTestId(panel, "feature16-intent-condition-0")!;
      kind.value = "turn"; kind.dispatchEvent(new Event("change", { bubbles: true }));
      expect(findByTestId(panel, "feature16-intent-start-0")).toBeTruthy();
      expect(findByTestId(panel, "feature16-intent-interval-0")).toBeTruthy();
      expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe("turn");
    });
  });
  describe("gen1EditorContracts", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    describe("Gen1 editor contracts", () => {
      it("edits and normalizes move max PP and critical class", () => {
        const skill = store.getCurrent().database.skills[0];
        if (!skill) throw new Error("missing default skill");
        const form = document.createElement("section") as unknown as FakeElement;
        renderSkillRecordForm(form as unknown as HTMLElement, skill);

        input(form, "db-field-skill-max-pp", "150");
        change(form, "db-field-skill-gen1-critical", "high");

        const current = store.getCurrent().database.skills.find((record) => record.id === skill.id);
        expect(current?.maxPp).toBe(99);
        expect(current?.gen1CriticalRate).toBe("high");

        input(form, "db-field-skill-max-pp", "0");
        change(form, "db-field-skill-gen1-critical", "normal");
        const reset = store.getCurrent().database.skills.find((record) => record.id === skill.id);
        expect(reset?.maxPp).toBeUndefined();
        expect(reset?.gen1CriticalRate).toBeUndefined();
      });

      it("edits Gen1 major status and trainer-battle semantics", () => {
        const state = store.getCurrent().database.states[0];
        const troop = store.getCurrent().database.troops[0];
        if (!state || !troop) throw new Error("missing default records");
        const stateForm = document.createElement("section") as unknown as FakeElement;
        const troopForm = document.createElement("section") as unknown as FakeElement;
        renderStateRecordForm(stateForm as unknown as HTMLElement, state);
        renderTroopRecordForm(troopForm as unknown as HTMLElement, troop, () => undefined);

        change(stateForm, "db-state-gen1-major-status", "paralysis");
        const trainer = byTestId(troopForm, "db-field-troop-trainer-battle");
        trainer.checked = true;
        trainer.dispatchEvent(new Event("change"));

        expect(store.getCurrent().database.states.find((record) => record.id === state.id)?.gen1MajorStatus).toBe("paralysis");
        expect(store.getCurrent().database.troops.find((record) => record.id === troop.id)?.trainerBattle).toBe(true);
      });

      it("edits ball class without losing the compatibility multiplier", () => {
        const item = store.getCurrent().database.items.find((record) => record.id === "item_capture_orb");
        if (!item) throw new Error("missing capture item");
        updateDatabaseRecord("items", item.id, { captureProfile: { multiplier: 1.5, ballClass: "great" } });
        const form = document.createElement("section") as unknown as FakeElement;
        itemFields(form as unknown as HTMLElement, item.id);

        input(form, "db-field-item-capture-multiplier", "2");
        expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });

        change(form, "db-field-item-ball-class", "ultra");
        expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "ultra" });
      });

      it("accepts every Gen1 field through the AI DB tool schemas and normalizers", () => {
        const context: ToolContext = { project: createBlankProject() };
        const skillId = context.project.database.skills[0]?.id ?? "";
        const stateId = context.project.database.states[0]?.id ?? "";
        const troopId = context.project.database.troops[0]?.id ?? "";

        expect(runTool(context, "upsert_skill", { skill: { id: skillId, maxPp: 150, gen1CriticalRate: "high" } }, { dryRun: false }).ok).toBe(true);
        expect(runTool(context, "upsert_state", { state: { id: stateId, gen1MajorStatus: "sleep" } }, { dryRun: false }).ok).toBe(true);
        expect(runTool(context, "upsert_troop", { troop: { id: troopId, trainerBattle: true } }, { dryRun: false }).ok).toBe(true);
        expect(runTool(context, "upsert_item", {
          item: { id: "item_capture_orb", captureProfile: { multiplier: 2, ballClass: "ultra" } },
        }, { dryRun: false }).ok).toBe(true);
        expect(runTool(context, "upsert_item", {
          item: { id: "item_capture_orb", captureProfile: { ballClass: "great" } },
        }, { dryRun: false }).ok).toBe(true);

        expect(context.project.database.skills.find((record) => record.id === skillId)).toMatchObject({ maxPp: 99, gen1CriticalRate: "high" });
        expect(context.project.database.states.find((record) => record.id === stateId)?.gen1MajorStatus).toBe("sleep");
        expect(context.project.database.troops.find((record) => record.id === troopId)?.trainerBattle).toBe(true);
        expect(context.project.database.items.find((record) => record.id === "item_capture_orb")?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });
      });
    });
    function byTestId(root: FakeElement, testid: string): FakeElement {
      const found = findByTestId(root, testid);
      if (!found) throw new Error(`missing test id ${testid}`);
      return found;
    }
    function input(root: FakeElement, testid: string, value: string): void {
      const node = byTestId(root, testid);
      node.value = value;
      node.dispatchEvent(new Event("input"));
    }
    function change(root: FakeElement, testid: string, value: string): void {
      const node = byTestId(root, testid);
      node.value = value;
      node.dispatchEvent(new Event("change"));
    }
  });
  describe("imageGeneration", () => {
    isolateTimers();
    describe("imageGenerationClient", () => {
      isolateTimers();
      function jsonResponse(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      }
      describe("imageGenerationClient", () => {
        it("defaults to the ChatGPT image provider, not Gemini", () => {
          expect(IMAGE_GENERATION_PROVIDER_ID).toBe("openai-codex");
          expect(IMAGE_GENERATION_MODEL).toBe("codex-image-default");
        });

        it("동반 서비스의 같은 오리진 /v1 경로를 친다", () => {
          expect(imageGenerationEndpoint()).toBe("/v1/images/generations");
        });

        it("그림은 항상 이미지 지원 제공자로 보낸다", async () => {
          const seen: { url: string; provider: string; body: unknown }[] = [];
          const image = await generateAiImage(
            { prompt: "슬라임" },
            {
              fetch: async (input, init) => {
                const headers = new Headers(init?.headers);
                seen.push({
                  url: String(input),
                  provider: headers.get("X-Oprn-Provider") ?? "",
                  body: JSON.parse(String(init?.body ?? "{}")),
                });
                return jsonResponse({
                  image: {
                    dataUrl: "data:image/png;base64,AAA",
                    mimeType: "image/png",
                    model: IMAGE_GENERATION_MODEL,
                    provider: IMAGE_GENERATION_PROVIDER_ID,
                  },
                });
              },
            },
          );

          expect(seen).toHaveLength(1);
          expect(seen[0]!.url).toBe("/v1/images/generations");
          expect(seen[0]!.provider).toBe(RECOMMENDED_IMAGE_PROVIDER_ID);
          expect(seen[0]!.body).toEqual({ prompt: "슬라임", model: RECOMMENDED_IMAGE_MODEL });
          expect(image.dataUrl).toBe("data:image/png;base64,AAA");
        });

        it("빈 프롬프트는 요청 전에 거부한다", async () => {
          let calls = 0;
          await expect(
            generateAiImage({ prompt: "  " }, { fetch: async () => { calls += 1; return jsonResponse({}); } }),
          ).rejects.toThrow(ImageGenerationError);
          expect(calls).toBe(0);
        });

        it("사용자 중단과 요청 시간 초과를 구분한다", async () => {
          const abortError = new DOMException("중단", "AbortError");
          const controller = new AbortController();
          controller.abort();

          await expect(
            generateAiImage({ prompt: "슬라임", signal: controller.signal }, { fetch: async () => { throw abortError; } }),
          ).rejects.toThrow("생성을 취소했습니다");
          await expect(
            generateAiImage({ prompt: "슬라임" }, { fetch: async () => { throw abortError; } }),
          ).rejects.toThrow("이미지 생성이 시간 안에 끝나지 않았습니다.");
        });

        it("서버 오류 본문의 사람이 읽는 메시지를 그대로 올린다", async () => {
          await expect(
            generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ error: "이미지 생성은 …만 지원합니다." }, 409) }),
          ).rejects.toThrow("이미지 생성은 …만 지원합니다.");
        });

        it("ChatGPT 인증에 실패하면 다른 제공자를 부르지 않고 로그인 안내를 올린다", async () => {
          const seen: [string | null, string][] = [];
          const result = generateAiImage(
            { prompt: "슬라임", model: "gemini-3.1-flash-image", providerId: "google-antigravity" },
            { fetch: async (_input, init) => {
              seen.push([new Headers(init?.headers).get("X-Oprn-Provider"), JSON.parse(String(init?.body)).model]);
              return jsonResponse({ error: "Unauthorized" }, 401);
            } },
          );
          await expect(result).rejects.toBeInstanceOf(ImageGenerationError);
          await expect(result).rejects.toMatchObject({ message: IMAGE_CHATGPT_LOGIN_REQUIRED, status: 401 });
          expect(seen).toEqual([["openai-codex", "codex-image-default"]]);
        });

        it("dataUrl 이 없는 200 응답도 실패로 본다", async () => {
          await expect(
            generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ image: { mimeType: "image/png" } }) }),
          ).rejects.toThrow(ImageGenerationError);
        });

        it("대화 제공자와 그림 제공자가 같을 때만 다른 제공자 안내가 필요 없다", () => {
          const config = { ...defaultAiConfig(), providerId: "google-antigravity" };
          expect(config.imageProviderId).toBe(IMAGE_GENERATION_PROVIDER_ID);
          expect(imageGenerationUsesOtherProvider(config)).toBe(true);
          expect(imageGenerationUsesOtherProvider({ ...config, providerId: "openai-codex" })).toBe(false);
        });
      });
    });
    describe("imageGenerationFallback", () => {
      isolateTimers();
      // 2026-10-25 심사(salad-omo-1 「그림 생성이 Google 로그인 요구」 7건): 그림 연결이 없을 때 실패 안내가 «제작을 멈추라»고 시켜 턴이 멈췄다.
      const LOGIN = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";
      const noLogin = async () => { throw new ImageGenerationError(LOGIN, 401); };
      describe("image generation fallback when the image login is missing", () => {
        it("treats a missing login as a failure that won't clear up during this run", () => {
          expect(isImageCredentialFailure(new ImageGenerationError(LOGIN, 401))).toBe(true);
          expect(isImageCredentialFailure(new ImageGenerationError("이미지 생성이 시간 안에 끝나지 않았습니다."))).toBe(false);
        });

        it("names the closest library pictures by description, skipping city skylines for a fairy-tale scene", () => {
          const picks = closestLibraryPictures("동화 같은 숲 마을의 밤");
          expect(picks.length).toBeGreaterThan(0);
          expect(picks.some((pick) => /skyline|city/u.test(pick.id))).toBe(false);
        });

        it("the next step says to keep building, never to stop", () => {
          const step = imageFailureNextStep("title", "숲 마을", new ImageGenerationError(LOGIN, 401));
          expect(step).toContain("다시 부르지 마라");
          expect(step).toContain("계속한다");
          expect(step).toContain("턴을 멈추지 않는다");
          expect(step).not.toContain("멈추고");
        });

        it("opening and title-art failures carry the fallback instead of a stop order", async () => {
          const opening = await generateOpeningStill({ prompt: "새벽 안개 낀 숲속 마을 광장, 아무도 없는 풍경" }, { generateImage: noLogin });
          expect(opening.ok).toBe(false);
          if (!opening.ok) {
            expect(opening.summary).toContain("Antigravity");
            expect(opening.summary).toContain("턴을 멈추지 않는다");
            expect(opening.summary).not.toContain("제작을 멈추고");
          }
          const title = await generateTitleArt({ prompt: "동화 공방의 오르골" }, { generateImage: noLogin, fitEffects: false });
          expect(title.ok).toBe(false);
          if (!title.ok) expect(title.summary).toContain("set_title_screen");
        });
      });
    });
    describe("imageGenerationQueue", () => {
      isolateTimers();
      function deferred<T>(): {
        readonly promise: Promise<T>;
        readonly resolve: (value: T) => void;
        readonly reject: (error: unknown) => void;
      } {
        let resolve!: (value: T) => void;
        let reject!: (error: unknown) => void;
        const promise = new Promise<T>((innerResolve, innerReject) => {
          resolve = innerResolve;
          reject = innerReject;
        });
        return { promise, resolve, reject };
      }
      describe("imageGenerationQueue", () => {
        it("빈 프롬프트는 넣지 않는다", () => {
          const queue = createImageGenerationQueue({ runner: async () => "x" });
          expect(() => queue.enqueue({ prompt: "  " })).toThrow();
          expect(queue.getSnapshot().jobs).toHaveLength(0);
        });

        it("작업은 들어온 순서대로 끝나고 상태가 전이된다", async () => {
          const order: string[] = [];
          const queue = createImageGenerationQueue({
            runner: async (job) => {
              order.push(job.label);
              return `data:${job.label}`;
            },
          });
          const seen: string[][] = [];
          queue.subscribe((snapshot) => seen.push(snapshot.jobs.map((job) => job.status)));
          const first = queue.enqueue({ prompt: "슬라임", kind: "backdrop" });
          const second = queue.enqueue({ prompt: "고블린", kind: "backdrop" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
          });
          expect(order).toEqual(["슬라임", "고블린"]);
          const jobs = queue.getSnapshot().jobs;
          expect(jobs.map((job) => job.id)).toEqual([first, second]);
          expect(jobs[0]!.attempts).toBe(1);
          expect(jobs[0]!.result).toBe("data:슬라임");
          expect(seen.flat()).toContain("running");
          expect(queue.getSnapshot().queued).toBe(0);
          expect(queue.getSnapshot().running).toBe(0);
        });

        it("동시성은 직렬이 기본이고 실패한 작업은 에러를 들고 멈춘다", async () => {
          let active = 0;
          let peak = 0;
          const queue = createImageGenerationQueue({
            runner: async (job) => {
              active += 1;
              peak = Math.max(peak, active);
              try {
                if (job.label === "깨짐") throw new Error("서버 불량");
                await new Promise((resolve) => setTimeout(resolve, 5));
                return "ok";
              } finally {
                active -= 1;
              }
            },
          });
          queue.enqueue({ prompt: "하나" });
          queue.enqueue({ prompt: "깨짐" });
          queue.enqueue({ prompt: "셋" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.filter((job) => job.status === "done")).toHaveLength(2);
          });
          expect(peak).toBe(1);
          const snapshot = queue.getSnapshot();
          expect(snapshot.failed).toBe(1);
          const failed = snapshot.jobs.find((job) => job.label === "깨짐")!;
          expect(failed.status).toBe("error");
          expect(failed.error).toBe("서버 불량");
        });

        it("실행 중 취소는 결과를 버리고 다음 작업을 돌린다", async () => {
          const gate = deferred<string>();
          const started: string[] = [];
          const queue = createImageGenerationQueue({
            runner: async (job, options) => {
              started.push(job.label);
              if (job.label === "느림") {
                // runner 가 signal 을 무시하고 늦게 resolve 해도 큐는 버려야 한다.
                void options.signal;
                return gate.promise;
              }
              return "fast";
            },
          });
          const slow = queue.enqueue({ prompt: "느림" });
          queue.enqueue({ prompt: "빠름" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.find((job) => job.id === slow)?.status).toBe("running");
          });
          expect(queue.cancel(slow)).toBe(true);
          gate.resolve("late-data");
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.find((job) => job.label === "빠름")?.status).toBe("done");
          });
          const slowJob = queue.getSnapshot().jobs.find((job) => job.id === slow)!;
          expect(slowJob.status).toBe("cancelled");
          expect(slowJob.result).toBeNull();
          expect(started).toEqual(["느림", "빠름"]);
          queue.dispose();
        });

        it("취소 후 재시도하면 이전 실행의 늦은 결과는 버린다", async () => {
          const first = deferred<string>();
          const second = deferred<string>();
          let calls = 0;
          const queue = createImageGenerationQueue({
            runner: async () => {
              calls += 1;
              return calls === 1 ? first.promise : second.promise;
            },
          });
          const id = queue.enqueue({ prompt: "느림" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs[0]?.status).toBe("running");
          });
          expect(queue.cancel(id)).toBe(true);
          expect(queue.retry(id)).toBe(true);
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs[0]?.attempts).toBe(2);
          });
          // 취소된 첫 실행이 늦게 성공해도 재시도 실행에는 닿지 않는다. 첫 promise 의
          // continuation 은 runOne 이 먼저 붙였으므로, 여기서 await 하면 stale 분기가
          // 완전히 정착한 뒤에 깨어난다(고정 sleep 없이 결정적이다).
          first.resolve("stale-data");
          await first.promise;
          const during = queue.getSnapshot().jobs[0]!;
          expect(during.status).toBe("running");
          expect(during.result).toBeNull();
          // 재시도 실행의 결과만 적용된다.
          second.resolve("fresh-data");
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs[0]?.status).toBe("done");
          });
          expect(queue.getSnapshot().jobs[0]?.result).toBe("fresh-data");
          queue.dispose();
        });

        it("대기 중 취소는 runner 를 부르지 않고 재시도하면 다시 돈다", async () => {
          const gate = deferred<string>();
          let calls = 0;
          const queue = createImageGenerationQueue({
            runner: async (job) => {
              calls += 1;
              if (job.label === "차단") return gate.promise;
              if (calls === 2) throw new Error("한 번 실패");
              return "recovered";
            },
          });
          queue.enqueue({ prompt: "차단" });
          const waiting = queue.enqueue({ prompt: "대기" });
          expect(queue.cancel(waiting)).toBe(true);
          expect(calls).toBe(1);
          gate.resolve("blocker-done");
          const failed = queue.enqueue({ prompt: "실패" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("error");
          });
          expect(queue.retry(failed)).toBe(true);
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("done");
          });
          expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.attempts).toBe(2);
          expect(queue.cancel(failed)).toBe(false);
          expect(queue.retry(failed)).toBe(false);
        });

        it("clearFinished 는 끝난 것만 걷고 실패는 남긴다", async () => {
          const queue = createImageGenerationQueue({
            runner: async (job) => {
              if (job.label === "깨짐") throw new Error("불량");
              return "ok";
            },
          });
          queue.enqueue({ prompt: "성공" });
          const bad = queue.enqueue({ prompt: "깨짐" });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.every((job) => job.status !== "queued" && job.status !== "running")).toBe(true);
          });
          queue.clearFinished();
          const remaining = queue.getSnapshot().jobs;
          expect(remaining.map((job) => job.id)).toEqual([bad]);
        });

        it("구독 해지는 이후 알림을 받지 않는다", () => {
          const queue = createImageGenerationQueue({ runner: async () => "x" });
          let calls = 0;
          const off = queue.subscribe(() => {
            calls += 1;
          });
          queue.enqueue({ prompt: "하나" });
          const afterEnqueue = calls;
          off();
          queue.enqueue({ prompt: "둘" });
          expect(calls).toBe(afterEnqueue);
          queue.dispose();
        });

        it("concurrency 상한은 1~4 로 고정된다", async () => {
          let active = 0;
          let peak = 0;
          const queue = createImageGenerationQueue({
            concurrency: 99,
            runner: async () => {
              active += 1;
              peak = Math.max(peak, active);
              await new Promise((resolve) => setTimeout(resolve, 5));
              active -= 1;
              return "ok";
            },
          });
          for (let index = 0; index < 8; index += 1) queue.enqueue({ prompt: `작업${index}` });
          await vi.waitFor(() => {
            expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
          });
          expect(peak).toBeLessThanOrEqual(4);
          queue.dispose();
        });
      });
    });
    describe("imageGenerationUnavailableNotice", () => {
      isolateTimers();
      describe("image generation unavailable — loud failure", () => {
        it("keeps the wire code that every surface matches on", () => {
          expect(IMAGE_GENERATION_UNAVAILABLE_CODE).toBe("image-generation-unavailable");
        });

        it("returns a hard error that carries the code and the agent instruction verbatim", () => {
          const error = imageGenerationUnavailableError();
          expect(error.name).toBe("ToolError");
          expect(error.code).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
          expect(error.message).toBe(imageGenerationUnavailableInstruction());
        });

        it("materialises a gate notice of the image-unavailable kind with one reason and one fix", () => {
          const notice = imageUnavailableGateNotice();
          expect(notice.kind).toBe("image-unavailable");
          expect(notice.reasons).toHaveLength(1);
          expect(notice.nextSteps).toHaveLength(1);
        });

        it("recognises the failure result only through the code and raises the gate once", () => {
          const shown: string[] = [];
          const raised = reportImageGenerationUnavailable(
            { summary: `x ${IMAGE_GENERATION_UNAVAILABLE_CODE} y` },
            (notice) => shown.push(notice.kind),
          );
          expect(raised).toBe(true);
          expect(shown).toEqual(["image-unavailable"]);
          expect(isImageGenerationUnavailableResult({ summary: "정상 완료" })).toBe(false);
          expect(isImageGenerationUnavailableResult({ issues: [{ code: IMAGE_GENERATION_UNAVAILABLE_CODE }] })).toBe(true);
        });

        it("raises the same loud code for a credential failure, not a generic image failure", () => {
          // 자동 Google 대체를 없애면서 「자격 없음」이 새로 도달 가능해졌다 — 그 실패가 조용한 일반 실패로 남으면
          // 캔버스 띠·차단 모달이 뜨지 않는다. 일시 오류는 한 번 더 시도할 수 있으므로 구분을 유지한다.
          expect(imageGenerationFailureCode(new ImageGenerationError("ChatGPT 로그인이 필요합니다", 401))).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
          expect(imageGenerationFailureCode(new ImageGenerationError("일시 오류", 502))).toBe("image-generation-failed");
          expect(imageGenerationFailureCode(new Error("network down"))).toBe("image-generation-failed");
        });

        it("fails the real registry tool hard with that code instead of reporting success", () => {
          expect(getTool("generate_opening_image")?.mode).toBe("write");
          const result = runTool({ project: createBlankProject() }, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
          expect(result.ok).toBe(false);
          expect(result.issues?.map((issue) => issue.code)).toContain(IMAGE_GENERATION_UNAVAILABLE_CODE);
          expect(isImageGenerationUnavailableResult(result)).toBe(true);
        });
      });
    });
  });
  describe("mapEventSearchModel", () => {
    isolateTimers();
    function event(id: string, name: string, commands: GameEvent["commands"] = []): GameEvent {
      return {
        id,
        x: 2,
        y: 3,
        trigger: { kind: "action" },
        commands,
        pages: [
          {
            id: `${id}_page_1`,
            name,
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands,
          },
        ],
      };
    }
    function fixture(): Project {
      const project = createBlankProject();
      const start = project.maps[project.startMapId]!;
      start.name = "햇살 마을";
      start.events = [event("ev_gate", "북문 수문장")];

      const forest = createBlankMap("Moonlit Forest", 12, 12);
      forest.id = "map_moonlit_forest";
      forest.events = [
        event("ev_owl", "Night Owl", [{ kind: "setSwitch", switchId: "sw_moon_gate", value: true }]),
      ];
      project.maps[forest.id] = forest;
      project.switches = [{ id: "sw_moon_gate", name: "Moon Gate Open" }];
      project.variables = [{ id: "var_moon_count", name: "Moon Count" }];
      project.commonEvents = [{ id: "common_moon", name: "Moon Cycle", trigger: "none", commands: [] }];
      return project;
    }
    describe("mapEventSearchModel", () => {
      it("맵 이름 부분 일치 결과에 이동할 mapId를 담는다", () => {
        const project = fixture();
        const results = searchProject({ project, selectedMapId: project.startMapId, query: "Forest", scope: "all" });

        expect(results).toContainEqual(expect.objectContaining({
          kind: "map",
          name: "Moonlit Forest",
          target: { kind: "map", mapId: "map_moonlit_forest" },
        }));
      });

      it("모든 페이지의 이벤트 이름을 찾고 mapId와 eventId를 담는다", () => {
        const project = fixture();
        const results = searchProject({ project, selectedMapId: project.startMapId, query: "owl", scope: "all" });

        expect(results).toContainEqual(expect.objectContaining({
          kind: "mapEvent",
          name: "Night Owl",
          target: { kind: "event", mapId: "map_moonlit_forest", eventId: "ev_owl" },
        }));
      });

      it("스위치 이름과 id를 찾고 참조하는 맵 이벤트를 함께 돌려준다", () => {
        const project = fixture();
        const [result] = searchProject({ project, selectedMapId: project.startMapId, query: "sw_moon", scope: "all" })
          .filter((entry) => entry.kind === "switch");

        expect(result).toEqual(expect.objectContaining({
          kind: "switch",
          name: "Moon Gate Open",
          references: [expect.objectContaining({ mapId: "map_moonlit_forest", eventId: "ev_owl" })],
        }));
      });

      it("빈 질의는 결과를 돌려주지 않는다", () => {
        const project = fixture();
        expect(searchProject({ project, selectedMapId: project.startMapId, query: "   ", scope: "all" })).toEqual([]);
      });

      it("대소문자를 무시해 맵·이벤트·공통 이벤트·변수 이름을 찾는다", () => {
        const project = fixture();
        project.maps.map_moonlit_forest!.events[0]!.pages![0]!.commands = [
          { kind: "setVariable", variableId: "var_moon_count", op: "=", value: 1 },
        ];
        const results = searchProject({ project, selectedMapId: project.startMapId, query: "MOON", scope: "all" });
        const eventResults = searchProject({ project, selectedMapId: project.startMapId, query: "NIGHT OWL", scope: "all" });

        expect(results.map((result) => result.kind)).toEqual(expect.arrayContaining([
          "map",
          "commonEvent",
          "variable",
        ]));
        expect(eventResults).toContainEqual(expect.objectContaining({ kind: "mapEvent", name: "Night Owl" }));
      });

      it("페이지 제목과 다른 이벤트 이름(GameEvent.name)으로 찾고, 참조 라벨도 그 이름을 쓴다", () => {
        const project = fixture();
        const gate = project.maps[project.startMapId]!.events[0]!;
        gate.name = "문지기 한솔";
        gate.pages![0]!.name = "페이지 1";
        gate.pages![0]!.commands = [{ kind: "setSwitch", switchId: "sw_moon_gate", value: true }];

        const byName = searchProject({ project, selectedMapId: project.startMapId, query: "한솔", scope: "selectedMap" });
        const byId = searchProject({ project, selectedMapId: project.startMapId, query: "ev_gate", scope: "selectedMap" });
        const bySwitch = searchProject({ project, selectedMapId: project.startMapId, query: "sw_moon_gate", scope: "all" })
          .find((entry) => entry.kind === "switch");

        expect(byName).toEqual([expect.objectContaining({
          kind: "mapEvent",
          name: "문지기 한솔",
          target: { kind: "event", mapId: project.startMapId, eventId: "ev_gate" },
        })]);
        expect(byId).toEqual([expect.objectContaining({ kind: "mapEvent", name: "문지기 한솔" })]);
        expect(bySwitch?.kind).toBe("switch");
        if (bySwitch?.kind !== "switch") return;
        expect(bySwitch.references).toContainEqual(expect.objectContaining({ eventId: "ev_gate", name: "문지기 한솔" }));
        expect(byName.some((entry) => entry.name === "페이지 1")).toBe(false);
      });
    });
  });
  describe("mapTreeAiBadges", () => {
    isolateTimers();
    const maps = new Set(["map_a", "map_b", "map_c"]);
    const isMap = (id: string) => maps.has(id);
    function ticket(id: number, mapKey: string, status: MapRunTicket["status"], extra: Partial<MapRunTicket> = {}): MapRunTicket {
      return { id, mapKey, exclusive: false, foreground: false, label: `요청 ${id}`, status, wait: status === "waiting" ? "same-map" : null, ahead: 0,
        enqueuedAt: 0, startedAt: null, endedAt: null, error: null, ...extra };
    }
    function presence(extra: Partial<Presence>): Presence {
      return { id: "p", source: "chat", name: "조수", readsOnly: false, no: 1, tone: 0, state: "working", mapId: null, mapName: null, task: "",
        action: "", steps: 0, startedAt: undefined, recent: [], ...extra };
    }
    describe("mapAiBadges", () => {
      it("shows who holds a map and which maps are waiting for its lock", () => {
        const badges = mapAiBadges([], [ticket(1, "map_a", "running"), ticket(2, "map_a", "waiting"), ticket(3, "map_a", "waiting", { ahead: 1 })], isMap);
        expect(badges.get("map_a")!.map((b) => [b.kind, b.text])).toEqual([["working", "조수 작업 중"], ["waiting", "대기 2"]]);
        const queued = mapAiBadges([], [ticket(4, "map_b", "waiting", { wait: "exclusive" })], isMap);
        expect(queued.get("map_b")!.map((b) => [b.kind, b.text])).toEqual([["waiting", "잠금 대기"]]);
      });

      it("names the team worker that owns a map, with its job colour", () => {
        const badges = mapAiBadges([presence({ name: "시공 1", tone: 1, mapId: "map_b" }), presence({ id: "r", name: "검수", readsOnly: true, mapId: "map_c" })], [], isMap);
        expect(badges.get("map_b")).toEqual([expect.objectContaining({ kind: "working", text: "시공 1 작업 중", tone: 1 })]);
        expect(badges.has("map_c")).toBe(false);
      });

      it("does not badge project-wide or exclusive (team) queue keys", () => {
        const badges = mapAiBadges([], [ticket(1, "__project__", "running"), ticket(2, "map_c", "running", { exclusive: true })], isMap);
        expect(badges.size).toBe(0);
      });
    });
    describe("aiMapRunQueue threadId", () => {
      it("enqueue keeps threadId on the ticket", () => {
        const q = createMapRunQueue();
        q.enqueue({ mapKey: "map_a", label: "x", threadId: "t1", start: async () => {} });
        expect(q.tickets()[0]?.threadId).toBe("t1");
        // Old callers without a thread id leave the field absent, not an empty string.
        q.enqueue({ mapKey: "map_b", label: "y", start: async () => {} });
        expect(q.tickets()[1]).not.toHaveProperty("threadId");
      });

      it("runs non-overlapping drag regions on the same map concurrently and queues overlapping or whole-map runs", async () => {
        const q = createMapRunQueue({ concurrency: 3 });
        const resolvers: (() => void)[] = [];
        const started: string[] = [];
        const hold = (name: string) => () => new Promise<void>((resolve) => { started.push(name); resolvers.push(resolve); });
        const a = q.enqueue({ mapKey: "map_a", label: "left", region: { x: 0, y: 0, width: 4, height: 4 }, start: hold("left") });
        const b = q.enqueue({ mapKey: "map_a", label: "right", region: { x: 4, y: 0, width: 4, height: 4 }, start: hold("right") });
        const c = q.enqueue({ mapKey: "map_a", label: "overlap", region: { x: 3, y: 1, width: 3, height: 3 }, start: hold("overlap") });
        const d = q.enqueue({ mapKey: "map_a", label: "whole", start: hold("whole") });
        expect(a.status).toBe("running");
        expect(b.status).toBe("running");
        expect(c.status).toBe("waiting");
        expect(c.wait).toBe("same-map");
        expect(d.status).toBe("waiting");
        expect(q.forMap("map_a", { x: 10, y: 10, width: 2, height: 2 }).map((t) => t.label)).toEqual(["whole"]);
        expect(q.forMap("map_a", { x: 0, y: 0, width: 2, height: 2 }).map((t) => t.label)).toEqual(["left", "whole"]);
        await Promise.resolve();
        expect(started).toEqual(["left", "right"]);
        resolvers[0]!();
        await Promise.resolve();
        await Promise.resolve();
        expect(c.status).toBe("waiting");
        resolvers[1]!();
        await Promise.resolve();
        await Promise.resolve();
        expect(c.status).toBe("running");
        expect(d.status).toBe("waiting");
        resolvers[2]!();
        await Promise.resolve();
        await Promise.resolve();
        expect(d.status).toBe("running");
        resolvers[3]!();
      });
    });
    describe("aiThreadList", () => {
      function summary(id: string, savedAt: number, homeMapId: string | null, targetMapIds: string[] = []): ConversationArchiveSummary {
        return { id, title: `스레드 ${id}`, model: "m", savedAt, turnCount: 1, projectContextKey: "remote:P",
          viewedMapIds: homeMapId ? [homeMapId] : [], targetMapIds, mapAttribution: "complete", homeMapId,
          mapIds: [...new Set([...(homeMapId ? [homeMapId] : []), ...targetMapIds])].sort(), transcriptCompacted: false };
      }
      function decision(threadId: string | undefined, runKey = "map_a"): OpenAssistantDecision {
        return { title: "확인", runKey, openedAt: 1, ...(threadId !== undefined ? { threadId } : {}), answer() {} };
      }
      const none = new Map<string, ThreadState>();
      it("groups by home map, game-wide for null", () => {
        const snap = groupThreads([summary("a", 1, null), summary("b", 3, "map_a"), summary("c", 2, "map_a")], isMap, none);
        expect(snap.gameWide.map(r => r.id)).toEqual(["a"]);
        expect(snap.gameWide[0]?.homeMapId).toBeNull();
        expect(snap.byMap.get("map_a")?.map(r => r.id)).toEqual(["b", "c"]);
        expect([...snap.byMap.keys()]).toEqual(["map_a"]);
      });
      it("deleted home map falls back to game-wide", () => {
        const snap = groupThreads([summary("x", 1, "map_x"), summary("y", 2, null)], isMap, none);
        expect(snap.gameWide.map(r => r.id)).toEqual(["y", "x"]);
        expect(snap.gameWide.find(r => r.id === "x")?.homeMapId).toBeNull();
        expect(snap.byMap.has("map_x")).toBe(false);
      });
      it("echoes a thread under maps it touched outside home", () => {
        const snap = groupThreads([summary("e", 1, "map_a", ["map_a", "map_b", "map_gone"])], isMap, none);
        expect(snap.echoes.get("map_b")?.map(r => r.id)).toEqual(["e"]);
        expect(snap.echoes.has("map_a")).toBe(false);
        expect(snap.echoes.has("map_gone")).toBe(false);
        // A game-wide thread echoes under every existing map it changed.
        const wide = groupThreads([summary("w", 1, null, ["map_c"])], isMap, none);
        expect(wide.echoes.get("map_c")?.map(r => r.id)).toEqual(["w"]);
      });
      it("threadStates: needs-answer > working > waiting", () => {
        const states = threadStates([
          ticket(1, "map_a", "running", { threadId: "t1" }),
          ticket(2, "map_b", "running", { threadId: "t2" }),
          ticket(3, "map_b", "waiting", { threadId: "t2" }),
          ticket(4, "map_c", "waiting", { threadId: "t3" }),
          ticket(5, "map_c", "running"),
          ticket(6, "map_c", "done", { threadId: "t4" }),
        ], [decision("t1"), decision(undefined)]);
        expect(states.get("t1")).toBe("needs-answer");
        expect(states.get("t2")).toBe("working");
        expect(states.get("t3")).toBe("waiting");
        expect(states.has("t4")).toBe(false);
        expect([...states.keys()].sort()).toEqual(["t1", "t2", "t3"]);
        const snap = groupThreads([summary("t1", 1, "map_a"), summary("t9", 2, "map_a")], isMap, states);
        expect(snap.byMap.get("map_a")?.find(r => r.id === "t1")?.state).toBe("needs-answer");
        expect(snap.byMap.get("map_a")?.find(r => r.id === "t9")).not.toHaveProperty("state");
      });
      it("store loads the scope, debounces saves and follows queue and decision changes", async () => {
        vi.useFakeTimers();
        try {
          let rows = [summary("s1", 1, "map_a")];
          const load = vi.fn(async (_scope: string) => rows);
          // A holder, not `let`: TS would narrow a closure-assigned `let x = null` to `null`.
          const hooks: { saved: ((id: string) => void) | null; decisionsChanged: (() => void) | null } = { saved: null, decisionsChanged: null };
          const open: OpenAssistantDecision[] = [];
          const queue = createMapRunQueue();
          const list = createAiThreadList({ load, mapExists: isMap, mapsToken: () => maps, queue: () => queue,
            decisions: () => open, subscribeDecisions: fn => { hooks.decisionsChanged = fn; return () => { hooks.decisionsChanged = null; }; },
            onSaved: fn => { hooks.saved = fn; return () => { hooks.saved = null; }; } });
          const seen = vi.fn();
          list.subscribe(seen);
          expect(list.snapshot().gameWide).toEqual([]);
          list.setScope("remote:P");
          await vi.advanceTimersByTimeAsync(0);
          expect(load).toHaveBeenCalledTimes(1);
          expect(load).toHaveBeenLastCalledWith("remote:P");
          expect(list.snapshot().byMap.get("map_a")?.map(r => r.id)).toEqual(["s1"]);
          // Many saves in a burst → one reload after the debounce.
          rows = [summary("s2", 2, null), summary("s1", 1, "map_a")];
          hooks.saved!("s2"); hooks.saved!("s2"); hooks.saved!("s1");
          await vi.advanceTimersByTimeAsync(99);
          expect(load).toHaveBeenCalledTimes(1);
          await vi.advanceTimersByTimeAsync(1);
          await vi.advanceTimersByTimeAsync(0);
          expect(load).toHaveBeenCalledTimes(2);
          expect(list.snapshot().gameWide.map(r => r.id)).toEqual(["s2"]);
          // Queue changes restate immediately, without reloading.
          let release: () => void = () => {};
          queue.enqueue({ mapKey: "map_a", label: "x", threadId: "s1", start: () => new Promise<void>(resolve => { release = resolve; }) });
          await vi.advanceTimersByTimeAsync(0);
          expect(list.snapshot().byMap.get("map_a")?.[0]?.state).toBe("working");
          open.push(decision("s1"));
          hooks.decisionsChanged!();
          expect(list.snapshot().byMap.get("map_a")?.[0]?.state).toBe("needs-answer");
          expect(load).toHaveBeenCalledTimes(2);
          expect(seen).toHaveBeenCalled();
          open.length = 0;
          hooks.decisionsChanged!();
          release();
          await vi.advanceTimersByTimeAsync(0);
          expect(list.snapshot().byMap.get("map_a")?.[0]).not.toHaveProperty("state");
          // Leaving the scope empties the list; disposal stops listening.
          list.setScope(null);
          await vi.advanceTimersByTimeAsync(0);
          expect(list.snapshot().byMap.size).toBe(0);
          list.dispose();
          expect(hooks.saved).toBeNull();
          expect(hooks.decisionsChanged).toBeNull();
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });
  // 전투 자원·감정·장비 부여·장비 강화의 편집기 노출(#7 #9 #16 #21 #23). 폼에서 바꾼 값이 저장값에 닿는지 본다.
  describe("mgL3BattleResourceEditor", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.database.states = [{ id: "state_joy", name: "기쁨" }];
      project.database.equipment = [
        normalizeEquipmentRecord({ id: "equip_blade", name: "검", slot: "weapon" }),
        normalizeEquipmentRecord({ id: "equip_blade_plus", name: "검+", slot: "weapon" }),
      ];
      store.replace(project);
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function byTestId(root: FakeElement, testid: string): FakeElement {
      const node = findByTestId(root, testid);
      if (!node) throw new Error(`missing ${testid}`);
      return node;
    }
    function change(root: FakeElement, testid: string, value: string): void {
      const node = byTestId(root, testid);
      node.value = value;
      node.dispatchEvent(new Event("change"));
    }
    function check(root: FakeElement, testid: string, checked: boolean): void {
      const node = byTestId(root, testid);
      node.checked = checked;
      node.dispatchEvent(new Event("change"));
    }
    describe("skill form: battle resource costs", () => {
      it("writes resource2Cost / limitSkill / partyGaugeCost and clears them at zero", () => {
        const skillId = store.getCurrent().database.skills[0]!.id;
        const form = document.createElement("section") as unknown as FakeElement;
        renderSkillRecordForm(form as unknown as HTMLElement, store.getCurrent().database.skills[0]!);
        const current = () => store.getCurrent().database.skills.find((skill) => skill.id === skillId)!;
        change(form, "db-field-skill-resource2-cost", "30");
        check(form, "db-field-skill-limit", true);
        change(form, "db-field-skill-party-gauge-cost", "50");
        expect(current()).toMatchObject({ resource2Cost: 30, limitSkill: true, partyGaugeCost: 50 });
        change(form, "db-field-skill-resource2-cost", "0");
        check(form, "db-field-skill-limit", false);
        expect(current().resource2Cost).toBeUndefined();
        expect(current().limitSkill).toBeUndefined();
      });
    });
    describe("state form: emotion family and tier", () => {
      it("sets the family, then the tier, and clearing the family removes the emotion", () => {
        const current = () => store.getCurrent().database.states[0]!;
        const render = (): FakeElement => {
          const form = document.createElement("section") as unknown as FakeElement;
          renderStateRecordForm(form as unknown as HTMLElement, current());
          return form;
        };
        change(render(), "db-state-emotion-family", "기쁨");
        expect(current().emotion).toEqual({ family: "기쁨", tier: 1 });
        change(render(), "db-state-emotion-tier", "3");
        expect(current().emotion).toEqual({ family: "기쁨", tier: 3 });
        change(render(), "db-state-emotion-family", "");
        expect(current().emotion).toBeUndefined();
      });
    });
    describe("equipment form: grants and half MP", () => {
      it("toggles granted skills, sets a granted skill command, and exposes the half-MP flag", () => {
        const skillId = store.getCurrent().database.skills[0]!.id;
        const current = () => store.getCurrent().database.equipment.find((record) => record.id === "equip_blade")!;
        const form = document.createElement("section") as unknown as FakeElement;
        const rerender = (): void => {
          form.replaceChildren();
          renderEquipmentRecordForm(form as unknown as HTMLElement, current(), rerender);
        };
        rerender();
        check(form, `db-field-equipment-grant-skill-${skillId}`, true);
        expect(current().grantsSkillIds).toEqual([skillId]);
        change(form, "db-field-equipment-grant-command-skill", skillId);
        expect(current().grantsCommand).toMatchObject({ id: "cmd_equip_equip_blade", kind: "skill", skillId });
        check(form, "db-field-equipment-effect-half-mp", true);
        expect(current().effectFlags.halfMpCost).toBe(true);
        check(form, `db-field-equipment-grant-skill-${skillId}`, false);
        change(form, "db-field-equipment-grant-command-skill", "");
        expect(current().grantsSkillIds).toBeUndefined();
        expect(current().grantsCommand).toBeUndefined();
      });
    });
    describe("system tab: battle resources", () => {
      // 시스템 탭은 HUD 편집기(databaseFieldHud)까지 한꺼번에 그리는데, 그 편집기가 ResizeObserver 를
      // 무조건 만든다. 공용 fakeDom 에는 없다(actionCombatEditorFields 도 같은 이유로 깨져 있다) —
      // 이 파일에서만 관찰을 하지 않는 대역을 끼운다. 검사 대상(전투 자원 필드)은 크기와 무관하다.
      let restoreResizeObserver: (() => void) | undefined;
      beforeEach(() => {
        const scope = globalThis as { ResizeObserver?: unknown };
        const previous = scope.ResizeObserver;
        scope.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} };
        restoreResizeObserver = () => { scope.ResizeObserver = previous; };
      });
      afterEach(() => restoreResizeObserver?.());

      function renderSystem(): FakeElement {
        const host = document.createElement("div") as unknown as FakeElement;
        const rerender = (): void => {
          host.replaceChildren();
          renderSystemTab(host as unknown as HTMLElement, rerender);
        };
        rerender();
        return host;
      }

      it("enables and disables each gauge, the weakness option, and parses the emotion cycle", () => {
        const system = () => store.getCurrent().system;
        check(renderSystem(), "db-field-system-limit-gauge", true);
        check(renderSystem(), "db-field-system-resource2", true);
        check(renderSystem(), "db-field-system-party-gauge", true);
        check(renderSystem(), "db-field-system-weakness-extra-action", true);
        expect(system().limitGauge?.enabled).toBe(true);
        expect(system().resource2?.enabled).toBe(true);
        expect(system().partyGauge?.enabled).toBe(true);
        expect(system().weaknessExtraAction).toBe(true);
        change(renderSystem(), "db-field-system-resource2-max", "60");
        expect(system().resource2?.max).toBe(60);
        change(renderSystem(), "db-field-system-emotion-cycle", "기쁨>분노=1.5\n엉터리\n분노 > 슬픔 = 2");
        expect(system().emotionCycle).toEqual([
          { attackerFamily: "기쁨", targetFamily: "분노", multiplier: 1.5 },
          { attackerFamily: "분노", targetFamily: "슬픔", multiplier: 2 },
        ]);
        check(renderSystem(), "db-field-system-limit-gauge", false);
        check(renderSystem(), "db-field-system-weakness-extra-action", false);
        change(renderSystem(), "db-field-system-emotion-cycle", "");
        expect(system().limitGauge).toBeUndefined();
        expect(system().weaknessExtraAction).toBeUndefined();
        expect(system().emotionCycle).toBeUndefined();
      });

      it("parseEmotionCycle drops malformed and negative lines", () => {
        expect(parseEmotionCycle("a>b=-1\na>b\n>b=2\nx>y=0.5")).toEqual([{ attackerFamily: "x", targetFamily: "y", multiplier: 0.5 }]);
      });
    });
    describe("life crafting: equipment upgrade target", () => {
      it("switching an upgrade row to equipment lists equipment and stores target", () => {
        const host = document.createElement("div") as unknown as FakeElement;
        const rerender = (): void => {
          host.replaceChildren();
          renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
        };
        rerender();
        byTestId(host, "db-life-section-upgrades").click();
        byTestId(host, "db-life-add").click();
        check(host, "db-life-upgrade-target-equipment", true);
        const rule = () => store.getCurrent().system.itemUpgrades![0]!;
        expect(rule()).toMatchObject({ target: "equipment", fromItemId: "equip_blade", toItemId: "equip_blade" });
        change(host, "db-life-upgrade-to-item", "equip_blade_plus");
        expect(rule().toItemId).toBe("equip_blade_plus");
        check(host, "db-life-upgrade-target-equipment", false);
        expect(rule().target).toBeUndefined();
      });
    });
  });
  describe("p1ReferenceIntegrity", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    afterEach(() => {
      resetToastsForTest();
      restoreDom?.();
      restoreDom = undefined;
    });
    describe("P1 farm-animal project reference integrity", () => {
      it("reports duplicate definitions and every cross-record failure with an exact authored path", () => {
        // Break caught: farm-animal rows can contain dangling ids and impossible capacity/compatibility without blocking play.
        const project = referenceProject();
        const [feedItem, productItem] = project.database.items;
        if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
        addEvent(project, "event_chicken");
        project.database.farmAnimalSpecies = [
          species("chicken", feedItem.id, productItem.id),
          species("cow", "missing_feed", "missing_product"),
          species("chicken", feedItem.id, productItem.id),
        ];
        project.system.farmAnimalBuildings = [
          building(project, "coop", 1, ["chicken", "missing_species"]),
          building(project, "coop", 4, ["chicken"]),
          { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
          { ...building(project, "off_map", 4, ["chicken"]), x: project.maps[project.startMapId]!.width },
          building(project, "cow_home", 4, ["chicken"]),
        ];
        project.session.farmAnimals = [
          { instanceId: "hen_1", speciesId: "chicken", name: "Hen 1", buildingId: "coop", eventId: "event_chicken" },
          { instanceId: "hen_2", speciesId: "chicken", name: "Hen 2", buildingId: "coop" },
          { instanceId: "hen_1", speciesId: "chicken", name: "Duplicate" },
          { instanceId: "ghost", speciesId: "missing_species", name: "Ghost" },
          { instanceId: "no_home", speciesId: "chicken", name: "No home", buildingId: "missing_building" },
          { instanceId: "no_event", speciesId: "chicken", name: "No event", eventId: "missing_event" },
          { instanceId: "wrong_home", speciesId: "cow", name: "Wrong home", buildingId: "cow_home" },
        ];

        const issues = collectProjectReferenceIssues(project);

        expect(issues).toEqual(expect.arrayContaining([
          "database.farmAnimalSpecies[2].id duplicates database.farmAnimalSpecies[0].id: chicken",
          "database.farmAnimalSpecies[1].feedItemId does not exist: missing_feed",
          "database.farmAnimalSpecies[1].productItemId does not exist: missing_product",
          "system.farmAnimalBuildings[1].id duplicates system.farmAnimalBuildings[0].id: coop",
          "system.farmAnimalBuildings[0].allowedSpeciesIds[1] does not exist: missing_species",
          "system.farmAnimalBuildings[2].mapId does not exist: missing_map",
          `system.farmAnimalBuildings[3].position (${project.maps[project.startMapId]!.width}, 0) is out of bounds for map ${project.startMapId}`,
          "session.farmAnimals[2].instanceId duplicates session.farmAnimals[0].instanceId: hen_1",
          "session.farmAnimals[3].speciesId does not exist: missing_species",
          "session.farmAnimals[4].buildingId does not exist: missing_building",
          "session.farmAnimals[5].eventId does not exist: missing_event",
          "session.farmAnimals[6].buildingId cow_home does not allow speciesId cow",
          "session.farmAnimals[1].buildingId exceeds system.farmAnimalBuildings[0].capacity: coop (1)",
        ]));
        expect(() => validateProjectReferences(project)).toThrow(/database\.farmAnimalSpecies\[2\]\.id/);
      });

      it("repairs invalid definitions and assignments without inventing replacement species or capacity", () => {
        // Break caught: load repair substitutes unrelated ids or leaves a cascading farm-animal reference failure.
        const project = referenceProject();
        const [feedItem, productItem] = project.database.items;
        if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
        addEvent(project, "event_keep");
        project.database.farmAnimalSpecies = [
          species("chicken", feedItem.id, productItem.id),
          species("cow", feedItem.id, productItem.id),
          species("invalid_items", "missing_feed", productItem.id),
        ];
        project.system.farmAnimalBuildings = [
          building(project, "coop", 1, ["chicken", "invalid_items", "missing_species"]),
          { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
          { ...building(project, "off_map", 4, ["chicken"]), y: project.maps[project.startMapId]!.height },
        ];
        project.session.farmAnimals = [
          { instanceId: "keep", speciesId: "chicken", name: "Keep", buildingId: "coop", eventId: "event_keep" },
          { instanceId: "overflow", speciesId: "chicken", name: "Overflow", buildingId: "coop" },
          { instanceId: "incompatible", speciesId: "cow", name: "Incompatible", buildingId: "coop" },
          { instanceId: "invalid_species", speciesId: "invalid_items", name: "Invalid items" },
          { instanceId: "unknown_species", speciesId: "missing_species", name: "Unknown" },
          { instanceId: "unknown_home", speciesId: "chicken", name: "Unknown home", buildingId: "missing_building" },
          { instanceId: "removed_home", speciesId: "chicken", name: "Removed home", buildingId: "missing_home" },
        ];

        repairProjectReferences(project);

        expect(project.database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken", "cow"]);
        // 맵 밖으로 나간 축사는 지우지 않고 맵 안으로 당긴다(배정된 개체를 말없이 풀지 않게) — 맵이 없어진 축사만 빠진다.
        const startHeight = project.maps[project.startMapId]!.height;
        expect(project.system.farmAnimalBuildings).toEqual([
          expect.objectContaining({ id: "coop", capacity: 1, allowedSpeciesIds: ["chicken"] }),
          expect.objectContaining({ id: "off_map", capacity: 4, y: startHeight - 1, allowedSpeciesIds: ["chicken"] }),
        ]);
        expect(project.session.farmAnimals?.map((row) => row.instanceId)).toEqual([
          "keep", "overflow", "incompatible", "unknown_home", "removed_home",
        ]);
        expect(project.session.farmAnimals?.find((row) => row.instanceId === "keep")).toMatchObject({
          speciesId: "chicken",
          buildingId: "coop",
          eventId: "event_keep",
        });
        for (const instanceId of ["overflow", "incompatible", "unknown_home", "removed_home"]) {
          expect(project.session.farmAnimals?.find((row) => row.instanceId === instanceId)?.buildingId).toBeUndefined();
        }
        expect(() => validateProjectReferences(project)).not.toThrow();
      });

      it("includes animal-home ids in map impact and clears only assignments to cascaded homes", () => {
        // Break caught: deleting a map silently leaves farmAnimalBuildings and starting-animal buildingIds dangling.
        const project = referenceProject();
        const target = addMap(project, "map_barnyard");
        target.events.push({
          id: "event_barnyard_hen",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [],
        });
        const [feedItem, productItem] = project.database.items;
        if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
        project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
        project.system.farmAnimalBuildings = [
          buildingOn(target, "coop", 4, ["chicken"]),
          buildingOn(target, "barn", 4, ["chicken"]),
          building(project, "source_home", 4, ["chicken"]),
        ];
        project.session.farmAnimals = [
          {
            instanceId: "coop_animal",
            speciesId: "chicken",
            name: "Coop",
            buildingId: "coop",
            eventId: "event_barnyard_hen",
          },
          { instanceId: "barn_animal", speciesId: "chicken", name: "Barn", buildingId: "barn" },
          { instanceId: "source_animal", speciesId: "chicken", name: "Source", buildingId: "source_home" },
        ];

        const impact = collectMapDeletionImpact(project, target.id);
        expect(impact?.farmAnimalBuildingCount).toBe(2);
        expect(impact?.farmAnimalBuildingIds).toEqual(["coop", "barn"]);

        applyMapDeletion(project, target.id);

        expect(project.system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["source_home"]);
        expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.buildingId).toBeUndefined();
        expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.eventId).toBeUndefined();
        expect(project.session.farmAnimals?.find((row) => row.instanceId === "barn_animal")?.buildingId).toBeUndefined();
        expect(project.session.farmAnimals?.find((row) => row.instanceId === "source_animal")?.buildingId).toBe("source_home");
        expect(() => validateProjectReferences(project)).not.toThrow();
      });

      it("blocks database item deletion when a species uses it as feed or product", () => {
        // Break caught: deleting an item used by a farm species bypasses the database reference guard.
        const project = referenceProject();
        const [feedItem, productItem] = project.database.items;
        if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
        project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
        store.replace(project);

        expect(databaseReferenceMessage("items", feedItem.id)).toMatch(/동물 종.*먹이/);
        expect(databaseReferenceMessage("items", productItem.id)).toMatch(/동물 종.*생산물/);
      });

      it("keeps referenced species and buildings when their farm-animal UI delete buttons are clicked", () => {
        // Break caught: the structured animal editor splices referenced species/buildings without consulting a guard.
        restoreDom = installFakeDom();
        const project = referenceProject();
        const [feedItem, productItem] = project.database.items;
        if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
        project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
        project.system.farmAnimalBuildings = [building(project, "coop", 4, ["chicken"])];
        project.session.farmAnimals = [{ instanceId: "hen", speciesId: "chicken", name: "Hen", buildingId: "coop" }];
        store.replace(project);
        const host = document.createElement("div") as unknown as FakeElement;
        renderFarmAnimalsTab(host as unknown as HTMLElement, () => undefined);

        findByTestId(host, "db-farm-species-chicken")?.querySelector("button")?.click();
        findByTestId(host, "db-farm-building-coop")?.querySelector("button")?.click();

        expect(store.getCurrent().database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken"]);
        expect(store.getCurrent().system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["coop"]);
      });
    });
    function referenceProject(): Project {
      return createBlankProject();
    }
    function species(id: string, feedItemId: string, productItemId: string): FarmAnimalSpeciesRecord {
      return {
        id,
        name: id,
        feedItemId,
        productItemId,
        productCount: 1,
        productEveryDays: 1,
        petFriendship: 10,
      };
    }
    function building(
      project: Project,
      id: string,
      capacity: number,
      allowedSpeciesIds: string[],
    ): FarmAnimalBuildingDefinition {
      return buildingOn(project.maps[project.startMapId]!, id, capacity, allowedSpeciesIds);
    }
    function buildingOn(
      map: GameMap,
      id: string,
      capacity: number,
      allowedSpeciesIds: string[],
    ): FarmAnimalBuildingDefinition {
      return { id, name: id, mapId: map.id, x: 0, y: 0, capacity, allowedSpeciesIds };
    }
    function addMap(project: Project, id: string): GameMap {
      const map = structuredClone(project.maps[project.startMapId]!);
      map.id = id;
      map.name = id;
      map.events = [];
      project.maps[id] = map;
      project.mapTree.children.push({ mapId: id, children: [] });
      return map;
    }
    function addEvent(project: Project, id: string): void {
      const event: GameEvent = {
        id,
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
      };
      project.maps[project.startMapId]!.events.push(event);
    }
  });
});

describe("editorPanelsSuite25", () => {
  isolateTimers();
  describe("spatialManualBuildBoundary", () => {
    isolateTimers();
    afterEach(() => bindSpatialAuthoringControllerFactory(null));
    it("builds canonical place maps when the gallery carries explicit library identity", () => {
      // Given
      const fixture = placeCompilerFixture();
      const document = fixtureDocument(fixture);
      const source = own(document.occurrences, placeRoot).source;
      const project = { ...fixture, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
      installManualProject(project);
      patchSpatialSession({ tab: "places", mode: "design" });
      const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === source.id);
      const canonical = authoringValue(resolveSpatialBuildSource(card));
      if (canonical.kind !== "place") throw new TypeError("Expected place source");
      // When
      const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: canonical.kind, id: canonical.id },
        rootId: spatialId("new-place-not-fixture-root"), seed: 19, destination: { kind: "new-maps" } }));
      // Then
      expect(card).toMatchObject({ canonicalSource: { kind: "place", id: source.id } });
      const built = fixtureDocument(preview.project);
      expect(built.rootOccurrenceIds).toEqual(["new-place-not-fixture-root"]);
      expect(Object.keys(preview.project.maps).length).toBeGreaterThan(Object.keys(project.maps).length);
      expect(Object.values(built.occurrences).every(occurrence => occurrence.seed === 19 && occurrence.parentSlot !== undefined)).toBe(true);
      expect(store.getCurrent()).toEqual(project);
    });
    it.each(["objects", "spaces"] as const)("carries true canonical identity for %s without deriving it from kit IDs", tab => {
      // Given
      manualBuildFixture();
      patchSpatialSession({ tab, mode: "design" });
      const id = tab === "objects" ? "hearth-design" : spaceDesign;
      const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === id);
      // When
      const source = authoringValue(resolveSpatialBuildSource(card));
      // Then
      expect(source).toEqual({ kind: tab === "objects" ? "object" : "space", id });
    });
    it("requires explicit conversion when a compatibility card has a coincident canonical localId", () => {
      // Given
      manualBuildFixture();
      const card = { id: "legacy-room", localId: spaceDesign, name: "Compiler room", source: "own", kind: "spaces",
        usage: 0, compatibility: "room-rule" } as const;
      // When
      const result = resolveSpatialBuildSource(card);
      // Then
      expect(result).toMatchObject({ kind: "error", error: { code: "unsupported", message: "canonical-copy-required" } });
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
    it.each(["selection", "entry", "map-mismatch", "fractional-seed"] as const)("rejects missing or invalid %s before a proposal is issued", fault => {
      // Given
      const { project, target } = manualBuildFixture();
      // When
      const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("invalid-target"),
        seed: fault === "fractional-seed" ? 19.5 : 19, destination: { kind: "map", currentMapId: target.mapId,
          selection: fault === "selection" ? null : { ...target.rect, mapId: fault === "map-mismatch" ? "other-map" : target.mapId },
          entry: fault === "entry" ? null : target.entry } });
      // Then
      expect(result.kind).toBe("error");
      expect(hasAuthoringPreview()).toBe(false);
      expect(store.getCurrent()).toEqual(project);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
    it("discloses the original frozen proposal when source and seed controls change", () => {
      // Given
      manualBuildFixture();
      const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("disclosed-root"), seed: 19,
        destination: { kind: "new-maps" } } as const;
      const preview = authoringValue(previewSpatialSourceBuild(input));
      patchSpatialSession({ designId: "another-visible-source" });
      // When
      const result = previewSpatialSourceBuild({ ...input, seed: 31 });
      // Then
      expect(result).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
      expect(spatialBuildProposal()).toEqual({ input, preview });
      expect(Object.isFrozen(spatialBuildProposal()?.input)).toBe(true);
    });
    it("drops transient build inputs when project identity changes", () => {
      // Given
      const { project } = manualBuildFixture();
      authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("project-one"), seed: 19,
        destination: { kind: "new-maps" } }));
      // When
      store.replaceProject(project);
      // Then
      expect(spatialBuildProposal()).toBeNull();
      expect(hasAuthoringPreview()).toBe(false);
    });
  });
  describe("spatialOccurrenceOrigin", () => {
    isolateTimers();
    describe("occurrence origin stamp", () => {
      it("threads an ai origin from the instantiation request into every created occurrence and survives IO", () => {
        // Given
        const { project, document, request } = instancesFixture();
        // When
        const result = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
        const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
        // Then
        const occurrences = Object.values(reloaded?.occurrences ?? {});
        expect(occurrences.length).toBeGreaterThan(0);
        expect(occurrences.every((entry) => entry.origin === "ai")).toBe(true);
        expect(occurrences.every((entry) => occurrenceOrigin(entry) === "ai")).toBe(true);
      });

      it("keeps historical occurrences unstamped and classifies them by the generator tag", () => {
        // Given
        const { project, document, request } = instancesFixture();
        // When: no origin in the request, exactly like pre-field data.
        const result = instantiateSpatialDesign(document, project, request);
        const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
        // Then: the field stays absent; classification falls back to the tag.
        expect(Object.values(reloaded?.occurrences ?? {}).every((entry) => entry.origin === undefined)).toBe(true);
        expect(occurrenceOrigin({ generatorVersion: "spatial-ai-v1" })).toBe("ai");
        expect(occurrenceOrigin({ generatorVersion: "spatial-legacy-house-v1" })).toBe("ai");
        expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1" })).toBe("user");
        expect(occurrenceOrigin({ generatorVersion: "place-room-editor-v1" })).toBe("user");
        expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1", origin: "ai" })).toBe("ai");
      });

      it("aggregates per-design usage with ai and direct counts for the gallery", () => {
        // Given: one ai build and the design ids it references.
        const { project, document, request } = instancesFixture();
        const built = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
        const authored = { ...project, spatialAuthoring: built };
        const anyOccurrence = Object.values(built.occurrences)[0];
        // When
        const usage = designUsage(authored, anyOccurrence.source.id);
        // Then
        expect(usage.rows.length).toBeGreaterThan(0);
        expect(usage.ai).toBe(usage.rows.length);
        expect(usage.direct).toBe(0);
        expect(usageSummary(usage)).toContain("AI");
        expect(matchesUsageFilter(usage, "ai")).toBe(true);
        expect(matchesUsageFilter(usage, "idle")).toBe(false);
        expect(matchesUsageFilter(usage, "placed")).toBe(true);
        // And: an unused design id lands in the idle bucket.
        const idle = designUsage(authored, "design-that-was-never-placed");
        expect(usageSummary(idle)).toBe("아직 안 쓰임");
        expect(matchesUsageFilter(idle, "idle")).toBe(true);
        expect(matchesUsageFilter(idle, "ai")).toBe(false);
      });
    });
  });
  describe("teamWorkflowUi", () => {
    isolateTimers();
    const COMMIT_ROWS = [
      {
        agentName: null,
        authorId: "session-1",
        authorKind: "human",
        authorLabel: "tester@example.com",
        commitId: "commit-1",
        createdAt: "2026-07-06T12:00:00.000Z",
        message: "변경 저장",
        reviewStatus: "direct",
        summary: "타일 3",
      },
    ] as const;
    const OWNER_LABEL_KEY = "oprn:editor-owner-label";
    const LAST_LOGIN_METHOD_KEY = "oprn:editor-last-login-method";
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number {
        return this.values.size;
      }

      clear(): void {
        this.values.clear();
      }

      getItem(key: string): string | null {
        return this.values.get(key) ?? null;
      }

      key(index: number): string | null {
        return Array.from(this.values.keys())[index] ?? null;
      }

      removeItem(key: string): void {
        this.values.delete(key);
      }

      setItem(key: string, value: string): void {
        this.values.set(key, value);
      }
    }
    let restoreDom: (() => void) | null = null;
    let storage: MemoryStorage;
    let session: MemoryProjectSession | null = null;
    function fakeBody(): FakeElement {
      if (document.body instanceof FakeElement) return document.body;
      throw new Error("Expected fake body");
    }
    function fakeElement(node: HTMLElement): FakeElement {
      if (node instanceof FakeElement) return node;
      throw new Error("Expected fake element");
    }
    function installStorage(): void {
      storage = new MemoryStorage();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: storage,
      });
    }
    function installWindow(): void {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: Object.assign(new EventTarget(), {
          localStorage: storage,
          setTimeout: (handler: TimerHandler) => {
            if (typeof handler === "function") handler();
            return 0;
          },
        }),
      });
      Object.defineProperty(document, "addEventListener", {
        configurable: true,
        value: vi.fn(),
      });
      Object.defineProperty(document, "removeEventListener", {
        configurable: true,
        value: vi.fn(),
      });
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
      installStorage();
      installWindow();
      // 커밋 목록은 포트가 정본이다. 예전에는 sync 모듈을 목킹했는데, 그 목은 기본 어댑터가
      // LegacyDb 일 때만 살아 있었다 — 기본값이 바뀌면 조용히 빈 목록을 검증하게 된다.
      session = installMemoryProjectSession();
      vi.spyOn(session.repository.commits, "list").mockResolvedValue([...COMMIT_ROWS]);
      store.replace(createBlankProject());
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      session?.dispose();
      session = null;
      Reflect.deleteProperty(globalThis, "localStorage");
      Reflect.deleteProperty(globalThis, "window");
      vi.restoreAllMocks();
    });
    describe("team workflow UI", () => {
      it("명시적으로 열면 이메일 신원을 저장한다 (네트워크 인증 없음)", () => {
        openMockLoginModal();
        const modal = findByTestId(fakeBody(), "login-modal");
        const email = findByTestId(fakeBody(), "login-email") as FakeElement | null;
        const submit = findByTestId(fakeBody(), "login-submit");
        if (!modal || !email || !submit) throw new Error("login modal controls missing");

        email.value = "tester@example.com";
        submit.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const form = submit.parentElement;
        form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(storage.getItem(OWNER_LABEL_KEY)).toBe("tester@example.com");
        expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("email");
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

        openLoginModalIfNeeded();
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      });

      it("부팅 게이트는 로그인 벽을 세우지 않고 게스트 신원만 확보한다", () => {
        // 2026-09-22: 이 모달은 "로그인" 이지만 실제로는 커밋 이름표만 정한다. 팀 권한과 코드 경로가
        // 겹치지 않으므로 팀을 안 쓰는 사용자에게는 의미 없는 관문이었고, 한 번 넘기면 영영 안 떠서
        // 정작 팀을 시작하려는 사람에게 안내가 없었다. 부팅에서는 묻지 않는다.
        openLoginModalIfNeeded();
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
        expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
        // 사용자가 아무것도 안 했는데 「목업 로그인 신원을 설정했습니다」가 뜨면 개발용 문구가 첫 화면에 샌다.
        expect(findByTestId(fakeBody(), "toast")).toBeNull();
      });

      it("suppresses the boot login modal in automation/dev boot contexts", () => {
        (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?freshProject=1" };
        openLoginModalIfNeeded();
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();

        (globalThis.window as unknown as { location?: { search: string } }).location = { search: "?blankProject=1" };
        openLoginModalIfNeeded();
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
      });

      it("auto-guests for deep-linked ?project= without showing login modal", () => {
        (globalThis.window as unknown as { location?: { search: string } }).location = {
          search: "?project=rpg-zzu-narrative-horror-demos",
        };
        openLoginModalIfNeeded();
        expect(findByTestId(fakeBody(), "login-modal")).toBeNull();
        expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("guest");
      });

      it("switches OAuth to name-only mock flow and stores the selected provider", () => {
        // 부팅 게이트는 더 이상 모달을 열지 않으므로, OAuth 흐름은 명시적 호출로 확인한다.
        openMockLoginModal();
        findByTestId(fakeBody(), "login-oauth-google")?.click();
        const name = findByTestId(fakeBody(), "login-name") as FakeElement | null;
        if (!name) throw new Error("login-name missing");
        name.value = "Google 리뷰어";
        name.parentElement?.parentElement?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(storage.getItem(OWNER_LABEL_KEY)).toBe("Google 리뷰어");
        expect(storage.getItem(LAST_LOGIN_METHOD_KEY)).toBe("google");
      });

      it("renders topbar identity and allows label edits from the identity menu", () => {
        setOwnerLabel("기존 사용자");
        const topbar = document.createElement("div");
        // 톱바는 더 이상 신원 단추를 그리지 않는다(⌘K 「편집 이름」) — 단추만 다시 그려 갱신을 본다.
        const rerender = (): void => { topbar.replaceChildren(renderIdentityTopbarControl(rerender)); };
        rerender();
        expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("기존 사용자");

        findByTestId(fakeElement(topbar), "topbar-identity")?.click();
        const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
        if (!input) throw new Error("identity input missing");
        input.value = "새 사용자";
        findByTestId(fakeBody(), "identity-save")?.click();

        expect(storage.getItem(OWNER_LABEL_KEY)).toBe("새 사용자");
        expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("새 사용자");
      });

      it("loads commit history rows through the read-only LegacyDb commit API", async () => {
        const button = renderCommitHistoryButton();
        document.body.append(button);

        button.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();
        expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("tester@example.com");
        expect(findByTestId(fakeBody(), "commit-history-row-commit-1")?.textContent).toContain("direct");
      });

      it("⌘K 저장 기록·편집 이름 명령이 톱바 단추 없이 같은 패널·메뉴를 연다", async () => {
        // Break: 2026-11 개편으로 톱바 단추를 뺀 뒤 저장 기록·편집 이름에 닿는 길이 사라진다.
        const ids = listEditorCommands().map((command) => command.id);
        expect(ids).toContain("commit-history-toggle");
        expect(ids).toContain("topbar-identity");
        const topbar = document.createElement("div");
        renderTopbar(topbar);
        expect(findByTestId(fakeElement(topbar), "commit-history-toggle")).toBeNull();
        expect(findByTestId(fakeElement(topbar), "topbar-identity")).toBeNull();

        openCommitHistoryPanel();
        await Promise.resolve();
        await Promise.resolve();
        expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();

        setOwnerLabel("기존 사용자");
        openIdentityMenu(() => undefined);
        expect(findByTestId(fakeBody(), "commit-history-panel"), "한 번에 하나만 뜬다").toBeNull();
        const input = findByTestId(fakeBody(), "identity-label-input") as FakeElement | null;
        expect(input?.value).toBe("기존 사용자");
      });

      it("renders history and identity as icon-only controls", () => {
        setOwnerLabel("게스트");
        const history = renderCommitHistoryButton();
        const identity = renderIdentityTopbarControl(() => undefined);
        document.body.append(history, identity);

        expect(history.className).toContain("is-icon-only");
        expect(history.getAttribute("aria-label")).toBe("저장 기록");
        expect(history.textContent?.includes("기록")).toBe(false);
        expect(identity.className).toContain("is-icon-only");
        expect(findByTestId(fakeElement(identity), "topbar-identity-label")?.textContent).toBe("게스트");
      });
    });
  });
  // OPRN-OUT-026 편집기 표면 — 사용자가 가져온 메타를 받아들이기 전에 홈 레이어와
  // 받침 정책을 직접 보고 바꿀 수 있어야 한다. 검토 목록은 자동으로 적용되지 않는다.
  describe("tileLayerPolicyEditorSurface", () => {
    isolateTimers();
    const CONIFER_TRUNK = 290;
    // 아래 시험은 칸 DOM 격자(「칸 편집」)를 다룬다 — 기본 보기는 정적 시트다(qa1124-space PR6).
    beforeEach(() => setChipsetGridEditing(true));
    afterEach(() => setChipsetGridEditing(false));
    describe("타일 레이어·배경 정책 편집기 표면", () => {
      let restoreDom: (() => void) | null = null;

      beforeEach(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
        restoreDom = installFakeDom();
        setTilesetMetadataEditMode("passage", () => {});
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      function renderEditor(): FakeElement {
        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
      }

      function selectTile(tile: number): FakeElement {
        let editor = renderEditor();
        (findByTestId(editor, `tileset-db-cell-${tile}`) as unknown as HTMLElement).click();
        editor = renderEditor();
        return editor;
      }

      it("밑동을 고르면 정책 부류·근거와 다중 조각 제약이 보인다", () => {
        const editor = selectTile(CONIFER_TRUNK);
        const reason = findByTestId(editor, "tileset-layer-policy-reason") as unknown as { textContent?: string };
        expect(String(reason.textContent ?? "")).toContain("받침 있는 하위");
        expect(findByTestId(editor, "tileset-layer-multipart")).toBeTruthy();
      });

      it("받침 컨트롤에서 없음을 고르면 사용자 확정으로 기록되고 렌더 받침이 사라진다", () => {
        let editor = selectTile(CONIFER_TRUNK);
        expect(findByTestId(editor, "tileset-rule-backing")).toBeTruthy();
        (findByTestId(editor, "tileset-backing-none") as unknown as HTMLElement).click();

        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        expect(userTileBackingOverride(tileset, CONIFER_TRUNK)).toBe("none");
        expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();

        editor = selectTile(CONIFER_TRUNK);
        expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy();
      });

      it("받침을 잔디로 되돌리면 렌더 받침이 다시 붙는다", () => {
        selectTile(CONIFER_TRUNK);
        (findByTestId(renderEditor(), "tileset-backing-none") as unknown as HTMLElement).click();
        (findByTestId(renderEditor(), "tileset-backing-tile") as unknown as HTMLElement).click();

        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
      });

      it("검토 목록은 받침 없는 투명 하위 타일이 생길 때만 나타난다", () => {
        expect(findByTestId(selectTile(CONIFER_TRUNK), "tileset-rule-review")).toBeNull();

        store.update((project) => {
          const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
          if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        });

        const editor = selectTile(CONIFER_TRUNK);
        expect(findByTestId(editor, "tileset-rule-review")).toBeTruthy();
        expect(findByTestId(editor, `tileset-review-item-${CONIFER_TRUNK}`)).toBeTruthy();
      });

      it("검토 항목의 상위 오버레이 선택은 그 타일만 상위로 확정한다", () => {
        store.update((project) => {
          const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
          if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        });
        const editor = selectTile(CONIFER_TRUNK);
        (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-overlay`) as unknown as HTMLElement).click();

        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBe("upper");
        expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("upper");
        expect(tileLayerHome(tileset, 291)).toBe("lower");
      });

      it("검토 항목의 자동 선택은 하네스 기본값으로 되돌린다", () => {
        store.update((project) => {
          const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
          if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        });
        const editor = selectTile(CONIFER_TRUNK);
        (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-auto`) as unknown as HTMLElement).click();

        const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
        expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBeNull();
        expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("lower");
        expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
      });
    });
  });
  describe("tilePalette", () => {
    isolateTimers();
    describe("tilePaletteCatalog", () => {
      isolateTimers();
      function pass(count: number) {
        return Array.from({ length: count }, () => ({ up: true, down: true, left: true, right: true }));
      }
      function kit(partial: Pick<SectionStructureKitDef, "id" | "name" | "width" | "height" | "rows"> & {
        role?: "building" | "prop";
        themes?: string[];
        tags?: string[];
      }): SectionStructureKitDef {
        return {
          id: partial.id,
          name: partial.name,
          kind: "section",
          width: partial.width,
          height: partial.height,
          rows: partial.rows,
          learnedFrom: "user-paint",
          ai: {
            description: partial.name ?? partial.id,
            placementRules: "",
            role: partial.role,
            themes: partial.themes,
            tags: partial.tags,
          },
        };
      }
      function roadGroup(): AutotileGroup {
        return {
          id: "dirt-road",
          name: "조선 흙길",
          memberTileIds: [1, 8],
          variantMap: { "0": 1, "255": 8 },
          layer: "lower",
        };
      }
      function fixture(): TilesetDef {
        const count = 16;
        return {
          id: "catalog-fixture",
          name: "합성",
          kind: "custom",
          image: { type: "bundled", id: "catalog-sheet" },
          tileSize: 16,
          count,
          tilesPerRow: 8,
          passability: pass(count),
          priority: Array.from({ length: count }, () => "lower"),
          terrain: Array(count).fill(0),
          tileMeta: [
            undefined,
            { label: "흙길 외곽" },
            undefined,
            { label: "연못" },
            { label: "기와 조각", tags: ["기와"] },
          ],
          autotileGroups: [roadGroup()],
          tileGroups: [
            {
              id: "pond",
              name: "연못",
              role: "water",
              defaultLayer: "lower",
              tileIds: [3],
              description: "",
              placementRules: "",
            },
            {
              id: "road-dup",
              name: "조선 흙길 (오토타일)",
              role: "terrain",
              defaultLayer: "lower",
              tileIds: [1, 8],
              description: "",
              placementRules: "",
            },
            {
              id: "house-group",
              name: "기와 묶음",
              role: "building",
              defaultLayer: "lower",
              tileIds: [4],
              description: "",
              placementRules: "",
            },
          ],
          structureKits: [
            kit({
              id: "giwa-house",
              name: "조선 기와집",
              width: 2,
              height: 2,
              rows: [{ tiles: [4, 5] }, { tiles: [4, 5] }],
              role: "building",
              themes: ["village", "마을"],
              tags: ["기와"],
            }),
          ],
        };
      }
      describe("tile palette catalog", () => {
        it("paints an autotile from the filled neighbor and files a dirt road under 길", () => {
          const group = roadGroup();
          expect(autotilePaintTile(group)).toBe(8);
          expect(classifyTerrainChip("조선 흙길", "dirt-road", "", [])).toBe("road");
          const road = paletteCatalogFor(fixture()).terrain.find((card) => card.autotileGroupId === "dirt-road");
          expect(road).toMatchObject({ kind: "autotile", chip: "road", paintTile: 8, name: "조선 흙길" });
        });

        it("drops a tile group that is already an autotile and keeps water and buildings searchable", () => {
          const catalog = paletteCatalogFor(fixture());
          expect(catalog.terrain.map((card) => card.name)).not.toContain("조선 흙길 (오토타일)");
          expect(catalog.terrain.map((card) => card.chip)).toContain("water");
          expect(catalog.otherGroups.map((card) => card.name)).toEqual(["기와 묶음"]);
        });

        it("ranks prefabs ahead of individual tiles and prefers Hangul theme chips", () => {
          const tileset = fixture();
          const found = searchPaletteCatalog(tileset, "기와");
          expect(found.prefabs.map((hit) => hit.kind === "prefab" ? hit.card.name : "")).toContain("조선 기와집");
          expect(found.tiles.map((hit) => hit.kind === "tile" ? hit.label : "")).toContain("기와 조각");
          expect(found.prefabTotal).toBeGreaterThan(0);
          expect(found.tileTotal).toBeGreaterThan(0);
          const chips = prefabChips(paletteCatalogFor(tileset).prefabs);
          expect(chips.map((chip) => chip.label)).toContain("마을");
          expect(chips.map((chip) => chip.label)).not.toContain("village");
        });

        it("samples a prefab mosaic in the kit's own column count", () => {
          const house = fixture().structureKits![0]!;
          expect(prefabThumbTiles(house, 16)).toEqual({ columns: 2, tiles: [4, 5, 4, 5] });
        });

        it("has no smart catalog when the tileset has no groups or kits", () => {
          const bare = fixture();
          bare.autotileGroups = [];
          bare.tileGroups = [];
          bare.structureKits = [];
          expect(paletteHasSmartCatalog(bare)).toBe(false);
        });

        it("builds joseon terrain from the real autotile body and skips the duplicate road group", () => {
          const tileset = createJoseonBaramTileset();
          const started = performance.now();
          const catalog = paletteCatalogFor(tileset);
          expect(performance.now() - started).toBeLessThan(1000);
          const road = tileset.autotileGroups?.find((group) => group.name === "조선 흙길");
          expect(road?.variantMap["255"]).toEqual(expect.any(Number));
          const card = catalog.terrain.find((item) => item.autotileGroupId === road?.id);
          expect(card).toMatchObject({ name: "조선 흙길", kind: "autotile", paintTile: road?.variantMap["255"] });
          expect(catalog.terrain.some((item) => item.name === "조선 흙길 (오토타일)")).toBe(false);
          const found = searchPaletteCatalog(tileset, "기와집");
          expect(found.prefabs.some((hit) => hit.kind === "prefab" && hit.card.name.includes("기와집"))).toBe(true);
        });

        it("builds beodeul prefabs and a named road card", () => {
          const catalog = paletteCatalogFor(createBeodeulCityTileset());
          expect(catalog.prefabs.length).toBeGreaterThan(100);
          expect(catalog.terrain.some((card) => card.name.includes("버들항 길"))).toBe(true);
        });
      });
    });
    describe("tilePaletteGrid", () => {
      isolateTimers();
      // RM2003식 팔레트 모델 — 6열 리플로우 대상 목록(오토타일 대표 축약 + 변형 숨김) 순수 계산 검증.
      // 오토타일 그룹 목록은 autotileGroupsForTileset() 동적 조회이므로, 내장 그룹이 추가되어도
      // 깨지지 않도록 "포함/제외" 단위로만 단언한다(전체 목록 동등 비교 금지).

      const COMBINED_TOWN_COUNT = 480;
      function makeDefaultTileset(overrides?: Partial<TilesetDef>): TilesetDef {
        return {
          count: COMBINED_TOWN_COUNT,
          id: "combined_town_test",
          kind: "rpg2k",
          image: { id: "tex_easyrpg_chipset_combined_town", type: "bundled" },
          name: "Combined town",
          passability: Array.from({ length: COMBINED_TOWN_COUNT }, () => ({ down: true, left: true, right: true, up: true })),
          priority: Array.from({ length: COMBINED_TOWN_COUNT }, () => "lower" as const),
          terrain: Array.from({ length: COMBINED_TOWN_COUNT }, () => 0),
          tileSize: 16,
          tilesPerRow: 30,
          ...overrides,
        };
      }
      function makeCustomTileset(groups: AutotileGroup[]): TilesetDef {
        return makeDefaultTileset({
          kind: "custom",
          autotileGroups: groups,
          count: 32,
          id: "custom_test",
          image: { id: "tex_custom_sheet", type: "bundled" },
          tilesPerRow: 8,
        });
      }
      function unionTileIds(tileset: TilesetDef): ReadonlySet<number> {
        return new Set([
          ...buildGridPaletteModel(tileset, "lower").tileIds,
          ...buildGridPaletteModel(tileset, "upper").tileIds,
        ]);
      }
      describe("buildGridPaletteModel (RM2003식 6열 팔레트 모델)", () => {
        it("fixes the palette reflow at 6 columns", () => {
          expect(GRID_PALETTE_COLUMNS).toBe(6);
        });

        it("collapses water/waterfall and builtin autotile groups to single representative cells up front", () => {
          const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
          const reps = model.autotiles.map((entry) => entry.representativeTile);

          // RM2K식: 물(0)·폭포(93)가 맨 앞, 이어서 오토타일 그룹 대표(외딴/anchor).
          expect(reps[0]).toBe(0);
          expect(reps[1]).toBe(93);
          expect(reps).toContain(360); // 흙길
          expect(reps).toContain(363); // 모래
          expect(reps).toContain(129); // 포석
          expect(reps).toContain(126); // 경작지
          // 대표는 중복 없이 1칸씩.
          expect(new Set(reps).size).toBe(reps.length);
        });

        it("hides variantMap output tiles and water animation frames from the plain listing", () => {
          const tileset = makeDefaultTileset();
          const listed = unionTileIds(tileset);

          // 흙길 몸통/변 변형, 모래 몸통, 포석 몸통, 호수·폭포 프레임은 일반 나열에서 숨김.
          for (const hiddenTile of [421, 391, 424, 190, 120, 94, 0, 93, 360, 363]) {
            expect(listed.has(hiddenTile)).toBe(false);
          }
          // 오토타일이 아닌 일반 타일(돌바닥 342)은 그대로 나열.
          expect(listed.has(342)).toBe(true);
        });

        it("keeps the plain listing sorted, unique, and disjoint from representatives", () => {
          const model = buildGridPaletteModel(makeDefaultTileset(), "lower");
          const sorted = [...model.tileIds].sort((a, b) => a - b);

          expect(model.tileIds).toEqual(sorted);
          expect(new Set(model.tileIds).size).toBe(model.tileIds.length);
          for (const entry of model.autotiles) {
            expect(model.tileIds).not.toContain(entry.representativeTile);
          }
        });

        it("uses tileset autotile groups (no water entries) for non-default chipsets", () => {
          const group: AutotileGroup = {
            id: "custom_floor",
            memberTileIds: [5, 6, 7],
            name: "커스텀 바닥",
            variantMap: { "0": 5, "1": 6, "2": 7 },
          };
          const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");

          expect(model.autotiles).toEqual([{ id: "custom_floor", name: "커스텀 바닥", representativeTile: 5 }]);
          expect(model.tileIds).not.toContain(6);
          expect(model.tileIds).not.toContain(7);
          // 물 축약은 combined_town 전용 — 커스텀 칩셋에서는 0이 일반 타일.
          expect(model.tileIds).toContain(0);
        });

        it("falls back to the first member when a group has no mask-0 variant", () => {
          const group: AutotileGroup = {
            id: "no_isolated",
            memberTileIds: [9, 10],
            name: "외딴 없음",
            variantMap: { "15": 10 },
          };
          expect(autotileRepresentativeTile(group)).toBe(9);
          const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
          expect(model.autotiles[0]?.representativeTile).toBe(9);
        });

        it("skips groups whose representative is outside the tileset", () => {
          const group: AutotileGroup = {
            id: "out_of_range",
            memberTileIds: [999],
            name: "범위 밖",
            variantMap: { "0": 999 },
          };
          const model = buildGridPaletteModel(makeCustomTileset([group]), "lower");
          expect(model.autotiles).toEqual([]);
        });
      });
      describe("gridPaletteDisplayTile (숨겨진 변형 → 대표 칸 매핑)", () => {
        it("maps hidden autotile variants and water frames to their representative", () => {
          const tileset = makeDefaultTileset();
          expect(gridPaletteDisplayTile(tileset, 421)).toBe(360); // 흙길 몸통 → 대표
          expect(gridPaletteDisplayTile(tileset, 1)).toBe(0); // 호수 프레임 → 물 대표
          expect(gridPaletteDisplayTile(tileset, 123)).toBe(93); // 폭포 프레임 → 폭포 대표
          expect(gridPaletteDisplayTile(tileset, 465)).toBe(465); // 일반 타일은 그대로
        });
      });
      describe("custom atlas palette", () => {
        it("infers kind-less uploaded and non-480 atlases as custom", () => {
          const uploaded = makeDefaultTileset({ kind: undefined, image: { id: "legacy_upload", type: "uploaded" } });
          const non480 = makeDefaultTileset({ kind: undefined, count: 32 });
          expect(buildCustomPaletteModel(uploaded)).toHaveLength(480);
          expect(buildCustomPaletteModel(non480)).toHaveLength(32);
        });

        it("lists exact source cells without RM2K autotile collapse", () => {
          const tileset = makeCustomTileset([{
            id: "custom_floor",
            memberTileIds: [5, 6, 7],
            name: "커스텀 바닥",
            variantMap: { "0": 5, "1": 6, "2": 7 },
          }]);

          expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
        });

        it("keeps the complete source sheet visible regardless of the active layer", () => {
          const tileset = makeCustomTileset([]);
          tileset.priority[3] = "upper";
          tileset.priority[11] = "upper";

          expect(buildCustomPaletteModel(tileset)).toEqual(Array.from({ length: 32 }, (_, index) => index));
        });

        it("keeps source rows contiguous in the custom palette", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeCustomTileset([]);
            tileset.count = 480;
            tileset.tilesPerRow = 30;
            const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset }));
            expect(root.dataset.paletteKind).toBe("custom");
            expect(root.dataset.sourceColumns).toBe("30");
            expect(root.dataset.sourceRows).toBe("16");
            expect(root.dataset.displayColumns).toBe("30");
            expect(root.getAttribute("style")).toContain("--custom-cols:30");
            expect(root.getAttribute("style")).toContain(`--custom-min-cell:${CUSTOM_PALETTE_MIN_CELL_SIZE}px`);
            expect(root.querySelectorAll("button")).toHaveLength(480);
          } finally {
            restore();
          }
        });
      });
      // 좌패널 1면 통합(2026-08-21): 검색·분류 필터가 **이 팔레트 하나**에 걸린다.
      // 예전에는 「찾기」 탭이 별개 그리드로 타일셋을 두 번째로 그렸고, 오토타일 대표 1칸
      // 규칙을 안 따라 같은 칩셋이 탭에 따라 다르게 보였다.
      describe("팔레트 필터 (visibleTiles)", () => {
        it("필터가 없으면(null) 전량 노출한다", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeDefaultTileset();
            const unfiltered = renderWithFakeDom(() =>
              makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset })
            );
            const explicitNull = renderWithFakeDom(() =>
              makeGridPalette({ layer: "lower", onSelectTile: () => undefined, selectedTile: 0, tileset, visibleTiles: null })
            );
            expect(explicitNull.querySelectorAll("button").length).toBe(unfiltered.querySelectorAll("button").length);
            expect(unfiltered.querySelectorAll("button").length).toBeGreaterThan(20);
          } finally {
            restore();
          }
        });

        it("6열 리플로우 팔레트는 걸러진 칸을 숨긴다 — 위치가 정보가 아니므로", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeDefaultTileset();
            const root = renderWithFakeDom(() =>
              makeGridPalette({
                layer: "lower",
                onSelectTile: () => undefined,
                selectedTile: 342,
                tileset,
                visibleTiles: new Set([342]),
              })
            );
            // 선택 타일 하나만 남는다(선택은 항상 예외로 그려진다).
            expect(root.querySelectorAll("button")).toHaveLength(1);
            expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
          } finally {
            restore();
          }
        });

        it("선택 타일은 필터에 안 걸려도 항상 그린다 — 안 그러면 '선택 중'인 칸이 사라진다", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeDefaultTileset();
            const root = renderWithFakeDom(() =>
              makeGridPalette({
                layer: "lower",
                onSelectTile: () => undefined,
                selectedTile: 342,
                tileset,
                // 342 는 필터 밖이다.
                visibleTiles: new Set([465]),
              })
            );
            expect(root.querySelector('[data-testid="chipset-tile-342"]')).not.toBeNull();
            expect(root.querySelector('[data-testid="chipset-tile-465"]')).not.toBeNull();
            expect(root.querySelectorAll("button")).toHaveLength(2);
          } finally {
            restore();
          }
        });

        it("결과가 0이면 빈 안내를 남긴다", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeDefaultTileset();
            const root = renderWithFakeDom(() =>
              makeGridPalette({
                layer: "lower",
                onSelectTile: () => undefined,
                selectedTile: -1,
                tileset,
                visibleTiles: new Set<number>(),
              })
            );
            expect(root.querySelectorAll("button")).toHaveLength(0);
            expect(root.querySelector('[data-testid="palette-filter-empty"]')).not.toBeNull();
          } finally {
            restore();
          }
        });

        it("커스텀 아틀라스는 숨기지 않고 흐리게 한다 — 칸의 위치가 원본 시트 좌표다", () => {
          const restore = installFakeDom();
          try {
            const tileset = makeCustomTileset([]);
            const root = renderWithFakeDom(() =>
              makeCustomPalette({
                layer: "lower",
                onSelectTile: () => undefined,
                selectedTile: 0,
                tileset,
                visibleTiles: new Set([5]),
              })
            );
            // 32칸 전부 남아 아틀라스 모양이 유지된다.
            expect(root.querySelectorAll("button")).toHaveLength(32);
            const kept = root.querySelector('[data-testid="chipset-tile-5"]');
            const dimmed = root.querySelector('[data-testid="chipset-tile-9"]');
            expect(kept?.className).not.toContain("is-filtered-out");
            expect(dimmed?.className).toContain("is-filtered-out");
          } finally {
            restore();
          }
        });
      });
      describe("칸 선택 입력은 판 하나가 받는다", () => {
        function dispatch(target: HTMLElement, type: string, init: Record<string, unknown> = {}): void {
          const event = new Event(type, { bubbles: true, cancelable: true });
          for (const [key, value] of Object.entries(init)) Object.defineProperty(event, key, { configurable: true, value });
          target.dispatchEvent(event);
        }

        it("포인터·보조기기 클릭·Enter 가 누른 칸의 타일을 한 번씩 고른다", () => {
          const restore = installFakeDom();
          try {
            const picked: number[] = [];
            const tileset = makeCustomTileset([]);
            tileset.count = 64;
            tileset.tilesPerRow = 8;
            const root = renderWithFakeDom(() => makeCustomPalette({ layer: "lower", onSelectTile: (tile) => picked.push(tile), selectedTile: 0, tileset }));
            const cell = root.querySelector<HTMLElement>('[data-testid="chipset-tile-9"]')!;

            dispatch(cell, "pointerdown", { button: 0 });
            dispatch(cell, "click", { detail: 1 });
            dispatch(cell, "pointerdown", { button: 2 });
            expect(picked).toEqual([9]);

            dispatch(cell, "click", { detail: 0 });
            dispatch(root.querySelector<HTMLElement>('[data-testid="chipset-tile-10"]')!, "keydown", { key: "Enter" });
            expect(picked).toEqual([9, 9, 10]);
          } finally {
            restore();
          }
        });
      });
    });
    describe("tilePaletteStamp", () => {
      isolateTimers();
      describe("tile palette drag stamps", () => {
        it("creates a source-preserving 3x3 stamp from dragged chipset tiles", () => {
          const tileset = testTileset();

          const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

          expect(stamp.width).toBe(3);
          expect(stamp.height).toBe(3);
          expect(stamp.cells.map((cell) => cell.tile)).toEqual([10, 11, 12, 18, 19, 20, 26, 27, 28]);
          expect(stamp.cells.find((cell) => cell.tile === 19)).toEqual({ dx: 1, dy: 1, layer: "upper", tile: 19 });
        });

        it("marks every source tile inside the dragged rectangle", () => {
          const tileset = testTileset();
          const stamp = createPaletteStampFromDrag({ endTile: 28, startTile: 10, tileset });

          expect(paletteStampIncludesTile(stamp, 19, tileset.tilesPerRow)).toBe(true);
          expect(paletteStampIncludesTile(stamp, 29, tileset.tilesPerRow)).toBe(false);
        });

        it("creates a stamp from the visible reordered palette grid", () => {
          const tileset = testTileset();
          const displayTiles = [240, 303, 421, 424, 342, 343, 306, 366, 374, 375, 270, 120, 93, 123, 153, 246];

          const stamp = createPaletteStampFromDisplayDrag({
            displayTiles,
            displayTilesPerRow: 10,
            endTile: 270,
            startTile: 303,
            tileset: { ...tileset, count: 512 },
          });

          expect(stamp.width).toBe(2);
          expect(stamp.height).toBe(2);
          expect(stamp.cells.map((cell) => cell.tile)).toEqual([240, 303, 270, 120]);
          expect(paletteStampIncludesTile(stamp, 303, tileset.tilesPerRow)).toBe(true);
          expect(paletteStampIncludesTile(stamp, 342, tileset.tilesPerRow)).toBe(false);
        });
      });
      function testTileset(): TilesetDef {
        return {
          count: 64,
          id: "test",
          image: { id: "test-image", type: "uploaded" },
          name: "Test",
          passability: Array.from({ length: 64 }, () => ({ down: true, left: true, right: true, up: true })),
          priority: Array.from({ length: 64 }, (_, index) => index === 19 ? "upper" : "lower"),
          terrain: Array.from({ length: 64 }, () => 0),
          tileSize: 16,
          tilesPerRow: 8,
        };
      }
    });
  });
});
