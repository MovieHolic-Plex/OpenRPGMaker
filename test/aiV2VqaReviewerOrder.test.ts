import { describe, expect, it } from "vitest";
import { vqaReviewerCandidates } from "@/ai/v2/judge/vqa";
import { familyOfProviderId } from "@/ai/assistantRoles";

// 2026-11-12 측정(Haiku 5.5 high 실행, GPT 할당량 없음 · Gemini CLI 는 그림을 못 봄): 다른 계열 검수자가 모두 답하지 못하자 Haiku 가 제 화면을 검수했다.
// 같은 계열의 검수용 모델(Sonnet)은 후보에 없었다. 지은 모델이 제 화면을 보는 것은 맨 마지막이어야 한다.
const order = (main: { provider: string; model: string }, keyed: string[] = [main.provider]) =>
  vqaReviewerCandidates({ main, keyed: new Set(keyed), familyOf: (id) => familyOfProviderId(id, [main.model]) }).map((p) => `${p.provider}/${p.model}${p.sameAsMain ? " (같은 계열)" : ""}`);

describe("화면 검수자 차례 — 자기 자신은 맨 마지막", () => {
  it("Haiku 가 지으면: 다른 계열(Codex · Gemini) → 같은 계열의 Sonnet → Haiku 자신", () => {
    expect(order({ provider: "local-cli:claude", model: "claude-haiku-5-5" })).toEqual([
      "local-cli:codex/gpt-6.1-sol", "local-cli:gemini/gemini-4-argon",
      "local-cli:claude/claude-sonnet-5-5 (같은 계열)", "local-cli:claude/claude-haiku-5-5 (같은 계열)",
    ]);
  });

  it("Sonnet 이 지으면 같은 모델을 두 번 넣지 않는다", () => {
    const got = order({ provider: "local-cli:claude", model: "claude-sonnet-5-5" });
    expect(got.filter((p) => p.startsWith("local-cli:claude/"))).toEqual(["local-cli:claude/claude-sonnet-5-5 (같은 계열)"]);
  });

  it("GPT 가 지으면(Terra): 다른 계열(Sonnet · Gemini)이 먼저, 같은 계열의 검수용 모델이 자기 자신 앞", () => {
    const got = order({ provider: "openai-codex", model: "gpt-6.1-terra" });
    expect(got.slice(0, 2)).toEqual(["local-cli:claude/claude-sonnet-5-5", "local-cli:gemini/gemini-4-argon"]);
    expect(got.slice(-2)).toEqual(["local-cli:codex/gpt-6.1-sol (같은 계열)", "openai-codex/gpt-6.1-terra (같은 계열)"]);
  });

  it("다른 계열 후보에는 «같은 계열» 표시가 붙지 않고, 같은 계열 후보에는 늘 붙는다", () => {
    const picks = vqaReviewerCandidates({ main: { provider: "local-cli:claude", model: "claude-haiku-5-5" }, keyed: new Set(["local-cli:claude"]), familyOf: (id) => familyOfProviderId(id) });
    for (const p of picks) expect(p.sameAsMain).toBe(familyOfProviderId(p.provider) === "claude");
  });
});
