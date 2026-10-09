import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";
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

  function seedHostEvent(characterId?: string): void {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "ev_fork_host",
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
      ...(characterId ? { characterId } : {}),
    };
    project.maps[mapId]!.events = [event];
    store.replace(project);
    editorState.set({ selectedEventId: event.id, currentMapId: mapId });
  }

  it("shows the always-false friendship hint on the fork form when the host has no NPC link", () => {
    seedHostEvent();
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "friendshipAtLeast", value: 80 },
          then: [],
        }
      )
    );
    const hint = findByTestId(body, "event-condition-friendship-requires-character-id");
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain("항상 거짓");
  });

  it("hides the friendship hint when the host has an NPC link", () => {
    seedHostEvent("char_a");
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "friendshipAtLeast", value: 80 },
          then: [],
        }
      )
    );
    expect(findByTestId(body, "event-condition-friendship-requires-character-id")).toBeFalsy();
  });

  it("uses minutes and seconds for the fork timer like the page control", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "timer", timerId: "timer1", seconds: 90 },
          then: [],
        }
      )
    );
    expect(findByTestId(body, "event-condition-timer-minutes")?.value).toBe("1");
    expect(findByTestId(body, "event-condition-timer-seconds")?.value).toBe("30");
    expect(body.textContent).toContain("분");
    expect(body.textContent).toContain("초");
  });

  it("defaults a new fork timer to 0 seconds like the page control", () => {
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
    mode.value = "timer";
    mode.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      condition: { kind: "timer", timerId: "timer1", seconds: 0 },
    });
  });

  it("labels npc activity as author-facing copy, not an internal id", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "npcActivity", activity: "work" },
          then: [],
        }
      )
    );
    expect(body.textContent).not.toContain("활동 ID");
    expect(body.textContent).toContain("지금 하는 일");
  });
});
