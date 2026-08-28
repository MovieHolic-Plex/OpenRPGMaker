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
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import type { Command, GameEvent } from "@/project/types";

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
