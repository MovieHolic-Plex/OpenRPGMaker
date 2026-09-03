// 선택 영역 하드 클립이 제안을 전부 버렸을 때 사실을 먼저 말한다.
// 2026-09-03 적대적 리뷰 15: 툴은 「25/25칸 채움」, 맵은 0칸, 조수는 「채웠습니다」, 시스템 줄은 「바뀐 것이 없습니다」.
import { describe, expect, it } from "vitest";
import { clippedNoticeText, describeRegionTaskResult, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";

function result(overrides: Partial<RegionTaskResult>): RegionTaskResult {
  return {
    ok: true,
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    mapsAdded: 0,
    clippedCells: 0,
    proposedCalls: 1,
    assistantText: "",
    ...overrides,
  } as RegionTaskResult;
}

describe("영역 밖 클립 안내", () => {
  it("변경 0칸이 클립 때문이면 차단한 칸 수와 해제 방법을 말한다", () => {
    const text = describeRegionTaskResult(result({ clippedCells: 25 }));
    expect(text).toContain("25칸");
    expect(text).toContain("영역 밖");
    expect(text).toMatch(/해제|다시 선택/u);
  });

  it("클립이 없는 0칸 턴은 종전 문구를 유지한다", () => {
    expect(describeRegionTaskResult(result({}))).toBe("이 영역에서 바뀐 것이 없습니다.");
  });

  it("모델 문장 앞에 「맵은 바뀌지 않았다」 사실을 박는다", () => {
    const text = clippedNoticeText("오른쏙 옆에 물을 채웠습니다.", result({ clippedCells: 25 }));
    expect(text.startsWith("맵은 바뀌지 않았습니다")).toBe(true);
    expect(text).toContain("25칸");
    expect(text).toContain("오른쏙 옆에 물을 채웠습니다.");
  });

  it("적용됐거나 클립이 없으면 모델 문장을 그대로 둔다", () => {
    expect(clippedNoticeText("했습니다.", result({ applied: true, changedCells: 3 }))).toBe("했습니다.");
    expect(clippedNoticeText("했습니다.", result({}))).toBe("했습니다.");
  });
});
