import { describe, expect, it } from "vitest";
import { directionForRuntimeKey, Input, RuntimeKeyHoldTracker } from "@/player/input";
import type Phaser from "phaser";

describe("runtime input", () => {
  it("maps arrow keys and WASD to RPG movement directions", () => {
    expect(directionForRuntimeKey("ArrowDown")).toBe("down");
    expect(directionForRuntimeKey("ArrowLeft")).toBe("left");
    expect(directionForRuntimeKey("ArrowRight")).toBe("right");
    expect(directionForRuntimeKey("ArrowUp")).toBe("up");
    expect(directionForRuntimeKey("s")).toBe("down");
    expect(directionForRuntimeKey("A")).toBe("left");
    expect(directionForRuntimeKey("d")).toBe("right");
    expect(directionForRuntimeKey("W")).toBe("up");
    expect(directionForRuntimeKey("x")).toBeNull();
  });

  it("keeps a held arrow direction active until keyup instead of waiting for key repeat", () => {
    const tracker = new RuntimeKeyHoldTracker();

    tracker.keyDown("ArrowRight");

    expect(tracker.heldDirections()).toEqual(["right"]);
    expect(tracker.heldDirections()).toEqual(["right"]);

    tracker.keyUp("ArrowRight");

    expect(tracker.heldDirections()).toEqual([]);
  });

  it("emits one action edge for a held key and waits for release before the next action", () => {
    const tracker = new RuntimeKeyHoldTracker();

    tracker.keyDown("Enter");

    expect(tracker.consumeActionEdge()).toBe(true);

    tracker.keyDown("Enter");

    expect(tracker.consumeActionEdge()).toBe(false);

    tracker.keyUp("Enter");
    tracker.keyDown("Enter");

    expect(tracker.consumeActionEdge()).toBe(true);
  });

  it("treats Z as the RPG Maker action key", () => {
    const tracker = new RuntimeKeyHoldTracker();

    tracker.keyDown("z");

    expect(tracker.consumeActionEdge()).toBe(true);

    tracker.keyUp("z");
    tracker.keyDown("Z");

    expect(tracker.consumeActionEdge()).toBe(true);
  });

  it("drops action edges captured while runtime input is disabled", () => {
    const input = new Input(sceneWithoutKeyboard());

    input.setEnabled(false);
    input.injectActionEdge();
    input.setEnabled(true);

    expect(input.update()).toMatchObject({ actionPressed: false, confirmPressed: false });

    input.resetEdges();
    input.injectActionEdge();

    expect(input.update()).toMatchObject({ actionPressed: true, confirmPressed: true });
  });
});

function sceneWithoutKeyboard(): Phaser.Scene {
  return { input: { keyboard: null } } as Phaser.Scene;
}
