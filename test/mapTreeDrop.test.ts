import { describe, expect, it } from "vitest";
import { mapTreeDropRelation } from "@/editor/mapTreeDrop";

describe("mapTreeDropRelation", () => {
  it("uses only child drops on the root row", () => {
    expect(mapTreeDropRelation(2, 30, true)).toBe("child");
    expect(mapTreeDropRelation(28, 30, true)).toBe("child");
  });

  it("splits a row into before / child / after thirds", () => {
    expect(mapTreeDropRelation(4, 30, false)).toBe("before");
    expect(mapTreeDropRelation(15, 30, false)).toBe("child");
    expect(mapTreeDropRelation(26, 30, false)).toBe("after");
  });
});
