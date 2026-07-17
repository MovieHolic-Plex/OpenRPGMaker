import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { shouldRerenderCommandForm } from "@/editor/panels/eventEditor/commandEditDialog";
import { formatVariableFormula } from "@/editor/panels/eventEditor/commandBodyVariable";
import { createBlankProject } from "@/project/defaults";
import { setVariable, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("setVariable command body + runtime", () => {
  let restoreDom: (() => void) | undefined;
  let replaced: Command | undefined;

  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: (_path, command) => {
      replaced = command;
    },
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    replaced = undefined;
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("applies number operand and op segment changes into replaceCommand", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        { kind: "setVariable", variableId, op: "=", value: 0 }
      )
    );

    const numberInput = findByTestId(body, "event-command-variable-number-value") as FakeElement | null;
    expect(numberInput).toBeTruthy();
    if (!numberInput) return;
    numberInput.value = "42";
    numberInput.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "setVariable",
      variableId,
      op: "=",
      value: 42,
    });

    const opSelect = findByTestId(body, "event-command-variable-op") as FakeElement | null;
    expect(opSelect).toBeTruthy();
    if (!opSelect) return;
    opSelect.value = "+=";
    opSelect.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "setVariable",
      variableId,
      op: "+=",
      value: 42,
    });
  });

  it("switches to variable operand picker and stores var operand", () => {
    const project = store.getCurrent();
    const variableId = project.variables[0]?.id ?? "var_0001";
    // Ensure at least one variable exists for operand selection.
    if (project.variables.length < 1) {
      project.variables.push({ id: "var_0001", name: "테스트" });
      store.replace(project);
    }
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        { kind: "setVariable", variableId, op: "=", value: 3 }
      )
    );

    const source = findByTestId(body, "event-command-variable-value-source") as FakeElement | null;
    expect(source).toBeTruthy();
    if (!source) return;
    source.value = "variable";
    source.dispatchEvent(new Event("change"));

    expect(replaced).toMatchObject({
      kind: "setVariable",
      variableId,
      op: "=",
      value: { kind: "var", id: "" },
    });

    // Operand picker select lives inside event-command-variable-operand.
    const operandHost = findByTestId(body, "event-command-variable-operand") as FakeElement | null;
    expect(operandHost).toBeTruthy();
    const operandSelect =
      (operandHost as unknown as { querySelector?: (s: string) => FakeElement | null })?.querySelector?.("select")
      ?? null;
    // FakeDom may expose select as first select child via child walk.
    const selectNode = operandSelect ?? findFirstSelect(operandHost);
    expect(selectNode).toBeTruthy();
    if (!selectNode) return;
    selectNode.value = variableId;
    selectNode.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "setVariable",
      variableId,
      value: { kind: "var", id: variableId },
    });
  });

  it("rerenders form when value source or op changes", () => {
    const base: Command = { kind: "setVariable", variableId: "var_a", op: "=", value: 1 };
    expect(
      shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "=", value: { kind: "var", id: "var_b" } })
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "+=", value: 1 })
    ).toBe(true);
    expect(
      shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "=", value: 9 })
    ).toBe(false);
  });

  it("formatVariableFormula is readable for authors", () => {
    store.getCurrent().variables[0] = { id: "var_0001", name: "점수" };
    expect(
      formatVariableFormula({ kind: "setVariable", variableId: "var_0001", op: "*=", value: 3 })
    ).toContain("×=");
    expect(
      formatVariableFormula({ kind: "setVariable", variableId: "", op: "=", value: 0 })
    ).toContain("[변수 선택]");
  });

  it("runtime setVariable ops match contract including divide-by-zero keep", () => {
    const session = startSession(store.getCurrent());
    setVariable(session, "v", "=", 7);
    setVariable(session, "v", "+=", 5);
    setVariable(session, "v", "-=", 2);
    setVariable(session, "v", "*=", 3);
    setVariable(session, "v", "/=", 4);
    expect(session.variables.v).toBe(7); // floor(((7+5-2)*3)/4)
    setVariable(session, "v", "/=", 0);
    expect(session.variables.v).toBe(7);
  });
});

function findFirstSelect(root: FakeElement | null): FakeElement | null {
  if (!root) return null;
  const nodes = root.childNodes ?? [];
  for (const node of nodes) {
    const el = node as FakeElement;
    if (String(el.tagName ?? "").toLowerCase() === "select") return el;
    const nested = findFirstSelect(el);
    if (nested) return nested;
  }
  return null;
}
