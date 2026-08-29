import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCoreCommandBody } from "@/editor/panels/eventEditor/commandBodyCore";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function context(replaceCommand = vi.fn()): CommandEditContext {
  return {
    path: [2],
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

function command(a = "guard", b = "player"): Extract<Command, { kind: "changeFactionStance" }> {
  return { kind: "changeFactionStance", a, b, op: "-=", value: 1 };
}

describe("changeFactionStance faction pickers", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.factions = {
      defs: [
        { id: "guard", name: "경비대" },
        { id: "bandit", name: "산적단" },
      ],
      relations: [],
    };
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders both operands as labeled selects with reserved and authored factions, then writes a selection", () => {
    const replaceCommand = vi.fn<CommandEditContext["actions"]["replaceCommand"]>();
    const body = renderWithFakeDom(() => renderCoreCommandBody(context(replaceCommand), command())!);
    const factionA = findByTestId(body, "event-command-faction-a");
    const factionB = findByTestId(body, "event-command-faction-b");

    expect(factionA?.tagName).toBe("SELECT");
    expect(factionB?.tagName).toBe("SELECT");
    expect(factionA?.closest("label")).not.toBeNull();
    expect(factionB?.closest("label")).not.toBeNull();
    const expectedIds = ["player", "enemy", "guard", "bandit"];
    expect(factionA?.children.map((option) => option.value)).toEqual(expectedIds);
    expect(factionB?.children.map((option) => option.value)).toEqual(expectedIds);
    expect(factionA?.children.map((option) => option.textContent)).toEqual([
      "플레이어 (player)",
      "적 (enemy)",
      "경비대 (guard)",
      "산적단 (bandit)",
    ]);

    if (!factionA) throw new Error("진영 A 선택기가 없습니다.");
    const value = findByTestId(body, "event-command-faction-value");
    if (!value) throw new Error("태도 값 입력기가 없습니다.");
    Object.defineProperty(value, "valueAsNumber", { configurable: true, value: 1 });
    factionA.value = "bandit";
    factionA.dispatchEvent(new Event("change"));

    expect(replaceCommand).toHaveBeenLastCalledWith([2], {
      kind: "changeFactionStance",
      a: "bandit",
      b: "player",
      op: "-=",
      value: 1,
    });
  });

  it("keeps a stored missing faction id visible and selected", () => {
    const body = renderWithFakeDom(() => renderCoreCommandBody(context(), command("gaurd"))!);
    const factionA = findByTestId(body, "event-command-faction-a");

    expect(factionA?.tagName).toBe("SELECT");
    expect(factionA?.value).toBe("gaurd");
    expect(factionA?.children.map((option) => option.value)).toContain("gaurd");
    expect(factionA?.children.find((option) => option.value === "gaurd")?.textContent).toContain("gaurd");
  });
});
