import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
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

function changeParams(fields: Record<string, string | number> = {}): Extract<Command, { kind: "m2Command" }> {
  return {
    kind: "m2Command",
    commandId: "m2-014-change-parameters",
    fields: {
      target: "",
      parameter: "maxHp",
      operation: "add",
      value: 1,
      ...fields,
    },
  };
}

describe("change parameters command body UX", () => {
  let restoreDom: (() => void) | undefined;
  let actorId = "";

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    actorId = project.database.actors[0]?.id ?? "";
    if (!actorId) throw new Error("missing actor");
    store.replace(project);
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders rich target/param/op UI instead of raw text fields", () => {
    const body = renderWithFakeDom(() => renderM2CommandBody(ctx(), changeParams({ target: actorId, parameter: "attack", value: 5 }))!);
    expect(findByTestId(body, "change-parameters-command-body")).not.toBeNull();
    expect(findByTestId(body, "change-parameters-intent")).not.toBeNull();
    expect(findByTestId(body, "change-parameters-param-chips")).not.toBeNull();
    expect(findByTestId(body, "change-parameters-presets")).toBeNull();
    expect(findByTestId(body, "change-parameters-preview")).not.toBeNull();
    expect(body.textContent).toContain("영구 보정");
    expect(body.textContent).not.toContain("프리셋");
    expect(findByTestId(body, "change-parameters-param-attack")?.className).toContain("is-active");
  });

  it("writes mind parameter through chips", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() => renderM2CommandBody(ctx(replaceCommand), changeParams({ target: actorId }))!);
    (findByTestId(body, "change-parameters-param-mind") as FakeElement | null)?.dispatchEvent(new Event("click"));
    expect(replaceCommand).toHaveBeenCalled();
    const next = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "m2Command" }>;
    expect(next.fields.parameter).toBe("mind");
  });

  it("summarizes change parameters in Korean labels", () => {
    const parts = commandSummaryParts(
      changeParams({ target: actorId, parameter: "defense", operation: "add", value: 7 })
    );
    const text = parts.map((part) => part.text).join("");
    expect(text).toContain("능력치 변경");
    expect(text).toContain("방어");
    expect(text).toContain("＋7");
  });

  it("preview caption uses the concrete Korean command title, not internal M2 jargon", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview(changeParams({ target: actorId, parameter: "maxHp", value: 1 }))
    );
    expect(preview.textContent).toContain("능력치 변경");
    expect(preview.textContent).not.toMatch(/M2|현대 명령/);
  });
});
