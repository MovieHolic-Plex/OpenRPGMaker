import { describe, expect, it } from "vitest";
import { resolveProposalApplyMode } from "@/ai/approvalPolicy";

describe("resolveProposalApplyMode", () => {
  it("쓰기 호출이 있으면 종류와 개수에 관계없이 바로 적용한다", () => {
    expect(resolveProposalApplyMode({ callCount: 1 })).toBe("apply-now");
    expect(resolveProposalApplyMode({ callCount: 7 })).toBe("apply-now");
  });

  it("변경 0건만 적용 대상이 아니다", () => {
    expect(resolveProposalApplyMode({ callCount: 0 })).toBe("no-changes");
  });
});
