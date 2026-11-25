import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { store } from "@/project/store";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import { m2CommandById, M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap, isM2CatalogEntrySelectableInBattleEvent, type M2CommandPickerPage } from "@/project/eventCommands/m2Catalog";
import { DEPRECATED_M2_COMMAND_IDS } from "@/project/eventCommands/m2CatalogData";
import { eventCommandPickerSearchEntries, eventCommandPickerTabEntries } from "@/editor/panels/eventEditor/commandPicker";
import { newCommand } from "@/editor/eventCommandFactory";
import { installFakeDom, renderWithFakeDom, findByTestId, FakeElement } from "./fakeDom";
import { commandBranches, type NestedBranchKind } from "@/editor/tools/commandTraversal";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command, GameEvent, BattleAnimationFlash, BattleAnimationScreenShake, BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet } from "@/project/types";
import { auxCompositeKey, bindAuxDetails, getAuxOpen, getAuxOpenSet, isAuxOpen, setAuxOpen, setAuxClosed, syncAuxHosts } from "@/editor/panels/eventEditor/auxOpenController";
import { battleAnimationAnchor, isScreenAnchoredAnimation, type BattleAnchorBox } from "@/player/battleAnimationAnchor";
import { BATTLE_EFFECT_CSS_VARIABLES, flashCssVariables, framesToMs, screenShakeCssVariables } from "@/player/battleAnimationEffectStyle";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";
import { renderShowAnimationFrame, showAnimationPlaybackSource } from "@/editor/panels/eventEditor/showAnimationPlayback";
import { renderAnimationStagePanel } from "@/editor/panels/databaseAnimationPreview";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { runCommandContract } from "./commandContracts/harness";
import { isolateTimers } from "./mergedTeardown";

