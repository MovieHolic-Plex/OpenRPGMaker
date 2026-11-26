import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { isActionCombatMap, normalizeActionCombatConfig, normalizeActionSkillProfile, normalizeActionWeaponProfile, normalizeEnemyActionAttack, normalizeEnemyActionProfile, resolveActionCombatConfig } from "@/project/actionCombat";
import { createBlankProject, TILE, createBlankMap } from "@/project/defaults";
import type { GameMap, EquipmentRecord, CharacterFootprint, Dir, Project, GameEvent, EnemyRecord, ItemRecord } from "@/project/types";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement, renderWithFakeDom } from "./fakeDom";
import { cellInArc, expandRect, swingArcCells, swingArcCellsFromBody, swingArcOverlapsBody, swingArcOverlapsPoint } from "@/battle/action/hitbox";
import { contactRectTouches, contactTouches, shouldApplyContactDamage } from "@/battle/action/contact";
import { createFieldSpawnRuntime, materializeFieldSpawnEvents } from "@/player/fieldSpawns";
import { footprintBounds } from "@/project/footprint";
import { runtimeEventView } from "@/project/runtimeEventState";
import { computeContactDamage, computeSwingDamage } from "@/battle/action/combatMath";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { toolGroup, toolIconKey } from "@/editor/panels/aiToolLabels";
import { isolateTimers } from "./mergedTeardown";
import { battlePanel } from "@/editor/panels/actorRecordBattlePanels";
import { deserialize, serialize } from "@/project/io/serialize";
import { Window } from "happy-dom";
import { createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import type { ActivityVisual } from "@/ai/activityVisual";
import { briefActivityVisuals, createActivityView } from "@/editor/panels/aiActivityView";
import { setActivityLevel, createActivityLevelControl, getActivityLevel } from "@/editor/panels/aiActivityPreference";
import { createInlineWorkCard } from "@/editor/panels/aiInlineWorkCard";
import { attachImage, releaseDetachedActivityImages, retainedActivityImageUrlCount } from "@/editor/panels/aiActivityMedia";
import { isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { createTeamTranscript } from "@/editor/panels/aiTeamTranscript";
import { createTeamWorkPane } from "@/editor/panels/aiTeamWorkPane";
import { createTeamBoard } from "@/editor/panels/aiTeamBoard";
import { createAiTeamSidebar } from "@/editor/panels/aiTeamSidebar";
import { createStudioShell } from "@/editor/panels/aiStudioShell";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { createConversationLogHost, ensureDayDivider, markPriorTurns } from "@/editor/panels/aiConversationLog";
import { activityEntryIndex } from "@/editor/panels/aiActivityIndex";
import { assistantIdleHints, directorStartPrompts, formatComposerPlaceholder, idlePresenceLine, nextStepHint, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { editorState } from "@/editor/editorState";
import { buildEditorReferenceIndex, type EditorReferenceIndex, type EditorReferenceTarget } from "@/editor/aiAnswerLinks";
import { decorateEditorReferences, renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import { renderMarkdown } from "@/util/markdown";
import { isAiAssistantBridgeConnected, registerAiAssistantBridge, setAiBridgeLastStatus, unregisterAiAssistantBridge, sendAiAssistantMessage, type AiAssistantBridgeHandlers, type AiBridgeTurnResult, whenAiAssistantBridgeSettled } from "@/editor/aiAssistantBridge";
import { bounded, deferred } from "./aiEpochFixture";
import { aiPreviewDiffLines, aiPreviewEvidenceLines, aiPreviewSourceFingerprint, aiPreviewSourceMatches, renderPreviewReport } from "@/editor/panels/aiAssistantPanel";
import { createAiPreviewProject } from "@/project/aiPreviewGenerator";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { createComposerElements, type ComposerElements } from "@/editor/panels/aiComposer";
import { AUTONOMY_LEVELS, type AutonomyLevel } from "@/ai/autonomyLevels";
import { contextUsagePercent, contextUsageTone, createAiContextMeter, formatContextMeterLabel, type AiContextSnapshot } from "@/editor/panels/aiContextMeter";
import type { ContextUsage } from "@/ai/contextCompaction";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import type { AuditEntry } from "@/ai/assistantSession";
import * as conversations from "@/ai/conversationStore";
import { clearConversations, CONVERSATION_TRIM_MARKER, deriveTitle, listConversations, saveConversation, type ConversationRecord, type ConversationSummary } from "@/ai/conversationStore";
import { resetAiRecordDbForTest } from "@/ai/aiRecordDb";
import { AI_HISTORY_ARCHIVE_PAGE_SIZE, closeAiConversationHistoryModal, filterConversationsByTitle, openAiConversationHistoryModal, sortConversationsForScope, whenAiConversationHistoryModalSettled } from "@/editor/panels/aiConversationHistoryModal";
import { DEFAULT_TILESET_ID, COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { RESTORED_TRANSCRIPT_MARKER, isRestoredTranscriptMessage, restoredTranscriptMessage, serializeAuditTranscript } from "@/ai/conversationReplay";
import { listChangeItems, revertChangeItem } from "@/editor/panels/aiChangeSummaryCard";
import { creationCardModel, eventAppearanceId, firstPlayedMusic, firstSpokenLine } from "@/editor/panels/aiCreationCards";
import { runTool } from "@/editor/tools";
import { DECK_ICON_NAMES, deckIcon } from "@/editor/panels/aiDeckIcons";
import { createDeckRail, deckStateOfTone } from "@/editor/panels/aiDeckRail";
import { findEntityMentions, renderEntityMentionStrip, type EntityMention } from "@/editor/panels/aiEntityMentions";
import { mergeHarnessTimeline } from "@/editor/panels/aiHarnessModal";
import { AI_INSTRUCTIONS_MAX_CHARS } from "@/ai/projectInstructions";
import { closeAiInstructionsModal, openAiInstructionsModal } from "@/editor/panels/aiInstructionsModal";
import { getMapEditHistoryMarker, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createLaneGhostSink } from "@/editor/panels/aiLaneGhost";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { diffMapsForDelta } from "@/ai/piAgent/mapDelta";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { clearAgentGhostPreview, getAgentGhostDraftMap, getAgentGhostPreviewState, setAgentGhostDraftMapProvider } from "@/editor/agentGhostPreview";
import { chipWindow, regionFromToolCall, renderMapChip } from "@/editor/panels/aiMapChip";
import { clampPanelSize, clampPanelSizeToViewport, loadPanelBarSize, PANEL_SIZE_LIMITS, savePanelBarSize, savePanelSize, stepAiFontSize } from "@/editor/panels/aiPanelLayout";
import { createPiGhostBridge } from "@/editor/panels/aiPiGhostBridge";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { AI_AUTHORING_EXAMPLES, buildAiAuthoringExamples, buildRecentAiWorkCard, buildTryRegionCard, buildVisualStartGallery, defaultAiVisualStartPrompts, formatRelativeTime, summarizeActivityResult, buildSuggestionRows, rankAuthoringExamples } from "@/editor/panels/aiStartScreenCards";
import type { AiActivityLogRecord } from "@/ai/activityLog";
import { fetchCompanion } from "@/ai/companionConnection";
import { getAiTransportHealth, reportTransportHealth, resetAiTransportHealth, type AiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { deriveRunOutcome, type RunOutcomeFacts } from "@/ai/runOutcome";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import { aiDayKey, formatAiDayLabel, parseAiDayDate, statusToneOf } from "@/editor/panels/aiChatPanelHelpers";
import type { WorkPlan } from "@/ai/workPlan";
import { closeWorkPlanBook, openWorkPlanBook, updateWorkPlanBook, workPlanBookIsOpen } from "@/editor/panels/aiWorkPlanModal";
import { workPlanBookPages } from "@/editor/panels/aiWorkPlanPages";
import { modalStackDepthForTest, resetModalStackForTest } from "@/editor/ui/modalStack";

describe("editorPanelsSuite11", () => {
  isolateTimers();
  describe("actionCombat", () => {
    isolateTimers();
    describe("actionCombatConfig", () => {
      isolateTimers();
      function mapWith(flags: Partial<GameMap>): GameMap {
        return { actionCombat: undefined, ...flags } as unknown as GameMap;
      }
      describe("normalizeActionCombatConfig", () => {
        it("returns undefined for absent config", () => {
          expect(normalizeActionCombatConfig(undefined)).toBeUndefined();
        });

        it("preserves explicit fields and clamps numbers", () => {
          const normalized = normalizeActionCombatConfig({
            enabled: true,
            playerIframesMs: 999999,
            swingCooldownMs: 1,
            hud: { stamina: true, enemyHpBars: "always" },
          });
          expect(normalized?.enabled).toBe(true);
          expect(normalized?.playerIframesMs).toBe(10000);
          expect(normalized?.swingCooldownMs).toBe(50);
          expect(normalized?.hud?.stamina).toBe(true);
          expect(normalized?.hud?.enemyHpBars).toBe("always");
        });

        it("drops invalid hud enum values", () => {
          const normalized = normalizeActionCombatConfig({ enabled: true, hud: { enemyHpBars: "bogus" as never } });
          expect(normalized?.hud).toBeUndefined();
        });
      });
      describe("normalizeActionWeaponProfile / normalizeActionSkillProfile", () => {
        it("normalizes weapon swing overrides", () => {
          expect(normalizeActionWeaponProfile({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 })).toEqual({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 });
          expect(normalizeActionWeaponProfile({ swingRange: 99 })).toEqual({ swingRange: 5 });
          expect(normalizeActionWeaponProfile({})).toBeUndefined();
        });

        it("normalizes action skills (projectile only)", () => {
          const skill = normalizeActionSkillProfile({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
          expect(skill).toEqual({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
          expect(normalizeActionSkillProfile({ kind: "beam" as never, damage: 1, range: 1 })).toBeUndefined();
        });
      });
      describe("normalizeEnemyActionAttack", () => {
        it("preserves a valid melee attack and clamps fields", () => {
          const attack = normalizeEnemyActionAttack({ kind: "melee", windupMs: 10, recoverMs: 600, damage: 6, range: 1, cooldownMs: 1500 });
          expect(attack?.kind).toBe("melee");
          expect(attack?.windupMs).toBe(100);
          expect(attack?.cooldownMs).toBe(1500);
        });

        it("rejects unknown kinds", () => {
          expect(normalizeEnemyActionAttack({ kind: "laser" as never, windupMs: 300, recoverMs: 300, damage: 1, range: 1 })).toBeUndefined();
        });

        it("nests inside action profiles", () => {
          const profile = normalizeEnemyActionProfile({
            contactDamage: 3,
            attack: { kind: "projectile", windupMs: 600, recoverMs: 500, damage: 4, range: 8, projectileSpeedTilesPerSec: 99 },
          });
          expect(profile?.attack?.kind).toBe("projectile");
          expect(profile?.attack?.projectileSpeedTilesPerSec).toBe(30);
        });
      });
      describe("normalizeEnemyActionProfile", () => {
        it("returns undefined when empty", () => {
          expect(normalizeEnemyActionProfile({})).toBeUndefined();
          expect(normalizeEnemyActionProfile(undefined)).toBeUndefined();
        });

        it("clamps knockbackResist into 0..1", () => {
          expect(normalizeEnemyActionProfile({ knockbackResist: 7 })?.knockbackResist).toBe(1);
        });
      });
      describe("isActionCombatMap / resolveActionCombatConfig", () => {
        it("requires both system enabled and map opt-in", () => {
          const project = createBlankProject();
          const map = mapWith({ actionCombat: true });
          expect(isActionCombatMap(project, map)).toBe(false);
          project.system.actionCombat = { enabled: true };
          expect(isActionCombatMap(project, map)).toBe(true);
          expect(isActionCombatMap(project, mapWith({}))).toBe(false);
        });

        it("resolves defaults when fields are omitted", () => {
          const project = createBlankProject();
          project.system.actionCombat = { enabled: true };
          const config = resolveActionCombatConfig(project);
          expect(config.playerIframesMs).toBe(800);
          expect(config.swingCooldownMs).toBe(350);
          expect(config.hearts).toBe(true);
          expect(config.stamina).toBe(false);
          expect(config.enemyHpBars).toBe("damaged");
        });
      });
    });
    describe("actionCombatEditorFields", () => {
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
      function seedWeapon(): EquipmentRecord {
        const record = normalizeEquipmentRecord({ id: "equip_action_sword", name: "액션 검", slot: "weapon" });
        store.update((project) => {
          project.database.equipment = [record];
        });
        return store.getCurrent().database.equipment[0]!;
      }
      function renderWeaponForm(): FakeElement {
        const form = document.createElement("section") as unknown as FakeElement;
        const rerender = (): void => {
          form.replaceChildren();
          const current = store.getCurrent().database.equipment.find((entry) => entry.id === "equip_action_sword");
          if (!current) throw new Error("missing equipment equip_action_sword");
          renderEquipmentRecordForm(form as unknown as HTMLElement, current, rerender);
        };
        rerender();
        return form;
      }
      function fieldOf(host: FakeElement, testid: string): FakeElement {
        const node = findByTestId(host, testid);
        if (!node) throw new Error(`missing field ${testid}`);
        return node;
      }
      function typeNumber(host: FakeElement, testid: string, value: number): void {
        const input = fieldOf(host, testid);
        input.value = String(value);
        input.dispatchEvent(new Event("change"));
      }
      function toggle(host: FakeElement, testid: string, checked: boolean): void {
        const input = fieldOf(host, testid);
        input.checked = checked;
        input.dispatchEvent(new Event("change"));
      }
      function pick(host: FakeElement, testid: string, value: string): void {
        const select = fieldOf(host, testid);
        select.value = value;
        select.dispatchEvent(new Event("change"));
      }
      function actionCombat(): NonNullable<ReturnType<typeof store.getCurrent>["system"]["actionCombat"]> {
        const config = store.getCurrent().system.actionCombat;
        if (!config) throw new Error("missing system.actionCombat");
        return config;
      }
      function currentWeapon(): EquipmentRecord {
        const record = store.getCurrent().database.equipment.find((entry) => entry.id === "equip_action_sword");
        if (!record) throw new Error("missing equipment equip_action_sword");
        return record;
      }
      describe("액션 전투 시스템 필드 편집", () => {
        let restoreDom: (() => void) | undefined;

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          project.system.actionCombat = { enabled: true };
          store.replace(project);
        });

        afterEach(() => {
          restoreDom?.();
          restoreDom = undefined;
        });

        it("스키마의 모든 액션 전투 필드를 정규화 경계와 함께 노출한다", () => {
          // Break named: 회피/가드/HUD/4방향 필드가 UI 에 없어 JSON 편집으로만 튜닝 가능하다.
          const host = renderSystem();

          const numericBounds: readonly (readonly [string, number, number])[] = [
            ["db-field-system-action-combat-iframes", 0, 10000],
            ["db-field-system-action-combat-swing-cooldown", 50, 5000],
            ["db-field-system-action-combat-swing-bonus", 0, 9999],
            ["db-field-system-action-combat-dodge-stamina-cost", 0, 100],
            ["db-field-system-action-combat-dodge-iframes", 0, 3000],
            ["db-field-system-action-combat-guard-reduction", 0, 90],
            ["db-field-system-action-combat-guard-drain", 0, 100],
          ];
          for (const [testid, min, max] of numericBounds) {
            const input = fieldOf(host, testid);
            expect(input.getAttribute("min"), testid).toBe(String(min));
            expect(input.getAttribute("max"), testid).toBe(String(max));
          }

          expect(findByTestId(host, "db-field-system-action-combat-four-way")).not.toBeNull();
          expect(findByTestId(host, "db-field-system-action-combat-hud-hearts")).not.toBeNull();
          expect(findByTestId(host, "db-field-system-action-combat-hud-stamina")).not.toBeNull();
          expect(findByTestId(host, "db-field-system-action-combat-hud-enemy-hp-bars")).not.toBeNull();
        });

        it("액션 전투가 꺼져 있으면 상세 필드를 감춘다", () => {
          store.update((project) => {
            project.system.actionCombat = { enabled: false };
          });
          const host = renderSystem();

          expect(findByTestId(host, "db-field-system-action-combat")).not.toBeNull();
          expect(findByTestId(host, "db-field-system-action-combat-guard-reduction")).toBeNull();
          expect(findByTestId(host, "db-field-system-action-combat-hud-hearts")).toBeNull();
        });

        it("기본값이 아닌 편집만 프로젝트에 저장한다", () => {
          const host = renderSystem();

          typeNumber(host, "db-field-system-action-combat-dodge-stamina-cost", 10);
          typeNumber(host, "db-field-system-action-combat-dodge-iframes", 450);
          typeNumber(host, "db-field-system-action-combat-guard-reduction", 30);
          typeNumber(host, "db-field-system-action-combat-guard-drain", 5);
          expect(actionCombat()).toEqual({
            enabled: true,
            dodgeStaminaCost: 10,
            dodgeIframesMs: 450,
            guardDamageReductionPercent: 30,
            guardStaminaDrainPerSec: 5,
          });

          typeNumber(host, "db-field-system-action-combat-dodge-stamina-cost", 25);
          typeNumber(host, "db-field-system-action-combat-dodge-iframes", 300);
          typeNumber(host, "db-field-system-action-combat-guard-reduction", 50);
          typeNumber(host, "db-field-system-action-combat-guard-drain", 20);
          expect(actionCombat()).toEqual({ enabled: true });
        });

        it("범위를 벗어난 입력은 정규화 클램프와 같은 값으로 잘린다", () => {
          const host = renderSystem();

          typeNumber(host, "db-field-system-action-combat-guard-reduction", 999);
          expect(actionCombat().guardDamageReductionPercent).toBe(90);
          typeNumber(host, "db-field-system-action-combat-dodge-iframes", -10);
          expect(actionCombat().dodgeIframesMs).toBe(0);
        });

        it("HUD 서브 설정과 4방향 이동을 기본값에서 벗어날 때만 저장한다", () => {
          const host = renderSystem();

          toggle(host, "db-field-system-action-combat-four-way", true);
          toggle(host, "db-field-system-action-combat-hud-hearts", false);
          toggle(host, "db-field-system-action-combat-hud-stamina", true);
          pick(host, "db-field-system-action-combat-hud-enemy-hp-bars", "always");
          expect(actionCombat()).toEqual({
            enabled: true,
            fourWayMovement: true,
            hud: { hearts: false, stamina: true, enemyHpBars: "always" },
          });

          toggle(host, "db-field-system-action-combat-four-way", false);
          toggle(host, "db-field-system-action-combat-hud-hearts", true);
          toggle(host, "db-field-system-action-combat-hud-stamina", false);
          pick(host, "db-field-system-action-combat-hud-enemy-hp-bars", "damaged");
          expect(actionCombat()).toEqual({ enabled: true });
        });
      });
      describe("액션 무기 프로필 편집", () => {
        let restoreDom: (() => void) | undefined;

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          project.system.actionCombat = { enabled: true };
          store.replace(project);
          seedWeapon();
        });

        afterEach(() => {
          restoreDom?.();
          restoreDom = undefined;
        });

        it("장비 레코드에 액션 스윙 필드를 정규화 경계와 함께 노출한다", () => {
          // Break named: ActionWeaponProfile 은 스키마·런타임만 있고 편집 패널이 없다.
          const form = renderWeaponForm();

          // #166 이 29개 탭을 공용 워크스페이스로 옮기며 panel → card 로 이름을 바꿨다.
          // 필드 testid(db-field-equipment-action-weapon-*)와 동작은 그대로다.
          expect(findByTestId(form, "db-equipment-card-action-weapon")).not.toBeNull();
          const bounds: readonly (readonly [string, number, number])[] = [
            ["db-field-equipment-action-weapon-swing-range", 1, 5],
            ["db-field-equipment-action-weapon-swing-cooldown", 50, 5000],
            ["db-field-equipment-action-weapon-swing-bonus", 0, 9999],
          ];
          for (const [testid, min, max] of bounds) {
            const input = fieldOf(form, testid);
            expect(input.getAttribute("min"), testid).toBe(String(min));
            expect(input.getAttribute("max"), testid).toBe(String(max));
          }
        });

        it("기본값이 아닌 스윙 값만 레코드에 남긴다", () => {
          const form = renderWeaponForm();

          typeNumber(form, "db-field-equipment-action-weapon-swing-range", 3);
          typeNumber(form, "db-field-equipment-action-weapon-swing-cooldown", 500);
          typeNumber(form, "db-field-equipment-action-weapon-swing-bonus", 7);
          expect(currentWeapon().actionWeapon).toEqual({ swingRange: 3, swingCooldownMs: 500, swingDamageBonus: 7 });

          typeNumber(form, "db-field-equipment-action-weapon-swing-range", 1);
          typeNumber(form, "db-field-equipment-action-weapon-swing-cooldown", 350);
          typeNumber(form, "db-field-equipment-action-weapon-swing-bonus", 0);
          expect(currentWeapon().actionWeapon).toBeUndefined();
        });

        it("범위를 벗어난 스윙 reach 는 normalizeActionWeaponProfile 과 같은 값으로 잘린다", () => {
          const form = renderWeaponForm();

          typeNumber(form, "db-field-equipment-action-weapon-swing-range", 99);
          expect(currentWeapon().actionWeapon).toEqual({ swingRange: 5 });
        });
      });
    });
    // 액션 전투가 **몸 사각 전체**로 판정하는지 — 2차 스펙 §8.
    //
    // 사용자 결정: 통행만 하단 N행으로 줄이고 **조사·전투는 몸 전체**다. 그래서 3x3 골렘의
    // 상체를 때려도 유효타이고, 상체 옆에 선 플레이어도 접촉 피해를 받는다.
    //
    // 판별력 규칙: 프로브는 앵커 칸/앵커 행을 겨냥하지 않는다. 앵커는 1x1 이어도 같은 결과라
    // 아무것도 증명하지 않는다. 몸 사각의 **상체 행**을 겨눈다.
    describe("actionCombatFootprint", () => {
      isolateTimers();
      const GOLEM: CharacterFootprint = { width: 3, height: 3 };
      const UNIT: CharacterFootprint = { width: 1, height: 1 };
      describe("swingArcOverlapsBody — 상체만 걸려도 유효타", () => {
        it("1x1 은 점 판정과 완전히 같다(항등)", () => {
          for (const facing of ["up", "down", "left", "right"] as const) {
            for (let x = 2; x <= 8; x += 1) {
              for (let y = 2; y <= 8; y += 1) {
                expect(swingArcOverlapsBody(facing, 5, 5, 1, x, y, UNIT)).toBe(
                  swingArcOverlapsPoint(facing, 5, 5, 1, x, y)
                );
              }
            }
          }
        });

        it("플레이어 눈앞에 상체가 있으면 맞는다 — 앵커는 두 칸 아래라 안 걸렸다", () => {
          // 플레이어 (5,5) 가 위를 본다 → 호는 (5,4) 중심. 골렘 앵커는 (5,6) 이고 몸은 4..6 행.
          // 앵커 판정: (5,6) 은 호에 없다 → 빗나감. 몸 판정: 상체 칸 (5,4) 가 호 안 → 명중.
          expect(swingArcOverlapsPoint("up", 5, 5, 1, 5, 6)).toBe(false);
          expect(swingArcOverlapsBody("up", 5, 5, 1, 5, 6, GOLEM)).toBe(true);
        });

        it("몸이 호 밖이면 빗나간다", () => {
          // 앵커 (5,10) → 몸 8..10 행. 위를 보는 호는 (5,4) 근처라 몸에 닿지 않는다.
          expect(swingArcOverlapsBody("up", 5, 5, 1, 5, 10, GOLEM)).toBe(false);
        });

        it("걸음 보간 중인 소수 앵커도 몸으로 판정한다", () => {
          // x = 5.4 면 몸은 4.4..6.4 열. 호 (6,5) 는 그 안이라 명중.
          expect(swingArcOverlapsBody("right", 5, 5, 1, 5.4, 5, { width: 3, height: 1 })).toBe(true);
        });
      });
      describe("swingArcCellsFromBody — 몸 사각에서 뻗는 호", () => {
        it("1x1 은 기존 호와 완전히 같다(항등)", () => {
          for (const facing of ["up", "down", "left", "right"] as const) {
            for (const range of [1, 2, 3]) {
              expect(swingArcCellsFromBody(facing, 5, 5, range, UNIT)).toEqual(
                swingArcCells(facing, 5, 5, range)
              );
            }
          }
        });

        it("3x3 이 오른쪽을 보면 세 행 모두에서 팔이 나간다", () => {
          const arc = swingArcCellsFromBody("right", 5, 7, 1, GOLEM);
          // 몸은 x 4..6, y 5..7. 오른쪽 한 칸은 x=7 의 세 행 전부.
          for (const y of [5, 6, 7]) expect(cellInArc(arc, 7, y)).toBe(true);
          // 앵커 행만 보던 시절에는 (7,5) 가 호에 없었다.
          expect(cellInArc(swingArcCells("right", 5, 7, 1), 7, 5)).toBe(false);
        });

        it("자기 몸 칸은 호에서 뺀다 — 예고 음영이 몸을 덮으면 안 된다", () => {
          const body = footprintBounds(5, 7, GOLEM);
          for (const cell of swingArcCellsFromBody("right", 5, 7, 1, GOLEM)) {
            const inside =
              cell.x >= body.left && cell.x <= body.right && cell.y >= body.top && cell.y <= body.bottom;
            expect(inside).toBe(false);
          }
        });

        it("칸이 중복되지 않는다", () => {
          const arc = swingArcCellsFromBody("down", 5, 7, 2, GOLEM);
          expect(new Set(arc.map((cell) => `${cell.x},${cell.y}`)).size).toBe(arc.length);
        });
      });
      describe("expandRect", () => {
        it("사방으로 넓힌다", () => {
          expect(expandRect({ left: 4, right: 6, top: 5, bottom: 7 }, 1)).toEqual({
            left: 3,
            right: 7,
            top: 4,
            bottom: 8,
          });
        });
      });
      describe("접촉 피해 — 몸 사각 인접", () => {
        const PLAYER = [{ x: 5, y: 4 }] as const;

        it("1x1 사각은 체비셰프 1 과 같은 집합이다(항등)", () => {
          for (let x = 2; x <= 8; x += 1) {
            for (let y = 1; y <= 7; y += 1) {
              const rect = { left: x, right: x, top: y, bottom: y };
              expect(contactRectTouches(rect, PLAYER)).toBe(contactTouches({ x, y }, PLAYER));
            }
          }
        });

        it("골렘 머리 옆에 선 플레이어도 접촉이다 — 앵커에서는 2칸이라 안 닿았다", () => {
          // 앵커 (5,7) → 몸 y 5..7. 플레이어 (5,4) 는 상체 (5,5) 바로 위.
          const body = footprintBounds(5, 7, GOLEM);
          expect(contactTouches({ x: 5, y: 7 }, PLAYER)).toBe(false);
          expect(contactRectTouches(body, PLAYER)).toBe(true);
          expect(
            shouldApplyContactDamage({
              enemyTile: { x: 5, y: 7 },
              enemyBody: body,
              playerTiles: PLAYER,
              mode: "combat",
              moving: true,
            })
          ).toBe(true);
        });

        it("몸 사각을 주지 않으면 예전 앵커 판정 그대로다(항등)", () => {
          expect(
            shouldApplyContactDamage({ enemyTile: { x: 5, y: 7 }, playerTiles: PLAYER, mode: "combat", moving: true })
          ).toBe(false);
        });

        it("멈춰 있는 적은 몸이 닿아도 접촉 피해가 없다 — 거리를 좁히는 적만이라는 규칙은 그대로", () => {
          expect(
            shouldApplyContactDamage({
              enemyTile: { x: 5, y: 7 },
              enemyBody: footprintBounds(5, 7, GOLEM),
              playerTiles: PLAYER,
              mode: "combat",
              moving: false,
            })
          ).toBe(false);
        });
      });
      function projectWithSpawn(footprint?: CharacterFootprint, passRows?: number) {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        // TILE.GRASS (240) is not open ground on the default beodeul_city sheet; floor the map with its own plain ground tile.
        map.lowerTiles.fill(map.lowerTiles[0]!);
        const troopId = project.database.troops[0]!.id;
        map.fieldSpawns = [
          {
            id: "spawn_golem",
            troopId,
            area: { x: 4, y: 4, w: 4, h: 4 },
            maxAlive: 1,
            respawnSec: 5,
            ...(footprint ? { footprint } : {}),
            ...(passRows !== undefined ? { passRows } : {}),
          },
        ];
        store.replace(project);
        return { project, map };
      }
      describe("필드 스폰 — 합성 페이지가 몸 크기를 싣는다", () => {
        it("3x3 · 통행 1행 스폰이 런타임 뷰에서 3x3 으로 보인다", () => {
          const { project, map } = projectWithSpawn(GOLEM, 1);
          const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
          const instance = state.entries[0]?.alive[0];
          expect(instance?.footprint).toEqual(GOLEM);
          expect(instance?.passRows).toBe(1);

          const [event] = materializeFieldSpawnEvents(state);
          if (!event) throw new Error("spawn event missing");
          const view = runtimeEventView(event, {}, {});
          expect(view.footprint).toEqual(GOLEM);
          expect(view.passRows).toBe(1);
          // 통행 사각은 발밑 한 줄, 몸 사각은 세 줄.
          expect(view.passRect.top).toBe(view.passRect.bottom);
          expect(view.bodyRect.bottom - view.bodyRect.top).toBe(2);
        });

        it("발자국 없는 스폰은 1x1 이고 통행 사각 === 몸 사각이다(항등)", () => {
          const { project, map } = projectWithSpawn();
          const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
          const [event] = materializeFieldSpawnEvents(state);
          if (!event) throw new Error("spawn event missing");
          const view = runtimeEventView(event, {}, {});
          expect(view.footprint).toEqual(UNIT);
          expect(view.passRect).toEqual(view.bodyRect);
        });
      });
      describe("필드 스폰 배치 — 남의 몸통 안에 솟지 않는다", () => {
        it("2x2 이벤트의 비앵커 칸에는 스폰이 놓이지 않는다", () => {
          const { project, map } = projectWithSpawn();
          // 스폰 영역 4..7 을 앵커가 아닌 몸으로 덮는 2x2 이벤트.
          // 앵커 (4,5) → 몸 x 4..5, y 4..5. 앵커 칸만 등록하던 시절에는 (5,4)·(4,4)·(5,5) 가 비어 보였다.
          map.events = [
            {
              id: "wall_golem",
              x: 4,
              y: 5,
              trigger: { kind: "action" },
              commands: [],
              pages: [
                {
                  id: "p1",
                  conditions: [],
                  graphic: {},
                  trigger: { kind: "action" },
                  priority: "same",
                  movement: { type: "fixed", speed: 3, frequency: 3 },
                  commands: [],
                  footprint: { width: 2, height: 2 },
                },
              ],
            },
          ];
          store.replace(project);
          const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
          const instance = state.entries[0]?.alive[0];
          expect(instance).toBeDefined();
          const covered = new Set(["4,4", "5,4", "4,5", "5,5"]);
          expect(covered.has(`${instance?.x},${instance?.y}`)).toBe(false);
        });

        it("3x3 스폰은 몸이 벽을 걸치는 칸에 앉지 않는다", () => {
          const { project, map } = projectWithSpawn(GOLEM);
          // 스폰 영역 x 4..7 · y 4..7. 몸이 위로 두 칸 자라므로 y 2..3 을 물에 잠기게 만들어
          // 앵커 y 4 를 전부 불가로 만든다. 앵커만 보던 판정은 (4,4) 를 골랐을 것이다.
          for (const y of [2, 3]) {
            for (let x = 0; x < map.width; x += 1) map.lowerTiles[y * map.width + x] = TILE.WATER;
          }
          store.replace(project);
          const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
          const instance = state.entries[0]?.alive[0];
          expect(instance).toBeDefined();
          expect(instance!.y).toBeGreaterThanOrEqual(6);
          const body = footprintBounds(instance!.x, instance!.y, GOLEM);
          expect(body.top).toBeGreaterThanOrEqual(4);
        });

        it("몸이 맵을 벗어나는 칸도 거른다", () => {
          const { project, map } = projectWithSpawn({ width: 3, height: 1 });
          map.fieldSpawns = [
            { id: "spawn_golem", troopId: project.database.troops[0]!.id, area: { x: 0, y: 3, w: 1, h: 1 }, maxAlive: 1, footprint: { width: 3, height: 1 } },
          ];
          store.replace(project);
          const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
          // 앵커 (0,3) 은 몸이 x -1 까지 뻗어 맵 밖이다 → 배치 실패.
          expect(state.entries[0]?.alive).toHaveLength(0);
        });
      });
      describe("적 스윙 방향 — 네 방향 모두 몸에서 뻗는다", () => {
        const CASES: readonly { readonly dir: Dir; readonly cell: readonly [number, number] }[] = [
          { dir: "up", cell: [4, 4] },
          { dir: "down", cell: [4, 8] },
          { dir: "left", cell: [3, 5] },
          { dir: "right", cell: [7, 5] },
        ];

        it("각 방향에서 상체/측면 비앵커 칸이 호에 든다", () => {
          for (const probe of CASES) {
            const arc = swingArcCellsFromBody(probe.dir, 5, 7, 1, GOLEM);
            expect(cellInArc(arc, probe.cell[0], probe.cell[1])).toBe(true);
          }
        });
      });
    });
    describe("actionCombatMath", () => {
      isolateTimers();
      describe("computeSwingDamage", () => {
        it("is attack plus bonus minus half defense, minimum 1", () => {
          const damage = computeSwingDamage({ attackerAttack: 20, defenderDefense: 10, bonus: 5, rand: () => 0.5 });
          expect(damage).toBe(20);
        });

        it("clamps to 1 when defense overwhelms attack", () => {
          const damage = computeSwingDamage({ attackerAttack: 4, defenderDefense: 99, bonus: 0, rand: () => 0.5 });
          expect(damage).toBe(1);
        });

        it("applies ±10% variance deterministically from rand", () => {
          const low = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0 });
          const high = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0.999 });
          expect(low).toBe(9);
          expect(high).toBe(11);
        });
      });
      describe("computeContactDamage", () => {
        it("prefers authored contactDamage reduced by quarter defense", () => {
          expect(computeContactDamage({ contactDamage: 8, enemyAttack: 99, defenderDefense: 8 })).toBe(6);
        });

        it("falls back to half attack when no profile", () => {
          expect(computeContactDamage({ contactDamage: undefined, enemyAttack: 12, defenderDefense: 0 })).toBe(6);
        });

        it("never drops below 1", () => {
          expect(computeContactDamage({ contactDamage: 1, enemyAttack: 1, defenderDefense: 99 })).toBe(1);
        });
      });
    });
    describe("actionCombatToolPresentation", () => {
      isolateTimers();
      it("classifies the action proof as an explicit inspection activity", () => {
        expect(toolGroup("run_action_combat_test")).toBe("inspect");
        expect(toolIconKey("run_action_combat_test")).toBe("shield");
        expect(aiActivityFamilySource("run_action_combat_test")).toBe("mapped");
      });
    });
  });
  describe("actorBattleCommandsPanel", () => {
    isolateTimers();
    // 액터 「전투 명령」 패널(RM2003 배우별 명령, 2026-10-02) — 켜기·순서·끄기가 실제로 저장되는지.
    function node(root: FakeElement, testId: string): FakeElement {
      const found = findByTestId(root, testId);
      if (!found) throw new Error(`missing ${testId}`);
      return found;
    }
    describe("액터 전투 명령 패널", () => {
      it("켜면 직업 명령을 옮겨 오고, ↓·삭제·끄기가 battleCommandIds 에 저장된다", () => {
        const restoreDom = installFakeDom();
        try {
          const project = createBlankProject();
          const actorId = project.database.actors[0]!.id;
          const klass = project.database.classes.find((entry) => entry.id === project.database.actors[0]!.classId)!;
          const classIds = klass.battleCommands.map((command) => command.id);
          expect(classIds.length).toBeGreaterThan(1);
          store.replace(project);
          const host = document.createElement("section") as unknown as FakeElement;
          const actor = () => store.getCurrent().database.actors.find((entry) => entry.id === actorId)!;
          const render = () => {
            host.replaceChildren(battlePanel(actor(), render, () => undefined) as unknown as Node as never);
          };
          render();
          expect(findByTestId(host, "db-actor-command-class-note")).not.toBeNull();

          const toggle = node(host, "db-field-actor-custom-commands");
          toggle.checked = true;
          toggle.dispatchEvent(new Event("change"));
          expect(actor().battleCommandIds).toEqual(classIds.slice(0, 7));

          node(host, "db-actor-command-down-0").click();
          expect(actor().battleCommandIds?.slice(0, 2)).toEqual([classIds[1], classIds[0]]);

          node(host, "db-actor-command-remove-0").click();
          expect(actor().battleCommandIds?.[0]).toBe(classIds[0]);
          expect(deserialize(serialize(store.getCurrent())).database.actors.find((entry) => entry.id === actorId)!.battleCommandIds)
            .toEqual(actor().battleCommandIds);

          const off = node(host, "db-field-actor-custom-commands");
          off.checked = false;
          off.dispatchEvent(new Event("change"));
          expect("battleCommandIds" in actor()).toBe(false);
        } finally {
          restoreDom();
        }
      });
    });
  });
  describe("aiActivityPreference", () => {
    isolateTimers();
    describe("aiActivityBriefClutter", () => {
      isolateTimers();
      // 2026-09-23 도그푸딩(등대지기의 겨울): 조수 창이 조회한 초상화 6장과 개발자용 변경 집계
      // 「타일 2536 · 이벤트 +157 · 맵 속성 2 · DB 11 · …」로 덮였고, 생성 중 콘솔에
      // `blob:… net::ERR_FILE_NOT_FOUND` 가 ~200건 찍혔다.
      let window: Window;
      beforeEach(() => {
        window = new Window();
        vi.stubGlobal("document", window.document);
        vi.stubGlobal("localStorage", window.localStorage);
        vi.stubGlobal("Event", window.Event);
        vi.stubGlobal("Node", window.Node);
        vi.stubGlobal("MutationObserver", window.MutationObserver);
        vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
        setActivityLevel("brief");
      });
      // 그림 칸은 비동기로 채워진다 — 전역을 풀기 전에 그 작업이 끝나게 둔다.
      afterEach(async () => { await new Promise(resolve => setTimeout(resolve, 50)); vi.unstubAllGlobals(); });
      const portrait = (i: number): ActivityVisual => ({ kind: "asset", title: `인물 ${i}`, caption: "캐릭터", phase: "read", target: `actor:${i}` });
      const mapShot = (phase: ActivityVisual["phase"]): ActivityVisual => ({ kind: "record", title: "성에항", caption: "맵", phase, target: "map:harbor" });
      describe("간단히 보기는 조수 창을 그림 앨범으로 만들지 않는다", () => {
        it("조회로 읽은 그림(확인한 모습)은 그리지 않고, 바꾼 그림은 마지막 한 쌍까지만 그린다", () => {
          expect(briefActivityVisuals([portrait(1), portrait(2)].map((v, i) => ({ id: String(i), title: v.title, phase: v.phase, target: v.target, kind: v.kind })))).toEqual([]);
          const view = createActivityView({ archive: false });
          document.body.append(view.root);
          let trace = createActivityTrace("생성");
          trace = recordActivityEvent(trace, { type: "tool_end", id: "look", name: "get_project_summary", ok: true, summary: "프로젝트 확인", visuals: [1, 2, 3, 4, 5, 6].map(portrait) });
          view.update(trace);
          expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(0);

          trace = recordActivityEvent(trace, { type: "tool_end", id: "paint", name: "place_tiles", ok: true, summary: "길 깔기", visuals: [mapShot("before"), mapShot("draft"), mapShot("before"), mapShot("draft")] });
          view.update(trace);
          expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(2);

          setActivityLevel("detail");
          expect(view.root.querySelectorAll(".ai-media-figure")).toHaveLength(10);
        });

        it("변경 집계 원문 줄은 자세히 보기에서만 보인다", () => {
          const card = createInlineWorkCard({ title: "등대지기의 겨울", onStop: () => {} });
          document.body.append(card.root);
          const project = { maps: {} };
          card.attachChange({ mapId: "m", before: project, after: project, chips: ["타일 2536", "이벤트 +157", "DB 11"] } as never);
          const line = card.root.querySelector<HTMLElement>("[data-testid='ai-work-card-changed']")!;
          expect(line.textContent).toBe("타일 2536 · 이벤트 +157 · DB 11");
          expect(line.hidden).toBe(true);
          setActivityLevel("detail");
          expect(line.hidden).toBe(false);
          setActivityLevel("brief");
          expect(line.hidden).toBe(true);
        });
      });
      describe("활동 그림 Blob URL 은 그림이 읽히기 전에 풀리지 않는다", () => {
        it("읽는 중이거나 아직 붙지 않은 그림은 두고, 붙었다 떨어진 뒤 다 읽힌 그림만 푼다", async () => {
          const revoked: string[] = [];
          let serial = 0;
          // 생성자는 남긴다 — happy-dom 이 img.src 를 `new URL` 로 해석한다.
          const RealURL = globalThis.URL;
          vi.stubGlobal("URL", Object.assign(class extends RealURL {}, { createObjectURL: () => `blob:http://localhost/${++serial}`, revokeObjectURL: (url: string) => { revoked.push(url); } }));
          const complete = new Map<unknown, boolean>();
          const proto = window.HTMLImageElement.prototype as unknown as object;
          Object.defineProperty(proto, "complete", { configurable: true, get() { return complete.get(this) ?? false; } });

          const before = retainedActivityImageUrlCount();
          // ① 카드가 로그에 붙기 전에 그림이 준비됐다 — 떨어진 게 아니라 아직 안 붙은 것이다.
          const early = document.createElement("span");
          attachImage(early as unknown as HTMLElement, new Blob(["png"]), "초안");
          const earlyImage = early.querySelector("img")!;
          complete.set(earlyImage, true);
          releaseDetachedActivityImages();
          expect(revoked).toEqual([]);
          document.body.append(early);
          releaseDetachedActivityImages();

          // ② 붙어 있다가 행이 교체돼 떨어졌지만 아직 읽는 중 — 풀면 ERR_FILE_NOT_FOUND 다.
          const row = document.createElement("span");
          document.body.append(row);
          attachImage(row as unknown as HTMLElement, new Blob(["png"]), "변경 전");
          const rowImage = row.querySelector("img")!;
          releaseDetachedActivityImages();
          row.remove();
          releaseDetachedActivityImages();
          expect(revoked).toEqual([]);
          // 다 읽힌 뒤에는 푼다.
          complete.set(rowImage, true);
          releaseDetachedActivityImages();
          expect(revoked).toEqual(["blob:http://localhost/2"]);

          // ③ 한 번도 붙지 않은 그림도 유예 시간이 지나면 푼다(누수 방지).
          releaseDetachedActivityImages(Date.now() + 60_000);
          expect(revoked).toEqual(["blob:http://localhost/2"]);
          early.remove();
          releaseDetachedActivityImages();
          expect(revoked).toEqual(["blob:http://localhost/2", "blob:http://localhost/1"]);
          expect(retainedActivityImageUrlCount()).toBe(before);
          delete (proto as { complete?: boolean }).complete;
        });
      });
    });
    describe("aiActivityView", () => {
      isolateTimers();
      beforeEach(() => {
        const window = new Window();
        vi.stubGlobal("document", window.document);
        vi.stubGlobal("localStorage", window.localStorage);
        vi.stubGlobal("Event", window.Event);
        // el() 은 `child instanceof Node` 로 자식을 가른다 — document 만 바꾸면 Node 가 없어 전부 터졌다.
        vi.stubGlobal("Node", window.Node);
        vi.stubGlobal("HTMLDetailsElement", window.HTMLDetailsElement);
        setActivityLevel("brief");
        setAiLiveCanvasEnabled(true);
      });
      afterEach(() => {
        setAiLiveCanvasEnabled(true);
        vi.unstubAllGlobals();
      });
      const visibleText = (root: HTMLElement): string => {
        const notice = root.querySelector<HTMLElement>("p[role='status']");
        return `${root.querySelector(".ai-activity-entries")?.textContent ?? ""}\n${notice && !notice.hidden ? notice.textContent : ""}`;
      };
      describe("AI activity display levels", () => {
        it("defaults to brief and synchronizes existing main/member views without executing work", () => {
          expect(getActivityLevel()).toBe("brief");
          const main = createActivityView({ archive: false });
          const member = createActivityView({ archive: false });
          const control = createActivityLevelControl();
          document.body.append(main.root, member.root, control);
          let trace = createActivityTrace("조회");
          for (let i = 0; i < 12; i++) trace = recordActivityEvent(trace, { type: "tool_end", id: String(i), name: "get_map_region", ok: true, summary: "영역 확인" });
          main.update(trace); member.update(trace);
          expect(main.root.querySelectorAll(".ai-activity-entry").length).toBeLessThanOrEqual(4);
          setActivityLevel("trace");
          expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
          expect(member.root.dataset.level).toBe("trace");
          expect(control.querySelector('[aria-pressed="true"]')?.getAttribute("data-activity-level")).toBe("trace");
          setActivityLevel("none");
          expect(main.root.hidden).toBe(true);
          setActivityLevel("detail");
          expect(main.root.hidden).toBe(false);
          expect(main.root.querySelectorAll(".ai-activity-entry")).toHaveLength(12);
        });

        it("toggles map construction visuals without changing the work log", () => {
          const control = createActivityLevelControl();
          document.body.append(control);
          const button = control.querySelector("[data-testid='ai-live-canvas']");
          expect(button?.getAttribute("aria-pressed")).toBe("true");
          expect(isAiLiveCanvasEnabled()).toBe(true);
          (button as HTMLButtonElement).click();
          expect(isAiLiveCanvasEnabled()).toBe(false);
          expect(button?.getAttribute("aria-pressed")).toBe("false");
          expect(getActivityLevel()).toBe("brief");
          (button as HTMLButtonElement).click();
          expect(isAiLiveCanvasEnabled()).toBe(true);
        });
        it("간단히 보기는 개발 용어·단계 번호·소요 시간 없이 하는 일만 말한다", () => {
          // 2026-09-23 실측 줄: `Ultrabrain · 계획`, `consult writer · 실행 중`, `시공 · 8.7초`,
          // `모델 응답 대기 · 6번째 단계`, `도구 찾기 · 2건 확인·처리`, `DB 읽기`, `타일셋 참고 읽기`.
          const view = createActivityView({ archive: false }); document.body.append(view.root);
          let trace = createActivityTrace("숲속 마을");
          trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "ultrabrain-plan", role: "orchestrator", mapId: null, mapName: null, task: "t", label: "Ultrabrain · 계획" });
          trace = recordActivityEvent(trace, { type: "agent_spawn", agentId: "map_a", role: "builder", mapId: "map_a", mapName: null, task: "t" });
          trace = recordActivityEvent(trace, { type: "tool_end", id: "f1", name: "find_tools", ok: true, summary: "도구 2개", durationMs: 8700 }, "map_a");
          trace = recordActivityEvent(trace, { type: "tool_end", id: "f2", name: "find_tools", ok: true, summary: "도구 1개", durationMs: 8700 }, "map_a");
          trace = recordActivityEvent(trace, { type: "tool_end", id: "d1", name: "get_database_records", ok: true, summary: "items 1건 / 1건" }, "map_a");
          trace = recordActivityEvent(trace, { type: "tool_start", id: "w1", name: "consult_writer", args: {} }, "map_a");
          trace = recordActivityEvent(trace, { type: "turn", index: 6 }, "map_a");
          view.update(trace);
          // 숨긴 필터·메타 줄(전체 기록 전용)은 빼고, 보이는 행과 안내 줄만 읽는다.
          const text = visibleText(view.root);
          expect(text).toContain("대사 쓰는 중");
          expect(text).toContain("생각하는 중");
          for (const jargon of ["Ultrabrain", "consult", "시공", "초", "번째 단계", "확인·처리", "DB", "items", "모델 응답 대기"]) expect(text).not.toContain(jargon);

          // 자세히 보기는 그대로 — 원래 이름·건수가 남는다.
          setActivityLevel("detail");
          const detail = visibleText(view.root);
          expect(detail).toContain("consult writer · 실행 중");
          expect(detail).toContain("DB 읽기");
        });

        it("간단히 보기는 조수가 회복한 도구 실패를 「실패」 로 적지 않고, 자세히 보기에는 남긴다", () => {
          const view = createActivityView({ archive: false }); document.body.append(view.root);
          let trace = createActivityTrace("스위치");
          trace = recordActivityEvent(trace, { type: "tool_end", id: "s1", name: "rename_switch", ok: false, summary: "번호 충돌" });
          view.update(trace);
          // 가장 최근 실패는 «다른 방법을 찾는 중» 으로, 빨간 표시 없이.
          expect(view.root.textContent).toContain("다른 방법을 찾는 중");
          expect(view.root.textContent).not.toContain("실패");
          expect(view.root.querySelector(".ai-activity-entry.is-error")).toBeNull();
          trace = recordActivityEvent(trace, { type: "tool_end", id: "s2", name: "rename_switch", ok: true, summary: "바꿈" });
          view.update(trace);
          expect(view.root.textContent).not.toContain("실패");
          expect(view.root.textContent).not.toContain("다른 방법을 찾는 중");
          expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 완료");
          setActivityLevel("detail");
          expect(view.root.textContent).toContain("스위치 번호 바꾸기 · 실패");
        });

        it("keeps unchanged rows and open payloads while another tool completes", () => {
          setActivityLevel("trace");
          const view = createActivityView({ archive: false }); document.body.append(view.root);
          let trace = createActivityTrace("작업");
          trace = recordActivityEvent(trace, { type: "tool_end", id: "first", name: "get_event", ok: true, summary: "확인", result: { pages: 2 } });
          view.update(trace);
          const first = view.root.querySelector(".ai-activity-entry") as HTMLDetailsElement;
          first.open = true;
          trace = recordActivityEvent(trace, { type: "tool_end", id: "second", name: "find_events", ok: false, summary: "대상 없음" });
          view.update(trace);
          expect(view.root.querySelector(".ai-activity-entry")).toBe(first);
          expect(first.open).toBe(true);
        });
      });
    });
    describe("aiUiPerformance", () => {
      isolateTimers();
      let window: Window;
      beforeEach(() => {
        window = new Window();
        // A real window supplies add/removeEventListener for studio/modal lifecycle hooks.
        vi.stubGlobal('window', window);
        for (const key of ['document', 'Node', 'Element', 'HTMLElement', 'HTMLDetailsElement', 'Event', 'localStorage', 'MutationObserver'] as const) vi.stubGlobal(key, window[key]);
        setActivityLevel('brief');
      });
      afterEach(() => { publishTeamActivity(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
      function team() {
        let state = createTeamBoardState('team', '마을');
        for (let i = 0; i < 6; i++) state = reduceTeamBoard(state, { type: 'agent_spawn', agentId: 'a' + i, role: 'builder', mapId: 'm' + i, mapName: '장소' + i, task: '배정' + i, label: '팀원' + i });
        return state;
      }
      it('rolls a capped transcript without moving survivors and replaces only a completed tool', () => {
        const tx = createTeamTranscript(); document.body.append(tx.root);
        const rows = Array.from({ length: 200 }, (_, i) => ({ kind: 'tool' as const, id: 't' + i, name: 'paint_tiles', ok: null, summary: '' }));
        let agent = { ...team().agents[0]!, log: rows, droppedLog: 1 }; tx.update(agent);
        const list = tx.root.querySelector('.ai-team-tx-list')!;
        const survivor = list.children[1], unchanged = list.children[5];
        const inserts = vi.spyOn(list, 'insertBefore');
        agent = { ...agent, droppedLog: 2, log: [...rows.slice(1), { ...rows[0]!, id: 'next' }] }; tx.update(agent);
        expect(list.children).toHaveLength(200); expect(list.children[0]).toBe(survivor); expect(inserts).toHaveBeenCalledTimes(1);
        tx.update({ ...agent, log: agent.log.map((row, i) => i === 0 ? { ...row, ok: true, summary: '완료' } : row) });
        expect(list.children[0]).not.toBe(survivor); expect(list.children[4]).toBe(unchanged);
        expect(list.children[0]?.getAttribute('data-state')).toBe('ok'); expect(tx.root.textContent).toContain('이전 2행');
      });
      it('skips hidden transcript work and catches up when the fallback becomes visible', () => {
        const pane = createTeamWorkPane(), state = team(); pane.update(state);
        expect(pane.root.querySelector('.ai-team-tx-list')!.children).toHaveLength(0);
        const members = [...pane.root.querySelectorAll('.ai-team-work-member')]; pane.update({ ...state, report: '완료 보고' });
        expect([...pane.root.querySelectorAll('.ai-team-work-member')]).toEqual(members);
        pane.update({ ...state, trace: undefined }); expect(pane.root.querySelector('.ai-team-tx-task')?.textContent).toContain('배정5');
      });
      it('retains detached studio state and renders once when attached or updated', () => {
        const shell = createStudioShell({ onExit() {}, onFontZoom() {} });
        try {
          const state = team(); const create = vi.spyOn(document, 'createElement');
          publishTeamActivity(state); expect(create).not.toHaveBeenCalled(); create.mockRestore();
          const host = document.createElement('div'), log = document.createElement('div'), bar = document.createElement('div'); host.append(log, bar); document.body.append(host);
          shell.attach(host, { historyLogMount: log, commandBar: bar });
          expect(shell.root.querySelectorAll('[data-testid=lane-team-row]')).toHaveLength(6);
          (shell.root.querySelector('[data-testid=lane-team-row]') as HTMLElement).click();
          const work = shell.root.querySelector('[data-testid=ai-team-work]')!;
          const mutation = vi.spyOn(work, 'setAttribute'); publishTeamActivity({ ...state, report: '마지막 보고' });
          expect(work.textContent).toContain('마지막 보고');
          expect(mutation.mock.calls.filter(([key]) => key === 'data-phase')).toHaveLength(1);
          shell.detach(); publishTeamActivity({ ...state, report: '떨어진 뒤 보고' }); shell.attach(host, { historyLogMount: log, commandBar: bar });
          expect(work.textContent).toContain('떨어진 뒤 보고');
        } finally { shell.dispose(); }
      });
      it('retains member button identity and focus during text updates', () => {
        const sidebar = createAiTeamSidebar({ settings: document.createElement('div') }); document.body.append(sidebar.root);
        try {
          const state = team(); publishTeamActivity(state);
          const rows = [...sidebar.root.querySelectorAll<HTMLElement>('.ai-team-member')]; rows[0]!.focus();
          publishTeamActivity(reduceTeamBoard(state, { type: 'agent_event', agentId: 'a0', event: { type: 'execution_status', name: 'work.progress', summary: '새 진행' } }));
          expect(sidebar.root.querySelectorAll('.ai-team-member')[0]).toBe(rows[0]); expect(document.activeElement).toBe(rows[0]);
          expect(sidebar.root.querySelectorAll('.ai-team-member')[2]).toBe(rows[2]);
          expect(rows[0]!.textContent).toContain('새 진행');
        } finally { sidebar.dispose(); }
      });
      it('shares the media index without retaining pictures of entries dropped from a rolling trace', () => {
        const visual = { id: 'v', kind: 'map' as const, phase: 'draft' as const, title: '맵', target: 'm' };
        const trace = { ...createActivityTrace('test'), entries: [{ id: 'a', actor: 'a', kind: 'tool', name: 'paint_tiles', status: 'ok' as const, at: 1, summary: 'done', visuals: [visual] }] };
        const index = activityEntryIndex(trace); expect(activityEntryIndex({ ...trace })).toBe(index); expect(index.mediaByActor.get('a')).toEqual([visual]);
        expect(activityEntryIndex({ ...trace, entries: [] }).mediaByActor.has('a')).toBe(false);
      });
      it('preserves search, pagination, actor switching and unchanged rows', () => {
        setActivityLevel('trace'); const view = createActivityView({ archive: false }); document.body.append(view.root);
        let trace = createActivityTrace('test'); for (let i = 0; i < 110; i++) trace = recordActivityEvent(trace, { type: 'tool_end', id: 't' + i, name: 'get_event', ok: i % 3 !== 0, summary: '항목' + i }, i % 2 ? 'a' : 'b');
        view.update(trace); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
        const last = view.root.querySelector('.ai-activity-entries')!.lastElementChild; view.update(trace); expect(view.root.querySelector('.ai-activity-entries')!.lastElementChild).toBe(last);
        [...view.root.querySelectorAll('button')].find(b => b.textContent === '이전 기록 50건 더 보기')!.click(); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(100);
        view.update(trace, 'a'); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(50);
        const input = view.root.querySelector('input')!; input.value = '항목109'; input.dispatchEvent(new Event('input')); expect(view.root.querySelectorAll('.ai-activity-entry')).toHaveLength(1);
      });
      it('restores 200 messages with one height read and still scrolls a live append', () => {
        // An empty log is at the bottom (the follow controller samples it once at host creation, aiConversationScroll.ts); history fills it to 900px.
        const log = document.createElement('div'); let reads = 0; Object.defineProperty(log, 'scrollHeight', { get() { reads++; return log.children.length ? 900 : 0; } });
        const host = createConversationLogHost({ log, removeStartScreen() {} });
        reads = 0;
        host.renderConversationEntries(Array.from({ length: 200 }, (_, i) => ({ kind: 'assistant', text: '대답' + i, at: '2026-09-28' })));
        expect(reads).toBe(1); expect(log.querySelectorAll('.ai-command-row')).toHaveLength(200); expect(log.scrollTop).toBe(900);
        host.appendBubble('assistant', '다음'); expect(reads).toBe(2);
      });
      it('does not construct permanently hidden legacy board rows', () => {
        const state = team(), board = createTeamBoard(state); document.body.append(board.root); board.update(state);
        expect(board.root.querySelectorAll('.ai-team-agent')).toHaveLength(0); expect(board.root.querySelectorAll('.ai-activity-entry').length).toBeGreaterThan(0);
      });
      it('inspects only changed media subtrees and preserves images moved within the document', async () => {
        const RealURL = URL, revoke = vi.fn(); vi.stubGlobal('URL', Object.assign(class extends RealURL {}, { createObjectURL: () => 'blob:http://localhost/test', revokeObjectURL: revoke }));
        const surface = document.createElement('div'); document.body.append(surface); attachImage(surface, new Blob(['x']), 'picture');
        const image = surface.querySelector('img')!; let reads = 0;
        Object.defineProperty(image, 'isConnected', { get() { reads++; return document.body.contains(image); } }); Object.defineProperty(image, 'complete', { get() { return true; } });
        await new Promise(resolve => setTimeout(resolve, 5)); reads = 0;
        const text = document.createTextNode('unrelated'); document.body.append(text); text.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(reads).toBe(0);
        surface.remove(); document.body.append(surface); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).not.toHaveBeenCalled();
        surface.remove(); await new Promise(resolve => setTimeout(resolve, 5)); expect(revoke).toHaveBeenCalledOnce(); releaseDetachedActivityImages();
      });
    });
  });
  describe("aiAgentBrief", () => {
    isolateTimers();
    describe("readAgentBrief", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
        const mapId = store.getCurrent().startMapId;
        editorState.set({
          currentMapId: mapId,
          layer: "lower",
          tool: "paint",
          selection: null,
        });
      });

      afterEach(() => {
      });

      it("맵 크기·레이어·도구를 한 줄로 읽는다", () => {
        const brief = readAgentBrief();
        expect(brief.mapName).toBe("빈 맵");
        expect(brief.mapSize).toBe("20×15");
        expect(brief.layerShort).toBe("바닥");
        expect(brief.toolLabel).toBe("칠하기");
        expect(brief.line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
        expect(brief.lookingAt).toBe("지금 빈 맵 20×15");
        expect(brief.eventCount).toBe(0);
      });

      it("이벤트 레이어+도구는 도구를 중복하지 않는다", () => {
        editorState.set({ layer: "event", tool: "event" });
        expect(readAgentBrief().line).toBe("빈 맵 20×15 · 이벤트");
      });

      it("선택 영역이 있으면 줄과 placeholder에 칸 수가 실린다", () => {
        const mapId = store.getCurrent().startMapId;
        editorState.set({
          selection: { mapId, x: 3, y: 4, width: 4, height: 3 },
        });
        const brief = readAgentBrief();
        expect(brief.selectionLabel).toBe("선택 4×3 (3,4)");
        expect(brief.line).toContain("선택 4×3 (3,4)");
        expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
      });

      it("선택이 있으면 선택 꾸미기 명령을 앞에 둔다", () => {
        const mapId = store.getCurrent().startMapId;
        editorState.set({
          selection: { mapId, x: 0, y: 0, width: 2, height: 2 },
        });
        const prompts = directorStartPrompts(readAgentBrief());
        expect(prompts.map((prompt) => prompt.id)).toEqual(["selection", "place", "character"]);
        expect(prompts).toHaveLength(3);
      });

      it("이벤트 레이어에서는 등장인물 명령을 앞에 둔다", () => {
        editorState.set({ layer: "event", tool: "event" });
        const prompts = directorStartPrompts(readAgentBrief());
        expect(prompts[0]?.id).toBe("character");
        expect(prompts[0]?.instruction).toContain("빈 맵");
      });

      it("대기 한 줄과 골드 힌트 둘을 준다", () => {
        const brief = readAgentBrief();
        expect(idlePresenceLine(brief)).toBe("이 맵에 무엇을 둘까요");
        expect(assistantIdleHints(brief)).toHaveLength(2);
        expect(assistantIdleHints(brief)[0]?.label).toBe("강가를 만들어줘");
        expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
      });

      it("빈 맵은 버튼을 누르라고 안내한다", () => {
        expect(nextStepHint(readAgentBrief())).toBe("빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.");
      });

      it("흙길 오토타일 외곽만 있어도 실제 길로 인식한다", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("start map missing");
        map.lowerTiles[7 * map.width + 2] = 390;
        map.lowerTiles[7 * map.width + 3] = 391;
        map.lowerTiles[7 * map.width + 4] = 392;
        store.replace(structuredClone(project));

        const brief = readAgentBrief();
        expect(brief.hasPath).toBe(true);
        expect(nextStepHint(brief)).not.toContain("길이 없어요");
      });

      it("선택이 있으면 그 칸을 고르라고 안내한다", () => {
        const mapId = store.getCurrent().startMapId;
        editorState.set({
          selection: { mapId, x: 1, y: 1, width: 2, height: 2 },
        });
        expect(nextStepHint(readAgentBrief())).toBe("선택한 칸에 무엇을 둘지 골라 보세요.");
      });
    });
  });
  describe("aiAnswerLinkRender", () => {
    isolateTimers();
    function fixture(): Project {
      const project = createBlankProject();
      const start = project.maps[project.startMapId];
      if (!start) throw new Error("blank project has no start map");
      start.name = "햇살 마을";
      const house = createBlankMap("상인 하나의 집", 20, 16);
      house.id = "map_house_interior_1";
      project.maps[house.id] = house;
      return project;
    }
    function merchant() {
      return {
        id: "ev_new_merchant",
        x: 3,
        y: 4,
        trigger: { kind: "action" as const },
        commands: [],
        pages: [{
          id: "ev_new_merchant_page_1",
          name: "새로 온 상인",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" as const },
          priority: "same" as const,
          movement: { type: "fixed" as const, speed: 3 as const, frequency: 3 as const },
          commands: [],
        }],
      };
    }
    function index(): EditorReferenceIndex {
      return buildEditorReferenceIndex(fixture());
    }
    function links(root: HTMLElement): FakeElement[] {
      return (root as unknown as FakeElement).querySelectorAll("[data-testid=ai-answer-link]");
    }
    describe("assistant answer internal links", () => {
      let restoreDom: (() => void) | null = null;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });

      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("turns an authored map name inside the answer into a navigation button", () => {
        const text = "우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";
        const root = renderMarkdown(text);

        const created = decorateEditorReferences(root, index(), () => true);
        const buttons = links(root);

        expect(created).toBe(1);
        expect(buttons.map((button) => button.textContent)).toEqual(["상인 하나의 집"]);
        expect(buttons[0]?.tagName).toBe("BUTTON");
        expect(buttons[0]?.attrs.type).toBe("button");
      });

      it("keeps the surrounding sentence intact around the link", () => {
        const text = "‘상인 하나의 집’ 안에는 아직 상점 NPC가 없습니다.";
        const root = renderMarkdown(text);

        decorateEditorReferences(root, index(), () => true);

        expect(root.textContent).toBe(text);
      });

      it("clicking a link navigates to that target exactly once", () => {
        const navigated: EditorReferenceTarget[] = [];
        const root = renderMarkdown("‘상인 하나의 집’으로 가보세요.");

        decorateEditorReferences(root, index(), (target) => {
          navigated.push(target);
          return true;
        });
        const button = links(root)[0];
        if (!button) throw new Error("link not created");
        button.click();

        expect(navigated).toEqual([{ kind: "map", mapId: "map_house_interior_1" }]);
      });

      it("never links names inside code spans or fenced code", () => {
        const root = renderMarkdown(["`상인 하나의 집`", "", "```", "상인 하나의 집", "```"].join("\n"));

        const created = decorateEditorReferences(root, index(), () => true);

        expect(created).toBe(0);
        expect(links(root)).toHaveLength(0);
      });

      it("does not decorate an existing markdown link label", () => {
        const root = renderMarkdown("[상인 하나의 집](https://example.com/docs)");

        expect(decorateEditorReferences(root, index(), () => true)).toBe(0);
      });

      it("renderAssistantAnswer wires the live project index into the bubble body", () => {
        store.replace(fixture());

        const body = renderAssistantAnswer("‘상인 하나의 집’은 아직 비어 있습니다.");

        expect(links(body).map((button) => button.dataset.refKind)).toEqual(["map"]);
      });

      it("맵 변경 뒤 새 이벤트 이름으로 색인을 다시 만든다", () => {
        const project = fixture();
        store.replace(project);
        renderAssistantAnswer("햇살 마을은 조용합니다.");
        store.updateMap(project.startMapId, (map) => {
          const event = merchant();
          const page = event.pages[0];
          if (!page) throw new Error("event page is missing");
          page.name = "새로 온 상인";
          map.events.push(event);
        });

        const body = renderAssistantAnswer("새로 온 상인을 만나보세요.");

        expect(links(body).map((button) => button.dataset.refLabel)).toEqual(["새로 온 상인"]);
      });

      it("같은 이름이 여러 곳이면 한 곳을 고르지 않는다", () => {
        const project = createBlankProject();
        const first = createBlankMap("여관", 20, 16);
        first.id = "map_inn_a";
        const second = createBlankMap("여관", 20, 16);
        second.id = "map_inn_b";
        project.maps = { [first.id]: first, [second.id]: second };
        project.startMapId = first.id;
        store.replace(project);

        const body = renderAssistantAnswer("여관은 두 곳입니다.");

        expect(links(body).map((button) => button.dataset.refKind)).toEqual(["ambiguous"]);
      });
    });
  });
  describe("aiAssistant", () => {
    isolateTimers();
    describe("aiAssistantBridge", () => {
      isolateTimers();
      describe("aiAssistantBridge", () => {
        afterEach(() => {
          unregisterAiAssistantBridge();
          vi.unstubAllGlobals();
        });

        it("registers window API and returns send/status/audit from handlers", async () => {
          const windowStub = {
            location: { search: "?aiBridge=0" },
            setTimeout: () => 0,
            clearTimeout: () => undefined,
          };
          vi.stubGlobal("window", windowStub);
          vi.stubGlobal("import", { meta: { env: { DEV: false } } });

          registerAiAssistantBridge({
            send: async (text) => ({
              ok: true,
              status: {
                ready: true,
                turnBusy: false,
                configReady: true,
                lastStatus: "완료",
                bridgeConnected: false,
                panelMounted: true,
              },
              audit: [{ kind: "user", text, at: "t0" }],
              harness: { messages: [] },
              lastAssistantText: "ok",
            }),
            getStatus: () => ({
              ready: true,
              turnBusy: false,
              configReady: true,
              lastStatus: "대기",
              bridgeConnected: false,
              panelMounted: true,
            }),
            getAudit: () => [{ kind: "status", text: "대기" }],
            getHarness: () => ({ messages: [1] }),
            abort: () => undefined,
          });

          setAiBridgeLastStatus("검토 대기");
          expect(window.__oprnAiBridge).toBeDefined();
          expect(window.__oprnAiBridge?.status().lastStatus).toBe("검토 대기");
          expect(window.__oprnAiBridge?.audit()).toEqual([{ kind: "status", text: "대기" }]);
          expect(window.__oprnAiBridge?.harness()).toEqual({ messages: [1] });

          const bridge = window.__oprnAiBridge;
          if (!bridge) throw new Error("Bridge missing");
          const result = await bridge.send("숲을 다듬어줘");
          expect(result).toMatchObject({ ok: true, lastAssistantText: "ok" });
          expect(isAiAssistantBridgeConnected()).toBe(false);
        });

        it("retires old registration sends and abort callbacks before a replacement accepts B", async () => {
          vi.stubGlobal("window", { location: { search: "?aiBridge=0" } });
          const response = deferred<AiBridgeTurnResult>();
          const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
          const a: AiAssistantBridgeHandlers = { send: () => response.promise, getStatus: () => status,
            getAudit: () => [], getHarness: () => null, abort: vi.fn() };
          registerAiAssistantBridge(a);
          const oldApi = window.__oprnAiBridge;
          if (!oldApi) throw new Error("A bridge missing");
          const pendingA = oldApi.send("A");
          const b: AiAssistantBridgeHandlers = { ...a, send: vi.fn(async text => ({ ok: true, status,
            audit: [{ kind: "user", text }], harness: { owner: "B" } })), abort: vi.fn() };
          registerAiAssistantBridge(b);
          try {
            expect(await bounded(pendingA)).toMatchObject({ ok: false, audit: [], harness: null });
            expect(await sendAiAssistantMessage("B")).toMatchObject({ ok: true, audit: [{ kind: "user", text: "B" }] });
            oldApi.abort(); oldApi.abort();
            expect(b.abort).not.toHaveBeenCalled();
            expect(await oldApi.send("late A")).toMatchObject({ ok: false });
            response.resolve({ ok: true, status, audit: [{ kind: "assistant", text: "A_LATE" }], harness: { owner: "A" } });
            await response.promise;
            expect(b.send).toHaveBeenCalledTimes(1);
            expect(window.__oprnAiBridge?.harness()).toBeNull();
          } finally { response.resolve({ ok: false, status, audit: [], harness: null }); await bounded(pendingA); }
        });

        it.each(["resolve", "reject"])("cleanup prevents a late hello %s from reconnecting or scheduling another poll", async ending => {
          const hello = deferred<Response>();
          const entered = deferred<void>();
          const handled = deferred<void>();
          const schedule = vi.fn(() => 1);
          vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
          const fetch = vi.fn<typeof globalThis.fetch>(() => { entered.resolve(); return hello.promise.finally(() => handled.resolve()); });
          vi.stubGlobal("fetch", fetch);
          registerAiAssistantBridge({ send: async () => { throw new Error("No send expected"); },
            getStatus: () => ({ ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true }),
            getAudit: () => [], getHarness: () => null, abort: vi.fn() });
          try {
            await bounded(entered.promise); unregisterAiAssistantBridge();
            if (ending === "resolve") hello.resolve(Response.json({}));
            else hello.reject(new Error("Late owned transport error"));
            await bounded(handled.promise);
            await bounded(whenAiAssistantBridgeSettled());
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(schedule).not.toHaveBeenCalled();
            expect(isAiAssistantBridgeConnected()).toBe(false);
          } finally { hello.resolve(Response.json({})); await bounded(whenAiAssistantBridgeSettled()); }
        });

        it("deduplicates actual HTTP command IDs without replaying a send", async () => {
          const tick = deferred<() => void>();
          const secondPost = deferred<void>();
          let posts = 0;
          const schedule = vi.fn((callback: () => void) => { tick.resolve(callback); return 1; });
          vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
          vi.stubGlobal("fetch", vi.fn<typeof fetch>(async input => {
            const path = new URL(String(input)).pathname;
            if (path.endsWith("/hello")) return Response.json({});
            if (path.endsWith("/next")) return Response.json({ command: { id: "same-command", type: "send", text: "A" } });
            if (path.endsWith("/result")) { if (++posts === 2) secondPost.resolve(); return Response.json({}); }
            throw new Error(`Unexpected bridge request ${path}`);
          }));
          const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
          const send = vi.fn(async (text: string) => ({ ok: true, status, audit: [{ kind: "user", text }], harness: null }));
          registerAiAssistantBridge({ send, getStatus: () => status, getAudit: () => [], getHarness: () => null, abort: vi.fn() });
          try {
            const next = await bounded(tick.promise); next();
            await bounded(secondPost.promise);
            expect(send).toHaveBeenCalledTimes(1);
            expect(posts).toBe(2);
          } finally { unregisterAiAssistantBridge(); await bounded(whenAiAssistantBridgeSettled()); }
        });
      });
    });
    describe("aiAssistantPanel", () => {
      isolateTimers();
      function withFakeDom<T>(run: () => T): T {
        const restore = installFakeDom();
        try {
          return run();
        } finally {
          restore();
        }
      }
      function directParagraphText(container: HTMLElement): string[] {
        return (Array.from(container.childNodes) as unknown[])
          .filter((node): node is FakeElement => node instanceof FakeElement && node.tagName === "P")
          .map((node) => node.textContent);
      }
      describe("AI assistant preview summaries", () => {
        it("shows diff, evidence, and approval-relevant metadata for a successful preview", () => {
          // The preview generator targets the EasyRPG combined-town sheet, which new projects no longer ship (2026-10-07 purge).
          const source = withRetiredEasyRpgTilesets(createBlankProject());
          const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });

          expect(result.ok).toBe(true);
          if (!result.ok) throw new Error(result.clarificationQuestion);

          expect(aiPreviewDiffLines(source, result)).toEqual([
            expect.stringContaining("프리뷰 맵:"),
            `맵 수: ${Object.keys(source.maps).length} → ${Object.keys(result.project.maps).length}`,
            `시작 맵: ${source.startMapId} → ${result.project.startMapId}`,
            expect.stringContaining("NPC: 항구 안내인/preview-guide"),
          ]);
          expect(aiPreviewEvidenceLines(result)).toEqual([
            expect.stringContaining("ChipSet 증거:"),
            expect.stringContaining("CharSet 증거: easyrpg-charset-people"),
            expect.stringContaining("타일 그룹:"),
            expect.stringContaining("reachableNpcEvents=통과"),
          ]);
          expect(source.startMapId).not.toBe(result.project.startMapId);
        });

        it("surfaces fail-closed missing evidence instead of approval metadata", () => {
          const result = createAiPreviewProject({ goal: "추상적인 분위기", sourceProject: withRetiredEasyRpgTilesets(createBlankProject()) });

          expect(result.ok).toBe(false);
          if (result.ok) throw new Error("expected fail-closed result");

          expect(aiPreviewDiffLines(createBlankProject(), result)).toEqual(["적용될 프로젝트 변경 없음."]);
          expect(aiPreviewEvidenceLines(result)).toEqual([
            expect.stringContaining("질문:"),
            expect.stringContaining("부족한 증거: charset_not_high_confidence"),
          ]);
        });
        it("invalidates stale generated previews when the source project changes before approval", () => {
          const source = createBlankProject();
          const fingerprint = aiPreviewSourceFingerprint(source);

          expect(aiPreviewSourceMatches(source, fingerprint)).toBe(true);

          source.meta.title = "changed after preview generation";

          expect(aiPreviewSourceMatches(source, fingerprint)).toBe(false);
        });

        it("renders technical preview evidence under a default-closed validation details block", () => {
          withFakeDom(() => {
            const container = document.createElement("div");

            renderPreviewReport(container, {
              beforeDetails: ["프리뷰 맵: 작은 항구"],
              detailLines: ["ChipSet 증거: combined-town / high"],
              afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
            });

            const details = container.querySelector("details");
            expect(details?.getAttribute("open")).toBeNull();
            expect(details?.querySelector("summary")?.textContent).toBe("생성 검증 상세");
            expect(details?.textContent).toContain("ChipSet 증거");
          });
        });

        it("keeps diff and approval lines visible while evidence text stays inside details", () => {
          withFakeDom(() => {
            const container = document.createElement("div");

            renderPreviewReport(container, {
              beforeDetails: ["프리뷰 맵: 작은 항구", "맵 수: 1 → 2"],
              detailLines: ["CharSet 증거: easyrpg-charset-people"],
              afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
            });

            expect(directParagraphText(container)).toEqual([
              "프리뷰 맵: 작은 항구",
              "맵 수: 1 → 2",
              "승인 전까지 원본 프로젝트는 변경되지 않습니다.",
            ]);
            expect(directParagraphText(container).join("\n")).not.toContain("증거");
            expect(container.querySelector("details")?.textContent).toContain("CharSet 증거");
          });
        });

        it("omits the validation details block when there are no technical lines", () => {
          withFakeDom(() => {
            const container = document.createElement("div");

            renderPreviewReport(container, {
              beforeDetails: ["프리뷰 목표를 먼저 입력하세요."],
            });

            expect(container.querySelector("details")).toBeNull();
            expect(directParagraphText(container)).toEqual(["프리뷰 목표를 먼저 입력하세요."]);
          });
        });
      });
    });
  });
});

