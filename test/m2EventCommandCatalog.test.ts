import { describe, expect, it, vi } from "vitest";
import {
  createDefaultM2Fields,
  isM2CatalogEntrySelectableInBattleEvent,
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  m2CommandById,
} from "@/editor/eventCommands/m2Catalog";
import { commandRuntimeSupport, m2CommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";
import { newM2Command } from "@/editor/eventCommandFactory";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import type { Frame, InterpreterState } from "@/player/interpreter/types";
import type { PlaySessionLike } from "@/player/types";

describe("m2 event command catalog", () => {
  it("covers every non-front-matter PDF command row with stable ids", () => {
    const pdfEntries = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108);

    expect(pdfEntries).toHaveLength(108);
    expect(M2_COMMAND_CATALOG).toHaveLength(125);
    expect(new Set(M2_COMMAND_CATALOG.map((entry) => entry.id)).size).toBe(125);
    expect(pageCount(1)).toBe(21);
    expect(pageCount(2)).toBeGreaterThan(0);
    expect(pageCount(3)).toBeGreaterThan(0);
    expect(pdfEntries.filter((entry) => entry.pickerPage === 4).length).toBeGreaterThan(0);
  });

  it("classifies the required validation commands explicitly", () => {
    expect(requireEntry("Display Text Settings").existingKind).toBe("displayTextSettings");
    expect(requireEntry("Return to Title Screen").existingKind).toBe("returnToTitle");
    expect(requireEntry("Shop Processing").existingKind).toBe("shop");
    expect(requireEntry("Inn Processing").existingKind).toBe("inn");
    expect(requireEntry("Input Number").existingKind).toBe("inputNumber");
    expect(requireEntry("Key Input Processing").existingKind).toBe("inputWait");
    expect(requireEntry("Wait").existingKind).toBe("wait");
    expect(requireEntry("Change Skills").existingKind).toBe("learnSkill");
    expect(requireEntry("Change Skills").runtimeSupport).toBe("runtime-full");
    expect(requireEntry("Change Equipment").existingKind).toBe("changeEquipment");
    expect(requireEntry("Change HP").existingKind).toBe("changeActorHp");
    expect(requireEntry("Change MP").existingKind).toBe("changeActorMp");
    expect(requireEntry("Recover All").existingKind).toBe("recoverAll");
    expect(requireEntry("Change EXP").existingKind).toBe("changeExp");
    expect(requireEntry("Change Level").existingKind).toBe("changeLevel");
    expect(M2_COMMAND_CATALOG.some((entry) => entry.title === "Ending")).toBe(false);
  });

  it("keeps the normal map picker limited to map-safe commands", () => {
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Show Text"))).toBe(true);
    expect(requireEntry("Comment").runtimeSupport).toBe("editor-only");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Comment"))).toBe(true);
    expect(requireEntry("Display Text Settings").runtimeSupport).toBe("runtime-full");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Display Text Settings"))).toBe(true);
    expect(requireEntry("Open Load Menu").runtimeSupport).toBe("runtime-partial");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Open Load Menu"))).toBe(true);
    expect(requireEntry("Break Loop").runtimeSupport).toBe("runtime-full");
    expect(requireEntry("Break Loop").existingKind).toBe("breakLoop");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Break Loop"))).toBe(true);
    expect(requireEntry("Loop").existingKind).toBe("loop");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Loop"))).toBe(true);
    expect(requireEntry("Move Picture").runtimeSupport).toBe("runtime-partial");
    expect(requireEntry("Move Picture").bodyStrategy).toBe("generic");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Move Picture"))).toBe(true);
    expect(requireEntry("Change Enemy HP").runtimeSupport).toBe("runtime-full");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Enemy HP"))).toBe(false);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Skills"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Equipment"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change HP"))).toBe(true);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Recover All"))).toBe(true);
  });

  it("selects every non-battle PDF row in the map picker and excludes battle-only rows", () => {
    const mapRows = M2_COMMAND_CATALOG.filter((entry) => entry.index <= 108 && isM2CatalogEntrySelectableInMap(entry));

    expect(mapRows.map((entry) => entry.index)).toEqual(Array.from({ length: 97 }, (_, index) => index + 1));
    const pageOneRows = mapRows.filter((entry) => entry.pickerPage === 1);
    const pageOneGroupsByTitle = new Map(pageOneRows.map((entry) => [entry.title, entry.pickerGroup]));
    expect(pageOneRows.map((entry) => entry.title)).toEqual(
      expect.arrayContaining([
      "Show Text",
      "Display Text Settings",
      "Change Faceset",
      "Show Choices",
      "Input Number",
      "Control Switches",
      "Control Variables",
      "Change Gold",
      "Change Items",
      "Shop Processing",
      "Inn Processing",
      "Transfer Player",
      "Move Event",
      "Wait for All Movement",
      "Wait",
      "Play BGM",
      "Fadeout BGM",
      "Play SE",
      "Conditional Branch",
      "Comment",
      "Erase Event",
      ])
    );
    expect(pageOneRows).toHaveLength(21);
    expect(pageOneGroupsByTitle.get("Show Text")).toBe("대화/입력");
    expect(pageOneGroupsByTitle.get("Control Switches")).toBe("조건/흐름");
    expect(pageOneGroupsByTitle.get("Conditional Branch")).toBe("조건/흐름");
    expect(pageOneGroupsByTitle.get("Transfer Player")).toBe("맵/이동");
    expect(pageOneGroupsByTitle.get("Erase Event")).toBe("맵/이동");
    expect(pageOneGroupsByTitle.get("Change Gold")).toBe("보상/상점");
    expect(pageOneGroupsByTitle.get("Play BGM")).toBe("소리");
    expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change EXP");
    expect(pageOneRows.map((entry) => entry.title)).not.toContain("Change System BGM");
    expect(new Set(pageOneRows.map((entry) => entry.pickerGroup))).toEqual(
      new Set(["대화/입력", "조건/흐름", "보상/상점", "맵/이동", "소리"])
    );
    for (const page of [1, 2, 3, 4] as const) {
      expect(new Set(mapRows.filter((entry) => entry.pickerPage === page).map((entry) => entry.pickerGroup)).size).toBeGreaterThan(
        0
      );
    }
  });

  it("allows battle-only commands only in troop battle event authoring", () => {
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Enemy Encounter"))).toBe(false);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Battleback"))).toBe(false);

    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Enemy Encounter"))).toBe(true);
    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Change Battleback"))).toBe(true);
    expect(isM2CatalogEntrySelectableInBattleEvent(requireEntry("Open Load Menu"))).toBe(false);
    expect(createDefaultM2Fields(requireEntry("Enemy Encounter"))).toEqual({ target: "" });
    expect(createDefaultM2Fields(requireEntry("Change Battleback"))).toEqual({ resourceId: "" });
  });

  it("keeps duplicate Show Animation sections as separate catalog features", () => {
    const showAnimations = M2_COMMAND_CATALOG.filter((entry) => entry.title === "Show Animation");

    expect(showAnimations).toHaveLength(3);
    expect(new Set(showAnimations.map((entry) => entry.id)).size).toBe(3);
  });

  it("creates typed default fields for every generic m2 command", () => {
    const genericEntries = M2_COMMAND_CATALOG.filter((entry) => !entry.existingKind);

    expect(genericEntries.length).toBeGreaterThan(70);
    for (const entry of genericEntries) {
      const command = newM2Command(entry.id);
      expect(command).toEqual({
        kind: "m2Command",
        commandId: entry.id,
        fields: createDefaultM2Fields(entry),
      });
      expect(m2CommandById(command.commandId)).toBe(entry);
    }
  });

  it("adds a complete modern command group without hiding it behind legacy PDF-only rows", () => {
    const modernTitles = [
      "Camera Control",
      "Screen Effect",
      "Spawn Event",
      "Remove Event",
      "Pathfind Move",
      "Wait Until",
      "Region Trigger",
      "Quest Objective",
      "Advanced Dialogue",
      "Sound Layer",
      "Weighted Branch",
      "Cutscene Control",
      "Checkpoint Save",
      "UI Command",
      "Debug Log",
      "Evaluate Expression",
      "Data Query",
    ];

    for (const title of modernTitles) {
      const entry = requireEntry(title);
      expect(entry.runtimeSupport).toBe("runtime-partial");
      expect(entry.bodyStrategy).toBe("generic");
      expect(entry.pickerPage).toBe(4);
      expect(isM2CatalogEntrySelectableInMap(entry)).toBe(true);
      expect(createDefaultM2Fields(entry)).not.toEqual({});
      expect(entry.label).not.toBe(title);
    }
  });

  it("publishes only the three runtime support grades", () => {
    const grades = new Set(M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport));
    expect(grades).toEqual(new Set(["runtime-full", "runtime-partial", "editor-only"]));
    expect(M2_COMMAND_CATALOG.map((entry) => entry.supportStatus)).toEqual(
      M2_COMMAND_CATALOG.map((entry) => entry.runtimeSupport)
    );
    expect(requireEntry("Comment").supportStatus).toBe("editor-only");
    // 6A-1 머지로 Key Input Processing이 네이티브 inputWait에 매핑되어 runtime-full로 승격됨.
    expect(requireEntry("Key Input Processing").supportStatus).toBe("runtime-full");
    expect(requireEntry("Show Text").supportStatus).toBe("runtime-full");
    expect(requireEntry("Change Parameters").supportStatus).toBe("runtime-full");
    expect(requireEntry("Change State").supportStatus).toBe("runtime-full");
    expect(requireEntry("Damage Processing").supportStatus).toBe("runtime-full");
    expect(requireEntry("Change Actor Graphic").supportStatus).toBe("runtime-full");
    expect(requireEntry("Scroll Map").supportStatus).toBe("runtime-full");
  });

  it("keeps the support table aligned with implemented battle M2 ids", () => {
    const fullBattleIds = M2_COMMAND_CATALOG
      .filter((entry) => entry.index >= 98 && entry.index <= 108 && entry.runtimeSupport === "runtime-full")
      .map((entry) => entry.id);

    expect(fullBattleIds).toEqual([
      "m2-098-change-enemy-hp",
      "m2-101-enemy-encounter",
      "m2-102-change-battleback",
      "m2-107-force-escape",
      "m2-108-action-times",
    ]);
    for (const entry of M2_COMMAND_CATALOG.filter((candidate) => !candidate.existingKind)) {
      expect(m2CommandRuntimeSupport(entry.id)).toBe(entry.runtimeSupport);
      expect(commandRuntimeSupport(newM2Command(entry.id))).toBe(entry.runtimeSupport);
    }
  });

  it("does not let generic editor-only m2 commands fall through the interpreter unknown branch", () => {
    const entry = requireEntry("Comment");
    const command = newM2Command(entry.id);
    const frame: Frame = { commands: [command], pc: 0 };
    const state: InterpreterState = {
      stack: [frame],
      session: createSession(),
      maxStackDepth: 8,
      maxLoopIterations: 8,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = executeCommand(state, frame, command);

    expect(result).toEqual({ kind: "continue" });
    expect(frame.pc).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("applies display text settings in the map interpreter runtime path", () => {
    const entry = requireEntry("Display Text Settings");
    const command = newM2Command(entry.id);
    const frame: Frame = { commands: [command], pc: 0 };
    const state: InterpreterState = {
      stack: [frame],
      session: createSession(),
      maxStackDepth: 8,
      maxLoopIterations: 8,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = executeCommand(state, frame, command);

    expect(result).toEqual({ kind: "continue" });
    expect(frame.pc).toBe(1);
    expect(warn).not.toHaveBeenCalled();
    expect(state.session.messageWindowSettings).toEqual({
      format: "normal",
      position: "bottom",
      preventObscuringPlayer: true,
      allowEventMovementDuringWait: false,
    });
    warn.mockRestore();
  });
});

function pageCount(page: 1 | 2 | 3 | 4): number {
  return M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page).length;
}

function requireEntry(title: string) {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`Missing m2 command catalog entry: ${title}`);
  return entry;
}

function createSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_test",
    x: 0,
    y: 0,
  };
}
