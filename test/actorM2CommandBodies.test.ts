import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [1],
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

function m2(commandId: string, fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
  return { kind: "m2Command", commandId, fields };
}

describe("actor m2 command body UX", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";
  let variableId = "";
  let stateId = "";
  let classId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    variableId = project.variables[0]?.id ?? "";
    stateId = project.database.states[0]?.id ?? "";
    classId = project.database.classes[0]?.id ?? "";
    if (!actorId) throw new Error("missing actor");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders change-state rich form with party target + state picker", () => {
    const body = renderWithFakeDom(() =>
      renderM2CommandBody(ctx(), m2("m2-019-change-state", { target: "party", operation: "add", value: stateId }))!
    );
    expect(findByTestId(body, "change-state-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-state-target-mode")).not.toBeNull();
    expect(findByTestId(body, "change-state-state-select")).not.toBeNull();
    expect(findByTestId(body, "change-state-preview")).not.toBeNull();
    expect(body.textContent).toContain("상태 변경");
  });

  it("writes damage value from variable source", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      renderM2CommandBody(
        ctx(replaceCommand),
        m2("m2-021-damage-processing", {
          target: actorId,
          operation: "add",
          value: 10,
          valueSource: "number",
        })
      )!
    );
    expect(findByTestId(body, "damage-processing-command-body")).not.toBeNull();
    (findByTestId(body, "damage-processing-value-source-segment-variable") as FakeElement | null)?.dispatchEvent(
      new Event("click")
    )
    const variableRoot = findByTestId(body, "damage-processing-value-variable") as FakeElement | null;
    const variableSelect = variableRoot?.querySelector?.("select") as FakeElement | null;
    if (variableSelect && variableId) {
      variableSelect.value = variableId;
      variableSelect.dispatchEvent(new Event("change"));
    }
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
    expect(next.fields.valueSource).toBe("variable");
    if (variableId) expect(next.fields.valueVariableId).toBe(variableId);
  });

  it("renders name/nickname/class/graphic/faceset rich shells", () => {
    const cases = [
      ["m2-022-change-actor-name", "change-actor-name-command-body"],
      ["m2-023-change-actor-nickname", "change-actor-nickname-command-body"],
      ["m2-024-change-actor-graphic", "change-actor-graphic-command-body"],
      ["m2-025-change-actor-faceset", "change-actor-faceset-command-body"],
      ["m2-091-change-actor-class", "change-actor-class-command-body"],
    ] as const;
    for (const [commandId, testId] of cases) {
      const body = renderWithFakeDom(() =>
        renderM2CommandBody(ctx(), m2(commandId, { target: actorId, value: classId || "" }))!
      );
      expect(findByTestId(body, testId), commandId).not.toBeNull();
    }
  });

  it("summarizes damage and actor identity commands in Korean", () => {
    const damage = commandSummaryParts(
      m2("m2-021-damage-processing", {
        target: "party",
        operation: "add",
        value: 12,
        valueSource: "variable",
        valueVariableId: variableId || "var_0001",
      })
    )
      .map((part) => part.text)
      .join("");
    expect(damage).toContain("데미지");
    expect(damage).toContain("변수");

    const name = commandSummaryParts(
      m2("m2-022-change-actor-name", { target: actorId, value: "새이름" })
    )
      .map((part) => part.text)
      .join("");
    expect(name).toContain("주인공 이름 변경");
    expect(name).toContain("새이름");
  });
});
