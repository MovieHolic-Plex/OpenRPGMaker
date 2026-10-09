// expect.shopStock 거부 문구가 모양을 말한다 — 「값 형식이 맞지 않습니다」만으론 모델이 추측하며 시험을 거듭 다시 불렀다
// (2026-10-05 스트레스 p-shop).
import { describe, expect, it } from "vitest";
import { sceneTestInputProblem } from "@/testing/sceneTestRunner";

describe("scene test expect field messages", () => {
  it("shopStock 잘못된 모양이면 기대 모양을 알려 준다", () => {
    const problem = sceneTestInputProblem({ mapId: "m", start: { x: 1, y: 1 }, steps: [{ kind: "expect", shopStock: [{ itemId: "potion", price: 50 }] }] });
    expect(problem).toContain("shopStock");
    expect(problem).toContain("itemIds");
    expect(problem).not.toContain("값 형식이 맞지 않습니다");
  });
});