describe("advancedDialogueMerge", () => {
  isolateTimers();
  function legacyDialogue(marker: string): Extract<Command, { kind: "m2Command" }> {
    return {
      kind: "m2Command",
      commandId: "m2-209-advanced-dialogue",
      fields: {
        speaker: `speaker:${marker}`,
        body: `body:${marker}`,
        emotion: `emotion:${marker}`,
        autoAdvance: true,
      },
    };
  }
  function branchContainers(): Record<NestedBranchKind, Command> {
    const commands: Record<NestedBranchKind, Command> = {
      choiceOption: { kind: "choices", options: [{ text: "option", branch: [] }] },
      choiceCancel: { kind: "choices", options: [], cancelBranch: [] },
      presentOption: { kind: "presentItem", options: [{ itemId: "item-1", branch: [] }] },
      presentOtherwise: { kind: "presentItem", options: [], otherwiseBranch: [] },
      presentCancel: { kind: "presentItem", options: [], cancelBranch: [] },
      forkThen: { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [] },
      forkElse: { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [], else: [] },
      loopBody: { kind: "loop", body: [] },
      shopTransaction: { kind: "shop", itemIds: [], transactionBranch: [] },
      shopFailure: { kind: "shop", itemIds: [], failedTransactionBranch: [] },
      innNotEnough: { kind: "inn", price: 1, notEnoughBranch: [] },
      promotionSuccess: { kind: "promoteActor", actorId: "actor-1", successBranch: [] },
      promotionFailure: { kind: "promoteActor", actorId: "actor-1", failureBranch: [] },
      evolutionSuccess: { kind: "evolveMonster", instanceId: "monster-1", successBranch: [] },
      evolutionFailure: { kind: "evolveMonster", instanceId: "monster-1", failureBranch: [] },
      battleVictory: {
        kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, victoryBranch: [],
      },
      battleDefeat: {
        kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, defeatBranch: [],
      },
      battleEscape: {
        kind: "battleProcessing", troopId: "troop-1", canEscape: true, canLose: true, escapeBranch: [],
      },
    };
    for (const [kind, command] of Object.entries(commands) as [NestedBranchKind, Command][]) {
      const branch = commandBranches(command).find((candidate) => candidate.kind === kind);
      if (!branch) throw new Error(`commandBranches did not expose ${kind}`);
      (branch.commands as Command[]).push(legacyDialogue(kind));
    }
    return commands;
  }
  function expectLegacyDialogueRewritten(commands: readonly Command[], location: string): void {
    const remaining = commands.filter(
      (command) => command.kind === "m2Command" && command.commandId === "m2-209-advanced-dialogue",
    );
    expect(remaining, `${location}: legacy m2-209 remained`).toHaveLength(0);
    expect(commands, `${location}: text rewrite did not preserve legacy fields`).toContainEqual({
      kind: "text",
      speaker: `speaker:${location}`,
      body: `body:${location}`,
      emotion: `emotion:${location}`,
      autoAdvance: true,
    });
  }
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
  describe("advanced dialogue merged into text", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("maps Advanced Dialogue catalog entry to native text kind", () => {
      const entry = m2CommandById("m2-209-advanced-dialogue");
      expect(entry?.existingKind).toBe("text");
      expect(entry?.bodyStrategy).toBe("existing");
    });

    it("rewrites legacy m2-209 commands into text with emotion/autoAdvance", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const event: GameEvent = {
        id: "ev_dialogue",
        x: 2,
        y: 2,
        pages: [
          {
            id: "p1",
            name: "",
            conditions: [],
            commands: [
              {
                kind: "m2Command",
                commandId: "m2-209-advanced-dialogue",
                fields: {
                  speaker: "미나",
                  portraitId: "face_mina",
                  emotion: "happy",
                  body: "숲으로 가자.",
                  autoAdvance: true,
                },
              },
            ],
            graphic: { transparent: true },
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
          },
        ],
        commands: [],
      };
      map.events = [event];
      expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);
      const cmd = event.pages![0]!.commands[0] as Extract<Command, { kind: "text" }>;
      expect(cmd.kind).toBe("text");
      expect(cmd.speaker).toBe("미나");
      expect(cmd.body).toBe("숲으로 가자.");
      expect(cmd.emotion).toBe("happy");
      expect(cmd.autoAdvance).toBe(true);
    });

    it("rewrites legacy m2-209 commands in every canonical branch and root command owner", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const containers = branchContainers();
      const event: GameEvent = {
        id: "ev_all_dialogue_locations",
        x: 2,
        y: 2,
        commands: [legacyDialogue("map.events[].commands"), ...Object.values(containers)],
        pages: [
          {
            id: "p1",
            name: "",
            conditions: [],
            commands: [legacyDialogue("event.pages[].commands")],
            graphic: { transparent: true },
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
          },
        ],
        trigger: { kind: "action" },
      };
      map.events = [event];
      project.commonEvents = [{
        id: "common-dialogue",
        name: "common dialogue",
        trigger: "none",
        commands: [legacyDialogue("project.commonEvents[].commands")],
      }];
      const troop = project.database.troops[0]!;
      troop.battleEventPages = [{
        id: "troop-dialogue",
        name: "troop dialogue",
        conditions: [],
        span: "battle",
        commands: [legacyDialogue("database.troops[].battleEventPages[].commands")],
      }];

      expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);

      expectLegacyDialogueRewritten([event.commands[0]!], "map.events[].commands");
      expectLegacyDialogueRewritten(event.pages![0]!.commands, "event.pages[].commands");
      expectLegacyDialogueRewritten(project.commonEvents[0]!.commands, "project.commonEvents[].commands");
      expectLegacyDialogueRewritten(
        troop.battleEventPages[0]!.commands,
        "database.troops[].battleEventPages[].commands",
      );
      for (const [kind, container] of Object.entries(containers) as [NestedBranchKind, Command][]) {
        const branch = commandBranches(container).find((candidate) => candidate.kind === kind);
        expect(branch, `${kind}: commandBranches no longer exposes this branch`).toBeDefined();
        expectLegacyDialogueRewritten(branch!.commands, kind);
      }
    });

    it("exposes emotion and autoAdvance on the text form", () => {
      const body = renderWithFakeDom(() =>
        renderCoreCommandBody(ctx(), {
          kind: "text",
          speaker: "미나",
          body: "안녕",
          emotion: "happy",
          autoAdvance: true,
        })!
      );
      expect(findByTestId(body, "event-command-text-editor")).not.toBeNull();
      expect(findByTestId(body, "event-command-text-advanced")).not.toBeNull();
      expect(findByTestId(body, "event-command-text-emotion")?.tagName).toBe("SELECT");
      expect(findByTestId(body, "event-command-text-auto-advance")?.tagName).toBe("INPUT");
    });

    it("newCommand(text) stays flat without advanced fields", () => {
      const cmd = newCommand("text");
      expect(cmd).toEqual({ kind: "text", speaker: "", body: "" });
    });

    // 이 세 가지가 "통합됐다"는 말의 증거다. 종전엔 라벨 문자열 필터(`!== "고급 대화"`)가
    // 말줄임 붙은 실제 라벨("고급 대화...")을 맞추지 못해 탭 1 「말하기」에 그대로 남아 있었다.
    it("is not authorable from any picker tab", () => {
      const pages: readonly M2CommandPickerPage[] = [1, 2, 3, 4];
      for (const page of pages) {
        const labels = eventCommandPickerTabEntries(page).map((entry) => entry.label);
        expect(labels.filter((label) => label.startsWith("고급 대화")), `탭 ${page}`).toEqual([]);
      }
    });

    it("is not authorable from the all-tab search list either", () => {
      const entries = eventCommandPickerSearchEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.filter((entry) => entry.commandId === "m2-209-advanced-dialogue")).toEqual([]);
    });

    it("marks m2-209 deprecated and unselectable in map and battle pickers", () => {
      const entry = m2CommandById("m2-209-advanced-dialogue")!;
      expect(entry.deprecated?.supersededBy).toBe("m2-001-show-text");
      expect(isM2CatalogEntrySelectableInMap(entry)).toBe(false);
      expect(isM2CatalogEntrySelectableInBattleEvent(entry)).toBe(false);
    });

    it("keeps the deprecation registry pointing at live catalog entries", () => {
      const ids = new Set(M2_COMMAND_CATALOG.map((catalogEntry) => catalogEntry.id));
      const registered = Object.entries(DEPRECATED_M2_COMMAND_IDS);
      expect(registered.length).toBeGreaterThan(0);
      for (const [id, deprecation] of registered) {
        expect(ids.has(id), id).toBe(true);
        expect(ids.has(deprecation!.supersededBy), deprecation!.supersededBy).toBe(true);
        expect(DEPRECATED_M2_COMMAND_IDS[deprecation!.supersededBy]).toBeUndefined();
        expect(deprecation!.reason.length).toBeGreaterThan(0);
      }
    });
  });
});

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

