import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("fork command body UX (RM rhythm)", () => {
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

  it("renders condition-only dialog with else checkbox and list-editing hint", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "text", body: "열림" }],
        }
      )
    );

    expect(findByTestId(body, "event-command-fork-form")).toBeTruthy();
    expect(findByTestId(body, "event-condition-form")).toBeTruthy();
    expect(findByTestId(body, "event-condition-mode")).toBeTruthy();
    expect(body.textContent).toContain("조건 종류");
    expect(body.textContent).toContain("대상 스위치");
    expect(findByTestId(body, "event-fork-else-enabled")).toBeTruthy();
    expect(findByTestId(body, "event-fork-body-hint")?.textContent).toContain("왼쪽 목록");
    expect(findByTestId(body, "event-fork-summary-then")?.textContent).toContain("1개 명령");
    expect(findByTestId(body, "event-fork-summary-else")?.textContent).toContain("분기 없음");
    // No in-dialog then/else mini editors.
    expect(findByTestId(body, "event-fork-branch-then")).toBeFalsy();
    expect(findByTestId(body, "event-fork-branch-add-then")).toBeFalsy();
    expect(findByTestId(body, "event-condition-eval")).toBeTruthy();
  });

  it("toggles else branch via checkbox without body editors", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [],
        }
      )
    );
    const check = findByTestId(body, "event-fork-else-enabled") as FakeElement | null;
    expect(check).toBeTruthy();
    if (!check) return;
    check.checked = true;
    check.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      else: [],
    });
  });

  it("updates leaf condition through labeled controls", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [],
        }
      )
    );
    const state = findByTestId(body, "event-condition-switch-value") as FakeElement | null;
    expect(state).toBeTruthy();
    if (!state) return;
    state.value = "false";
    state.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      condition: { kind: "switch", switchId, value: false },
    });
  });

  it("can author all/any group conditions from mode select", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [],
        }
      )
    );
    const mode = findByTestId(body, "event-condition-mode") as FakeElement | null;
    expect(mode).toBeTruthy();
    if (!mode) return;
    mode.value = "all";
    mode.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      condition: { kind: "all" },
    });
  });
});
