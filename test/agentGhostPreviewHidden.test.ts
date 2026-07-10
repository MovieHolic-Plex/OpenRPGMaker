import { describe, expect, it, beforeEach } from "vitest";
import {
  clearAgentGhostPreview,
  getAgentGhostPreviewState,
  isAgentGhostPreviewHidden,
  setAgentGhostPreviewHidden,
  subscribeAgentGhostPreview,
} from "@/editor/agentGhostPreview";

describe("agentGhostPreview hidden toggle", () => {
  beforeEach(() => {
    setAgentGhostPreviewHidden(false);
    clearAgentGhostPreview();
  });

  it("토글 상태를 보관하고 변경 시 구독자에게 알린다", () => {
    let notified = 0;
    const unsubscribe = subscribeAgentGhostPreview(() => { notified += 1; });
    const before = notified; // 구독 즉시 1회 호출됨
    setAgentGhostPreviewHidden(true);
    expect(isAgentGhostPreviewHidden()).toBe(true);
    expect(notified).toBe(before + 1);
    setAgentGhostPreviewHidden(true); // 동일 값 — emit 없음
    expect(notified).toBe(before + 1);
    setAgentGhostPreviewHidden(false);
    expect(isAgentGhostPreviewHidden()).toBe(false);
    unsubscribe();
  });

  it("숨김은 프리뷰 데이터 자체를 파괴하지 않는다", () => {
    setAgentGhostPreviewHidden(true);
    expect(getAgentGhostPreviewState().previews).toEqual([]);
    setAgentGhostPreviewHidden(false);
  });
});
