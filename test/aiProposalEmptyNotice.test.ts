// 0건 프로포절 비블로킹화(도그푸딩 결함 ⑤) 회귀 테스트.
// - 전용 알림(ai-proposal-empty-notice)과 전용 닫기 버튼(ai-proposal-dismiss)을 쓴다 —
//   기존에 [확인] 버튼이 ai-proposal-reject testid를 재사용하던 문제 정리.
// - 완성도 린트 경고 라인이 알림 본문에 담긴다(대화 로그 기록은 패널 통합 경로에서 수행).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEmptyProposalNotice, EMPTY_PROPOSAL_NOTICE_DISMISS_MS } from "@/editor/panels/aiChatPanel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.restoreAllMocks();
});

describe("renderEmptyProposalNotice", () => {
  it("전용 testid(알림/닫기)를 쓰고 완성도 린트 라인을 담는다", () => {
    const onDismiss = vi.fn();
    const lines = ["⚠ 미이행: road_horiz/road_vert/house_a 외 2개 영역 미변경"];
    const notice = renderWithFakeDom(() => renderEmptyProposalNotice(lines, onDismiss));

    expect(notice.dataset.testid).toBe("ai-proposal-empty-notice");
    // 기존 결함: [확인]이 ai-proposal-reject testid를 재사용 → 전용 dismiss testid로 교체 확인.
    expect(findByTestId(notice, "ai-proposal-reject")).toBeNull();
    const dismiss = findByTestId(notice, "ai-proposal-dismiss");
    expect(dismiss).toBeTruthy();
    expect(notice.textContent).toContain("변경 제안 없음");
    expect(notice.textContent).toContain("⚠ 미이행");

    dismiss?.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("자동 소거 지연은 양수 상수로 정의된다(패시브 알림 계약)", () => {
    expect(EMPTY_PROPOSAL_NOTICE_DISMISS_MS).toBeGreaterThan(0);
  });
});
