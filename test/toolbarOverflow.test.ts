import { describe, expect, it } from "vitest";
import { visibleItemCount } from "@/editor/panels/toolbarOverflow";

describe("visibleItemCount", () => {
  it("전부 들어가면 전체 개수를 돌려준다", () => {
    expect(visibleItemCount(400, [50, 50, 50], 30, 4)).toBe(3);
  });

  it("넘치면 ⋯ 버튼 폭을 남기고 최대 개수", () => {
    // 50*4 + gap*3 = 212 > 150 → ⋯(30)+gap 확보 후 들어가는 만큼
    expect(visibleItemCount(150, [50, 50, 50, 50], 30, 4)).toBe(2);
  });

  it("아무것도 안 들어가면 0", () => {
    expect(visibleItemCount(20, [50, 50], 30, 4)).toBe(0);
  });
});
