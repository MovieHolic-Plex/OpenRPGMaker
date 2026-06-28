import { describe, expect, it } from "vitest";
import { directionForRuntimeKey, RuntimeKeyHoldTracker } from "@/player/input";

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
});
