import { describe, expect, it } from "vitest";
import { classifyApproval, resolveProposalApplyMode } from "@/ai/approvalPolicy";
import type { ProposedCall } from "@/ai/assistantSession";

function call(name: string, overrides: Partial<ProposedCall> = {}): ProposedCall {
  return {
    name,
    args: {},
    summary: `${name} summary`,
    result: { ok: true, summary: `${name} summary` },
    destructive: false,
    ...overrides,
  };
}

function mode(input: Partial<Parameters<typeof resolveProposalApplyMode>[0]>): string {
  return resolveProposalApplyMode({
    callCount: 1,
    autoApplyEnabled: true,
    approvalDecision: "auto",
    turnErrored: false,
    ...input,
  });
}

describe("resolveProposalApplyMode", () => {
  it("자동 적용이 켜진 비파괴 제안은 바로 적용한다", () => {
    expect(mode({})).toBe("apply-now");
  });

  it("자동 적용을 끄면 검토 카드로 보낸다", () => {
    expect(mode({ autoApplyEnabled: false })).toBe("review");
  });

  it("승인이 필요한 판정은 검토 카드로 보낸다", () => {
    expect(mode({ approvalDecision: "require_approval" })).toBe("review");
  });

  it("오류로 끝난 턴은 적용하지 않는다", () => {
    expect(mode({ turnErrored: true })).toBe("review");
  });

  it("변경 0건은 적용 대상이 아니다", () => {
    expect(mode({ callCount: 0 })).toBe("review");
  });

  it("안전 분류와 린트 경고는 입력이 아니다 — 이벤트를 만드는 제안도 바로 적용된다", () => {
    const calls = [call("paint_tiles"), call("place_npc")];
    const verdict = classifyApproval(calls, { autoApproveEnabled: true });
    expect(verdict.decision).toBe("auto");
    expect(mode({ callCount: calls.length, approvalDecision: verdict.decision })).toBe("apply-now");
  });

  it("파괴적 도구가 섞이면 classifyApproval 을 거쳐 검토로 간다", () => {
    const calls = [call("paint_tiles"), call("clear_region")];
    const verdict = classifyApproval(calls, { autoApproveEnabled: true });
    expect(verdict.decision).toBe("require_approval");
    expect(mode({ callCount: calls.length, approvalDecision: verdict.decision })).toBe("review");
  });
});
