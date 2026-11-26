import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { isActionCombatMap, normalizeActionCombatConfig, normalizeActionSkillProfile, normalizeActionWeaponProfile, normalizeEnemyActionAttack, normalizeEnemyActionProfile, resolveActionCombatConfig } from "@/project/actionCombat";
import { createBlankProject, TILE, createBlankMap } from "@/project/defaults";
import type { GameMap, EquipmentRecord, CharacterFootprint, Dir, Project } from "@/project/types";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
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
import { createConversationLogHost } from "@/editor/panels/aiConversationLog";
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
