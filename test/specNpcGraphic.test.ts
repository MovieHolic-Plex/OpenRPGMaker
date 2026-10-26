import { describe, expect, it } from "vitest";
import { resolveSpecNpcGraphic, specNpcGraphicLadder } from "@/ai/session/specNpcGraphic";

describe("spec NPC graphic ladder (full name → role noun, no substitution)", () => {
  it("uses the full name when it matches a charset label", () => {
    const tried: string[] = [];
    const match = resolveSpecNpcGraphic("여관 주인", (query) => { tried.push(query); return query === "여관 주인"; });
    expect(match).toEqual({ query: "여관 주인", term: "full" });
    expect(tried).toEqual(["여관 주인"]);
  });

  it("falls back to the role noun when the full name has no label", () => {
    const tried: string[] = [];
    const match = resolveSpecNpcGraphic("잡화점 상인", (query) => { tried.push(query); return query === "상인"; });
    expect(match).toEqual({ query: "상인", term: "role" });
    expect(tried).toEqual(["잡화점 상인", "상인"]);
  });

  it("returns null when nothing matches — no unrelated graphic is chosen", () => {
    expect(resolveSpecNpcGraphic("잡화점 상인", () => false)).toBeNull();
    expect(specNpcGraphicLadder("잡화점 상인").map((step) => step.query)).toEqual(["잡화점 상인", "상인"]);
    // A single-word name has no separate role noun to try.
    expect(specNpcGraphicLadder("촌장").map((step) => step.query)).toEqual(["촌장"]);
  });

  it("matches the real catalog: 「잡화점 상인」 has no label, 「상인」 does", () => {
    expect(resolveSpecNpcGraphic("잡화점 상인")).toEqual({ query: "상인", term: "role" });
  });
});
