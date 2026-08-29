/**
 * 승인 대기 턴이 "아직 반영되지 않았다" 를 먼저 말하는지 고정한다.
 *
 * 2026-08-29 실측 두 건이 근거다.
 *  - 15:41: 턴이 stoppedReason "final" / applied:false 로 끝났는데 모델의 마지막 말은
 *    "시공했습니다" 였다. 사용자는 반영된 줄 알고 맵을 봤고 아무것도 없었다.
 *  - 15:44: max-tool-calls 로 잘려 assistantText 가 빈 채 313칸이 대기로 남았다.
 *    화면에는 아무 말도 없었다.
 * 게이트 자체는 그대로 둔다(영역 작업은 승인 카드가 계약이다). 말만 사실로 바꾼다.
 */
import { describe, expect, it } from "vitest";
import { describeRegionTaskResult, pendingApprovalText, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";

const CHANGED = { changedCells: 313, changedEvents: 0, mapsAdded: 0 } as const;

function baseResult(overrides: Partial<RegionTaskResult>): RegionTaskResult {
  return {
    ok: true,
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
    ...overrides,
  } as RegionTaskResult;
}

describe("승인 대기 안내", () => {
  it("모델이 '시공했습니다' 라고 단정해도 미반영 사실이 앞에 온다", () => {
    const text = pendingApprovalText("숲을 시공했습니다.", CHANGED);
    expect(text.startsWith("아직 맵에 반영되지 않았습니다")).toBe(true);
    expect(text).toContain("313칸 타일");
    expect(text).toContain("[적용]");
    // 모델 문장을 지우지는 않는다 — 무엇을 하려 했는지는 여전히 정보다.
    expect(text).toContain("숲을 시공했습니다.");
  });

  it("모델이 침묵한 턴(예산 소진)에도 대기 규모를 말한다", () => {
    const text = pendingApprovalText("", CHANGED);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain("313칸 타일");
    expect(text).not.toContain("\n\n");
  });

  it("이벤트·맵 추가도 규모에 함께 센다", () => {
    const text = pendingApprovalText("", { changedCells: 12, changedEvents: 3, mapsAdded: 1 });
    expect(text).toContain("12칸 타일");
    expect(text).toContain("이벤트 3건");
    expect(text).toContain("맵 1개 추가");
  });

  it("바뀐 칸이 없으면 대기 규모를 꾸며내지 않는다", () => {
    const text = pendingApprovalText("검토했습니다.", { changedCells: 0, changedEvents: 0, mapsAdded: 0 });
    expect(text).toContain("바뀐 칸이 없어 적용할 것이 없습니다");
    expect(text).not.toContain("칸 타일");
  });

  it("한 줄 요약도 대기를 '반영되지 않았다'로 말한다", () => {
    const summary = describeRegionTaskResult(baseResult({
      ...CHANGED,
      pending: { settled: false } as RegionTaskResult["pending"],
    }));
    expect(summary).toContain("승인 대기");
    expect(summary).toContain("아직 반영되지 않았습니다");
  });

  it("변경을 만들고 반영하지 않은 결과를 '변경이 없다'로 뒤집어 말하지 않는다", () => {
    // 이전 판은 두 문구가 뒤집혀 있어 313칸이 남아도 "적용할 변경이 없습니다" 라고 답했다.
    const discarded = describeRegionTaskResult(baseResult(CHANGED));
    expect(discarded).toContain("313칸 타일");
    expect(discarded).not.toContain("적용할 변경이 없습니다");

    const empty = describeRegionTaskResult(baseResult({}));
    expect(empty).toBe("이 영역에서 바뀐 것이 없습니다.");
  });
});