describe("changeExpCommandBody", () => {
  isolateTimers();
  describe("changeExp modern form + variable operand", () => {
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
      if (project.variables[0]) project.variables[0].name = "Quest EXP";
      store.replace(project);
      staged = { kind: "changeExp", actorId: "", op: "+=", amount: 10 };
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("폼에 대상/연산/경험치 소스/변수 피커를 노출한다", () => {
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      expect(findByTestId(body, "event-command-exp-form")).toBeTruthy();
      expect(findByTestId(body, "change-exp-target-mode")).toBeTruthy();
      expect(findByTestId(body, "change-exp-amount-source")).toBeTruthy();
      expect(findByTestId(body, "change-exp-amount-input")).toBeTruthy();
      expect(findByTestId(body, "change-exp-hint")).toBeNull();
    });

    it("경험치 소스를 변수로 바꾸면 amount 가 {kind:var} 로 저장된다", () => {
      const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const source = findByTestId(body, "change-exp-amount-source") as unknown as HTMLSelectElement;
      source.value = "variable";
      source.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("changeExp");
      if (staged.kind !== "changeExp") return;
      expect(typeof staged.amount).toBe("object");
      if (typeof staged.amount === "number") return;
      expect(staged.amount.kind).toBe("var");

      const operand = findByTestId(body, "change-exp-amount-variable") as unknown as HTMLElement;
      expect(operand.hidden).toBe(false);
      const select = operand.querySelector("select") as HTMLSelectElement | null;
      expect(select).toBeTruthy();
      if (!select) return;
      select.value = variableId;
      select.dispatchEvent(new Event("change"));
      if (staged.kind !== "changeExp" || typeof staged.amount === "number") return;
      expect(staged.amount.id).toBe(variableId);
    });

    it("대상 주인공 모드에서 actorId 를 저장한다", () => {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
      const body = renderWithFakeDom(() =>
        renderCommandBody({ path: [0], actions, lockKind: true }, staged)
      );
      const target = findByTestId(body, "change-exp-target-mode") as unknown as HTMLSelectElement;
      target.value = "actor";
      target.dispatchEvent(new Event("change"));
      const actorSelect = findByTestId(body, "change-exp-actor-select") as unknown as HTMLSelectElement;
      actorSelect.value = actorId;
      actorSelect.dispatchEvent(new Event("change"));
      expect(staged.kind).toBe("changeExp");
      if (staged.kind !== "changeExp") return;
      expect(staged.actorId).toBe(actorId);
    });

    it("preserves a variable operand while changing the operation on an existing command", () => {
      const variableId = store.getCurrent().variables[0]?.id;
      if (!variableId) throw new Error("missing variable fixture");
      staged = { kind: "changeExp", actorId: "", op: "+=", amount: { kind: "var", id: variableId } };
      const body = renderWithFakeDom(() => renderCommandBody({ path: [0], actions, lockKind: true }, staged));
      const operation = findByTestId(body, "change-exp-op-select");
      if (!operation) throw new Error("missing operation");
      operation.value = "-=";
      operation.dispatchEvent(new Event("change"));
      expect(staged).toEqual({ kind: "changeExp", actorId: "", op: "-=", amount: { kind: "var", id: variableId } });
    });

    it("요약에 파티 전체와 변수 경험치를 표시한다", () => {
      const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
      expect(commandSummary({
        kind: "changeExp",
        actorId: "",
        op: "+=",
        amount: { kind: "var", id: variableId },
      })).toContain("파티 전체");
      expect(commandSummary({
        kind: "changeExp",
        actorId: "",
        op: "+=",
        amount: { kind: "var", id: variableId },
      })).toContain("Quest EXP");
    });

    it("런타임: 변수 경험치로 단일 액터를 증가시킨다", () => {
      const actorId = "actor_hero";
      const result = runCommandContract([
        { kind: "setVariable", variableId: "var_exp_pay", op: "=", value: 40 },
        { kind: "changeExp", actorId, op: "+=", amount: { kind: "var", id: "var_exp_pay" } },
      ], {
        mutateSession: (session) => {
          session.actorExperience = { [actorId]: 10 };
        },
      });
      expect(result.session.actorExperience?.[actorId]).toBe(50);
      expect(result.finished).toBe(true);
    });

    it("런타임: 파티 전체에 숫자 경험치를 적용한다", () => {
      const result = runCommandContract([
        { kind: "changeExp", actorId: "", op: "+=", amount: 25 },
      ], {
        mutateSession: (session) => {
          session.partyActorIds = ["actor_a", "actor_b"];
          session.actorExperience = { actor_a: 5, actor_b: 15 };
        },
      });
      expect(result.session.actorExperience?.actor_a).toBe(30);
      expect(result.session.actorExperience?.actor_b).toBe(40);
    });

    it("런타임: 숫자 금액 레거시 형태도 유지한다", () => {
      const result = runCommandContract([
        { kind: "changeExp", actorId: "actor_hero", op: "-=", amount: 25 },
      ], {
        mutateSession: (session) => {
          session.actorExperience = { actor_hero: 30 };
        },
      });
      expect(result.session.actorExperience?.actor_hero).toBe(5);
    });
  });
});
