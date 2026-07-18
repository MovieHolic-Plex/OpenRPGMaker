// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";

describe("scoped event command forms", () => {
  let replaced: Command | undefined;

  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    replaceCommand: (_path, command) => {
      replaced = command;
    },
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
  };

  beforeEach(() => {
    const project = createBlankProject();
    project.endings = [
      { id: "ending_true", name: "True Ending", conditions: [], priority: 10 },
    ];
    store.replace(project);
    replaced = undefined;
  });

  it("renders every cutscene field as a stable control", () => {
    const body = render({ kind: "cutsceneControl", mode: "begin", skippable: true });

    expect(body.querySelector('[data-testid="cutscene-control-editor"]')).toBeTruthy();
    expect(body.querySelector('[data-testid="event-command-cutscene-mode"]')).toBeInstanceOf(HTMLSelectElement);
    expect(body.querySelector('[data-testid="event-command-cutscene-skippable"]')).toBeInstanceOf(HTMLInputElement);
  });

  it("removes skippable when cutscene mode changes to end", () => {
    const body = render({ kind: "cutsceneControl", mode: "begin", skippable: true });
    const mode = select(body, "event-command-cutscene-mode");

    mode.value = "end";
    mode.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "cutsceneControl", mode: "end" });
  });

  it("falls back to the existing cutscene mode for an empty selection", () => {
    const body = render({ kind: "cutsceneControl", mode: "begin", skippable: true });
    const mode = select(body, "event-command-cutscene-mode");

    mode.value = "";
    mode.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "cutsceneControl", mode: "begin", skippable: true });
  });

  it("renders every follower-add field as a stable control", () => {
    const body = render({ kind: "addFollower", actorId: "", name: "" });
    const ids = [
      "event-command-add-follower-actor-id",
      "event-command-add-follower-name",
      "event-command-add-follower-use-graphic",
      "event-command-add-follower-graphic-type",
      "event-command-add-follower-graphic-id",
      "event-command-add-follower-graphic-direction",
      "event-command-add-follower-graphic-pattern",
      "event-command-add-follower-graphic-transparent",
    ];

    expect(body.querySelector('[data-testid="add-follower-editor"]')).toBeTruthy();
    for (const id of ids) expect(body.querySelector(`[data-testid="${id}"]`)).toBeTruthy();
  });

  it("writes a selected actor without empty optional fields", () => {
    const actorId = store.getCurrent().database.actors[0]?.id ?? "actor_hero";
    const body = render({ kind: "addFollower", actorId: "", name: "" });
    const actor = select(body, "event-command-add-follower-actor-id");

    actor.value = actorId;
    actor.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "addFollower", actorId });
  });

  it("writes all confirmed custom graphic fields", () => {
    const body = render({
      kind: "addFollower",
      graphic: {
        sprite: { type: "bundled", id: "old" },
        direction: "down",
        pattern: 1,
        transparent: false,
      },
    });
    const direction = select(body, "event-command-add-follower-graphic-direction");

    direction.value = "left";
    direction.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({
      kind: "addFollower",
      graphic: {
        sprite: { type: "bundled", id: "old" },
        direction: "left",
        pattern: 1,
        transparent: false,
      },
    });
  });

  it("falls back to the existing graphic direction for an empty selection", () => {
    const body = render({ kind: "addFollower", graphic: { direction: "right", pattern: 2 } });
    const direction = select(body, "event-command-add-follower-graphic-direction");

    direction.value = "";
    direction.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({
      kind: "addFollower",
      graphic: { direction: "right", pattern: 2, transparent: false },
    });
  });

  it("renders remove-follower fields and safely falls back to remove-all for an empty name", () => {
    const body = render({ kind: "removeFollower", name: "Guide" });
    const name = input(body, "event-command-remove-follower-name");

    expect(body.querySelector('[data-testid="remove-follower-editor"]')).toBeTruthy();
    expect(body.querySelector('[data-testid="event-command-remove-follower-mode"]')).toBeInstanceOf(HTMLSelectElement);
    name.value = "";
    name.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "removeFollower", all: true });
  });

  it("writes the optional checkpoint label", () => {
    const body = render({ kind: "checkpointSave" });
    const label = input(body, "event-command-checkpoint-label");

    label.value = "  dungeon-entry  ";
    label.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "checkpointSave", label: "dungeon-entry" });
  });

  it("writes the optional defeat message", () => {
    const body = render({ kind: "killPlayer" });
    const message = input(body, "event-command-kill-player-message");

    message.value = "  The trap closes.  ";
    message.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "killPlayer", message: "The trap closes." });
  });

  it("writes a registered ending and treats empty as automatic selection", () => {
    const body = render({ kind: "triggerEnding" });
    const ending = select(body, "event-command-trigger-ending-id");

    ending.value = "ending_true";
    ending.dispatchEvent(new Event("change"));

    expect(replaced).toEqual({ kind: "triggerEnding", endingId: "ending_true" });
  });

  it("keeps truly terminal commands on their hint-only route", () => {
    const body = render({ kind: "gameOver" });

    expect(body.querySelector('[data-testid="game-over-editor"]')).toBeTruthy();
    expect(body.querySelector("input, select, textarea")).toBeNull();
  });

  function render(command: Command): HTMLElement {
    return renderCommandBody({ path: [2], actions, lockKind: true }, command);
  }
});

function input(root: HTMLElement, testId: string): HTMLInputElement {
  const node = root.querySelector(`[data-testid="${testId}"]`);
  if (!(node instanceof HTMLInputElement)) throw new TypeError(`${testId} is not an input`);
  return node;
}

function select(root: HTMLElement, testId: string): HTMLSelectElement {
  const node = root.querySelector(`[data-testid="${testId}"]`);
  if (!(node instanceof HTMLSelectElement)) throw new TypeError(`${testId} is not a select`);
  return node;
}
