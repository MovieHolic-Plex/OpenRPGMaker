import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLevelBody, changePartyBody } from "@/editor/panels/eventEditor/commandBodyDatabase";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function ctx(overrides: Partial<CommandEditContext["actions"]> = {}): CommandEditContext {
  return {
    path: [2],
    actions: {
      addCommand: vi.fn(),
      insertCommand: vi.fn(),
      replaceCommand: vi.fn(),
      deleteCommand: vi.fn(),
      moveCommand: vi.fn(),
      moveCommandTo: vi.fn(),
      ...overrides,
    },
  };
}

describe("changeParty command body UX", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    if (!actorId) throw new Error("blank project missing actor");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("commits membership changes without inserting unrelated actor commands", () => {
    const insertCommand = vi.fn();
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changePartyBody(ctx({ insertCommand, replaceCommand }), { kind: "changeParty", actorId, action: "add" })
    );
    const action = findByTestId(body, "change-party-action-select");
    if (!action) throw new Error("missing party action");
    action.value = "remove";
    action.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenLastCalledWith([2], { kind: "changeParty", actorId, action: "remove" });
    expect(insertCommand).not.toHaveBeenCalled();
    expect(findByTestId(body, "change-party-preview")?.dataset.afterIn).toBe("false");
  });

  it("still previews start-party membership", () => {
    const body = renderWithFakeDom(() =>
      changePartyBody(ctx(), { kind: "changeParty", actorId, action: "remove" })
    );
    const preview = findByTestId(body, "change-party-preview");
    expect(preview?.dataset.beforeIn).toBe("true");
    expect(preview?.dataset.afterIn).toBe("false");
  });

  it("renders rich level editor with actor card and preview", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changeLevelBody(ctx({ replaceCommand }), { kind: "changeLevel", actorId, op: "+=", amount: 2 })
    );
    expect(findByTestId(body, "change-level-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-level-actor-select")?.value).toBe(actorId);
    expect(findByTestId(body, "change-level-preview")).not.toBeNull();
    expect(body.textContent).toContain("레벨 변경");

    const amount = findByTestId(body, "change-level-amount-input") as FakeElement | null;
    if (!amount) throw new Error("missing amount");
    amount.value = "3";
    amount.dispatchEvent(new Event("change"));
    expect(replaceCommand).toHaveBeenCalledWith(
      [2],
      { kind: "changeLevel", actorId, op: "+=", amount: 3 } satisfies Command
    );
  });
});
