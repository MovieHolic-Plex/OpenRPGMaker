import { describe, expect, it } from "vitest";
import { fallenTierCard, v2ExtraToolNames } from "@/ai/v2/game";

const EXPLORE = "귀여운 고양이가 주인공인 탐험 게임 만들어줘";

describe("v2 whole-game quest exposure (fs-use-tools G1)", () => {
  it("offers create_quest for a game request that names no quest words, but not for a small edit", () => {
    expect(v2ExtraToolNames(EXPLORE)).toContain("create_quest");
    expect(v2ExtraToolNames("촌장 대사를 바꿔 줘")).not.toContain("create_quest");
  });

  it("tells the model to reuse an existing person and give new people a graphicQuery", () => {
    const card = fallenTierCard(EXPLORE);
    expect(card).toContain("create_quest");
    expect(card).toContain("graphicQuery");
    expect(card).toContain("EXISTING");
  });
});
