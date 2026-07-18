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

  it("explains membership-only scope and offers follow-up commands", () => {
    const insertCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      changePartyBody(ctx({ insertCommand }), { kind: "changeParty", actorId, action: "add" })
    );

    expect(findByTestId(body, "change-party-intent")).not.toBeNull();
    expect(body.textContent).toContain("합류/이탈만");
    expect(findByTestId(body, "change-party-followups")).not.toBeNull();
    expect(findByTestId(body, "change-party-db-note")).not.toBeNull();
    expect(findByTestId(body, "change-party-followup-level")).not.toBeNull();

    (findByTestId(body, "change-party-followup-level") as FakeElement | null)?.dispatchEvent(new Event("click"));
    expect(insertCommand).toHaveBeenCalledWith(
      [3],
      expect.objectContaining({ kind: "changeLevel", actorId, op: "+=", amount: 1 })
    );
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
