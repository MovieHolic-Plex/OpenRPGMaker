import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { store } from "@/project/store";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import { m2CommandById, M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap, isM2CatalogEntrySelectableInBattleEvent } from "@/project/eventCommands/m2Catalog";
import { DEPRECATED_M2_COMMAND_IDS } from "@/project/eventCommands/m2CatalogData";
import {
  eventCommandPickerSearchEntries,
  eventCommandPickerTabEntries,
} from "@/editor/panels/eventEditor/commandPicker";
import type { M2CommandPickerPage } from "@/project/eventCommands/m2Catalog";
import { newCommand } from "@/editor/eventCommandFactory";
import { installFakeDom, renderWithFakeDom, findByTestId } from "./fakeDom";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { NestedBranchKind } from "@/editor/tools/commandTraversal";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import type { Command, GameEvent } from "@/project/types";

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
