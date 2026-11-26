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
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import type { Command, GameEvent } from "@/project/types";
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
        expect(deprecation!.reason.length).toBeGreaterThan(0);
        if (deprecation!.supersededByKind) {
          expect(deprecation!.supersededBy, id).toBeUndefined();
          continue;
        }
        expect(ids.has(deprecation!.supersededBy!), deprecation!.supersededBy).toBe(true);
        expect(DEPRECATED_M2_COMMAND_IDS[deprecation!.supersededBy!]).toBeUndefined();
      }
    });
  });

  describe("duplicate m2 commands merged into native kinds (load migration)", () => {
    const m2 = (commandId: string, fields: Record<string, string | number | boolean>): Command =>
      ({ kind: "m2Command", commandId, fields });

    function projectWith(commands: Command[]) {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const event: GameEvent = {
        id: "ev_merge",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        pages: [{
          id: "p1", name: "", conditions: [], commands,
          graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
        }],
        commands: [],
      };
      map.events = [event];
      project.commonEvents = [{ id: "common-merge", name: "c", trigger: "none", commands: [m2("m2-066-play-movie", { value: "intro.webm" })] }];
      return { project, event };
    }

    it("rewrites an old save holding both kinds into one native kind per command, then is idempotent", () => {
      const { project, event } = projectWith([
        m2("m2-050-set-weather-effects", { value: "rain", intensity: 0.8, transitionMs: 400 }),
        { kind: "setWeather", weather: "snow", intensity: 0.5, transitionMs: 0 },
        m2("m2-054-show-animation", { target: "this-event", animationId: "anim_hit", wait: "true" }),
        m2("m2-055-show-animation", { target: "player", animationId: "anim_heal", wait: "false" }),
        m2("m2-054-show-animation", { target: "ev_other", animationId: "anim_hit", wait: "false" }),
        { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: false },
        m2("m2-066-play-movie", { resourceId: "finale.webm", value: "old", wait: false, skippable: false }),
        { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [m2("m2-050-set-weather-effects", { value: "fog" })] },
      ]);

      expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(true);
      const commands = event.pages![0]!.commands;
      expect(commands.slice(0, 7)).toEqual([
        { kind: "setWeather", weather: "rain", intensity: 0.8, transitionMs: 400 },
        { kind: "setWeather", weather: "snow", intensity: 0.5, transitionMs: 0 },
        { kind: "showAnimation", target: { eventId: "" }, animationId: "anim_hit", wait: true },
        { kind: "showAnimation", target: "player", animationId: "anim_heal", wait: false },
        { kind: "showAnimation", target: { eventId: "ev_other" }, animationId: "anim_hit", wait: false },
        { kind: "showAnimation", target: "player", animationId: "anim_hit", wait: false },
        { kind: "playMovie", resourceId: "finale.webm", wait: false, skippable: false },
      ]);
      const fork = commands[7] as Extract<Command, { kind: "fork" }>;
      expect(fork.then[0]).toMatchObject({ kind: "setWeather", weather: "fog", transitionMs: 0 });
      expect(project.commonEvents[0]!.commands[0]).toEqual({ kind: "playMovie", resourceId: "intro.webm", wait: true, skippable: true });

      const merged = new Set(["m2-050-set-weather-effects", "m2-054-show-animation", "m2-055-show-animation", "m2-066-play-movie"]);
      const leftovers = JSON.stringify(project.maps).match(/m2-0(50|54|55|66)-/g) ?? [];
      expect(leftovers).toEqual([]);
      expect([...merged].every((id) => m2CommandById(id)?.deprecated)).toBe(true);
      expect(rewriteLegacyAdvancedDialogueInProject(project)).toBe(false);
    });
  });
});

