import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { renderAdvancedCommandBody } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { shouldRerenderCommandForm } from "@/editor/panels/eventEditor/commandEditDialog";
import { commandSchemaFor } from "@/editor/eventCommands/schema/defineCommand";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import type { Command, Condition } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

function change(element: FakeElement | null, value: string): void {
  if (!element) throw new Error(`missing control for value ${value}`);
  element.value = value;
  element.dispatchEvent(new Event("change"));
}

function stagedContext(initial: Command): { context: CommandEditContext; current: () => Command } {
  let command = initial;
  const context: CommandEditContext = {
    path: [0],
    getCurrentCommand: () => command,
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn((_path, next) => { command = next; }),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
    },
  };
  return { context, current: () => command };
}

describe("roguelike run event authoring", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => { restoreDom = installFakeDom(); });
  afterEach(() => { restoreDom?.(); });

  it("authors a run floor condition without raw JSON", () => {
    let current: Condition = { kind: "run", query: "floor", op: ">=", value: 3 };
    const body = renderWithFakeDom(() => conditionForm(current, (next) => { current = next; }));

    expect(findByTestId(body, "event-condition-run-query")?.value).toBe("floor");
    change(findByTestId(body, "event-condition-run-floor-op"), ">");
    change(findByTestId(body, "event-condition-run-floor-value"), "7");

    expect(current).toEqual({ kind: "run", query: "floor", op: ">", value: 7 });
  });

  it("keeps consecutive run flag edits on the latest staged command", () => {
    const initial: Command = { kind: "runControl", action: "setFlag", flag: "door", value: false };
    const staged = stagedContext(initial);
    const body = renderWithFakeDom(() => renderAdvancedCommandBody(staged.context, initial)!);

    change(findByTestId(body, "event-command-run-flag"), "bossDoor");
    change(findByTestId(body, "event-command-run-flag-value"), "true");

    expect(staged.current()).toEqual({ kind: "runControl", action: "setFlag", flag: "bossDoor", value: true });
  });

  it("rerenders the command editor when the run action changes shape", () => {
    expect(shouldRerenderCommandForm(
      { kind: "runControl", action: "start" },
      { kind: "runControl", action: "advance", amount: 1 },
    )).toBe(true);
  });

  it("registers runControl in the native command schema catalog", () => {
    expect(commandSchemaFor("runControl")?.family).toBe("system");
  });
});
