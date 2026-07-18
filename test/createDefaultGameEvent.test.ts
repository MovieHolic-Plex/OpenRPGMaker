import { describe, expect, it } from "vitest";
import { createDefaultGameEvent } from "@/editor/eventActions";

describe("createDefaultGameEvent", () => {
  it("creates events without a default charset graphic", () => {
    const event = createDefaultGameEvent(3, 4);
    expect(event.sprite).toBeUndefined();
    expect(event.pages?.[0]?.graphic).toEqual({});
    expect(event.x).toBe(3);
    expect(event.y).toBe(4);
    expect(event.commands).toEqual([]);
  });
});
