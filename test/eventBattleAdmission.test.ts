/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";

type BattleCommand = Extract<Command, { kind: "battleProcessing" }>;
const previous = store.getCurrent();
let project = createBlankProject();
beforeEach(() => { project = createBlankProject(); store.replaceProject(project); });
afterEach(() => { document.body.replaceChildren(); store.replaceProject(previous); });
function control(id: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}
function select(id: string, value: string): void {
  const node = control(id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`Not a select ${id}`);
  node.value = value; node.dispatchEvent(new Event("change"));
}
function command(): BattleCommand {
  return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false,
    victoryBranch: [{ kind: "setFlag", flag: "kept", value: true }] };
}
function troop() {
  const record = project.database.troops[0];
  if (!record) throw new Error("Missing fixture troop");
  return record;
}

describe("native battle confirmation admission", () => {
  it.each(["empty", "missing", "empty-members", "variable-empty", "variable-missing"])("retains the draft when %s is confirmed and allows corrected authoring", kind => {
    // Given an incomplete command and a separate valid troop for correction.
    const initial = command();
    const validId = troop().id;
    if (kind === "missing") initial.troopId = "removed-troop";
    if (kind === "empty-members") {
      project.database.troops.push({ ...troop(), id: "empty", members: [], enemyIds: [] });
      initial.troopId = "empty";
    }
    if (kind.startsWith("variable")) {
      initial.troopSource = "variable"; initial.troopVariableId = kind === "variable-empty" ? "" : "removed-variable";
    }
    const apply = vi.fn();
    openEventCommandEditDialog({ initial, onApply: apply });
    const dialog = control("event-command-edit-dialog");
    control("battle-processing-preset-boss").click();
    // When confirming invalid input, no command is committed or discarded.
    control("event-command-edit-ok").click();
    expect(apply).not.toHaveBeenCalled();
    expect(control("event-command-edit-dialog")).toBe(dialog);
    const warning = control("battle-processing-warning");
    expect(warning.hidden).toBe(false);
    expect(warning.textContent?.trim().length).toBeGreaterThan(0);
    // Correct the same mounted draft; prior rule and branch edits survive.
    select("battle-processing-troop-source", "fixed");
    select("battle-processing-troop-select", validId);
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      troopId: validId, canEscape: false, battleFlow: "strict", victoryBranch: initial.victoryBranch,
    }));
    expect(dialog.isConnected).toBe(false);
  });

  it("revalidates a troop removed while the dialog is open", () => {
    const apply = vi.fn();
    openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
    project.database.troops = [];
    control("event-command-edit-ok").click();
    expect(apply).not.toHaveBeenCalled();
    expect(control("battle-processing-warning").hidden).toBe(false);
  });

  it("accepts a selected variable without treating the unused fixed reference as required", () => {
    const variable = project.variables[0];
    if (!variable) throw new Error("Missing fixture variable");
    const initial = { ...command(), troopSource: "variable", troopVariableId: variable.id } as const;
    const apply = vi.fn();
    openEventCommandEditDialog({ initial, onApply: apply });
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledExactlyOnceWith(initial);
  });

  it.each(["hidden", "legacy"])("accepts legitimate %s composition", kind => {
    if (kind === "hidden") troop().members = troop().enemyIds.map(enemyId => ({ enemyId, hidden: true, x: 20, y: 20 }));
    else troop().members = [];
    const apply = vi.fn();
    openEventCommandEditDialog({ initial: { ...command(), troopId: troop().id }, onApply: apply });
    control("event-command-edit-ok").click();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("blocks aggregate event Apply for a troop whose effective composition is empty", () => {
    troop().members = []; troop().enemyIds = [];
    const event: GameEvent = { id: "admission", x: 1, y: 1, trigger: { kind: "action" },
      commands: [], pages: [{ id: "battle-page", name: "Battle", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ ...command(), troopId: troop().id }] }] };
    const result = validateEventDraftBody(project, project.startMapId, event);
    expect(result.canCommit).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "battle.troop.empty", severity: "error", commandPath: [0] }));
  });
});
