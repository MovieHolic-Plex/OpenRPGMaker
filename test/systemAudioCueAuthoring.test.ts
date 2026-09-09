/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { createDefaultM2Fields, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { audioCommandRepairsProject } from "./fixtures/eventCommandAudioRepairs";

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

function render(command: Command) {
  vi.spyOn(store, "getCurrent").mockReturnValue(audioCommandRepairsProject());
  const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
  const context: CommandEditContext = { path: [0], actions: {
    replaceCommand, addCommand: vi.fn(), insertCommand: vi.fn(), deleteCommand: vi.fn(), moveCommand: vi.fn(), moveCommandTo: vi.fn(),
  } };
  const body = renderM2CommandBody(context, command);
  if (!body) throw new Error("Missing command body");
  document.body.append(body);
  const cue = body.querySelector<HTMLSelectElement>('[data-testid="m2-command-cue-option-select"]');
  if (!cue) throw new Error("Missing cue selector");
  return { body, cue, replaceCommand };
}

describe("system audio cue authoring", () => {
  it("does not display or commit an active cue for legacy cue-less metadata", () => {
    const command: Command = { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { resourceId: "qa_bgm" } };
    const { cue, replaceCommand } = render(command);
    expect(cue.value).toBe("");
    expect(cue.selectedOptions[0]?.disabled).toBe(true);
    expect(replaceCommand).not.toHaveBeenCalled();
    cue.value = "victory";
    cue.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenCalledWith([0], { ...command, fields: { resourceId: "qa_bgm", cue: "victory" } });
  });

  it.each([["bgm", "battle"], ["se", "confirm"]] as const)("authors concrete %s defaults and reset through the form", (family, selected) => {
    const id = family === "bgm" ? "m2-027-change-system-bgm" : "m2-028-change-system-se";
    const entry = m2CommandById(id);
    if (!entry) throw new Error("Missing catalog entry");
    const fields = createDefaultM2Fields(entry);
    const { body, cue, replaceCommand } = render({ kind: "m2Command", commandId: id, fields });
    expect(cue.value).toBe(selected);
    const operation = body.querySelector<HTMLSelectElement>('[data-testid="m2-command-operation-option-select"]');
    if (!operation) throw new Error("Missing operation selector");
    operation.value = "reset";
    operation.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenCalledWith([0], { kind: "m2Command", commandId: id, fields: { ...fields, operation: "reset" } });
  });
});