describe("editorPanelsSuite13", () => {
  isolateTimers();
  describe("aiComposerDeck", () => {
    isolateTimers();
    function button(testid: string): HTMLButtonElement {
      const node = document.createElement("button");
      node.dataset.testid = testid;
      return node;
    }
    function div(cls: string): HTMLElement {
      const node = document.createElement("div");
      node.className = cls;
      return node;
    }
    function render(extra: {
      readonly isInside?: (target: Node) => boolean;
      readonly modelLabel?: string | null;
    } = {}): { readonly shell: ComposerElements; readonly input: HTMLTextAreaElement; readonly collapse: HTMLButtonElement } {
      const input = document.createElement("textarea");
      input.dataset.testid = "ai-input";
      const collapse = button("ai-collapse");
      const shell = createComposerElements({
        input,
        collapseButton: collapse,
        sendButton: button("ai-send"),
        abortButton: button("ai-abort"),
        undoAppliedButton: button("ai-composer-undo"),
        contextChips: div("ai-context-chips"),
        composerChips: div("ai-composer-chips"),
        nextSteps: div("ai-next-steps"),
        queueIndicator: div("ai-pending-queue"),
        statusGroup: div("ai-status-group"),
        contextMeterButton: button("ai-context-meter"),
        contextMeterPopover: div("ai-context-panel"),
        onNewChat: () => undefined,
        onOpenConversations: () => undefined,
        preferenceContent: div("ai-preference-settings"),
        ...(extra.isInside ? { isInside: extra.isInside } : {}),
        ...(extra.modelLabel !== undefined ? { modelLabel: extra.modelLabel } : {}),
      });
      return { shell, input, collapse };
    }
    describe("aiComposer — 데크 컴포저", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("레일용 버튼(새 대화·이전 대화·더보기·성향·맥락·접기)은 만들되 액션 행에 넣지 않는다", () => {
        // Break: 버튼이 다시 액션 행에 들어가면 레일과 두 벌이 되거나, 반환값이 비어 레일이 빈 슬롯이 된다.
        const { shell, collapse } = render();
        const actions = shell.actions as unknown as FakeElement;
        for (const testid of ["ai-new-chat", "ai-open-conversations", "ai-command-menu-toggle", "ai-preference-toggle", "ai-context-meter", "ai-collapse"]) {
          expect(findByTestId(actions, testid), `${testid} 는 행 밖`).toBeNull();
        }
        expect(shell.newChatButton.dataset.testid).toBe("ai-new-chat");
        expect(shell.conversationsButton?.dataset.testid).toBe("ai-open-conversations");
        expect(findByTestId(shell.conversationsButton as unknown as FakeElement, "ai-map-history-open")).not.toBeNull();
        expect(shell.menuToggle.dataset.testid).toBe("ai-command-menu-toggle");
        expect(shell.preferenceToggle?.dataset.testid).toBe("ai-preference-toggle");
        expect(collapse.parentElement).toBeNull();
      });

      it("레일 버튼은 글리프가 아니라 SVG 아이콘 + aria-label 이다", () => {
        // Break: 텍스트 글리프(+ 🕒 ☰ ⌾)로 돌아간다.
        const { shell } = render();
        const hasSvg = (node: HTMLElement | null): boolean =>
          [...(node?.childNodes ?? [])].some((child) => (child as { tagName?: string }).tagName?.toLowerCase() === "svg");
        for (const node of [shell.newChatButton, shell.conversationsButton, shell.menuToggle, shell.preferenceToggle]) {
          expect(hasSvg(node), node?.dataset.testid).toBe(true);
          expect((node?.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
        }
        expect(shell.newChatButton.textContent).toBe("");
      });

      it("키 힌트 글자는 행에서 사라지고 입력창 title 로 간다", () => {
        // Break: 156px 힌트가 다시 액션 행을 점유한다.
        const { shell, input } = render();
        expect((shell.commandBar as unknown as FakeElement).querySelector(".ai-composer-hint")).toBeNull();
        expect(input.getAttribute("title")).toContain("Enter");
      });

      it("모드 세그먼트를 아예 만들지 않는다 — 지시줄 컨트롤은 자율성 다이얼 하나다", () => {
        // Break: 세그먼트가 남으면 같은 노브(질문=readOnly, 계획=planOnly)를 두 컨트롤이 만지고,
        // 둘이 어긋날 때 어느 쪽이 이기는지 사용자가 알 수 없다.
        const { shell } = render();
        const actions = shell.actions as unknown as FakeElement;
        expect(actions.querySelector(".ai-composer-mode")).toBeNull();
        expect(actions.querySelector(".ai-composer-mode-option")).toBeNull();
      });

      it("모델명은 입력줄에 두지 않는다", () => {
        const { shell } = render({ modelLabel: "Gemini 3.7 Flash" });
        const actions = shell.actions as unknown as FakeElement;
        expect(findByTestId(actions, "ai-composer-model")).toBeNull();
      });

      it("턴·토큰 줄은 비어 있으면 숨고, 값이 있으면 입력창 밖 메타 줄에 보인다", () => {
        const { shell } = render();
        // #4899: 사용량 줄은 칩 줄(actions) 밖, 명령 바의 메타 줄로 옮겨졌다.
        expect(findByTestId(shell.actions as unknown as FakeElement, "ai-composer-spend")).toBeNull();
        const chip = findByTestId(shell.commandBar as unknown as FakeElement, "ai-composer-spend");
        expect(chip?.hidden).toBe(true);
        shell.setSpend("3턴 · 12,400토큰");
        expect(chip?.hidden).toBe(false);
        expect(chip?.textContent).toBe("3턴 · 12,400토큰");
        shell.setSpend(null);
        expect(chip?.hidden).toBe(true);
      });

      it("바깥 클릭 판정은 isInside 가 정한다 — 데크 안(레일)의 클릭은 메뉴를 닫지 않는다", () => {
        // Break: containment 가 commandBar 로 고정돼 레일의 ⋯ 를 두 번 누르면 닫히고 곧 다시 열린다.
        const outside = document.createElement("div");
        let inside = true;
        const { shell } = render({ isInside: () => inside });
        shell.openPopover("menu");
        expect(shell.openKind()).toBe("menu");
        (outside as unknown as FakeElement).dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(shell.openKind()).toBe("menu");
        inside = false;
        (outside as unknown as FakeElement).dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(shell.openKind()).toBeNull();
      });
    });
  });
  // 지시줄 자율성 셀렉트 — 컴포저 단위 계약: 값 어휘·초기값·콜백·외부 동기화.
  // 추론 강도 셀렉트는 없다: 레벨 프리셋이 추론을 정한다(src/ai/autonomyLevels.ts).
  describe("aiComposerEffort", () => {
    isolateTimers();
    function button(testid: string): HTMLButtonElement {
      const node = document.createElement("button");
      node.dataset.testid = testid;
      return node;
    }
    function div(cls: string): HTMLElement {
      const node = document.createElement("div");
      node.className = cls;
      return node;
    }
    function render(extra: {
      readonly autonomy?: AutonomyLevel;
      readonly onAutonomy?: (level: AutonomyLevel) => void;
    } = {}): ComposerElements {
      const input = document.createElement("textarea");
      return createComposerElements({
        input,
        collapseButton: button("ai-collapse"),
        sendButton: button("ai-send"),
        abortButton: button("ai-abort"),
        undoAppliedButton: button("ai-composer-undo"),
        contextChips: div("ai-context-chips"),
        composerChips: div("ai-composer-chips"),
        nextSteps: div("ai-next-steps"),
        queueIndicator: div("ai-pending-queue"),
        statusGroup: div("ai-status-group"),
        onNewChat: () => undefined,
        effortChips: {
          initialAutonomy: extra.autonomy ?? "balanced",
          onAutonomyChange: extra.onAutonomy ?? (() => undefined),
        },
      });
    }
    describe("aiComposer 자율성 셀렉트", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("effortChips 를 주지 않으면 셀렉트를 만들지 않는다", () => {
        // Break: 옵션 없이 셀렉트가 생겨 콜백 없는 컨트롤이 행을 차지한다.
        const input = document.createElement("textarea");
        const shell = createComposerElements({
          input,
          collapseButton: button("ai-collapse"),
          sendButton: button("ai-send"),
          abortButton: button("ai-abort"),
          undoAppliedButton: button("ai-composer-undo"),
          contextChips: div("ai-context-chips"),
          composerChips: div("ai-composer-chips"),
          nextSteps: div("ai-next-steps"),
          queueIndicator: div("ai-pending-queue"),
          statusGroup: div("ai-status-group"),
          onNewChat: () => undefined,
        });
        expect(shell.autonomySelect).toBeNull();
        expect((shell.actions as unknown as FakeElement).querySelector('[data-testid="ai-composer-autonomy"]')).toBeNull();
      });

      it("적용 정책은 자율성과 별도로 다섯 모드를 제공한다", () => {
        const shell = render();
        // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
        const select = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-apply-mode"]');
        expect(select?.querySelectorAll("option").map(option => option.getAttribute("value"))).toEqual(["yolo", "auto", "default", "review", "step"]);
        expect(select?.value).toBe("default");
      });

      it("자율성 선택지는 다이얼 전체를 한국어 라벨로 그린다", () => {
        // Break: 읽기 전용이 목록에서 빠지면 ask 레일을 부를 수단이 UI 에서 사라진다.
        const shell = render();
        const autonomyOptions = shell.autonomySelect?.querySelectorAll("option") ?? [];
        expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toEqual(
          AUTONOMY_LEVELS.map((level) => level.id),
        );
        expect([...autonomyOptions].map((node) => node.textContent)).toEqual(
          AUTONOMY_LEVELS.map((level) => level.label),
        );
        expect([...autonomyOptions].map((node) => node.getAttribute("value"))).toContain("readonly");
      });

      it("추론 강도 셀렉트를 그리지 않는다", () => {
        // Break: 수동 override 가 남으면 다이얼이 저장한 프리셋 값과 갈라진다.
        const shell = render();
        // 셀렉트들은 액션 행이 아니라 「작업 설정」 팝오버(commandBar 안)에 산다(public baseline 0d4f13e7c8).
        const selects = (shell.commandBar as unknown as FakeElement).querySelectorAll('[data-testid="ai-composer-autonomy"]');
        expect([...selects].length).toBe(1);
      });

      it("초기값을 그리고 change 가 콜백을 부른다", () => {
        const picked: AutonomyLevel[] = [];
        const shell = render({ autonomy: "autonomous", onAutonomy: (level) => picked.push(level) });
        expect(shell.autonomySelect?.value).toBe("autonomous");
        if (!shell.autonomySelect) throw new Error("autonomy select missing");
        shell.autonomySelect.value = "readonly";
        shell.autonomySelect.dispatchEvent(new Event("change"));
        expect(picked).toEqual(["readonly"]);
      });

      it("알 수 없는 값은 콜백 없이 표시를 되돌린다", () => {
        // Break: 검증 없이 통과시키면 저장소에 레벨 아닌 문자열이 들어가 유도가 balanced 로 무너진다.
        const picked: AutonomyLevel[] = [];
        const shell = render({ autonomy: "balanced", onAutonomy: (level) => picked.push(level) });
        if (!shell.autonomySelect) throw new Error("autonomy select missing");
        shell.autonomySelect.value = "turbo";
        shell.autonomySelect.dispatchEvent(new Event("change"));
        expect(picked).toEqual([]);
        expect(shell.autonomySelect.value).toBe("balanced");
      });

      it("syncEffort 가 셀렉트 표시를 고친다", () => {
        // Break: 설정 모달에서 바꾼 뒤 컴포저 표시만 옛값이라 거짓을 보여준다.
        const shell = render({ autonomy: "balanced" });
        shell.syncEffort("max");
        expect(shell.autonomySelect?.value).toBe("max");
      });

      it("셀렉트는 작업 설정 팝오버에 있고, 액션 행 lead 는 그 토글만 갖고, 팝오버 기계를 건드리지 않는다", () => {
        // 자율성 셀렉트는 「작업 설정」 팝오버로 옮겨졌다(public baseline 0d4f13e7c8) — lead 에는 여는 토글이 남는다.
        const shell = render();
        const actions = shell.actions as unknown as FakeElement;
        const lead = actions.querySelector(".ai-composer-actions-lead");
        expect(lead?.querySelector('[data-testid="ai-composer-settings"]')).toBeTruthy();
        const popover = (shell.commandBar as unknown as FakeElement).querySelector('[data-testid="ai-composer-settings-popover"]');
        expect(popover?.contains(shell.autonomySelect)).toBe(true);
        expect(shell.openKind()).toBeNull();
      });
    });
  });
  // test/aiContextMeter.test.ts
  // 맥락 게이지 — 라벨/톤 계산과 팝오버가 스냅샷을 그대로 비추는지.
  //
  // 톤 기준은 **자동 압축 임계** 다(모델 창이 아니다): 사용자가 궁금한 것은 "창이 얼마 남았나"
  // 가 아니라 "언제 자동으로 압축이 도는가" 이기 때문이다. 게이지가 창 기준으로 세면 임계를
  // 넘어 압축이 돌아도 게이지는 한가하게 보인다.
  describe("aiContextMeter", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    function usage(overrides: Partial<ContextUsage> = {}): ContextUsage {
      return {
        estimateTokens: 40_000,
        usageTokens: 0,
        contextTokens: 40_000,
        contextWindow: 128_000,
        reserveTokens: 16_384,
        thresholdTokens: 111_616,
        ratio: 40_000 / 128_000,
        overThreshold: false,
        ...overrides,
      };
    }
    function snapshot(overrides: Partial<AiContextSnapshot> = {}): AiContextSnapshot {
      return {
        usage: usage(),
        totals: EMPTY_SESSION_USAGE,
        summary: null,
        canUndoCompaction: false,
        busy: false,
        ...overrides,
      };
    }
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });
    describe("게이지 숫자와 톤", () => {
      it("Given 비율 When 퍼센트 Then 정수로 반올림한다", () => {
        expect(contextUsagePercent(usage({ ratio: 0.6249 }))).toBe(62);
        expect(contextUsagePercent(usage({ ratio: 0 }))).toBe(0);
      });

      it("Given 임계 미만 When 톤 Then idle", () => {
        expect(contextUsageTone(usage({ contextTokens: 40_000 }))).toBe("idle");
      });

      it("Given 임계의 80% 이상 When 톤 Then near", () => {
        expect(contextUsageTone(usage({ contextTokens: Math.ceil(111_616 * 0.8) }))).toBe("near");
      });

      it("Given 임계 초과 When 톤 Then warn", () => {
        expect(contextUsageTone(usage({ contextTokens: 120_000, overThreshold: true }))).toBe("warn");
      });

      it("Given 세션 없음 When 라벨 Then 0% 라고 거짓말하지 않고 무엇의 칸인지 말한다(C-71)", () => {
        // C-71(92a6aba61e): 줄표 자리표시 대신 「맥락 사용량」. 숫자 0% 를 지어내지 않는 계약은 그대로다.
        expect(formatContextMeterLabel(null)).toBe("맥락 사용량");
        expect(formatContextMeterLabel(usage({ ratio: 0.31 }))).toBe("맥락 31%");
      });
    });
    describe("팝오버 내용", () => {
      it("Given 세션 없음 When 렌더 Then 압축 버튼이 잠기고 안내 문장이 온다", () => {
        const meter = createAiContextMeter({
          read: () => snapshot({ usage: null }),
          onCompact: () => undefined,
          onUndoCompaction: () => undefined,
          onToggle: () => undefined,
        });
        const popover = meter.popover as unknown as FakeElement;

        expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 사용량");
        expect(findByTestId(popover, "ai-context-headline")!.textContent).toBe("아직 대화가 없습니다");
        expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
        expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("아직 요청 없음");
      });

      it("Given 사용량과 요약이 있는 스냅샷 When 갱신 Then 토큰·임계·모델별 집계가 보인다", () => {
        let current = snapshot({
          usage: usage({ usageTokens: 52_000, contextTokens: 52_000, ratio: 52_000 / 128_000 }),
          totals: addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 52_000, completion_tokens: 900 }),
          summary: "## Goal\n마을 정비",
        });
        const meter = createAiContextMeter({
          read: () => current,
          onCompact: () => undefined,
          onUndoCompaction: () => undefined,
          onToggle: () => undefined,
        });
        const popover = meter.popover as unknown as FakeElement;

        expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 41%");
        expect((meter.button as unknown as FakeElement).dataset.tone).toBe("idle");
        const detail = findByTestId(popover, "ai-context-detail")!.textContent;
        expect(detail).toContain("52,000 / 128,000 토큰");
        expect(detail).toContain("자동 압축 임계 111,616 토큰");
        expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("호출 1회 · 입력 52,000 · 출력 900");
        expect(findByTestId(popover, "ai-context-models")!.textContent).toContain("gpt-x");
        // 요약 원문은 접힌 채 존재한다 — 토글로만 펼친다.
        const body = findByTestId(popover, "ai-context-summary-body")!;
        expect(body.hidden).toBe(true);
        expect(body.textContent).toContain("마을 정비");
        (findByTestId(popover, "ai-context-summary-toggle") as unknown as HTMLElement).click();
        expect(body.hidden).toBe(false);

        // 임계를 넘기면 톤이 경고로 바뀐다.
        current = snapshot({ usage: usage({ contextTokens: 120_000, ratio: 120_000 / 128_000, overThreshold: true }) });
        meter.refresh();
        expect((meter.button as unknown as FakeElement).dataset.tone).toBe("warn");
        expect(findByTestId(popover, "ai-context-detail")!.textContent).toContain("이미 넘었습니다");
      });

      it("Given 턴 진행 중 When 갱신 Then 압축·되돌리기 둘 다 잠긴다(요약 콜이 진행 중 요청과 겹친다)", () => {
        const meter = createAiContextMeter({
          read: () => snapshot({ busy: true, canUndoCompaction: true }),
          onCompact: () => undefined,
          onUndoCompaction: () => undefined,
          onToggle: () => undefined,
        });
        const popover = meter.popover as unknown as FakeElement;

        expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
        expect((findByTestId(popover, "ai-context-compact-undo") as unknown as { disabled: boolean }).disabled).toBe(true);
      });

      it("Given 되돌릴 압축이 없음 When 갱신 Then 되돌리기 버튼 자체를 숨긴다", () => {
        const meter = createAiContextMeter({
          read: () => snapshot(),
          onCompact: () => undefined,
          onUndoCompaction: () => undefined,
          onToggle: () => undefined,
        });

        expect(findByTestId(meter.popover as unknown as FakeElement, "ai-context-compact-undo")!.hidden).toBe(true);
      });

      it("Given 버튼 클릭 When 콜백 Then 압축·되돌리기·열기 신호가 각각 나간다", () => {
        const calls: string[] = [];
        const meter = createAiContextMeter({
          read: () => snapshot({ canUndoCompaction: true }),
          onCompact: () => calls.push("compact"),
          onUndoCompaction: () => calls.push("undo"),
          onToggle: () => calls.push("toggle"),
        });
        const popover = meter.popover as unknown as FakeElement;

        (meter.button as unknown as HTMLElement).click();
        (findByTestId(popover, "ai-context-compact") as unknown as HTMLElement).click();
        (findByTestId(popover, "ai-context-compact-undo") as unknown as HTMLElement).click();

        expect(calls).toEqual(["toggle", "compact", "undo"]);
      });
    });
  });
  describe("aiConversation", () => {
    isolateTimers();
    // test/aiConversationHistoryModal.test.ts
    // 저장된 대화 목록 모달 — 정렬/검색 순수 함수 + 맵 필터/열기/삭제/페이지/복구.
    describe("aiConversationHistoryModal", () => {
      isolateTimers();
      let restoreDom: (() => void) | null = null;
      const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
      const KNOWN_MAPS = [
        { id: "map_a", name: "광장" },
        { id: "map_b", name: "숲길" },
      ] as const;
      function installMemoryStorage(): void {
        const values = new Map<string, string>();
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          writable: true,
          value: {
            get length() {
              return values.size;
            },
            clear: () => values.clear(),
            getItem: (key: string) => values.get(key) ?? null,
            key: (index: number) => Array.from(values.keys())[index] ?? null,
            removeItem: (key: string) => void values.delete(key),
            setItem: (key: string, value: string) => void values.set(key, String(value)),
          },
        });
      }
      function summary(id: string, savedAt: number, projectContextKey?: string): ConversationSummary {
        return {
          id,
          title: `대화 ${id}`,
          model: "m",
          savedAt,
          turnCount: 1,
          ...(projectContextKey === undefined ? {} : { projectContextKey }),
        };
      }
      function mapContext(mapId: string, mapName = mapId): NonNullable<Extract<AuditEntry, { kind: "user" }>["context"]> {
        return { mapId, mapName, mapWidth: 20, mapHeight: 15 };
      }
      function record(
        id: string,
        savedAt: number,
        scope?: string,
        text = `지시 ${id}`,
        mapId: string | null = "map_a",
      ): ConversationRecord {
        const entries: AuditEntry[] = [{
          kind: "user",
          text,
          ...(mapId ? { context: mapContext(mapId, mapId === "map_a" ? "광장" : mapId === "map_b" ? "숲길" : mapId) } : {}),
        }];
        return {
          id,
          title: deriveTitle(entries),
          model: "m",
          savedAt,
          entries,
          ...(scope === undefined ? {} : { projectContextKey: scope }),
        };
      }
      function openModal(
        overrides: Partial<Parameters<typeof openAiConversationHistoryModal>[0]> = {},
      ): FakeElement {
        const onOpen = overrides.onOpen ?? (() => undefined);
        return openAiConversationHistoryModal({
          scopeKey: "mine",
          currentConversationId: "none",
          currentMapId: "map_a",
          knownMaps: KNOWN_MAPS,
          ...overrides,
          onOpen,
        }) as unknown as FakeElement;
      }
      function click(root: FakeElement, testId: string): void {
        const node = findByTestId(root, testId);
        expect(node, testId).not.toBeNull();
        (node as unknown as HTMLElement).click();
      }
      function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
        let resolve!: (value: T) => void;
        const promise = new Promise<T>((done) => { resolve = done; });
        return { promise, resolve };
      }
      beforeEach(async () => {
        installMemoryStorage();
        resetAiRecordDbForTest();
        await clearConversations();
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        closeAiConversationHistoryModal();
        restoreDom?.();
        restoreDom = null;
        if (originalLocalStorage) Object.defineProperty(globalThis, "localStorage", originalLocalStorage);
        else Reflect.deleteProperty(globalThis, "localStorage");
        vi.restoreAllMocks();
      });
      describe("sortConversationsForScope", () => {
        it("Given 내 프로젝트와 남의 프로젝트가 섞임 When 정렬 Then 내 것이 먼저, 그 안에서 최근 순", () => {
          const sorted = sortConversationsForScope(
            [summary("old-mine", 100, "mine"), summary("foreign", 900, "other"), summary("new-mine", 500, "mine")],
            "mine",
          );

          expect(sorted.map((row) => row.id)).toEqual(["new-mine", "old-mine", "foreign"]);
        });

        it("Given 스코프 미기록 대화 When 정렬 Then 남의 것과 같은 뒤쪽으로 간다(내 것으로 위장하지 않는다)", () => {
          const sorted = sortConversationsForScope([summary("unscoped", 900), summary("mine", 100, "mine")], "mine");

          expect(sorted.map((row) => row.id)).toEqual(["mine", "unscoped"]);
        });
      });
      describe("filterConversationsByTitle", () => {
        const rows = [summary("a", 1), summary("B", 2)];

        it("Given 빈 검색어 When 필터 Then 전부 남는다", () => {
          expect(filterConversationsByTitle(rows, "   ")).toHaveLength(2);
        });

        it("Given 대소문자 다른 부분 문자열 When 필터 Then 대소문자를 무시하고 찾는다", () => {
          expect(filterConversationsByTitle(rows, "b").map((row) => row.id)).toEqual(["B"]);
        });

        it("Given 없는 제목 When 필터 Then 빈 목록", () => {
          expect(filterConversationsByTitle(rows, "없음")).toHaveLength(0);
        });
      });
      describe("모달 렌더", () => {
        it("Given 저장된 대화 2건 When 열기 Then 현재-맵 필터가 켜지고 행 2개가 최근 순으로 렌더된다", async () => {
          await saveConversation(record("old", 1_000, "mine", "오래된 지시"));
          await saveConversation(record("new", 2_000, "mine", "최근 지시"));

          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();

          expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
          const list = findByTestId(backdrop, "ai-history-list")!;
          const rows = list.querySelectorAll("[data-testid=ai-history-row]");
          expect(rows).toHaveLength(2);
          expect(rows[0]!.textContent).toContain("최근 지시");
        });

        it("Given 저장된 대화 없음 When 열기 Then 빈 상태가 오고 전역 부재를 주장하지 않는다", async () => {
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();

          expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
          expect(findByTestId(backdrop, "ai-history-empty")!.textContent).not.toMatch(/어디에도|anywhere/i);
          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
        });

        it("Given 행 클릭 When 열기 Then 기록 전체(record)가 호출자에게 전달되고 모달이 닫힌다", async () => {
          await saveConversation(record("target", 1_000, "mine", "우물을 놔줘"));
          const opened: ConversationRecord[] = [];
          const backdrop = openModal({ onOpen: (row) => opened.push(row) });
          await whenAiConversationHistoryModalSettled();

          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();

          expect(opened).toHaveLength(1);
          expect(opened[0]!.id).toBe("target");
          expect(opened[0]!.entries[0]).toMatchObject({ kind: "user", text: "우물을 놔줘" });
          expect(backdrop.parentElement).toBeNull();
        });

        it("Given 지금 열려 있는 대화 When 렌더 Then 「현재」로 표시하고 클릭을 무시한다", async () => {
          await saveConversation(record("current", 1_000, "mine"));
          const opened: ConversationRecord[] = [];
          const backdrop = openModal({
            currentConversationId: "current",
            onOpen: (row) => opened.push(row),
          });
          await whenAiConversationHistoryModalSettled();

          const open = findByTestId(backdrop, "ai-history-open")!;
          expect(open.getAttribute("aria-disabled")).toBe("true");
          expect(open.textContent).toContain("현재");
          (open as unknown as HTMLElement).click();
          await whenAiConversationHistoryModalSettled();
          expect(opened).toHaveLength(0);
        });

        it.each([new Error("ARCHIVE_READ_FAILURE"), null])("keeps a failed archive open recoverable after listing: %s", async (failure) => {
          const target = record("read-failure", 1_000, "mine", "READ_FAILURE_TARGET");
          await saveConversation(target);
          const onOpen = vi.fn();
          const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
          await whenAiConversationHistoryModalSettled();
          const open = findByTestId(backdrop, "ai-history-open")!;
          expect(open).not.toBeNull();
          // Listing succeeds; only the subsequent full-record read fails once.
          vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(failure);

          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();

          expect(onOpen).not.toHaveBeenCalled();
          expect(backdrop.parentElement).not.toBeNull();
          const status = findByTestId(backdrop, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("error");
          expect(status.hidden).toBe(false);
          expect(status.textContent?.trim().length).toBeGreaterThan(0);
          if (failure instanceof Error) expect(status.textContent).toContain(failure.message);
          expect(findByTestId(backdrop, "ai-history-open")).toBe(open);
          expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);

          // The same control retries the real store read without dismissing the error first.
          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();
          expect(onOpen).toHaveBeenCalledTimes(1);
          expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
          expect(backdrop.parentElement).toBeNull();
        });

        it("reports a record removed after listing without adopting or silently losing it", async () => {
          await saveConversation(record("removed-after-list", 1_000, "mine"));
          const onOpen = vi.fn();
          const backdrop = openModal({ currentConversationId: "active-conversation", onOpen });
          await whenAiConversationHistoryModalSettled();
          await conversations.deleteConversationForScope("removed-after-list", "mine");

          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();

          expect(onOpen).not.toHaveBeenCalled();
          expect(backdrop.parentElement).not.toBeNull();
          const status = findByTestId(backdrop, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("error");
          expect(status.hidden).toBe(false);
          expect(status.textContent?.trim().length).toBeGreaterThan(0);
          expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
          expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
          expect(findByTestId(backdrop, "ai-history-recover")!.disabled).toBe(false);
        });

        it.each(["close", "replace"] as const)("suppresses a late archive read failure after modal %s", async (boundary) => {
          await saveConversation(record("late-failure", 1_000, "mine"));
          const onOpen = vi.fn();
          const backdrop = openModal({ onOpen });
          await whenAiConversationHistoryModalSettled();
          let rejectLoad!: (reason: Error) => void;
          const load = new Promise<ConversationRecord | null>((_resolve, reject) => { rejectLoad = reject; });
          const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load);
          click(backdrop, "ai-history-open");
          expect(read).toHaveBeenCalledWith("late-failure", "mine");
          const replacement = boundary === "replace" ? openModal({ scopeKey: "other", onOpen }) : null;
          if (boundary === "close") closeAiConversationHistoryModal();
          rejectLoad(new Error("STALE_ARCHIVE_READ_FAILURE"));
          await whenAiConversationHistoryModalSettled();

          expect(onOpen).not.toHaveBeenCalled();
          expect(backdrop.parentElement).toBeNull();
          for (const root of replacement ? [backdrop, replacement] : [backdrop]) {
            const status = findByTestId(root, "ai-history-recover-status")!;
            expect(status.dataset.state).toBe("idle");
            expect(status.hidden).toBe(true);
            expect(status.textContent).not.toContain("STALE_ARCHIVE_READ_FAILURE");
          }
          if (replacement) expect(replacement.parentElement).not.toBeNull();
        });

        it("Given 다른 프로젝트의 대화 When 모든 필터 Then 나열되지 않는다", async () => {
          await saveConversation(record("foreign", 1_000, "other"));
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-all");
          await whenAiConversationHistoryModalSettled();

          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(0);
          expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        });

        it("Given 삭제 클릭 When 목록 갱신 Then 저장소에서도 지워진다", async () => {
          await saveConversation(record("doomed", 1_000, "mine"));
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();

          click(backdrop, "ai-history-delete");
          await whenAiConversationHistoryModalSettled();

          expect(await listConversations()).toHaveLength(0);
          expect(findByTestId(backdrop, "ai-history-empty")).not.toBeNull();
        });

        it("Given 검색어 입력 When 목록 갱신 Then 제목이 맞는 행만 남는다", async () => {
          await saveConversation(record("a", 1_000, "mine", "우물 배치"));
          await saveConversation(record("b", 2_000, "mine", "상점 배치"));
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          const search = findByTestId(backdrop, "ai-history-search") as unknown as HTMLInputElement & FakeElement;

          search.value = "우물";
          search.dispatchEvent(new Event("input"));
          await whenAiConversationHistoryModalSettled();

          const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
          expect(rows).toHaveLength(1);
          expect(rows[0]!.textContent).toContain("우물");
        });

        it("Given A 기원과 B 대상 대화 When 현재 맵 A Then 둘 다 전체 대화로 보이고 B 전용은 숨는다", async () => {
          await saveConversation(record("origin-a", 1_000, "mine", "광장 우물", "map_a"));
          await saveConversation({
            ...record("target-a", 2_000, "mine", "숲에서 광장을 칠함", "map_b"),
            entries: [
              { kind: "user", text: "숲에서 광장을 칠함", context: mapContext("map_b", "숲길") },
              { kind: "tool", name: "paint_tiles", args: { mapId: "map_a" }, ok: true, summary: "painted A" },
            ],
          });
          await saveConversation(record("only-b", 3_000, "mine", "숲길만", "map_b"));

          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          const rows = findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]");
          const text = [...rows].map((row) => row.textContent ?? "").join("\n");
          expect(text).toContain("광장 우물");
          expect(text).toContain("숲에서 광장을 칠함");
          expect(text).not.toContain("숲길만");
        });

        it("Given 맵 필드 없는 대화 When 출처 없음 Then 그것만 보이고 삭제된 맵 id 는 선택 가능하다", async () => {
          await saveConversation(record("unknown", 1_000, "mine", "옛 기록", null));
          await saveConversation(record("gone", 2_000, "mine", "허물어진 다리", "map_gone"));

          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-unknown");
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("옛 기록");
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("허물어진 다리");

          click(backdrop, "ai-history-filter-all");
          await whenAiConversationHistoryModalSettled();
          const gone = backdrop.querySelector('[data-map-id="map_gone"]');
          expect(gone).not.toBeNull();
          (gone as unknown as HTMLElement).click();
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("허물어진 다리");
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("옛 기록");
        });

        it("selects an older deleted map from the complete 201-record archive before paging", async () => {
          const target = record("old-deleted-map", 1, "mine", "OLDER_DELETED_MAP", "map_gone");
          expect((await saveConversation(target)).ok).toBe(true);
          for (let index = 0; index < 200; index += 1) {
            expect((await saveConversation(record(`new-a-${index}`, 1_000 + index, "mine"))).ok).toBe(true);
          }
          expect((await conversations.queryConversationArchive({ projectContextKey: "mine" })).total).toBe(201);
          const onOpen = vi.fn();
          const backdrop = openModal({ onOpen });
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-filter-current")!.getAttribute("aria-pressed")).toBe("true");
          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
            AI_HISTORY_ARCHIVE_PAGE_SIZE,
          );
          const gone = backdrop.querySelector('[data-map-id="map_gone"]');
          expect(gone).not.toBeNull();
          (gone as unknown as HTMLElement).click();
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(1);
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("OLDER_DELETED_MAP");
          expect(onOpen).not.toHaveBeenCalled();
          click(backdrop, "ai-history-open");
          await whenAiConversationHistoryModalSettled();
          expect(onOpen).toHaveBeenCalledTimes(1);
          expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: target.id, entries: target.entries }));
        });

        it("Given 페이지 크기보다 많은 기록 When 더 보기 Then 다음 페이지가 붙는다", async () => {
          for (let index = 0; index < AI_HISTORY_ARCHIVE_PAGE_SIZE + 1; index += 1) {
            await saveConversation(record(`page-${index}`, 1_000 + index, "mine", `페이지 ${index}`));
          }
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
            AI_HISTORY_ARCHIVE_PAGE_SIZE,
          );
          click(backdrop, "ai-history-load-more");
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.querySelectorAll("[data-testid=ai-history-row]")).toHaveLength(
            AI_HISTORY_ARCHIVE_PAGE_SIZE + 1,
          );
        });

        it("Given 압축·일부 출처 When 렌더 Then 표시가 붙는다", async () => {
          await saveConversation({
            ...record("partial", 1_000, "mine", "일부 출처"),
            entries: [
              { kind: "user", text: "일부 출처", context: mapContext("map_a", "광장") },
              { kind: "status", text: CONVERSATION_TRIM_MARKER },
              { kind: "assistant", text: "잘린 인자", toolCalls: [{ name: "paint_tiles", args: "{not-json" }] },
            ],
          });
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-compacted")).not.toBeNull();
          expect(findByTestId(backdrop, "ai-history-attribution")?.dataset.attribution).toBe("partial");
        });

        it("Given 복구 실패 When 가져오기 Then error 상태이고 목록을 성공으로 바꾸지 않는다", async () => {
          const hydrate = vi.spyOn(conversations, "hydrateConversationArchive").mockRejectedValue(new Error("transport down"));
          const backdrop = openModal();
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-recover");
          await whenAiConversationHistoryModalSettled();
          const status = findByTestId(backdrop, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("error");
          expect(status.textContent).toContain("transport down");
          expect(hydrate).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: "mine" }));
        });

        it("Given 닫힌 모달 When 늦은 열기 응답 Then onOpen 을 부르지 않는다", async () => {
          await saveConversation(record("late", 1_000, "mine", "늦은 열기"));
          let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
          vi.spyOn(conversations, "loadConversationForScope").mockImplementation(
            () => new Promise((resolve) => {
              resolveLoad = resolve;
            }),
          );
          const opened: ConversationRecord[] = [];
          const backdrop = openModal({ onOpen: (row) => opened.push(row) });
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-open");
          closeAiConversationHistoryModal();
          resolveLoad?.(record("late", 1_000, "mine", "늦은 열기"));
          await whenAiConversationHistoryModalSettled();
          expect(opened).toHaveLength(0);
        });

        it("Given 필터 전환 When 목록만 바뀜 Then onOpen 은 호출되지 않는다", async () => {
          await saveConversation(record("keep", 1_000, "mine"));
          const opened: ConversationRecord[] = [];
          const backdrop = openModal({ onOpen: (row) => opened.push(row) });
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-all");
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-unknown");
          await whenAiConversationHistoryModalSettled();
          expect(opened).toHaveLength(0);
          expect(findByTestId(backdrop, "ai-history-modal")).not.toBeNull();
        });

        it("Given an unscoped retained record When the legacy view is opened Then the transcript is readable without adopting it", async () => {
          // Break: every modal filter queries the captured project scope, so projectContextKey-less
          // records stay in the archive but cannot be selected or read.
          const legacyUser = "LEGACY_UNSCOPED_USER";
          const legacyAssist = "LEGACY_UNSCOPED_ASSIST";
          await saveConversation({
            id: "legacy-unscoped",
            title: legacyUser,
            model: "m",
            savedAt: 500,
            entries: [
              { kind: "user", text: legacyUser, context: { mapId: "map_a", mapName: "옛 광장", mapWidth: 20, mapHeight: 15 } },
              { kind: "assistant", text: legacyAssist },
            ],
          });
          await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
          const onOpen = vi.fn();
          const hydrate = vi.spyOn(conversations, "hydrateConversationArchive");
          const backdrop = openModal({ currentConversationId: "active-now", onOpen });
          await whenAiConversationHistoryModalSettled();

          expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);
          click(backdrop, "ai-history-filter-all");
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain(legacyUser);

          click(backdrop, "ai-history-filter-legacy");
          await whenAiConversationHistoryModalSettled();

          expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
          expect(findByTestId(backdrop, "ai-history-filter-all")!.getAttribute("aria-pressed")).toBe("false");
          const list = findByTestId(backdrop, "ai-history-list")!;
          expect(list.textContent).toContain(legacyUser);
          expect(list.textContent).not.toContain("CURRENT_PROJECT_TURN");
          expect(list.textContent).toContain("map_a");
          expect(list.textContent).not.toContain("광장");
          expect(findByTestId(backdrop, "ai-history-open")).toBeNull();
          expect(findByTestId(backdrop, "ai-history-delete")).toBeNull();
          expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);
          expect(hydrate).not.toHaveBeenCalled();

          click(backdrop, "ai-history-legacy-inspect");
          await whenAiConversationHistoryModalSettled();
          const body = findByTestId(backdrop, "ai-history-legacy-body")!;
          expect(body.textContent).toContain(legacyUser);
          expect(body.textContent).toContain(legacyAssist);
          expect(onOpen).not.toHaveBeenCalled();
          expect((await conversations.loadConversation("legacy-unscoped"))?.projectContextKey).toBeUndefined();
          expect(backdrop.parentElement).not.toBeNull();
        });

        it.each(["open", "delete"] as const)("blocks stale scoped %s during a deferred legacy transition", async (action) => {
          const target = record("transition-target", 1_000, "mine");
          await saveConversation(target);
          await saveConversation(record("transition-legacy", 500));
          const onOpen = vi.fn();
          const backdrop = openModal({ onOpen });
          await whenAiConversationHistoryModalSettled();
          const staleAction = findByTestId(backdrop, `ai-history-${action}`)!;
          expect(staleAction).not.toBeNull();
          const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
          const query = deferred<typeof legacyResult>();
          const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);
          const read = vi.spyOn(conversations, "loadConversationForScope");
          const remove = vi.spyOn(conversations, "deleteConversationForScope");

          click(backdrop, "ai-history-filter-legacy");
          const pendingActions = backdrop.querySelectorAll("[data-testid=ai-history-open], [data-testid=ai-history-delete]");
          // Retained controls must also reject invocation, even after they leave the DOM.
          (staleAction as unknown as HTMLElement).click();
          query.resolve(legacyResult);
          await whenAiConversationHistoryModalSettled();

          expect.soft(pendingActions).toHaveLength(0);
          expect.soft(read).not.toHaveBeenCalled();
          expect.soft(remove).not.toHaveBeenCalled();
          expect.soft(onOpen).not.toHaveBeenCalled();
          expect.soft(await conversations.loadConversation(target.id)).toMatchObject(target);
          expect(backdrop.parentElement).not.toBeNull();
          expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
          expect(findByTestId(backdrop, "ai-history-filter-legacy")!.getAttribute("aria-pressed")).toBe("true");
          expect(findByTestId(backdrop, "ai-history-legacy-inspect")).not.toBeNull();
        });

        it.each([false, true])("invalidates pending scoped Open on legacy transition (return to scoped: %s)", async (returnToScoped) => {
          const target = record("transition-pending-open", 1_000, "mine");
          await saveConversation(target);
          const onOpen = vi.fn();
          const backdrop = openModal({ onOpen });
          await whenAiConversationHistoryModalSettled();
          const load = deferred<ConversationRecord | null>();
          const read = vi.spyOn(conversations, "loadConversationForScope").mockReturnValueOnce(load.promise);
          const legacyResult = await conversations.queryConversationArchive({ projectContextKey: null });
          const query = deferred<typeof legacyResult>();
          const queried = vi.spyOn(conversations, "queryConversationArchive").mockReturnValueOnce(query.promise);

          click(backdrop, "ai-history-open");
          click(backdrop, "ai-history-filter-legacy");
          if (returnToScoped) click(backdrop, "ai-history-filter-all");
          query.resolve(legacyResult);
          load.resolve(target);
          await whenAiConversationHistoryModalSettled();

          expect(read).toHaveBeenCalledWith(target.id, "mine");
          expect(queried).toHaveBeenCalledWith(expect.objectContaining({ projectContextKey: null }));
          expect(onOpen).not.toHaveBeenCalled();
          expect(backdrop.parentElement).not.toBeNull();
          expect(findByTestId(backdrop, "ai-history-recover-status")!.dataset.state).toBe("idle");
          if (returnToScoped) {
            // A fresh scoped invocation still works after the abandoned read completes.
            click(backdrop, "ai-history-open");
            await whenAiConversationHistoryModalSettled();
            expect(onOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: target.id }));
            expect(backdrop.parentElement).toBeNull();
          }
        });

        it("keeps a failed legacy inspect recoverable without adopting", async () => {
          await saveConversation({
            id: "legacy-retry",
            title: "LEGACY_RETRY_USER",
            model: "m",
            savedAt: 500,
            entries: [
              { kind: "user", text: "LEGACY_RETRY_USER" },
              { kind: "assistant", text: "LEGACY_RETRY_ASSIST" },
            ],
          });
          const onOpen = vi.fn();
          const backdrop = openModal({ currentConversationId: "active-now", onOpen });
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-legacy");
          await whenAiConversationHistoryModalSettled();
          vi.spyOn(conversations, "loadConversationForScope").mockRejectedValueOnce(new Error("LEGACY_READ_FAILURE"));

          click(backdrop, "ai-history-legacy-inspect");
          await whenAiConversationHistoryModalSettled();

          expect(onOpen).not.toHaveBeenCalled();
          expect(backdrop.parentElement).not.toBeNull();
          expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
          const status = findByTestId(backdrop, "ai-history-recover-status")!;
          expect(status.dataset.state).toBe("error");
          expect(status.textContent).toContain("LEGACY_READ_FAILURE");
          expect(findByTestId(backdrop, "ai-history-recover")!.hidden).toBe(true);

          click(backdrop, "ai-history-legacy-inspect");
          await whenAiConversationHistoryModalSettled();
          expect(findByTestId(backdrop, "ai-history-legacy-body")!.textContent).toContain("LEGACY_RETRY_ASSIST");
          expect(onOpen).not.toHaveBeenCalled();
          expect((await conversations.loadConversation("legacy-retry"))?.projectContextKey).toBeUndefined();
        });

        it("does not paint a late legacy inspect onto the current-project list", async () => {
          await saveConversation({
            id: "legacy-stale",
            title: "LEGACY_STALE_USER",
            model: "m",
            savedAt: 500,
            entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
          });
          await saveConversation(record("mine-now", 2_000, "mine", "CURRENT_PROJECT_TURN"));
          const onOpen = vi.fn();
          const backdrop = openModal({ onOpen });
          await whenAiConversationHistoryModalSettled();
          click(backdrop, "ai-history-filter-legacy");
          await whenAiConversationHistoryModalSettled();
          let resolveLoad: ((value: ConversationRecord | null) => void) | undefined;
          vi.spyOn(conversations, "loadConversationForScope").mockImplementationOnce(
            () => new Promise((resolve) => { resolveLoad = resolve; }),
          );
          click(backdrop, "ai-history-legacy-inspect");
          click(backdrop, "ai-history-filter-all");
          resolveLoad?.({
            id: "legacy-stale",
            title: "LEGACY_STALE_USER",
            model: "m",
            savedAt: 500,
            entries: [{ kind: "user", text: "LEGACY_STALE_USER" }, { kind: "assistant", text: "LEGACY_STALE_ASSIST" }],
          });
          await whenAiConversationHistoryModalSettled();

          expect(onOpen).not.toHaveBeenCalled();
          expect(findByTestId(backdrop, "ai-history-legacy-body")).toBeNull();
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).toContain("CURRENT_PROJECT_TURN");
          expect(findByTestId(backdrop, "ai-history-list")!.textContent).not.toContain("LEGACY_STALE_USER");
        });
      });
    });
    describe("aiConversationLog", () => {
      isolateTimers();
      function makeLog(): {
        readonly log: HTMLElement;
        readonly host: ReturnType<typeof createConversationLogHost>;
      } {
        const log = document.createElement("div");
        const host = createConversationLogHost({
          log,
          removeStartScreen: () => undefined,
        });
        return { log, host };
      }
      describe("conversation log command rows", () => {
        let restoreDom: (() => void) | null = null;

        beforeEach(() => {
          restoreDom = installFakeDom();
          store.replace(createBlankProject());
        });

        afterEach(() => {
          restoreDom?.();
          restoreDom = null;
        });

        it("records a user+assistant turn as two command rows and zero chat bubbles", () => {
          // Break: appendConversationBubble still assigns ai-chat-bubble / ai-chat-user.
          const { log, host } = makeLog();

          host.renderConversationEntry({ kind: "user", text: "호수 만들어줘" });
          host.renderConversationEntry({ kind: "assistant", text: "초안입니다." });

          expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(2);
          expect(log.querySelectorAll(".ai-chat-user")).toHaveLength(0);
          expect(log.querySelectorAll(".ai-chat-assistant")).toHaveLength(0);
          expect(findByTestId(log as unknown as FakeElement, "ai-command-row-user")?.textContent).toContain("호수 만들어줘");
          expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toContain("초안입니다.");
        });

        it("prefixes each human-log row with @>", () => {
          // Break: the row is emitted without an @> prefix node.
          const { log, host } = makeLog();

          host.appendBubble("user", "길 깔아줘");
          host.appendBubble("system", "오류: 키 없음");

          const prefixes = log.querySelectorAll(".ai-command-prefix");
          expect(prefixes).toHaveLength(2);
          expect(prefixes[0]?.textContent).toBe("@>");
          expect(prefixes[1]?.textContent).toBe("@>");
        });

        it("streams tokens into the last command row in place", () => {
          // Break: each stream token creates another ai-command-row instead of mutating the last body.
          const { log, host } = makeLog();

          const streamed = host.appendBubble("assistant", "");
          streamed.textContent = `${streamed.textContent ?? ""}헬`;
          streamed.textContent = `${streamed.textContent ?? ""}로`;

          expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
          expect(streamed.textContent).toBe("헬로");
          expect(findByTestId(log as unknown as FakeElement, "ai-command-row-assistant")?.textContent).toBe("헬로");
        });

        it("keeps markdown rendering inside the command row", () => {
          // Break: assistant markdown is rendered as a sibling bubble, not inside the row.
          const { log, host } = makeLog();

          host.appendBubble("assistant", "**초안**입니다");

          const row = log.querySelector("[data-testid=ai-command-row]");
          expect(row?.querySelector(".md")).toBeTruthy();
          expect(row?.querySelector("strong")?.textContent).toBe("초안");
        });

        it("tool lines leave the log entirely — they are handed to the work sink (방향 G)", () => {
          // Break: appendToolLine attaches ai-tool-activity to the command row again.
          const log = document.createElement("div");
          const received: HTMLElement[] = [];
          const host = createConversationLogHost({
            log,
            removeStartScreen: () => undefined,
            workSink: {
              appendToolEntry: (entry) => void received.push(entry),
              noteReadOnlyTool: () => undefined,
              appendCard: () => undefined,
            },
          });

          host.appendBubble("user", "길 깔아줘");
          const entry = host.appendToolLine("paint_road", { ok: true, summary: "길을 그렸습니다" }, undefined, { live: true });

          expect(entry).not.toBeNull();
          expect(received).toEqual([entry]);
          expect(findByTestId(log as unknown as FakeElement, "ai-tool-activity")).toBeNull();
          expect(findByTestId(log as unknown as FakeElement, "ai-tool-entry")).toBeNull();
          expect(log.querySelectorAll("[data-testid=ai-command-row]")).toHaveLength(1);
        });

        it("attaches a tile grid to the last command row instead of a bubble", () => {
          // Break: appendTileGrid still wraps the grid in ai-chat-bubble.
          const { log, host } = makeLog();

          host.appendBubble("assistant", "격자");
          host.appendTileGrid({
            // New projects no longer carry the EasyRPG combined_town sheet (2026-10-07 purge); use the default tileset.
            tilesetId: DEFAULT_TILESET_ID,
            x: 0,
            y: 0,
            w: 1,
            h: 1,
            lower: [[0]],
            upper: [[-1]],
          });

          const grid = findByTestId(log as unknown as FakeElement, "ai-bubble-tile-grid");
          const row = log.querySelector("[data-testid=ai-command-row]");
          expect(grid).toBeTruthy();
          expect(grid?.className).not.toContain("ai-chat-bubble");
          expect(row?.contains(grid as unknown as Node)).toBe(true);
        });
      });
      describe("작업 행 — 한국어 라벨 · 조회는 개수만 · 복원 경로 표시 (데크 2026-09-03 → 띠 2026-09-17)", () => {
        let restoreDom: (() => void) | null = null;
        beforeEach(() => {
          restoreDom = installFakeDom();
          store.replace(createBlankProject());
        });
        afterEach(() => {
          restoreDom?.();
          restoreDom = null;
        });

        function makeHost(renderChip?: Parameters<typeof createConversationLogHost>[0]["renderChip"]) {
          const log = document.createElement("div");
          const entries: Array<{ entry: HTMLElement; live: boolean; name: string }> = [];
          const reads: Array<{ name: string; live: boolean }> = [];
          const host = createConversationLogHost({
            log,
            removeStartScreen: () => undefined,
            workSink: {
              appendToolEntry: (entry, meta) => void entries.push({ entry, live: meta.live, name: meta.name }),
              noteReadOnlyTool: (name, live) => void reads.push({ name, live }),
              appendCard: () => undefined,
            },
            ...(renderChip ? { renderChip } : {}),
          });
          return { log, host, entries, reads };
        }

        it("라이브 행은 한국어 라벨 + 요약 + 상태이고, 함수 이름은 title 로 내려간다", () => {
          // Break: 행이 `✓ place_npc …` 한 줄 텍스트로 돌아가거나 라벨이 함수 이름 그대로다.
          const { host, entries } = makeHost();
          host.appendBubble("user", "상인 세워줘");
          host.appendToolLine("place_npc", { ok: true, summary: "상인 「두리」 (27,15)" }, { x: 27, y: 15 }, { live: true });
          const entry = entries[0]?.entry as unknown as FakeElement | undefined;
          expect(entry?.dataset.testid).toBe("ai-tool-entry");
          expect(entry?.querySelector(".ai-act-label")?.textContent).toBe("NPC 배치");
          expect(entry?.querySelector(".ai-act-sum")?.textContent).toBe("상인 「두리」 (27,15)");
          expect(entry?.querySelector(".ai-act-status")).not.toBeNull();
          expect(entry?.getAttribute("title")).toContain("place_npc");
          expect(entry?.textContent).not.toContain("place_npc");
        });

        it("조회 툴(get_*)은 행 없이 개수만 알리고, 쓰기 툴만 행이 된다", () => {
          // Break: 조회가 단계 행으로 남아 카드가 「작업 3단계」 로 부푼다.
          const { host, entries, reads } = makeHost();
          host.appendBubble("user", "우물 놓고 상인 세워줘");
          expect(host.appendToolLine("get_map_region", { ok: true, summary: "60×45" }, { x: 0, y: 0, w: 60, h: 45 }, { live: true })).toBeNull();
          host.appendToolLine("stamp_structure", { ok: true, summary: "우물 1" }, { x: 24, y: 11 }, { live: true });
          host.appendToolLine("place_npc", { ok: true, summary: "상인 2" }, { x: 22, y: 14 }, { live: true });
          expect(reads).toEqual([{ name: "get_map_region", live: true }]);
          expect(entries.map((item) => item.name)).toEqual(["stamp_structure", "place_npc"]);
          expect(entries.every((item) => item.live)).toBe(true);
        });

        it("복원 경로(live 아님)는 live=false 로 표시돼 띠가 걸러낼 수 있다", () => {
          // Break: 복원된 대화의 툴콜이 이번 세션의 작업 카드로 쌓인다.
          const { host, entries, reads } = makeHost();
          host.appendBubble("user", "맵 좀 봐줘");
          host.appendToolLine("get_map_region", { ok: true, summary: "60×45" });
          host.appendToolLine("show_map_region", { ok: true, summary: "보임" });
          host.appendToolLine("paint_road", { ok: true, summary: "길 3칸" });
          expect(reads.map((item) => item.live)).toEqual([false, false]);
          expect(entries).toHaveLength(1);
          expect(entries[0]?.live).toBe(false);
        });

        it("renderChip 이 주어지면 행 앞에 맵 칩을 꽂고, null 이면 아이콘 칩", () => {
          // Break: 칩 훅이 무시되어 모든 행이 아이콘으로만 남는다.
          const chip = document.createElement("span");
          chip.className = "ai-act-chip";
          chip.dataset.testid = "fake-chip";
          const { host, entries } = makeHost((name) => (name === "place_npc" ? chip : null));
          host.appendBubble("user", "상인");
          host.appendToolLine("place_npc", { ok: true, summary: "상인 1" }, { x: 1, y: 1 }, { live: true });
          host.appendToolLine("configure_game_systems", { ok: true, summary: "설정" }, {}, { live: true });
          expect(findByTestId(entries[0]!.entry as unknown as FakeElement, "fake-chip")).toBe(chip);
          expect(entries[1]?.entry.querySelector(".ai-act-chip")?.className).toContain("is-icon");
        });
      });
    });
    // test/aiConversationReplay.test.ts
    // "이전 대화 이어가기" 가 모델 쪽에서도 참이 되게 하는 직렬화의 계약.
    //
    // 잠그는 것 셋:
    //  1. status 항목은 버린다(턴 수명주기 진단은 다음 턴 모델에게 소음이다).
    //  2. 상한을 넘으면 **꼬리**를 남긴다 — 앞을 남기면 "방금 무엇을 하던 중" 이 사라진다.
    //  3. 주입 메시지는 role "user" + 마커로 시작한다(압축 요약과 같은 안전 지대. tool_calls 짝을
    //     재구성하면 Gemini/Cloud Code Assist 에서 400 이다).
    describe("aiConversationReplay", () => {
      isolateTimers();
      const ENTRIES: readonly AuditEntry[] = [
        { kind: "user", text: "마을 입구에 우물을 놔줘" },
        { kind: "status", text: "tools:exposed=40" },
        { kind: "tool", name: "place_structure", args: { id: "well" }, ok: true, summary: "우물 1개 배치" },
        { kind: "assistant", text: "우물을 놨습니다." },
        { kind: "tool", name: "edit_tile", args: {}, ok: false, summary: "범위를 벗어났습니다" },
      ];
      describe("serializeAuditTranscript", () => {
        it("Given 사용자·조수·툴·상태가 섞인 기록 When 직렬화 Then 상태만 빠지고 나머지는 순서대로 남는다", () => {
          const lines = serializeAuditTranscript(ENTRIES).split("\n");

          expect(lines).toEqual([
            "[사용자] 마을 입구에 우물을 놔줘",
            "[툴 성공] place_structure: 우물 1개 배치",
            "[조수] 우물을 놨습니다.",
            "[툴 실패] edit_tile: 범위를 벗어났습니다",
          ]);
          expect(serializeAuditTranscript(ENTRIES)).not.toContain("tools:exposed");
        });

        it("Given 빈 기록 When 직렬화 Then 빈 문자열이다(주입할 것이 없다는 신호)", () => {
          expect(serializeAuditTranscript([])).toBe("");
          expect(serializeAuditTranscript([{ kind: "status", text: "x" }])).toBe("");
        });

        it("Given 공백만 있는 발화 When 직렬화 Then 줄을 만들지 않는다", () => {
          expect(serializeAuditTranscript([{ kind: "user", text: "   " }, { kind: "assistant", text: "\n" }])).toBe("");
        });

        it("Given 상한을 넘는 기록 When 직렬화 Then 최근 줄이 남고 생략 머리글이 붙는다", () => {
          const many: AuditEntry[] = Array.from({ length: 40 }, (_unused, index) => ({
            kind: "user" as const,
            text: `${index}번째 지시 ${"가".repeat(20)}`,
          }));

          const output = serializeAuditTranscript(many, 300);

          expect(output.startsWith("[앞부분 ")).toBe(true);
          expect(output).toContain("39번째 지시");
          expect(output).not.toContain("0번째 지시");
          expect(output.length).toBeLessThanOrEqual(300 + "[앞부분 00줄 생략 — 오래된 기록]\n".length);
        });

        it("Given 아주 긴 툴 요약 When 직렬화 Then 요약 1건이 200자에서 잘린다", () => {
          const output = serializeAuditTranscript([
            { kind: "tool", name: "t", args: {}, ok: true, summary: "가".repeat(500) },
          ]);

          expect(output).toContain("…");
          expect(output.length).toBeLessThan(300);
        });
      });
      describe("restoredTranscriptMessage", () => {
        it("Given 직렬화된 기록 When 메시지 생성 Then user 역할 + 마커 + 재실행 금지 문구를 담는다", () => {
          const message = restoredTranscriptMessage("[사용자] 우물");

          expect(message.role).toBe("user");
          expect(String(message.content).startsWith(RESTORED_TRANSCRIPT_MARKER)).toBe(true);
          expect(String(message.content)).toContain("다시 실행하지 마라");
          expect(String(message.content)).toContain("[사용자] 우물");
          expect(isRestoredTranscriptMessage(message)).toBe(true);
        });

        it("Given 평범한 사용자 메시지 When 판정 Then 복원 메시지가 아니다", () => {
          expect(isRestoredTranscriptMessage({ role: "user", content: "우물 놔줘" })).toBe(false);
          expect(isRestoredTranscriptMessage({ role: "system", content: RESTORED_TRANSCRIPT_MARKER })).toBe(false);
        });
      });
    });
  });
  describe("aiCreationCards", () => {
    isolateTimers();
    function run(project: Project, tool: string, args: Record<string, unknown>): Project {
      const ctx = { project };
      const result = runTool(ctx, tool, args);
      if (!result.ok) throw new Error(`${tool}: ${result.summary}`);
      return ctx.project;
    }
    describe("creation card models", () => {
      it("reads an equipment item's key stats and type from the record the tool wrote", () => {
        const before = createBlankProject();
        const after = run(before, "upsert_item", { item: { id: "item_flame_sword", name: "불꽃검", type: "weapon", price: 300, equipmentProfile: { statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 } } } });
        const item = listChangeItems(before, after).find((entry) => entry.id === "item_flame_sword")!;
        const model = creationCardModel(after, item)!;
        expect(model.title).toBe("불꽃검");
        expect(model.kindLine).toBe("장비 · 무기");
        expect(model.stats).toBe("공격 +12 · 마력 +3 · 300G");
      });

      it("gives a monster its HP/attack line", () => {
        const before = createBlankProject();
        const after = run(before, "upsert_enemy", { enemy: { id: "enemy_boss", name: "어둠 군주", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 900, maxMp: 50, attack: 40, defense: 22, mind: 30, agility: 18 } } });
        const item = listChangeItems(before, after).find((entry) => entry.kind === "enemy" && entry.id === "enemy_boss")!;
        expect(creationCardModel(after, item)!.stats).toMatch(/^HP 900 · 공격 40 · 방어 22/u);
      });

      it("marks an item whose icon is a type stand-in, and clears the mark once a fitting icon is set", () => {
        const before = createBlankProject();
        const after = run(before, "upsert_item", { item: { id: "item_lunchbox", name: "나그네 도시락", type: "medicine" } });
        const item = listChangeItems(before, after).find((entry) => entry.id === "item_lunchbox")!;
        expect(creationCardModel(after, item)!.placeholderArt).toBe(true);
        const fixed = run(after, "upsert_item", { item: { id: "item_lunchbox", iconResourceId: "cc0-jetrel-bread" } });
        expect(creationCardModel(fixed, item)!.placeholderArt).toBeUndefined();
        const tea = run(before, "upsert_item", { item: { id: "item_tea", name: "달빛 차", type: "medicine" } });
        expect(creationCardModel(tea, listChangeItems(before, tea).find((entry) => entry.id === "item_tea")!)!.placeholderArt).toBeUndefined();
      });
    });
    describe("battle music change", () => {
      it("lists the project battle track as a music item and reverts only it", () => {
        const before = createBlankProject();
        const after = { ...before, system: { ...before.system, battleBgmResourceId: "cc0-bgm-boss-test" } } as Project;
        const items = listChangeItems(before, after);
        const music = items.find((entry) => entry.kind === "music")!;
        expect(music).toMatchObject({ id: "battleBgmResourceId", change: "modified", label: "전투 음악" });
        const reverted = revertChangeItem(after, before, music);
        expect(reverted.system.battleBgmResourceId).toBe(before.system.battleBgmResourceId);
      });
    });
    describe("firstSpokenLine", () => {
      it("finds the first text line inside nested choices, with its speaker", () => {
        const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
          { kind: "choices", options: [{ text: "네", branch: [{ kind: "text", speaker: "상인", body: "\n어서 오세요!\n둘째 줄" }] }] },
        ] }] } as unknown as GameEvent;
        expect(firstSpokenLine(event)).toEqual({ speaker: "상인", text: "어서 오세요!" });
      });
    });
    describe("firstPlayedMusic", () => {
      it("finds the boss track an event plays as background music, ignoring sound effects", () => {
        const event = { id: "ev", x: 0, y: 0, pages: [{ commands: [
          { kind: "playAudio", resourceId: "cc0-se-roar", loop: false },
          { kind: "playAudio", resourceId: "cc0-bgm-boss", loop: true },
        ] }] } as unknown as GameEvent;
        expect(firstPlayedMusic(event)).toBe("cc0-bgm-boss");
      });

      it("finds the appearance an assistant-made character event wears, so the card can follow its generated chip", () => {
        const before = createBlankProject();
        const placed = run(before, "make_villager", { mapId: before.startMapId, id: "ev_smith", name: "무기점 주인 도르간", home: { x: 3, y: 3 }, dialogue: [{ text: "어서 오게." }] });
        const linked = run(placed, "generate_walk_chip", { name: "도르간", description: "dwarf weapon-shop owner with a sword", events: [{ mapId: before.startMapId, eventId: "ev_smith" }] });
        const item = listChangeItems(before, linked).find((entry) => entry.kind === "event" && entry.id === "ev_smith")!;
        const appearanceId = linked.database.characterAppearances!.find((app) => app.name === "도르간")!.id;
        expect(eventAppearanceId(linked, item)).toBe(appearanceId);
        expect(eventAppearanceId(placed, item)).toBeUndefined();
      });
    });
  });
  describe("aiDeckIcons", () => {
    isolateTimers();
    describe("aiDeckIcons — 데크 아이콘 빌더", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("아이콘은 currentColor stroke 의 svg 이고 이름을 data-icon 으로 든다", () => {
        // Break: 아이콘이 텍스트 글리프(☰·🕒)로 돌아가거나 stroke/fill 계약이 깨진다.
        const icon = deckIcon("plus");
        expect(icon.tagName.toLowerCase()).toBe("svg");
        expect(icon.getAttribute("data-icon")).toBe("plus");
        expect(icon.getAttribute("aria-hidden")).toBe("true");
        expect(icon.getAttribute("stroke")).toBe("currentColor");
        expect(icon.getAttribute("fill")).toBe("none");
        expect(icon.getAttribute("stroke-width")).toBe("1.75");
        expect(icon.getAttribute("width")).toBe("18");
        expect(icon.getAttribute("class")).toContain("ai-deck-icon");
      });

      it("크기 옵션은 width/height 를 함께 바꾼다", () => {
        // Break: size 가 width 에만 적용되거나 무시된다.
        const icon = deckIcon("clock", { size: 15 });
        expect(icon.getAttribute("width")).toBe("15");
        expect(icon.getAttribute("height")).toBe("15");
      });

      it("모든 이름에 그림(path/circle/rect) 이 하나 이상 있다", () => {
        // Break: 사전에 이름만 있고 경로가 비어 빈 사각형이 그려진다.
        for (const name of DECK_ICON_NAMES) {
          const icon = deckIcon(name);
          expect(icon.childNodes.length, name).toBeGreaterThan(0);
        }
      });
    });
  });
  describe("aiDeckRail", () => {
    isolateTimers();
    describe("aiDeckRail — 데크 상태 레일", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("이름은 「조수」 이고 헤더·얼굴 클래스는 되살리지 않는다", () => {
        // Break: 레일이 .ai-chat-header / .ai-director-* 이름을 다시 쓰면 aiPanelChrome 계약과 충돌한다.
        // 이름은 조수 하나다 — e9d308b43a 가 「AI」 에서 「조수」 로 바꿨다(머리·레일·접기 버튼이 같은 이름).
        const rail = createDeckRail();
        expect(rail.root.dataset.testid).toBe("ai-deck-rail");
        expect(rail.root.querySelector(".ai-deck-rail-name")?.textContent).toBe("조수");
        expect(rail.root.querySelector(".ai-chat-header")).toBeNull();
        expect(rail.root.querySelector(".ai-director-name")).toBeNull();
        expect(rail.root.querySelector(".ai-director-face")).toBeNull();
      });

      it("맵 맥락은 setContext 로 바뀌고 없으면 비운다", () => {
        // Break: 맵 이름이 갱신되지 않거나 null 에 「null」 글자가 남는다.
        const rail = createDeckRail();
        rail.setContext("시장 마을");
        expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("시장 마을");
        rail.setContext(null);
        expect(rail.root.querySelector(".ai-deck-rail-ctx")?.textContent).toBe("");
      });

      it("상태는 data-ai-state 하나로 점과 문장 톤이 함께 움직인다", () => {
        // Break: 점 클래스만 바뀌고 dataset 이 안 바뀌면 CSS 헤어라인·알약이 어긋난다.
        const rail = createDeckRail();
        expect(rail.root.dataset.aiState).toBe("idle");
        rail.setState("run");
        expect(rail.root.dataset.aiState).toBe("run");
        const dot = rail.root.querySelector(".ai-deck-rail-dot");
        expect(dot?.dataset.aiState).toBe("run");
        rail.setState("attention");
        expect(rail.root.dataset.aiState).toBe("attention");
        expect(dot?.dataset.aiState).toBe("attention");
      });

      it("액션 슬롯은 비어 있고 상태 슬롯은 기존 ai-status 를 받을 자리다", () => {
        // Break: 레일이 버튼을 스스로 만들면 컴포저와 두 벌이 된다 — 슬롯만 제공해야 한다.
        const rail = createDeckRail();
        expect(rail.actions.childNodes.length).toBe(0);
        const status = document.createElement("span");
        status.dataset.testid = "ai-status";
        rail.statusSlot.append(status);
        expect(rail.root.querySelector("[data-testid='ai-status']")).toBe(status);
      });

      it("상태 톤(idle/running/ok/error) → 데크 상태 사상 — 확인 필요는 톤이 아니라 패널이 직접 setState 한다", () => {
        // Break: 새 톤이 idle 로 조용히 떨어져 진행·확인 필요가 회색으로 보인다.
        expect(deckStateOfTone("idle")).toBe("idle");
        expect(deckStateOfTone("running")).toBe("run");
        expect(deckStateOfTone("ok")).toBe("done");
        expect(deckStateOfTone("error")).toBe("error");
      });
    });
  });
  describe("aiEntityMentions", () => {
    isolateTimers();
    describe("findEntityMentions", () => {
      it("finds an enemy and an item mentioned in one sentence, in text order", () => {
        const project = createBlankProject();
        project.database.enemies = [
          {
            id: "enemy_goblin",
            name: "고블린",
          } as EnemyRecord,
        ];
        project.database.items = [
          {
            id: "item_potion",
            name: "체력 물약",
          } as ItemRecord,
        ];

        const mentions = findEntityMentions(
          "상점에서 체력 물약을 사고 숲에서 고블린을 처치했다.",
          project
        );

        expect(mentions).toHaveLength(2);
        expect(mentions[0]).toEqual({
          collection: "items",
          id: "item_potion",
          name: "체력 물약",
          record: project.database.items[0],
        });
        expect(mentions[1]).toEqual({
          collection: "enemies",
          id: "enemy_goblin",
          name: "고블린",
          record: project.database.enemies[0],
        });
      });

      it("returns [] for text mentioning nothing, and [] for empty text", () => {
        const project = createBlankProject();
        project.database.enemies = [
          {
            id: "enemy_slime",
            name: "슬라임",
          } as EnemyRecord,
        ];

        expect(findEntityMentions("아무것도 일치하지 않는 문장입니다.", project)).toEqual([]);
        expect(findEntityMentions("", project)).toEqual([]);
        expect(findEntityMentions("   ", project)).toEqual([]);
      });

      it("prefers the longer name: a project with enemies named '슬라임' and '슬라임 왕' and text '슬라임 왕이 나타났다' yields exactly one mention, '슬라임 왕'", () => {
        const project = createBlankProject();
        project.database.enemies = [
          {
            id: "enemy_slime",
            name: "슬라임",
          } as EnemyRecord,
          {
            id: "enemy_king_slime",
            name: "슬라임 왕",
          } as EnemyRecord,
        ];

        const mentions = findEntityMentions("슬라임 왕이 나타났다", project);
        expect(mentions).toHaveLength(1);
        expect(mentions[0]?.name).toBe("슬라임 왕");
        expect(mentions[0]?.id).toBe("enemy_king_slime");
      });

      it("honours the limit argument", () => {
        const project = createBlankProject();
        project.database.items = [
          { id: "item_1", name: "사과 물약" } as ItemRecord,
          { id: "item_2", name: "바나나 물약" } as ItemRecord,
          { id: "item_3", name: "포도 물약" } as ItemRecord,
        ];

        const text = "사과 물약, 바나나 물약, 포도 물약 중 하나를 고르세요.";
        const mentions = findEntityMentions(text, project, 2);
        expect(mentions).toHaveLength(2);
        expect(mentions.map((m) => m.name)).toEqual(["사과 물약", "바나나 물약"]);
      });
    });
    describe("renderEntityMentionStrip", () => {
      let restoreFakeDom: (() => void) | undefined;

      afterEach(() => {
        restoreFakeDom?.();
        restoreFakeDom = undefined;
      });

      it("returns null for [] and, for two mentions, produces a container with testid ai-mention-strip holding two chips whose names match", () => {
        restoreFakeDom = installFakeDom();
        const project = createBlankProject();

        expect(renderEntityMentionStrip([], project)).toBeNull();

        const mentions: EntityMention[] = [
          {
            collection: "enemies",
            id: "enemy_1",
            name: "불도깨비",
            record: { id: "enemy_1", name: "불도깨비" } as EnemyRecord,
          },
          {
            collection: "items",
            id: "item_1",
            name: "마나 포션",
            record: { id: "item_1", name: "마나 포션" } as ItemRecord,
          },
        ];

        const node = renderWithFakeDom(() =>
          renderEntityMentionStrip(mentions, project)!
        ) as FakeElement;

        expect(node).not.toBeNull();
        expect(node.dataset.testid).toBe("ai-mention-strip");
        expect(node.getAttribute("role")).toBe("list");
        expect(node.getAttribute("aria-label")).toBe("언급된 자료");

        const chip1 = findByTestId(node, "ai-mention-enemies-enemy_1");
        const chip2 = findByTestId(node, "ai-mention-items-item_1");

        expect(chip1).not.toBeNull();
        expect(chip2).not.toBeNull();

        expect(chip1?.getAttribute("role")).toBe("listitem");
        expect(chip1?.getAttribute("title")).toBe("불도깨비");
        expect(chip1?.querySelector(".ai-mention-name")?.textContent).toBe("불도깨비");

        expect(chip2?.getAttribute("role")).toBe("listitem");
        expect(chip2?.getAttribute("title")).toBe("마나 포션");
        expect(chip2?.querySelector(".ai-mention-name")?.textContent).toBe("마나 포션");
      });
    });
    // 라이브 턴에서 실측한 오탐(2026-08-26): 기본 프로젝트에는 "map", "ale", "egg", "bell",
    // "bone", "coal" 같은 짧은 순수 ASCII 아이템 이름이 수십 개 있다. 부분 문자열 포함만으로
    // 매칭하면 어시스턴트가 "현재 맵: 이슬 장터 마을 (mapvillage30_100x100)" 이라고 말하는
    // 순간 아이템 "map" 썸네일이 붙는다 — 실제로 브라우저에서 붙는 것을 확인했다.
    // 단어 경계가 없다는 근거는 **한글에만** 해당하므로, ASCII 이름은 경계를 요구한다.
    describe("짧은 ASCII 이름 오탐", () => {
      function projectWithNames(itemNames: string[], enemyNames: string[] = []) {
        const project = createBlankProject();
        project.database.items = itemNames.map((name, i) => ({ id: `item_ascii_${i}`, name }) as ItemRecord);
        project.database.enemies = enemyNames.map((name, i) => ({ id: `enemy_ascii_${i}`, name }) as EnemyRecord);
        return project;
      }

      it('맵 id 문자열 안의 "map" 은 아이템 map 으로 보지 않는다', () => {
        const project = projectWithNames(["map"]);

        expect(findEntityMentions("현재 맵: 이슬 장터 마을 (mapvillage30_100x100)", project)).toEqual([]);
      });

      it("다른 영어 단어에 숨은 짧은 이름도 잡지 않는다", () => {
        const project = projectWithNames(["ale", "egg", "bell", "bone"]);

        const found = findEntityMentions("The female scale bellows; bones remain. eggplant.", project);

        expect(found.map((m) => m.name)).toEqual([]);
      });

      it("독립된 단어로 나오면 ASCII 이름도 정상 매칭한다", () => {
        const project = projectWithNames(["map", "ale"]);

        const found = findEntityMentions("상자에 map 과 ale 을 넣었습니다.", project);

        expect(found.map((m) => m.name).sort()).toEqual(["ale", "map"]);
      });

      it("한글 이름은 그대로 부분 문자열로 매칭한다(경계가 없으므로)", () => {
        const project = projectWithNames([], ["슬라임"]);

        expect(findEntityMentions("슬라임을 광장에 두었습니다.", project).map((m) => m.name)).toEqual(["슬라임"]);
      });
    });
  });
  // 하네스 타임라인 병합 — 사람이 누른 것과 모델이 한 것이 한 줄기로 흘러야 한다.
  //
  // 왜 필요한가: 「압축을 누른 직후 턴이 깨졌다」, 「도크를 바꾸자 답장이 사라졌다」류는 두 스트림을
  // 따로 보면 절대 안 보인다. 그리고 병합에는 조용한 함정이 하나 있다 — audit 항목 중 `at` 이 없는
  // 것들(초기 상태줄)을 빈 문자열로 정렬하면 전부 맨 앞으로 몰려 «순서가 거짓» 이 된다.
  describe("aiHarnessTimelineMerge", () => {
    isolateTimers();
    const audit: readonly AuditEntry[] = [
      { kind: "user", text: "석상 좀 고쳐줘", at: "2026-08-30T04:00:00.000Z" },
      { kind: "status", text: "phase:plan" }, // at 없음 — 직전 시각을 물려받아야 한다
      { kind: "tool", name: "set_event", args: {}, ok: true, summary: "이벤트 1건", at: "2026-08-30T04:00:10.000Z" },
    ];
    describe("mergeHarnessTimeline", () => {
      it("interleaves front actions with audit entries by time", () => {
        const merged = mergeHarnessTimeline(audit, [
          { at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" },
          { at: "2026-08-30T04:00:20.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
        ]);
        expect(
          merged.map((row) => (row.kind === "ui" ? `ui:${row.event.action}` : `audit:${row.entry.kind}`)),
        ).toEqual([
          "audit:user",
          "audit:status", // at 없는 칸이 사용자 발언 뒤에 그대로 남는다
          "ui:context-compact",
          "audit:tool",
          "ui:turn-rewind",
        ]);
      });

      it("puts the audit entry first when the timestamps tie", () => {
        // 액션의 결과가 그 액션보다 앞서 보이면 인과가 뒤집힌다.
        const merged = mergeHarnessTimeline(
          [{ kind: "status", text: "압축 완료", at: "2026-08-30T04:00:05.000Z" }],
          [{ at: "2026-08-30T04:00:05.000Z", seq: 1, surface: "context-panel", action: "context-compact" }],
        );
        expect(merged.map((row) => row.kind)).toEqual(["audit", "ui"]);
      });

      it("returns audit alone when nothing was pressed", () => {
        expect(mergeHarnessTimeline(audit, [])).toHaveLength(audit.length);
        expect(mergeHarnessTimeline([], [])).toHaveLength(0);
      });
    });
  });
  // test/aiInstructionsModal.test.ts
  // 감독 지침 편집 모달 — 저장이 **프로젝트에** 들어가고, 되돌리기 스냅샷을 남기고,
  // 세션에 알려 주는지.
  //
  // 프로젝트에 저장하는 이유(localStorage 가 아닌): 지침은 그 게임의 성질이지 이 브라우저의
  // 설정이 아니다. 프로젝트를 옮기면 규칙도 따라가야 한다.
  describe("aiInstructionsModal", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    function open(saved: string[]): FakeElement {
      return openAiInstructionsModal({ onSaved: (value) => saved.push(value) }) as unknown as FakeElement;
    }
    function typeInto(backdrop: FakeElement, value: string): void {
      const input = findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement & FakeElement;
      input.value = value;
      input.dispatchEvent(new Event("input"));
    }
    function save(backdrop: FakeElement): void {
      (findByTestId(backdrop, "ai-instructions-save") as unknown as HTMLElement).click();
    }
    beforeEach(() => {
      store.replace(createBlankProject());
      // 히스토리는 모듈 전역이다 — 리셋하지 않으면 앞 케이스가 남긴 동일 서명 스냅샷 때문에
      // pushSnapshot 의 중복 제거가 이번 케이스의 스냅샷을 삼킨다.
      resetMapEditHistory();
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      closeAiInstructionsModal();
      restoreDom?.();
      restoreDom = null;
      vi.restoreAllMocks();
    });
    describe("감독 지침 모달", () => {
      it("Given 지침 없는 프로젝트 When 열기 Then 빈 입력과 0자 카운터", () => {
        const backdrop = open([]);

        expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("");
        expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`0 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
      });

      it("Given 이미 저장된 지침 When 열기 Then 그 값이 실려 온다", () => {
        store.update((draft) => {
          draft.aiInstructions = "4방향 이동만 쓴다.";
        });

        const backdrop = open([]);

        expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("4방향 이동만 쓴다.");
      });

      it("Given 지침 입력 When 저장 Then 프로젝트에 남고 onSaved 로 알리고 모달이 닫힌다", () => {
        const saved: string[] = [];
        const backdrop = open(saved);

        typeInto(backdrop, "  타일셋 B 는 쓰지 마라.\r\n ");
        save(backdrop);

        expect(store.getCurrent().aiInstructions).toBe("타일셋 B 는 쓰지 마라.");
        expect(saved).toEqual(["타일셋 B 는 쓰지 마라."]);
        expect(backdrop.parentElement).toBeNull();
      });

      it("Given 지침 편집 When 저장 Then 되돌리기 스냅샷이 남는다(다른 프로젝트 편집과 동일)", () => {
        const before = getMapEditHistoryMarker();
        const backdrop = open([]);

        typeInto(backdrop, "전투는 턴제다.");
        save(backdrop);

        expect(getMapEditHistoryMarker()).toBeGreaterThan(before);
        expect(getMapEditHistoryState().canUndo).toBe(true);
      });

      it("Given 저장된 지침을 비움 When 저장 Then 필드가 제거된다(빈 문자열을 남기지 않는다)", () => {
        store.update((draft) => {
          draft.aiInstructions = "지울 규칙";
        });
        const saved: string[] = [];
        const backdrop = open(saved);

        typeInto(backdrop, "   ");
        save(backdrop);

        expect("aiInstructions" in store.getCurrent()).toBe(false);
        expect(saved).toEqual([""]);
      });

      it("Given 값을 바꾸지 않고 저장 When 클릭 Then 스냅샷도 onSaved 도 없다(빈 편집은 편집이 아니다)", () => {
        const before = getMapEditHistoryMarker();
        const saved: string[] = [];
        const backdrop = open(saved);

        save(backdrop);

        expect(getMapEditHistoryMarker()).toBe(before);
        expect(saved).toEqual([]);
        expect(backdrop.parentElement).toBeNull();
      });

      it("Given 상한 초과 입력 When 저장 Then 상한에서 잘려 저장된다", () => {
        const backdrop = open([]);

        typeInto(backdrop, "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 200));
        save(backdrop);

        expect(store.getCurrent().aiInstructions).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
      });

      it("Given 입력 중 When 글자 수 변화 Then 카운터가 따라온다", () => {
        const backdrop = open([]);

        typeInto(backdrop, "다섯글자");

        expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`4 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
      });

      it("Given 닫기 버튼 When 클릭 Then 저장 없이 닫힌다", () => {
        const backdrop = open([]);

        typeInto(backdrop, "저장하지 않을 값");
        (findByTestId(backdrop, "ai-instructions-close") as unknown as HTMLElement).click();

        expect(backdrop.parentElement).toBeNull();
        expect(store.getCurrent().aiInstructions).toBeUndefined();
      });
    });
  });
  // 레인 고스트 — 살아 있는 레인 전부를 한 장의 초안으로 겹쳐 캔버스 시공 표시에 넣는다.
  describe("aiLaneGhost", () => {
    isolateTimers();
    function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
    function seed(): Project {
      const ctx = { project: createBlankProject() };
      for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
        const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
        if (!result.ok) throw new Error(result.summary);
      }
      return ctx.project;
    }
    function paint(project: Project, mapId: string, x: number, y: number): Project {
      const next = clone(project);
      const map = next.maps[mapId] as GameMap;
      map.lowerTiles[y * map.width + x] = 7;
      return next;
    }
    function fakeTimers() {
      const queued: Array<() => void> = [];
      return {
        setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
        clearTimeoutFn: () => undefined,
        tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
      };
    }
    beforeEach(() => {
      resetMapEditHistory();
      clearAgentGhostPreview();
      setAgentGhostDraftMapProvider(null);
      store.replace(seed());
    });
    describe("createLaneGhostSink", () => {
      it("두 레인의 증분이 서로 다른 맵에 겹쳐 쌓이고, 한 레인을 내리면 그 맵만 사라진다", () => {
        const base = store.getCurrent();
        const timers = fakeTimers();
        const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
        sink.start("a", base);
        sink.start("b", base);
        const eastDraft = paint(base, "map_east", 3, 4);
        sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, eastDraft.maps) });
        const westDraft = paint(base, "map_west", 1, 1);
        sink.handleEvent("b", { type: "map_delta", maps: diffMapsForDelta(base.maps, westDraft.maps) });
        timers.tick();
        const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
        expect(mapIds).toEqual(["map_east", "map_west"]);
        expect(getAgentGhostDraftMap("map_east")).toBeTruthy();

        sink.drop("a");
        expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_west"]);
        expect(getAgentGhostDraftMap("map_east")).toBeUndefined();

        sink.drop("b");
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
        sink.dispose();
      });

      it("결과가 오면 초안을 결과 프로젝트로 확정하고, 검토 대기 동안 고스트가 남는다", () => {
        const base = store.getCurrent();
        const timers = fakeTimers();
        const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
        sink.start("a", base);
        sink.finish("a", paint(base, "map_east", 5, 5), ["map_east"]);
        expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
        sink.dispose();
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      });

      it("레인 B 의 결과 프로젝트(와이어를 건너온 새 객체)는 B 의 묶음 맵만 확정한다 — A 의 초안을 덮지 않는다", () => {
        const base = store.getCurrent();
        const timers = fakeTimers();
        const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
        sink.start("a", base);
        sink.start("b", base);
        sink.handleEvent("a", { type: "map_delta", maps: diffMapsForDelta(base.maps, paint(base, "map_east", 3, 4).maps) });
        timers.tick();
        // B 의 결과: 모든 맵이 복제된 새 객체이고 서쪽만 실제로 바뀌었다.
        const resultB = clone(paint(base, "map_west", 1, 1));
        sink.finish("b", resultB, ["map_west"]);
        const mapIds = getAgentGhostPreviewState().previews.map((preview) => preview.mapId).sort();
        expect(mapIds).toEqual(["map_east", "map_west"]);
        sink.dispose();
      });

      it("매니저에 꽂으면 시작·증분·완료·적용이 그대로 고스트로 이어진다", async () => {
        const timers = fakeTimers();
        const sink = createLaneGhostSink({ ...timers, throttleMs: 1 });
        const runner = async (request: PiAgentRequest, options: { onEvent?: (event: PiAgentEvent) => void }): Promise<PiAgentDoneEvent> => {
          const draft = paint(request.project, "map_east", 2, 2);
          options.onEvent?.({ type: "map_delta", maps: diffMapsForDelta(request.project.maps, draft.maps) });
          return { type: "done", project: draft, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] };
        };
        const manager = createLaneManager({ ghost: sink, runAgent: runner });
        manager.add({ id: "lane_a", label: "동쪽", mapIds: ["map_east"], agentLabel: "시공A", provider: "google-antigravity", model: "gemini-3.7-flash", instruction: "칠한다" });
        await manager.start("lane_a");
        expect(manager.get("lane_a")?.status).toBe("review");
        expect(getAgentGhostPreviewState().previews.map((preview) => preview.mapId)).toEqual(["map_east"]);
        manager.discard("lane_a");
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
        manager.dispose();
      });
    });
  });
  describe("aiMapChip", () => {
    isolateTimers();
    const ok = { ok: true, summary: "" } as const;
    describe("aiMapChip — 툴 호출에서 맵 자리를 읽는다", () => {
      it("인자의 x/y 한 칸, x/y/w/h 사각형, rect 객체를 영역으로 읽는다", () => {
        // Break: 인자 모양 하나가 빠지면 그 툴의 행이 빈 아이콘 칩으로 떨어진다.
        expect(regionFromToolCall({ x: 3, y: 4 }, ok)).toEqual({ x: 3, y: 4, width: 1, height: 1 });
        expect(regionFromToolCall({ x: 2, y: 2, w: 4, h: 6 }, ok)).toEqual({ x: 2, y: 2, width: 4, height: 6 });
        expect(regionFromToolCall({ rect: { x: 1, y: 2, w: 5, h: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
        expect(regionFromToolCall({ region: { x: 1, y: 2, width: 5, height: 3 } }, ok)).toEqual({ x: 1, y: 2, width: 5, height: 3 });
      });

      it("인자에 없으면 결과 data 의 좌표·영역을 본다", () => {
        // Break: 결과 좌표(예: 빈 자리 찾기)가 무시되어 조회 툴 행에 칩이 없다.
        expect(regionFromToolCall({}, { ...ok, data: { x: 7, y: 8 } })).toEqual({ x: 7, y: 8, width: 1, height: 1 });
        expect(regionFromToolCall(undefined, { ...ok, data: { region: { x: 0, y: 1, width: 2, height: 2 } } }))
          .toEqual({ x: 0, y: 1, width: 2, height: 2 });
      });

      it("좌표가 없거나 유효하지 않으면 null", () => {
        // Break: NaN·음수·문자열 좌표를 영역으로 만들어 렌더러가 던진다.
        expect(regionFromToolCall({ name: "두리" }, ok)).toBeNull();
        expect(regionFromToolCall({ x: "3", y: 4 }, ok)).toBeNull();
        expect(regionFromToolCall({ x: -1, y: 4 }, ok)).toBeNull();
        expect(regionFromToolCall({ x: 1, y: 1, w: 0, h: 2 }, ok)).toBeNull();
      });

      it("칩 창은 영역을 가운데 두고 최소 7×5 로 넓힌 뒤 맵 안으로 자른다", () => {
        // Break: 한 칸 영역을 그대로 그려 46×32 칩에 타일 하나가 뭉개져 보이거나, 맵 밖을 그리려 한다.
        expect(chipWindow({ x: 10, y: 10, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 7, y: 8, width: 7, height: 5 });
        expect(chipWindow({ x: 0, y: 0, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 0, y: 0, width: 7, height: 5 });
        expect(chipWindow({ x: 58, y: 44, width: 1, height: 1 }, { width: 60, height: 45 })).toEqual({ x: 53, y: 40, width: 7, height: 5 });
        // 큰 영역은 그대로 두고 여백 1칸만 더한다.
        expect(chipWindow({ x: 10, y: 10, width: 20, height: 12 }, { width: 60, height: 45 })).toEqual({ x: 9, y: 9, width: 22, height: 14 });
      });
    });
    describe("renderMapChip", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("맵이 있으면 캔버스를 비동기로 붙이고 핀을 찍는다", async () => {
        // Break: 렌더러 결과를 버리거나 핀이 없어 어디가 바뀌었는지 알 수 없다.
        const project = createBlankProject();
        const mapId = project.startMapId;
        const canvas = document.createElement("canvas");
        const chip = renderMapChip({
          project,
          mapId,
          region: { x: 3, y: 3, width: 1, height: 1 },
          renderShot: () => Promise.resolve(canvas),
        });
        expect(chip.className).toContain("ai-act-chip");
        await Promise.resolve();
        await Promise.resolve();
        expect((chip as unknown as FakeElement).childNodes).toContain(canvas);
        expect(chip.querySelector(".ai-act-pin")).not.toBeNull();
        expect(chip.dataset.region).toBe("3,3 1×1");
      });

      it("렌더가 실패하면 아이콘 칩으로 남고 예외를 밖으로 내지 않는다", async () => {
        // Break: 타일셋 로드 실패가 로그 렌더 전체를 죽인다.
        const project = createBlankProject();
        const chip = renderMapChip({
          project,
          mapId: project.startMapId,
          region: { x: 0, y: 0, width: 1, height: 1 },
          renderShot: () => Promise.reject(new Error("no tileset")),
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(chip.querySelector("canvas")).toBeNull();
        expect(chip.className).toContain("is-icon");
      });

      it("맵이 없으면 아이콘 칩", () => {
        const project = createBlankProject();
        const chip = renderMapChip({ project, mapId: "nope", region: { x: 0, y: 0, width: 1, height: 1 } });
        expect(chip.className).toContain("is-icon");
      });
    });
  });
  // aiPanelLayoutResponsive.test.ts
  // 컴포저 캡슐 폭 저장 + 뷰포트 반응형 클램프 계약.
  // 2026-08-31: 도크가 float 하나가 되면서 per-dock 키(oprn:ai-panel-size:<dock>) 3종이
  // 캡슐 폭 하나로 합쳐졌다. 낡은 float 키는 최초 1회만 읽어 사용자 폭을 물려받는다.
  // vitest 환경은 "node" — 돔 대신 storage(globalThis.localStorage)만 스텁한다.
  describe("aiPanelLayoutResponsive", () => {
    isolateTimers();
    let storage: Map<string, string>;
    function installFakeLocalStorage(): void {
      storage = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => void storage.set(key, String(value)),
          removeItem: (key: string) => void storage.delete(key),
          clear: () => storage.clear(),
        },
      });
    }
    beforeEach(() => {
      installFakeLocalStorage();
    });
    afterEach(() => {
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("clampPanelSizeToViewport", () => {
      it("작은 뷰포트에서는 폭/높이를 뷰포트의 90%로 상한을 잡는다", () => {
        // 900x900 (한계 내) → 800x700 뷰포트: width=round(800*0.9)=720, height=round(700*0.9)=630
        expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 800, height: 700 })).toEqual({
          width: 720,
          height: 630,
        });
      });

      it("아무리 작은 뷰포트라도 minWidth/minHeight 아래로 내려가지 않는다", () => {
        expect(clampPanelSizeToViewport({ width: 900, height: 900 }, { width: 200, height: 200 })).toEqual({
          width: PANEL_SIZE_LIMITS.minWidth,
          height: PANEL_SIZE_LIMITS.minHeight,
        });
      });

      it("비유효 뷰포트(0/NaN)는 뷰포트 상한 없이 clampPanelSize와 같다", () => {
        const size = { width: 500, height: 600 };
        expect(clampPanelSizeToViewport(size, { width: 0, height: NaN })).toEqual(clampPanelSize(size));
      });
    });
    describe("캡슐 폭 저장/복원", () => {
      it("저장한 폭을 그대로 왕복하고, 저장이 없으면 null 이다", () => {
        expect(loadPanelBarSize()).toBeNull();
        savePanelBarSize({ width: 560, height: 880 });
        expect(loadPanelBarSize()).toEqual({ width: 560, height: 880 });
      });

      it("낡은 float 도크 키를 물려받는다 — 도크 삭제로 사용자 폭을 잃지 않는다", () => {
        storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
        expect(loadPanelBarSize()).toEqual({ width: 620, height: 700 });
      });

      it("새 키가 있으면 낡은 float 키보다 우선한다", () => {
        storage.set("oprn:ai-panel-size:float", JSON.stringify({ width: 620, height: 700 }));
        savePanelSize({ width: 480, height: 640 });
        expect(loadPanelBarSize()).toEqual({ width: 480, height: 640 });
      });

      it("삭제된 glass/side 키는 더 이상 읽지 않는다", () => {
        storage.set("oprn:ai-panel-size:glass", JSON.stringify({ width: 400, height: 700 }));
        storage.set("oprn:ai-panel-size:side", JSON.stringify({ width: 560, height: 880 }));
        expect(loadPanelBarSize()).toBeNull();
      });

      it("저장된 쓰레기 값은 예외 없이 null을 돌려준다", () => {
        storage.set("oprn:ai-panel-size", '{"width":"wide"}');
        expect(loadPanelBarSize()).toBeNull();
      });
    });
    describe("글자 크기 스테퍼", () => {
      it("작게↔보통↔크게에서 끝은 더 나가지 않는다", () => {
        expect(stepAiFontSize("normal", 1)).toBe("large");
        expect(stepAiFontSize("large", 1)).toBe("large");
        expect(stepAiFontSize("small", -1)).toBe("small");
        expect(stepAiFontSize("large", -1)).toBe("normal");
      });
    });
  });
});

describe("editorPanelsSuite14", () => {
  isolateTimers();
  describe("aiPiGhostBridge", () => {
    isolateTimers();
    function clone<T>(value: T): T {
      return JSON.parse(JSON.stringify(value)) as T;
    }
    function seed(): Project {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "create_map", { id: "map_east", name: "동쪽", width: 20, height: 16 });
      if (!result.ok) throw new Error(result.summary);
      return ctx.project;
    }
    /** 워커가 하는 일: 프로젝트를 제자리에서 바꾸고 증분 이벤트를 만든다. */
    function workerDelta(shadow: Record<string, GameMap>, next: Record<string, GameMap>): PiAgentEvent {
      return { type: "map_delta", maps: diffMapsForDelta(shadow, next) };
    }
    /** 스로틀 타이머를 손으로 돌린다 — 실제 시간에 기대지 않는다. */
    function fakeTimers() {
      const queued: Array<() => void> = [];
      return {
        setTimeoutFn: (handler: () => void) => { queued.push(handler); return queued.length as unknown as ReturnType<typeof setTimeout>; },
        clearTimeoutFn: () => { /* 취소는 flush/cancel 이 pending 플래그로 막는다 */ },
        tick: () => { const pending = [...queued]; queued.length = 0; for (const handler of pending) handler(); },
      };
    }
    describe("aiPiGhostBridge", () => {
      beforeEach(() => {
        setAiLiveCanvasEnabled(true);
        clearAgentGhostPreview();
        setAgentGhostDraftMapProvider(null);
      });

      afterEach(() => {
        setAiLiveCanvasEnabled(true);
      });

      it("map_delta 를 받아 고스트 프리뷰를 그린다 — 턴이 끝나기 전에", () => {
        const base = seed();
        const timers = fakeTimers();
        const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent(workerDelta(base.maps, working.maps));
        timers.tick();

        const previews = getAgentGhostPreviewState().previews;
        expect(previews).toHaveLength(1);
        expect(previews[0]!.mapId).toBe("map_east");
        expect(previews[0]!.cells.some((cell) => cell.x === 2 && cell.y === 2 && cell.layer === "lower")).toBe(true);
        bridge.dispose();
      });

      it("툴마다 오는 증분이 누적된다 — 마지막 증분만 그리지 않는다", () => {
        const base = seed();
        const timers = fakeTimers();
        const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

        let shadow = clone(base.maps);
        const working = clone(base);
        for (const index of [10, 11, 12]) {
          working.maps.map_east!.lowerTiles[index] = 5;
          const event = workerDelta(shadow, working.maps);
          shadow = clone(working.maps);
          bridge.handleEvent(event);
          timers.tick();
        }

        const cells = getAgentGhostPreviewState().previews.flatMap((preview) => preview.cells);
        expect(cells.filter((cell) => cell.layer === "lower")).toHaveLength(3);
        bridge.dispose();
      });

      it("초안 맵을 공급한다 — 렌더러가 컴포지터 경로로 실제 타일을 찍을 수 있게", () => {
        const base = seed();
        const bridge = createPiGhostBridge({ baseProject: base });
        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent(workerDelta(base.maps, working.maps));

        expect(getAgentGhostDraftMap("map_east")!.lowerTiles[42]).toBe(7);
        expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);
        bridge.dispose();
        expect(getAgentGhostDraftMap("map_east")).toBeUndefined();
      });

      it("tool_start 가 실행 중 도구와 그 대상 맵을 세운다", () => {
        const base = seed();
        const bridge = createPiGhostBridge({ baseProject: base });
        bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
        expect(getAgentGhostPreviewState().runningToolName).toBe("paint_tiles");
        expect(getAgentGhostPreviewState().runningToolMapId).toBe("map_east");
        bridge.dispose();
      });

      it("팀 이벤트(agent_event)는 한 겹 벗겨서 같은 길로 흐른다", () => {
        const base = seed();
        const timers = fakeTimers();
        const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent({ type: "agent_event", agentId: "builder-1", event: workerDelta(base.maps, working.maps) });
        timers.tick();

        expect(getAgentGhostPreviewState().previews).toHaveLength(1);
        bridge.dispose();
      });

      it("done 은 밀린 증분을 즉시 그리고 실행 중 도구를 내린다 — 그림은 남는다", () => {
        const base = seed();
        const timers = fakeTimers();
        const bridge = createPiGhostBridge({ baseProject: base, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn });

        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent({ type: "tool_start", id: "1", name: "paint_tiles", args: { mapId: "map_east" } });
        bridge.handleEvent(workerDelta(base.maps, working.maps));
        // 스로틀 타이머를 돌리지 않는다 — done 이 직접 비워야 한다.
        bridge.handleEvent({ type: "done", project: working, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: ["maps.map_east"] });

        expect(getAgentGhostPreviewState().previews).toHaveLength(1);
        expect(getAgentGhostPreviewState().runningToolName).toBe("");
        bridge.dispose();
      });

      it("dispose 는 그림을 지우고 초안 공급을 끊는다 — 적용·버리기·중단이 부르는 길", () => {
        const base = seed();
        const bridge = createPiGhostBridge({ baseProject: base });
        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent(workerDelta(base.maps, working.maps));
        bridge.flush();
        expect(getAgentGhostPreviewState().previews).toHaveLength(1);

        bridge.dispose();
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
        // dispose 뒤에 늦게 도착한 이벤트는 죽은 다리를 되살리지 않는다.
        bridge.handleEvent(workerDelta(base.maps, working.maps));
        bridge.flush();
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
      });

      it("헤드리스에서는 초안만 갱신하고 맵 연출은 그리지 않는다", () => {
        setAiLiveCanvasEnabled(false);
        const base = seed();
        const bridge = createPiGhostBridge({ baseProject: base });
        const working = clone(base);
        working.maps.map_east!.lowerTiles[42] = 7;
        bridge.handleEvent(workerDelta(base.maps, working.maps));
        bridge.flush();
        expect(getAgentGhostPreviewState().previews).toHaveLength(0);
        expect(bridge.draftProject().maps.map_east!.lowerTiles[42]).toBe(7);

        setAiLiveCanvasEnabled(true);
        expect(getAgentGhostPreviewState().previews.some((preview) => preview.cells.length > 0)).toBe(true);
        bridge.dispose();
      });

      it("빈 증분은 아무것도 예약하지 않는다", () => {
        const base = seed();
        let applied = 0;
        const bridge = createPiGhostBridge({ baseProject: base, apply: () => { applied += 1; } });
        bridge.handleEvent({ type: "map_delta", maps: [] });
        bridge.flush();
        expect(applied).toBe(0);
        bridge.dispose();
      });
    });
  });
  // 승인 카드 제거 후에도 즉시 적용 경로의 soft-confirm 합의 훅이 동작하는지 고정한다.
  describe("aiProposalSoftConfirm", () => {
    isolateTimers();
    describe("soft-confirm 자동 합의", () => {
      it("proposedCalls의 vocabSoftConfirm을 수집해 즉시 origin:user로 마킹한다", () => {
        const project = createEmptyToolProject();
        const tilesetId = Object.keys(project.tilesets)[0];
        const tileset = project.tilesets[tilesetId];
        tileset.tileGroups = [...(tileset.tileGroups ?? []), {
          id: "g-soft", name: "soft 재료", role: "prop", defaultLayer: "lower",
          tileIds: [5], description: "", placementRules: "", origin: "ai",
        } as never];
        const calls = [{
          name: "place_props", args: {},
          result: { ok: true, summary: "", data: { vocabSoftConfirm: {
            kind: "group", groupId: "g-soft", tileIds: [5], name: "soft 재료", role: "prop", layerHome: "lower", tilesetId,
          } } },
        }] as never;
        expect(collectVocabSoftConfirms(calls).length).toBe(1);
        const marked = markSoftVocabApprovalsOnProject(project, calls);
        expect(marked).toBe(1);
        expect(project.tilesets[tilesetId].tileGroups?.find((g) => g.id === "g-soft")?.origin).toBe("user");
      });
    });
  });
  describe("aiStartScreenCards", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      store.replace(createBlankProject());
      restoreDom = installFakeDom({ window: true });
      const storage = new Map<string, string>();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => void storage.set(key, String(value)),
          removeItem: (key: string) => void storage.delete(key),
          clear: () => storage.clear(),
        },
      });
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        currentMapId: mapId,
        layer: "lower",
        tool: "paint",
        selection: null,
      });
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    const NOW = new Date("2026-07-10T12:00:00Z");
    function record(overrides: Partial<AiActivityLogRecord> = {}): AiActivityLogRecord {
      return {
        id: "log1",
        at: "2026-07-10T11:55:00Z",
        channel: "region",
        instruction: "이 영역을 잔디로 채워줘",
        result: { ok: true, applied: true, changedCells: 34, changedEvents: 2 },
        toolCalls: [],
        audit: [],
        ...overrides,
      } as AiActivityLogRecord;
    }
    describe("formatRelativeTime", () => {
      it("분/시간/일 단위", () => {
        expect(formatRelativeTime("2026-07-10T11:59:40Z", NOW)).toBe("방금 전");
        expect(formatRelativeTime("2026-07-10T11:55:00Z", NOW)).toBe("5분 전");
        expect(formatRelativeTime("2026-07-10T09:00:00Z", NOW)).toBe("3시간 전");
        expect(formatRelativeTime("2026-07-08T12:00:00Z", NOW)).toBe("2일 전");
      });
    });
    describe("summarizeActivityResult", () => {
      it("적용/오류/무변경을 요약한다", () => {
        expect(summarizeActivityResult(record())).toBe("34칸 · 이벤트 2건");
        expect(summarizeActivityResult(record({ result: { ok: false, applied: false, error: "boom" } as never }))).toBe("오류");
        expect(summarizeActivityResult(record({ result: { ok: true, applied: false, changedCells: 0, changedEvents: 0 } as never }))).toBe("변경 없음");
      });
    });
    describe("buildTryRegionCard", () => {
      it("예시 칩 클릭 시 onPick에 instruction을 넘긴다", () => {
        const picked: string[] = [];
        const card = renderWithFakeDom(() =>
          buildTryRegionCard({
            commands: [{ id: "c1", label: "🌊 호수", instruction: "둥근 호수를 만들어줘", category: "타일" }],
            onPick: (instruction) => picked.push(instruction),
          }),
        );
        expect(findByTestId(card, "ai-start-try-region")).not.toBeNull();
        findByTestId(card, "ai-start-try-c1")!.dispatchEvent(new Event("click"));
        expect(picked).toEqual(["둥근 호수를 만들어줘"]);
      });
    });
    describe("buildAiAuthoringExamples", () => {
      it("길·NPC·상점·상자·집·퀘스트 예제를 빠짐없이 제공하고 클릭한 문장을 넘긴다", () => {
        expect(new Set(AI_AUTHORING_EXAMPLES.map((example) => example.kind))).toEqual(
          new Set(["road", "npc", "shop", "chest", "house", "quest"]),
        );
        const picked: Array<{ instruction: string; id: string }> = [];
        const examples = renderWithFakeDom(() =>
          buildAiAuthoringExamples({
            onPick: (instruction, id) => picked.push({ instruction, id }),
          }),
        );

        expect(findByTestId(examples, "ai-authoring-examples")).not.toBeNull();
        expect(examples.querySelectorAll("button")).toHaveLength(6);
        findByTestId(examples, "ai-authoring-example-shop")!.click();
        expect(picked).toEqual([
          {
            id: "shop",
            instruction: AI_AUTHORING_EXAMPLES.find((example) => example.id === "shop")!.instruction,
          },
        ]);
      });

      it("예제 칩 mousedown 은 기본 포커스 이동을 막고 같은 문장을 넘긴다", () => {
        const picked: string[] = [];
        const examples = renderWithFakeDom(() =>
          buildAiAuthoringExamples({
            onPick: (instruction) => picked.push(instruction),
          }),
        );
        const shop = findByTestId(examples, "ai-authoring-example-shop");
        if (!shop) throw new Error("shop example chip missing");
        const down = new Event("mousedown", { bubbles: true, cancelable: true });
        shop.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        expect(picked).toEqual([
          AI_AUTHORING_EXAMPLES.find((example) => example.id === "shop")!.instruction,
        ]);
      });
    });
    describe("buildRecentAiWorkCard", () => {
      it("기록이 있으면 최근 항목을 렌더, 없으면 null", () => {
        const built = buildRecentAiWorkCard([record()], NOW);
        expect(built).not.toBeNull();
        const card = renderWithFakeDom(() => built!);
        expect(findByTestId(card, "ai-start-recent-work")).not.toBeNull();
        expect(card.textContent).toContain("34칸");
        expect(card.textContent).toContain("5분 전");
        expect(buildRecentAiWorkCard([], NOW)).toBeNull();
      });
    });
    describe("buildVisualStartGallery", () => {
      it("모자이크 헬퍼는 호출 시에만 썸을 만들고 5열 갤러리를 부팅 빈 면으로 쓰지 않는다", () => {
        // Break: panel boot still mounts ai-start-visual-gallery as the empty product.
        const project = createBlankProject();
        const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID] ?? Object.values(project.tilesets)[0] ?? null;
        const gallery = renderWithFakeDom(() =>
          buildVisualStartGallery({
            tileset,
            onPick: () => undefined,
          }),
        );
        expect(findByTestId(gallery, "ai-start-visual-stage-place")).toBeTruthy();
        expect(defaultAiVisualStartPrompts().length).toBeGreaterThanOrEqual(3);

        const panel = renderWithFakeDom(() => renderAiChatPanel());
        if (panel.classList.contains("is-collapsed")) {
          findByTestId(panel, "ai-collapsed-restore")?.click();
        }
        const chips = findByTestId(panel, "ai-composer-chips");
        expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
        expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
        expect(chips?.querySelectorAll("button").length ?? 0).toBe(0);
      });
    });
  });
  describe("aiSuggestionRows", () => {
    isolateTimers();
    describe("추천 행 — 맵 진단 순서의 실행 문장 (데크 D5)", () => {
      let restoreDom: (() => void) | null = null;
      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = null;
      });

      it("길이 없으면 길이 첫 행, 사람이 없으면 NPC·상점이 그 다음", () => {
        // Break: 순서가 고정이라 빈 맵에서도 「보물상자」 가 먼저 온다.
        const ranked = rankAuthoringExamples({ hasPath: false, eventCount: 0 });
        expect(ranked.slice(0, 3).map((example) => example.kind)).toEqual(["road", "npc", "shop"]);
        const populated = rankAuthoringExamples({ hasPath: true, eventCount: 5 });
        expect(populated.map((example) => example.kind)).toEqual(AI_AUTHORING_EXAMPLES.map((example) => example.kind));
      });

      it("행은 문장 + 종류이고 누르면 지시 전문을 넘긴다 — 상한 3", () => {
        // Break: 행이 라벨 한 단어만 보이거나, 6개가 다 나와 컴포저 위를 채운다.
        const picked: string[] = [];
        const rows = buildSuggestionRows({ examples: AI_AUTHORING_EXAMPLES, onPick: (instruction) => picked.push(instruction) });
        const buttons = rows.querySelectorAll(".ai-suggest-row");
        expect(buttons.length).toBe(3);
        expect(buttons[0]?.querySelector(".ai-suggest-row-text")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.title);
        expect(buttons[0]?.querySelector(".ai-suggest-row-why")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.label);
        (buttons[0] as unknown as FakeElement).click();
        expect(picked).toEqual([AI_AUTHORING_EXAMPLES[0]?.instruction]);
      });
    });
  });
  // 상태바 "AI 연결됨" 칩 진실화 — 실제 요청 성패(전송 건강)를 함께 판정하는지.
  // 배경(2026-08-19 적대 평가 P0): 설정 모양만 보고 ready 를 내보내, 모든 턴이 404 로
  // 죽는 동안에도 "AI 연결됨"이라고 표시했다.
  describe("aiTransportHealth", () => {
    isolateTimers();
    const proxyConfig: AiConfig = {
      authMode: "apiKey",
      baseUrl: "/api/cliproxy",
      model: "test-model",
      apiKey: "",
      maxToolCalls: 8,
      maxTokens: 1024,
    };
    describe("AI 연동 칩 × 전송 건강", () => {
      beforeEach(() => {
        resetAiTransportHealth();
      });

      it("프록시 설정이면 기본은 연결됨", () => {
        const status = getAiConnectionStatus(proxyConfig);
        expect(status.kind).toBe("ready");
        expect(status.label).toBe("Google 연결됨");
      });

      it("404 실패가 기록되면 '연결됨' 대신 응답 오류를 보고한다", () => {
        reportTransportHealth(false, 404, "요청 실패(404)");
        const status = getAiConnectionStatus(proxyConfig);
        expect(status.kind).toBe("offline");
        expect(status.label).toContain("404");
        expect(status.title).toContain("실패");
      });

      it("성공이 기록되면 자동으로 연결됨으로 복구된다", () => {
        reportTransportHealth(false, 404, "요청 실패(404)");
        reportTransportHealth(true, 200);
        const status = getAiConnectionStatus(proxyConfig);
        expect(status.kind).toBe("ready");
      });

      it("429 뒤 내 PC 프로그램 감지(/v1/local-agents) 성공은 한도 표시를 지우지 않고, 모델 호출 성공만 지운다", async () => {
        const reply = (status: number, headers: Record<string, string> = {}) => async () => new Response("{}", { status, headers });
        await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(429, { "retry-after": "600" }) });
        await vi.waitFor(() => expect(getAiTransportHealth()?.status).toBe(429));
        expect(getAiTransportHealth()?.message).toContain("Retry-After 600");

        await fetchCompanion("/v1/local-agents", undefined, { fetchImpl: reply(200) });
        // fetchCompanion 은 해제를 `import("@/ai/llmClient").then(...)` 으로 미룬다 — 같은 import 를 기다리면 그보다 먼저 걸린 해제가 끝난 뒤다.
        await import("@/ai/llmClient");
        expect(getAiTransportHealth()?.status).toBe(429);

        await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(200) });
        await vi.waitFor(() => expect(getAiTransportHealth()?.ok).toBe(true));
      });

      it("429(사용량 제한)는 연결 문제로 취급하지 않는다", () => {
        // llmClient 는 429 를 아예 기록하지 않지만, 방어적으로 기록되더라도 칩은 붉히지 않는다.
        reportTransportHealth(false, 429, "사용량 제한");
        const status = getAiConnectionStatus(proxyConfig);
        expect(status.kind).toBe("ready");
      });

      it("네트워크 오류(상태 코드 없음)도 응답 오류로 보고한다", () => {
        reportTransportHealth(false, undefined, "네트워크 오류(/api/x)");
        const status = getAiConnectionStatus(proxyConfig);
        expect(status.kind).toBe("offline");
      });
    });
  });
  describe("aiVisualEvidenceReceipt", () => {
    isolateTimers();
    // 이 파일이 지키는 것: "자료를 조회했다" / "이미지가 실제 요청에 실렸다" / "품질 검사를 했다" /
    // "실제 플레이로 확인했다" 는 서로 다른 사실이다. 영수증은 **전달 사실만** 말한다.
    // 모델이 그림을 이해했거나 보기 좋다고 판단했다는 주장은 여기서 만들어내지 않는다.

    const baseFacts: RunOutcomeFacts = Object.freeze({
      execution: "response-final", acceptance: null,
      hasPendingDraft: false, hasApplied: false, persistence: "none",
    });
    function mapRegion(project: Project) {
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("Missing start map");
      return { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height };
    }
    describe("visual delivery receipt", () => {
      it("reports no attachment when the run never rendered an image", () => {
        // Given: a run with no renderer at all.
        const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 0, attached: 0 } };
        // When
        const outcome = deriveRunOutcome(facts);
        // Then
        expect(outcome.imageAttached).toBe(false);
        expect(outcome.visualDelivery).toEqual({ attempted: 0, attached: 0 });
      });

      it("reports no attachment when rendering was attempted but nothing was acknowledged", () => {
        // Given: renderer threw or returned an empty list, so nothing reached the request.
        const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 2, attached: 0 } };
        // When
        const outcome = deriveRunOutcome(facts);
        // Then
        expect(outcome.imageAttached).toBe(false);
        expect(outcome.visualDelivery).toEqual({ attempted: 2, attached: 0 });
      });

      it("reports attachment only for images the provider actually acknowledged", () => {
        // Given
        const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 3, attached: 1 } };
        // When
        const outcome = deriveRunOutcome(facts);
        // Then
        expect(outcome.imageAttached).toBe(true);
        expect(outcome.visualDelivery).toEqual({ attempted: 3, attached: 1 });
      });

      it("keeps the delivery axis independent of goal and persistence axes", () => {
        // Given: a verified, persisted run that never sent an image.
        const facts: RunOutcomeFacts = { ...baseFacts, acceptance: "verified", hasApplied: true,
          persistence: "verified-current", visualDelivery: { attempted: 1, attached: 0 } };
        // When
        const outcome = deriveRunOutcome(facts);
        // Then: goal/delivery stay unchanged; the image axis does not inherit their success.
        expect(outcome.goal).toBe("satisfied");
        expect(outcome.delivery).toBe("persisted-verified");
        expect(outcome.imageAttached).toBe(false);
      });

      it("omits the receipt entirely for callers that do not report delivery facts", () => {
        // Given: a legacy caller.
        // When
        const outcome = deriveRunOutcome(baseFacts);
        // Then: absence is not a false claim in either direction.
        expect(outcome.imageAttached).toBe(false);
        expect(outcome.visualDelivery).toBeUndefined();
      });
    });
    describe("AssistantImageEvidence delivery facts", () => {
      it("counts a capture as attached only after the provider acknowledges it", () => {
        // Given
        const project = createBlankProject();
        const evidence = new AssistantImageEvidence();
        const receipt = evidence.capture(project, mapRegion(project));
        if (!receipt) throw new Error("Expected a real capture receipt");
        // Then: captured is not attached.
        expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 0 });
        // When
        evidence.deliver([receipt]);
        // Then
        expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 1 });
      });

      it("does not count a receipt from another run or revision", () => {
        // Given: a receipt captured against a different project revision.
        const project = createBlankProject();
        const evidence = new AssistantImageEvidence();
        const foreign = new AssistantImageEvidence().capture(project, mapRegion(project));
        if (!foreign) throw new Error("Expected a real capture receipt");
        // When: a foreign receipt is offered for delivery.
        evidence.deliver([foreign]);
        // Then
        expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
      });

      it("retires delivered facts when the authored content moved on", () => {
        // Given
        const project = createBlankProject();
        const evidence = new AssistantImageEvidence();
        const receipt = evidence.capture(project, mapRegion(project));
        if (!receipt) throw new Error("Expected a real capture receipt");
        evidence.deliver([receipt]);
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("Missing start map");
        // When: the map actually changes after the image was sent.
        const moved: Project = { ...project, maps: { ...project.maps,
          [map.id]: { ...map, events: [...map.events, { id: "receipt-drift", x: 1, y: 1, pages: [] }] } } };
        evidence.current(moved);
        // Then: a stale image is not a current delivery receipt.
        expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
      });
    });
    describe("run outcome surface", () => {
      it("maps the receipt onto the concise result element without claiming comprehension", () => {
        // Given
        const restore = installFakeDom();
        try {
          const attached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 1 } });
          const unattached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 0 } });
          const unknown = deriveRunOutcome(baseFacts);
          // When
          const attachedEl = renderRunOutcome(attached);
          const unattachedEl = renderRunOutcome(unattached);
          const unknownEl = renderRunOutcome(unknown);
          // Then: machine-consumed state, and absence stays absent.
          expect(attachedEl.dataset.imageDelivery).toBe("attached");
          expect(unattachedEl.dataset.imageDelivery).toBe("unattached");
          expect(unknownEl.dataset.imageDelivery).toBeUndefined();
          // The other axes are untouched by the receipt.
          expect(attachedEl.dataset.goal).toBe("unassessed");
          expect(attachedEl.dataset.delivery).toBe("no-change");
        } finally { restore(); }
      });
    });
  });
  describe("aiVisualPolish", () => {
    isolateTimers();
    describe("AI 상태 톤(제안 6)", () => {
      it("대기/오류/진행/완료를 구분한다", () => {
        expect(statusToneOf("대기")).toBe("idle");
        expect(statusToneOf("새 대화")).toBe("idle");
        expect(statusToneOf("오류")).toBe("error");
        expect(statusToneOf("오류: 키 없음")).toBe("error");
        expect(statusToneOf("적용 실패")).toBe("error");
        expect(statusToneOf("계획 중… 12초 · 도구 3")).toBe("running");
        expect(statusToneOf("실행 중(flash) … 3초 · 도구 1/200")).toBe("running");
        expect(statusToneOf("중단 중…")).toBe("running");
        expect(statusToneOf("적용됨")).toBe("ok");
        expect(statusToneOf("완료")).toBe("ok");
        expect(statusToneOf("완료 — 변경 없음(린트 경고)")).toBe("ok");
      });
    });
    describe("AI 기록 날짜/턴 접기(제안 6)", () => {
      it("같은 날에는 구분선을 한 번만 넣고, 이전 턴을 접는다", () => {
        const restore = installFakeDom();
        try {
          const log = document.createElement("div") as unknown as FakeElement;
          const day = new Date("2026-07-11T10:00:00");
          expect(aiDayKey(day)).toBe("2026-07-11");
          expect(formatAiDayLabel(day)).toContain("2026");
          const labeled = new Date(2026, 6, 11, 10, 0, 0);
          expect(formatAiDayLabel(labeled, "ko")).toMatch(/2026년/);
          expect(formatAiDayLabel(labeled, "en")).toMatch(/July/);
          expect(formatAiDayLabel(labeled, "ja")).toMatch(/2026年7月11日/);
          expect(formatAiDayLabel(labeled, "en")).not.toMatch(/[가-힣]/);
          expect(parseAiDayDate("2026-07-11T12:00:00").getDate()).toBe(11);

          const first = ensureDayDivider(log as unknown as HTMLElement, day);
          const second = ensureDayDivider(log as unknown as HTMLElement, day);
          expect(first).toBeTruthy();
          expect(second).toBeNull();
          expect(findByTestId(log, "ai-day-divider")).toBeTruthy();

          const user = document.createElement("div") as unknown as FakeElement;
          user.className = "ai-command-row";
          user.dataset.testid = "ai-command-row";
          user.dataset.role = "user";
          user.textContent = "호수 만들어줘";
          const assistant = document.createElement("div") as unknown as FakeElement;
          assistant.className = "ai-command-row";
          assistant.dataset.testid = "ai-command-row";
          assistant.dataset.role = "assistant";
          assistant.textContent = "초안입니다.";
          log.append(user, assistant);

          markPriorTurns(log as unknown as HTMLElement);

          const group = findByTestId(log, "ai-turn-group");
          expect(group).toBeTruthy();
          expect(group?.className).toContain("is-collapsed");
          expect(group?.className).toContain("is-prior-turn");
          expect(findByTestId(log, "ai-turn-group-toggle")?.textContent).toContain("호수");
          // 구분선은 유지, 턴 본문은 그룹 안.
          expect(findByTestId(log, "ai-day-divider")).toBeTruthy();
          expect(findByTestId(group!, "ai-turn-group-body")?.childNodes.length).toBe(2);
        } finally {
          restore();
        }
      });
    });
  });
  describe("aiWorkPlanBook", () => {
    isolateTimers();
    function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
      return {
        id: "plan-1",
        goal: "강가 마을을 만든다",
        createdAt: "2026-09-03T00:00:00.000Z",
        currentLayerIndex: 0,
        currentItemId: "L1-1",
        plannerNote: "물은 먼저, 집은 나중에",
        layers: [
          {
            id: "L1",
            title: "터 잡기",
            items: [
              {
                id: "L1-1",
                title: "강 그리기",
                instruction: "fill_region 으로 강을 깐다",
                doneWhen: "강 타일이 맵에 있다",
                status: "in_progress",
              },
              {
                id: "L1-2",
                title: "다리",
                instruction: "paint_road 로 다리를 놓는다",
                status: "pending",
              },
            ],
          },
          {
            id: "L2",
            title: "살림",
            items: [
              {
                id: "L2-1",
                title: "집 3채",
                instruction: "author_house 3",
                status: "pending",
              },
            ],
          },
        ],
        ...overrides,
      };
    }
    describe("workPlanBookPages", () => {
      it("표지 한 장과 레이어마다 한 장을 만든다", () => {
        const pages = workPlanBookPages(samplePlan());
        expect(pages.map((page) => page.kind)).toEqual(["cover", "layer", "layer"]);
        const cover = pages[0];
        if (cover?.kind !== "cover") throw new Error("cover missing");
        expect(cover.goal).toBe("강가 마을을 만든다");
        expect(cover.plannerNote).toBe("물은 먼저, 집은 나중에");
        expect(cover.done).toBe(0);
        expect(cover.total).toBe(3);
        expect(cover.layers.map((layer) => layer.title)).toEqual(["터 잡기", "살림"]);
        expect(cover.layers[0]?.current).toBe(true);
        expect(pages[1]?.kind === "layer" && pages[1].items).toHaveLength(2);
      });

      it("layers 가 없어도 표지는 남긴다", () => {
        const pages = workPlanBookPages({ goal: "던전 하나" } as unknown as WorkPlan);
        expect(pages).toHaveLength(1);
        expect(pages[0]?.kind).toBe("cover");
        if (pages[0]?.kind !== "cover") throw new Error("cover missing");
        expect(pages[0].goal).toBe("던전 하나");
        expect(pages[0].total).toBe(0);
      });
    });
    describe("작업 계획 책 모달", () => {
      let restore: (() => void) | null = null;

      afterEach(() => {
        closeWorkPlanBook();
        resetModalStackForTest();
        restore?.();
        restore = null;
      });

      function mount(plan: WorkPlan = samplePlan()): FakeElement {
        restore = installFakeDom();
        const overlay = openWorkPlanBook({ plan, active: true }) as unknown as FakeElement;
        return overlay;
      }

      it("표지에서 시작해 다음/점이 레이어 페이지를 연다", () => {
        const overlay = mount();
        expect(workPlanBookIsOpen()).toBe(true);
        expect(modalStackDepthForTest()).toBe(1);
        expect(findByTestId(overlay, "ai-plan-book-title")?.textContent).toBe("강가 마을을 만든다");
        expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("1 / 3");
        const sheets = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']");
        expect(sheets.map((sheet) => sheet.dataset.kind)).toEqual(["cover", "layer", "layer"]);
        expect(sheets[0]?.className).toContain("is-current");
        expect(findByTestId(overlay, "ai-plan-book-progress")?.textContent).toBe("0/3 완료");
        expect(overlay.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(3);

        findByTestId(overlay, "ai-plan-book-next")?.click();
        expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
        const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
          .find((sheet) => sheet.className.includes("is-current"));
        expect(current?.dataset.kind).toBe("layer");
        expect(current?.textContent).toContain("강 그리기");
        expect(current?.textContent).toContain("fill_region 으로 강을 깐다");
        expect(current?.textContent).toContain("완료 조건 · 강 타일이 맵에 있다");
        expect(current?.textContent).toContain("진행 중");

        overlay.querySelectorAll("[data-testid='ai-plan-book-dot']")[2]?.click();
        expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
        const last = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
          .find((sheet) => sheet.className.includes("is-current"));
        expect(last?.textContent).toContain("집 3채");
      });

      it("목차 행은 해당 레이어 페이지로 점프한다", () => {
        const overlay = mount();
        const rows = overlay.querySelectorAll("[data-testid='ai-plan-book-toc-row']");
        expect(rows).toHaveLength(2);
        rows[1]?.click();
        expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("3 / 3");
        const current = overlay.querySelectorAll("[data-testid='ai-plan-book-sheet']")
          .find((sheet) => sheet.className.includes("is-current"));
        expect(current?.textContent).toContain("살림");
      });

      it("같은 계획을 다시 열면 페이지를 유지한 채 내용만 갱신한다", () => {
        const overlay = mount();
        findByTestId(overlay, "ai-plan-book-next")?.click();
        const advanced = samplePlan({
          layers: samplePlan().layers.map((layer, index) =>
            index === 0
              ? {
                  ...layer,
                  items: layer.items.map((item) =>
                    item.id === "L1-1" ? { ...item, status: "done" as const } : item,
                  ),
                }
              : layer,
          ),
        });
        updateWorkPlanBook({ plan: advanced, active: true });
        expect(document.querySelectorAll("[data-testid='ai-plan-book-overlay']")).toHaveLength(1);
        expect(findByTestId(overlay, "ai-plan-book-count")?.textContent).toBe("2 / 3");
        expect(overlay.querySelector("[data-status='done']")?.textContent).toContain("강 그리기");
      });

      it("닫기 버튼은 오버레이와 모달 스택을 걷는다", () => {
        const overlay = mount();
        findByTestId(overlay, "ai-plan-book-close")?.click();
        expect(workPlanBookIsOpen()).toBe(false);
        expect(document.querySelector("[data-testid='ai-plan-book']")).toBeNull();
        expect(modalStackDepthForTest()).toBe(0);
      });
    });
  });
});
