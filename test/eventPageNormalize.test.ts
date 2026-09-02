import { describe, expect, it } from "vitest";
import { normalizeEventPage } from "@/editor/eventPages";

describe("normalizeEventPage", () => {
  it("fills the fields the event editor reads without optional chaining", () => {
    const page = normalizeEventPage({ id: "page-1", name: "첫 방문" });

    expect(page.graphic).toEqual({});
    expect(page.trigger).toEqual({ kind: "action" });
    expect(page.priority).toBe("same");
    expect(page.movement).toEqual({ type: "fixed", speed: 3, frequency: 3 });
    expect(page.conditions).toEqual([]);
    expect(page.commands).toEqual([]);
    expect(page.name).toBe("첫 방문");
  });

  it("keeps authored movement extras when only some fields are missing", () => {
    const page = normalizeEventPage({
      id: "page-2",
      name: "단골 창구",
      movement: { type: "random" } as never,
      commands: [{ kind: "text", body: "어서 오세요" }],
    });

    expect(page.movement.type).toBe("random");
    expect(page.movement.speed).toBe(3);
    expect(page.movement.frequency).toBe(3);
    expect(page.commands).toEqual([{ kind: "text", body: "어서 오세요" }]);
  });
});
