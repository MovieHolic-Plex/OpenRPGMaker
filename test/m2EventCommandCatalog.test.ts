import { describe, expect, it, vi } from "vitest";
import {
  createDefaultM2Fields,
  isM2CatalogEntrySelectableInBattleEvent,
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  m2CommandById,
} from "@/editor/eventCommands/m2Catalog";
import { newM2Command } from "@/editor/eventCommandFactory";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import type { Frame, InterpreterState } from "@/player/interpreter/types";
import type { PlaySessionLike } from "@/player/types";

describe("m2 event command catalog", () => {
  it("covers every non-front-matter PDF command row with stable ids", () => {
    expect(M2_COMMAND_CATALOG).toHaveLength(108);
    expect(new Set(M2_COMMAND_CATALOG.map((entry) => entry.id)).size).toBe(108);
    expect(pageCount(1)).toBe(30);
    expect(pageCount(2)).toBe(30);
    expect(pageCount(3)).toBe(30);
    expect(pageCount(4)).toBe(18);
  });

  it("classifies the required validation commands explicitly", () => {
    expect(requireEntry("Display Text Settings").existingKind).toBe("displayTextSettings");
    expect(requireEntry("Return to Title Screen").existingKind).toBe("returnToTitle");
    expect(requireEntry("Shop Processing").existingKind).toBe("shop");
    expect(requireEntry("Inn Processing").existingKind).toBe("inn");
    expect(requireEntry("Input Number").existingKind).toBe("inputNumber");
    expect(requireEntry("Wait").existingKind).toBe("wait");
    expect(requireEntry("Change Skills").runtimeClassification).toBe("missing-runtime");
    expect(M2_COMMAND_CATALOG.some((entry) => entry.title === "Ending")).toBe(false);
  });

  it("keeps the normal map picker limited to map-safe commands", () => {
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Show Text"))).toBe(true);
    expect(requireEntry("Comment").runtimeClassification).toBe("editor-only");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Comment"))).toBe(true);
    expect(requireEntry("Display Text Settings").runtimeClassification).toBe("runtime");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Display Text Settings"))).toBe(true);
    expect(requireEntry("Open Load Menu").runtimeClassification).toBe("shell");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Open Load Menu"))).toBe(false);
    expect(requireEntry("Change Enemy HP").runtimeClassification).toBe("battle-only");
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Enemy HP"))).toBe(false);
    expect(isM2CatalogEntrySelectableInMap(requireEntry("Change Skills"))).toBe(false);
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

  it("does not let generic editor-only m2 commands fall through the interpreter unknown branch", () => {
    const entry = requireEntry("Comment");
    const command = newM2Command(entry.id);
    const frame: Frame = { commands: [command], pc: 0 };
    const state: InterpreterState = {
      stack: [frame],
      session: createSession(),
      maxStackDepth: 8,
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = executeCommand(state, frame, command);

    expect(result).toEqual({ kind: "continue" });
    expect(frame.pc).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("M2 editor-only command skipped"));
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