// 「말투·연출」 저작 UI 를 지킨다 — 승격된 자리와, 프리뷰가 **언제** 연출을 재생하는지.
//
// 이 값은 스키마가 이미 갖고 있었고 에디터도 이미 저작하게 해 줬지만 접힌 「고급 옵션」
// 안에 있어서 아무도 쓰지 않았다. 이제 이 값이 창 등장 곡선·글자 속도·화면 연출을
// 고르므로 문장 쓰는 자리에 나와 있어야 한다. 되접히면 기능이 다시 안 보이게 죽는다.
//
// 그리고 재생 시점이 더 미묘하다. 프리뷰는 본문 한 글자마다 통째로 다시 그려지므로,
// 진입 연출을 늘 재생하면 창이 타자마다 튀어 **글을 쓸 수 없다.** 연출이 바뀐 순간에만
// 재생해야 한다. 둘 다 화면으로만 보면 놓치기 쉬워 여기서 못 박는다.
describe("dialoguePresentationAuthoring", () => {
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
  function textForm(cmd: Extract<Command, { kind: "text" }>, replaceCommand = vi.fn()) {
    const root = renderWithFakeDom(() => renderCoreCommandBody(ctx(replaceCommand), cmd)!) as FakeElement;
    const select = findByTestId(root, "event-command-text-emotion") as FakeElement;
    const body = findByTestId(root, "event-command-text-body") as FakeElement;
    const window = () => findByTestId(root, "ecp-message-window") as FakeElement | null;
    return { root, select, body, window, replaceCommand };
  }
  describe("「말투·연출」 저작", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("고급 옵션 밖에 상시 노출된다", () => {
      const { root, select } = textForm({ kind: "text", speaker: "미나", body: "안녕" });
      const field = findByTestId(root, "event-command-text-presentation") as FakeElement | null;
      expect(field, "「말투·연출」 필드가 없다").not.toBeNull();
      const advanced = findByTestId(root, "event-command-text-advanced") as FakeElement;
      expect(
        advanced.contains(field),
        "「말투·연출」이 접힌 고급 옵션 안으로 돌아갔다 — 기능이 다시 안 보이게 죽는다."
      ).toBe(false);
      expect(advanced.contains(select), "감정 선택이 고급 옵션 안에 남아 있다").toBe(false);
      // 접힌 자리에는 자동 넘김만 남는다.
      expect(advanced.textContent).toContain("자동 넘김");
      expect(advanced.textContent).not.toContain("말투");
    });

    it("창을 열 때는 정착 상태로 그린다", () => {
      // 편집창을 열었을 뿐인데 창이 튀면 무엇이 바뀐 신호인지 알 수 없다.
      const { window } = textForm({ kind: "text", body: "안녕", emotion: "happy" });
      expect(window()?.dataset.dialogueEmotion).toBe("happy");
      expect(window()?.dataset.dialoguePhase).toBeUndefined();
    });

    it("연출을 고른 순간에만 프리뷰가 진입을 재생한다", () => {
      const { select, body, window, replaceCommand } = textForm({ kind: "text", body: "안녕" });
      expect(window()?.dataset.dialogueEmotion).toBe("neutral");

      select.value = "happy";
      select.dispatchEvent(new Event("change"));
      const replayed = window();
      expect(replayed?.dataset.dialogueEmotion).toBe("happy");
      expect(replayed?.dataset.dialoguePhase, "연출을 바꿨는데 프리뷰가 재생하지 않는다").toBe("enter");

      // 같은 연출로 본문만 이어 쓰면 재생하지 않는다. 재생하면 타자마다 창이 튀어
      // 글을 쓸 수 없다 — 프리뷰가 매 입력마다 통째로 다시 그려지기 때문이다.
      body.value = "안녕하세요";
      body.dispatchEvent(new Event("input"));
      const typed = window();
      expect(typed?.dataset.dialogueEmotion).toBe("happy");
      expect(typed?.dataset.dialoguePhase, "타자마다 진입 연출이 재생된다 — 글을 쓸 수 없다.").toBeUndefined();

      // 값 형식은 그대로다: neutral 은 필드를 아예 남기지 않는다.
      expect(replaceCommand).toHaveBeenLastCalledWith([0], {
        kind: "text",
        speaker: undefined,
        body: "안녕하세요",
        emotion: "happy",
      });
      select.value = "neutral";
      select.dispatchEvent(new Event("change"));
      expect(replaceCommand).toHaveBeenLastCalledWith([0], {
        kind: "text",
        speaker: undefined,
        body: "안녕하세요",
      });
    });

    it("움직임을 끈 자리도 프리뷰가 알아본다", () => {
      // motion off 는 CSS 가 읽는 게이트다. 프리뷰가 이 값을 안 심으면
      // reduced-motion 안전망이 프리뷰에만 안 걸린다.
      const { window } = textForm({ kind: "text", body: "안녕", emotion: "angry" });
      expect(window()?.dataset.dialogueMotion).toBe("on");
    });
  });
});

describe("eventEditorFactionPicker", () => {
  isolateTimers();
  function context(replaceCommand = vi.fn()): CommandEditContext {
    return {
      path: [2],
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
  function command(a = "guard", b = "player"): Extract<Command, { kind: "changeFactionStance" }> {
    return { kind: "changeFactionStance", a, b, op: "-=", value: 1 };
  }
  describe("changeFactionStance faction pickers", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.factions = {
        defs: [
          { id: "guard", name: "경비대" },
          { id: "bandit", name: "산적단" },
        ],
        relations: [],
      };
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders both operands as labeled selects with reserved and authored factions, then writes a selection", () => {
      const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
      const body = renderWithFakeDom(() => renderCoreCommandBody(context(replaceCommand), command())!);
      const factionA = findByTestId(body, "event-command-faction-a");
      const factionB = findByTestId(body, "event-command-faction-b");

      expect(factionA?.tagName).toBe("SELECT");
      expect(factionB?.tagName).toBe("SELECT");
      expect(factionA?.closest("label")).not.toBeNull();
      expect(factionB?.closest("label")).not.toBeNull();
      const expectedIds = ["player", "enemy", "guard", "bandit"];
      expect(factionA?.children.map((option) => option.value)).toEqual(expectedIds);
      expect(factionB?.children.map((option) => option.value)).toEqual(expectedIds);
      expect(factionA?.children.map((option) => option.textContent)).toEqual([
        "플레이어 (player)",
        "적 (enemy)",
        "경비대 (guard)",
        "산적단 (bandit)",
      ]);

      if (!factionA) throw new Error("진영 A 선택기가 없습니다.");
      const value = findByTestId(body, "event-command-faction-value");
      if (!value) throw new Error("태도 값 입력기가 없습니다.");
      Object.defineProperty(value, "valueAsNumber", { configurable: true, value: 1 });
      factionA.value = "bandit";
      factionA.dispatchEvent(new Event("change"));

      expect(replaceCommand).toHaveBeenLastCalledWith([2], {
        kind: "changeFactionStance",
        a: "bandit",
        b: "player",
        op: "-=",
        value: 1,
      });
    });

    it("keeps a stored missing faction id visible and selected", () => {
      const body = renderWithFakeDom(() => renderCoreCommandBody(context(), command("gaurd"))!);
      const factionA = findByTestId(body, "event-command-faction-a");

      expect(factionA?.tagName).toBe("SELECT");
      expect(factionA?.value).toBe("gaurd");
      expect(factionA?.children.map((option) => option.value)).toContain("gaurd");
      expect(factionA?.children.find((option) => option.value === "gaurd")?.textContent).toContain("gaurd");
    });
  });
});
