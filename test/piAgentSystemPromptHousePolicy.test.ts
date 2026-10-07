import { describe, expect, it } from "vitest";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { AGENT_UX_POLICY_LINES, HOUSE_VARIETY_POLICY_LINE } from "@/ai/promptPolicies";
import { createBlankProject } from "@/project/defaults/defaultProject";

describe("Pi 시공 에이전트 시스템 프롬프트 — 집 규칙", () => {
  it("채팅 세션과 같은 집 다양성 정책 줄을 받는다", () => {
    // 2026-09-17: 이 줄이 없어서 Pi 팀의 author_house 가 templateId 없는 사각형만 깔았다.
    const lines = buildPiAgentSystemPrompt(createBlankProject(), []);
    expect(lines).toContain(HOUSE_VARIETY_POLICY_LINE);
    expect(AGENT_UX_POLICY_LINES).toContain(HOUSE_VARIETY_POLICY_LINE);
  });

  it("정책 줄이 지운 참고 사례 레시피(ref-walled·ref-castle, 2026-10-07 저작권 정리)를 더는 권하지 않는다", () => {
    expect(HOUSE_VARIETY_POLICY_LINE).toContain("templateId");
    expect(HOUSE_VARIETY_POLICY_LINE).not.toContain("ref-walled-");
    expect(HOUSE_VARIETY_POLICY_LINE).not.toContain("ref-castle-");
  });
});
