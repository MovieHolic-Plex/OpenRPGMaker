import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { enterHeroNameBody, promoteActorBody, recoverAllBody, namedVariablesOf, changeActorHpBody, changeEquipmentBody, changeLevelBody, changePartyBody } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, BattleAnimationFlash, BattleAnimationScreenShake, BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet, Project, Condition } from "@/project/types";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { startSession, evalCondition } from "@/project/session";
import { changeActorVital } from "@/project/sessionActorCommands";
import { isolateTimers } from "./mergedTeardown";
import { buildEventListTooltipModel, buildEventMarkerTooltipModel, eventDisplayName, eventLayerSwitchNotice, eventMarkerTooltip, renderEventListTooltipElement, renderEventMarkerTooltipElement, shouldOfferEventLayerSwitch } from "@/editor/eventMarkerUx";
import { editorState } from "@/editor/editorState";
import { isMapEditLockTakeoverImmediate, mapEditLockLastActivityText, type MapEditLockStatus } from "@/editor/mapEditLocks";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { normalizeAiDockButtonChrome, persistenceModeBannerText } from "@/editor/panels/editor";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { auxCompositeKey, bindAuxDetails, getAuxOpen, getAuxOpenSet, isAuxOpen, setAuxOpen, setAuxClosed, syncAuxHosts } from "@/editor/panels/eventEditor/auxOpenController";
import { battleAnimationAnchor, isScreenAnchoredAnimation, type BattleAnchorBox } from "@/player/battleAnimationAnchor";
import { BATTLE_EFFECT_CSS_VARIABLES, flashCssVariables, framesToMs, screenShakeCssVariables } from "@/player/battleAnimationEffectStyle";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";
import { renderShowAnimationFrame, showAnimationPlaybackSource, SHOW_ANIMATION_FRAME_MS, playShowAnimation, playShowAnimationOnce } from "@/editor/panels/eventEditor/showAnimationPlayback";
import { renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { showAnimationBody, setLightingBody, showPictureBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { applyCommandDiff, countCommandDiff, diffCommandLists, hasCommandDiffChanges } from "@/editor/panels/eventEditor/commandDiff";
import { newM2Command } from "@/editor/eventCommandFactory";
import { handleCommandShortcut } from "@/editor/panels/eventEditor/commandListContextMenu";
import { compileConditionFromText } from "@/editor/panels/eventEditor/conditionCompile";
import { renderConditionEvalPreview } from "@/editor/panels/eventEditor/conditionEvalPreview";
import { renderEventScheduleEditor } from "@/editor/panels/eventEditor/eventScheduleEditor";

describe("panelsEventEditorSuite14", () => {
  isolateTimers();
  describe("commandBodyDatabase", () => {
    isolateTimers();
    describe("actorCombatCommandBodies", () => {
      isolateTimers();
      function ctx(replaceCommand = vi.fn()): CommandEditContext {
        return {
          path: [0],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand,
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
        };
      }
      function m2(commandId: string, fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
        return { kind: "m2Command", commandId, fields };
      }
      describe("actor combat command modern bodies", () => {
        let restoreDom: (() => void) | undefined;
        let actorId = "";
        let stateId = "";
        let classId = "";

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          actorId = project.database.actors[0]?.id ?? "";
          stateId = project.database.states[0]?.id ?? "";
          classId = project.database.classes[0]?.id ?? "";
          if (!actorId) throw new Error("missing actor");
          store.replace(project);
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("modernizes change state with chips and party target", () => {
          expect(stateId).not.toBe("");
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            renderM2CommandBody(
              ctx(replaceCommand),
              m2("m2-019-change-state", { target: "party", operation: "add", value: stateId })
            )!
          );
          expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
          expect(findByTestId(body, "change-state-intent")).not.toBeNull();
          expect(findByTestId(body, "change-state-grid")).not.toBeNull();
          (findByTestId(body, `change-state-chip-${stateId}`) as FakeElement | null)?.dispatchEvent(new Event("click"));
          const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
          expect(next.fields.value).toBe(stateId);
        });

        it("modernizes damage processing presets", () => {
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            renderM2CommandBody(ctx(replaceCommand), m2("m2-021-damage-processing", { target: actorId, operation: "add", value: 1 }))!
          );
          expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
          const operation = findByTestId(body, "damage-processing-operation");
          if (!operation) throw new Error("missing damage operation");
          operation.value = "remove";
          operation.dispatchEvent(new Event("change"));
          findByTestId(body, "damage-processing-preset-25")?.click();
          const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
          expect(next.fields.operation).toBe("remove");
          expect(next.fields.value).toBe(25);
          expect(next.fields.target).toBe(actorId);
        });

        it("modernizes actor name and nickname forms", () => {
          for (const [id, testid] of [
            ["m2-022-change-actor-name", "change-actor-name"],
            ["m2-023-change-actor-nickname", "change-actor-nickname"],
          ] as const) {
            const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), m2(id, { target: actorId, value: "" }))!);
            expect(findByTestId(body, `${testid}-command-body`)).not.toBeNull();
            expect(findByTestId(body, `${testid}-intent`)).not.toBeNull();
            expect(findByTestId(body, `${testid}-value-input`)).not.toBeNull();
          }
        });

        it("modernizes actor graphic/faceset/class forms", () => {
          expect(
            findByTestId(
              renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-024-change-actor-graphic", { target: actorId, value: "" }))!),
              "change-actor-graphic-command-body"
            )
          ).not.toBeNull();
          expect(
            findByTestId(
              renderWithFakeDom(() => renderM2CommandBody(ctx(), m2("m2-025-change-actor-faceset", { target: actorId, value: "" }))!),
              "change-actor-faceset-command-body"
            )
          ).not.toBeNull();
          const replaceCommand = vi.fn();
          const classBody = renderWithFakeDom(() =>
            renderM2CommandBody(ctx(replaceCommand), m2("m2-091-change-actor-class", { target: actorId, value: classId }))!
          );
          expect(findByTestId(classBody, "change-actor-class-command-body")).not.toBeNull();
          const classSelect = findByTestId(classBody, "change-actor-class-class-select");
          if (!classSelect || !classId) throw new Error("missing class picker");
          classSelect.value = classId;
          classSelect.dispatchEvent(new Event("change"));
          expect(replaceCommand).toHaveBeenLastCalledWith([0], {
            kind: "m2Command", commandId: "m2-091-change-actor-class", fields: { target: actorId, value: classId },
          });
        });

        it("modernizes recover all / enter hero name / promote", () => {
          const replaceCommand = vi.fn();
          const recover = renderWithFakeDom(() => recoverAllBody(ctx(replaceCommand), { kind: "recoverAll", actorId: "" }));
          const actor = findByTestId(recover, "recover-all-actor-select");
          if (!actor) throw new Error("missing recovery actor picker");
          actor.value = actorId;
          actor.dispatchEvent(new Event("change"));
          expect(replaceCommand).toHaveBeenLastCalledWith([0], { kind: "recoverAll", actorId });

          const name = renderWithFakeDom(() =>
            enterHeroNameBody(ctx(), { kind: "enterHeroName", actorId, maxLength: 6, showInitialName: true })
          );
          expect(findByTestId(name, "enter-hero-name-max-length")?.value).toBe("6");
          expect(findByTestId(name, "enter-hero-name-show-initial")?.checked).toBe(true);
          expect(findByTestId(name, "enter-hero-name-actor-select")?.value).toBe(actorId);

          const promote = renderWithFakeDom(() =>
            promoteActorBody(ctx(), { kind: "promoteActor", actorId, toClassId: classId, successBranch: [], failureBranch: [] })
          );
          expect(findByTestId(promote, "promote-class-select")?.value).toBe(classId);
          expect(findByTestId(promote, "promote-actor-select")?.value).toBe(actorId);
        });
      });
    });
    describe("battleProcessingCommandBody", () => {
      isolateTimers();
      describe("battleProcessing modern form", () => {
        let restoreDom: (() => void) | undefined;
        let staged: Command;

        const actions: CommandListActions = {
          addCommand: () => undefined,
          insertCommand: () => undefined,
          deleteCommand: () => undefined,
          moveCommand: () => undefined,
          moveCommandTo: () => undefined,
          replaceCommand: (_path, command) => {
            staged = command;
          },
        };

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          store.replace(project);
          staged = { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("노출: 적 그룹/도망/패배/방식/프리셋/경고", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          expect(findByTestId(body, "event-command-battle-processing-form")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-escape-select")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-lose-select")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-flow-select")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-presets")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-escape-checkbox")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-lose-checkbox")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-warning")?.textContent).toContain("적 그룹");
          expect(findByTestId(body, "battle-processing-intent")?.textContent).toContain("전투");
        });

        it("보스 프리셋: 도망 불가 + 엄격 턴제", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const boss = findByTestId(body, "battle-processing-preset-boss") as unknown as HTMLButtonElement;
          boss.click();
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.canEscape).toBe(false);
          expect(staged.canLose).toBe(false);
          expect(staged.battleFlow).toBe("strict");
        });

        it("필드 프리셋: 도망/패배 허용", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const field = findByTestId(body, "battle-processing-preset-field") as unknown as HTMLButtonElement;
          field.click();
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.canEscape).toBe(true);
          expect(staged.canLose).toBe(true);
          expect(staged.battleFlow).toBeUndefined();
        });

        it("스토리 프리셋: 도망 불가 + 게임오버", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const story = findByTestId(body, "battle-processing-preset-story") as unknown as HTMLButtonElement;
          story.click();
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.canEscape).toBe(false);
          expect(staged.canLose).toBe(false);
          expect(staged.battleFlow).toBeUndefined();
        });

        it("트룹 선택 시 경고가 사라진다", () => {
          const troopId = store.getCurrent().database.troops[0]?.id ?? "";
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const select = findByTestId(body, "battle-processing-troop-select") as unknown as HTMLSelectElement;
          select.value = troopId;
          select.dispatchEvent(new Event("change"));
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.troopId).toBe(troopId);
          const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
          expect(warning.hidden).toBe(true);
        });

        it("결과 분기 토글이 branchOnResult 를 켠다", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const checkbox = findByTestId(body, "battle-processing-branch-on-result") as unknown as HTMLInputElement;
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change"));
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.branchOnResult).toBe(true);
          expect(staged.victoryBranch).toEqual([]);
          expect(staged.defeatBranch).toEqual([]);
          expect(staged.escapeBranch).toEqual([]);
        });

        it("레거시 체크박스로 도망/패배 규칙을 바꿀 수 있다", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const escape = findByTestId(body, "battle-processing-escape-checkbox") as unknown as HTMLInputElement;
          const lose = findByTestId(body, "battle-processing-lose-checkbox") as unknown as HTMLInputElement;
          escape.checked = false;
          escape.dispatchEvent(new Event("change"));
          lose.checked = true;
          lose.dispatchEvent(new Event("change"));
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.canEscape).toBe(false);
          expect(staged.canLose).toBe(true);
        });

        it("도망 세그먼트 변경이 canEscape 를 반영한다", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const select = findByTestId(body, "battle-processing-escape-select") as unknown as HTMLSelectElement;
          select.value = "deny";
          select.dispatchEvent(new Event("change"));
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.canEscape).toBe(false);
        });

        it("고정 모드에서는 변수 컨트롤이 DOM 에 없다 (그룹/변수 이중 노출 금지)", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          expect(findByTestId(body, "battle-processing-troop-select")).toBeTruthy();
          expect(findByTestId(body, "battle-processing-troop-variable")).toBeFalsy();
        });

        it("변수 모드는 한 줄로 교체되고 이름 있는 변수만 나열한다", () => {
          const project = store.getCurrent();
          const namedCount = project.variables.filter((entry) => entry.name.trim().length > 0).length;
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
          source.value = "variable";
          source.dispatchEvent(new Event("change"));

          const variableRow = findByTestId(body, "battle-processing-troop-variable") as unknown as HTMLElement;
          expect(variableRow).toBeTruthy();
          // 고정 트룹 픽커는 슬롯에서 밀려나간다 — 트룹 소스 컨트롤은 하나다.
          expect(findByTestId(body, "battle-processing-troop-select")).toBeFalsy();

          const options = Array.from(variableRow.querySelectorAll("option")) as unknown as HTMLOptionElement[];
          expect(options.some((option) => (option.textContent ?? "").trim() === "(이름 없음)")).toBe(false);
          // "(변수 선택)" 한 장 + 이름 있는 슬롯만.
          expect(options.length).toBe(namedCount + 1);
          expect(staged.kind).toBe("battleProcessing");
          if (staged.kind !== "battleProcessing") return;
          expect(staged.troopSource).toBe("variable");
        });

        it("변수 모드에서도 트룹 출처 세그먼트와 경고가 유지된다", () => {
          const body = renderWithFakeDom(() =>
            renderCommandBody({ path: [0], actions, lockKind: true }, staged)
          );
          const source = findByTestId(body, "battle-processing-troop-source") as unknown as HTMLSelectElement;
          source.value = "variable";
          source.dispatchEvent(new Event("change"));
          expect(findByTestId(body, "battle-processing-troop-source")).toBeTruthy();
          const warning = findByTestId(body, "battle-processing-warning") as unknown as HTMLElement;
          // Variable mode requires a selected variable, not an unused fixed troop.
          expect(warning.hidden).toBe(false);
        });
      });
      describe("namedVariablesOf", () => {
        it("이름이 빈 슬롯은 거른다", () => {
          const project = createBlankProject();
          project.variables = [
            { id: "v1", name: "적 그룹 번호" },
            { id: "v2", name: "   " },
            { id: "v3", name: "" },
          ] as typeof project.variables;
          expect(namedVariablesOf(project)).toEqual([{ id: "v1", name: "적 그룹 번호" }]);
        });
      });
    });
    describe("changeActorVitalPercent", () => {
      isolateTimers();
      function ctx(replaceCommand = vi.fn()): CommandEditContext {
        return {
          path: [0],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand,
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
        };
      }
      describe("changeActorHp percent mode", () => {
        let restoreDom: (() => void) | undefined;
        let actorId = "";

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          actorId = project.database.actors[0]?.id ?? "";
          if (!actorId) throw new Error("missing actor");
          store.replace(project);
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("exposes flat/% mode and percent presets", () => {
          const body = renderWithFakeDom(() =>
            changeActorHpBody(ctx(), { kind: "changeActorHp", actorId, op: "+=", amount: 10 })
          );
          expect(findByTestId(body, "change-actor-hp-command-body")).not.toBeNull();
          expect(findByTestId(body, "change-actor-hp-amount-mode")).not.toBeNull();
          expect(findByTestId(body, "change-actor-hp-amount-presets")).not.toBeNull();
          expect(findByTestId(body, "change-actor-hp-amount-preset-heal-50")).not.toBeNull();
          expect(body.textContent).toContain("%");
        });

        it("writes amountMode percent through the +50% preset", () => {
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            changeActorHpBody(ctx(replaceCommand), { kind: "changeActorHp", actorId, op: "-=", amount: 10 })
          );
          (findByTestId(body, "change-actor-hp-amount-preset-heal-50") as FakeElement | null)?.dispatchEvent(
            new Event("click")
          );
          expect(replaceCommand).toHaveBeenCalled();
          const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeActorHp" }>;
          expect(next.kind).toBe("changeActorHp");
          expect(next.op).toBe("+=");
          expect(next.amount).toBe(50);
          expect(next.amountMode).toBe("percent");
        });

        it("applies percent amount against max vitals at runtime", () => {
          const project = store.getCurrent();
          const session = startSession(project);
          const vitals = session.actorVitals[actorId];
          if (!vitals) throw new Error("missing vitals");
          vitals.hp = 0;
          changeActorVital(session, {
            kind: "changeActorHp",
            actorId,
            op: "+=",
            amount: 50,
            amountMode: "percent",
          });
          expect(session.actorVitals[actorId]?.hp).toBe(Math.trunc(vitals.maxHp * 0.5));
        });

        it("summarizes percent amounts with a % suffix", () => {
          const text = commandSummaryParts({
            kind: "changeActorHp",
            actorId,
            op: "+=",
            amount: 25,
            amountMode: "percent",
          })
            .map((part) => part.text)
            .join("");
          expect(text).toContain("HP 변경");
          expect(text).toContain("25%");
        });
      });
    });
    describe("changeEquipmentCommandBody", () => {
      isolateTimers();
      function ctx(replaceCommand = vi.fn()): CommandEditContext {
        return {
          path: [0],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand,
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
        };
      }
      describe("changeEquipment command body UX", () => {
        let restoreDom: (() => void) | undefined;
        let actorId = "";
        let weaponId = "";
        let armorId = "";
        let weaponName = "";

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          actorId = project.database.actors[0]?.id ?? "";
          const weapon = project.database.equipment.find((entry) => entry.slot === "weapon");
          weaponId = weapon?.id ?? "";
          weaponName = weapon?.name ?? "";
          armorId = project.database.equipment.find((entry) => entry.slot === "armor")?.id ?? "";
          if (!actorId || !weaponId) throw new Error("blank project missing actor/weapon");
          store.replace(project);
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("renders actor/slot browser with search and live preview", () => {
          const body = renderWithFakeDom(() =>
            changeEquipmentBody(ctx(), {
              kind: "changeEquipment",
              actorId,
              slot: "weapon",
              equipmentId: weaponId,
            })
          );
          expect(findByTestId(body, "change-equipment-command-body")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-intent")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-browser")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-search")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-selected")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-grid")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-preview")).not.toBeNull();
          expect(findByTestId(body, "change-equipment-presets")).toBeNull();
          expect(findByTestId(body, "change-equipment-actor-select")?.value).toBe(actorId);
          expect(findByTestId(body, "change-equipment-slot-select")?.tagName).toBe("SELECT");
          expect(findByTestId(body, "change-equipment-equipment-select")?.tagName).toBe("SELECT");
          expect(findByTestId(body, "change-equipment-equipment-select-card")?.textContent).toContain(weaponName);
          expect(body.textContent).not.toContain("빠른 선택");
        });

        it("unequips the slot through the unequip card", () => {
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            changeEquipmentBody(ctx(replaceCommand), {
              kind: "changeEquipment",
              actorId,
              slot: "weapon",
              equipmentId: weaponId,
            })
          );
          (findByTestId(body, "change-equipment-card-unequip") as FakeElement | null)?.dispatchEvent(new Event("click"));
          expect(replaceCommand).toHaveBeenCalledWith(
            [0],
            { kind: "changeEquipment", actorId, slot: "weapon", equipmentId: "" } satisfies Command
          );
        });

        it("filters the equipment grid live by name", () => {
          const body = renderWithFakeDom(() =>
            changeEquipmentBody(ctx(), {
              kind: "changeEquipment",
              actorId,
              slot: "weapon",
              equipmentId: weaponId,
            })
          );
          const search = findByTestId(body, "change-equipment-search") as FakeElement | null;
          expect(search).not.toBeNull();
          expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();

          if (search) {
            search.value = "zzzz-no-match";
            search.dispatchEvent(new Event("input"));
          }
          expect(findByTestId(body, `change-equipment-card-${weaponId}`)).toBeNull();
          expect(body.textContent).toContain("검색 결과");

          if (search) {
            search.value = weaponName.slice(0, Math.min(2, weaponName.length));
            search.dispatchEvent(new Event("input"));
          }
          expect(findByTestId(body, `change-equipment-card-${weaponId}`)).not.toBeNull();
        });

        it("switches slot via segment and keeps equipment select filtered", () => {
          if (!armorId) return;
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            changeEquipmentBody(ctx(replaceCommand), {
              kind: "changeEquipment",
              actorId,
              slot: "weapon",
              equipmentId: weaponId,
            })
          );
          const armorSeg = findByTestId(body, "change-equipment-slot-select-segment-armor") as FakeElement | null;
          expect(armorSeg).not.toBeNull();
          armorSeg?.dispatchEvent(new Event("click"));
          const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "changeEquipment" }>;
          expect(next.slot).toBe("armor");
          // weapon id should not remain selected after slot change unless it is armor
          expect(next.equipmentId === "" || next.equipmentId === armorId || next.slot === "armor").toBe(true);
        });
      });
    });
    describe("changePartyCommandBody", () => {
      isolateTimers();
      function ctx(overrides: Partial<CommandEditContext["actions"]> = {}): CommandEditContext {
        return {
          path: [2],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand: vi.fn(),
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
            ...overrides,
          },
        };
      }
      describe("changeParty command body UX", () => {
        let restoreDom: (() => void) | undefined;
        let actorId = "";

        beforeEach(() => {
          restoreDom = installFakeDom();
          const project = createBlankProject();
          actorId = project.database.actors[0]?.id ?? "";
          if (!actorId) throw new Error("blank project missing actor");
          store.replace(project);
        });

        afterEach(() => {
          restoreDom?.();
        });

        it("commits membership changes without inserting unrelated actor commands", () => {
          const insertCommand = vi.fn();
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            changePartyBody(ctx({ insertCommand, replaceCommand }), { kind: "changeParty", actorId, action: "add" })
          );
          const action = findByTestId(body, "change-party-action-select");
          if (!action) throw new Error("missing party action");
          action.value = "remove";
          action.dispatchEvent(new Event("change"));
          expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "changeParty", actorId, action: "remove" });
          expect(insertCommand).not.toHaveBeenCalled();
          expect(findByTestId(body, "change-party-preview")?.dataset.afterIn).toBe("false");
        });

        it("still previews start-party membership", () => {
          const body = renderWithFakeDom(() =>
            changePartyBody(ctx(), { kind: "changeParty", actorId, action: "remove" })
          );
          const preview = findByTestId(body, "change-party-preview");
          expect(preview?.dataset.beforeIn).toBe("true");
          expect(preview?.dataset.afterIn).toBe("false");
        });

        it("renders rich level editor with actor card and preview", () => {
          const replaceCommand = vi.fn();
          const body = renderWithFakeDom(() =>
            changeLevelBody(ctx({ replaceCommand }), { kind: "changeLevel", actorId, op: "+=", amount: 2 })
          );
          expect(findByTestId(body, "change-level-command-body")).not.toBeNull();
          expect(findByTestId(body, "change-level-actor-select")?.value).toBe(actorId);
          expect(findByTestId(body, "change-level-preview")).not.toBeNull();
          expect(body.textContent).toContain("레벨 변경");

          const amount = findByTestId(body, "change-level-amount-input") as FakeElement | null;
          if (!amount) throw new Error("missing amount");
          amount.value = "3";
          amount.dispatchEvent(new Event("change"));
          expect(replaceCommand).toHaveBeenCalledWith(
            [2],
            { kind: "changeLevel", actorId, op: "+=", amount: 3 } satisfies Command
          );
        });
        it("uses correct object particle for level descriptions", () => {
          const body = renderWithFakeDom(() =>
            changeLevelBody(ctx(), { kind: "changeLevel", actorId, op: "+=", amount: 2 })
          );
          expect(body.textContent).not.toContain("레벨를");
          expect(body.textContent).toContain("레벨을");
        });
      });
    });
  });
  describe("uxcEditorShell", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    let storage: Map<string, string>;
    function installStorage(): void {
      storage = new Map();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        writable: true,
        value: {
          clear: () => storage.clear(),
          getItem: (key: string) => storage.get(key) ?? null,
          removeItem: (key: string) => void storage.delete(key),
          setItem: (key: string, value: string) => void storage.set(key, String(value)),
        },
      });
    }
    function fakeBody(): FakeElement {
      if (document.body instanceof FakeElement) return document.body;
      throw new Error("Expected fake body");
    }
    function fakeElement(node: HTMLElement): FakeElement {
      if (node instanceof FakeElement) return node;
      throw new Error("Expected fake element");
    }
    function keydown(key: string): KeyboardEvent {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "key", { configurable: true, value: key });
      return event as KeyboardEvent;
    }
    function namedEvent(name: string): GameEvent {
      return {
        commands: [],
        id: "ev_npc",
        pages: [{
          commands: [],
          conditions: [],
          graphic: {},
          id: "page_1",
          movement: { frequency: 3, speed: 3, type: "fixed" },
          name,
          priority: "same",
          trigger: { kind: "action" },
        }],
        trigger: { kind: "action" },
        x: 4,
        y: 5,
      };
    }
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      restoreDom = installFakeDom();
      installStorage();
      store.replaceProject(createBlankProject());
      editorState.set({ currentMapId: store.getCurrent().startMapId, selectedEventId: null, selectedEventPageId: null });
    });
    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="event-editor-cancel"]')?.click();
      document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
      _resetEventDraftVaultForTest();
      restoreDom?.();
      restoreDom = null;
      Reflect.deleteProperty(globalThis, "localStorage");
      vi.restoreAllMocks();
    });
    describe("UXC D13 이벤트 마커 편집 동선", () => {
      it("타일 레이어에서는 이벤트 클릭을 가로채지 않는다", () => {
        expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 2, hasEvent: true })).toBe(false);
        expect(shouldOfferEventLayerSwitch({ activeLayer: "upper", clickCount: 3, hasEvent: true })).toBe(false);
        expect(shouldOfferEventLayerSwitch({ activeLayer: "event", clickCount: 2, hasEvent: true })).toBe(false);
        expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 1, hasEvent: true })).toBe(false);
        expect(shouldOfferEventLayerSwitch({ activeLayer: "lower", clickCount: 2, hasEvent: false })).toBe(false);
      });

      it("이벤트 이름은 name 필드가 먼저고, 자동 페이지 이름(페이지 N)은 이름으로 치지 않는다", () => {
        const named = namedEvent("페이지 1");
        expect(eventDisplayName(named)).toBe("ev_npc");
        expect(eventDisplayName({ ...named, name: "장터 상인" })).toBe("장터 상인");
        expect(eventDisplayName({ ...named, pages: [...named.pages!, { ...named.pages![0]!, id: "page_2", name: "단골 창구" }] })).toBe("단골 창구");
      });

      it("이벤트 이름과 명령 요약을 툴팁에 담는다", () => {
        const event = namedEvent("장터 상인");
        event.pages = event.pages.map((page) => ({
          ...page,
          commands: [
            { kind: "text", body: "어서 오세요." },
            { kind: "shop", itemIds: ["item_potion"], buyOnly: false },
            { kind: "wait", ms: 500 },
            { kind: "text", body: "또 오세요." },
            { kind: "text", body: "추가 대사" },
          ],
        }));

        expect(eventDisplayName(event)).toBe("장터 상인");
        const tip = eventMarkerTooltip(event);
        expect(tip).toContain("장터 상인");
        expect(tip).toContain("(4,5)");
        expect(tip).toContain("확인 키로 조사");
        expect(tip).toContain("문장 표시");
        expect(tip).toContain("어서 오세요.");
        expect(tip).toContain("+1개 명령 더");

        const model = buildEventMarkerTooltipModel(event);
        expect(model.commands.length).toBe(4);
        expect(model.moreCommandCount).toBe(1);

        const el = renderEventMarkerTooltipElement(model);
        expect(el.dataset.testid).toBe("event-marker-tooltip");
        expect(el.textContent).toContain("장터 상인");
        expect(el.textContent).toContain("확인 키로 조사");
        expect(el.textContent).toContain("어서 오세요.");

        expect(eventLayerSwitchNotice(event)).toContain("장터 상인");
        expect(eventLayerSwitchNotice(event)).toContain("이벤트 레이어로 전환");
      });
      it("맵 이벤트 목록 호버는 페이지·조건·명령을 더 자세히 담는다", () => {
        const event = namedEvent("장터 상인");
        event.characterId = "npc_market";
        event.pages = [
          {
            ...event.pages[0]!,
            name: "영업중",
            conditions: [{ kind: "switch", switchId: "sw_open", value: true }],
            commands: [
              { kind: "text", body: "어서 오세요." },
              { kind: "shop", itemIds: ["item_potion"] },
            ],
          },
          {
            ...event.pages[0]!,
            id: "page_2",
            name: "폐점",
            conditions: [],
            commands: [{ kind: "text", body: "오늘은 쉽니다." }],
          },
        ];

        const model = buildEventListTooltipModel(event);
        expect(model.title).toBe("폐점");
        expect(model.characterId).toBe("npc_market");
        expect(model.pages).toHaveLength(2);
        expect(model.pages[0]?.conditions.some((line) => line.includes("스위치"))).toBe(true);
        expect(model.pages[0]?.commands.some((line) => line.includes("어서 오세요."))).toBe(true);
        expect(model.pages[1]?.commands.some((line) => line.includes("오늘은 쉽니다."))).toBe(true);

        const el = renderEventListTooltipElement(model);
        expect(el.dataset.testid).toBe("event-list-tooltip");
        expect(el.className).toContain("event-list-tooltip");
        expect(el.textContent).toContain("캐릭터 ID: npc_market");
        expect(el.textContent).toContain("페이지 1 — 영업중");
        expect(el.textContent).toContain("페이지 2 — 폐점");
      });
    });
    describe("UXC D14/D19/D27/D29 에디터 셸 크롬", () => {
      it("임시 저장 배너에서 내부 URL 파라미터명을 노출하지 않는다", () => {
        const text = persistenceModeBannerText("dev-showcase", true);

        expect(text).toContain("임시 세션");
        expect(text).not.toContain("blankProject");
        expect(text).not.toContain("freshProject");
      });

      it("캔버스 알약은 배율 그룹을 두고, 맵 저장·펼침 단추는 두지 않는다(⌘K 「현재 맵 PNG 저장」)", () => {
        // 2026-11 캔버스 알약 개편: 옛 「더 보기」(격자·맵 PNG)는 ⌘K 명령으로만 닿는다.
        editorState.set({ zoom: 2 });
        const toolbar = document.createElement("div");

        renderCanvasToolbar(toolbar);

        const zoomGroup = findByTestId(fakeElement(toolbar), "editor-zoom-group");
        expect(zoomGroup?.textContent).toContain("200%");
        expect(zoomGroup?.textContent).not.toContain("맵 저장");
        expect(findByTestId(fakeElement(toolbar), "editor-map-save-group")).toBeNull();
        expect(findByTestId(fakeElement(toolbar), "editor-canvas-toolbar-expand")).toBeNull();
      });

      it("AI 패널 언독 버튼 툴팁을 패널 분리로 보정한다", () => {
        const panel = document.createElement("aside");
        panel.className = "ai-chat-panel is-docked";
        const button = document.createElement("button");
        button.dataset.testid = "ai-dock-toggle";
        panel.append(button);

        normalizeAiDockButtonChrome(panel);
        expect(button.getAttribute("title")).toBe("패널 분리");

        panel.classList.remove("is-docked");
        button.click();
        expect(button.getAttribute("title")).toBe("오른쪽 사이드바에 고정");
      });
    });
    describe("UXC D30 새 이벤트 모달 상태", () => {
      it("새 이벤트 모달 제목과 취소 안내에 자동 저장/복구 상태를 표시한다", () => {
        const mapId = store.getCurrent().startMapId;

        openNewEventEditorModal(mapId, 2, 2);

        const header = findByTestId(fakeBody(), "event-editor-header-save-state");
        const draftStatus = findByTestId(fakeBody(), "event-editor-draft-status");
        const remoteStatus = findByTestId(fakeBody(), "event-editor-remote-status");
        expect(header?.dataset.localState).toBe("new-pristine");
        expect(draftStatus?.dataset.state).toBe("new-pristine");
        expect(header?.dataset.remoteState).toBe(remoteStatus?.dataset.state);
        expect(header?.textContent).toBe(`${draftStatus?.textContent} · ${remoteStatus?.textContent}`);
        expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(0);

        findByTestId(fakeBody(), "event-editor-apply")?.click();
        expect(draftStatus?.dataset.state).toBe("applied");
        expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(1);
        findByTestId(fakeBody(), "event-editor-cancel")?.click();
        expect(store.getCurrent().maps[mapId].events).toHaveLength(1);
      });

      it("새 이벤트 모달 취소는 이벤트를 남기지 않는다", () => {
        const mapId = store.getCurrent().startMapId;
        const before = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
        openNewEventEditorModal(mapId, 3, 3);

        findByTestId(fakeBody(), "event-editor-cancel")?.click();

        expect(store.getCurrent().maps[mapId].events).toHaveLength(before);
        expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(before);
      });

      it("새 이벤트 모달 ESC도 이벤트를 남기지 않는다", () => {
        const mapId = store.getCurrent().startMapId;
        const before = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
        openNewEventEditorModal(mapId, 4, 4);

        findByTestId(fakeBody(), "event-editor-modal")?.dispatchEvent(keydown("Escape"));

        expect(store.getCurrent().maps[mapId].events).toHaveLength(before);
        expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(before);
      });
    });
  });
});

