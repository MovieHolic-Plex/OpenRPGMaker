import { describe, expect, it } from "vitest";
import { isDialogueAdvanceKey } from "@/player/dialogue";

describe("dialogue keyboard controls", () => {
  it("accepts normalized keyboard-only advance keys", () => {
    expect(isDialogueAdvanceKey("Enter")).toBe(true);
    expect(isDialogueAdvanceKey("ENTER")).toBe(true);
    expect(isDialogueAdvanceKey(" ")).toBe(true);
    expect(isDialogueAdvanceKey("Space")).toBe(true);
    expect(isDialogueAdvanceKey("Escape")).toBe(true);
    expect(isDialogueAdvanceKey("E")).toBe(true);
    expect(isDialogueAdvanceKey("z")).toBe(true);
    expect(isDialogueAdvanceKey("Z")).toBe(true);
    expect(isDialogueAdvanceKey("ArrowDown")).toBe(false);
  });
});
