import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { store } from "@/project/store";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
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
});
