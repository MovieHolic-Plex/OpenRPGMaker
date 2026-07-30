import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import {
  clearCommandToolbarHistories,
  createCommandToolbarHistory,
} from "@/editor/panels/eventEditor/commandToolbarHistory";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command } from "@/project/types";
import { FakeElement, installFakeDom, renderWithFakeDom } from "./fakeDom";

function baseActions(overrides: Partial<CommandListActions> = {}): CommandListActions {
  return {
    addCommand: vi.fn(),
    insertCommand: vi.fn(),
    replaceCommand: vi.fn(),
    deleteCommand: vi.fn(),
    moveCommand: vi.fn(),
    moveCommandTo: vi.fn(),
    ...overrides,
  };
}

function dropEvent(sourcePath: readonly number[]): Event {
  const payload = JSON.stringify(sourcePath);
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: 1 },
    dataTransfer: {
      value: {
        types: ["application/x-rpgzzu-event-command-path", "text/plain"],
        getData: (type: string) =>
          type === "application/x-rpgzzu-event-command-path" || type === "text/plain" ? payload : "",
        setData: vi.fn(),
        effectAllowed: "move",
        dropEffect: "move",
      },
    },
  });
  return event;
}

describe("event command history lifecycle", () => {
  it("forwards cross-container moves and records them for undo", () => {
    let commands: Command[] = [{ kind: "text", body: "A" }];
    const moveCommandAcross = vi.fn(() => {
      commands = [{ kind: "text", body: "B" }];
    });
    const history = createCommandToolbarHistory({
      key: "map:event:page-cross",
      readCommands: () => commands,
      replaceCommands: (next) => { commands = next; },
    });
    const wrapped = history.wrapActions(baseActions({ moveCommandAcross }));

    expect(wrapped.moveCommandAcross).toBeTypeOf("function");
    wrapped.moveCommandAcross?.([0], [1, FORK_THEN_BRANCH_INDEX], 0);
    expect(moveCommandAcross).toHaveBeenCalledWith([0], [1, FORK_THEN_BRANCH_INDEX], 0);
    expect(history.canUndo()).toBe(true);
    history.undo();
    expect(commands).toEqual([{ kind: "text", body: "A" }]);
  });

  it("does not resurrect cancelled edits after the event session history is cleared", () => {
    let commands: Command[] = [{ kind: "text", body: "A" }];
    const key = "map:event:page-cancel";
    const first = createCommandToolbarHistory({
      key,
      readCommands: () => commands,
      replaceCommands: (next) => { commands = next; },
    });
    const wrapped = first.wrapActions(baseActions({
      replaceCommand: (_path, command) => { commands = [command]; },
    }));
    wrapped.replaceCommand([0], { kind: "text", body: "B" });
    expect(first.canUndo()).toBe(true);

    // Cancel restores A and closes the edit session.
    commands = [{ kind: "text", body: "A" }];
    clearCommandToolbarHistories("map:event:");
    const reopened = createCommandToolbarHistory({
      key,
      readCommands: () => commands,
      replaceCommands: (next) => { commands = next; },
    });
    expect(reopened.canUndo()).toBe(false);
    reopened.undo();
    expect(commands).toEqual([{ kind: "text", body: "A" }]);
  });
});

describe("nested event command drag/drop DOM", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => { restoreDom = installFakeDom(); });
  afterEach(() => restoreDom?.());

  it("uses the real nested parent path for same-branch row reordering", () => {
    const moveCommandTo = vi.fn();
    const commands: Command[] = [{
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_0001", value: true },
      then: [
        { kind: "text", body: "A" },
        { kind: "text", body: "B" },
      ],
    }];
    const host = renderWithFakeDom(() => {
      const root = document.createElement("div");
      renderCommandList(root, commands, [], baseActions({ moveCommandTo }));
      return root;
    });
    const rows = host.querySelectorAll('[data-testid="event-command-text"]') as unknown as FakeElement[];
    expect(rows).toHaveLength(2);
    rows[1]?.dispatchEvent(dropEvent([0, FORK_THEN_BRANCH_INDEX, 0]));
    expect(moveCommandTo).toHaveBeenCalledWith([0, FORK_THEN_BRANCH_INDEX, 0], 1);
  });

  it("renders an empty branch drop zone and routes root-to-branch moves across containers", () => {
    const moveCommandAcross = vi.fn();
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_0001", value: true },
        then: [],
      },
      { kind: "text", body: "move me" },
    ];
    const host = renderWithFakeDom(() => {
      const root = document.createElement("div");
      renderCommandList(root, commands, [], baseActions({ moveCommandAcross }));
      return root;
    });
    const zones = host.querySelectorAll('[data-testid="event-command-branch-drop-zone"]') as unknown as FakeElement[];
    const thenZone = zones.find((zone) =>
      zone.dataset.containerPath === JSON.stringify([0, FORK_THEN_BRANCH_INDEX])
    );
    expect(thenZone).toBeTruthy();
    thenZone?.dispatchEvent(dropEvent([1]));
    expect(moveCommandAcross).toHaveBeenCalledWith(
      [1],
      [0, FORK_THEN_BRANCH_INDEX],
      Number.MAX_SAFE_INTEGER
    );
  });
});