describe("panelsEventEditorSuite8", () => {
  isolateTimers();
  describe("auxOpenController", () => {
    isolateTimers();
    describe("auxOpenController non-exclusive preview+flow", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("AI is exclusive — closes preview and flow when opened", () => {
        const key = auxCompositeKey("map_a", "ev_1", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");
        expect(preview.open).toBe(true);
        expect(flow.open).toBe(true);

        setAuxOpen(key, "ai");
        expect(ai.open).toBe(true);
        expect(preview.open).toBe(false);
        expect(flow.open).toBe(false);
      });

      it("preview and flow can be open simultaneously", () => {
        const key = auxCompositeKey("map_b", "ev_2", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        expect(preview.open).toBe(true);
        expect(flow.open).toBe(false);

        setAuxOpen(key, "flow");
        expect(preview.open).toBe(true);
        expect(flow.open).toBe(true);
        expect(ai.open).toBe(false);
      });

      it("closing preview does not close flow", () => {
        const key = auxCompositeKey("map_c", "ev_3", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");
        setAuxClosed(key, "preview");

        expect(preview.open).toBe(false);
        expect(flow.open).toBe(true);
      });

      it("opening preview closes AI but not flow", () => {
        const key = auxCompositeKey("map_d", "ev_4", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "ai");
        expect(ai.open).toBe(true);

        setAuxOpen(key, "preview");
        expect(ai.open).toBe(false);
        expect(preview.open).toBe(true);
        expect(flow.open).toBe(false);

        setAuxOpen(key, "flow");
        expect(preview.open).toBe(true);
        expect(flow.open).toBe(true);
      });

      it("setAuxOpen(null) closes all panels", () => {
        const key = auxCompositeKey("map_e", "ev_5", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");
        setAuxOpen(key, null);

        expect(ai.open).toBe(false);
        expect(preview.open).toBe(false);
        expect(flow.open).toBe(false);
      });

      it("isAuxOpen checks individual panel state", () => {
        const key = auxCompositeKey("map_f", "ev_6", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");

        expect(isAuxOpen(key, "preview")).toBe(true);
        expect(isAuxOpen(key, "flow")).toBe(true);
        expect(isAuxOpen(key, "ai")).toBe(false);
      });

      it("getAuxOpenSet returns the full set of open panels", () => {
        const key = auxCompositeKey("map_g", "ev_7", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");

        const set = getAuxOpenSet(key);
        expect(set.has("preview")).toBe(true);
        expect(set.has("flow")).toBe(true);
        expect(set.has("ai")).toBe(false);
        expect(set.size).toBe(2);
      });

      it("syncAuxHosts restores open state after re-bind", () => {
        const key = auxCompositeKey("map_h", "ev_8", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");

        const preview2 = document.createElement("details");
        const flow2 = document.createElement("details");
        bindAuxDetails(key, "preview", preview2);
        bindAuxDetails(key, "flow", flow2);
        syncAuxHosts(key);

        expect(preview2.open).toBe(true);
        expect(flow2.open).toBe(true);
      });

      it("getAuxOpen returns primary open panel for backward compat", () => {
        const key = auxCompositeKey("map_i", "ev_9", "p1");
        const ai = document.createElement("details");
        const preview = document.createElement("details");
        const flow = document.createElement("details");
        bindAuxDetails(key, "ai", ai);
        bindAuxDetails(key, "preview", preview);
        bindAuxDetails(key, "flow", flow);

        setAuxOpen(key, "preview");
        setAuxOpen(key, "flow");
        expect(getAuxOpen(key)).toBe("preview");

        setAuxClosed(key, "preview");
        expect(getAuxOpen(key)).toBe("flow");

        setAuxClosed(key, "flow");
        expect(getAuxOpen(key)).toBe(null);
      });
    });
  });
  describe("battleAnimationAnchor", () => {
    isolateTimers();
    /**
     * 전투 애니메이션 앵커 계약 — 순수 함수 단위.
     *
     * 왜 여기서 재나: 예전 배치는 대상 노드의 `--battle-node-x/y`(배틀러의 **발** 을 가리키는
     * 백분율)를 문자열로 복사하고, `.battle-animation` 이 240×240 박스에 `translate(-50%, -55%)`
     * 를 걸어 시트 중심을 발에서 12px 위에 뒀다. 스프라이트가 144px 급이므로 이펙트는 몸통이
     * 아니라 발목 높이에 찍혔고, 저작 스키마의 `position`/`scope` 는 배치에 쓰이지 않았다.
     *
     * 이 계약을 브라우저로만 재면 애니메이션이 짧아 프레임을 놓치는 타이밍 운에 걸린다.
     * 산식을 순수 함수로 빼 rect 리터럴로 재면 운이 개입할 자리가 없다. 브라우저 쪽 증거는
     * `test/e2e/battle-animation-anchor.spec.ts` 가 실제 플레이 경로에서 따로 잡는다.
     */
    describe("battleAnimationAnchor", () => {
      isolateTimers();
      /** 무대(레이어) 400×300, 원점 (100, 50). 원점이 0 이 아니어야 좌표 빼기 누락이 드러난다. */
      const LAYER: BattleAnchorBox = { left: 100, top: 50, width: 400, height: 300 };
      /** 스프라이트 64×144. 레이어 안에서 가로 중심 (200), 상단 100, 하단 244. */
      const SPRITE: BattleAnchorBox = { left: 168, top: 100, width: 64, height: 144 };
      describe("battleAnimationAnchor — 저작된 position 이 세로 위치를 정한다", () => {
        it("center 는 스프라이트 세로 중심에 놓는다", () => {
          // 중심 y = 100 + 72 = 172 → 레이어 기준 (172 - 50) / 300 = 40.667%
          expect(battleAnimationAnchor({ position: "center", spriteBox: SPRITE, layerBox: LAYER })).toEqual({
            left: "25%",
            top: "40.667%",
            anchor: "center",
          });
        });

        it("head 는 스프라이트 상단에 놓는다", () => {
          // (100 - 50) / 300 = 16.667%
          expect(battleAnimationAnchor({ position: "head", spriteBox: SPRITE, layerBox: LAYER })?.top).toBe("16.667%");
        });

        it("feet 는 스프라이트 하단(접지선)에 놓는다", () => {
          // (244 - 50) / 300 = 64.667%
          expect(battleAnimationAnchor({ position: "feet", spriteBox: SPRITE, layerBox: LAYER })?.top).toBe("64.667%");
        });

        it("저작이 없으면 center 로 떨어진다 — RM2K3 기본값", () => {
          const resolved = battleAnimationAnchor({ spriteBox: SPRITE, layerBox: LAYER });
          expect(resolved).toEqual(battleAnimationAnchor({ position: "center", spriteBox: SPRITE, layerBox: LAYER }));
          expect(resolved?.anchor).toBe("center");
        });

        it("세 위치는 서로 다른 값이어야 한다 — 하나로 뭉개지면 계약이 죽은 것이다", () => {
          const tops = (["head", "center", "feet"] as const).map(
            (position) => battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })?.top
          );
          expect(new Set(tops).size).toBe(3);
        });

        it("가로는 언제나 스프라이트 가로 중심이다", () => {
          for (const position of ["head", "center", "feet"] as const) {
            expect(battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })?.left).toBe("25%");
          }
        });
      });
      describe("battleAnimationAnchor — screen 은 대상을 무시하고 무대 중심에 놓는다", () => {
        it("scope 가 screen 이면 스프라이트를 보지 않는다", () => {
          expect(battleAnimationAnchor({ scope: "screen", position: "center", layerBox: LAYER })).toEqual({
            left: "50%",
            top: "50%",
            anchor: "screen",
          });
        });

        it("position 이 screen 이어도 무대 중심이다", () => {
          expect(battleAnimationAnchor({ position: "screen", spriteBox: SPRITE, layerBox: LAYER })).toEqual({
            left: "50%",
            top: "50%",
            anchor: "screen",
          });
        });

        it("isScreenAnchoredAnimation 은 두 축 중 하나만 screen 이어도 참이다", () => {
          expect(isScreenAnchoredAnimation("screen", "center")).toBe(true);
          expect(isScreenAnchoredAnimation("singleTarget", "screen")).toBe(true);
          expect(isScreenAnchoredAnimation("singleTarget", "center")).toBe(false);
          expect(isScreenAnchoredAnimation(undefined, undefined)).toBe(false);
        });
      });
      describe("battleAnimationAnchor — 잴 수 없으면 폴백에 양보한다", () => {
        it("레이어를 못 재면 undefined", () => {
          expect(
            battleAnimationAnchor({ spriteBox: SPRITE, layerBox: { left: 0, top: 0, width: 0, height: 0 } })
          ).toBeUndefined();
        });

        it("스프라이트가 없으면 undefined — 대상 앵커 연출은 대상 없이 정의되지 않는다", () => {
          expect(battleAnimationAnchor({ position: "center", layerBox: LAYER })).toBeUndefined();
        });

        it("스프라이트 rect 가 0×0(아직 로드 전)이면 undefined", () => {
          expect(
            battleAnimationAnchor({ spriteBox: { left: 168, top: 100, width: 0, height: 0 }, layerBox: LAYER })
          ).toBeUndefined();
        });

        it("screen 연출은 스프라이트가 없어도 성립한다", () => {
          expect(battleAnimationAnchor({ scope: "screen", layerBox: LAYER })).toBeDefined();
        });
      });
      describe("battleAnimationAnchor — 무대 배율은 약분된다", () => {
        /**
         * `.battle-scene` 에는 `transform: scale(var(--battle-stage-scale))` 이 걸려 있어
         * `getBoundingClientRect` 는 배율이 곱해진 시각 px 을 준다. px 로 심으면 배율만큼
         * 어긋나지만, 같은 레이어 rect 로 나눈 비율에서는 배율이 사라진다. 이 성질이 깨지면
         * 창 크기에 따라 이펙트가 미끄러진다.
         */
        it("모든 rect 를 같은 배율로 확대·평행이동해도 같은 백분율이 나온다", () => {
          const scale = 1.75;
          const shift = 37;
          const scaled = (box: BattleAnchorBox): BattleAnchorBox => ({
            left: box.left * scale + shift,
            top: box.top * scale + shift,
            width: box.width * scale,
            height: box.height * scale,
          });
          for (const position of ["head", "center", "feet"] as const) {
            expect(battleAnimationAnchor({ position, spriteBox: scaled(SPRITE), layerBox: scaled(LAYER) })).toEqual(
              battleAnimationAnchor({ position, spriteBox: SPRITE, layerBox: LAYER })
            );
          }
        });
      });
    });
    /**
     * 감독이 저작한 flash/screenShake 값이 CSS 까지 살아서 도달하는지 지킨다.
     *
     * 회귀 배경: 렌더러가 `Boolean(timing.flash)` 로 존재 여부만 보던 시절, 색·지속·세기가
     * 전부 버려졌다. 같은 시트·같은 패턴을 쓰는 「타격」·「마법 충격」·「회복 빛」은 유일한
     * 차이인 flash 색마저 흰색으로 뭉개져 화면에서 완전히 동일했다.
     */
    describe("battleAnimationEffectStyle", () => {
      isolateTimers();
      function flash(red: number, green: number, blue: number, gray = 0, durationFrames = 4): BattleAnimationFlash {
        return { target: "target", color: { red, green, blue, gray }, durationFrames };
      }
      function shake(power: number, speed: number, durationFrames = 8): BattleAnimationScreenShake {
        return { power, speed, durationFrames };
      }
      describe("flashCssVariables", () => {
        it("스타터 3레코드의 flash 색이 서로 다른 CSS 값이 된다", () => {
          // anim_hit 흰색 / anim_magic 파랑 / anim_heal 초록 — 이 셋이 같으면 화면에서 구분이 안 된다.
          const colors = [
            flashCssVariables(flash(255, 255, 255)),
            flashCssVariables(flash(120, 180, 255)),
            flashCssVariables(flash(160, 255, 180)),
          ].map((vars) => vars["--battle-flash-color"]);

          expect(new Set(colors).size).toBe(3);
        });

        it("저작한 RGB 를 그대로 싣는다", () => {
          expect(flashCssVariables(flash(120, 180, 255))["--battle-flash-color"]).toBe("rgba(120, 180, 255, 0.45)");
        });

        it("durationFrames 를 재생 간격과 같은 상수로 ms 화한다", () => {
          expect(flashCssVariables(flash(255, 255, 255, 0, 5))["--battle-flash-duration"]).toBe(
            `${5 * BATTLE_ANIMATION_FRAME_MS}ms`
          );
        });

        it("gray 채널이 색을 회색 쪽으로 끌어당긴다", () => {
          const vivid = flashCssVariables(flash(255, 0, 0, 0))["--battle-flash-color"]!;
          const grayed = flashCssVariables(flash(255, 0, 0, 255))["--battle-flash-color"]!;
          expect(grayed).not.toBe(vivid);
          // gray 를 최대로 주면 세 채널이 같은 값(=무채색)으로 수렴한다.
          const channels = grayed.match(/\d+/g)!.slice(0, 3);
          expect(new Set(channels).size).toBe(1);
        });

        it("범위 밖 채널을 0~255 로 접는다", () => {
          expect(flashCssVariables(flash(-40, 999, 128))["--battle-flash-color"]).toBe("rgba(0, 255, 128, 0.45)");
        });
      });
      describe("screenShakeCssVariables", () => {
        it("power 가 커질수록 진폭이 커진다", () => {
          const amplitudes = [1, 3, 6, 9].map((power) =>
            Number.parseFloat(screenShakeCssVariables(shake(power, 5))["--battle-shake-x"]!)
          );
          for (let index = 1; index < amplitudes.length; index += 1) {
            expect(amplitudes[index]).toBeGreaterThan(amplitudes[index - 1]!);
          }
        });

        it("speed 가 커질수록 진동 주기가 짧아진다", () => {
          const periods = [1, 5, 9].map((speed) =>
            Number.parseInt(screenShakeCssVariables(shake(5, speed))["--battle-shake-period"]!, 10)
          );
          expect(periods[1]).toBeLessThan(periods[0]!);
          expect(periods[2]).toBeLessThan(periods[1]!);
        });

        it("주기 × 반복횟수가 durationFrames 총 길이에 맞는다", () => {
          const vars = screenShakeCssVariables(shake(5, 5, 8));
          const period = Number.parseInt(vars["--battle-shake-period"]!, 10);
          const iterations = Number.parseInt(vars["--battle-shake-iterations"]!, 10);
          const total = framesToMs(8);
          // 반올림 오차가 한 주기를 넘으면 안 된다.
          expect(Math.abs(period * iterations - total)).toBeLessThan(period);
        });

        it("세로 진폭은 가로보다 작다", () => {
          const vars = screenShakeCssVariables(shake(9, 5));
          expect(Number.parseFloat(vars["--battle-shake-y"]!)).toBeLessThan(Number.parseFloat(vars["--battle-shake-x"]!));
        });

        it("범위 밖 power/speed 를 1~9 로 접는다", () => {
          expect(screenShakeCssVariables(shake(99, 99))["--battle-shake-x"]).toBe(
            screenShakeCssVariables(shake(9, 9))["--battle-shake-x"]
          );
          expect(screenShakeCssVariables(shake(-3, 0))["--battle-shake-x"]).toBe(
            screenShakeCssVariables(shake(1, 1))["--battle-shake-x"]
          );
        });

        it("반복 횟수는 최소 1 이다", () => {
          expect(Number.parseInt(screenShakeCssVariables(shake(1, 1, 1))["--battle-shake-iterations"]!, 10)).toBeGreaterThanOrEqual(1);
        });
      });
      describe("BATTLE_EFFECT_CSS_VARIABLES", () => {
        it("두 생성기가 내는 모든 변수 이름을 빠짐없이 담는다", () => {
          // 목록에서 빠진 변수는 효과 없는 프레임에서 걷히지 않아 다음 효과로 새어 나간다.
          const produced = new Set([
            ...Object.keys(flashCssVariables(flash(255, 255, 255))),
            ...Object.keys(screenShakeCssVariables(shake(5, 5))),
          ]);
          for (const name of produced) expect(BATTLE_EFFECT_CSS_VARIABLES).toContain(name);
        });
      });
    });
    /**
     * 편집기 미리보기가 시트 배율을 존중한다.
     *
     * 미리보기는 RM px(320 시대) 좌표계로 그린다 — 96px 레거시 시트는 96 CSS px. 384px·0.5 시트도
     * 같은 96 CSS px 로 보여야 한다. 안 그러면 스킬 탭의 연출 카드와 이벤트 편집기의 애니메이션
     * 표시면이 384px 짜리 거대한 셀을 보여 준다.
     */
    describe("battleAnimationSheetScalePreview", () => {
      isolateTimers();
      let restoreDom: (() => void) | undefined;
      let previousImage: typeof globalThis.Image | undefined;
      beforeEach(() => {
        restoreDom = installFakeDom();
        previousImage = globalThis.Image;
        Object.defineProperty(globalThis, "Image", {
          configurable: true,
          value: class {
            addEventListener(): void {}
            set src(_value: string) {}
          },
        });
      });
      afterEach(() => {
        restoreDom?.();
        restoreDom = undefined;
        if (previousImage === undefined) {
          delete (globalThis as { Image?: unknown }).Image;
        } else {
          Object.defineProperty(globalThis, "Image", { configurable: true, value: previousImage });
        }
      });
      const HIRES: BattleAnimationSheet = { frameWidth: 384, frameHeight: 384, columns: 10, assetScale: 0.5 };
      const FRAMES: BattleAnimationFrame[] = [
        { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
        { cells: [{ pattern: 6, x: 12, y: -8, zoom: 50, opacity: 128, visible: true }] },
      ];
      function hiresRecord(project: ReturnType<typeof createBlankProject>): BattleAnimationRecord {
        const existing = project.database.battleAnimations.find((entry) => Boolean(entry.resourceId));
        return {
          id: "anim_hires",
          name: "고해상도",
          resourceId: existing?.resourceId,
          sheet: HIRES,
          frames: FRAMES,
          timings: [],
        };
      }
      describe("showAnimation 표시면", () => {
        it("384px·0.5 시트를 96 CSS px 프레임으로 그리고 배경 좌표도 같은 배율로 옮긴다", () => {
          const project = createBlankProject();
          const source = showAnimationPlaybackSource(hiresRecord(project), project);
          if (!source) throw new Error("재생 소스를 만들지 못했다");
          const layer = new FakeElement("div") as unknown as HTMLElement;

          renderShowAnimationFrame(layer, source, 1);

          const cell = findByTestId(layer as unknown as FakeElement, "show-animation-frame-cell");
          expect(cell?.style.getPropertyValue("--animation-frame-width")).toBe("96px");
          expect(cell?.style.getPropertyValue("--animation-frame-height")).toBe("96px");
          // pattern 6, 10열 → 6열 0행 → 시트 px (-2304, 0) × 0.25 = (-576px, 0px)
          expect(cell?.style.backgroundPosition).toBe("-576px -0px");
          expect(cell?.style.backgroundSize).toBe("960px auto");
          // 셀 오프셋은 RM px 그대로다.
          expect(cell?.style.transform).toBe("translate(12px, -8px) scale(0.5)");
        });
      });
      describe("데이터베이스 애니메이션 스테이지", () => {
        it("384px·0.5 시트의 스테이지 프레임 변수도 96px 이다", () => {
          const project = createBlankProject();
          const animation = hiresRecord(project);
          const panel = renderAnimationStagePanel({
            animation,
            currentSelectedFrameCells: () => FRAMES[0]!.cells.map((cell) => ({ ...cell })),
            duplicateLastFrame: vi.fn(),
            frames: FRAMES,
            project,
            selectedFrame: FRAMES[0]!,
            selectedFrameIndex: 0,
            sheet: HIRES,
            updateSelectedFrameCells: vi.fn(),
          });
          if (!(panel instanceof FakeElement)) throw new Error("Expected fake animation panel");
          const surface = findByTestId(panel, "db-animation-sheet-preview-surface");
          expect(surface?.style.getPropertyValue("--animation-frame-width")).toBe("96px");
          expect(surface?.style.getPropertyValue("--animation-frame-height")).toBe("96px");
          const target = findByTestId(panel, "db-animation-stage-target");
          expect(target?.style.backgroundSize).toBe("960px auto");
        });
      });
    });
  });
});

describe("panelsEventEditorSuite9", () => {
  isolateTimers();
  describe("commandBodyPage3Native", () => {
    isolateTimers();
    /**
     * showAnimation 명령 본문의 애니메이션 표시면 계약.
     *
     * 1) 미리보기 스테이지는 글리프가 아니라 선택 레코드의 시트 프레임을 실제로 재생한다.
     * 2) 한 본문에 애니메이션 표시면은 하나뿐이다(intentCard + fieldBlock 중복 제거).
     */
    describe("eventEditorShowAnimationPreview", () => {
      isolateTimers();
      type FakeBrowserGlobals = {
        readonly Image: typeof globalThis.Image | undefined;
        readonly window: typeof globalThis.window | undefined;
      };
      let restoreDom: (() => void) | undefined;
      let previousBrowserGlobals: FakeBrowserGlobals;
      function context(): CommandEditContext {
        return {
          path: [0],
          actions: {
            addCommand: vi.fn(),
            insertCommand: vi.fn(),
            replaceCommand: vi.fn(),
            deleteCommand: vi.fn(),
            moveCommand: vi.fn(),
            moveCommandTo: vi.fn(),
          },
        };
      }
      function animated(project: Project): BattleAnimationRecord {
        const record = project.database.battleAnimations.find(
          (entry) => (entry.frames?.length ?? 0) > 1 && Boolean(entry.resourceId)
        );
        if (!record) throw new Error("프레임을 가진 전투 애니메이션 레코드가 없다");
        return record;
      }
      function command(animationId: string): Extract<Command, { kind: "showAnimation" }> {
        return { kind: "showAnimation", target: "player", animationId };
      }
      function frameLayer(body: FakeElement): FakeElement {
        const layer = findByTestId(body, "show-animation-frame-layer");
        if (!layer) throw new Error("프레임 레이어가 없다");
        return layer;
      }
      /** 텍스트가 애니메이션 표제와 정확히 일치하는 노드를 센다(표시면 중복 감지). */
      function animationHeadings(root: FakeElement): FakeElement[] {
        const found: FakeElement[] = [];
        const walk = (node: FakeElement): void => {
          const text = node.textContent.trim();
          if (text === "애니메이션" || text === "애니메이션 표시") found.push(node);
          for (const child of node.children) walk(child);
        };
        walk(root);
        return found;
      }
      beforeEach(() => {
        restoreDom = installFakeDom();
        previousBrowserGlobals = { Image: globalThis.Image, window: globalThis.window };
        vi.useFakeTimers();
        Object.defineProperty(globalThis, "Image", {
          configurable: true,
          value: class {
            addEventListener(): void {}
            set src(_value: string) {}
          },
        });
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: { clearInterval: globalThis.clearInterval, setInterval: globalThis.setInterval },
        });
        store.replace(createBlankProject());
      });
      afterEach(() => {
        vi.useRealTimers();
        restoreDom?.();
        restoreDom = undefined;
        restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
        restoreBrowserGlobal("window", previousBrowserGlobals.window);
      });
      function restoreBrowserGlobal(name: "Image" | "window", value: unknown): void {
        if (value === undefined) {
          Reflect.deleteProperty(globalThis, name);
          return;
        }
        Object.defineProperty(globalThis, name, { configurable: true, value });
      }
      describe("showAnimation 본문 애니메이션 표시면", () => {
        it("선택 레코드의 시트 프레임을 실제로 재생한다(글리프 아님)", () => {
          const project = store.getCurrent();
          const record = animated(project);
          const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));

          const stage = findByTestId(body, "show-animation-preview-stage");
          expect(stage).not.toBeNull();
          expect(stage?.textContent).not.toContain("✦");

          const layer = frameLayer(body);
          expect(layer.dataset.frameIndex).toBe("0");
          const firstCell = findByTestId(layer, "show-animation-frame-cell");
          expect(firstCell).not.toBeNull();
          const firstPosition = firstCell?.style.backgroundPosition;

          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
          expect(layer.dataset.frameIndex).toBe("1");
          expect(findByTestId(layer, "show-animation-frame-cell")?.style.backgroundPosition).not.toBe(firstPosition);
        });

        it("재생 토글로 한 번 더 돌릴 수 있다", () => {
          const record = animated(store.getCurrent());
          const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));
          const play = findByTestId(body, "show-animation-play");
          expect(play).not.toBeNull();

          // 자동 1회 재생이 끝날 만큼 넘긴다.
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * ((record.frames?.length ?? 0) + 2));
          expect(play?.textContent).toBe("▶ 재생");
          expect(play?.attrs["aria-pressed"]).toBe("false");

          play?.click();
          expect(play?.textContent).toBe("■ 정지");
          expect(play?.attrs["aria-pressed"]).toBe("true");
          expect(frameLayer(body).dataset.frameIndex).toBe("0");
        });

        it("프레임이 없는 레코드는 깨진 스테이지 대신 라벨 붙은 섬광 대체면을 보여 준다", () => {
          const project = store.getCurrent();
          const legacy = project.database.battleAnimations[0];
          if (!legacy) throw new Error("전투 애니메이션 레코드가 없다");
          legacy.frames = [];

          const body = renderWithFakeDom(() => showAnimationBody(context(), command(legacy.id)));
          const fallback = findByTestId(body, "show-animation-preview-fallback");
          expect(fallback).not.toBeNull();
          expect(fallback?.textContent).toContain("프레임 없음");
          expect(findByTestId(body, "show-animation-frame-cell")).toBeNull();
          expect(findByTestId(body, "show-animation-play")).toBeNull();
        });

        it("한 프레임만 있는 새 레코드는 재생 버튼 대신 정지 화면이라고 밝힌다", () => {
          // 새로 만든 전투 애니메이션 레코드는 정규화 결과 기본 프레임 1장만 갖는다.
          const project = store.getCurrent();
          const single = project.database.battleAnimations[1];
          if (!single) throw new Error("전투 애니메이션 레코드가 없다");
          single.frames = [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] }];

          const body = renderWithFakeDom(() => showAnimationBody(context(), command(single.id)));
          expect(findByTestId(body, "show-animation-static-frame")).not.toBeNull();
          expect(findByTestId(body, "show-animation-frame-cell")).not.toBeNull();
          expect(findByTestId(body, "show-animation-play")).toBeNull();
        });

        it("애니메이션 표시면이 본문에 하나만 있다", () => {
          const record = animated(store.getCurrent());
          const body = renderWithFakeDom(() => showAnimationBody(context(), command(record.id)));

          expect(findByTestId(body, "show-animation-intent")).toBeNull();
          expect(findByTestId(body, "show-animation-surface")).not.toBeNull();
          expect(animationHeadings(body).map((node) => node.dataset.testid)).toEqual(["show-animation-surface-title"]);
        });

        it("반복 재생은 마지막 프레임 다음에 0으로 돌아가 계속 전진한다", () => {
          const source = {
            sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
            frames: [
              { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 2, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            ],
            url: undefined,
          };
          const stage = document.createElement("div");
          const layer = document.createElement("div");
          stage.append(layer);
          document.body.append(stage);

          playShowAnimation(stage, layer, source, { loop: true });

          expect(layer.dataset.frameIndex).toBe("0");
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 2);
          expect(layer.dataset.frameIndex).toBe("2");
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
          expect(layer.dataset.frameIndex).toBe("0");
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
          expect(layer.dataset.frameIndex).toBe("1");
          expect(vi.getTimerCount()).toBe(1);
        });

        it("프레임 콜백은 첫 렌더와 매 틱의 인덱스와 전체 프레임 수를 알린다", () => {
          const source = {
            sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
            frames: [
              { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            ],
            url: undefined,
          };
          const stage = document.createElement("div");
          const layer = document.createElement("div");
          stage.append(layer);
          document.body.append(stage);
          const onFrame = vi.fn();

          playShowAnimation(stage, layer, source, { loop: true, onFrame });
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 3);

          expect(onFrame.mock.calls).toEqual([
            [0, 2],
            [1, 2],
            [0, 2],
            [1, 2],
          ]);
        });

        it("반복 재생도 마운트된 스테이지가 분리되면 인터벌을 지운다", () => {
          const source = {
            sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
            frames: [
              { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            ],
            url: undefined,
          };
          const stage = new FakeElement("div") as unknown as HTMLElement;
          const layer = new FakeElement("div") as unknown as HTMLElement;
          const onStop = vi.fn();
          Object.defineProperty(stage, "isConnected", { configurable: true, value: true });

          playShowAnimation(stage, layer, source, { loop: true, onStop });
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
          expect(vi.getTimerCount()).toBe(1);

          Object.defineProperty(stage, "isConnected", { configurable: true, value: false });
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);

          expect(vi.getTimerCount()).toBe(0);
          expect(onStop).toHaveBeenCalledTimes(1);
        });

        it("기존 1회 재생은 끝에서 멈추고 첫 프레임으로 돌아간다", () => {
          const source = {
            sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
            frames: [
              { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 1, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
            ],
            url: undefined,
          };
          const stage = document.createElement("div");
          const layer = document.createElement("div");
          stage.append(layer);
          document.body.append(stage);
          const onStop = vi.fn();

          playShowAnimationOnce(stage, layer, source, onStop);
          expect(layer.dataset.frameIndex).toBe("0");
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
          expect(layer.dataset.frameIndex).toBe("1");
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);

          expect(layer.dataset.frameIndex).toBe("0");
          expect(onStop).toHaveBeenCalledTimes(1);
          expect(vi.getTimerCount()).toBe(0);
          vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 2);
          expect(layer.dataset.frameIndex).toBe("0");
          expect(onStop).toHaveBeenCalledTimes(1);
        });

        it("프레임 렌더러가 패턴을 시트 좌표로 옮긴다", () => {
          const project = store.getCurrent();
          const record: BattleAnimationRecord = {
            id: "anim_test",
            name: "테스트",
            resourceId: undefined,
            sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
            frames: [
              { cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] },
              { cells: [{ pattern: 6, x: 12, y: -8, zoom: 50, opacity: 128, visible: true }] },
            ],
          };
          const source = showAnimationPlaybackSource(record, project);
          if (!source) throw new Error("재생 소스를 만들지 못했다");
          const layer = new FakeElement("div") as unknown as HTMLElement;

          renderShowAnimationFrame(layer, source, 1);

          const cell = findByTestId(layer as unknown as FakeElement, "show-animation-frame-cell");
          expect(cell?.dataset.pattern).toBe("6");
          expect(cell?.style.backgroundPosition).toBe("-96px -96px");
          expect(cell?.style.transform).toBe("translate(12px, -8px) scale(0.5)");
          expect(cell?.style.opacity).toBe(String(128 / 255));
          expect((layer as unknown as FakeElement).dataset.frameIndex).toBe("1");
        });
      });
    });
    describe("setLightingPercent", () => {
      isolateTimers();
      describe("lighting percent authoring", () => {
        let restore: () => void;
        beforeEach(() => { restore = installFakeDom(); });
        afterEach(() => restore());
        it("converts percentages once and synchronizes slider, presets and preview", () => {
          const replaceCommand = vi.fn();
          const context: CommandEditContext = {
            path: [0], actions: { replaceCommand, addCommand: vi.fn(), insertCommand: vi.fn(),
              deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn() },
          };
          const body = renderWithFakeDom(() => setLightingBody(context, { kind: "setLighting", ambient: 0.35 }));
          const input = findByTestId(body, "set-lighting-ambient-input")!;
          const slider = findByTestId(body, "set-lighting-ambient-slider")!;
          const preview = () => findByTestId(body, "set-lighting-preview-stage")!;
          expect(input.value).toBe("35");
          expect(slider.value).toBe("35");
          expect(preview().children[0].style.opacity).toBe("0.35");
          input.value = "50";
          input.dispatchEvent(new Event("change"));
          expect(replaceCommand).toHaveBeenLastCalledWith([0], { kind: "setLighting", ambient: 0.5, color: "#000000" });
          expect(slider.value).toBe("50");
          expect(preview().children[0].style.opacity).toBe("0.5");
          slider.value = "75";
          slider.dispatchEvent(new Event("input"));
          expect(input.value).toBe("75");
          expect(preview().children[0].style.opacity).toBe("0.75");
          slider.dispatchEvent(new Event("change"));
          expect(replaceCommand.mock.calls.at(-1)?.[1].ambient).toBe(0.75);
          findByTestId(body, "set-lighting-preset-dusk")!.click();
          expect(input.value).toBe("35");
          expect(slider.value).toBe("35");
          expect(replaceCommand.mock.calls.at(-1)?.[1]).toMatchObject({ ambient: 0.35, transitionMs: 400 });
          expect(preview().children[0].style.opacity).toBe("0.35");
        });
      });
    });
    /**
     * 그림 표시 폼이 런타임이 지원하는 변환을 전부 노출해야 한다.
     *
     * 회귀 배경: 런타임은 확대·투명도·회전·전환시간을 모두 지원하는데(pictures/pictureTween.ts,
     * types/events.ts:315-318) 폼이 커밋하는 필드는 pictureId/resourceId/x/y 넷뿐이었다.
     * 감독이 "60%로 줄여 15도 기울여 페이드인" 을 하려면 AI 툴이나 JSON 손편집으로 우회해야 했다.
     */
    describe("showPictureForm", () => {
      isolateTimers();
      type ShowPicture = Extract<Command, { kind: "showPicture" }>;
      function stagedContext(initial: ShowPicture, onCommit?: (command: ShowPicture) => void): {
        readonly context: CommandEditContext;
        readonly current: () => ShowPicture;
      } {
        let staged = structuredClone(initial) as ShowPicture;
        return {
          context: {
            path: [1],
            actions: {
              addCommand: vi.fn(),
              insertCommand: vi.fn(),
              replaceCommand: (_path, command) => {
                if (command.kind !== "showPicture") throw new Error("unexpected command");
                staged = structuredClone(command);
                onCommit?.(staged);
              },
              deleteCommand: vi.fn(),
              moveCommand: vi.fn(),
              moveCommandTo: vi.fn(),
            },
            getCurrentCommand: () => staged,
          },
          current: () => staged,
        };
      }
      function change(node: FakeElement | null, value: string): void {
        expect(node).not.toBeNull();
        if (!node) return;
        node.value = value;
        node.dispatchEvent(new Event("change"));
      }
      const BASE: ShowPicture = { kind: "showPicture", pictureId: "pic1", resourceId: "", x: 0, y: 0 };
      let restoreDom: (() => void) | undefined;
      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });
      afterEach(() => {
        vi.unstubAllGlobals();
        restoreDom?.();
      });
      describe("그림 표시 폼", () => {
        it("확대·투명도·회전·전환시간 칸이 모두 있다", () => {
          const { context } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          for (const testId of [
            "show-picture-scale-input",
            "show-picture-opacity-input",
            "show-picture-rotation-input",
            "show-picture-duration-input",
          ]) {
            expect(findByTestId(body, testId), `${testId} 칸이 없다`).not.toBeNull();
          }
        });

        it("입력한 값이 커맨드에 실린다", () => {
          const { context, current } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));

          change(findByTestId(body, "show-picture-scale-input"), "60");
          change(findByTestId(body, "show-picture-opacity-input"), "50");
          change(findByTestId(body, "show-picture-rotation-input"), "15");
          change(findByTestId(body, "show-picture-duration-input"), "400");

          expect(current().scale).toBe(60);
          expect(current().opacity).toBe(128);
          expect(current().rotation).toBe(15);
          expect(current().durationMs).toBe(400);
        });

        it("기존 값이 있으면 칸에 채워진다", () => {
          const seeded: ShowPicture = { ...BASE, scale: 75, opacity: 200, rotation: -30, durationMs: 250 };
          const { context } = stagedContext(seeded);
          const body = renderWithFakeDom(() => showPictureBody(context, seeded));

          expect(findByTestId(body, "show-picture-scale-input")?.value).toBe("75");
          expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("78");
          expect(findByTestId(body, "show-picture-rotation-input")?.value).toBe("-30");
          expect(findByTestId(body, "show-picture-duration-input")?.value).toBe("250");
        });

        it("범위 밖 값은 폼에서 접어 런타임까지 새지 않는다", () => {
          const { context, current } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));

          change(findByTestId(body, "show-picture-opacity-input"), "9999");
          expect(current().opacity).toBe(255);

          change(findByTestId(body, "show-picture-opacity-input"), "-40");
          expect(current().opacity).toBe(0);

          change(findByTestId(body, "show-picture-scale-input"), "0");
          expect(current().scale).toBe(1);
        });

        it("회전은 한 바퀴를 넘겨도 접지 않는다", () => {
          const { context, current } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          change(findByTestId(body, "show-picture-rotation-input"), "540");
          expect(current().rotation).toBe(540);
        });

        it("완료까지 대기를 켜면 페이드가 끝난 뒤에야 다음 명령이 시작하도록 저장한다", () => {
          const seeded: ShowPicture = { ...BASE, durationMs: 800, waitForPicture: true };
          const { context, current } = stagedContext(seeded);
          const body = renderWithFakeDom(() => showPictureBody(context, seeded));
          const box = findByTestId(body, "show-picture-wait");
          expect(box?.checked).toBe(true);
          expect(body.textContent ?? "").toContain("페이드·이동이 끝난 뒤");

          if (box) {
            box.checked = false;
            box.dispatchEvent(new Event("change"));
          }
          expect(current().waitForPicture).toBeUndefined();
          expect(current().durationMs).toBe(800);

          if (box) {
            box.checked = true;
            box.dispatchEvent(new Event("change"));
          }
          expect(current().waitForPicture).toBe(true);
          expect(body.textContent ?? "").toContain("끝날 때까지 대기");
        });

        it("좌표만 바꿔도 기존 변환값이 날아가지 않는다", () => {
          const seeded: ShowPicture = { ...BASE, scale: 50, opacity: 100, rotation: 10, durationMs: 300, waitForPicture: true };
          const { context, current } = stagedContext(seeded);
          const body = renderWithFakeDom(() => showPictureBody(context, seeded));

          change(findByTestId(body, "show-picture-x-input"), "120");

          expect(current().x).toBe(120);
          expect(current().scale).toBe(50);
          expect(current().opacity).toBe(100);
          expect(current().rotation).toBe(10);
          expect(current().durationMs).toBe(300);
          expect(current().waitForPicture).toBe(true);
        });

        it("미리보기 문구가 런타임과 같은 좌상단 앵커라고 알린다", () => {
          const { context } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          // 예전 문구는 "중심 앵커" 였는데 런타임(transform-origin: top left)과 달랐다.
          const text = body.textContent ?? "";
          expect(text).toContain("왼쪽 위");
          expect(text).not.toContain("중심 앵커");
        });

        // 회귀: 불투명도 입력칸은 퍼센트(0~100)인데 미리보기가 255 로 나눠,
        // 100% 로 저작해도 반지가 opacity 0.39 로 보여 게임 화면과 어깃났다.
        it("미리보기 불투명도는 퍼센트를 그대로 반영한다", () => {
          const seeded: ShowPicture = { ...BASE, opacity: 255 };
          const { context } = stagedContext(seeded);
          const body = renderWithFakeDom(() => showPictureBody(context, seeded));

          expect(findByTestId(body, "show-picture-opacity-input")?.value).toBe("100");
          expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBe(1);
        });

        it("미리보기 불투명도는 입력 변경을 따라간다", () => {
          const { context } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));

          change(findByTestId(body, "show-picture-opacity-input"), "50");

          expect(Number(findByTestId(body, "show-picture-preview-marker")?.style.opacity)).toBeCloseTo(0.5, 3);
        });

        it("AI로 만들기 칸이 있다", () => {
          const { context } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          expect(findByTestId(body, "show-picture-ai-prompt"), "프롬프트 칸").not.toBeNull();
          expect(findByTestId(body, "show-picture-ai-generate"), "생성 버튼").not.toBeNull();
        });

        it("프롬프트로 그림을 만들면 업로드 리소스가 커맨드에 실린다", async () => {
          const png =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFHAP/q842iQAAAABJRU5ErkJggg==";
          vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
              new Response(
                JSON.stringify({
                  image: { dataUrl: png, mimeType: "image/png", model: "gemini-3.8-flash", provider: "google-antigravity" },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              ),
            ),
          );
          const committed = Promise.withResolvers<ShowPicture>();
          const { context, current } = stagedContext(BASE, committed.resolve);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          document.body.append(body as unknown as HTMLElement);
          const prompt = findByTestId(body, "show-picture-ai-prompt");
          expect(prompt).not.toBeNull();
          if (prompt) prompt.value = "달빛 창가";
          findByTestId(body, "show-picture-ai-generate")?.click();
          const deadline = setTimeout(() => committed.reject(new Error("image command was not committed")), 2000);
          try {
            await committed.promise;
          } finally {
            clearTimeout(deadline);
          }
          expect(current().resourceId.length).toBeGreaterThan(0);
          const resourceId = current().resourceId;
          expect(store.getCurrent().assets.uploaded[resourceId]?.kind).toBe("picture");
          expect(store.getCurrent().assets.uploaded[resourceId]?.dataUrl).toBe(png);
          vi.unstubAllGlobals();
        });

        it("빈 프롬프트는 요청하지 않는다", async () => {
          const fetchMock = vi.fn();
          vi.stubGlobal("fetch", fetchMock);
          const { context, current } = stagedContext(BASE);
          const body = renderWithFakeDom(() => showPictureBody(context, BASE));
          findByTestId(body, "show-picture-ai-generate")?.click();
          await Promise.resolve();
          expect(fetchMock).not.toHaveBeenCalled();
          expect(current().resourceId).toBe("");
          vi.unstubAllGlobals();
        });
      });
    });
  });
  // test/commandDiff.test.ts
  // before/after 명령 목록 비교 → 유령 행 계산 → 행 단위 제외 적용.
  describe("commandDiff", () => {
    isolateTimers();
    function text(body: string): Command {
      return { kind: "text", body } as Command;
    }
    describe("diffCommandLists", () => {
      it("문구만 달라진 한 줄은 삭제+추가가 아니라 «바뀜» 한 줄이다", () => {
        const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("change");
        expect(rows[0].before).toMatchObject({ body: "상자다" });
        expect(rows[0].after).toMatchObject({ body: "낡은 상자다" });
      });

      it("끝에 붙은 줄은 «새로 생김», 나머지는 «그대로»다", () => {
        const rows = diffCommandLists([text("안녕")], [text("안녕"), text("새 대사")]);
        expect(rows.map((row) => row.status)).toEqual(["keep", "add"]);
        expect(countCommandDiff(rows)).toEqual({ added: 1, removed: 0, changed: 0 });
      });

      it("사라진 줄은 «없어짐»이다", () => {
        const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
        expect(rows.map((row) => row.status)).toEqual(["keep", "remove"]);
        expect(countCommandDiff(rows)).toEqual({ added: 0, removed: 1, changed: 0 });
      });

      it("조건은 그대로인데 안쪽만 바뀌면 fork 는 «그대로»고 자식만 표시된다", () => {
        const before = [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [text("열었다")],
        } as Command];
        const after = [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [text("열었다"), text("비어 있다")],
        } as Command];

        const rows = diffCommandLists(before, after);
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe("keep");
        const then = rows[0].branches.find((branch) => branch.key === "forkThen")!;
        expect(then.label).toBe("조건이 맞을 때");
        expect(then.rows.map((row) => row.status)).toEqual(["keep", "add"]);
      });

      it("새로 생긴 fork 는 하위 트리 전체가 «새로 생김»이다", () => {
        const after = [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [text("비어 있다")],
          else: [text("회복약을 얻었다")],
        } as Command];
        const rows = diffCommandLists([], after);
        expect(rows[0].status).toBe("add");
        const branches = rows[0].branches.map((branch) => branch.key);
        expect(branches).toEqual(["forkThen", "forkElse"]);
        for (const branch of rows[0].branches) {
          expect(branch.rows.every((row) => row.status === "add")).toBe(true);
        }
        expect(countCommandDiff(rows)).toEqual({ added: 3, removed: 0, changed: 0 });
      });

      it("바뀌는 것이 없으면 hasChanges 는 false 다", () => {
        const rows = diffCommandLists([text("안녕")], [text("안녕")]);
        expect(hasCommandDiffChanges(rows)).toBe(false);
      });
    });
    describe("applyCommandDiff", () => {
      it("제외가 없으면 after 를 그대로 만든다", () => {
        const before = [text("안녕")];
        const after = [text("안녕"), text("잘 가")];
        const rows = diffCommandLists(before, after);
        expect(applyCommandDiff(rows)).toEqual(after);
      });

      it("추가를 빼면 그 줄만 안 들어간다", () => {
        const rows = diffCommandLists([text("안녕")], [text("안녕"), text("잘 가")]);
        const addRow = rows.find((row) => row.status === "add")!;
        expect(applyCommandDiff(rows, new Set([addRow.id]))).toEqual([text("안녕")]);
      });

      it("삭제를 빼면 원래 줄이 되살아난다", () => {
        const rows = diffCommandLists([text("안녕"), text("잘 가")], [text("안녕")]);
        const removeRow = rows.find((row) => row.status === "remove")!;
        expect(applyCommandDiff(rows, new Set([removeRow.id]))).toEqual([text("안녕"), text("잘 가")]);
      });

      it("바뀜을 빼면 원래 값이 남는다", () => {
        const rows = diffCommandLists([text("상자다")], [text("낡은 상자다")]);
        expect(applyCommandDiff(rows, new Set([rows[0].id]))).toEqual([text("상자다")]);
      });

      it("분기 안쪽 추가만 골라 뺄 수 있다", () => {
        const before = [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [text("열었다")],
        } as Command];
        const after = [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [text("열었다"), text("비어 있다")],
        } as Command];

        const rows = diffCommandLists(before, after);
        const inner = rows[0].branches[0].rows.find((row) => row.status === "add")!;
        expect(applyCommandDiff(rows, new Set([inner.id]))).toEqual(before);
        expect(applyCommandDiff(rows)).toEqual(after);
      });

      it("선택지 분기도 슬롯별로 유지된다", () => {
        const before = [{
          kind: "choices",
          prompt: "",
          options: [
            { text: "네", branch: [text("좋아")] },
            { text: "아니오", branch: [] },
          ],
          cancelBehavior: "none",
        } as unknown as Command];
        const after = structuredClone(before) as unknown as {
          options: { text: string; branch: Command[] }[];
        }[];
        after[0].options[1].branch = [text("알겠다")];

        const rows = diffCommandLists(before, after as unknown as Command[]);
        expect(rows[0].status).toBe("keep");
        expect(applyCommandDiff(rows)).toEqual(after);
      });
    });
  });
  describe("commentCommandBody", () => {
    isolateTimers();
    describe("comment command UX", () => {
      let restoreDom: (() => void) | undefined;
      let inserted: Command | undefined;

      const actions: CommandListActions = {
        addCommand: () => {},
        insertCommand: (_path, command) => {
          inserted = command;
        },
        replaceCommand: () => {},
        deleteCommand: () => {},
        moveCommand: () => {},
        moveCommandTo: () => {},
      };

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
        inserted = undefined;
      });

      afterEach(() => {
        restoreDom?.();
      });

      it("edits comment text and color through catalog controls without losing either field", () => {
        let cmd: Command = { ...newM2Command("m2-088-comment"), fields: { comment: "문 연 뒤 대사", color: "yellow" } };
        const body = renderWithFakeDom(() => renderCommandBody({
          path: [0], lockKind: true, getCurrentCommand: () => cmd,
          actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
        }, cmd));

        expect(findByTestId(body, "m2-command-body-m2-088-comment")).toBeTruthy();
        expect(findByTestId(body, "m2-command-comment-textarea")).toBeTruthy();
        const text = findByTestId(body, "m2-command-comment-textarea");
        const color = findByTestId(body, "m2-command-color-option-select");
        if (!text || !color) throw new Error("missing comment controls");
        expect(text.value).toBe("문 연 뒤 대사");
        expect(color.value).toBe("yellow");
        text.value = "수정된 주석";
        text.dispatchEvent(new Event("change"));
        color.value = "cyan";
        color.dispatchEvent(new Event("change"));
        expect(cmd).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "수정된 주석", color: "cyan" } });
      });

      it("summarizes comments without dumping field keys", () => {
        const parts = commandSummaryParts({
          kind: "m2Command",
          commandId: "m2-088-comment",
          fields: { comment: "컷신 시작", color: "cyan" },
        });
        const text = parts.map((part) => part.text).join("");
        expect(text).toContain("주석");
        expect(text).toContain("컷신 시작");
        expect(text).not.toContain("color:");
      });

      it("Ctrl+/ inserts a comment command via shortcut", () => {
        const item = new FakeElement("div");
        item.className = "cmd-item";
        const event = new Event("keydown", { bubbles: true, cancelable: true });
        Object.defineProperties(event, { ctrlKey: { value: true }, altKey: { value: false }, key: { value: "/" } });

        handleCommandShortcut(event as KeyboardEvent, {
          x: 0,
          y: 0,
          item: item as unknown as HTMLElement,
          command: { kind: "text", body: "x" },
          path: [0],
          actions,
          openEditor: () => {},
        });

        expect(event.defaultPrevented).toBe(true);
        expect(inserted).toBeUndefined();
        const text = document.querySelector<HTMLTextAreaElement>('[data-testid="m2-command-comment-textarea"]');
        if (!text) throw new Error("shortcut did not open comment editor");
        text.value = "shortcut comment";
        text.dispatchEvent(new Event("change"));
        document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-ok"]')?.click();
        expect(inserted).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "shortcut comment", color: "green" } });
      });

      it("moves the focused command with Alt+Up / Alt+Down (keyboard path for the row arrows)", () => {
        const moves: Array<[readonly number[], number]> = [];
        const item = new FakeElement("div");
        for (const [key, dir] of [["ArrowUp", -1], ["ArrowDown", 1]] as const) {
          const event = new Event("keydown", { bubbles: true, cancelable: true });
          Object.defineProperties(event, { ctrlKey: { value: false }, metaKey: { value: false }, altKey: { value: true }, key: { value: key } });
          handleCommandShortcut(event as KeyboardEvent, {
            x: 0, y: 0, item: item as unknown as HTMLElement, command: { kind: "text", body: "x" }, path: [2],
            actions: { ...actions, moveCommand: (path, d) => moves.push([path, d]) }, openEditor: () => {},
          });
          expect(event.defaultPrevented).toBe(true);
          expect(moves.at(-1)).toEqual([[2], dir]);
        }
      });
    });
  });
  describe("conditionCompile", () => {
    isolateTimers();
    describe("compileConditionFromText", () => {
      it("compiles night + switch AND friendship OR item sketches", () => {
        const project = createBlankProject();
        project.switches[0] = { id: "sw_door", name: "문 열림" };
        project.database.items[0] = {
          ...project.database.items[0]!,
          id: "item_key",
          name: "낡은 열쇠",
        };

        const andResult = compileConditionFromText("문 열림 AND 밤", project);
        expect(andResult.condition.kind).toBe("all");
        if (andResult.condition.kind === "all") {
          expect(andResult.condition.conditions.some((c) => c.kind === "timePhase")).toBe(true);
          expect(andResult.condition.conditions.some((c) => c.kind === "switch")).toBe(true);
        }

        const orResult = compileConditionFromText("호감 100 OR 낡은 열쇠", project);
        expect(orResult.condition.kind).toBe("any");

        const notResult = compileConditionFromText("NOT 밤", project);
        expect(notResult.condition).toEqual({
          kind: "not",
          condition: { kind: "timePhase", phase: "night" },
        });
      });

      it("evaluates compiled group conditions", () => {
        const project = createBlankProject();
        project.switches[0] = { id: "sw_a", name: "A" };
        const compiled = compileConditionFromText("A AND 낮", project);
        const session = startSession(project);
        session.switches.sw_a = true;
        // gameTime may be undefined → timePhase day can be false; just ensure eval does not throw
        expect(typeof evalCondition(session, compiled.condition)).toBe("boolean");
      });
    });
  });
  describe("conditionEvalPreview", () => {
    isolateTimers();
    const PLAY_TIME_KINDS: readonly { readonly name: string; readonly condition: Condition }[] = [
      { name: "timer", condition: { kind: "timer", timerId: "timer1", seconds: 10 } },
      { name: "timePhase", condition: { kind: "timePhase", phase: "morning" } },
      { name: "season", condition: { kind: "season", season: "spring" } },
      { name: "npcActivity", condition: { kind: "npcActivity", activity: "work" } },
      { name: "friendshipAtLeast", condition: { kind: "friendshipAtLeast", value: 0 } },
      { name: "battleResult", condition: { kind: "battleResult", result: "victory" } },
      { name: "run", condition: { kind: "run", query: "active", value: false } },
    ];
    describe("conditionEvalPreview", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
        editorState.set({ selectedEventId: "ev_test" });
      });

      afterEach(() => {
        editorState.set({ selectedEventId: null });
        restoreDom?.();
      });

      it("does not render a confident 충족/미충족 for play-time kinds the editor cannot justify", () => {
        for (const { name, condition } of PLAY_TIME_KINDS) {
          const root = renderWithFakeDom(() => renderConditionEvalPreview(condition));
          const undetermined = findByTestId(root, "event-condition-eval-undetermined");
          const badge = findByTestId(root, "event-condition-eval-badge");
          expect(findByTestId(root, "event-condition-eval"), name).toBeTruthy();
          expect(findByTestId(root, "event-condition-eval-summary"), name).toBeTruthy();
          expect(undetermined, `${name} should expose the undeterminable state`).toBeTruthy();
          expect(badge?.textContent, name).not.toBe("충족");
          expect(badge?.textContent, name).not.toBe("미충족");
          expect(badge?.textContent, name).not.toBe("불충족");
          expect(root.dataset.evalOk, name).not.toBe("true");
          expect(root.dataset.evalOk, name).not.toBe("false");
        }
      });

      it("still renders a 충족/불충족 verdict for start-state kinds", () => {
        const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
        const root = renderWithFakeDom(() =>
          renderConditionEvalPreview({ kind: "switch", switchId, value: false })
        );
        expect(findByTestId(root, "event-condition-eval-undetermined")).toBeNull();
        expect(findByTestId(root, "event-condition-eval-badge")?.textContent).toBe("충족");
        expect(root.dataset.evalOk).toBe("true");
      });

      it("evaluates timePhase/season against play-start gameTime when the time system is on", () => {
        const project = createBlankProject();
        project.system.timeSystem = { enabled: true };
        store.replace(project);

        const morning = renderWithFakeDom(() =>
          renderConditionEvalPreview({ kind: "timePhase", phase: "morning" })
        );
        expect(findByTestId(morning, "event-condition-eval-undetermined")).toBeNull();
        expect(findByTestId(morning, "event-condition-eval-badge")?.textContent).toBe("충족");
        expect(morning.dataset.evalOk).toBe("true");

        const night = renderWithFakeDom(() =>
          renderConditionEvalPreview({ kind: "timePhase", phase: "night" })
        );
        expect(findByTestId(night, "event-condition-eval-undetermined")).toBeNull();
        expect(findByTestId(night, "event-condition-eval-badge")?.textContent).toBe("불충족");
        expect(night.dataset.evalOk).toBe("false");

        const spring = renderWithFakeDom(() =>
          renderConditionEvalPreview({ kind: "season", season: "spring" })
        );
        expect(findByTestId(spring, "event-condition-eval-badge")?.textContent).toBe("충족");

        const winter = renderWithFakeDom(() =>
          renderConditionEvalPreview({ kind: "season", season: "winter" })
        );
        expect(findByTestId(winter, "event-condition-eval-badge")?.textContent).toBe("불충족");
      });

      it("evaluates insideLocation against the passed map — unknown without one", () => {
        const project = store.getCurrent();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        if (!map) throw new Error("missing start map");
        const { x, y } = project.startPos;
        map.locations = [{ id: "loc_badge", name: "배지 구역", x: x - 1, y: y - 1, w: 4, h: 4 }];
        const condition = { kind: "insideLocation", locationId: "loc_badge", inside: true } as const;
        // 맵을 넘기면 실제 판정(시작점이 구역 안이므로 충족) — 시뮬레이션과 같은 입력.
        const decided = renderWithFakeDom(() => renderConditionEvalPreview(condition, mapId));
        expect(findByTestId(decided, "event-condition-eval-badge")?.textContent).toBe("충족");
        // 맵 없이 호출하면 판정 불가 — 참/거짓을 지어내지 않는다.
        const unknown = renderWithFakeDom(() => renderConditionEvalPreview(condition));
        expect(findByTestId(unknown, "event-condition-eval-undetermined")).toBeTruthy();
      });
    });
  });
  describe("editorNpcSchedule", () => {
    isolateTimers();
    describe("NPC schedule editor", () => {
      let restoreDom: (() => void) | undefined;

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
      });

      afterEach(() => restoreDom?.());

      // Break caught: an NPC without a tool-authored schedule has no editor surface.
      it("renders for an empty schedule and authors every when/target field", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing start map");
        map.events.push({ id: "npc", x: 2, y: 3, trigger: { kind: "action" }, commands: [] });
        store.replace(project);

        const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;
        expect(host).toBeTruthy();
        findByTestId(host, "event-schedule-add")?.click();

        setValue(host, "event-schedule-time-phase-0", "evening");
        setChecked(host, "event-schedule-hour-enabled-0", true);
        setValue(host, "event-schedule-hour-start-0", "17");
        setValue(host, "event-schedule-hour-end-0", "19");
        setValue(host, "event-schedule-season-0", "fall");
        setChecked(host, "event-schedule-day-enabled-0", true);
        setValue(host, "event-schedule-day-start-0", "8");
        setValue(host, "event-schedule-day-end-0", "14");
        setValue(host, "event-schedule-x-0", "4");
        setValue(host, "event-schedule-y-0", "5");
        setValue(host, "event-schedule-facing-0", "left");
        setValue(host, "event-schedule-activity-0", "shop");

        expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toEqual({
          when: { timePhase: "evening", hourRange: [17, 19], season: "fall", dayRange: [8, 14] },
          at: { mapId: map.id, x: 4, y: 5 },
          facing: "left",
          activity: "shop",
        });
      });

      // Break caught: schedule rows can be added but not removed back to the empty state.
      it("deletes the authored schedule row", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing start map");
        map.events.push({
          id: "npc",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          schedule: [{ when: {}, at: { mapId: map.id, x: 2, y: 3 } }],
        });
        store.replace(project);
        const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

        findByTestId(host, "event-schedule-delete-0")?.click();

        expect(store.getCurrent().maps[map.id]?.events[0]?.schedule).toEqual([]);
      });

      // Break caught: an authored hour/day range cannot be cleared back to an always-matching condition.
      it("clears exact-time and day ranges independently", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing start map");
        map.events.push({
          id: "npc",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          schedule: [{
            when: { timePhase: "day", hourRange: [10, 16], season: "spring", dayRange: [2, 7] },
            at: { mapId: map.id, x: 2, y: 3 },
          }],
        });
        store.replace(project);
        const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

        setChecked(host, "event-schedule-hour-enabled-0", false);
        setChecked(host, "event-schedule-day-enabled-0", false);

        expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]?.when).toEqual({
          timePhase: "day",
          season: "spring",
        });
      });

      // Break caught: HTML min/max can be bypassed and invalid schedule coordinates are persisted.
      it("clamps bypassed hour, day, and target coordinate values", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing start map");
        map.events.push({
          id: "npc",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          schedule: [{ when: { hourRange: [6, 18], dayRange: [1, 28] }, at: { mapId: map.id, x: 2, y: 3 } }],
        });
        store.replace(project);
        const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

        setValue(host, "event-schedule-hour-start-0", "-10");
        setValue(host, "event-schedule-hour-end-0", "80");
        setValue(host, "event-schedule-day-start-0", "0");
        setValue(host, "event-schedule-day-end-0", "500");
        setValue(host, "event-schedule-x-0", "-3");
        setValue(host, "event-schedule-y-0", "9999");

        expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toMatchObject({
          when: { hourRange: [0, 48], dayRange: [1, 99] },
          at: { mapId: map.id, x: 0, y: map.height - 1 },
        });
      });

      // Break caught: an unconditional row before a conditional row shadows the later schedule silently.
      it("warns when an unconditional row shadows later rows", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("missing start map");
        map.events.push({
          id: "npc",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          schedule: [
            { when: {}, at: { mapId: map.id, x: 2, y: 3 } },
            { when: { timePhase: "night" }, at: { mapId: map.id, x: 3, y: 3 } },
          ],
        });
        store.replace(project);

        const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

        expect(findByTestId(host, "event-schedule-shadow-warning-0")).toBeTruthy();
      });
    });
    function setValue(host: FakeElement, testid: string, value: string): void {
      const control = findByTestId(host, testid);
      if (!control) throw new Error(`missing ${testid}`);
      control.value = value;
      control.dispatchEvent(new Event("change"));
    }
    function setChecked(host: FakeElement, testid: string, checked: boolean): void {
      const control = findByTestId(host, testid);
      if (!control) throw new Error(`missing ${testid}`);
      control.checked = checked;
      control.dispatchEvent(new Event("change"));
    }
  });
});
